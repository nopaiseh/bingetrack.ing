import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1024, height: 768 } } },
  ],
  webServer: {
    command: process.env.CI
      ? "npm start -- --hostname 127.0.0.1 --port 3000"
      : "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/search",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
