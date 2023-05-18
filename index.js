const { Queue } = require("bullmq");
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const PORT = 8888;

app.use(express.json());

const myQueue = new Queue("recordScreenshots", {
    connection: {
        host: "localhost",
        port: 6379,
    },
});

async function addJobs(urlArray) {
    console.log(urlArray);
    urlArray.forEach(async (url) => {
        await myQueue.add("myJobName", { url });
    });
}

app.post("/take_screenshots", async (req, res) => {
    // console.log("received", req.body.urlArray);
    await addJobs(req.body.urlArray);
    res.status(200);
});

io.on("connection", (socket) => {
    console.log("New User has connected!");
});

server.listen(PORT, () =>
    console.log(`Express server running on http://localhost:${PORT}`)
);
