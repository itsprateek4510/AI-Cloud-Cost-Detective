import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function scan(page: Page, label: string) {
  await page.waitForTimeout(700);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = result.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    blocking.map((violation) => ({
      id: violation.id,
      help: violation.help,
      nodes: violation.nodes.map((node) => node.target.join(" ")),
    })),
    `${label} should have no serious or critical accessibility violations`,
  ).toEqual([]);
}

test("the first-run journey and four destinations pass axe", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Your name", { exact: true }).fill("Asha Menon");
  await page.getByLabel("Email", { exact: true }).fill(`axe-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-good-test-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await scan(page, "onboarding step 1");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await scan(page, "onboarding step 2");
  await page.getByLabel("Family name", { exact: true }).fill("The Menon family");
  await page.getByLabel("First person’s name", { exact: true }).fill("Rohan Menon");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await scan(page, "onboarding step 3");
  await page.getByRole("button", { name: /start later/i }).click();
  await expect(page.getByRole("heading", { name: /Hey Asha,/ })).toBeVisible();

  for (const [path, label] of [
    ["/app", "home"],
    ["/app/family", "family"],
    ["/app/stories", "stories"],
    ["/app/settings", "settings"],
  ]) {
    await page.goto(path);
    await scan(page, label);
  }
});

test("the public entry points pass axe", async ({ page }) => {
  for (const [path, label] of [
    ["/", "landing"],
    ["/login", "sign in"],
    ["/docs", "guide"],
  ]) {
    await page.goto(path);
    await scan(page, label);
  }
});
