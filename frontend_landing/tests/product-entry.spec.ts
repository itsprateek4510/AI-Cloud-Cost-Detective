import { expect, test } from "@playwright/test";

test("integration catalog offers AWS and distinguishes planned providers", async ({ page }) => {
  await page.goto("/integrations");
  await expect(page.getByRole("heading", { name: "Connect your cloud. Keep control." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect AWS" })).toHaveAttribute("href", "/signup");
  await expect(page.getByRole("button", { name: "Coming soon" })).toHaveCount(2);
  for (const button of await page.getByRole("button", { name: "Coming soon" }).all()) {
    await expect(button).toBeDisabled();
  }
  await expect(page.getByRole("link", { name: "Explore sample workspace" })).toHaveAttribute("href", /demo=1/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("signup and login hand off to the real cloud dashboard", async ({ request }) => {
  for (const path of ["/signup?plan=family", "/login"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const destination = new URL(response.headers().location);
    expect(destination.origin).toBe(new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173").origin);
    if (path.includes("plan=")) expect(destination.searchParams.get("plan")).toBe("family");
  }
});

test("about preview displays the entire image instead of cropping the dashboard", async ({ page }) => {
  await page.goto("/about");
  const image = page.locator(".story-photo-img img");
  await expect(image).toHaveCSS("object-fit", "contain");
  await expect(image).toHaveAttribute("alt", /sample/i);
});
