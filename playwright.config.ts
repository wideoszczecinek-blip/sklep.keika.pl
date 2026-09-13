import { defineConfig, devices } from "@playwright/test";

// Smoke test runner (P3 of the 2026-09-13 audit). Runs against production
// by default; point SMOKE_BASE_URL at a local `next start` to check a build
// before pushing:
//   SMOKE_BASE_URL=http://localhost:3010 npm run smoke
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_BASE_URL || "https://sklep.keika.pl",
    locale: "pl-PL",
    timezoneId: "Europe/Warsaw",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
