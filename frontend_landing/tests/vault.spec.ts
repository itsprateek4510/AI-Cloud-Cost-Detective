import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function signup(page: Page, name: string) {
  const result = await page.request.post("/api/auth/signup", {
    data: {
      name,
      email: `vault-${crypto.randomUUID()}@example.com`,
      password: "a-good-test-password",
    },
  });
  expect(result.status()).toBe(201);
  expect(
    (await page.request.patch("/v1/me/advanced-mode", { data: { enabled: true } })).status(),
  ).toBe(200);
}

test("private family vault uploads originals, inherits sharing, revokes downloads, and deletes", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  await signup(page, "Vault Owner");
  const created = await page.request.post("/v1/families", { data: { name: "Vault Family" } });
  expect(created.status()).toBe(201);
  const family = await created.json();
  await expect
    .poll(async () => (await page.request.get(`/v1/families/${family.id}/persons`)).status(), {
      timeout: 15000,
    })
    .toBe(200);
  await page.goto("/app/legacy/vault");
  await expect(
    page.getByRole("heading", { name: "Private Family Vault", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Development storage only.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New private collection" }).click();
  await page.getByLabel("Collection or folder name").fill("Family Letters");
  await page.getByLabel("Description", { exact: true }).fill("Letters across generations");
  await page.getByRole("button", { name: "Create collection or folder" }).click();
  await expect(page.getByRole("heading", { name: "Family Letters", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New folder", exact: true }).click();
  await page.getByLabel("Collection or folder name").fill("1960 letters");
  await page.getByRole("button", { name: "Create collection or folder" }).click();
  await expect(page.getByRole("heading", { name: "1960 letters", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Upload an original" }).click();
  await page
    .getByLabel("Original file", { exact: true })
    .setInputFiles({
      name: "letter.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Dear family, this is the original letter."),
    });
  await page.getByLabel("File title", { exact: true }).fill("Letter from grandmother");
  await page.getByLabel("File category", { exact: true }).selectOption("letter");
  await page.getByLabel("Heritage date").fill("1960-06-01");
  await page.getByLabel("File description").fill("The story of our first home");
  await expect(page.getByRole("button", { name: "Save original", exact: true })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Save original", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Original saved");
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("heading", { name: "Letter from grandmother", exact: true }) });
  await expect(card.getByRole("button", { name: "Download original" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  const downloadEvent = page.waitForEvent("download");
  await card.getByRole("button", { name: "Download original" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("letter.txt");
  expect(await readFile((await download.path())!, "utf8")).toBe(
    "Dear family, this is the original letter.",
  );
  await card.getByRole("button", { name: "Edit metadata" }).click();
  await card.getByLabel("File description").fill("Updated description of the first family home");
  await card.getByRole("button", { name: "Save metadata" }).click();
  await expect(card).toContainText("Updated description");
  await page.getByLabel("Search vault metadata").fill("does-not-exist");
  await expect(page.getByRole("heading", { name: "No permitted files here" })).toBeVisible();
  await page.getByLabel("Search vault metadata").fill("grandmother");
  await expect(card).toBeVisible();
  await page.getByLabel("Search vault metadata").fill("");
  const payload = await (await page.request.get(`/v1/families/${family.id}/vault`)).json();
  const file = payload.files.find((f: { title: string }) => f.title === "Letter from grandmother");
  const url = `/v1/vault/files/${file.id}/download`;

  const receiverContext = await browser.newContext({
    baseURL: "http://localhost:3100",
    viewport: page.viewportSize()!,
  });
  const receiver = await receiverContext.newPage();
  try {
    await signup(receiver, "Vault Reader");
    const invitation = await (
      await page.request.post(`/v1/families/${family.id}/invites`, { data: {} })
    ).json();
    expect((await receiver.request.post(`/v1/invites/${invitation.token}/accept`)).status()).toBe(
      200,
    );
    await expect
      .poll(async () => (await receiver.request.get(`/v1/families/${family.id}/persons`)).status())
      .toBe(200);
    expect((await receiver.request.get(url)).status()).toBe(404);
    await page.getByRole("button", { name: "Open the top-level collection" }).click();
    page.on("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Share collection with family" }).click();
    await expect(page.getByRole("button", { name: "Revoke family access" })).toBeVisible();
    expect((await receiver.request.get(url)).status()).toBe(200);
    await receiver.goto("/app/legacy/vault");
    await expect(
      receiver.getByRole("heading", { name: "Letter from grandmother", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("private-family-vault.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Revoke family access" }).click();
    await expect(page.getByRole("button", { name: "Share collection with family" })).toBeVisible();
    expect((await receiver.request.get(url)).status()).toBe(404);
    await receiver.reload();
    await expect(
      receiver.getByRole("heading", { name: "Letter from grandmother", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /1960 letters/ }).click();
    await card.getByRole("button", { name: "Delete item" }).click();
    await expect(card).toHaveCount(0);
    expect((await page.request.get(url)).status()).toBe(404);
  } finally {
    await receiverContext.close();
  }
});
