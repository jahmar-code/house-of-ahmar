import { test, expect } from "@playwright/test";
import { checkA11y, checkLayout } from "./helpers";

test("public entry and recovery screens are accessible and fit the viewport", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of ["/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (path === "/reset-password") await expect(page.getByRole("link", { name: "Email me a new link" })).toBeVisible();
    await checkLayout(page);
    await checkA11y(page);
  }
  expect(errors).toEqual([]);
});

test("anonymous visitors cannot enter private routes or fetch media", async ({ page, request }) => {
  for (const path of ["/dashboard", "/feed", "/members", "/gatherings", "/council", "/settings", "/elder-council"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  }
  const response = await request.get("/api/media/feed-media/someone/photo.png", { maxRedirects: 0 });
  expect([401, 403, 307]).toContain(response.status());
});

test("failed sign in keeps inputs and offers recovery", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("nobody@house.local");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Enter the House", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "don't match" })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("nobody@house.local");
  await expect(page.getByRole("button", { name: "Enter the House", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible();
});

test("security headers and robots protect the private house", async ({ request }) => {
  const response = await request.get("/sign-in");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("Disallow: /");
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe("standalone");
});
