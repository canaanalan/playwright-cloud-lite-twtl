import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3017";
const shouldStartLocalServer =
  baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

export default defineConfig({
  testDir: "./tests",
  testIgnore: process.env.INCLUDE_FAILURE_TESTS
    ? []
    : ["**/*.failure.spec.ts"],
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  webServer: shouldStartLocalServer
    ? {
        command: "npm run dev -- --port 3017",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: baseURL,
      }
    : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
