import { Job, Queue, QueueEvents, FlowProducer } from "bullmq";
import express from "express";
import axios from "axios";
const app = express();
import http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import printShort from "./helper_functions/printShort.js";
import getRootURL from "./helper_functions/getRootURL.js";
import clearScreenshotsWorkingDir from "./helper_functions/clearScreenshotsWorkingDir.js";
import { FragmentsOnCompositeTypesRule } from "graphql";
const io = new Server(server);
let SOCKET;
const PORT = 8888;

let URLS_IN_PROCESSING = [];
let NUM_OF_URLS_PROCESSED = 0;

app.use(express.json());

const myQueue = new Queue("processWebsiteAndWebpages", {
    connection: {
        host: "localhost",
        port: 6379,
    },
});

const queueEvents = new QueueEvents("processWebsiteAndWebpages", {
    connection: {
        host: "localhost",
        port: 6379,
    },
});

queueEvents.on("progress", ({ jobId, data }) => {
    SOCKET.emit("progress", data);

    if (data.currentStep === 5)
        URLS_IN_PROCESSING = [
            ...URLS_IN_PROCESSING.filter((url) => url !== data.url),
        ];
});

/* async function addJobs(URLarrayWithoutRoot, refRootWebsiteID) {
    // console.log("urlArray in addJobs", urlArray);
    await myQueue.add("process-all-webpages", {
        URLarrayWithoutRoot,
        refRootWebsiteID,
    });
} */

app.post("/take_screenshots", async (req, res) => {
    // let URLarray = req.body.urlArray;
    let URLarray = checkIdempotence(req.body.urlArray);

    if (URLarray.length) clearScreenshotsWorkingDir(getRootURL(URLarray[0]));
    else return;

    const rootURLorFalse = isRootIncludedInArray(URLarray);
    const URLsample = URLarray[0];
    // if (NUM_OF_URLS_PROCESSED === 0) NUM_OF_URLS_PROCESSED = URLarray.length;

    try {
        const rootIDorFalse = await rootExistsInDBIfYesGetID(URLsample);
        const URLarrayWithoutRoot = URLarray.filter(
            (URL) => URL !== rootURLorFalse
        );
        const webpagesURLsSeparated = await separateWebpagesIfExistInDB(
            URLarrayWithoutRoot
        );

        console.log("webpagesURLsSeparated", webpagesURLsSeparated);

        setInterval(() => {
            if (URLS_IN_PROCESSING.length)
                console.log("URLs in processing: ", URLS_IN_PROCESSING);
        }, 3000);

        if (rootIDorFalse) {
            await new FlowProducer().add({
                name: "update--process-webpages",
                queueName: "processWebsiteAndWebpages",
                data: {
                    URLarray:
                        webpagesURLsSeparated.URLsAndRefsForWebpagesToUpdate,
                },
                children: [
                    {
                        name: "upload--process-webpages",
                        queueName: "processWebsiteAndWebpages",
                        data: {
                            URLarray:
                                webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload,
                        },
                        children: [
                            {
                                name: "update--process-root-website",
                                queueName: "processWebsiteAndWebpages",
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
                queueName: "processWebsiteAndWebpages",
                data: {
                    URLarray:
                        webpagesURLsSeparated.URLsAndRefsForWebpagesToUpdate,
                },
                children: [
                    {
                        name: "upload--process-webpages",
                        queueName: "processWebsiteAndWebpages",
                        data: {
                            URLarray:
                                webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload,
                        },
                        children: [
                            {
                                name: "upload--process-root-website",
                                queueName: "processWebsiteAndWebpages",
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
}

async function separateWebpagesIfExistInDB(URLarray) {
    let URLsAndRefsForWebpagesToUpdate = [];
    let URLsAndRefsForWebpagesToUpload = [];
    await axios
        .get("http://127.0.0.1:1337/api/webpages")
        .then(async (res) => {
            const webpagesFetchedResponse = await res.data.data;
            if (webpagesFetchedResponse.length !== 0) {
                const webpagesFetched = webpagesFetchedResponse.map((obj) => {
                    return {
                        url: `https://${obj.attributes.URL}`,
                        webpageRefID: obj.id,
                    };
                });

                webpagesFetched.map((webpageFetched) => {
                    if (URLarray.includes(webpageFetched.url)) {
                        URLsAndRefsForWebpagesToUpdate.push(webpageFetched);
                        URLarray = URLarray.filter(
                            (url) => url !== webpageFetched.url
                        );
                    }
                });
                URLsAndRefsForWebpagesToUpload = [...URLarray];
            } else {
                URLsAndRefsForWebpagesToUpload = [...URLarray];
            }
        })
        .catch((e) => {
            printShort(e);
        });

    return { URLsAndRefsForWebpagesToUpdate, URLsAndRefsForWebpagesToUpload };
}

function checkIdempotence(URLarray) {
    let tempURLarray = [];
    if (URLS_IN_PROCESSING.length === 0) {
        URLS_IN_PROCESSING = [...URLarray];
        return [...URLarray];
    } else {
        tempURLarray = [
            ...URLarray.filter((url) => !URLS_IN_PROCESSING.includes(url)),
        ];
        URLS_IN_PROCESSING = [...URLS_IN_PROCESSING, ...tempURLarray];
        return [...tempURLarray];
    }
}
