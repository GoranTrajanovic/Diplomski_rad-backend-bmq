import fs from "fs";
import { Worker } from "bullmq";
import { chromium, firefox, webkit, devices } from "playwright";
import prepareURL from "./helper_functions/prepareURL.js";
import uploadToDB from "./helper_functions/uploadToDB.js";
import printShort from "./helper_functions/printShort.js";

const workerOptions = {
    connection: {
        host: "localhost",
        port: 6379,
    },
    // concurrency: 3,
};

let GLOBAL_STEPS = 0;

const workerHandler = async (job) => {
    /* let counter = 0;
    const intervalRef = setInterval(() => {
        counter++;
        console.log("~~~~~~~~~~~~~~~~~~~");
        console.log("Work in progress...");
        console.log("name: ", job.name);
        console.log("data: ", job.data);
        console.log("~~~~~~~~~~~~~~~~~~~");
        if (counter === 5) clearInterval(intervalRef);
    }, 8000); */
};

const workerParallel = new Worker(
    "processWebpagesInParallel",
    workerHandler,
    workerOptions
);

/* worker_test.on("progress", (job, progress) => {
    console.log(progress);
}); */
