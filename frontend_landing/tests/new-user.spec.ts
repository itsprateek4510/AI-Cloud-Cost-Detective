import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Your name", { exact: true }).fill("Nina Rao");
  await page.getByLabel("Email", { exact: true }).fill(`journey-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("a-good-test-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
}

test("a brand-new family reaches a useful home, adds a person, and finds Stories", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await signUp(page);
  await expect(page.getByRole("heading", { name: "What should Smriti call you?" })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Who’s in your story?" })).toBeVisible();
  await page.getByLabel("Family name", { exact: true }).fill("The Rao family");
  await page.getByLabel("First person’s name", { exact: true }).fill("Anaya Rao");
  await page
    .getByRole("group", { name: "First person’s relationship", exact: true })
    .getByRole("button", { name: "Sibling", exact: true })
    .click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Say hello to Smriti" })).toBeVisible();
  await page.getByRole("button", { name: /start later/i }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: /Hey Nina,/ })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your family" })).toContainText("Anaya");
  await expect(
    page.getByRole("heading", { name: "Tell Smriti one story", exact: true }),
  ).toBeVisible();

  await page.goto("/app/family?view=people");
  await expect(page.getByRole("heading", { name: "Your people" })).toBeVisible();
  await expect(page.getByText("Anaya Rao", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add a person", exact: true }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Name", { exact: true }).fill("Kabir Rao");
  await sheet.getByRole("button", { name: "Sibling", exact: true }).click();
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet.getByRole("status")).toContainText("Kabir Rao is in your family.");
  await expect(
    sheet.getByRole("link", { name: "Share connect link on WhatsApp", exact: true }),
  ).toHaveAttribute("href", /wa\.me/);
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(sheet).not.toBeVisible();

  await page.goto("/app/stories");
  await expect(page.getByRole("heading", { name: "Stories Smriti remembers" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mine", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("link", { name: "Record a story", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Record a story", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/record$/);
  await expect(page.getByRole("heading", { name: /record/i }).first()).toBeVisible();

  await page.goto("/app/settings");
  await expect(page.getByRole("heading", { name: "Settings & privacy" })).toBeVisible();
  await page.getByRole("button", { name: "हिं", exact: true }).click();
  await expect(page.getByRole("heading", { name: "सेटिंग्स और निजता" })).toBeVisible();

  for (const path of ["/app", "/app/family", "/app/stories", "/app/settings"]) {
    await page.goto(path);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflows, `${path} should not scroll sideways`).toBe(false);
  }
  expect(errors).toEqual([]);
});
