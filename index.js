const RemoteMerge = require("./remote-merge.js");

(async () => {
	try {
		/*var originalSnapshot = await RemoteMerge.snapshot("./test/a", /^.+\.txt$/);
		//console.log("original:", originalSnapshot);
		//await RemoteMerge.save("original-snapshot.json", originalSnapshot);

		var modifiedSnapshot = await RemoteMerge.snapshot("./test/b", /^.+\.txt$/);
		//console.log("modified:", modifiedSnapshot);
		//await RemoteMerge.save("modified-snapshot.json", originalSnapshot);

		var comparison = RemoteMerge.compare(originalSnapshot, modifiedSnapshot);
		console.log(comparison);
		console.log();

		var zip = await RemoteMerge.generatePackage("./test/b", comparison);
		//console.log(zip);
		await RemoteMerge.saveZip(zip);*/

		//RemoteMerge.generateMergePackage("./test/a", "./test/b");

		RemoteMerge.applyMergePackage("./test/a", "remote-merge_1555459586939.zip");

		//Make sure to create a 'c' folder
		//RemoteMerge.zipToDir((await RemoteMerge.loadZip("remote-merge_1555459586939.zip")), "./test/c");
	} catch (err){
		console.error("CAUGHT ERROR:", err);
	}
})()

//var modifiedSnapshot = RemoteMerge.snapshot("./test/b");

//RemoteMerge.diff(originalSnapshot, modifiedSnapshot);

//TODO: Build package
//TODO: Install package

console.log();