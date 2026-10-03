import { test, expect } from "@playwright/test";
import { checkA11y, checkLayout, signIn } from "./helpers";

test("member can navigate every main screen with accessible responsive layouts", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await signIn(page);
  for (const path of ["/dashboard", "/feed", "/members", "/gatherings", "/gatherings?view=archived", "/settings", "/council"]) {
    const current = new URL(page.url());
    if (`${current.pathname}${current.search}` !== path) {
      // These are deliberate full-document route probes. Finish background
      // Next prefetches before tearing down their document: WebKit reports a
      // canceled in-flight RSC fetch as an access-control page error. Readiness
      // of the destination is still asserted through its visible heading.
      await page.waitForLoadState("networkidle");
      await page.goto(path);
    }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('fieldset[aria-busy="true"]')).toHaveCount(0);
    await checkLayout(page);
    await checkA11y(page);
    await page.screenshot({ path: testInfo.outputPath(`${path.replace(/\W/g, "-")}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("member can post, comment and react on the Wall", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/feed");
  const text = `Family update ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Write on The Wall", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Write on The Wall", { exact: true })).toHaveValue("");
  await page.reload();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  const post = page.locator('[data-slot="card"]').filter({ has: page.getByText(text, { exact: true }) });
  await post.getByRole("button", { name: "React heart", exact: true }).click();
  await expect(post.getByRole("button", { name: "React heart, 1", exact: true })).toHaveAttribute("aria-pressed", "true");
  await post.getByRole("button", { name: /comment/i }).click();
  await post.getByRole("textbox", { name: /Add a comment/ }).fill("Looking forward to seeing everyone.");
  await post.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(post.getByText("Looking forward to seeing everyone.", { exact: true })).toBeVisible();
  await checkLayout(page);
});

test("member can create, RSVP to and edit a gathering", async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto("/gatherings/new");
  const title = `Family dinner ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Title", { exact: false }).fill(title);
  await page.getByLabel("Description", { exact: true }).fill("An evening together.");
  await page.getByLabel("Location", { exact: true }).fill("Family home");
  await page.getByLabel(/^Start/).fill("2030-06-15T18:00");
  await page.getByLabel("End", { exact: true }).fill("2030-06-15T20:00");
  await page.getByRole("button", { name: "Create Gathering", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Going", exact: true }).click();
  await expect(page.getByRole("button", { name: "Going", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Going", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: `Actions for ${title}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.getByLabel("Title", { exact: false }).fill(`${title} updated`);
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: `${title} updated`, exact: true })).toBeVisible();
  await checkA11y(page);
});

test("Council streams to another session and restores messages after reload", async ({ page, browser }, testInfo) => {
  await signIn(page);
  await page.waitForLoadState("networkidle");
  await page.goto("/council");
  await page.getByRole("link", { name: /^General / }).click();
  const peerContext = await browser.newContext({ baseURL: "http://127.0.0.1:3217", timezoneId: "Pacific/Honolulu" });
  const peer = await peerContext.newPage();
  const peerErrors: string[] = [];
  peer.on("pageerror", (error) => peerErrors.push(error.message));
  await signIn(peer, "elder");
  // Finish dashboard prefetches before this deliberate document replacement.
  // Otherwise WebKit surfaces their cancellation as an RSC page error.
  await peer.waitForLoadState("networkidle");
  await peer.goto("/council");
  await peer.getByRole("link", { name: /^General / }).click();
  await expect(peer.getByRole("textbox", { name: /message/i })).toBeVisible();
  const message = `Hello family ${testInfo.project.name} ${Date.now()}`;
  const input = page.getByRole("textbox", { name: /message/i });
  await input.fill(message);
  await input.press("Enter");
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(peer.getByText(message, { exact: true })).toBeVisible();
  await peer.waitForLoadState("networkidle");
  await peer.reload();
  await expect(peer.getByText(message, { exact: true })).toBeVisible();
  expect(peerErrors).toEqual([]);
  await page.waitForLoadState("networkidle");
  await page.reload();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await checkLayout(page);
  await peerContext.close();
});

test("guest is read-only and member cannot enter Elder controls", async ({ page }) => {
  await signIn(page, "guest");
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "The Wall" })).toBeVisible();
  await expect(page.getByLabel("Write on The Wall", { exact: true })).toHaveCount(0);
  await page.goto("/gatherings/new");
  await expect(page).toHaveURL(/\/gatherings$/);
  await page.goto("/elder-council/members");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/council");
  await page.getByRole("link", { name: /^General / }).click();
  await expect(page.getByText("You can read this chamber", { exact: false })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /message/i })).toHaveCount(0);
});

test("Elder can open administration and create an invite", async ({ page }, testInfo) => {
  await signIn(page, "elder");
  for (const path of ["/elder-council", "/elder-council/members", "/elder-council/channels", "/elder-council/settings", "/elder-council/audit-log"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await checkLayout(page);
    await checkA11y(page);
  }
  await page.goto("/elder-council/access-codes");
  await page.getByLabel("Who is it for?").fill(`Test invite ${testInfo.project.name}`);
  await page.getByLabel("Max Uses").fill("1");
  await page.getByLabel("Expires (days)").fill("7");
  await page.getByRole("button", { name: "Create Code", exact: true }).click();
  await expect(page.getByText("New invite code", { exact: true })).toBeVisible();
  await checkLayout(page);
});
