import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the open-source test stack (local Supabase, mock gateway)
 * and a running website. Start everything with `npm run oss:start` and `npm run web`
 * (or `next start`), then `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
