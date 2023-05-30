import fs from "fs";
import axios from "axios";
import fetch, { blobFrom } from "node-fetch";

export default async function (dir, URL) {
    const metaObject = getNamesOfAllMatchingImages(dir, URL);

    if (isRootWebpage(URL)) uploadRootWebsiteToDB(metaObject);
    // uploadWebpagesToDB(metaObject);
}

function isRootWebpage(URL) {
    return URL.slice(URL.lastIndexOf("/") + 1, URL.length) === "";
}

function getNamesOfAllMatchingImages(dir, URL) {
    const parentDir = dir.slice(0, dir.indexOf("/"));
    const fullPathParentDir = "app/screenshots/" + parentDir;
    const parentDirFolders = fs.readdirSync(fullPathParentDir);
    const pathToImagesFolder = `${fullPathParentDir}/${parentDirFolders[0]}`;
    const plainURL = URL.slice(
        URL.indexOf("//") + 2,
        isRootWebpage(URL) ? URL.length - 1 : URL.length
    );
    let parentDirFiles = fs.readdirSync(
        `${fullPathParentDir}/${parentDirFolders[0]}`
    );
    parentDirFiles = parentDirFiles.filter((imgName) => {
        return (
            imgName.slice(0, imgName.indexOf("_")) ===
                URL.slice(URL.lastIndexOf("/") + 1, URL.length) ||
            (isRootWebpage(URL) && imgName.includes("root"))
        );
    });

    return { plainURL, parentDirFiles, pathToImagesFolder };
}

async function uploadRootWebsiteToDB({
    plainURL,
    parentDirFiles,
    pathToImagesFolder,
}) {
    const coverImageURI = `${pathToImagesFolder}/${parentDirFiles[0]}`;

    const data = {
        Root_URL: plainURL,
        Web_Vitals_Score: "Hard-coded",
        slug: plainURL.replaceAll(".", "-"),
    };

    const res = await axios
        .post("http://127.0.0.1:1337/api/websites", {
            data,
        })
        .then(async (res) => {
            const refId = res.data.data.id;

            const file = await blobFrom(coverImageURI, "image/png");

            const form = new FormData();
            form.append("files", file, "reviews_-_chromium_-_desktop.png");
            form.append("refId", refId);
            form.append("ref", "api::website.website");
            form.append("field", "Frontpage_Screenshot");

            res = await fetch("http://127.0.0.1:1337/api/upload", {
                method: "post",
                body: form,
            });
        })
        .catch((e) => {
            console.log(
                "Error in uploading website to DB:",
                JSON.stringify(e).slice(0, 250)
            );
        });
}

async function uploadWebpagesToDB({
    plainURL,
    parentDirFiles,
    pathToImagesFolder,
}) {
    const tempObjForDB = {};
    const filesObj = parentDirFiles.map((imgName) => {
        return {
            imgName,
            imgBlob: blobFrom(`${pathToImagesFolder}/${imgName}`, "image/png"),
        };
    });

    console.dir(filesObj);

    /*


    WE NEED TO GET BLOB NAME FOR UPLOADING IT TO DB 



    */

    const data = {
        URL: plainURL,
    };

    const res = await axios
        .post("http://127.0.0.1:1337/api/webpages", {
            data,
        })
        .then(async (res) => {
            const refId = res.data.data.id;

            filesObj.map(async ({ imgName, imgBlob }) => {
                console.log("imgName", imgName);
                /* const form = new FormData();
                form.append(
                    "files",
                    imgBlob,
                    "reviews_-_chromium_-_desktop.png"
                );
                form.append("refId", refId);
                form.append("ref", "api::webpage.webpage");
                form.append("field", "Screenshots");
                res = await fetch("http://127.0.0.1:1337/api/upload", {
                    method: "post",
                    body: form,
                }); */
            });
        })
        .catch((e) => {
            console.log(
                "Error in uploading webpages to DB:",
                JSON.stringify(e).slice(0, 250)
            );
        });
}
