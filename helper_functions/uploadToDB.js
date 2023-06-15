import fs from "fs";
import axios from "axios";
import fetch, { blobFrom } from "node-fetch";

export default async function (
    plainRootURL,
    URL,
    refID,
    job,
    GLOBAL_STEPS,
    timeAtStart
) {
    const metaObject = getNamesOfAllMatchingImages(plainRootURL, URL);

    switch (job.name) {
        case "upload--process-root-website":
            // if (isRootWebpage(URL)) uploadRootWebsiteToDB(metaObject);
            uploadRootWebsiteToDB(
                URL,
                metaObject,
                job,
                GLOBAL_STEPS,
                timeAtStart
            );
            break;
        case "update--process-root-website":
            updateRootWebsiteInDB(
                URL,
                metaObject,
                refID,
                job,
                GLOBAL_STEPS,
                timeAtStart
            );
            break;
        case "upload--process-webpages":
            uploadWebpageToDB(
                URL,
                metaObject,
                refID || getCurrentWebsiteIDlocally(),
                job,
                GLOBAL_STEPS,
                timeAtStart
            );
            break;
        case "update--process-webpages":
            updateWebpageInDB(
                URL,
                metaObject,
                refID,
                job,
                GLOBAL_STEPS,
                timeAtStart
            );
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

async function uploadRootWebsiteToDB(
    URL,
    { plainURL, parentDirFiles, pathToImagesFolder },
    job,
    GLOBAL_STEPS,
    timeAtStart
) {
    const coverImageURI = `${pathToImagesFolder}/root_-_chromium_-_desktop_-_frontpage.png`;

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
            form.append(
                "files",
                file,
                "root_-_chromium_-_desktop_-_frontpage.png"
            );
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
            Promise.all(
                await parentDirFiles.map(async (imgName) => {
                    if (imgName === "root_-_chromium_-_desktop_-_frontpage.png")
                        return;
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/png"
                    );
                    form.append("files", imgBlob, imgName);
                    form.append("refId", refID);
                    form.append("ref", "api::website.website");
                    form.append("field", "Screenshots");
                    await fetch("http://127.0.0.1:1337/api/upload", {
                        method: "post",
                        body: form,
                    }).then(async () => {
                        await job.updateProgress({
                            url: URL,
                            currentStep: ++GLOBAL_STEPS,
                        });
                    });
                })
            ).then(() => {
                console.log(
                    `It took ${
                        (Date.now() - timeAtStart) / 1000
                    } seconds to complete ${plainURL}`
                );
            });
        })
        .catch(async (e) => {
            console.log(
                "Error in uploading website to DB:",
                JSON.stringify(e).slice(0, 250)
            );
            await job.updateProgress({
                url: URL,
                error: true,
            });
        });
}

async function updateRootWebsiteInDB(
    URL,
    { plainURL, parentDirFiles, pathToImagesFolder },
    refID,
    job,
    GLOBAL_STEPS,
    timeAtStart
) {
    // const coverImageURI = `${pathToImagesFolder}/${parentDirFiles[0]}`;
    const coverImageURI = `${pathToImagesFolder}/root_-_chromium_-_desktop_-_frontpage.png`;

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
                "root_-_chromium_-_desktop_-_frontpage.png"
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
            Promise.all(
                await parentDirFiles.map(async (imgName) => {
                    if (imgName === "root_-_chromium_-_desktop_-_frontpage.png")
                        return;
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/png"
                    );
                    form.append("files", imgBlob, imgName);
                    form.append("refId", refID);
                    form.append("ref", "api::website.website");
                    form.append("field", "Screenshots");
                    await fetch("http://127.0.0.1:1337/api/upload", {
                        method: "post",
                        body: form,
                    }).then(async () => {
                        await job.updateProgress({
                            url: URL,
                            currentStep: ++GLOBAL_STEPS,
                        });
                    });
                })
            ).then(() => {
                console.log(
                    `It took ${
                        (Date.now() - timeAtStart) / 1000
                    } seconds to complete ${plainURL}`
                );
            });
        })

        .catch(async (e) => {
            console.log(
                "Error in updating website in DB:",
                JSON.stringify(e).slice(0, 250)
            );
            await job.updateProgress({
                url: URL,
                error: true,
            });
        });
}

async function uploadWebpageToDB(
    URL,
    { plainURL, parentDirFiles, pathToImagesFolder },
    WebsiteIDforReference,
    job,
    GLOBAL_STEPS,
    timeAtStart
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

            Promise.all(
                await parentDirFiles.map(async (imgName) => {
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/png"
                    );
                    form.append("files", imgBlob, imgName);
                    form.append("refId", refID);
                    form.append("ref", "api::webpage.webpage");
                    form.append("field", "Screenshots");
                    await fetch("http://127.0.0.1:1337/api/upload", {
                        method: "post",
                        body: form,
                    }).then(async () => {
                        await job.updateProgress({
                            url: URL,
                            currentStep: ++GLOBAL_STEPS,
                        });
                    });
                })
            ).then(() => {
                console.log(
                    `It took ${
                        (Date.now() - timeAtStart) / 1000
                    } seconds to complete ${plainURL}`
                );
            });
        })
        .catch(async (e) => {
            console.log(
                "Error in uploading webpages to DB:",
                JSON.stringify(e).slice(0, 250)
            );
            await job.updateProgress({
                url: URL,
                error: true,
            });
        });
}

async function updateWebpageInDB(
    URL,
    { plainURL, parentDirFiles, pathToImagesFolder },
    refID,
    job,
    GLOBAL_STEPS,
    timeAtStart
) {
    const data = {
        Screenshots: null, // clearing all old Screenshots
    };

    let res = await axios
        .put(`http://127.0.0.1:1337/api/webpages/${refID}`, {
            data,
        })
        .then(async () => {
            Promise.all(
                await parentDirFiles.map(async (imgName) => {
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/png"
                    );
                    form.append("files", imgBlob, imgName);
                    form.append("refId", refID);
                    form.append("ref", "api::webpage.webpage");
                    form.append("field", "Screenshots");
                    await fetch("http://127.0.0.1:1337/api/upload", {
                        method: "post",
                        body: form,
                    }).then(async () => {
                        await job.updateProgress({
                            url: URL,
                            currentStep: ++GLOBAL_STEPS,
                        });
                    });
                })
            ).then(() => {
                console.log(
                    `It took ${
                        (Date.now() - timeAtStart) / 1000
                    } seconds to complete ${plainURL}`
                );
            });
        })
        .catch(async (e) => {
            console.log(
                "Error in updating webpage in DB:",
                JSON.stringify(e).slice(0, 250)
            );
            await job.updateProgress({
                url: URL,
                error: true,
            });
        });
}
