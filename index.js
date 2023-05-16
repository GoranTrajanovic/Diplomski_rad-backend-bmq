const { Queue } = require("bullmq");
const express = require("express");
const app = express();
const PORT = 8888;
app.use(express.json());

const myQueue = new Queue("foo", {
    connection: {
        host: "localhost",
        port: 6379,
    },
});

async function addJobs() {
    await myQueue.add("myJobName", { foo: "bar" });
    await myQueue.add("myJobName", { qux: "baz" });
}

app.get("/haya", async (req, res) => {
    await addJobs();
    res.send(200);
});

app.listen(PORT, () =>
    console.log(`Express server running on http://localhost:${PORT}`)
);
