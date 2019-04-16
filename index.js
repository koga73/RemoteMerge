const RemoteMerge = require("./remote-merge.js");

(async () => {
	try {
		var originalSnapshot = await RemoteMerge.snapshot("./test/a", /^.+\.txt$/);
		//console.log("original:", originalSnapshot);
		//await RemoteMerge.save("original-snapshot.json", originalSnapshot);

		var modifiedSnapshot = await RemoteMerge.snapshot("./test/b", /^.+\.txt$/);
		//console.log("modified:", modifiedSnapshot);
		//await RemoteMerge.save("modified-snapshot.json", originalSnapshot);

		var comparison = RemoteMerge.compare(originalSnapshot, modifiedSnapshot);
		console.log(comparison);
		console.log();

		var zip = await RemoteMerge.package("./test/b", comparison);
		//console.log(zip);
		await RemoteMerge.saveZip(zip);
	} catch (err){
		console.error("CAUGHT ERROR:", err);
	}
})()

//var modifiedSnapshot = RemoteMerge.snapshot("./test/b");

//RemoteMerge.diff(originalSnapshot, modifiedSnapshot);

//TODO: Build package
//TODO: Install package

console.log();