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
};

let GLOBAL_STEPS = 0;

let URLmetaObject;

const workerHandler = async (job) => {
    const devicesAndBrowsers = [
        { browser: "chromium", device: "desktop" },
        { browser: "firefox", device: "desktop" },
        { browser: "webkit", device: "desktop" },
        { browser: "chromium", device: "mobile" },
        { browser: "webkit", device: "mobile" },
    ];

    GLOBAL_STEPS = 0;

    let timeAtStart = Date.now();

    switch (job.name) {
        case "upload--process-root-website":
        // await incrementLocalIDcounter();
        case "update--process-root-website":
            if (!job.data.url) return; // because there is a scenario where root-website is in db but we didnt select it for updating
            URLmetaObject = prepareURL(job.data.url);
            await processURL(
                devicesAndBrowsers,
                URLmetaObject,
                job.data.url,
                job,
                job.data.refRootWebsiteID,
                timeAtStart,
                job.data.authorsIDs
            ).catch((e) => {
                printShort(e);
            });
            break;
        case "upload--process-webpages":
        case "update--process-webpages":
            URLmetaObject = prepareURL(job.data.url);
            await processURL(
                devicesAndBrowsers,
                URLmetaObject,
                job.data.url,
                job,
                job.data.refRootWebsiteID,
                timeAtStart,
                job.data.authorsIDs,
                job.data.webpageRefID
            ).catch((e) => {
                printShort(e);
            });
            break;
        default:
            console.log("Error. Unkown job name.");
    }
    return "Finished";
};

const worker = new Worker(
    "processWebsiteAndWebpages",
    workerHandler,
    workerOptions
);

worker.on("progress", (job, progress) => {
    console.log(progress);
});

async function processURL(
    devicesAndBrowsers,
    URLmetaObject,
    url,
    job,
    refID,
    timeAtStart,
    authorsIDs,
    webpageRefID
) {
    return Promise.all(
        devicesAndBrowsers.map((obj) => {
            return takeScreenshot(obj.browser, obj.device, URLmetaObject, url);
        })
    )
        .then(async () => {
            await uploadToDB(
                URLmetaObject.plainRootURL,
                url,
                refID,
                job,
                GLOBAL_STEPS,
                timeAtStart,
                authorsIDs,
                webpageRefID
            );
        })
        .catch(async (e) => {
            console.log("Error in worker.js processing.");
            printShort(e);
            await job.updateProgress({
                url,
                error: true,
            });
        });
}

async function takeScreenshot(
    browser,
    device,
    { plainRootURL, URLSubpath },
    url
) {
    console.log(`~~~~~~~~~~~Processing: ${url} | ${browser} | ${device}`);
    let browserPW = await (browser === "chromium"
        ? chromium
        : browser === "firefox"
        ? firefox
        : browser === "webkit"
        ? webkit
        : null
    ).launch();
    // let browserPW = await chromium.launch();
    // let context = await browserPW.newContext();

    if (
        URLSubpath === "root" &&
        browser === "chromium" &&
        device === "desktop"
    ) {
        let context = await browserPW.newContext(
            device === "mobile" ? devices["iPhone 11"] : null
        );
        let page = await context.newPage();
        await page.goto(url);
        await page.screenshot({
            path: `app/projects/${plainRootURL}/screenshots/${URLSubpath}_-_${browser}_-_${device}_-_frontpage.jpg`,
            fullPage: false,
            type: "jpeg",
        });
    }

    let context = await browserPW.newContext(
        device === "mobile" ? devices["iPhone 11"] : null
    );
    let page = await context.newPage();
    await page.goto(url);
    await page.screenshot({
        path: `app/projects/${plainRootURL}/screenshots/${URLSubpath}_-_${browser}_-_${device}.jpg`,
        fullPage: true,
        type: "jpeg",
    });
}
