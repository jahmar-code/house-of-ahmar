# Clerk → Supabase Auth Migration

A complete record of the Clerk removal + Supabase auth integration, plus the remaining steps you need to complete before the app will run end-to-end.

---

## 1. What the auth system looks like now

### 1.1 Packages

| Removed | Added |
|---|---|
| `@clerk/nextjs` | `@supabase/ssr` |
| `@clerk/themes` | (`@supabase/supabase-js` was already installed) |
| `svix` (Clerk webhook signing) | — |

### 1.2 Environment variables

The app now reads only Supabase vars. `.env.example` is updated. You need a `.env.local` containing:

```env
# Supabase project (from supabase.txt prompt)
NEXT_PUBLIC_SUPABASE_URL=https://ggucmlscinwenvebvlmk.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_g8ARxNWOsyfaAXkugfOQ-A_48jE0XOO

# Server-only — Supabase dashboard → Settings → API → service_role
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Supabase dashboard → Settings → Database → Connection string (URI)
DATABASE_URL=postgresql://postgres:PASSWORD@db.ggucmlscinwenvebvlmk.supabase.co:5432/postgres

# Used by initiation flow
HOA_DEFAULT_ACCESS_CODE=AHMAR2024
```

> The `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is Supabase's newer name for what used to be called the anon key. Both the browser and server SSR clients use it. Row-Level Security (RLS) is what keeps it safe to expose.

### 1.3 The three Supabase clients

Location: `src/lib/supabase/`

| File | Purpose | Used by |
|---|---|---|
| `server.ts` | Server-side client bound to the request's cookie jar via `next/headers`. Reads the user's session. | Server Components, Server Actions, Route Handlers |
| `client.ts` | Browser client. Manages session in cookies automatically. | Client Components (sign-in/up forms, sidebar sign-out) |
| `middleware.ts` | Edge-runtime helper that refreshes the session cookie on every request and returns the current user. | `src/middleware.ts` |

All three read the same env vars. The SSR split exists because Next.js middleware/server components/client components each have different cookie access rules — Supabase needs a slightly different cookie adapter in each.

### 1.4 Route protection (`src/middleware.ts`)

Flow on every matched request:

1. `updateSession(request)` refreshes the Supabase session cookie and returns `{ supabaseResponse, user }`.
2. If the path is public (`/`, `/sign-in`, `/sign-up`, `/auth/*`) → pass through.
3. If no `user` → redirect to `/sign-in?next=<original path>`.
4. If authenticated but `user.user_metadata.hoa_member_id` is missing, and the path isn't already under `/initiation` → redirect to `/initiation`.
5. Otherwise → pass through with the refreshed cookies.

The matcher excludes `_next` and static assets (same as the old Clerk config).

### 1.5 Auth context (`src/lib/auth.ts`)

`getAuthContext()` is the app's single source of truth for "who is the current member":

1. Calls `supabase.auth.getUser()` on the server client.
2. If a user exists, looks up the matching `members` row by `authUserId` (where `isActive = true`).
3. Returns `{ userId, memberId, displayName, role, avatarUrl }` or `null`.

Wrapped in `React.cache()` so multiple Server Components in one render share the call.

`requireAuth()` throws if no context. `requireRole(minimum)` additionally enforces the role hierarchy from `src/lib/constants.ts`.

### 1.6 Database schema

The `members` table's Clerk foreign key is replaced with a real FK to Supabase's auth user:

```ts
// src/lib/db/schema.ts
authUserId: uuid("auth_user_id").notNull().unique(),
```

```sql
-- supabase/migrations/0001_initial_schema.sql
auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
```

The `ON DELETE CASCADE` means that if a Supabase auth user is deleted, the `members` row goes with them — this replaces what the old `user.deleted` Clerk webhook was doing.

RLS policies were also updated — they used to read the Clerk subject from the JWT:

```sql
-- Old
WHERE members.clerk_user_id = auth.jwt()->>'sub'
-- New
WHERE members.auth_user_id = auth.uid()
```

`auth.uid()` is the Supabase-native helper that returns the current request's authenticated user UUID.

### 1.7 Sign-in / sign-up pages

Clerk's `<SignIn>` / `<SignUp>` drop-in components are gone. Replaced with simple email+password forms styled to match the existing theme.

| Path | Server component | Client form |
|---|---|---|
| `/sign-in` | `src/app/sign-in/page.tsx` | `src/app/sign-in/sign-in-form.tsx` |
| `/sign-up` | `src/app/sign-up/page.tsx` | `src/app/sign-up/sign-up-form.tsx` |

**Sign-in form** calls `supabase.auth.signInWithPassword({ email, password })`, then `router.push(next ?? "/dashboard")` and `router.refresh()` so the server picks up the new session cookie.

**Sign-up form** calls `supabase.auth.signUp(...)`.
- If email confirmation is **off** in Supabase, `data.session` is returned immediately → redirect to `/initiation`.
- If email confirmation is **on**, `data.session` is `null` → show "Check your email to confirm" notice, user returns via `/sign-in` after clicking the link.

The old Clerk catch-all routes (`[[...sign-in]]` / `[[...sign-up]]`) were deleted.

### 1.8 Initiation flow

No functional change — the two-step flow is preserved, just rewritten to read Supabase users:

1. **`/initiation`** — server checks `supabase.auth.getUser()` → if a `members` row already exists, redirect to `/dashboard`. Otherwise renders the access-code form.
2. Access code validates against `HOA_DEFAULT_ACCESS_CODE` env var or the `access_codes` table. On success, the code is stashed in `sessionStorage`.
3. **`/initiation/profile`** — collects displayName, fullName, birthday, phone, bio.
4. `completeInitiation()` server action:
   - Inserts a `members` row with `authUserId = user.id`, pulling `email` directly from `user.email`.
   - If this is the first member ever → they become `elder`.
   - Calls `supabase.auth.updateUser({ data: { hoa_member_id, hoa_role } })` to stamp `user_metadata`, which is what middleware checks.
   - Consumes the access code (increments `useCount`, flips to `used` if exhausted).
5. **`/initiation/complete`** — confirmation screen.

> ⚠️ The old Clerk flow pulled `emailAddresses[0].emailAddress` and `imageUrl` from `clerkClient.users.getUser()`. With Supabase we get `user.email` for free, but **there is no avatar URL from Supabase email/password sign-up** — `avatarUrl` is set to `null`. You'd upload avatars manually later (see section 4 below).

### 1.9 Sidebar sign-out

`src/components/layout/house-sidebar.tsx` no longer uses Clerk's `<UserButton>`. It now renders:

- An `Avatar` (with `AvatarImage` if `avatarUrl` exists, otherwise `AvatarFallback` with initials).
- Wrapped in a `DropdownMenu` trigger.
- Dropdown has one item: **Sign out** → calls `supabase.auth.signOut()` client-side, then `router.push("/sign-in")` + `router.refresh()`.

`avatarUrl` is now threaded through from `(house)/layout.tsx` via the `AuthContext`.

### 1.10 Presence heartbeat

`src/app/actions/presence.ts` still exists and does the same thing (updates `members.lastSeenAt`), just keyed on `authUserId` now.

### 1.11 Deleted files / dirs

- `src/app/sign-in/[[...sign-in]]/` (Clerk catch-all)
- `src/app/sign-up/[[...sign-up]]/` (Clerk catch-all)
- `src/app/api/webhooks/clerk/` (svix-verified Clerk user.deleted webhook)

---

## 2. Architecture at a glance

```
┌──────────────────────────────────────────────────────────────┐
│ Browser                                                      │
│                                                              │
│  Client Component ──► createClient() ──► @supabase/ssr      │
│  (sign-in form,        (browser)          (cookies handled  │
│   sidebar sign-out)                        by the SDK)      │
└─────────────────┬────────────────────────────────────────────┘
                  │  sb-* cookies
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Next.js edge middleware (src/middleware.ts)                  │
│                                                              │
│  1. updateSession() — refreshes the access token if needed   │
│  2. getUser() — validates with Supabase                      │
│  3. redirects: unauthenticated → /sign-in                    │
│                 no hoa_member_id → /initiation               │
└─────────────────┬────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Server Components / Server Actions                           │
│                                                              │
│  createClient() (server) ──► auth.getUser() ──► user.id     │
│         │                                                    │
│         ▼                                                    │
│  Drizzle ── members.authUserId === user.id ──► AuthContext  │
└─────────────────┬────────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────────────────────────┐
│ Supabase Postgres                                            │
│                                                              │
│  auth.users ◄── FK (ON DELETE CASCADE) ── public.members    │
│  RLS policies gate public.* using auth.uid()                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. What you still need to do

Do these in order. Steps 1–3 are required before the app will boot.

### 3.1 Required — get the app running

#### Step 1: Create `.env.local`

Copy the block from **§1.2** into `/Users/jawaadahmar/Desktop/dev/house-of-ahmar/.env.local`. Fill in:

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API → `service_role` secret.
- `DATABASE_URL` — Supabase dashboard → Project Settings → Database → Connection string → **URI** tab. Use the "Session" pooler URL for app runtime, or the direct connection for migrations. Replace `[YOUR-PASSWORD]` with the DB password you set when creating the project.

> `NEXT_PUBLIC_*` vars are baked into client bundles at build time. If you change them, restart `npm run dev`.

#### Step 2: Run the SQL migration

The schema file is `supabase/migrations/0001_initial_schema.sql`. It now references `auth.users(id)`, so the `auth` schema must already exist (it always does on Supabase).

Easiest path — **Supabase SQL Editor**:

1. Open dashboard → SQL Editor → New query.
2. Paste the full contents of `supabase/migrations/0001_initial_schema.sql`.
3. Click **Run**.
4. Verify in **Table Editor** that `members`, `access_codes`, `posts`, `comments`, `reactions`, `gatherings`, `rsvps`, `channels`, `messages`, `albums`, `photos`, `house_settings` all exist.
5. The migration also seeds three channels (`general`, `announcements`, `elders-only`) and enables RLS on `messages` + `channels`.

Alternative — **Drizzle push** (skips the SQL file, pushes the TS schema directly):

```bash
npx drizzle-kit push
```

This reads `drizzle.config.ts`, compares `src/lib/db/schema.ts` to the live DB, and applies changes. ⚠️ It will **not** create the enums, the seed channels, or the RLS policies — so only use this for iterating on the schema after you've already run the SQL migration once.

**If you already ran an earlier version of the migration** (with `clerk_user_id`): the safest thing is to drop the public schema and re-run, because the column type changed from `TEXT` to `UUID`:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;
```

Then re-paste the migration.

#### Step 3: Turn off email confirmation (development only)

Supabase dashboard → Authentication → Sign In / Providers → **Email** → toggle off "Confirm email".

Without this, `signUp()` returns `{ session: null }` until the user clicks the confirmation email, which breaks the immediate redirect to `/initiation`. Re-enable it before production.

#### Step 4: Smoke test

```bash
npm run dev
```

Then:
1. Visit `/` → click "Request Entry" → sign up with any email + password ≥ 8 chars.
2. You should land on `/initiation`.
3. Enter the access code `AHMAR2024` (matches `HOA_DEFAULT_ACCESS_CODE`).
4. Fill out the profile form.
5. Redirects to `/initiation/complete` → `/dashboard`.
6. Sidebar shows your initials + role "elder" (first member).
7. Open dropdown → Sign out → lands on `/sign-in`.
8. Sign back in → lands on `/dashboard` directly (skips initiation because `user_metadata.hoa_member_id` is now set).

Inspect `auth.users` + `public.members` in the Supabase Table Editor to confirm the FK linkage.

### 3.2 Recommended — before real users

#### Step 5: Decide on email confirmation + customize templates

Turn confirmation back on. Customize templates in Supabase dashboard → Authentication → Email Templates:
- **Confirm signup** — the link users click to activate.
- **Magic link**, **Reset password** — even if you don't use them yet, brand them.

The confirm link redirects to `{{ .SiteURL }}/auth/confirm?token_hash=...&type=signup&next=/`. Since we haven't built `/auth/confirm` yet, you have two options:

**Option A (simplest)**: set the redirect target in Supabase → Authentication → URL Configuration → Site URL to `http://localhost:3000` (dev) / your prod URL. Supabase will handle the confirmation server-side and just bounce the user to `/`. They'll then need to sign in manually.

**Option B (nicer UX)**: build a `/auth/confirm/route.ts` Route Handler that calls `supabase.auth.verifyOtp()` with the token and redirects to `/initiation`. [Supabase's Next.js guide covers this.](https://supabase.com/docs/guides/auth/server-side/nextjs)

#### Step 6: Add "Forgot password"

Not built yet. The flow is:
1. Add a `/forgot-password` page with an email input → calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: ".../auth/reset" })`.
2. Add a `/auth/reset` page that reads the code from the URL, calls `supabase.auth.updateUser({ password })`.
3. Link to it from the sign-in form.

#### Step 7: Enable RLS on remaining tables

The migration only enables RLS on `messages` and `channels`. The other tables (`posts`, `comments`, `reactions`, `gatherings`, `rsvps`, `albums`, `photos`, `members`, `access_codes`, `house_settings`) are currently readable/writable by anyone with the anon key.

For each table, add policies like:

```sql
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_posts" ON posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM members
            WHERE members.auth_user_id = auth.uid()
              AND members.is_active = true)
  );

CREATE POLICY "members_write_own_posts" ON posts
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM members
            WHERE members.auth_user_id = auth.uid()
              AND members.is_active = true
              AND members.id = posts.author_id)
  );

-- plus UPDATE / DELETE policies as needed
```

Your **server-side Drizzle queries run through `DATABASE_URL` as the postgres superuser and bypass RLS**. RLS only matters for:
- Supabase Realtime subscriptions (which the app will use for `messages`).
- Any direct `supabase.from("table")` calls from the client.

So RLS is mandatory before you wire up realtime chat in The Council.

#### Step 8: Avatars

The old Clerk flow grabbed `clerkUser.imageUrl`. Supabase email/password sign-up gives you nothing. Options:
- Add an avatar upload to `/initiation/profile` using Supabase Storage (create a `avatars` bucket, upload in the client, save the public URL to `members.avatarUrl`).
- Wait until you add OAuth providers (Google/Apple) which populate `user.user_metadata.avatar_url`.

#### Step 9: Re-add user deletion hook (if you need soft-delete)

The old Clerk webhook soft-deleted members (`isActive = false`) when the Clerk user was deleted. The new schema **hard-deletes** via `ON DELETE CASCADE`.

If you want the old soft-delete behavior back, either:
- Drop the `ON DELETE CASCADE` and add a Supabase **Database Webhook** (dashboard → Database → Webhooks) on `auth.users` delete that hits a Route Handler which sets `isActive = false`, or
- Use a Postgres trigger on `auth.users` that updates `public.members.is_active` before the cascade fires.

### 3.3 Future

- **OAuth providers** (Google, Apple): configured in Supabase dashboard → Authentication → Providers. The client call is `supabase.auth.signInWithOAuth({ provider: "google" })`. Requires an OAuth callback route at `/auth/callback`.
- **Server-side sign-out**: currently sign-out is client-side only, which is fine, but a Server Action variant is more resilient to JS-disabled clients.
- **MFA/TOTP**: Supabase supports it natively; opt-in per user.

---

## 4. Files changed in this migration

Created:
- `src/lib/supabase/middleware.ts`
- `src/app/sign-in/page.tsx`, `src/app/sign-in/sign-in-form.tsx`
- `src/app/sign-up/page.tsx`, `src/app/sign-up/sign-up-form.tsx`

Rewritten:
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
- `src/middleware.ts`
- `src/lib/auth.ts`
- `src/app/actions/onboarding.ts`, `src/app/actions/presence.ts`
- `src/app/layout.tsx` (removed `ClerkProvider`)
- `src/app/page.tsx`, `src/app/initiation/page.tsx`, `src/app/initiation/profile/page.tsx`
- `src/components/layout/house-sidebar.tsx`
- `src/app/(house)/layout.tsx` (threads `avatarUrl` through)
- `src/lib/db/schema.ts` (column rename)
- `supabase/migrations/0001_initial_schema.sql` (column + RLS rewrite)
- `.env.example`
- `package.json` (+ lockfile)

Deleted:
- `src/app/sign-in/[[...sign-in]]/page.tsx`
- `src/app/sign-up/[[...sign-up]]/page.tsx`
- `src/app/api/webhooks/clerk/route.ts`

---

## 5. Key mental-model shifts from Clerk

| Concept | Clerk | Supabase |
|---|---|---|
| User ID shape | opaque string (`user_2a…`) | UUID from `auth.users.id` |
| "Extra data" on user | `publicMetadata`, `privateMetadata` | `user_metadata` (user-editable), `app_metadata` (server-only) |
| Session storage | signed JWT in cookie, managed by Clerk SDK | JWT in cookie, managed by `@supabase/ssr` |
| Sign-in UI | `<SignIn>` React component | You build the form, call `signInWithPassword` |
| Webhook for user events | svix-signed webhooks | Supabase Database Webhooks, or Postgres triggers on `auth.users` |
| "Who am I" on the server | `auth()` from `@clerk/nextjs/server` | `createClient()` → `auth.getUser()` |
| RLS integration | none built-in, you had to read the JWT yourself | `auth.uid()` is a first-class helper in every policy |

The biggest behavioral difference: Supabase's session lives in plain cookies and is **only valid after middleware refreshes it**. That's why `src/middleware.ts` must run on essentially every request — if middleware is skipped, access tokens silently expire and Server Components start seeing "no user" even when the browser thinks they're logged in.
