import { Job, Queue, QueueEvents, FlowProducer } from "bullmq";
import express from "express";
import axios from "axios";
const app = express();
import http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import printShort from "./helper_functions/printShort.js";
import getRootURL from "./helper_functions/getRootURL.js";
import { FragmentsOnCompositeTypesRule } from "graphql";
const io = new Server(server);
let SOCKET;
const PORT = 8888;

app.use(express.json());

const myQueue = new Queue("recordScreenshots", {
    connection: {
        host: "localhost",
        port: 6379,
    },
});

const queueEvents = new QueueEvents("recordScreenshots", {
    connection: {
        host: "localhost",
        port: 6379,
    },
});

queueEvents.on("progress", ({ jobId, data }) => {
    SOCKET.emit("progress", data);
});

/* async function addJobs(URLarrayWithoutRoot, refRootWebsiteID) {
    // console.log("urlArray in addJobs", urlArray);
    await myQueue.add("process-all-webpages", {
        URLarrayWithoutRoot,
        refRootWebsiteID,
    });
} */

app.post("/take_screenshots", async (req, res) => {
    // console.log("received", req.body.urlArray);

    const URLarray = req.body.urlArray;
    const rootURLorFalse = isRootIncludedInArray(URLarray);
    const URLsample = URLarray[0];

    try {
        const rootIDorFalse = await rootExistsInDBIfYesGetID(URLsample);
        const URLarrayWithoutRoot = URLarray.filter(
            (URL) => URL !== rootURLorFalse
        );
        const webpagesURLsSeparated = await separateWebpagesIfExistInDB(
            URLarrayWithoutRoot
        );

        console.log(webpagesURLsSeparated);

        if (rootIDorFalse) {
            await new FlowProducer().add({
                name: "update--process-webpages",
                queueName: "recordScreenshots",
                data: {
                    URLarray:
                        webpagesURLsSeparated.URLsAndRefsForWebpagesToUpdate,
                },
                children: [
                    {
                        name: "upload--process-webpages",
                        queueName: "recordScreenshots",
                        data: {
                            URLarray:
                                webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload,
                            refRootWebsiteID: rootIDorFalse,
                        },
                        children: [
                            {
                                name: "update--process-root-website",
                                queueName: "recordScreenshots",
                                data: {
                                    url: rootURLorFalse,
                                    refRootWebsiteID: rootIDorFalse,
                                },
                            },
                        ],
                    },
                ],
            });
            res.status(200);
        } else if (rootURLorFalse) {
            await new FlowProducer().add({
                name: "update--process-webpages",
                queueName: "recordScreenshots",
                data: {
                    URLarray:
                        webpagesURLsSeparated.URLsAndRefsForWebpagesToUpdate,
                },
                children: [
                    {
                        name: "upload--process-webpages",
                        queueName: "recordScreenshots",
                        data: {
                            URLarray:
                                webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload,
                        },
                        children: [
                            {
                                name: "upload--process-root-website",
                                queueName: "recordScreenshots",
                                data: { url: rootURLorFalse },
                            },
                        ],
                    },
                ],
            });
            res.status(200);
        } else {
            SOCKET.emit("no_root", "no_root");
            res.status(406);
        }
    } catch {
        (e) => printShort(e);
    }
});

io.on("connection", (socket) => {
    console.log("New User has connected!");
    SOCKET = socket;
});

server.listen(PORT, () =>
    console.log(`Express server running on http://localhost:${PORT}`)
);

function isRootIncludedInArray(URLarray) {
    const resultArray = URLarray.map((URL) => {
        return URL.slice(URL.lastIndexOf("/") + 1, URL.length) === "";
    });
    const rootURL = URLarray[resultArray.indexOf(true)];
    if (resultArray.includes(true)) return rootURL;
    else return false;
}

async function rootExistsInDBIfYesGetID(URLsample) {
    try {
        let res = await axios.get("http://127.0.0.1:1337/api/websites");
        const websitesFetched = res.data.data;
        for (let i = 0; i < websitesFetched.length; i++) {
            const obj = websitesFetched[i];
            if (obj.attributes.Root_URL === getRootURL(URLsample)) {
                return obj.id;
            }
        }
        return false;
    } catch (e) {
        printShort(e);
    }

    /* const res = axios.get(process.env.STRAPI_URL_WEBSITES);
    console.log(res); */
}

async function separateWebpagesIfExistInDB(URLarray) {
    let URLsAndRefsForWebpagesToUpdate = [];
    let URLsAndRefsForWebpagesToUpload = [];
    await axios
        .get("http://127.0.0.1:1337/api/webpages")
        .then(async (res) => {
            const webpagesFetchedResponse = await res.data.data;
            if (webpagesFetchedResponse.length !== 0) {
                console.log("Something is still there");
                const webpagesFetched = webpagesFetchedResponse.map((obj) => {
                    return { url: obj.attributes.URL, webpageRefID: obj.id };
                });
                URLsAndRefsForWebpagesToUpload = URLarray.filter((url) => {
                    for (let i = 0; i < webpagesFetched.length; i++) {
                        const webpageFetched = webpagesFetched[i];
                        if (webpageFetched.url === url) {
                            URLsAndRefsForWebpagesToUpdate.push(webpageFetched);
                            return false;
                        } else return true;
                    }
                });
            } else {
                URLsAndRefsForWebpagesToUpload = URLarray;
            }
        })
        .catch((e) => {
            printShort(e);
        });

    return { URLsAndRefsForWebpagesToUpdate, URLsAndRefsForWebpagesToUpload };
}

// async function rootExistsInDBIfYesGetID(URLsample) {
//     console.log("(f)rootExistsInDB called!");
//     axios
//         .get("http://127.0.0.1:1337/api/websites")
//         .then((res) => {
//             const websitesFetched = res.data.data;
//             for (let i = 0; i < websitesFetched.length; i++) {
//                 const obj = websitesFetched[i];
//                 if (obj.attributes.Root_URL === getRootURL(URLsample))
//                     return obj.id;
//             }
//             return false;
//         })
//         .catch((e) => {
//             printShort(e);
//         });
//     /* const res = axios.get(process.env.STRAPI_URL_WEBSITES);
//     console.log(res); */
// }
