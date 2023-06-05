import fs from "fs";
import axios from "axios";
import fetch, { blobFrom } from "node-fetch";

export default async function (plainRootURL, URL, refID, jobName) {
    const metaObject = getNamesOfAllMatchingImages(plainRootURL, URL);

    switch (jobName) {
        case "upload--process-root-website":
            // if (isRootWebpage(URL)) uploadRootWebsiteToDB(metaObject);
            uploadRootWebsiteToDB(metaObject);
            break;
        case "update--process-root-website":
            updateRootWebsiteInDB(metaObject, refID);
            break;
        case "upload--process-webpages":
            uploadWebpagesToDB(
                metaObject,
                refID || getCurrentWebsiteIDlocally()
            );
            break;
        case "update--process-webpages":
            updateWebpagesInDB(metaObject, refID);
            break;
        default:
            console.log("Error. Unkown job name.");
    }
}

function isRootWebpage(URL) {
    return URL.slice(URL.lastIndexOf("/") + 1, URL.length) === "";
}

function getNamesOfAllMatchingImages(plainRootURL, URL) {
    // const parentDir = dir.slice(0, dir.indexOf("/"));
    const pathToImagesFolder = `app/projects/${plainRootURL}/screenshots`;
    const plainURL = URL.slice(
        URL.indexOf("//") + 2,
        isRootWebpage(URL) ? URL.length - 1 : URL.length
    );
    // const plainRootURL = plainURL.slice(0, plainURL.indexOf("/"));
    let parentDirFiles = fs.readdirSync(pathToImagesFolder);
    parentDirFiles = parentDirFiles.filter((imgName) => {
        return (
            imgName.slice(0, imgName.indexOf("_")) ===
                URL.slice(URL.lastIndexOf("/") + 1, URL.length) ||
            (isRootWebpage(URL) && imgName.includes("root"))
        );
    });

    return { plainURL, parentDirFiles, pathToImagesFolder };
}

function getCurrentWebsiteIDlocally() {
    const filePath = `app/projects/Website_CurrentID.txt`;
    let currentWebsiteID = fs.readFileSync(filePath, {
        encoding: "utf8",
    });

    return currentWebsiteID;
}

async function uploadRootWebsiteToDB({
    plainURL,
    parentDirFiles,
    pathToImagesFolder,
}) {
    const coverImageURI = `${pathToImagesFolder}/root_-_chromium_-_desktop.png`;

    let refID;

    const data = {
        Root_URL: plainURL,
        Web_Vitals_Score: "Hard-coded",
        slug: plainURL.replaceAll(".", "-"),
    };

    let res = await axios
        .post("http://127.0.0.1:1337/api/websites", {
            data,
        })
        .then(async (res) => {
            refID = res.data.data.id;

            const file = await blobFrom(coverImageURI, "image/png");

            const form = new FormData();
            form.append("files", file, "root-_chromium_-_desktop.png");
            form.append("refId", refID);
            form.append("ref", "api::website.website");
            form.append("field", "Frontpage_Screenshot");

            res = await fetch("http://127.0.0.1:1337/api/upload", {
                method: "post",
                body: form,
            });

            return refID;
        })
        .then(async (refID) => {
            await parentDirFiles.map(async (imgName) => {
                console.log("imgName", imgName);
                const form = new FormData();
                const imgBlob = await blobFrom(
                    `${pathToImagesFolder}/${imgName}`,
                    "image/png"
                );
                form.append("files", imgBlob, imgName);
                form.append("refId", refID);
                form.append("ref", "api::website.website");
                form.append("field", "Screenshots");
                res = await fetch("http://127.0.0.1:1337/api/upload", {
                    method: "post",
                    body: form,
                });
            });
        })
        .catch((e) => {
            console.log(
                "Error in uploading website to DB:",
                JSON.stringify(e).slice(0, 250)
            );
        });
}

async function updateRootWebsiteInDB(
    { parentDirFiles, pathToImagesFolder },
    refID
) {
    const coverImageURI = `${pathToImagesFolder}/${parentDirFiles[0]}`;

    const data = {
        Web_Vitals_Score: "Hard-coded-changed",
        Screenshots: null, // clearing all old Screenshots
    };

    let res = await axios
        .put(`http://127.0.0.1:1337/api/websites/${refID}`, {
            data,
        })
        .then(async (res) => {
            const file = await blobFrom(coverImageURI, "image/png");

            const form = new FormData();
            form.append(
                "files",
                file,
                "reviews_-_chromium_-_desktop_-_changed.png"
            );
            form.append("refId", refID);
            form.append("ref", "api::website.website");
            form.append("field", "Frontpage_Screenshot");

            res = await fetch("http://127.0.0.1:1337/api/upload", {
                method: "post",
                body: form,
            });
        })
        .then(async () => {
            await parentDirFiles.map(async (imgName) => {
                console.log("imgName", imgName);
                const form = new FormData();
                const imgBlob = await blobFrom(
                    `${pathToImagesFolder}/${imgName}`,
                    "image/png"
                );
                form.append("files", imgBlob, imgName);
                form.append("refId", refID);
                form.append("ref", "api::website.website");
                form.append("field", "Screenshots");
                res = await fetch("http://127.0.0.1:1337/api/upload", {
                    method: "post",
                    body: form,
                });
            });
        })
        .catch((e) => {
            console.log(
                "Error in uploading website to DB:",
                JSON.stringify(e).slice(0, 250)
            );
        });
}

async function uploadWebpagesToDB(
    { plainURL, parentDirFiles, pathToImagesFolder },
    WebsiteIDforReference
) {
    const data = {
        URL: plainURL,
        website: WebsiteIDforReference,
    };

    const res = await axios
        .post("http://127.0.0.1:1337/api/webpages", {
            data,
        })
        .then(async (res) => {
            const refID = res.data.data.id;

            await parentDirFiles.map(async (imgName) => {
                console.log("imgName", imgName);
                const form = new FormData();
                const imgBlob = await blobFrom(
                    `${pathToImagesFolder}/${imgName}`,
                    "image/png"
                );
                form.append("files", imgBlob, imgName);
                form.append("refId", refID);
                form.append("ref", "api::webpage.webpage");
                form.append("field", "Screenshots");
                res = await fetch("http://127.0.0.1:1337/api/upload", {
                    method: "post",
                    body: form,
                });
            });
        })
        .catch((e) => {
            console.log(
                "Error in uploading webpages to DB:",
                JSON.stringify(e).slice(0, 250)
            );
        });
}

async function updateWebpagesInDB(
    { parentDirFiles, pathToImagesFolder },
    refID
) {
    const data = {
        Screenshots: null, // clearing all old Screenshots
    };

    let res = await axios
        .put(`http://127.0.0.1:1337/api/webpages/${refID}`, {
            data,
        })
        .then(async () => {
            await parentDirFiles.map(async (imgName) => {
                console.log("imgName", imgName);
                const form = new FormData();
                const imgBlob = await blobFrom(
                    `${pathToImagesFolder}/${imgName}`,
                    "image/png"
                );
                form.append("files", imgBlob, imgName);
                form.append("refId", refID);
                form.append("ref", "api::webpage.webpage");
                form.append("field", "Screenshots");
                res = await fetch("http://127.0.0.1:1337/api/upload", {
                    method: "post",
                    body: form,
                });
            });
        })
        .catch((e) => {
            console.log(
                "Error in uploading website to DB:",
                JSON.stringify(e).slice(0, 250)
            );
        });
}
