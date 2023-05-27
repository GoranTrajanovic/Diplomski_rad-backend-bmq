import fs from "fs";

export default (dir) => {
    const parentDir = dir.slice(0, dir.indexOf("/"));
    const fullPathParentDir = "app/screenshots/" + parentDir;
    const parentDirFolders = fs.readdirSync(fullPathParentDir);
    /* const parentDirFoldersExceptLast = parentDirFolders.slice(
        0,
        parentDirFolders.length - 1
    ); */

    console.log("parentDirFolders", parentDirFolders);

    parentDirFolders.map((path) => {
        fs.rmSync(`${fullPathParentDir}/${path}`, {
            recursive: true,
            force: true,
        });
    });
};
