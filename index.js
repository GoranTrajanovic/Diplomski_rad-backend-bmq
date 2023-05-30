import { Queue, QueueEvents } from "bullmq";
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

async function addJobs(urlArray) {
    console.log(urlArray);
    urlArray.forEach(async (url) => {
        await myQueue.add("myJobName", { url });
    });
}

app.post("/take_screenshots", async (req, res) => {
    // console.log("received", req.body.urlArray);
    const URLarray = req.body.urlArray;
    await rootExistsInDBIfYesGetID(URLarray[0])
        .then(async (rootDoesntExistOrGetID) => {
            console.log("rootDoesntExistOrGetID ", rootDoesntExistOrGetID);
            if (rootIsIncludedInArray(URLarray) || rootDoesntExistOrGetID) {
                console.log("we are in yes part with ", rootDoesntExistOrGetID);
                await addJobs(URLarray, rootDoesntExistOrGetID);
                res.status(200);
            } else {
                SOCKET.emit("no_root", "no_root");
                res.status(406);
            }
        })
        .catch((e) => {
            printShort(e);
        });
});

io.on("connection", (socket) => {
    console.log("New User has connected!");
    SOCKET = socket;
});

server.listen(PORT, () =>
    console.log(`Express server running on http://localhost:${PORT}`)
);

function rootIsIncludedInArray(URLarray) {
    const resultArray = URLarray.map((URL) => {
        return URL.slice(URL.lastIndexOf("/") + 1, URL.length) === "";
    });
    return resultArray.includes(true);
}

async function rootExistsInDBIfYesGetID(URLasSample) {
    console.log("(f)rootExistsInDB called!");
    let APIcallResult;
    try {
        let res = await axios.get("http://127.0.0.1:1337/api/websites");
        const websitesFetched = res.data.data;
        for (let i = 0; i < websitesFetched.length; i++) {
            const obj = websitesFetched[i];
            if (obj.attributes.Root_URL === getRootURL(URLasSample)) {
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

// async function rootExistsInDBIfYesGetID(URLasSample) {
//     console.log("(f)rootExistsInDB called!");
//     axios
//         .get("http://127.0.0.1:1337/api/websites")
//         .then((res) => {
//             const websitesFetched = res.data.data;
//             for (let i = 0; i < websitesFetched.length; i++) {
//                 const obj = websitesFetched[i];
//                 if (obj.attributes.Root_URL === getRootURL(URLasSample))
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
