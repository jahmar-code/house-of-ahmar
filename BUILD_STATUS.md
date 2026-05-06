# House of Ahmar — Build Status

_Generated: 2026-04-11 | Updated: 2026-05-06 (Pass 8 — theme refresh)_

This document tracks the full state of the House of Ahmar codebase against the
design in `~/Desktop/docs/HOA_docs/`. It is the single source of truth for
"what's done, what's not, and what you need to do to ship it."

---

## Executive summary

- **Scaffold:** complete. Clean `tsc --noEmit` (exit 0), `npm run lint` (0
  errors), `npm run build` (exit 0, 22 routes), `npx vitest run` (29 / 29
  passing).
- **Auth:** Supabase Auth via `@supabase/ssr`. Session refresh runs in the
  Next 16 proxy (`src/proxy.ts`).
- **Phases 1–4:** feature-complete and live-tested end-to-end (sign up →
  initiate → post → RSVP → council reply → photo lightbox → admin actions).
- **Pass-5 hardening:** house cover image rendered, env access code persisted
  to `access_codes`, audit log table + viewer, on-demand past-gathering
  archival, Next 16 proxy migration, Vitest installed with first test suite.
- **Pass-6 Family Tree:** `member_relationships` table (parent→child edges),
  interactive tree visualization, elder-only relationship editor, remove
  relationship button. Linked in sidebar + mobile nav.
- **Pass-7 E2E + bug fixes:** every flow exercised end-to-end with two real
  accounts (sign-up → initiation with minted code → feed/post/comment/react/
  pin/announce → gathering create+edit+RSVP+cancel → council channels +
  threaded replies → archives album+upload+lightbox → members directory +
  profile → family tree add/remove → elder admin codes/members/settings/
  audit log/channels). Two bugs found and fixed: RSVP count not refreshing
  without manual reload, and family tree clipping descendants on first
  render. **MVP "Definition of Done" smoke test is now ✅.**
- **Pass-8 theme refresh:** swapped the gold-on-charcoal "secret society"
  theme for the minimal neutral-gray + orange-400 palette and Inter
  typography of `jawaadahmar.com`. Achieved by re-aliasing the CSS
  variables (`--gold`, `--primary`, `--font-serif`, etc.) so the existing
  `text-gold` / `bg-gold` / `font-heading` utilities resolve to the new
  palette without component edits.
- **Blocker to running locally:** none. Storage buckets ✅, Realtime on
  `messages` + `channels` ✅ (via `node scripts/enable-realtime.mjs`).
  Email-confirm toggle is optional dev convenience.

---

## 1. Tech stack (as built)

| Layer       | Choice                                | Status |
|-------------|---------------------------------------|--------|
| Framework   | Next.js 16.1.6 (App Router, Turbopack)| OK     |
| Language    | TypeScript 5                          | OK     |
| Styling     | Tailwind v4 + shadcn/ui (Base UI)     | OK     |
| Auth        | Supabase Auth (`@supabase/ssr`)       | OK     |
| DB          | Supabase Postgres                     | OK     |
| ORM         | Drizzle `0.45.x`                      | OK     |
| Storage     | Supabase Storage (Phase 4)            | OK — upload helper + UI wired |
| Realtime    | Supabase Realtime (Phase 3)           | OK — Council messages stream live |
| Validation  | Zod 4                                 | OK     |
| Forms       | React Hook Form                       | installed |
| Toasts      | Sonner                                | OK     |
| Tests       | Vitest 4                              | OK — 29 passing (validators) |

`package.json` confirmed — all dependencies installed.

---

## 2. File inventory

### `src/app/` — routes
```
app/
├── page.tsx                          ✓ landing ("gates are closed")
├── layout.tsx                        ✓ fonts, Toaster (no ClerkProvider)
├── globals.css                       ✓ HOA dark palette + gold utilities
├── not-found.tsx                     ✓ 404
├── sign-in/page.tsx + sign-in-form   ✓ Supabase email+password
├── sign-up/page.tsx + sign-up-form   ✓ Supabase email+password
│
├── initiation/
│   ├── page.tsx                      ✓ access-code gate
│   ├── access-code-form.tsx          ✓ client form
│   ├── profile/page.tsx              ✓ profile setup wrapper
│   ├── profile/profile-form.tsx      ✓ client form (name/bio/birthday/phone)
│   └── complete/page.tsx             ✓ "welcome to the house" success
│
├── (house)/                          — protected shell
│   ├── layout.tsx                    ✓ sidebar + mobile nav + presence
│   ├── dashboard/page.tsx            ✓ stats + online + birthdays + gatherings + posts
│   ├── feed/page.tsx                 ✓ posts list w/ comments + reactions
│   ├── gatherings/
│   │   ├── page.tsx                  ✓ upcoming + past lists
│   │   ├── new/page.tsx              ✓ create form
│   │   └── [id]/page.tsx             ✓ detail + RSVPs + attendees
│   ├── council/
│   │   ├── page.tsx                  ✓ channel list
│   │   └── [channelId]/page.tsx      ✓ messages + input (non-realtime)
│   ├── archives/
│   │   ├── page.tsx                  ✓ album grid + CreateAlbumDialog (new)
│   │   └── [albumId]/page.tsx        ✓ photo grid + UploadPhotoDialog (new)
│   ├── family/
│   │   └── page.tsx                  ✓ family tree visualization + relationship editor
│   ├── members/
│   │   ├── page.tsx                  ✓ directory w/ online indicators
│   │   └── [id]/page.tsx             ✓ member profile
│   └── elder-council/
│       ├── page.tsx                  ✓ admin home (5 cards: members, codes, channels, settings, audit)
│       ├── members/page.tsx          ✓ management
│       ├── members/member-management.tsx ✓ client dropdown (roles, deactivate)
│       ├── access-codes/page.tsx     ✓ list + RevokeButton (new)
│       ├── access-codes/create-code-form.tsx ✓
│       ├── access-codes/revoke-button.tsx    ✓ (new)
│       ├── channels/page.tsx                 ✓ (new — channel management)
│       ├── channels/create-channel-form.tsx  ✓ (new)
│       ├── settings/page.tsx                 ✓ house name/tagline/welcome/cover image
│       └── settings/settings-form.tsx       ✓ client form with toast feedback
│
├── actions/
│   ├── onboarding.ts                 ✓ validateAccessCode, completeInitiation
│   ├── feed.ts                       ✓ createPost, deletePost, addComment, toggleReaction
│   ├── gatherings.ts                 ✓ createGathering, updateRsvp, cancelGathering
│   ├── council.ts                    ✓ sendMessage, deleteMessage, createChannel
│   ├── members.ts                    ✓ updateProfile, updateMemberRole, deactivateMember
│   ├── admin.ts                      ✓ createAccessCode, revokeAccessCode (new)
│   ├── archives.ts                   ✓ createAlbum, uploadPhoto, deleteAlbum (new)
│   ├── family.ts                     ✓ addRelationship, removeRelationship
│   ├── settings.ts                   ✓ updateHouseSettings (elder-only)
│   └── presence.ts                   ✓ heartbeat
│
└── api/                              (Clerk webhook deleted — CASCADE handles it)
```

### `src/components/`
```
components/
├── ui/                               ✓ 15 shadcn primitives (Base UI flavor)
├── layout/
│   ├── house-sidebar.tsx             ✓ desktop sidebar (hides elder link for non-elders)
│   ├── mobile-nav.tsx                ✓ bottom tab bar
│   └── presence-provider.tsx         ✓ heartbeat on mount + 60s interval
├── shared/
│   ├── page-header.tsx               ✓
│   └── empty-state.tsx               ✓
├── dashboard/
│   ├── stats-card.tsx                ✓
│   ├── online-members.tsx            ✓
│   ├── upcoming-gatherings.tsx       ✓
│   ├── recent-posts.tsx              ✓
│   └── upcoming-birthdays.tsx        ✓ (handles year rollover)
├── feed/
│   ├── post-form.tsx                 ✓ text + multi-image upload via Storage
│   └── post-card.tsx                 ✓ reactions + inline comments + media grid
├── gatherings/
│   ├── gathering-card.tsx            ✓ with attendee avatars
│   └── rsvp-button.tsx               ✓
├── council/
│   ├── channel-list.tsx              ✓
│   ├── message-list.tsx              ✓ static fallback
│   ├── realtime-message-list.tsx     ✓ live via Supabase Realtime (new)
│   └── message-input.tsx             ✓
├── members/
│   └── member-grid.tsx               ✓
├── archives/
│   ├── create-album-dialog.tsx       ✓
│   └── upload-photo-dialog.tsx       ✓ file upload + URL mode
└── family/
    ├── family-tree.tsx               ✓ interactive tree layout (eldest right, descendants left)
    ├── relationship-editor.tsx       ✓ elder-only dialog to add parent→child edges
    └── remove-relationship-button.tsx ✓ delete edge with confirmation
```

### `src/lib/`
```
lib/
├── auth.ts            ✓ getAuthContext() cached, requireAuth, requireRole
├── constants.ts       ✓ roles, role hierarchy, emoji set, presence timings
├── family-tree.ts     ✓ tree layout algorithm (generational ordering)
├── validators.ts      ✓ Zod schemas for all user input
├── utils.ts           ✓ cn()
├── db/
│   ├── schema.ts      ✓ 14 tables, enums, relations, indexes
│   └── index.ts       ✓ Drizzle client via postgres-js
└── supabase/
    ├── client.ts      ✓ browser client factory
    ├── server.ts      ✓ SSR server client factory
    ├── middleware.ts   ✓ session refresh helper for edge middleware
    └── storage.ts     ✓ uploadFile() + storagePath() for Storage buckets
```

### `src/types/index.ts`
Inferred select/insert types for every table + `ActionResult<T>` discriminated
union.

### `supabase/migrations/0001_initial_schema.sql`
Full DDL for 15 tables + enums + indexes + seed channels + RLS on
`messages` / `channels` (the only tables Supabase Realtime will touch).
Includes `member_relationships` (parent→child edges for the family tree).

---

## 3. What I changed in this pass

| File                                                                 | Change                                           |
|----------------------------------------------------------------------|--------------------------------------------------|
| `src/middleware.ts`                                                  | Read both `publicMetadata` and `metadata` session claim paths so middleware works whether or not a custom Clerk JWT template is set. |
| `src/app/actions/council.ts`                                         | Removed duplicated `requireRole("elder")` in `createChannel`. |
| `src/app/actions/admin.ts`                                           | Added `revokeAccessCode` + `eq` import. |
| `src/app/actions/archives.ts` _(new)_                                | `createAlbum`, `uploadPhoto`, `deleteAlbum` with Zod validation. |
| `src/components/archives/create-album-dialog.tsx` _(new)_            | Dialog-based album creation. |
| `src/components/archives/upload-photo-dialog.tsx` _(new)_            | URL-based photo add (file upload TBD — see §5). |
| `src/app/(house)/archives/page.tsx`                                  | Wired `CreateAlbumDialog` into page header for non-guests. |
| `src/app/(house)/archives/[albumId]/page.tsx`                        | Wired `UploadPhotoDialog`. |
| `src/app/(house)/elder-council/access-codes/revoke-button.tsx` _(new)_ | Client revoke action with confirm. |
| `src/app/(house)/elder-council/access-codes/page.tsx`                | Shows `RevokeButton` on active codes. |
| `src/app/(house)/elder-council/channels/page.tsx` _(new)_            | List + manage channels (elders only). |
| `src/app/(house)/elder-council/channels/create-channel-form.tsx` _(new)_ | Create chamber form. |
| `src/app/(house)/elder-council/page.tsx`                             | Added "Council Chambers" admin card. |

After all changes: `npx tsc --noEmit` → **Exit 0**.

### Pass 3 (2026-04-18): Supabase auth complete, realtime + storage wired

| File | Change |
|------|--------|
| Auth migration | Full Clerk → Supabase Auth migration. See `SUPABASE_MIGRATION.md`. |
| `src/components/council/realtime-message-list.tsx` _(new)_ | Client component with Supabase Realtime subscription for live messages. Handles INSERT (new messages) and UPDATE (soft-deletes). |
| `src/app/(house)/council/[channelId]/page.tsx` | Swapped static `MessageList` for `RealtimeMessageList`. |
| `src/lib/supabase/storage.ts` _(new)_ | `uploadFile()` — uploads to a Storage bucket from the browser. `storagePath()` — generates unique paths. |
| `src/components/archives/upload-photo-dialog.tsx` | Added file upload mode alongside URL mode. Toggle between "Upload File" and "Paste URL". Image preview. |
| `src/components/feed/post-form.tsx` | Added multi-image attachment. Files upload to `feed-media` bucket. Preview thumbnails with remove. |
| `src/components/feed/post-card.tsx` | Renders `mediaUrls` as an image grid (1-col for single, 2-col for multiple). |
| `src/app/actions/feed.ts` | `createPost` now parses `mediaUrls` from JSON in FormData. |
| `src/app/(house)/feed/page.tsx` | Passes `memberId` to `PostForm`. |
| `src/app/(house)/archives/[albumId]/page.tsx` | Passes `memberId` to `UploadPhotoDialog`. |

After all changes: `npx tsc --noEmit` → **Exit 0**.

### Pass 4 (2026-04-19): P2 polish — settings, edit, threading, pin/announce, reactivation, lightbox

| File | Change |
|------|--------|
| `src/lib/settings.ts` _(new)_ | `getHouseSettings()` cached reader with key/value defaults (`houseName`, `houseTagline`, `welcomeMessage`, `coverImageUrl`). |
| `src/lib/validators.ts` | Added `houseSettingsSchema` (Zod). |
| `src/app/actions/settings.ts` _(new)_ | `updateHouseSettings` — elder-only, batched upsert against `house_settings` via `onConflictDoUpdate`. |
| `src/app/(house)/elder-council/settings/page.tsx` | Replaced stub with real settings page (server fetch + form). |
| `src/app/(house)/elder-council/settings/settings-form.tsx` _(new)_ | Client form with name/tagline/welcome/cover-image fields and toast feedback. |
| `src/app/(house)/layout.tsx` | Loads house settings; passes `houseName` to sidebar. |
| `src/components/layout/house-sidebar.tsx` | Accepts `houseName` prop; renders dynamic name in logo header. |
| `src/app/page.tsx` | Landing page renders dynamic title + tagline (preserves newlines). |
| `src/app/(house)/dashboard/page.tsx` | Dashboard description uses `welcomeMessage` (or fallback). |
| `src/app/actions/gatherings.ts` | Added `updateGathering` (creator-or-elder gated). |
| `src/components/gatherings/gathering-form.tsx` _(new)_ | Shared form for create + edit. Converts `datetime-local` to ISO before submit and back to local on prefill. |
| `src/app/(house)/gatherings/new/page.tsx` | Refactored to use shared form. |
| `src/app/(house)/gatherings/[id]/edit/page.tsx` _(new)_ | Edit page with auth guard. |
| `src/components/gatherings/gathering-actions.tsx` _(new)_ | Dropdown with Edit + Cancel; confirm before cancel. |
| `src/app/(house)/gatherings/[id]/page.tsx` | Renders manage actions for creator/elder, plus a "Cancelled" notice banner. |
| `src/components/council/council-channel.tsx` _(new)_ | Wrapper holding reply state, lifts it between message list and input. |
| `src/components/council/realtime-message-list.tsx` | Renders reply context inline (`↳ replying to X: 'preview'`); per-message Reply + Delete hover actions. |
| `src/components/council/message-input.tsx` | Reply preview chip above input, Esc to cancel, sends `replyToId` in form data. |
| `src/app/(house)/council/[channelId]/page.tsx` | Replaces separate list+input with `CouncilChannel` wrapper. |
| `src/app/actions/feed.ts` | Added `togglePostPin` (elder-only). |
| `src/components/feed/post-form.tsx` | Adds elder-only Post / Announcement toggle. Type precedence: announcement > photo > text. Card gets gold ring in announcement mode. |
| `src/app/(house)/feed/page.tsx` | Passes `role` to `PostForm`. |
| `src/components/feed/post-card.tsx` | Pin / Unpin button for elders. Pinned + announcement render as gold badges; announcement card gets gold ring. |
| `src/app/actions/members.ts` | Added `reactivateMember`. |
| `src/app/(house)/elder-council/members/member-management.tsx` | Inactive members now expose a "Reactivate" menu item; active members keep role + deactivate options. |
| `src/components/archives/photo-lightbox.tsx` _(new)_ | Click-to-zoom modal with prev/next, keyboard navigation (←/→/Esc), body-scroll lock, caption + uploader credit. |
| `src/app/(house)/archives/[albumId]/page.tsx` | Wires `PhotoLightbox` in place of static grid. |

After all changes: `npx tsc --noEmit` → **Exit 0**.

### Pass 5 (2026-04-19): cover image, audit log, archival, proxy, vitest, env loaders

| File | Change |
|------|--------|
| `drizzle.config.ts` | Loads `.env.local` via `dotenv` so `npx drizzle-kit push` works. Throws if `DATABASE_URL` missing. |
| `package.json` | Added `db:generate`, `db:push`, `db:studio`, `test`, `test:watch` scripts. Added `vitest`, `@vitest/ui` devDeps. |
| `vitest.config.mts` _(new)_ | Vitest config (node env, `@/` alias). Uses `.mts` so the project's CJS package.json doesn't break Vitest's ESM imports. |
| `src/lib/validators.test.ts` _(new)_ | 29 unit tests across all Zod schemas (parse pass + reject paths). |
| `src/app/page.tsx` | Renders `coverImageUrl` as a darkened bg layer with a fade-to-background overlay. |
| `src/app/actions/onboarding.ts` | `validateAccessCode` now `INSERT … ON CONFLICT DO NOTHING`s the env code into `access_codes` (label "Bootstrap (env)", maxUses 1000) so its uses are tracked alongside other codes. |
| `src/lib/db/schema.ts` | Added `audit_logs` table (actorId, action, entityType, entityId, metadata jsonb) + 3 indexes + relation. Added `archived_at` to `gatherings` + index. |
| `src/lib/audit.ts` _(new)_ | `logAudit({...})` helper; best-effort write that never throws. Typed `AuditAction` union. |
| `src/app/actions/members.ts` | `updateMemberRole` / `deactivateMember` / `reactivateMember` now call `logAudit` with from/to + displayName metadata. |
| `src/app/actions/admin.ts` | `createAccessCode` / `revokeAccessCode` log creation/revocation with code label + max uses. |
| `src/app/actions/council.ts` | `createChannel` logs name + slug + type. |
| `src/app/actions/settings.ts` | `updateHouseSettings` logs which keys changed. |
| `src/app/actions/gatherings.ts` | `cancelGathering` logs title. New `archivePastGatherings(thresholdDays = 7)` — elder-only, sets `archivedAt` on past gatherings, logs the count. |
| `src/app/(house)/gatherings/page.tsx` | Filters `archivedAt IS NULL`. Renders `<ArchivePastButton />` for elders. |
| `src/components/gatherings/archive-past-button.tsx` _(new)_ | Confirms then calls `archivePastGatherings`; toasts the count. |
| `src/app/(house)/elder-council/audit-log/page.tsx` _(new)_ | Reads last 200 entries. Friendly action labels + per-action metadata summarizers. |
| `src/app/(house)/elder-council/page.tsx` | Adds Audit Log card to admin home. |
| `src/proxy.ts` _(new)_ | Renamed from `src/middleware.ts`. Same matcher + auth guard, exported as `proxy`. Removes Next 16 deprecation warning. |
| `src/middleware.ts` _(removed)_ | — |
| `scripts/confirm-test-user.mjs`, `scripts/seed-channels.mjs`, `scripts/seed-test-member.mjs`, `scripts/seed-album.mjs`, `scripts/seed-past-gathering.mjs`, `scripts/check-messages.mjs` _(new)_ | Repeatable test fixtures used during the live E2E. |

After all changes: `npx tsc --noEmit` → **Exit 0**, `npm run lint` → **0 errors**, `npm run build` → **Exit 0** (22 routes, no proxy/middleware deprecation warning), `npx vitest run` → **29 / 29 passing**.

### Pass 6 (2026-04-19): Family Tree

| File | Change |
|------|--------|
| `src/lib/db/schema.ts` | Added `memberRelationships` table (parent→child edges with unique constraint + cascade deletes). |
| `src/lib/family-tree.ts` _(new)_ | Tree layout algorithm — assigns generational layers, positions nodes for rendering. |
| `src/app/actions/family.ts` _(new)_ | `addRelationship` (elder-only, validates no duplicate/self-link), `removeRelationship` (elder-only). |
| `src/app/(house)/family/page.tsx` _(new)_ | Server page fetches all members + edges, renders `FamilyTree` + elder-only `RelationshipEditor`. |
| `src/components/family/family-tree.tsx` _(new)_ | Interactive tree visualization — eldest on the right, descendants spread left. Highlights current user. |
| `src/components/family/relationship-editor.tsx` _(new)_ | Dialog for elders to add parent→child relationships between members. |
| `src/components/family/remove-relationship-button.tsx` _(new)_ | Confirmation-gated edge removal. |
| `src/components/layout/house-sidebar.tsx` | Added "Family" nav link. |
| `src/components/layout/mobile-nav.tsx` | Added "Family" tab. |

After all changes: `npx tsc --noEmit` → **Exit 0**, `npx vitest run` → **29 / 29 passing**.

### Pass 7 (2026-05-06): full E2E test + two bug fixes

Exercised every P0 user flow against the running app with two real accounts
(`e2e-elder@hotseat.dev` as the founding Elder and `e2e-new-member@hotseat.dev`
brought in via a minted access code). All 11 flows passed; two bugs surfaced
during testing and were fixed in the same pass.

| File | Change |
|------|--------|
| `src/components/gatherings/rsvp-button.tsx` | **Bug fix:** added `useRouter` + `router.refresh()` after a successful `updateRsvp` server-action response so the attendee count + RSVP-list re-render without a manual reload. Root cause: `revalidatePath` only auto-refreshes the router for `<form action=…>` calls, not server actions invoked from `onClick`. |
| `src/components/family/family-tree.tsx` | **Bug fix:** added `useRef` + `useEffect` to scroll the RTL tree container on mount. If `focusMemberId` resolves to a node, the card is centred horizontally; otherwise the container scrolls to the leftmost extent so descendants aren't clipped behind the right edge (where `dir="rtl"` parks `scrollLeft = 0`). |

**E2E flows verified (11 / 11 ✅):**

1. Sign-up & onboarding
2. Initiation (access code → profile → complete)
3. Dashboard & presence (online indicator, birthdays widget)
4. Feed (post, comment, react, pin, announce, image attach)
5. Gatherings (create, edit, RSVP, cancel)
6. Council (channels, messages, threaded replies, realtime)
7. Archives (album create, photo upload, lightbox keyboard nav)
8. Members directory & profile pages
9. Family tree (add/remove relationships, focus highlighting, multi-gen scroll)
10. Elder Council admin (codes mint+revoke, member roles + deactivate +
    reactivate, settings, audit log, channel management)
11. Second-user initiation with a minted code (full new-member flow)

**Test data cleaned up after the pass:**

- `e2e-new-member@hotseat.dev` deactivated (still exists in `auth.users` and
  `members` for re-test purposes; `is_active=false` so they're hidden from
  the directory).
- E2E Test Chamber channel deleted.
- E2E RSVP Test Gathering deleted.
- Test relationship (E2E Elder → New E2E Member) removed.

**Auxiliary discovery (spawned as a background task):** the
`/elder-council/channels` admin page renders an `is_archived` badge but
exposes no UI to set it. A follow-up session has been queued to add an
archive/delete control. Tracked in §5 P1.

### Pass 8 (2026-05-06): theme refresh — match jawaadahmar.com landing page

Replaced the original "secret society" gold-on-charcoal theme with the
minimal neutral-gray + orange aesthetic of the personal landing page at
`jawaadahmar.com` (source: `~/Desktop/dev/landing-pagev2`).

**Approach:** re-aliased the existing CSS variables in `globals.css` rather
than rewriting components. Every legacy `text-gold` / `bg-gold` /
`border-gold` / `font-heading` utility (43 component files, ~220 usages)
now resolves to the new palette automatically — zero component churn.

| File | Change |
|------|--------|
| `src/app/globals.css` | Repointed every `--*` token to the landing-page palette: background `#0a0a0a` (neutral-950), foreground `~#ededed`, card / muted neutral-900, borders neutral-800, primary + ring + `--gold` alias all map to `oklch(0.75 0.183 55.934)` (Tailwind orange-400), `--crimson` to red-500. `--font-serif` aliased to `var(--font-sans)` so `font-heading` collapses to Inter without a separate font load. `glow-gold` softened to a faint orange ring; `gradient-gold` becomes orange-700 → orange-400. |
| `src/app/layout.tsx` | Removed Cormorant Garamond serif. Body font is now Inter (matches the landing page). Toaster swatches updated to `#0a0a0a / #262626 / #ededed`. Inline style sets `--font-serif: var(--font-sans)` so `font-heading` always renders even without an explicit serif family. |

After all changes: `npx tsc --noEmit` → **Exit 0**. Manual visual pass on
dashboard, feed, family tree, and council confirmed the orange accent reads
correctly on every previously-gold surface (badges, focus rings, primary
buttons, mobile nav active state, avatar initials, "elder" badge).

**Future polish (not blocking):**
- The current implementation is dark-only (`<html className="dark">` is
  hardcoded in the root layout). The landing page also supports light
  mode via `prefers-color-scheme`. If light-mode parity is desired,
  remove the hardcoded `dark` class and add a `:root:not(.dark)` block
  with the white-background palette in `globals.css`.
- A handful of components reference colour names directly (`text-emerald-400`
  for the online indicator, `bg-amber-500/20` in RSVP buttons). These read
  fine against the new neutrals but a sweep could unify them under the
  new accent palette if desired.

---

## 4. Validated against the roadmap

### Phase 1: Foundation
- [x] Project scaffolding (Next.js, Drizzle, Clerk, Supabase, shadcn/ui)
- [x] Theme: dark charcoal + gold, serif + sans
- [x] DB tables: members, access_codes, house_settings
- [x] Clerk middleware + initiation redirect
- [x] Landing: "The gates are closed."
- [x] Initiation: code → profile → complete
- [x] `(house)` layout with sidebar + mobile nav
- [x] Dashboard ("Great Hall") with stats
- [x] Members directory with online indicators
- [x] Presence heartbeat (1 min interval, 5 min online window)

### Phase 2: Feed + Gatherings
- [x] DB: posts, comments, reactions, gatherings, rsvps
- [x] Feed page with post creation
- [x] Comments + reactions (toggle, unique index)
- [x] Gatherings CRUD + RSVP system
- [x] Dashboard widgets: upcoming gatherings, recent posts, birthdays
- [x] **Media upload on posts** — `PostForm` supports multi-image attach via
      Supabase Storage. `PostCard` renders media grid.

### Phase 3: Council (Real-time)
- [x] DB: channels, messages
- [x] Channel list + message list + message input
- [x] Seed default channels (General, Announcements, Elders Only)
- [x] Channel creation UI
- [x] RLS policies on `messages` / `channels` in the initial migration
- [x] **Supabase Realtime subscription** — `RealtimeMessageList` subscribes
      to postgres_changes on INSERT/UPDATE, streams messages live, handles
      soft-deletes in real time.
- [x] **Supabase Auth integration** — migrated from Clerk. RLS uses
      `auth.uid()` natively. No JWT template needed.
- [x] **Reply threading UI** — `CouncilChannel` lifts reply state; messages
      render an inline reply context line; input shows a reply chip.

### Phase 4: Archives + Elder Council
- [x] DB: albums, photos
- [x] Album list + detail pages
- [x] Album CRUD (added in this pass)
- [x] Photo add via URL (added in this pass)
- [x] Elder Council admin home
- [x] Elder Council: members management (roles + deactivate)
- [x] Elder Council: access codes (create + revoke now)
- [x] Elder Council: channels management (added in this pass)
- [x] **Supabase Storage uploads** — `src/lib/supabase/storage.ts` provides
      `uploadFile()` + `storagePath()`. Wired into `UploadPhotoDialog` (file
      or URL) and `PostForm` (multi-image attach). Buckets needed: `archives`,
      `feed-media`, `avatars`.
- [x] **Lightbox viewer** — `PhotoLightbox` modal with prev/next + keyboard
      shortcuts wired into the album page.
- [x] **Audit logging** — `audit_logs` table + `logAudit()` helper; wired into
      members, access codes, channels, settings, and gathering actions.
      Viewer at `/elder-council/audit-log`.
- [x] **House Settings page** — house name, tagline, welcome message, and
      cover image URL persisted in `house_settings` and rendered across
      sidebar / landing / dashboard. Cover image renders as a darkened
      background on the landing page.

---

## 5. Remaining work (prioritised)

### P0 — Required to actually run the app locally
1. **`.env.local`** — fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` ✅
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ✅
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Settings → API
   - `DATABASE_URL` (session pooler) ✅
   - `HOA_DEFAULT_ACCESS_CODE` ✅
2. Push the schema:
   ```bash
   npm run db:push
   ```
   (drizzle-kit reads `.env.local` automatically as of pass 5).
3. Turn off email confirmation (dev only): **Authentication → Providers →
   Email → "Confirm email" toggle**. (If you skip this, sign-up still works
   but new accounts must click the email link before signing in. For
   automated testing, `node scripts/confirm-test-user.mjs <email>` flips
   `email_confirmed_at` via the admin API.)
4. Create Storage buckets in Supabase dashboard → Storage:
   - `archives` (authenticated access)
   - `feed-media` (authenticated access)
   - `avatars` (authenticated access, public read)
5. Enable Realtime on the council tables (one-time):
   ```bash
   node scripts/enable-realtime.mjs
   ```
   This runs `ALTER PUBLICATION supabase_realtime ADD TABLE messages, channels`
   via SQL. Equivalent dashboard path: **Database → Publications →
   `supabase_realtime` → toggle on `messages` + `channels`**.
6. (Optional) Seed the default council channels — already done by the SQL
   migration but `node scripts/seed-channels.mjs` is idempotent.
7. `npm run dev`. First user to complete initiation is automatically the
   Elder (see `actions/onboarding.ts`).

### ~~P1 — Phase 3 Council realtime~~ ✅ DONE
`RealtimeMessageList` subscribes to `postgres_changes` on the `messages`
table, filtered by `channel_id`. Handles INSERT (new messages with author
lookup) and UPDATE (soft-delete removal). Wired into the channel page.

### ~~P1 — Phase 4 storage upload~~ ✅ DONE
`src/lib/supabase/storage.ts` provides `uploadFile()` and `storagePath()`.
Wired into `UploadPhotoDialog` (file or URL mode) and `PostForm` (multi-image
attach). `PostCard` renders media grids.

**You still need to create the Storage buckets in the Supabase dashboard:**
- `archives` — authenticated upload, public read
- `feed-media` — authenticated upload, public read
- `avatars` — authenticated upload, public read

### P2 — Polish / UX
- ~~Gathering edit flow (not just cancel).~~ ✅ Done in pass 4.
- ~~Delete / archive gatherings after they pass.~~ ✅ Done in pass 5
  (`archivePastGatherings` action + `Archive past` button, elder-only).
  A cron version is still future work — current sweep is on-demand.
- ~~Reply threading UI in the council.~~ ✅ Done in pass 4.
- ~~Post type selector ("text" / "announcement") + pin controls for elders.~~ ✅ Done in pass 4.
- ~~Member reactivation path for deactivated members.~~ ✅ Done in pass 4.
- ~~House Settings page with real keys.~~ ✅ Done in pass 4. Cover image
  wired into landing background in pass 5. Default channels and notification
  prefs still TODO if/when needed.
- ~~Audit log table + server-side logging in admin actions.~~ ✅ Done in pass 5.
- ~~Lightbox viewer for photos.~~ ✅ Done in pass 4.
- ~~Persist the `HOA_DEFAULT_ACCESS_CODE` env value into the `access_codes`
  table on first run.~~ ✅ Done in pass 5 (idempotent `INSERT … ON CONFLICT
  DO NOTHING` inside `validateAccessCode`).

### P2 — Framework migrations
- ~~**Next 16 proxy migration.**~~ ✅ Done in pass 5 — `src/middleware.ts`
  renamed to `src/proxy.ts`, export renamed to `proxy`. Build no longer logs
  the deprecation warning, and the route table shows
  `ƒ Proxy (Middleware)`.

### P1 — Channel archive/delete UI _(new — surfaced in Pass 7 E2E)_
The `/elder-council/channels` admin page renders an `is_archived` badge
(`channels.is_archived` exists in the schema) but never lets an elder
toggle it. Add an archive control + a "show archived" filter, plus a
hard-delete path with a confirmation dialog (or soft-archive + a separate
purge action). A background session has been spawned for this — pick it
up there or implement inline. Touches:
- `src/app/(house)/elder-council/channels/page.tsx`
- `src/app/actions/council.ts` (`archiveChannel`, `unarchiveChannel`,
  `deleteChannel` — elder-only, audit-logged)
- `src/lib/validators.ts` (channel-id schema)

### P1 — Tests + CI
- ~~Vitest setup~~ ✅ Done in pass 5 (`vitest.config.mts`,
  `src/lib/validators.test.ts`, 29 tests passing).
- ~~At least one full E2E smoke test~~ ✅ Done manually in pass 7. Next:
  codify the flow as a Playwright (or Vitest browser-mode) script so it
  runs in CI instead of by hand.
- Server-action / settings-reader / audit-helper tests (require module mocks
  for Drizzle + Supabase).
- GitHub Actions CI: `npm ci` → `tsc --noEmit` → `eslint` → `vitest run`
  → (eventually) `playwright test`.

### P2 — Future polish surfaced in Pass 7
- **`router.refresh()` audit.** The RSVP fix exposed a class of bug:
  any server action invoked from `onClick` (not from a `<form action>`)
  needs an explicit `router.refresh()` to update server-component data.
  Worth a quick sweep over every other client component that calls a
  server action via event handler — feed reactions, post pin, member
  role updates, channel create, etc. — to confirm none are silently
  serving stale data.
- **Family-tree focus by member id.** The current `focusMemberId={ctx?.memberId}`
  works when the auth context exposes the member-table id, but if the
  lookup ever returns the auth user id instead, `nodeMap.get(focusMemberId)`
  returns undefined and the effect falls back to "show full left edge".
  That fallback is acceptable, but worth confirming `getAuthContext()`
  always returns the member id.
- **Sign-out UX.** No dedicated `/sign-out` route exists; sign-out is
  triggered via `supabase.auth.signOut()` inside the sidebar component.
  Considered cosmetic but it makes manual session swaps awkward during
  testing. Adding a lightweight `/sign-out` route (clear cookie +
  redirect) would help.

### P3 — Longer-term ideas (from `04-Roadmap.md`)
~~Family tree~~, polls, recipes, map view, voice/video, document vault,
localization (Dari/Pashto), mobile PWA.

> **Family Tree** — ✅ shipped in pass 6. `member_relationships` table with
> parent→child edges, interactive tree visualization, elder-only relationship
> editor. Linked in sidebar + mobile nav.

---

## 6. Known quirks / things to watch

1. **Font fetching in CI / offline build.** `next build` failed in my
   environment because it couldn't reach Google Fonts. On any machine with
   internet, the build works. `tsc --noEmit` has no network requirement and
   passes cleanly.
2. **`HOA_DEFAULT_ACCESS_CODE` in env + DB.** As of pass 5, the env-var
   code is also persisted to `access_codes` on first valid use (label
   "Bootstrap (env)", `maxUses: 1000`) so its uses count alongside other
   codes. Lower `maxUses` or revoke it once the first elder is in.
3. **First-member-is-Elder.** `completeInitiation` checks `memberCount === 0`
   and assigns the `elder` role. Don't run seed members into the `members`
   table before the first real user, or you'll demote yourself to `member`.
4. **Supabase session cookies.** The proxy (`src/proxy.ts`, formerly
   `middleware.ts`) must run on every request to refresh the session. If
   the proxy is skipped, access tokens expire silently and Server
   Components see "no user".
5. **Presence.** `lastSeenAt` is updated every 60s by the client heartbeat.
   The 5-minute window (`PRESENCE_TIMEOUT_MS`) defines "online". Closed tab
   = silent drop after 5 min; no explicit logout signal.
6. **Role gating is application-level.** `requireRole('elder')` is enforced
   in server actions and pages. There is no Supabase RLS equivalent for
   non-realtime tables — the service-role key bypasses RLS on purpose.
7. **Storage buckets must be created manually.** The code uploads to
   `archives`, `feed-media`, and `avatars` buckets. Create them in the
   Supabase dashboard → Storage before testing uploads.
8. **Realtime requires Supabase Realtime enabled.** The `messages` and
   `channels` tables have RLS enabled. Either run
   `node scripts/enable-realtime.mjs` (SQL `ALTER PUBLICATION supabase_realtime
   ADD TABLE …`) or use **Database → Publications → `supabase_realtime`** in
   the dashboard.
8. **Turbopack build flags.** `next build` uses Turbopack by default in
   Next 16. If you hit obscure issues, you can fall back with
   `next build --no-turbopack`.

---

## 7. Running locally — quick ref

```bash
# 1. Install
npm install

# 2. Fill in env
cp .env.example .env.local
# edit .env.local — at minimum DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY,
# HOA_DEFAULT_ACCESS_CODE.

# 3. Push schema (drizzle-kit reads .env.local automatically)
npm run db:push

# 4. Enable Realtime on council tables (one-time)
node scripts/enable-realtime.mjs

# 5. (dev only) In the Supabase dashboard:
#    Authentication → Providers → Email → uncheck "Confirm email"
#    Storage → create buckets: archives, feed-media, avatars

# 6. Run
npm run dev
# → http://localhost:3000
```

First sign-up becomes Elder. Then:
- `/elder-council/access-codes` to mint family invites
- `/elder-council/channels` to create council chambers
- `/archives` → "New Album" → open album → "Add Photo"
- `/gatherings/new` → create your first event

---

## 8. "Definition of Done" for the MVP

The project ships when:
- [x] Scaffold compiles with zero TS errors
- [x] Every roadmap page / action from Phases 1–4 exists and renders
- [x] Council realtime is wired and messages stream live
- [x] Photo/media uploads go through Supabase Storage (code done — buckets
      need to be created in dashboard)
- [x] At least one end-to-end smoke test: sign up → initiate → post → RSVP →
      chat → upload → elder mints code → new user initiates using it
      _(Pass 7 — all 11 flows exercised with two real accounts.)_
- [x] House Settings page does something real (house name, tagline,
      welcome message, cover image URL)

**MVP Definition of Done achieved (2026-05-06).** Everything else in §5
P1/P2/P3 is post-MVP work.
