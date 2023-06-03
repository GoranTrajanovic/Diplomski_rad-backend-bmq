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
        case "process-root-website":
            const URLmetaObject = prepareURL(job.data.url);
            await incrementLocalIDcounter();
            await processURL(
                devicesAndBrowsers,
                URLmetaObject,
                job.data.url,
                job
            )
                .then(() => {
                    console.log(
                        `It took ${
                            (Date.now() - timeAtStart) / 1000
                        } seconds to complete ${URLmetaObject.URLSubpath}`
                    );
                })
                .catch((e) => {
                    printShort(e);
                });
            break;
        case "process-all-webpages":
            job.data.URLarrayWithoutRoot.map(async (url) => {
                const URLmetaObject = prepareURL(url);
                await processURL(devicesAndBrowsers, URLmetaObject, url, job)
                    .then(() => {
                        console.log(
                            `It took ${
                                (Date.now() - timeAtStart) / 1000
                            } seconds to complete ${URLmetaObject.URLSubpath}`
                        );
                    })
                    .catch((e) => {
                        printShort(e);
                    });
            });
            break;
        case "update-root-website":
            break;
        default:
            console.log("Error. Unkown job name.");
    }
    return "Finished";
};

const worker = new Worker("recordScreenshots", workerHandler, workerOptions);

worker.on("progress", (job, progress) => {
    console.log(progress);
});

async function processURL(devicesAndBrowsers, URLmetaObject, url, job) {
    return Promise.all(
        devicesAndBrowsers.map((obj) => {
            return takeScreenshot(
                obj.browser,
                obj.device,
                URLmetaObject,
                url,
                job
            );
        })
    ).then(async () => {
        uploadToDB(URLmetaObject.plainRootURL, url, job.data.rootWebsiteID);
    });
}

async function takeScreenshot(
    browser,
    device,
    { plainRootURL, URLSubpath },
    url,
    job
) {
    console.log(`Processing: ${url} | ${browser} | ${device}`);
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
    await page.goto(url);
    await page.screenshot({
        path: `app/projects/${plainRootURL}/screenshots/${URLSubpath}_-_${browser}_-_${device}.png`,
        fullPage: true,
    });
    await job.updateProgress({ url, currentStep: ++GLOBAL_STEPS });
}

async function incrementLocalIDcounter() {
    const filePath = `app/projects/Website_CurrentID.txt`;
    let nextWebsiteID = fs.readFileSync(filePath, {
        encoding: "utf8",
    });

    fs.writeFileSync(filePath, (parseInt(nextWebsiteID) + 1).toString());
}
