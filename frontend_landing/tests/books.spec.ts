import { expect, test } from "@playwright/test";

test("a book is saved, reviewed, approved, exported, and revoked without AI", async ({ page }) => {
  test.setTimeout(90000);
  const signup = await page.request.post("/api/auth/signup", {
    data: {
      name: "Book Tester",
      email: `book-${crypto.randomUUID()}@example.com`,
      password: "a-good-test-password",
    },
  });
  expect(signup.status(), await signup.text()).toBe(201);
  expect(
    (await page.request.patch("/v1/me/advanced-mode", { data: { enabled: true } })).status(),
  ).toBe(200);
  const family = await page.request.post("/v1/families", { data: { name: "Book Family" } });
  expect(family.status(), await family.text()).toBe(201);
  await page.goto("/app/legacy/books");
  await page.getByLabel("Book title", { exact: true }).fill("Our family edition");
  await page.getByRole("button", { name: "Create book project", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Our family edition", exact: true }),
  ).toBeVisible();
  const bookId = page.url().split("/").pop()!;
  const writing = page.getByLabel("Chapter writing", { exact: true });
  const approve = page.getByRole("button", { name: "Approve chapter", exact: true });
  await expect(approve).toBeDisabled();
  await writing.fill(
    "We gathered every summer in the garden. This is our own family introduction.",
  );
  await page.getByRole("button", { name: "Save chapter", exact: true }).click();
  await expect(approve).toBeEnabled();
  // Editing a saved draft must not approve an older, invisible version.
  const finalText = "We gathered every summer in the garden. Grandmother always brought mangoes.";
  await writing.fill(finalText);
  await expect(approve).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Draft from sources", exact: true }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(writing).toHaveValue(finalText);
  await page.getByRole("button", { name: "Save chapter", exact: true }).click();
  await expect(approve).toBeEnabled();
  await page.reload();
  await expect(writing).toHaveValue(finalText);
  await approve.click();
  await expect(page.getByRole("button", { name: "Approve book", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Approve book", exact: true }).click();
  await page.getByRole("button", { name: "Export private PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).toBeVisible();
  const pdf = await page.request.get(`/v1/books/${bookId}/download`);
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revoke PDF", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download PDF", exact: true })).not.toBeVisible();
  expect((await page.request.get(`/v1/books/${bookId}/download`)).status()).toBe(404);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
});
