import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function saveSettings(page: Page) {
  const saved = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && response.url().includes("/elder-council/settings")
    && Boolean(response.request().headers()["next-action"])
  );
  await page.getByRole("button", { name: "Save Settings", exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole("button", { name: "Save Settings", exact: true })).toBeEnabled();
}

test("Elder identity changes refresh cached public pages and private navigation", async ({ page, browser }, testInfo) => {
  await signIn(page, "elder");
  await page.goto("/elder-council/settings");
  const original = {
    houseName: await page.getByLabel(/^House Name/).inputValue(),
    houseTagline: await page.getByLabel("Tagline", { exact: true }).inputValue(),
    welcomeMessage: await page.getByLabel("Welcome Message", { exact: true }).inputValue(),
    coverImageUrl: await page.getByLabel("Cover Photo", { exact: true }).inputValue(),
  };
  const oldInitial = original.houseName.trim().charAt(0).toUpperCase();
  const newInitial = oldInitial === "Z" ? "Y" : "Z";
  const name = `${newInitial}ebra family ${testInfo.project.name}`;
  const greeting = `Welcome to this family ${testInfo.project.name}`;
  const anonymous = await browser.newContext({ baseURL: "http://127.0.0.1:3217" });
  const visitor = await anonymous.newPage();
  const publicRoutes = ["/sign-in", "/sign-up", "/forgot-password", "/reset-password"];

  try {
    // Warm every prerendered page before the mutation so this catches stale
    // route caches, not merely the latest server query after a cold request.
    for (const route of publicRoutes) {
      await visitor.goto(route);
      await expect(visitor.getByText(oldInitial, { exact: true })).toBeVisible();
    }
    await page.getByLabel(/^House Name/).fill(name);
    await page.getByLabel("Tagline", { exact: true }).fill("A shared home for everyone.");
    await page.getByLabel("Welcome Message", { exact: true }).fill(greeting);
    await saveSettings(page);
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();

    await visitor.goto("/");
    await expect(visitor.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(visitor.getByText("A shared home for everyone.", { exact: true })).toBeVisible();
    for (const route of publicRoutes) {
      await visitor.goto(route);
      await expect(visitor.getByText(newInitial, { exact: true })).toBeVisible();
    }
    await page.goto("/dashboard");
    await expect(page.getByText(greeting, { exact: true })).toBeVisible();
  } finally {
    try {
      await page.goto("/elder-council/settings");
      await page.getByLabel(/^House Name/).fill(original.houseName);
      await page.getByLabel("Tagline", { exact: true }).fill(original.houseTagline);
      await page.getByLabel("Welcome Message", { exact: true }).fill(original.welcomeMessage);
      await page.getByLabel("Cover Photo", { exact: true }).fill(original.coverImageUrl);
      await saveSettings(page);
      await page.reload();
      await expect(page.getByLabel(/^House Name/)).toHaveValue(original.houseName);
      // next start persists regenerated HTML but keeps invalidation tags in
      // memory. Materialize the restored public pages before the test server
      // stops, so another run reusing this build cannot inherit fixture names.
      await visitor.goto("/");
      await expect(visitor.getByRole("heading", { name: original.houseName, exact: true })).toBeVisible();
      for (const route of publicRoutes) {
        await visitor.goto(route);
        await expect(visitor.getByText(oldInitial, { exact: true })).toBeVisible();
      }
    } finally {
      await anonymous.close();
    }
  }
});
