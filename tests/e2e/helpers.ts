import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
}

export async function checkA11y(page: Page) {
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
