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

async function addJobs(URLarrayWithoutRoot, refRootWebsiteID) {
    // console.log("urlArray in addJobs", urlArray);
    await myQueue.add("process-all-webpages", {
        URLarrayWithoutRoot,
        refRootWebsiteID,
    });
}

app.post("/take_screenshots", async (req, res) => {
    // console.log("received", req.body.urlArray);

    const URLarray = req.body.urlArray;
    const rootURLorFalse = isRootIncludedInArray(URLarray);
    const DELAY_SECONDS = 30;
    const DELAY = 1000 * DELAY_SECONDS;
    const URLsample = URLarray[0];

    try {
        const rootIDorFalse = await rootExistsInDBIfYesGetID(URLsample);
        const URLarrayWithoutRoot = URLarray.filter(
            (URL) => URL !== rootURLorFalse
        );

        if (rootIDorFalse) {
            await new FlowProducer().add({
                name: "process-all-webpages",
                queueName: "recordScreenshots",
                data: { URLarrayWithoutRoot, refRootWebsiteID: rootIDorFalse },
                children: [
                    {
                        name: "update-root-website",
                        queueName: "recordScreenshots",
                        data: {
                            url: rootURLorFalse,
                            refRootWebsiteID: rootIDorFalse,
                        },
                    },
                ],
            });
            res.status(200);
        } else if (rootURLorFalse) {
            await new FlowProducer().add({
                name: "process-all-webpages",
                queueName: "recordScreenshots",
                data: { URLarrayWithoutRoot },
                children: [
                    {
                        name: "process-root-website",
                        queueName: "recordScreenshots",
                        data: { url: rootURLorFalse },
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
