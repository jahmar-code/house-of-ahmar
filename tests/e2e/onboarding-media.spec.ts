import { test, expect } from "@playwright/test";
import { checkA11y, checkLayout, signIn } from "./helpers";

test("invited relative can sign up, reject a bad code, and join", async ({ page }, testInfo) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email", { exact: true }).fill(`join-${testInfo.project.name}-${Date.now()}@house.local`);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/initiation$/);
  await page.getByLabel("Family code").fill("WRONG-CODE");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "isn't valid" })).toBeVisible();
  await page.getByLabel("Family code").fill("LOCAL-INVITE");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/initiation\/profile$/);
  await page.getByLabel(/^Name/).fill(`Relative ${testInfo.project.name}`);
  await page.getByLabel("Birthday", { exact: true }).fill("1990-06-15");
  await page.getByRole("button", { name: "Join the House", exact: true }).click();
  await expect(page).toHaveURL(/\/initiation\/complete$/);
  await page.getByRole("link", { name: "Go to the Great Hall" }).click();
  await expect(page.getByRole("heading", { name: "The Great Hall", exact: true })).toBeVisible();
  await checkLayout(page);
});

test("photo uploads render privately and profile changes persist", async ({ page, request }, testInfo) => {
  await signIn(page);
  await page.goto("/feed");
  const caption = `Private photo ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Write on The Wall", { exact: true }).fill(caption);
  await page.locator('input[type="file"]').setInputFiles({
    name: "family-test.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"),
  });
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(caption, { exact: true })).toBeVisible();
  const post = page.locator('[data-slot="card"]').filter({ has: page.getByText(caption, { exact: true }) });
  const photo = post.getByRole("img", { name: /^Photo 1 of 1 shared by / });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const src = await photo.getAttribute("src");
  expect(src).toMatch(/^\/api\/media\/feed-media\//);
  const signedIn = await page.request.get(src!);
  expect(signedIn.status()).toBe(200);
  expect(signedIn.headers()["cache-control"]).toContain("no-store");
  const anonymous = await request.get(src!, { maxRedirects: 0 });
  expect([401, 403, 307]).toContain(anonymous.status());

  await page.goto("/settings");
  const bio = `Family profile ${testInfo.project.name}`;
  await page.getByLabel("About you", { exact: true }).fill(bio);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("About you", { exact: true })).toHaveValue(bio);
  await checkA11y(page);
});
