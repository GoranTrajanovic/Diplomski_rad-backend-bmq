import fs from "fs";
import axios from "axios";
import fetch, { blobFrom } from "node-fetch";

export default async function (
    plainRootURL,
    URL,
    refID,
    job,
    GLOBAL_STEPS,
    timeAtStart,
    authorsIDs,
    webpageRefID = null
) {
    const metaObject = getNamesOfAllMatchingImages(plainRootURL, URL);

    // this f is needed because if website_author entity has a relation, Stripe will not
    // rewrite the existing relation and make another
    await clearWebsiteAuthorsRelations(authorsIDs);

    switch (job.name) {
        case "upload--process-root-website":
            // if (isRootWebpage(URL)) uploadRootWebsiteToDB(metaObject);
            uploadRootWebsiteToDB(
                URL,
                metaObject,
                job,
                GLOBAL_STEPS,
                timeAtStart,
                authorsIDs
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
                refID,
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
                timeAtStart,
                webpageRefID
            );
            break;
        default:
            console.log("Error. Unkown job name.");
    }
}

function isRootWebpage(URL) {
    return [...URL.matchAll(/\//g)].length === 2;
}

function getNamesOfAllMatchingImages(plainRootURL, URL) {
    // const parentDir = dir.slice(0, dir.indexOf("/"));
    const pathToImagesFolder = `app/projects/${plainRootURL}/screenshots`;
    const plainURL = URL.slice(URL.indexOf("//") + 2, URL.length);
    // const plainRootURL = plainURL.slice(0, plainURL.indexOf("/"));
    let parentDirFiles = fs.readdirSync(pathToImagesFolder);
    parentDirFiles = parentDirFiles.filter((imgName) => {
        // part before || groups all non-root images for a particular webpage
        // part after || groups all root images for the website
        return (
            imgName.slice(0, imgName.indexOf("_")) ===
                URL.slice(URL.lastIndexOf("/") + 1, URL.length) ||
            (isRootWebpage(URL) && imgName.includes("root"))
        );
    });

    return { plainURL, parentDirFiles, pathToImagesFolder };
}

async function uploadRootWebsiteToDB(
    URL,
    { plainURL, parentDirFiles, pathToImagesFolder },
    job,
    GLOBAL_STEPS,
    timeAtStart,
    authorsIDs
) {
    const coverImageURI = `${pathToImagesFolder}/root_-_chromium_-_desktop_-_frontpage.jpg`;

    let refID;

    const data = {
        Root_URL: plainURL,
        Web_Vitals_Score: "Hard-coded",
        slug: plainURL.replaceAll(".", "-"),
        website_authors: authorsIDs,
    };

    let res = await axios
        .post("http://127.0.0.1:1337/api/websites", {
            data,
        })
        .then(async (res) => {
            refID = res.data.data.id;

            const file = await blobFrom(coverImageURI, "image/jpg");

            const form = new FormData();
            form.append(
                "files",
                file,
                "root_-_chromium_-_desktop_-_frontpage.jpg"
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
                    if (imgName === "root_-_chromium_-_desktop_-_frontpage.jpg")
                        return;
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/jpg"
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
    timeAtStart,
    authorsIDs
) {
    // const coverImageURI = `${pathToImagesFolder}/${parentDirFiles[0]}`;
    const coverImageURI = `${pathToImagesFolder}/root_-_chromium_-_desktop_-_frontpage.jpg`;

    const data = {
        Web_Vitals_Score: "Hard-coded-changed",
        Screenshots: null, // clearing all old Screenshots
        website_authors: authorsIDs,
    };

    let res = await axios
        .put(`http://127.0.0.1:1337/api/websites/${refID}`, {
            data,
        })
        .then(async (res) => {
            const file = await blobFrom(coverImageURI, "image/jpg");

            const form = new FormData();
            form.append(
                "files",
                file,
                "root_-_chromium_-_desktop_-_frontpage.jpg"
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
                    if (imgName === "root_-_chromium_-_desktop_-_frontpage.jpg")
                        return;
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/jpg"
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
    timeAtStart,
    authorsIDs
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

            await updateWebsiteAuthors(authorsIDs, WebsiteIDforReference);

            Promise.all(
                await parentDirFiles.map(async (imgName) => {
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/jpg"
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
    timeAtStart,
    authorsIDs,
    webpageRefID
) {
    const data = {
        Screenshots: null, // clearing all old Screenshots
    };

    await updateWebsiteAuthors(authorsIDs, refID);

    let res = await axios
        .put(`http://127.0.0.1:1337/api/webpages/${webpageRefID}`, {
            data,
        })
        .then(async () => {
            Promise.all(
                await parentDirFiles.map(async (imgName) => {
                    const form = new FormData();
                    const imgBlob = await blobFrom(
                        `${pathToImagesFolder}/${imgName}`,
                        "image/jpg"
                    );
                    form.append("files", imgBlob, imgName);
                    form.append("webpageRefID", webpageRefID);
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

async function clearWebsiteAuthorsRelations(authorsIDs) {
    let data = { website: null };
    return Promise.all([
        authorsIDs.map(async (authorID) => {
            await axios.put(
                `http://127.0.0.1:1337/api/website_authors/${authorID}`,
                {
                    data,
                }
            );
        }),
    ]);
}

async function updateWebsiteAuthors(authorsIDs, refID) {
    const data = {
        website_authors: authorsIDs,
    };
    await axios.put(`http://127.0.0.1:1337/api/websites/${refID}`, {
        data,
    });
}
