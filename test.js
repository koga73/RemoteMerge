const RemoteMerge = require("./remote-merge.js");

(async () => {
	try {
		//Simple API
		
		//Build package comparing original content in 'a' to modified content in 'b'
		var packageName = await RemoteMerge.generateMergePackage("./test/a", "./test/b");
		//Apply package containing what changed to our original content
		await RemoteMerge.applyMergePackage("./test/a", packageName);

		//Note that the zip filename is optional. If not specified one will be generated
		//Note you can specify a file filter and hashing algorithm (MD5 by default)
		//await RemoteMerge.generateMergePackage("./test/a", "./test/b", "package.zip", /^.+\.txt$/, "sha256");

		//Advanced API
		/*
		//Take a snapshot of a folder
		var originalSnapshot = await RemoteMerge.snapshot("./test/a"); //Note you can specify a file filter and hashing algorithm (MD5 by default)
		await RemoteMerge.save("original-snapshot.json", originalSnapshot);

		//Take a snapshot of the modified folder
		var modifiedSnapshot = await RemoteMerge.snapshot("./test/b"); //Note you can specify a file filter and hashing algorithm (MD5 by default)
		await RemoteMerge.save("modified-snapshot.json", modifiedSnapshot);

		//Compare snapshots
		var originalSnapshot = await RemoteMerge.load("original-snapshot.json");
		var modifiedSnapshot = await RemoteMerge.load("modified-snapshot.json");
		var comparison = RemoteMerge.compare(originalSnapshot, modifiedSnapshot);

		//Generate package
		//Our package containing what changed comes from our modified content
		var zip = await RemoteMerge.generatePackage("./test/b", comparison);
		await RemoteMerge.saveZip(zip, "./package.zip");

		//Apply package
		//Our package containing what changed gets applied to the original content
		var zip = await RemoteMerge.loadZip("package.zip");
		await RemoteMerge.applyPackage("./test/b", zip); //Note that the zip filename is optional. If not specified one will be generated
		*/
	} catch (err){
		console.error("CAUGHT ERROR:", err);
	}
})();