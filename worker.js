const fs = require("fs");
const { Worker } = require("bullmq");
const { chromium, firefox, webkit, devices } = require("playwright");
const prepareURL = require("./helper_functions/prepareURL");

const workerOptions = {
    connection: {
        host: "localhost",
        port: 6379,
    },
    // concurrency: 3,
};

let GLOBAL_STEPS = 0;

const workerHandler = async (job) => {
    console.log(job.data.url);
    const { dir, URLSubpath } = prepareURL(job.data.url);
    GLOBAL_STEPS = 0;

    let timeAtStart = Date.now();

    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    try {
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
            takeScreenshot(
                dir,
                job.data.url,
                URLSubpath,
                "webkit",
                "desktop",
                job
            ),
            takeScreenshot(
                dir,
                job.data.url,
                URLSubpath,
                "chromium",
                "mobile",
                job
            ),
            takeScreenshot(
                dir,
                job.data.url,
                URLSubpath,
                "webkit",
                "mobile",
                job
            ),
        ]).then(() => {
            console.log(
                `It took ${
                    (Date.now() - timeAtStart) / 1000
                } seconds to complete ${URLSubpath}`
            );
        });

        // uploadToBackend(dir, URLWithoutHttps);
    } catch (err) {
        console.log(err);
        res.status(404).json({ errorMsg: "Error occured in Express API." });
    }
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
        path: `app/screenshots/${dir}/${URLSubpath}_-_${browser}_-_${device}.png`,
        fullPage: true,
    });
    await job.updateProgress(++GLOBAL_STEPS);
}
