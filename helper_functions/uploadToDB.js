import fs from "fs";
import axios from "axios";
// const path = require("path");
// const mime = require("mime-types");
// const axios = require("axios");
// const { FormData } = require("formdata-node");
import fetch, { blobFrom } from "node-fetch";
// const { blobFrom } = require("fetch-blob/from");

const endpoint = "http://127.0.0.1:1337/api";

export default async function (dir, URL) {
    const parentDir = dir.slice(0, dir.indexOf("/"));
    const fullPathParentDir = "app/screenshots/" + parentDir;
    const parentDirFolders = fs.readdirSync(fullPathParentDir);
    const parentDirFoldersContent = fs.readdirSync(
        `${fullPathParentDir}/${parentDirFolders[0]}`
    );
    const coverImageURI = `${fullPathParentDir}/${parentDirFolders[0]}/${parentDirFoldersContent[0]}`;

    const data = {
        Root_URL: parentDir,
        Web_Vitals_Score: "Hard-coded",
        slug: parentDir.replaceAll(".", "-"),
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
                /* headers: {
                    "Content-type": "multipart/form-data",
                }, */
            });

            console.log("data from image upload:", res);
        })
        .catch((e) => {
            console.log("Error in uploading to DB:", e);
        });

    /* 
        const name = path.basename(tempImageUri);
        // read contents of file
        const buffer = await fs.statSync(tempImageUri); */

    /* const res = await axios.post("http://127.0.0.1:1337/api/upload", {
            data: {},
            files: {
                path: tempImageUri,
                name,
                type: mime.lookup(tempImageUri),
                size: buffer.size,
            },
        }); */
    // return { props: { data } };
}

async function uploadRootWebsite(dir) {}
