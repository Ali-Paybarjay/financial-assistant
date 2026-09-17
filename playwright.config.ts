import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "fa-IR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      // 375px is the floor the design must not break at, so that is what the
      // happy path runs against. Chromium rather than the preset's WebKit —
      // the WebKit run belongs with the MediaRecorder work in M7, where iOS
      // behaviour is the thing actually under test.
      use: { ...devices["iPhone SE"], browserName: "chromium" },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
