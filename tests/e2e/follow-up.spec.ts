import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { checkA11y, checkLayout, fixtureMemberId, signIn, testAdmin, testDatabase } from "./helpers";

// Regressions for the 2026-10-03 follow-up audit. Each test creates and removes
// its own synthetic rows on the local test database; IDs name the findings.

test("UX-01: a post from an older Wall page is revealed where it lands", async ({ page }, testInfo) => {
  const sql = testDatabase();
  const tag = `ux01-${testInfo.project.name}-${Date.now()}`;
  try {
    const elder = await fixtureMemberId(sql, "elder");
    await sql`insert into public.posts(author_id, content, created_at)
      select ${elder}, ${tag} || ' history ' || n, now() - (n || ' minutes')::interval from generate_series(1, 55) n`;
    await signIn(page);
    await page.goto("/feed?page=2");
    await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
    const fromHistory = `${tag} from page two`;
    await page.getByLabel("Write on The Wall", { exact: true }).fill(fromHistory);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page).toHaveURL(/\/feed\?post=[0-9a-f-]{36}$/);
    await expect(page.getByText(fromHistory, { exact: true })).toHaveCount(1);
    await expect(page.locator("[data-highlighted]").getByText(fromHistory, { exact: true })).toBeInViewport();
    await expect(page.getByText("Page 1", { exact: true })).toBeVisible();

    // Fifty pins fill page 1, so the newest unpinned post now lives on page 2.
    await sql`insert into public.posts(author_id, content, is_pinned)
      select ${elder}, ${tag} || ' pinned ' || n, true from generate_series(1, 50) n`;
    await page.goto("/feed");
    const behindPins = `${tag} behind fifty pins`;
    await page.getByLabel("Write on The Wall", { exact: true }).fill(behindPins);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.getByText(behindPins, { exact: true })).toHaveCount(1);
    await expect(page.getByText("Page 2", { exact: true })).toBeVisible();
    await checkLayout(page);
  } finally {
    await sql`delete from public.posts where content like ${`${tag}%`}`;
    await sql.end();
  }
});

test("UX-02: guests read reaction counts but are offered no reactions or plans", async ({ page }, testInfo) => {
  const sql = testDatabase();
  const tag = `ux02-${testInfo.project.name}-${Date.now()}`;
  // Empty Great Hall cards are where the planning/posting links used to appear:
  // hide every live post and upcoming gathering for the check, then restore.
  const hiddenPosts: string[] = [];
  const hiddenGatherings: string[] = [];
  const restore = async () => {
    if (hiddenPosts.length) await sql`update public.posts set is_deleted = false where id in ${sql(hiddenPosts.splice(0))}`;
    if (hiddenGatherings.length) await sql`update public.gatherings set archived_at = null where id in ${sql(hiddenGatherings.splice(0))}`;
  };
  try {
    hiddenPosts.push(...(await sql`update public.posts set is_deleted = true where not is_deleted returning id`).map((r) => r.id));
    hiddenGatherings.push(...(await sql`update public.gatherings set archived_at = now() where archived_at is null returning id`).map((r) => r.id));
    await signIn(page, "guest");
    await expect(page.getByText("Nothing on the calendar.", { exact: true })).toBeVisible();
    await expect(page.getByText("Nothing on The Wall yet.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Plan a gathering/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Write the first post/ })).toHaveCount(0);
    await restore();

    const member = await fixtureMemberId(sql, "member");
    const [post] = await sql`insert into public.posts(author_id, content) values (${member}, ${tag}) returning id`;
    await sql`insert into public.reactions(post_id, member_id, emoji) values (${post.id}, ${member}, 'heart')`;
    await page.goto(`/feed?post=${post.id}`);
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByText(tag, { exact: true }) });
    await expect(card.getByRole("list", { name: "Reactions" })).toHaveText(/heart\s*1/);
    await expect(card.getByRole("button", { name: /^React / })).toHaveCount(0);
    await checkA11y(page);
  } finally {
    await restore();
    await sql`delete from public.posts where content = ${tag}`;
    await sql.end();
  }
});

test("UX-03: long valid profile text wraps inside its card", async ({ page }) => {
  const sql = testDatabase();
  const admin = testAdmin();
  const created = await admin.auth.admin.createUser({ email: `${randomUUID()}@profile.test`, password: randomUUID(), email_confirm: true });
  if (created.error || !created.data.user) throw new Error("Could not create the profile fixture");
  const name = "W".repeat(50);
  try {
    const [member] = await sql`insert into public.members(auth_user_id, display_name, full_name, bio, role)
      values (${created.data.user.id}, ${name}, ${"F".repeat(100)}, ${`https://example.com/${"b".repeat(470)}`}, 'member') returning id`;
    await signIn(page);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/members/${member.id}`);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      const escaped = await page.evaluate(() => {
        const card = document.querySelector("main h1")!.closest('[data-slot="card"]')!.getBoundingClientRect();
        return [...document.querySelectorAll("main h1, main h1 ~ p")].filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < card.left - 1 || box.right > card.right + 1;
        }).length;
      });
      expect(escaped, `profile text escapes its card at ${width}px`).toBe(0);
      await checkLayout(page);
    }
  } finally {
    await sql`delete from public.members where auth_user_id = ${created.data.user.id}`;
    await admin.auth.admin.deleteUser(created.data.user.id);
    await sql.end();
  }
});

test("UX-04: a timed gathering has the viewer's day on profile, detail, list, dashboard and Great Hall summary", async ({ page, browser }, testInfo) => {
  const sql = testDatabase();
  const tag = `ux04-${testInfo.project.name}-${Date.now()}`;
  // Soon enough to lead the dashboard's list. Honolulu and Auckland are 22–23
  // hours apart, so step until their calendar days differ for this instant.
  let start = new Date(Math.ceil((Date.now() + 30 * 60_000) / 300_000) * 300_000);
  const local = (timeZone: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone, ...options }).format(start);
  const longDay = (timeZone: string) => local(timeZone, { weekday: "long", month: "long", day: "numeric" });
  while (longDay("Pacific/Honolulu") === longDay("Pacific/Auckland")) start = new Date(start.getTime() + 3_600_000);
  // The Great Hall's sentence: calendar days from the viewer's today.
  const phrase = (timeZone: string) => {
    const ymd = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    const days = (Date.parse(ymd(start)) - Date.parse(ymd(new Date()))) / 86_400_000;
    if (days === 0) return "is today";
    if (days === 1) return "is tomorrow";
    return days <= 6 ? `is on ${local(timeZone, { weekday: "long" })}` : `is on ${local(timeZone, { month: "short", day: "numeric" })}`;
  };
  try {
    const member = await fixtureMemberId(sql, "member");
    const [gathering] = await sql`insert into public.gatherings(title, starts_at, created_by) values (${tag}, ${start}, ${member}) returning id`;
    await sql`insert into public.rsvps(gathering_id, member_id, status) values (${gathering.id}, ${member}, 'attending')`;
    await signIn(page);
    const state = await page.context().storageState();
    for (const timezoneId of ["Pacific/Honolulu", "Pacific/Auckland"]) {
      const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
      const context = await browser.newContext({ storageState: state, timezoneId, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });
      try {
        const relative = await context.newPage();
        const shortDay = `${local(timezoneId, { weekday: "short" })}, `;
        const tile = async (path: string) => {
          await relative.goto(path);
          const card = relative.getByRole("link").filter({ hasText: tag });
          await expect(card.locator("time").nth(0)).toHaveText(local(timezoneId, { month: "short" }));
          await expect(card.locator("time").nth(1)).toHaveText(local(timezoneId, { day: "numeric" }));
          await expect(card).toContainText(shortDay);
        };
        await relative.goto(`/members/${member}`);
        await expect(relative.getByRole("link").filter({ hasText: tag })).toContainText(longDay(timezoneId));
        await relative.goto(`/gatherings/${gathering.id}`);
        await expect(relative.locator("main time").first()).toContainText(longDay(timezoneId));
        await tile("/gatherings");
        await tile("/dashboard");
        await expect(relative.locator("main p").filter({ hasText: tag }).first()).toContainText(`${tag} ${phrase(timezoneId)}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await sql`delete from public.gatherings where title = ${tag}`;
    await sql.end();
  }
});

test("UX-04: editing a timed gathering far from the server's timezone keeps its instant", async ({ page, browser }, testInfo) => {
  const sql = testDatabase();
  const tag = `ux04-edit-${testInfo.project.name}-${Date.now()}`;
  try {
    const member = await fixtureMemberId(sql, "member");
    const [gathering] = await sql`insert into public.gatherings(title, starts_at, ends_at, created_by)
      values (${tag}, '2030-06-15T18:00:00Z', '2030-06-15T20:00:00Z', ${member}) returning id`;
    await signIn(page);
    const state = await page.context().storageState();
    const context = await browser.newContext({ storageState: state, timezoneId: "Pacific/Honolulu" });
    try {
      const relative = await context.newPage();
      await relative.goto(`/gatherings/${gathering.id}/edit`);
      await expect(relative.locator("#title")).toBeEnabled();
      await expect(relative.locator("#startsAt")).toHaveValue("2030-06-15T08:00");
      await expect(relative.locator("#endsAt")).toHaveValue("2030-06-15T10:00");
      await relative.getByRole("button", { name: "Save Changes", exact: true }).click();
      await expect(relative.getByRole("heading", { name: tag, exact: true })).toBeVisible();
    } finally {
      await context.close();
    }
    const [row] = await sql`select starts_at, ends_at from public.gatherings where id = ${gathering.id}`;
    expect(row.starts_at.toISOString()).toBe("2030-06-15T18:00:00.000Z");
    expect(row.ends_at.toISOString()).toBe("2030-06-15T20:00:00.000Z");
  } finally {
    await sql`delete from public.gatherings where title = ${tag}`;
    await sql.end();
  }
});

test("UX-05: a pending gathering save freezes the draft and a failed save keeps it", async ({ page }, testInfo) => {
  const sql = testDatabase();
  const tag = `ux05-${testInfo.project.name}-${Date.now()}`;
  try {
    const member = await fixtureMemberId(sql, "member");
    const [gathering] = await sql`insert into public.gatherings(title, starts_at, created_by)
      values (${tag}, now() + interval '20 days', ${member}) returning id`;
    let mode: "abort" | "hold" = "abort";
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route(`**/gatherings/${gathering.id}/edit`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      if (mode === "abort") return route.abort();
      await held;
      return route.continue();
    });
    // Hold the post-save navigation too: the form must stay frozen until the
    // detail page replaces it, not just until the action returns.
    let holdNavigation = false;
    let navigationRequested = false;
    let releaseNavigation!: () => void;
    const navigationHeld = new Promise<void>((resolve) => { releaseNavigation = resolve; });
    await page.route(new RegExp(`/gatherings/${gathering.id}(\\?|$)`), async (route) => {
      if (!holdNavigation || route.request().method() !== "GET") return route.continue();
      navigationRequested = true;
      await navigationHeld;
      return route.continue();
    });
    await signIn(page);
    await page.goto(`/gatherings/${gathering.id}/edit`);
    const title = page.locator("#title");
    await expect(title).toBeEnabled();
    const draft = `${tag} renamed`;
    await title.fill(draft);
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    await expect(page.getByText("That didn't save. Check your connection and try again.")).toBeVisible();
    await expect(title).toBeEnabled();
    await expect(title).toHaveValue(draft);
    await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeFocused();

    mode = "hold";
    await page.getByRole("button", { name: "Save Changes", exact: true }).click();
    const saving = page.getByRole("button", { name: "Saving...", exact: true });
    await expect(saving).toHaveAttribute("aria-disabled", "true");
    await expect(title).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    holdNavigation = true;
    release();
    await expect(page.getByText("Gathering updated")).toBeVisible();
    await expect.poll(() => navigationRequested).toBe(true);
    await expect(title).toBeDisabled();
    await expect(saving).toHaveAttribute("aria-disabled", "true");
    releaseNavigation();
    await expect(page.getByRole("heading", { name: draft, exact: true })).toBeVisible();
    const [row] = await sql`select title from public.gatherings where id = ${gathering.id}`;
    expect(row.title).toBe(draft);
  } finally {
    await sql`delete from public.gatherings where title like ${`${tag}%`}`;
    await sql.end();
  }
});

test("UX-06: recovery removes a missed deletion from loaded older history", async ({ page }, testInfo) => {
  const sql = testDatabase();
  const tag = `ux06-${testInfo.project.name}-${Date.now()}`;
  let sendSystem: ((status: "error" | "ok") => void) | undefined;
  let streamReady = false;
  try {
    const member = await fixtureMemberId(sql, "member");
    const [channel] = await sql`insert into public.channels(name, slug, type) values (${`History ${tag}`}, ${tag}, 'general') returning id`;
    await sql`insert into public.messages(channel_id, author_id, content, created_at)
      select ${channel.id}, ${member}, ${tag} || ' message ' || lpad(n::text, 3, '0'), now() - ((121 - n) || ' seconds')::interval
      from generate_series(1, 120) n`;
    await page.routeWebSocket(/\/realtime\/v1\/websocket/, (socket) => {
      const server = socket.connectToServer();
      socket.onMessage((message) => server.send(message));
      server.onMessage((message) => {
        if (typeof message === "string") {
          const frame = JSON.parse(message);
          if (Array.isArray(frame) && frame[2]?.startsWith("realtime:council:")) {
            const [joinRef, , topic, event, payload] = frame;
            // Simulate the missed event: every UPDATE (deletion) is lost.
            if (event === "postgres_changes" && payload?.data?.type === "UPDATE") return;
            if (event === "system" && payload.extension === "postgres_changes" && payload.status === "ok") {
              streamReady = true;
              sendSystem = (status) => socket.send(JSON.stringify([
                joinRef, null, topic, "system",
                { extension: "postgres_changes", status, message: "Synthetic service health event", channel: topic },
              ]));
            }
          }
        }
        socket.send(message);
      });
    });
    await signIn(page);
    await page.goto(`/council/${channel.id}`);
    await expect.poll(() => streamReady).toBe(true);
    const oldest = page.getByText(`${tag} message 001`, { exact: true });
    await expect(page.getByText(`${tag} message 021`, { exact: true })).toBeVisible();
    await expect(oldest).toHaveCount(0);
    await page.getByRole("button", { name: "Load earlier messages", exact: true }).click();
    await expect(oldest).toBeVisible();

    sendSystem!("error");
    const warning = page.getByRole("status").filter({ hasText: "Reconnecting" });
    await expect(warning).toBeVisible();
    await sql`update public.messages set is_deleted = true, content = ''
      where channel_id = ${channel.id} and content = ${`${tag} message 001`}`;
    sendSystem!("ok");
    await expect(warning).toBeHidden();
    await expect(oldest).toHaveCount(0);
    await expect(page.getByText(`${tag} message 002`, { exact: true })).toBeVisible();
    await expect(page.getByText(`${tag} message 120`, { exact: true })).toBeVisible();
  } finally {
    await sql`delete from public.channels where slug = ${tag}`;
    await sql.end();
  }
});

test("DS-04: an Elder can tidy away past gatherings", async ({ page }, testInfo) => {
  const sql = testDatabase();
  const tag = `ds04-${testInfo.project.name}-${Date.now()}`;
  try {
    const elder = await fixtureMemberId(sql, "elder");
    const [gathering] = await sql`insert into public.gatherings(title, starts_at, ends_at, created_by)
      values (${tag}, now() - interval '30 days', now() - interval '30 days' + interval '2 hours', ${elder}) returning id`;
    await signIn(page, "elder");
    await page.goto("/gatherings");
    await page.getByRole("button", { name: "Archive past", exact: true }).click();
    await page.getByRole("button", { name: "Tidy them away", exact: true }).click();
    await expect(page.getByText(/^Tidied away \d+ gatherings?$/)).toBeVisible();
    const [row] = await sql`select archived_at from public.gatherings where id = ${gathering.id}`;
    expect(row.archived_at).not.toBeNull();
    await page.getByRole("link", { name: "Archived", exact: true }).click();
    await expect(page).toHaveURL(/view=archived/);
    await expect(page.getByText(tag, { exact: true })).toBeVisible();
  } finally {
    await sql`delete from public.gatherings where title = ${tag}`;
    await sql.end();
  }
});
