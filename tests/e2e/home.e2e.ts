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

  test("/version answers JSON with a sha", { tag: "@smoke" }, async ({ request }) => {
    const response = await request.get("/version");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");
    const body: unknown = await response.json();
    expect(body).toEqual({ sha: expect.stringMatching(/\S/) });
  });
});
