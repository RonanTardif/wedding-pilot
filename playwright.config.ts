import { defineConfig, devices } from "@playwright/test";

// Browser tests (`pnpm test:e2e`) against a production build: run `pnpm build` first.
// Files are `*.e2e.ts` so Vitest (`*.{test,spec}`) never picks them up.
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "test-results/playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    // Test traffic is flagged so usage analytics can drop it.
    extraHTTPHeaders: { "x-atlas-traffic": "synthetic" },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `pnpm start --port ${PORT}`,
    url: `${baseURL}/version`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
