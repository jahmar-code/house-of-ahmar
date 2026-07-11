# House of Ahmar

A private, invite-only community platform for one family "House" — a members-only
social space with a feed, events, and a real-time council chat. Entry is by
**initiation**: you need an access code minted by an
Elder. There is no public content and no self-serve signup into the House itself —
the landing page is a gate.

**Single-tenant by design.** The whole database *is* one house; there is no
`org`/`workspace`/tenant table. House-wide config (name, tagline, welcome message,
cover image) lives as key/value rows in `house_settings`.

**Design language:** minimal, flat, high-contrast — neutral-gray surfaces with a
single **orange-400** accent and Inter throughout (it mirrors `jawaadahmar.com`).
Dark-mode only. The app was originally themed "secret-society gold on charcoal";
that palette was **re-aliased** to orange/neutral without touching components (see
§ Design tokens), so you will still see `text-gold` / `font-heading` utilities in
the tree — they now render orange/Inter.

---

## How to think about this codebase

Every change touches a real family's private space. Keep four perspectives in mind
before writing or reviewing code:

**As a UI/UX engineer** — this is a members' home, not a product funnel. It should
feel calm, personal, and fast. Mobile matters: members live on phones, so every
screen has a desktop sidebar *and* a mobile top bar + bottom tab bar (`(house)/layout.tsx`).
Respect the design language: neutral surfaces, one orange accent, generous
whitespace, Inter. Use **Lucide** icons for UI; the only sanctioned emoji are the
fixed six-reaction set in `constants.ts`. Server Components by default; reach for
`"use client"` only when interactivity demands it.

**As a senior software engineer** — data integrity and correct authorization are
the whole game in a private space. Every mutation is a **Server Action** in
`src/app/actions/` that: gates auth first (`requireAuth` / `requireRole("elder")`,
which *throw*), validates with Zod (`validators.ts`), scopes to the caller via
`getAuthContext()`, mutates through Drizzle, and returns an `ActionResult`. Roles
are `elder > member > guest`. **Two layers of authz, keep both:** (a) role/ownership
gating in every server action/page (`requireRole` / owner-or-elder) — the app's
`DATABASE_URL` owner role bypasses RLS, so the app is unaffected by it; (b) the
Supabase **Data API is locked** (migration `0002`): every table has RLS enabled
deny-by-default and client grants are revoked, so the browser's publishable key
can't read/write tables directly. The ONLY client Data-API reads are message-author
name/avatar/role and Council `messages` (private chambers elder-only).

**As a QA engineer** — the highest-risk surfaces are: the **initiation / access-code**
flow (the first-ever member silently becomes Elder; codes have use-counts and
expiry), **role gating** (an ungated elder action is a privilege-escalation bug),
**realtime council** (INSERT/UPDATE dedup, soft-delete propagation), and the
**stale-UI-after-mutation** class (a server action fired from `onClick` needs an
explicit `router.refresh()` — see `rsvp-button.tsx`). Run `npm test` (Vitest,
validators) and `npx tsc --noEmit` before any commit.

**As the end user** —
- *Elder*: "I run the House. I mint invite codes, manage members and their roles,
  create council chambers, and set the House's identity.
  Nothing sensitive should be one misclick away."
- *Member*: "I want to see who's around, post to the wall, RSVP to gatherings,
  and chat in the council — on my phone, instantly."
- *Guest*: "I have limited standing (`guest` role, rank 0). I can be in the House
  but I'm below a full member."

---

## Specialist agents

The four perspectives above are also **loadable role personas** in the top-level
[`agents/`](agents/README.md) folder (copied from `~/Desktop/dev/agents_md`). They
are **not** `.claude/agents/` subagents; nothing auto-spawns them. **This section
is the router:** when a task falls squarely inside one discipline, **read the
matching persona file and adopt it as operating instructions on top of (never
instead of) this document** for that task. For cross-cutting work, load more than
one (a new feature typically = database + backend + frontend + qa).

| Load this persona | File | When the task is about… |
|---|---|---|
| **Database Engineer** | [`agents/database-engineer.md`](agents/database-engineer.md) | `schema.ts`, migrations, enums, indexes/constraints, soft-delete leaks, RLS |
| **Backend Engineer** | [`agents/backend-engineer.md`](agents/backend-engineer.md) | Server actions, the `src/lib/` domain layer, auth/role gating, presence, audit, settings, DDD |
| **Frontend Engineer** | [`agents/frontend-engineer.md`](agents/frontend-engineer.md) | Any visible UI, styling, the design tokens, RSC-vs-client boundaries, realtime chat |
| **QA Tester** | [`agents/qa-tester.md`](agents/qa-tester.md) | Verifying a flow, reproducing a bug, extending Vitest coverage, stale-UI / authz checks |
| **Security & Pen Tester** | [`agents/security-pentester.md`](agents/security-pentester.md) | Auth, access codes, initiation, role gating, the open-redirect guard, tokens, hardening |

**Rules for loading a persona:**
- **This document always wins.** A persona sharpens focus; it never overrides a
  Critical rule or an architecture standard here.
- **Stay in the loaded lane.** If work drifts into another discipline (a schema
  change while doing frontend work), stop and load that persona or flag it — don't
  freelance across the shared files (`schema.ts`, `validators.ts`, `proxy.ts`,
  `globals.css`, `layout.tsx`, `constants.ts`) that require coordination.
- **Report back in the persona's "Definition of done" format** so outcomes are
  verified, not asserted.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, React Server Components, Server Actions, **Turbopack**) |
| Language | TypeScript 5 — strict, zero `tsc --noEmit` errors at all times |
| Styling | Tailwind CSS **v4** (CSS-first, no `tailwind.config`), shadcn/ui **Base UI flavor** (`@base-ui/react/*`, not Radix) |
| Auth | Supabase Auth (email/password + email confirmation), cookie sessions via `@supabase/ssr` |
| Database | Supabase PostgreSQL via Drizzle ORM (`drizzle-orm/postgres-js`) |
| Realtime | Supabase Realtime — the Council chat (`messages`) streams live |
| Storage | Supabase Storage — buckets `archives`, `feed-media` |
| Validation | Zod **4** (schemas in `src/lib/validators.ts`) |
| Forms | Plain `FormData` + Server Actions (react-hook-form is installed but not the primary pattern) |
| Icons | Lucide React (`lucide-react`) |
| Toasts | Sonner (`<Toaster>` in root layout) |
| Dates | date-fns |
| Tests | Vitest 4 (unit, `src/**/*.test.ts`) |

---

## Quick reference

```bash
npm run dev          # Dev server (Turbopack) — localhost:3000 (launch.json uses :3100)
npm run build        # Production build (needs network for next/font Google fonts)
npm run lint         # ESLint
npm test             # Vitest (run once) — validator suite
npm run test:watch   # Vitest (watch)
npm run db:push      # Push schema.ts straight to Supabase (drizzle-kit; reads .env.local)
npm run db:generate  # Emit migration SQL from schema.ts
npm run db:studio    # Drizzle Studio (visual DB browser)

# Ad-hoc ops (not in package.json — run with node):
node scripts/enable-realtime.mjs        # ALTER PUBLICATION supabase_realtime ADD messages, channels
node scripts/seed-channels.mjs          # idempotent: General / Announcements / Elders Only
node scripts/confirm-test-user.mjs <email>   # flip email_confirmed_at via service-role admin API
```

`npx tsc --noEmit` is the fast correctness gate (no network needed). `npm run build`
requires internet to fetch Inter + Geist Mono from Google Fonts.

---

## Project structure

```
src/
  app/
    layout.tsx                RootLayout — <html class="dark">, Inter + Geist_Mono, <Toaster>. No auth.
    globals.css               Tailwind v4 tokens (@theme inline) — the whole palette
    page.tsx                  Landing gate — signed-in → /dashboard; else hero (houseName/tagline)
    not-found.tsx             404
    sign-in/  sign-up/        Supabase email+password forms ("use client")
    auth/confirm/route.ts     Email-confirm / magic-link GET callback (code | token_hash)
    initiation/               Pre-membership flow (authed but no member row yet)
      page.tsx                → access-code-form (validateAccessCode)
      profile/                → profile-form (completeInitiation)
      complete/               → "Welcome to the House"
    (house)/                  PROTECTED shell (route group; layout guards via getAuthContext)
      layout.tsx              PresenceProvider + HouseSidebar + MobileHeader + MobileNav
      dashboard/              "The Great Hall" — stats, online, birthdays, gatherings, posts
      feed/                   "The Wall" — posts, comments, reactions
      members/  members/[id]/ Directory + member profile
      gatherings/             list · new · [id] · [id]/edit  (events + RSVP)
      council/  council/[channelId]/   Realtime chat (channels = "chambers")
      elder-council/          ADMIN — each page self-guards: requireRole("elder") or redirect /dashboard
        page · access-codes · channels · members · audit-log · settings
    actions/                  ALL mutations (one file per domain — the mutation surface; no REST API)
    api/webhooks/             empty (Clerk webhook deleted; auth.users→members CASCADE replaces it)
  components/
    ui/                       shadcn/Base-UI primitives — DO NOT edit directly. Reuse before building.
    layout/                   house-sidebar · mobile-header · mobile-nav · presence-provider · nav-items.ts
    shared/                   page-header · empty-state
    dashboard/ feed/ gatherings/ council/ members/   feature components
  hooks/                      EMPTY — no custom hooks yet (see Critical rule #10)
  lib/
    db/schema.ts              Drizzle schema — SINGLE SOURCE OF TRUTH for the data model (14 tables)
    db/index.ts               postgres-js client (HMR-cached, max 5, prepare:false for the pooler)
    supabase/{client,server,middleware,storage}.ts   browser / RSC / proxy clients + Storage helper
    auth.ts                   getAuthContext() (React.cache), requireAuth(), requireRole()
    constants.ts              HOA_ROLES, ROLE_HIERARCHY, REACTION_EMOJIS, presence timings
    validators.ts             Zod schemas — SINGLE SOURCE OF TRUTH for input validation
    settings.ts               getHouseSettings() + HOUSE_SETTING_DEFAULTS
    audit.ts                  logAudit() (best-effort) + AuditAction union
    get-url.ts                getURL() — origin resolver for auth email links
    utils.ts                  cn()
  types/index.ts              Inferred Drizzle types + ActionResult<T>
  proxy.ts                    Next.js 16 middleware entry (renamed from middleware.ts; exports `proxy`)
supabase/migrations/          0001_initial_schema.sql — PARTIAL & STALE (see § Known drift)
scripts/                      *.mjs ops/seed helpers (run via node)
```

---

## Data model

`src/lib/db/schema.ts` is the single source of truth — **14 tables, 5 enums**.
Every table has an `id uuid` PK; all but `house_settings` carry `createdAt`, and
about half also have `updatedAt`.

```
auth.users (Supabase Auth — external)
  │ 1:1  auth_user_id UNIQUE, ON DELETE CASCADE  (SQL-only FK; see Known drift)
  ▼
members ───────────────────── central identity.  role: elder|member|guest.  is_active (deactivation).  last_seen_at (presence)
  ├─ authors → posts (is_deleted, is_pinned, type text|photo|announcement, media_urls jsonb)
  │              ├─ comments   (CASCADE on post delete; is_deleted)
  │              └─ reactions  (CASCADE on post delete; UNIQUE post+member+emoji)
  ├─ authors → messages ─ belong to → channels (CASCADE on channel delete; slug UNIQUE; is_archived)
  │              └─ reply_to_id → messages (self-ref thread; SQL-only FK)
  ├─ creates → gatherings (is_cancelled + archived_at)
  │              └─ rsvps  (CASCADE on gathering delete; UNIQUE gathering+member; attending|maybe|not_attending)
  ├─ creates → albums (is_private)  └─ photos (CASCADE on album delete)
  ├─ creates/uses → access_codes (status active|used|revoked; max_uses/use_count/expires_at)
  ├─ actor → audit_logs (append-only; entity_type + entity_id polymorphic, no FK)
  └─ member_relationships (self-join family-tree edges: parent_id → child_id, both CASCADE; UNIQUE)

house_settings — standalone KV store (key UNIQUE → jsonb value). NOT a per-row entity.
```

> **Removed features — tables retained.** The **Family Tree** (`member_relationships`)
> and **The Archives** (`albums` + `photos`) were removed from the app surface *for
> now*; their tables and data are kept (currently unused) so both features can be
> restored from git history.

**Enums:** `member_role` (elder, member, guest) · `post_type` (text, photo,
announcement) · `rsvp_status` (attending, maybe, not_attending) · `channel_type`
(general, announcement, private) · `code_status` (active, used, revoked).

**Deletion is modeled per-table, never `deletedAt`:**

| Mechanism | Column | Tables |
|---|---|---|
| Boolean soft-delete | `isDeleted` | `posts`, `comments`, `messages` |
| Deactivation (lockout) | `isActive` | `members` — never hard-deleted |
| Cancel + archive | `isCancelled`, `archivedAt` | `gatherings` (distinct states) |
| Archive | `isArchived` | `channels` |
| Status | `status='revoked'` | `access_codes` |
| **Hard delete** (+ cascade) | — | `reactions`, `rsvps`, `member_relationships`, `albums` (album delete cascades `photos`) |

Member-as-author FKs (`posts.authorId`, etc.) have **no `onDelete`** → Postgres
default `NO ACTION`/RESTRICT. That's intentional: **members are deactivated
(`is_active = false`), never `DELETE`d**, so authored content is preserved.

---

## Domain vocabulary

Keep in-app copy consistent with these thematic names; the code identifier is the
real thing.

| Thematic name | What it is in code |
|---|---|
| **The House** | The single tenant / whole app. Identity in `house_settings` (`houseName`, `houseTagline`, `welcomeMessage`, `coverImageUrl`). |
| **The Great Hall** | The dashboard (`/dashboard`). |
| **The Wall** | The feed (`/feed`) — `posts` + `comments` + `reactions`. |
| **The Council** | Realtime chat (`/council`). |
| **Council Chambers / Chambers** | `channels` (the dashboard labels the count "Council Chambers"). |
| **The Elder Council** | The admin area (`/elder-council/*`), elder-gated. |
| **Initiation** | Onboarding via access code (`/initiation` → `profile` → `complete`). |
| **Access code** | `access_codes` — an invite an Elder mints; has `maxUses`, `useCount`, `expiresAt`. |
| **Gathering** | An event (`gatherings`); members **RSVP** (`rsvps`). |
| **Elder / Member / Guest** | The three roles (`member_role`, ranks 2/1/0). First-ever initiate becomes **Elder**. |

Nav labels live in `src/components/layout/nav-items.ts` (`NAV_ITEMS`, the single
source shared by sidebar + mobile header + bottom nav). "Elder Council" is appended
conditionally when `role === "elder"`, never in the bottom tab bar.

> The old landing copy "The gates are closed" is **gone** — the landing page now
> renders the dynamic `houseName` / `houseTagline`. (`HOUSE_SETTING_DEFAULTS`
> still defaults the tagline to "The gates are closed.\nOnly blood enters.")

---

## User roles & flows

### New member (initiation)
```
/sign-up (signUp, emailRedirectTo = getURL("/auth/confirm?next=/initiation"))
  ├─ session returned → push /initiation
  └─ no session → "Check your email" → click link
        → /auth/confirm (exchangeCodeForSession | verifyOtp) → /initiation
/initiation        → access-code-form → validateAccessCode() → stores code in sessionStorage
/initiation/profile→ profile-form (attaches accessCode) → completeInitiation() → creates member row
/initiation/complete → /dashboard
```
- `completeInitiation` writes `hoa_member_id` + `hoa_role` into **Supabase
  user_metadata** — that's what the proxy's membership gate reads (it never
  queries Postgres).
- The **first** member ever (empty `members` table) is inserted as `elder`;
  everyone after is `member`.
- `validateAccessCode` accepts the env `HOA_DEFAULT_ACCESS_CODE` (bootstrap) or an
  `active` code with remaining uses that hasn't expired.

### Elder (admin)
`/elder-council/*` — no shared layout guard; **each page** runs
`try { await requireRole("elder") } catch { redirect("/dashboard") }`. The Elder
Council nav link only renders for elders. Surfaces: access-codes (mint/revoke),
channels (create), members (roles + deactivate/reactivate), settings (House
identity), audit-log (last entries).

### Route protection (`src/proxy.ts`)
`updateSession()` refreshes the Supabase cookie on **every** matched request, then:
`isPublic` (`/`, `/sign-in`, `/sign-up`, `/auth/*`) → allow · no user → `/sign-in?next=…`
· authed but no `user_metadata.hoa_member_id` and not on `/initiation` → `/initiation`.
The `(house)/layout.tsx` is a **second** guard (`getAuthContext()` → `/initiation`)
that also catches deactivated members (`getAuthContext` requires `isActive`).

---

## Architecture rules

### Server Components by default
Pages are Server Components. Add `"use client"` only for interactivity (forms,
dialogs, realtime, event handlers, `next/navigation` hooks). `src/hooks/` is empty
today — put any new shared hook there rather than inlining a third copy.

### Server Actions for every mutation
There is **no REST API** (`api/webhooks/` is empty). Every write is a
`"use server"` action in `src/app/actions/` (one file per domain). The canonical
shape:

```ts
export async function doThing(formData: FormData): Promise<ActionResult<T>> {
  const ctx = await requireRole("elder");            // 1. AUTH first — THROWS on failure
  const parsed = someSchema.safeParse({ /* … */ });  // 2. VALIDATE (Zod)
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0].message };
  const target = await db.query.X.findFirst({ /* … */ });   // 3. SCOPE / existence / ownership
  if (!target) return { success: false, error: "Not found" };
  await db.insert(/* … */);                          // 4. MUTATE via Drizzle
  await logAudit({ actorId: ctx.memberId, action: "…" });   // 5. AUDIT (elder mutations, best-effort)
  revalidatePath("/feed");                           // 6. REVALIDATE affected routes
  return { success: true, data: { id } };            // 7. RETURN ActionResult
}
```

- **`ActionResult<T>`** (`src/types/index.ts`) is the contract:
  `{ success: true; data?: T } | { success: false; error: string }`. Actions
  **return** business errors; they don't throw for them.
- **Auth helpers throw.** `requireAuth()` / `requireRole(min)` (`src/lib/auth.ts`)
  throw `"Unauthorized"` / `"Insufficient permissions"`. `requireRole` is a
  *minimum-rank* gate (`ROLE_HIERARCHY[ctx.role] < ROLE_HIERARCHY[min]`), not
  equality. Don't wrap them in try/catch inside an action (let it surface); the
  `/elder-council/*` **pages** are the one place that catches → redirects.
- **`getAuthContext()`** (React-`cache`d) resolves `user → active member` and
  returns `{ userId, memberId, displayName, role, avatarUrl }` or `null`.
  Inactive members resolve to `null` (deactivation = lockout).
- **Owner-or-elder** is the recurring edit/delete gate:
  `if (row.ownerCol !== ctx.memberId && ctx.role !== "elder") return { success:false, error:"Not authorized" }`
  (used in `deletePost`, `deleteMessage`, `updateGathering`,
  `cancelGathering`).

### Zod is the single source of truth for input
All schemas in `src/lib/validators.ts`. Read errors via **`.issues[0].message`**
(Zod 4). The file is written in the legacy v3 method style (`z.string().url()`,
`.uuid()`, `.datetime()`) with **positional** custom messages — match that style
for consistency (or migrate the whole file, not one field).

### Revalidation vs. router.refresh()
A mutation must repaint the server-rendered data that shows it:
- Actions called from `<form action={…}>` or that `revalidatePath()` refresh
  automatically (the feed relies on this).
- A server action fired from an **`onClick`** does **not** auto-refresh the
  caller's RSC subtree — call `router.refresh()` after a successful result. See
  `gatherings/rsvp-button.tsx` (this was a real stale-count bug). The council
  instead updates via Realtime + local `setMessages`.

### Soft deletes and the `is_active` gate
Follow the per-table table above. Members are never hard-deleted. Any query that
lists "live" members must filter `isActive = true` (as `getAuthContext` and the
directory do) or it leaks deactivated members.

---

## Realtime, presence & storage

- **Realtime (Council).** `messages` + `channels` are added to the
  `supabase_realtime` publication by `node scripts/enable-realtime.mjs` (one-time;
  or the dashboard). `council/realtime-message-list.tsx` subscribes to
  `postgres_changes` on `messages` filtered by `channel_id`: **INSERT** (does a
  follow-up `members` query to hydrate the author, then appends with a `prev.some(id)`
  **dedup** guard because the action also revalidates), **UPDATE** (drops the row
  when `is_deleted`). RLS on `messages`/`channels` gates on an active member for
  `auth.uid()` — deactivated members lose realtime access immediately.
- **Presence** is **DB-poll based**, not Supabase Presence channels.
  `PresenceProvider` fires the `heartbeat()` action on mount + every
  `HEARTBEAT_INTERVAL_MS` (60 s), writing `members.lastSeenAt`. "Online" =
  `lastSeenAt >= now - PRESENCE_TIMEOUT_MS` (5 min). A closed tab drops silently
  after 5 min.
- **Storage.** `src/lib/supabase/storage.ts` — `uploadFile(bucket, path, file)`
  (browser-side, RLS applies) + `storagePath(memberId, fileName)`. Wired bucket:
  **`feed-media`** (post images). The **`archives`** bucket is retained but unused
  after the Archives feature was removed. Buckets must be
  created manually in the Supabase dashboard.

---

## Design tokens & theming

The whole palette is in `src/app/globals.css` — Tailwind **v4 CSS-first** (no
`tailwind.config`). All colors are **OKLCH** in a single `:root` block; there is no
`.dark {}` override (the app is dark-only because exactly one palette is defined).
`@theme inline` re-exports each `--foo` as a Tailwind `--color-foo`, which is what
mints `bg-background`, `text-primary`, `text-gold`, etc.

**Rules:**
- **Never hard-code a hex/rgb in a component.** Use semantic tokens: `--background`,
  `--card`, `--muted`, `--border`, `--primary` (orange-400), `--accent`,
  `--destructive`, and their `-foreground` pairs. The only literal hexes in the
  system are the Sonner `<Toaster>` swatches (a known exception).
- **Adding a color takes two coordinated edits:** define the OKLCH value in `:root`
  **and** map it in `@theme inline` as `--color-x: var(--x)` — otherwise the
  Tailwind class doesn't exist. Author in OKLCH with a `/* neutral-800 */`-style
  comment.
- **The gold→orange aliasing is deliberate — don't "fix" it.** `--gold` is
  byte-identical to `--primary`, `--crimson` to `--destructive`; `font-heading`
  collapses to bold Inter (`--font-serif` is aliased to `--font-sans`). ~220 legacy
  `text-gold`/`bg-gold`/`border-gold`/`font-heading` usages across ~44 files now
  render orange/Inter with zero churn. To globally shift the accent, change
  `--gold`'s value — do **not** find-and-replace `text-gold`.
- **Icons: Lucide React.** The *only* sanctioned emoji are the six-item
  `REACTION_EMOJIS` set (`constants.ts`); don't introduce emoji elsewhere in UI or
  copy.
- Adding light mode is real work (define a second palette block incl. the `--gold`
  aliases, add a theme switcher, make the Toaster swatches reactive) — don't do it
  incidentally.

---

## Critical rules

1. **First member is auto-Elder.** `completeInitiation` inserts `role: elder` when
   the `members` table is empty (count includes inactive rows). Do **not** seed
   `members` before the first real user, or you demote yourself. (`onboarding.ts`.)
2. **Two authz layers — keep both.** (a) Role/ownership gating in every server
   action/page (`requireRole` / owner-or-elder); the `DATABASE_URL` owner role
   bypasses RLS, so the app runs unaffected. (b) The Supabase **Data API is locked**
   (migration `0002`): every table has RLS enabled deny-by-default and grants
   revoked, so the browser publishable key can't reach tables directly — the only
   client reads are message-author name/avatar/role and Council `messages` (private
   chambers elder-only). **A NEW table is exposed until you keep it locked** (RLS on,
   no client grant), and any new client `supabase.from(...)` needs a matching policy.
   An unguarded server mutation is still a privilege-escalation bug.
3. **`schema.ts` is the data-model source of truth — the migration SQL is stale.**
   `supabase/migrations/0001_initial_schema.sql` is missing `member_relationships`,
   `audit_logs`, and `gatherings.archived_at` (all added later via `drizzle-kit
   push`), yet is the **only** place two integrity rules and RLS/seeds live (the
   `auth.users→members` and `messages.reply_to_id→messages` FKs, which `schema.ts`
   omits). A clean rebuild needs **both** the SQL file *and* `db:push`. Don't trust
   the SQL for the table list; don't trust `schema.ts` for those two FKs. (See
   § Known drift.)
4. **Zod errors:** read `.issues[0].message` (Zod 4), not `.errors`.
5. **Membership gate reads user_metadata.** `proxy.ts` decides "is this a member"
   from `user.user_metadata.hoa_member_id`, set in `completeInitiation`. If you
   change how membership is established, update **both** the metadata write and the
   proxy read, or users get stuck in an initiation loop.
6. **The proxy must run on every request.** `src/proxy.ts` (renamed from
   `middleware.ts` in Next 16; export is `proxy`) calls `updateSession()` to
   refresh the session cookie. Skip it and access tokens expire silently → Server
   Components see "no user". Don't reintroduce `src/middleware.ts`.
7. **Shared files — coordinate before editing:** `schema.ts`, `validators.ts`,
   `proxy.ts`, `src/lib/supabase/middleware.ts`, `constants.ts`, `layout.tsx`,
   `globals.css`. Changes here ripple across the app.
8. **`onClick` server actions need `router.refresh()`.** Otherwise the RSC subtree
   serves stale data after the mutation (Architecture rules § Revalidation).
9. **Base UI, not Radix.** UI primitives import from `@base-ui/react/*`
   (`@base-ui-components/react` returns zero hits). `Sheet` is a Dialog styled as a
   slide-in. Don't edit `components/ui/*` directly — reuse or compose.
10. **No custom-hook home yet.** `src/hooks/` is empty; the first shared hook you
    extract goes there rather than becoming a fourth inline copy of a pattern.

---

## Coding conventions

| Element | Convention | Example |
|---|---|---|
| Files | kebab-case | `rsvp-button.tsx` |
| Components | PascalCase | `RsvpButton` |
| Functions / vars | camelCase | `getAuthContext` |
| DB tables / columns | snake_case (Drizzle maps to camelCase in TS) | `member_relationships`, `last_seen_at` |
| Enum values | snake_case | `not_attending` |
| Server actions | verb-first, `FormData`-in where it's a form; `ActionResult` out | `createGathering(formData)` |
| Access codes | stored/compared **uppercase** (`.trim().toUpperCase()`) | `AHMAR2024` |

**Ubiquitous language:** use the § Domain vocabulary names in UI copy (Great Hall,
Council, Chambers, Initiation, Gathering). In code, use the real
identifiers (`dashboard`, `channels`, `gatherings`). Roles are `elder`/`member`/
`guest` everywhere.

---

## Engineering principles & anti-patterns

- **Keep logic out of components.** Business rules (role checks, settings defaults,
  the audit lifecycle) live in `src/app/actions/` and
  `src/lib/`, unit-tested where pure. A component renders state and dispatches
  actions.
- **One source of truth per concept.** Roles live in `constants.ts`; input shapes
  in `validators.ts`; the data model in `schema.ts`; nav in `nav-items.ts`; House
  identity in `house_settings`. Before adding a constant/map, grep for the existing
  one. (Known duplication to *not* extend: `POST_TYPES`/`CHANNEL_TYPES`/
  `RSVP_STATUSES` are re-hardcoded as `z.enum([...])` in `validators.ts` instead of
  derived from `constants.ts` — keep them in sync if you touch either.)
- **Validate at the boundary, always.** Some current actions cut corners — codify
  the *right* pattern, and fix these when you touch them: `feed.addComment` reads
  `postId` from `FormData` with only a presence check; `feed.toggleReaction`
  accepts an arbitrary `emoji` string (not checked against `REACTION_EMOJIS`);
  `createAccessCodeSchema.expiresInDays` is validated but never
  applied (`createAccessCode` never sets `expiresAt`).
- **Audit every elder mutation.** `logAudit()` (best-effort, never throws) is
  wired into role/deactivate/reactivate, code create/revoke, channel create,
  settings update, gathering cancel/archive. New
  elder-only mutations should log too.
- **Mobile-first.** Verify UI at ~375px. The `(house)` shell has three separate
  chrome components (sidebar / mobile header / bottom nav) driven by one
  `NAV_ITEMS` — keep them consistent.

---

## Testing

- **Vitest** (`vitest.config.mts`, `.mts` on purpose, `@/` alias, node env). Specs
  are `src/**/*.test.ts`. Today: `src/lib/validators.test.ts` — **29 tests** across
  the Zod schemas (pass + reject paths).
- **Gaps worth closing when you touch the area** (not yet covered): server actions
  (mock the Drizzle chain + `getAuthContext`, assert success *and* the auth/owner
  branches), the presence/settings readers, and any real E2E (there is no
  Playwright / CI yet).
- **Gate before commit:** `npx tsc --noEmit` (fast, offline) + `npm test`. Run the
  tests you write — green locally, not "should pass".

---

## Git workflow

- Remote `origin` → `github.com/jahmar-code/house-of-ahmar`; default branch
  `master`. History is short and informal (`bb02dfb "opus revamp"`); the "Pass 1–8"
  work in `BUILD_STATUS.md` was squashed into a handful of commits.
- **Branch for non-trivial work** rather than committing straight to `master`.
- **Commit/push only when asked.** There is no CI, so run `tsc --noEmit` + `npm
  test` yourself before pushing.
- **Current working tree (uncommitted WIP):** the auth email-confirmation fix —
  `src/lib/get-url.ts` + `src/app/auth/confirm/route.ts` (new), `sign-up-form`
  (`emailRedirectTo`), `sign-in-form` (shows `?error=confirmation_failed`), and a
  `card.tsx`/button polish (border instead of ring, `rounded-lg`, de-golded
  submit buttons). Plus this `agents/` + `CLAUDE.md` addition. It typechecks
  clean; it is not yet committed.

---

## Known drift (source vs. docs — verified against code)

Treat these as the current truth; the older docs lag.

1. **Table count.** `schema.ts` has **14** tables; the migration SQL has 12;
   `BUILD_STATUS.md` says "15" in places. Trust `schema.ts` (Critical rule #3).
2. **Migration SQL is a partial snapshot.** Missing `member_relationships`,
   `audit_logs`, `gatherings.archived_at`. But it holds the only copies of the
   `auth.users→members` and `messages.reply_to_id→messages` FKs, the `messages`/
   `channels` RLS policies, and the 3 seeded channels. Rebuild = SQL file + `db:push`.
3. **`avatars` bucket is not wired.** `BUILD_STATUS.md` lists three Storage buckets;
   only `archives` and `feed-media` are ever passed to `uploadFile`. Avatar upload
   is unimplemented (avatars are read from `member.avatarUrl` only).
4. **Two council message lists coexist.** `realtime-message-list.tsx` is the wired
   one; `message-list.tsx` (static, no subscription) appears superseded — confirm
   before extending it.
5. **`README.md` is stale create-next-app boilerplate** — it does not describe this
   app. Real run docs are `BUILD_STATUS.md §7` and `SUPABASE_MIGRATION.md §3` (both
   also partly stale; this file supersedes them where they conflict).
6. **Clerk is fully gone.** Auth is Supabase; the old Clerk delete-webhook was
   replaced by the `auth.users→members` CASCADE. Any "Clerk" mention in docs is
   historical.
