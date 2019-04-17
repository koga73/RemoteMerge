# RemoteMerge
"Snapshot" folders, compare snapshots, build packages, merge between local and remote systems

## Install
```node
npm i
```

## Simple API
```node
//Build package comparing original content in 'a' to modified content in 'b'
var packageName = await RemoteMerge.generateMergePackage("./test/a", "./test/b");

//Apply package containing what changed to our original content
await RemoteMerge.applyMergePackage("./test/a", packageName);
```

## Advanced API

### Snapshots

#### Take a snapshot of a folder
```node
var originalSnapshot = await RemoteMerge.snapshot("./test/a");
await RemoteMerge.save("original-snapshot.json", originalSnapshot);
```

#### Take a snapshot of the modified folder
```node
var modifiedSnapshot = await RemoteMerge.snapshot("./test/b");
await RemoteMerge.save("modified-snapshot.json", modifiedSnapshot);
```

Note you can specify a file filter and hashing algorithm (MD5 by default)
```node
RemoteMerge.snapshot("./test/a", /^.+\.txt$/, "sha256")
```

---

### Compare

#### Compare snapshots
```node
var originalSnapshot = await RemoteMerge.load("original-snapshot.json");
var modifiedSnapshot = await RemoteMerge.load("modified-snapshot.json");
var comparison = RemoteMerge.compare(originalSnapshot, modifiedSnapshot);
```

---

### Packages

#### Generate package
```node
//Our package containing what changed comes from our modified content
var zip = await RemoteMerge.generatePackage("./test/b", comparison);
await RemoteMerge.saveZip(zip, "./package.zip");
```
Note that the zip filename is optional. If not specified one will be generated.

#### Apply package
```node
//Our package containing what changed gets applied to the original content
var zip = await RemoteMerge.loadZip("package.zip");
await RemoteMerge.applyPackage("./test/b", zip);
```