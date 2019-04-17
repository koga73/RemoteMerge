const fs = require("fs");
const crypto = require("crypto");

const JSZip = require("jszip");

const REGEX_PATTERN = /^.+$/;
const HASH_ALGORITHM = "md5"; //Fast and fine for most applications

const DEBUG = true;

class RemoteMerge {
	constructor(){
		this.interface = this;
	}

	static generateMergePackage(originalDir, modifiedDir, zipOutput, fileRegex, hashAlgorithm){
		return new Promise(async (resolve, reject) => {
			try {
				var originalSnapshot = await RemoteMerge.snapshot(originalDir, fileRegex, hashAlgorithm);
				var modifiedSnapshot = await RemoteMerge.snapshot(modifiedDir, fileRegex, hashAlgorithm);
				var comparison = RemoteMerge.compare(originalSnapshot, modifiedSnapshot);
				var zip = await RemoteMerge.generatePackage(modifiedDir, comparison);
				resolve(RemoteMerge.saveZip(zip, zipOutput));
			} catch (err){
				reject(err);
				return;
			}
		});
	}

	static applyMergePackage(originalDir, zipPath){
		return new Promise(async (resolve, reject) => {
			try {
				var zip = await RemoteMerge.loadZip(zipPath);
				resolve(RemoteMerge.applyPackage(originalDir, zip));
			} catch (err){
				reject(err);
				return;
			}
		});
	}

	static snapshot(dir, fileRegex, hashAlgorithm){
		fileRegex = fileRegex || REGEX_PATTERN;
		hashAlgorithm = hashAlgorithm || HASH_ALGORITHM;

		return new Promise((resolve, reject) => {
			fs.readdir(dir, async (err, list) => {
				if (err) {
					reject(err);
					return;
				}
				var tree = {};
				var listLen = list.length;
				for (var i = 0; i < listLen; i++){
					var name = list[i];
					var fullPath = dir + '/' + name;
					try {
						var stat = await RemoteMerge.stat(fullPath);
						if (stat.isDirectory()){
							tree[name] = await RemoteMerge.snapshot(fullPath, fileRegex, hashAlgorithm); //Recurse
						} else {
							if (fileRegex.test(fullPath)){
								//TODO: Don't include large files?
								tree[name] = await RemoteMerge.fileChecksum(fullPath, hashAlgorithm); //Checksum
							}
						}
					} catch (err){
						reject(err);
						return;
					}
				}
				resolve(tree);
			});
		});
	}

	static compare(originalSnapshot, modifiedSnapshot){
		var comparison = {};
		for (var name in originalSnapshot){
			if (typeof modifiedSnapshot[name] === typeof undefined){
				comparison[name] = RemoteMerge.DELETED;
			} else {
				var originalVal = originalSnapshot[name];
				var modifiedVal = modifiedSnapshot[name];
				switch (true){
					//File
					case (RemoteMerge.isString(originalVal)):
						if (originalVal !== modifiedVal){
							switch (true){
								//File
								case (RemoteMerge.isString(originalVal)):
									comparison[name] = RemoteMerge.MODIFIED_FILE;
									break;
								//Directory
								case (RemoteMerge.isObject(originalVal)):
									comparison[name] = RemoteMerge.MODIFIED_DIR;
									break;
							}
						}
						break;
					//Directory
					case (RemoteMerge.isObject(originalVal)):
						switch (true){
							//File
							case (RemoteMerge.isString(modifiedVal)):
								comparison[name] = RemoteMerge.MODIFIED_FILE;
								break;
							//Directory
							case (RemoteMerge.isObject(modifiedVal)):
								//Recurse
								comparison[name] = RemoteMerge.compare(originalVal, modifiedVal);
								break;
						}
						break;
				}
			}
		}
		for (var name in modifiedSnapshot){
			var modifiedVal = modifiedSnapshot[name];
			if (typeof originalSnapshot[name] === typeof undefined){
				switch (true){
					//File
					case (RemoteMerge.isString(modifiedVal)):
						comparison[name] = RemoteMerge.ADDED_FILE;
						break;
					//Directory
					case (RemoteMerge.isObject(modifiedVal)):
					comparison[name] = RemoteMerge.ADDED_DIR;
						break;
				}
			}
		}
		return comparison;
	}

	static generatePackage(modifiedDir, comparison, zip, zipCurrentPath){
		zip = zip || new JSZip();
		zipCurrentPath = zipCurrentPath || "";

		//Increase path
		var isRoot = zipCurrentPath == "";
		if (!isRoot){
			zipCurrentPath += "/";
		} 
		
		return new Promise((resolve, reject) => {
			fs.readdir(modifiedDir, async (err, list) => {
				if (err) {
					reject(err);
					return;
				}
				var listLen = list.length;
				for (var i = 0; i < listLen; i++){
					var name = list[i];
					var fullPath = modifiedDir + '/' + name;

					var comparisonVal = comparison[name];
					if (typeof comparisonVal === typeof undefined){
						continue;
					}

					var stat = null;
					try {
						stat = await RemoteMerge.stat(fullPath);
					} catch (err){
						reject(err);
						return;
					}
					var relativePath = zipCurrentPath + name;

					switch (true){
						//Added/Modified
						case (RemoteMerge.isString(comparisonVal)):
							switch (comparisonVal){
								case RemoteMerge.ADDED_FILE:
								case RemoteMerge.ADDED_DIR:
								case RemoteMerge.MODIFIED_FILE:
								case RemoteMerge.MODIFIED_DIR:
									if (stat.isDirectory()){
										if (DEBUG){
											console.log("ADD FOLDER", relativePath, name);
										}
										await RemoteMerge.dirToZip(fullPath, null, zip.folder(name), zipCurrentPath);
									} else {
										if (DEBUG){
											console.log("ADD FILE", relativePath, name);
										}
										zip.file(name, await (RemoteMerge.load(fullPath, false)));
									}
									break;
							}
							break;
						//Directory
						case (RemoteMerge.isObject(comparisonVal)):
							if (DEBUG){
								console.log("RECURSE", fullPath);
							}
							if (DEBUG){
								console.log("ADD FOLDER", relativePath, name);
							}
							//Recurse
							await RemoteMerge.generatePackage(fullPath, comparison[name], zip.folder(name), relativePath);
							break;
					}
				}

				if (isRoot){
					//Add manifest (comparison)
					zip.file(RemoteMerge.MANIFEST, JSON.stringify(comparison));
					resolve(zip);
				} else {
					resolve();
				}
			});
		});
	}

	static dirToZip(dir, fileRegex, zip, zipCurrentPath){
		fileRegex = fileRegex || REGEX_PATTERN;
		zip = zip || new JSZip();
		zipCurrentPath = zipCurrentPath || "";

		//Increase path
		var isRoot = zipCurrentPath == "";
		if (!isRoot){
			zipCurrentPath += "/";
		}

		return new Promise((resolve, reject) => {
			fs.readdir(dir, async (err, list) => {
				if (err) {
					reject(err);
					return;
				}
				var tree = {};
				var listLen = list.length;
				for (var i = 0; i < listLen; i++){
					var name = list[i];
					var fullPath = dir + '/' + name;
					try {
						var stat = await RemoteMerge.stat(fullPath);
						if (stat.isDirectory()){
							//Recurse
							await RemoteMerge.dirToZip(fullPath, fileRegex, zip.folder(name), zipCurrentPath);
						} else {
							if (fileRegex.test(fullPath)){
								//TODO: Don't include large files?
								zip.file(name, await (RemoteMerge.load(fullPath, false)));
							}
						}
					} catch (err){
						reject(err);
						return;
					}
				}
				resolve(zip);
			});
		});
	}

	static applyPackage(originalDir, comparison, zip){
		comparison = this.comparison || null;

		return new Promise(async (resolve, reject) => {
			if (!comparison){
				try {
					comparison = JSON.parse(await zip.file(RemoteMerge.MANIFEST).async("string"));
				} catch (err){
					reject(err);
					return;
				}
			}

			for (var name in comparison){
				var fullPath = originalDir + name;
				var comparisonVal = comparison[name];
				var stat = null;
				if (fs.existsSync(fullPath)){
					try {
						stat = await RemoteMerge.stat(fullPath);
					} catch (err){
						reject(err);
						return;
					}
				}

				try {
					switch (comparisonVal){
						case RemoteMerge.DELETED:
							if (stat){
								//Delete
								fs.unlinkSync(fullPath);
							}
							break;
	
						case RemoteMerge.MODIFIED_FILE:
							if (stat){
								//Delete
								fs.unlinkSync(fullPath);
							}
						case RemoteMerge.ADDED_FILE:
							await RemoteMerge.save(fullPath, await zip.file(name).async("nodebuffer"), false);
							break;
	
						case RemoteMerge.MODIFIED_DIR:
							if (stat){
								//Delete
								fs.unlinkSync(fullPath);
							}
						case RemoteMerge.ADDED_DIR:
							fs.mkdirSync(fullPath);
							//Recurse
							await applyPackage(fullPath, comparison, zip.folder(name));
							break;
					}
				} catch (err){
					reject(err);
					return;
				}
			}

			resolve();
		});
	}
	
	static saveZip(zip, filePath){
		filePath = filePath || "remote-merge_" + new Date().getTime() + ".zip";

		return new Promise(async (resolve, reject) => {
			var buffer = null;
			try {
				buffer = await zip.generateAsync({
					type:"nodebuffer",
					compression:"DEFLATE",
					compressionOptions:{
						level:9
					},
					comment:"Package generated by RemoteMerge"
				});
			} catch (err){
				reject(err);
				return;
			}
			
			resolve(RemoteMerge.save(filePath, buffer, false));
		});
	}

	static loadZip(filePath, zip){
		zip = zip || new JSZip();

		return new Promise(async (resolve, reject) => {
			var buffer = null;
			try {
				buffer = await RemoteMerge.load(filePath, false)
			} catch (err){
				reject(err);
				return;
			}

			resolve(zip.loadAsync(buffer));
		});
	}

	static save(filePath, obj, json){
		if (typeof json === typeof undefined){
			json = true; //Default
		}
		json = json === true;

		return new Promise((resolve, reject) => {
			fs.writeFile(filePath, (json) ? JSON.stringify(obj) : obj, (err) => {
				if (err){
					reject(err);
				} else {
					resolve(filePath);
				}
			});
		});
	}

	static load(filePath, json){
		if (typeof json === typeof undefined){
			json = true; //Default
		}
		json = json === true;

		return new Promise((resolve, reject) => {
			fs.readFile(filePath, (err, data) => {
				if (err){
					reject(err);
				} else {
					resolve((json) ? JSON.parse(data) : data);
				}
			});
		});
	}

	static stat(filePath){
		return new Promise((resolve, reject) => {
			fs.stat(filePath, (err, stat) => {
				if (err){
					reject(err);
				} else {
					resolve(stat);
				}
			});
		});
	}

	//Obtained from: https://stackoverflow.com/a/47951271/3610169
	static fileChecksum(filePath, hashAlgorithm){
		hashAlgorithm = hashAlgorithm || HASH_ALGORITHM;

		return new Promise((resolve, reject) =>
			fs.createReadStream(filePath)
				.on('error', reject)
				.pipe(crypto.createHash(hashAlgorithm)
				.setEncoding('hex'))
				.once('finish', function () {
					resolve(this.read());
				})
		)
	}

	static isObject(obj){
		return obj && obj.constructor && obj.constructor.toString().indexOf("Object") > -1;
	}

	static isString(str){
		return typeof str === typeof "";
	}
}
//TODO: Reorganize these at top
RemoteMerge.DELETED = "deleted";
RemoteMerge.MODIFIED_FILE = "modified_file";
RemoteMerge.MODIFIED_DIR = "modified_dir";
RemoteMerge.ADDED_FILE = "added_file";
RemoteMerge.ADDED_DIR = "added_dir";
RemoteMerge.MANIFEST = "manifest.json";

module.exports = RemoteMerge;