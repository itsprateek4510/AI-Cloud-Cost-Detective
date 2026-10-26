import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";

async function openArchive(page: Page, { advanced = true }: { advanced?: boolean } = {}) {
  const secret =
    process.env.JWT_SECRET ?? "smriti-local-development-secret-change-before-deployment";
  const token = await new SignJWT({ sub: "navigation-user" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));
  await page
    .context()
    .addCookies([{ name: "smriti_token", value: token, url: "http://localhost:3100" }]);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        id: "navigation-user",
        name: "Avery",
        email: "avery@example.com",
        provider: "password",
        advanced_mode: advanced,
        feature_heritage: true,
      },
    }),
  );
  await page.route("**/v1/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/events")
      return route.fulfill({ contentType: "text/event-stream", body: "" });
    if (url.pathname === "/v1/home")
      return route.fulfill({
        json: {
          greeting_name: "Avery",
          checklist: [],
          next_action: {
            kind: "weekly_question",
            label: "What did Sunday mornings sound like?",
            detail: "A small prompt for this week. Answer in your own words.",
            cta: "Answer this question",
            href: "/app",
          },
          pending: { memory_suggestions: 0, hints: 0, share_invites: 0 },
          family: [],
          weekly_question: { id: null, text: "What did Sunday mornings sound like?" },
          recent_stories: [],
        },
      });
    if (url.pathname === "/v1/spaces")
      return route.fulfill({
        json: [
          { id: "personal", type: "personal", name: "Personal", family_id: null },
          { id: "family-a", type: "family", name: "Family A", family_id: "a" },
          { id: "family-b", type: "family", name: "Family B", family_id: "b" },
        ],
      });
    if (url.pathname === "/v1/families")
      return route.fulfill({
        json: [
          { id: "a", name: "Family A" },
          { id: "b", name: "Family B" },
        ],
      });
    if (url.pathname.endsWith("/integrations"))
      return route.fulfill({ json: { ai_configured: false } });
    if (url.pathname.endsWith("/memory")) return route.fulfill({ json: { remember_chats: false } });
    if (url.pathname.endsWith("/hints"))
      return route.fulfill({ json: { incoming: [], outgoing: [] } });
    if (url.pathname.endsWith("/timeline")) return route.fulfill({ json: { events: [] } });
    if (url.pathname.endsWith("/vault")) return route.fulfill({ json: { files: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/app");
  await expect(page.getByRole("textbox", { name: "Message Smriti" })).toBeVisible();
}

async function showNavigation(page: Page) {
  const open = page.getByRole("button", { name: "Open navigation", exact: true });
  if (await open.isVisible()) await open.click();
}

test("the shell exposes only Home, Family, Stories, and Settings", async ({
  page,
  isMobile,
}) => {
  test.skip(!!isMobile, "The mobile project covers the bottom tab bar separately.");
  await openArchive(page);
  await showNavigation(page);
  const navigation = page.getByRole("navigation", { name: "App navigation", exact: true });
  const destinations = await navigation
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(destinations).toEqual(["/app", "/app/family", "/app/stories", "/app/settings"]);

  await navigation.getByRole("link", { name: "Family", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/family/);
  await expect(page.getByRole("navigation", { name: "Family sections" })).toBeVisible();

  await navigation.getByRole("link", { name: "Stories", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/stories/);
  await expect(
    page.getByRole("heading", { name: "Stories Smriti remembers", level: 1 }),
  ).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Heritage", exact: true })).toHaveCount(0);

  await navigation.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings & privacy" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Show advanced tools" })).toBeChecked();
  await page.getByRole("link", { name: "Open Heritage studio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "What would you like to do?" })).toBeVisible();

  await page.getByLabel("Family", { exact: true }).selectOption("b");
  await page.getByRole("link", { name: "2. Review memories" }).click();
  await expect(page.getByLabel("Current space")).toHaveValue("personal");
  await expect(
    page.getByRole("heading", { name: "Stories Smriti remembers", level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Current space")).toHaveValue("personal");
  await page.goto("/app/legacy/books");
  await expect(page.getByLabel("Family", { exact: true })).toHaveValue("b");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test("advanced tools are hidden and redirect home by default", async ({ page }) => {
  await openArchive(page, { advanced: false });
  await page.goto("/app/legacy");
  await expect(page).toHaveURL(/\/app\?notice=advanced$/);
  await expect(page.getByText("Advanced tools are off.")).toBeVisible();
  const navigation = page.getByRole("navigation", { name: "App navigation", exact: true });
  await expect(navigation.getByRole("link", { name: "Heritage", exact: true })).toHaveCount(0);
});

test("mobile uses a four-item bottom tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openArchive(page);
  const tabs = page.getByRole("navigation", { name: "Main navigation", exact: true });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("link")).toHaveCount(4);
  await expect(tabs.getByRole("link", { name: "Home", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});

test("a newly listed family never replaces the open personal workspace", async ({ page }) => {
  await openArchive(page);
  await page.goto("/app/memory");
  await expect(page.getByLabel("Current space")).toHaveValue("personal");
  // Creating a family can change the API's list order. Arrival of that shared
  // space must not move an open private archive into the family.
  await page.route("**/v1/spaces", (route) =>
    route.fulfill({
      json: [
        { id: "family-a", type: "family", name: "Family A", family_id: "a" },
        { id: "personal", type: "personal", name: "Personal", family_id: null },
      ],
    }),
  );
  await page.reload();
  await expect(page.getByLabel("Current space")).toHaveValue("personal");
});

test("archive request failures are not presented as an empty family", async ({ page }) => {
  await openArchive(page);
  await page.route("**/v1/memories?**", (route) =>
    route.fulfill({ status: 503, json: { detail: "Memories temporarily unavailable" } }),
  );
  await page.goto("/app/legacy");
  await expect(
    page.getByRole("alert").filter({ hasText: "Memories temporarily unavailable" }),
  ).toBeVisible();
  await expect(page.getByText("No preserved memories yet")).not.toBeVisible();
});
