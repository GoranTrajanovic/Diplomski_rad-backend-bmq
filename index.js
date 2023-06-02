import { Job, Queue, QueueEvents } from "bullmq";
import express from "express";
import axios from "axios";
const app = express();
import http from "http";
const server = http.createServer(app);
import { Server } from "socket.io";
import printShort from "./helper_functions/printShort.js";
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
    console.log(data);
    SOCKET.emit("progress", data);
});

async function addJobs(urlArray, ID, delay) {
    // console.log("urlArray in addJobs", urlArray);
    urlArray.forEach(async (url) => {
        await myQueue.add("myJobName", { url, ID }, { delay });
    });

    /* const rootURLorFalse = isRootIncludedInArray(urlArray);

    try {
        const rootIDorFalse = await rootExistsInDBIfYesGetID(urlArray[0]);

        if (rootURLorFalse) {
            console.log("Root is there ", rootURLorFalse);
            await myQueue.add("myJobName", { url: rootURLorFalse });

            // delay needed here
            const tempArr = urlArray.filter((URL) => URL !== rootURLorFalse);
            tempArr.forEach(async (url) => {
                await myQueue.add("myJobName", { url }, { delay: 30000 });
            });
        } else if (rootIDorFalse) {
            urlArray.forEach(async (url) => {
                await myQueue.add(
                    "myJobName",
                    { url, rootIDorFalse },
                    { delay: 30000 }
                );
            });
        } else {
            SOCKET.emit("no_root", "no_root");
        }
    } catch {
        (e) => printShort(e);
    } */
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

        if (rootURLorFalse) {
            await addJobs([rootURLorFalse]);

            await addJobs(
                URLarray.filter((URL) => URL !== rootURLorFalse),
                null,
                DELAY
            );
            incrementLocalIDcounter(URLsample);
            res.status(200);
        } else if (rootIDorFalse) {
            await addJobs(URLarray, rootIDorFalse, DELAY);
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
    let APIcallResult;
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

function getRootURL(URL) {
    // NOTICE: this logic takes care only of var:URL such as: https://someurl.com/sub and not more deep subdomains
    return URL.slice(URL.indexOf("//") + 2, URL.lastIndexOf("/"));
}

function incrementLocalIDcounter(URLsample) {
    const rootURL = getRootURL(URLsample);
    const filePath = `app/projects/${rootURL}/Website_NextID.txt`;
    let nextWebsiteID = fs.readFileSync(filePath, {
        encoding: "utf8",
    });

    fs.writeFileSync(filePath, (parseInt(nextWebsiteID) + 1).toString());
}
