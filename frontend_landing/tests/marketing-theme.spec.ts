import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("marketing actions follow the existing hero palette", async ({ page }) => {
  await page.goto("/");
  const primary = await page
    .locator(".hero .button")
    .first()
    .evaluate((button) => getComputedStyle(button).backgroundImage);
  for (const button of await page
    .locator(".use-case .button-primary, .price-card.featured .button")
    .all()) {
    await expect(button).toHaveCSS("background-image", primary);
  }
  await expect(page.locator(".faq-list summary svg").first()).toHaveCSS(
    "color",
    "rgb(48, 105, 167)",
  );
  for (const icon of await page.locator(".trust-items svg").all()) {
    await expect(icon).toHaveCSS("stroke", "rgb(48, 105, 167)");
  }
});

test("marketing cards share borders, corners and sample surfaces", async ({ page }) => {
  await page.goto("/");
  for (const selector of [
    ".sample-card",
    ".use-case",
    ".price-card:not(.featured)",
    ".faq-list details",
  ]) {
    await expect(page.locator(selector).first()).toHaveCSS("border-radius", "14px");
    await expect(page.locator(selector).first()).toHaveCSS(
      "border-top-color",
      "rgb(220, 225, 231)",
    );
  }
  const surfaces = await page
    .locator(".sample-card")
    .evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundImage));
  expect(new Set(surfaces).size).toBe(1);
  const darkSurface = await page
    .locator("#closing-heading")
    .evaluate((heading) => getComputedStyle(heading.closest("section")!).backgroundColor);
  await expect(page.locator(".promise-section")).toHaveCSS("background-color", darkSurface);
});

test("headings and shared pages use the same theme without changing the hero", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hero h1")).toHaveCSS("-webkit-text-fill-color", "rgb(23, 43, 60)");
  await expect(page.locator(".hero .changing-line")).toHaveCSS(
    "font-family",
    'Georgia, "Times New Roman", serif',
  );
  for (const path of ["/", "/pricing", "/faq", "/about"]) {
    await page.goto(path);
    const heading = page
      .locator(".price-card h3, .faq-list summary, .principle-card h3, .sample-card h3")
      .first();
    await expect(heading).toHaveCSS("color", "rgb(23, 43, 60)");
    await expect(heading).toHaveCSS("background-image", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
