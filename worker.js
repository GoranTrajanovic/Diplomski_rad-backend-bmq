import fs from "fs";
import { Worker } from "bullmq";
import { chromium, firefox, webkit, devices } from "playwright";
import prepareURL from "./helper_functions/prepareURL.js";
import uploadToDB from "./helper_functions/uploadToDB.js";
import printShort from "./helper_functions/printShort.js";
import clearScreenshotsWorkingDir from "./helper_functions/clearScreenshotsWorkingDir.js";

const workerOptions = {
    connection: {
        host: "localhost",
        port: 6379,
    },
    // concurrency: 3,
};

let GLOBAL_STEPS = 0;

const workerHandler = async (job) => {
    const { dir, URLSubpath } = prepareURL(job.data.url);
    const IDofExistingWebsiteRoot = job.data.IDofExistingWebsiteRoot;

    console.log("Worker starting with: ", job.data.url);

    GLOBAL_STEPS = 0;

    let websiteIDreturn;

    let timeAtStart = Date.now();

    clearScreenshotsWorkingDir(dir);
    Promise.all([
        takeScreenshot(
            dir,
            job.data.url,
            URLSubpath,
            "chromium",
            "desktop",
            job
        ),
        takeScreenshot(
            dir,
            job.data.url,
            URLSubpath,
            "firefox",
            "desktop",
            job
        ),
        takeScreenshot(dir, job.data.url, URLSubpath, "webkit", "desktop", job),
        takeScreenshot(
            dir,
            job.data.url,
            URLSubpath,
            "chromium",
            "mobile",
            job
        ),
        takeScreenshot(dir, job.data.url, URLSubpath, "webkit", "mobile", job),
    ])
        .then(async () => {
            uploadToDB(dir, job.data.url, IDofExistingWebsiteRoot);
        })
        .then(() => {
            console.log(
                `It took ${
                    (Date.now() - timeAtStart) / 1000
                } seconds to complete ${URLSubpath}`
            );
        })
        .catch((e) => {
            printShort(e);
        });

    return websiteIDreturn;
};

const worker = new Worker("recordScreenshots", workerHandler, workerOptions);

worker.on("progress", (job, progress) => {
    console.log(progress);
});

async function takeScreenshot(dir, URL, URLSubpath, browser, device, job) {
    console.log(`Processing: ${URL} | ${browser} | ${device}`);
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
    let context = await browserPW.newContext(
        device === "mobile" ? devices["iPhone 11"] : null
    );
    let page = await context.newPage();
    await page.goto(URL);
    await page.screenshot({
        path: `app/projects/${dir}/screenshots/${URLSubpath}_-_${browser}_-_${device}.png`,
        fullPage: true,
    });
    await job.updateProgress({ url: URL, currentStep: ++GLOBAL_STEPS });
}
