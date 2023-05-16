const { Worker } = require("bullmq");

const workerOptions = {
    connection: {
        host: "localhost",
        port: 6379,
    },
};

const worker = new Worker(
    "foo",
    async (job) => {
        // Will print { foo: 'bar'} for the first job
        // and { qux: 'baz' } for the second.
        console.log(job.data);
    },
    workerOptions
);
