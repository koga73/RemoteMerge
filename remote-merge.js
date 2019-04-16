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
						if (originalSnapshot[name] !== modifiedSnapshot[name]){
							comparison[name] = RemoteMerge.MODIFIED;
						}
						break;
					//Directory
					case (RemoteMerge.isObject(originalVal)):
						if (RemoteMerge.isObject(modifiedVal)){
							//Recurse
							comparison[name] = RemoteMerge.compare(originalVal, modifiedVal);
						} else {
							comparison[name] = RemoteMerge.MODIFIED;
						}
						break;
				}
			}
		}
		for (var name in modifiedSnapshot){
			if (typeof originalSnapshot[name] === typeof undefined){
				comparison[name] = RemoteMerge.ADDED;
			}
		}
		return comparison;
	}

	static package(modifiedPath, comparison, zip, zipCurrentPath){
		zip = zip || new JSZip();
		zipCurrentPath = zipCurrentPath || "";

		//Increase path
		var isRoot = zipCurrentPath == "";
		if (!isRoot){
			zipCurrentPath += "/";
		} 
		
		return new Promise((resolve, reject) => {
			fs.readdir(modifiedPath, async (err, list) => {
				if (err) {
					reject(err);
					return;
				}
				var listLen = list.length;
				for (var i = 0; i < listLen; i++){
					var name = list[i];
					var fullPath = modifiedPath + '/' + name;

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
								case RemoteMerge.ADDED:
								case RemoteMerge.MODIFIED:
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
							await RemoteMerge.package(fullPath, comparison[name], zip.folder(name), relativePath);
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
	
	static saveZip(zip, filePath){
		filePath = filePath || "remote-merge_" + new Date().getTime() + ".zip";

		return new Promise(async (resolve, reject) => {
			var zipBuffer = null;
			try {
				zipBuffer = await zip.generateAsync({
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
			
			resolve(RemoteMerge.save(filePath, zipBuffer, false));
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
RemoteMerge.MODIFIED = "modified";
RemoteMerge.ADDED = "added";
RemoteMerge.MANIFEST = "manifest.json";

module.exports = RemoteMerge;