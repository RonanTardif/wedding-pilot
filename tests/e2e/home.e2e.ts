import { expect, test } from "@playwright/test";

test.describe("home page", () => {
  // @smoke: also replayed against the public URL after each deployment; read-only (no form, no write).
  test("renders the header, the programme with its next step and the venues", { tag: "@smoke" }, async ({ page }, testInfo) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const programme = page.getByRole("region", { name: "Programme du jour" });
    await expect(programme).toBeVisible();
    await expect(programme.getByRole("listitem").first()).toBeVisible();
    // The highlighted step comes from the server's clock: at most one (none once the day is over), with a badge.
    const highlighted = programme.locator('li[aria-current="step"]');
    expect(await highlighted.count()).toBeLessThanOrEqual(1);
    if ((await highlighted.count()) === 1) await expect(highlighted.locator(".badge")).toHaveText(/\S/);

    const venues = page.getByRole("region", { name: "Lieux" });
    await expect(venues).toBeVisible();
    await expect(venues.getByRole("link", { name: /^Itinéraire vers / }).first()).toBeVisible();
    await expect(page.getByText("momentanément indisponible")).toHaveCount(0);

    await page.screenshot({ path: `test-results/playwright/shots/home-${testInfo.project.name}.png`, fullPage: true });
  });

  test("AC1: shows a hook and at least 3 marketing arguments for future brides", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/");
    const pitch = page.getByRole("region", { name: "Votre plus beau jour, sans le stress" });
    await expect(pitch).toBeVisible();
    expect(await pitch.getByRole("listitem").count()).toBeGreaterThanOrEqual(3);
    await expect(pitch.getByRole("link", { name: "Découvrir le quizz des mariés" })).toBeVisible();
  });

  for (const theme of ["noel", "halloween", "standard"]) {
    test(`AC2: pitch is readable and not overflowing with theme ${theme}`, async ({ page, context, baseURL }, testInfo) => {
      await context.addCookies([{ name: "theme", value: theme, url: baseURL ?? "http://localhost:3100" }]);
      await page.goto("/");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const pitch = page.getByRole("region", { name: "Votre plus beau jour, sans le stress" });
      await expect(pitch).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow).toBe(false);
      await pitch.screenshot({ path: `test-results/playwright/shots/home-pitch-${theme}-${testInfo.project.name}.png` });
    });
  }

  test("AC3: the pitch can be captured as an Instagram-ready screenshot", async ({ page }, testInfo) => {
    await page.goto("/");
    const pitch = page.getByRole("region", { name: "Votre plus beau jour, sans le stress" });
    await expect(pitch).toBeVisible();
    const box = await pitch.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    await pitch.screenshot({ path: `test-results/playwright/shots/home-capture-${testInfo.project.name}.png` });
  });

  test("/version answers JSON with a sha", { tag: "@smoke" }, async ({ request }) => {
    const response = await request.get("/version");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toEqual({ sha: expect.stringMatching(/\S/) });
  });
});
