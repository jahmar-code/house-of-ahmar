---
title: Local setup
summary: Bring up a deliberate development environment and open an empty House.
source:
  - package.json
  - .env.example
  - drizzle.config.ts
  - supabase/migrations
  - scripts/enable-realtime.mjs
  - src/app/actions/onboarding.ts
  - src/app/auth/confirm/route.ts
verified: 2026-10-03
tags: [runbook, setup]
---

# Local setup

## Preconditions

Use Node 24 (`.nvmrc`; `package.json` requires `>=24 <25`) and the committed lockfile. Choose a local/disposable Supabase project for development, with Auth, Postgres, Realtime, and Storage available. Confirm the destination before writing: a web server on localhost can still point at the live family's database.

```bash
npm ci
cp .env.example .env.local
```

Fill required values using [the environment reference](../40-reference/environment-variables.md). Keep credentials out of the terminal transcript. Set the site URL to the origin that will open confirmation and recovery links.

## Prepare Supabase

1. Follow [migration ordering](migration-runbook.md). For a fresh empty project, run the complete migration chain in order; the final additive migration reconciles the historical baseline to the current app. Do not run Drizzle first or replay the legacy `0001` snapshot over an existing schema.
2. Configure Realtime publication using the migration/setup mechanism or `node scripts/enable-realtime.mjs`; verify a real subscription later.
3. Provision the private media bucket and membership/ownership policies from the current hardening migration. A bucket name alone is not a usable upload policy.
4. Set Auth Site URL and allowed Redirect URLs for `/auth/confirm` on the chosen origin. Keep email confirmation enabled for real users. If using a disposable local mail catcher, record that email delivery was only simulated.
5. Confirm email templates generate the supported callback shape (`code` exchange or `token_hash` and `type`), including recovery destination. Test sign-up confirmation and forgot-password separately.

The initial migration history and security state are separate from application startup. Do not proceed with real family content when anonymous or non-member browser roles can read or write House tables.

## Open the House

Set a strong `HOA_DEFAULT_ACCESS_CODE` only on the empty project, start `npm run dev`, create the intended founding account, confirm it as configured, and finish initiation using that code. Verify the new member is Elder. Remove the bootstrap value and restart/redeploy. Use Elder Council to create subsequent invites.

If the database already contains member rows, it is not empty: do not delete people to force bootstrap. Recover the existing Elder identity or use a separate development project.

## First useful session

Verify the General, Announcements, and Elders Only chambers exist; the seed/setup SQL preserves existing channels. Update the House name/welcome if desired. Add a test post, gathering/RSVP, and message only in the disposable environment. Check each from a second browser identity. Run the gates in [testing strategy](testing-strategy.md).

If startup fails, read the named environment error, then check database reachability/schema, Auth URL settings, and current migration state. Do not weaken authorization to get past an error page.
