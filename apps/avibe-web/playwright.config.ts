import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://localhost:3217",
    browserName: "chromium",
    launchOptions: { channel: "chrome" },
    trace: "retain-on-failure",
  },
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: "list",
});
