import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  const signup = await page.request.post("/api/auth/signup", {
    data: {
      name: "Legacy Assistant Tester",
      email: `assistant-${crypto.randomUUID()}@example.com`,
      password: "a-good-test-password",
    },
  });
  expect(signup.status()).toBe(201);
  expect(
    (await page.request.patch("/v1/me/advanced-mode", { data: { enabled: true } })).status(),
  ).toBe(200);
  const created = await page.request.post("/v1/families", { data: { name: "Assistant Family" } });
  expect(created.status()).toBe(201);
  const family = (await created.json()) as { id: string };
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/v1/families");
        if (!response.ok()) return false;
        const families = (await response.json()) as { id: string }[];
        return families.some((item) => item.id === family.id);
      },
      { timeout: 15000 },
    )
    .toBe(true);
  return family.id;
}

test("legacy assistant refuses without family-shared evidence", async ({ page }) => {
  await setup(page);
  await page.goto("/app/legacy/assistant");
  await expect(page.getByRole("heading", { name: "Family Legacy Assistant" })).toBeVisible();
  await expect(page.getByText(/Private conversations, private recordings/)).toBeVisible();
  await page.getByRole("button", { name: "How did our family business begin?" }).click();
  await expect(page.getByLabel("Your question")).toHaveValue("How did our family business begin?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(
    page.getByText("No confirmed memory shared with this family supports that answer."),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Citations" })).toHaveCount(0);
});

test("legacy assistant shows authorized citations and links to sources", async ({ page }) => {
  const familyId = await setup(page);
  await page.route(`**/v1/families/${familyId}/legacy-assistant/ask`, (route) =>
    route.fulfill({
      json: {
        family_id: familyId,
        answer: "The family business began with a small shop. [1]",
        verified: true,
        refusal: false,
        citations: [
          {
            number: 1,
            memory_id: "memory-1",
            summary: "Our family business began with a small shop.",
            level: "summary",
            reason: "space_member",
            version: 1,
            access_version: 3,
            kind: "story",
            as_of_date: "1962-04-01",
            subject_name: "Arun",
          },
        ],
      },
    }),
  );
  await page.goto("/app/legacy/assistant");
  await page.getByRole("button", { name: "How did our family business begin?" }).click();
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText("The family business began with a small shop. [1]")).toBeVisible();
  await expect(page.getByText("Verified against 1 permitted memory")).toBeVisible();
  const citation = page.getByRole("link", {
    name: /Arun: Our family business began with a small shop/,
  });
  await expect(citation).toHaveAttribute("href", "/app/memory/memory-1");
  await expect(page.getByText("1962-04-01")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
