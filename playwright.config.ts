import { defineConfig, devices } from "@playwright/test";

// Browser tests (`pnpm test:e2e`) against a production build: run `pnpm build` first.
// Files are `*.e2e.ts` so Vitest (`*.{test,spec}`) never picks them up.
// With `E2E_BASE_URL` set (the post-deploy smoke test against the public URL, story 6.2) no local server starts.
const PORT = 3100;
const remoteBaseURL = process.env.E2E_BASE_URL?.trim().replace(/\/+$/, "") || undefined;
const baseURL = remoteBaseURL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  outputDir: "test-results/playwright",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // The JSON report feeds the delivery proof (counts per run, acceptance coverage by test name).
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/e2e.json" }]],
  use: {
    baseURL,
    // Test traffic is flagged so usage analytics can drop it.
    extraHTTPHeaders: { "x-atlas-traffic": "synthetic" },
    trace: "retain-on-failure",
    // In CI, a viewport-sized screenshot at the end of every browser test: the reviewer's evidence (story 6.2).
    screenshot: process.env.CI ? "on" : "only-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: remoteBaseURL
    ? undefined
    : {
        command: `pnpm start --port ${PORT}`,
        url: `${baseURL}/version`,
        reuseExistingServer: false,
        timeout: 60_000,
      },
});
