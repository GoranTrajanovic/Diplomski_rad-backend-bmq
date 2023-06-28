import { Queue, QueueEvents } from "bullmq";
import express from "express";
import axios from "axios";
const app = express();
import http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import printShort from "./helper_functions/printShort.js";
import getRootURL from "./helper_functions/getRootURL.js";
import clearScreenshotsWorkingDir from "./helper_functions/clearScreenshotsWorkingDir.js";

const io = new Server(server);
let SOCKET;
const PORT = 8888;

let URLS_IN_PROCESSING = [];

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
    if (data.error) {
        SOCKET.emit("error_in_processing", data);
        URLS_IN_PROCESSING = [
            ...URLS_IN_PROCESSING.filter((url) => url !== data.url),
        ];
    } else SOCKET.emit("progress", data);

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

async function addSimultaneousJobs(
    webpagesURLsForUpload,
    webpagesURLsForUpdate,
    refRootWebsiteID,
    rootWebsiteURL
) {
    webpagesURLsForUpload.forEach(async (url) => {
        await myQueue.add("upload--process-webpages", {
            url,
            refRootWebsiteID,
        });
    });

    webpagesURLsForUpdate.forEach(async ({ url, webpageRefID }) => {
        await myQueue.add("update--process-webpages", {
            url,
            webpageRefID,
        });
    });
    await myQueue.add("update--process-root-website", {
        url: rootWebsiteURL,
        refRootWebsiteID,
    });
}

app.post("/take_screenshots", async (req, res) => {
    // let URLarray = req.body.urlArray;
    let URLarray = checkIdempotence(req.body.urlArray);

    if (URLarray.length) clearScreenshotsWorkingDir(getRootURL(URLarray[0]));
    else return;

    const rootURLorFalse = isRootIncludedInArray(URLarray);
    const URLsample = URLarray[0];

    try {
        let rootIDorFalse = await rootExistsInDBIfYesGetID(URLsample);
        const URLarrayWithoutRoot = URLarray.filter(
            (URL) => URL !== rootURLorFalse
        );
        const webpagesURLsSeparated = await separateWebpagesIfExistInDB(
            URLarrayWithoutRoot
        );

        console.log("webpagesURLsSeparated", webpagesURLsSeparated);

        setInterval(() => {
            if (URLS_IN_PROCESSING.length)
                console.log(
                    ">>>>>>>>>>>URLs in processing: ",
                    URLS_IN_PROCESSING
                );
        }, 5000);

        if (rootIDorFalse) {
            await addSimultaneousJobs(
                webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload,
                webpagesURLsSeparated.URLsAndRefsForWebpagesToUpdate,
                rootIDorFalse,
                rootURLorFalse
            );
            res.status(200);
        } else if (rootURLorFalse) {
            await myQueue.add("upload--process-root-website", {
                url: rootURLorFalse,
            });

            const ITERATIONS_POSSIBLE = 10;
            const INTERVAL_DURATION = 3000;
            let counter = 0;
            const limitedInterval = setInterval(async () => {
                // console.log("Step %d in trying to fetch ID.", counter);
                rootIDorFalse = await rootExistsInDBIfYesGetID(
                    webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload[0]
                );
                if (counter >= ITERATIONS_POSSIBLE || rootIDorFalse) {
                    if (rootIDorFalse) {
                        webpagesURLsSeparated.URLsAndRefsForWebpagesToUpload.forEach(
                            async (url) => {
                                await myQueue.add("upload--process-webpages", {
                                    url,
                                    refRootWebsiteID: rootIDorFalse,
                                });
                            }
                        );
                    } else {
                        // send error to all awaiting URLs
                    }
                    clearInterval(limitedInterval);
                }
                counter++;
            }, INTERVAL_DURATION);
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
                        // the below filtering is fishy,
                        //it reinitializes URLarray over and over again
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
