import { defineConfig, devices } from "@playwright/test";

// Locally the suite drives installed Google Chrome; CI uses Playwright's
// bundled Chromium so no external browser install is required.
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 40_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: "http://localhost:3100",
    channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", channel },
    },
  ],
  webServer: {
    command: "npm run start -- --port 3100",
    url: "http://localhost:3100",
    // Always test the current production build, never a stale server whose
    // in-memory manifest points at chunks replaced by a later build.
    reuseExistingServer: false,
  },
});
