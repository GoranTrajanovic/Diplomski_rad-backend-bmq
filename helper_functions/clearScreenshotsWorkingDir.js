import fs from "fs";

export default (dir) => {
    // const parentDir = dir.slice(0, dir.indexOf("/"));
    const fullPathParentDir = `app/projects/${dir}/screenshots`;
    const parentDirFolders = fs.readdirSync(fullPathParentDir);

    parentDirFolders.map((path) => {
        fs.rmSync(`${fullPathParentDir}/${path}`, {
            recursive: true,
            force: true,
        });
    });
};
