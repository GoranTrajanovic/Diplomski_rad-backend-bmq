const { defineConfig } = require("@playwright/test");

export default defineConfig({
    timeout: 3 * 60 * 1000,
    fullyParallel: true,
});
