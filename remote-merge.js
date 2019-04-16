const fs = require("fs");
const crypto = require("crypto");

const REGEX_PATTERN = /^.+$/;
const HASH_ALGORITHM = "md5"; //Fast and fine for most applications

class RemoteMerge {
	static snapshot(dir, regexPattern, hashAlgorithm){
		regexPattern = regexPattern || REGEX_PATTERN;
		hashAlgorithm = hashAlgorithm || HASH_ALGORITHM;

		return new Promise((resolve, reject) => {
			fs.readdir(dir, async (err, list) => {
				if (err) {
					reject(err);
				}
				var tree = {};
				var listLen = list.length;
				for (var i = 0; i < listLen; i++){
					var name = list[i];
					var fullPath = dir + '/' + name;
					try {
						var stat = await RemoteMerge.stat(fullPath);
						if (stat && stat.isDirectory()){
							tree[name] = await RemoteMerge.snapshot(fullPath, regexPattern, hashAlgorithm); //Recurse
						} else {
							if (regexPattern.test(fullPath)){
								//TODO: Don't compute checksums for large files?
								tree[name] = await RemoteMerge.fileChecksum(fullPath, hashAlgorithm); //Checksum
							}
						}
					} catch (err){
						reject(err);
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
				comparison[name] = "deleted";
			} else {
				var originalVal = originalSnapshot[name];
				var modifiedVal = modifiedSnapshot[name];
				switch (true){
					//File
					case (RemoteMerge.isString(originalVal)):
						if (originalSnapshot[name] !== modifiedSnapshot[name]){
							comparison[name] = "modified";
						}
						break;
					//Directory
					case (RemoteMerge.isObject(originalVal)):
						if (RemoteMerge.isObject(modifiedVal)){
							//Recurse
							comparison[name] = RemoteMerge.compare(originalVal, modifiedVal);
						} else {
							comparison[name] = "modified";
						}
						break;
				}
			}
		}
		for (var name in modifiedSnapshot){
			if (typeof originalSnapshot[name] === typeof undefined){
				comparison[name] = "added";
			}
		}
		return comparison;
	}

	static save(filePath, obj){
		return new Promise((resolve, reject) => {
			fs.writeFile(filePath, JSON.stringify(obj), (err) => {
				if (err){
					reject(err);
				} else {
					resolve(filePath);
				}
			});
		});
	}

	static load(filePath){
		return new Promise((resolve, reject) => {
			fs.readFile(filePath, (err, data) => {
				if (err){
					reject(err);
				} else {
					resolve(JSON.parse(data));
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
module.exports = RemoteMerge;