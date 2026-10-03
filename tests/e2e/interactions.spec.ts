import { test, expect } from "@playwright/test";
import { checkA11y, checkLayout, signIn } from "./helpers";

const photo = {
  name: "family-keyboard-check.png",
  mimeType: "image/png",
  buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"),
};

test("photo viewer and mobile menu support keyboard navigation and return focus", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/feed");
  const caption = `Keyboard photos ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Write on The Wall", { exact: true }).fill(caption);
  await page.locator('input[type="file"]').setInputFiles([photo, { ...photo, name: "second-family-photo.png" }]);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  const post = page.locator('[data-slot="card"]').filter({ has: page.getByText(caption, { exact: true }) });
  const opener = post.getByRole("button", { name: /^Open photo 1 of 2/ });
  await expect(opener).toBeVisible();
  await opener.focus();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: /^Photos from / });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toHaveText("1 of 2");
  // Base UI moves initial focus on an animation frame. Visibility alone can
  // precede that handoff, especially under Linux WebKit's mobile emulation.
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("status")).toHaveText("2 of 2");
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.getByRole("status")).toHaveText("1 of 2");
  await dialog.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await dialog.getByRole("button", { name: "Previous photo", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await checkA11y(page);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();

  // Also exercise this contract on a compact desktop window, where the same
  // mobile navigation replaces the sidebar.
  if ((page.viewportSize()?.width ?? 0) >= 1024) await page.setViewportSize({ width: 375, height: 812 });
  const menu = page.getByRole("button", { name: "Open menu", exact: true });
  await menu.focus();
  await menu.press("Enter");
  const navigation = page.getByRole("dialog", { name: "Navigation menu", exact: true });
  await expect(navigation).toBeVisible();
  await expect.poll(() => navigation.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await checkA11y(page);
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(menu).toBeFocused();
  await checkLayout(page);
});

test("uploaded profile portraits remain private, persist and have accessible alternatives", async ({ page, request }) => {
  await signIn(page);
  await page.goto("/settings");
  // A direct file-input event can beat client hydration on a cold document.
  // Prove the controlled profile form is interactive through its live counter,
  // then use the same labeled chooser a relative opens.
  const biography = page.getByLabel("About you", { exact: true });
  const previousBiography = await biography.inputValue();
  const readinessText = "Avatar upload verification";
  await biography.fill(readinessText);
  await expect(page.getByText(`${readinessText.length} of 500 characters`, { exact: true })).toBeVisible();
  await biography.fill(previousBiography);
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator('label[for="avatar"]').click(),
  ]);
  await chooser.setFiles(photo);
  const portrait = page.getByRole("img", { name: "Your profile photo", exact: true });
  await expect(portrait).toHaveAttribute("src", /^\/api\/media\/feed-media\/avatars\//);
  await expect.poll(() => portrait.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const source = await portrait.getAttribute("src");
  await page.reload();
  await expect(portrait).toHaveAttribute("src", source!);
  expect((await page.request.get(source!)).status()).toBe(200);
  expect([401, 403, 307]).toContain((await request.get(source!, { maxRedirects: 0 })).status());
  await checkA11y(page);
  await page.goto("/members");
  await checkA11y(page);
  await checkLayout(page);
});

test("Council keeps IME drafts, prevents duplicate sends and keeps the composer above navigation", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/council");
  await page.getByRole("link", { name: /^General / }).click();
  const input = page.getByRole("textbox", { name: /Write a message in General/ });
  const message = `Composition check ${testInfo.project.name} ${Date.now()}`;
  await input.fill(message);

  let actionRequests = 0;
  let releaseSend!: () => void;
  const sendGate = new Promise<void>((resolve) => { releaseSend = resolve; });
  await page.route("**/council/**", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      actionRequests += 1;
      await sendGate;
    }
    await route.continue();
  });
  try {
    await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: true });
    await expect(input).toHaveValue(message);
    await expect(input).not.toHaveAttribute("readonly");
    expect(actionRequests).toBe(0);
    await input.press("Enter");
    await expect(input).toHaveAttribute("readonly");
    await input.press("Enter");
    await expect.poll(() => actionRequests).toBe(1);
    releaseSend();
    await expect(input).toHaveValue("");
    await expect(page.getByText(message, { exact: true })).toHaveCount(1);
    await expect(input).toBeFocused();
    expect(actionRequests).toBe(1);
    const navigation = page.getByRole("navigation", { name: "Primary", exact: true });
    if ((page.viewportSize()?.width ?? 1024) < 1024) {
      const inputBox = await input.boundingBox();
      const navigationBox = await navigation.boundingBox();
      expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(navigationBox!.y);
    }
    await checkLayout(page);
  } finally {
    releaseSend();
    await page.unrouteAll({ behavior: "wait" });
  }
});

test("all-day gathering dates survive Honolulu and Auckland display and editing", async ({ page, browser }, testInfo) => {
  await signIn(page);
  await page.goto("/gatherings/new");
  const title = `Calendar day ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Title", { exact: false }).fill(title);
  await page.getByLabel("Location", { exact: true }).fill("LongFamilyGatheringLocation".repeat(7));
  await page.getByLabel(/^All day/).check();
  await page.getByLabel(/^First day/).fill("2030-06-15");
  await page.getByLabel("Last day", { exact: true }).fill("2030-06-16");
  await page.getByRole("button", { name: "Create Gathering", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  const url = page.url();
  const state = await page.context().storageState();
  for (const timezoneId of ["Pacific/Honolulu", "Pacific/Auckland"]) {
    const context = await browser.newContext({ storageState: state, timezoneId, viewport: page.viewportSize()! });
    try {
      const relative = await context.newPage();
      await relative.goto(url);
      await expect(relative.locator('time[datetime="2030-06-15"]')).toHaveText("Saturday, June 15 – Sunday, June 16, 2030 · All day");
      await checkLayout(relative);
      await relative.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
      await relative.getByRole("menuitem", { name: "Edit", exact: true }).click();
      await expect(relative.getByLabel(/^First day/)).toHaveValue("2030-06-15");
      await expect(relative.getByLabel("Last day", { exact: true })).toHaveValue("2030-06-16");
      await relative.getByRole("button", { name: "Save Changes", exact: true }).click();
      await expect(relative.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(relative.locator('time[datetime="2030-06-15"]')).toContainText("June 15 – Sunday, June 16");
    } finally {
      await context.close();
    }
  }
});
