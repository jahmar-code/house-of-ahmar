import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

/** Direct SQL for synthetic fixtures — only ever the dedicated local test database. */
export function testDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.port !== "55322") {
    throw new Error("Browser fixtures may only use the local test database.");
  }
  return postgres(url.toString(), { max: 1, onnotice: () => {} });
}

/** Service-role client for synthetic Auth fixtures — only the local test API. */
export function testAdmin() {
  const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!["127.0.0.1", "localhost", "[::1]"].includes(api.hostname) || api.port !== "55321") {
    throw new Error("Browser fixtures may only use the local test API.");
  }
  return createClient(api.origin, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function fixtureMemberId(sql: ReturnType<typeof testDatabase>, role: "elder" | "member" | "guest") {
  const [row] = await sql`select id from public.members where email = ${`e2e-${role}@house.local`}`;
  return row.id as string;
}

export async function signIn(page: Page, role: "elder" | "member" | "guest" = "member") {
  await page.goto("/sign-in");
  await page.getByLabel("Email", { exact: true }).fill(`e2e-${role}@house.local`);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Enter the House", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "The Great Hall", exact: true })).toBeVisible();
}

export async function checkLayout(page: Page) {
  const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width + 1);
  // Document width misses text a card hides with overflow:hidden. Every
  // clipping box inside the page must fit its own content horizontally, except
  // deliberate single-line ellipsis and 1px screen-reader-only text.
  const clipped = await page.evaluate(() => [...document.querySelectorAll("main *")].flatMap((element) => {
    const style = getComputedStyle(element);
    if (!["hidden", "clip"].includes(style.overflowX) || style.textOverflow === "ellipsis" || element.clientWidth <= 1) return [];
    if (element.scrollWidth <= element.clientWidth + 1) return [];
    return [`${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 3).join(".")} ${element.scrollWidth}>${element.clientWidth}`];
  }));
  expect(clipped).toEqual([]);
}

export async function checkA11y(page: Page) {
  // A server-rendered value can be visible before its controlled form hydrates.
  // Wait for that explicit readiness signal so disabled colors do not change
  // halfway through axe's asynchronous style sampling on slower runners.
  await expect(page.locator('fieldset[aria-busy="true"]')).toHaveCount(0);
  // Color and overlap checks need the final modal/sheet geometry. Sampling an
  // entering sheet blends its text with the animated backdrop and gives false
  // contrast failures. Wait for actual finite animations, never a fixed delay.
  await page.evaluate(async () => {
    const animations = document.getAnimations().filter((animation) =>
      animation.playState === "running"
      && Number.isFinite(animation.effect?.getComputedTiming().endTime),
    );
    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(({ target }) => target) }))).toEqual([]);
}
