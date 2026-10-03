---
title: Environment variables
summary: Application, build-time, and operational configuration without secret values.
source:
  - .env.example
  - src/lib/env.ts
  - src/lib/get-url.ts
  - src/lib/supabase/client.ts
  - src/lib/db/index.ts
  - scripts/backup.mjs
  - scripts/confirm-test-user.mjs
  - next.config.ts
  - scripts/e2e-env.mjs
  - scripts/e2e-prepare.mjs
verified: 2026-10-03
tags: [reference, configuration]
---

# Environment variables

`.env.example` is the copyable contract; `.env.local` holds local values and must remain untracked. Never include secret values in issue text, test reports, screenshots, or documentation.

| Variable | Consumer/purpose | Sensitivity |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server Supabase clients and media origin | Public configuration |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-authenticated Supabase access | Public key; safety depends on policies |
| `DATABASE_URL` | Drizzle/Postgres and database ops | Secret, privileged database access |
| `NEXT_PUBLIC_SITE_URL` | Stable app origin for metadata and auth links | Public; set for deployed environments |
| `HOA_DEFAULT_ACCESS_CODE` | Empty-House founding Elder only | Secret temporary invite; remove after founding |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged operational scripts | Secret; never browser-prefixed or used as a client shortcut |
| `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL` | Hosting-origin fallbacks in `getURL` | Host-injected configuration |

`getServerEnv` validates required values, normalizes empty strings, and caches the parsed contract for the process. Environment changes require restarting server processes. `NEXT_PUBLIC_*` values are compiled into browser code, so a deployment needs a rebuild when they change.

A local web URL does not imply a local database. Before migrations, seed scripts, E2E fixtures, or cleanup, resolve the database/Supabase destination without printing credentials. Use a disposable environment for destructive test setup.

The E2E harness generates ignored `.env.e2e.local` containing local service URLs/keys and a synthetic `E2E_PASSWORD`. Its runner adds `HOA_E2E=1` to select the separate `.next-e2e` build directory. These variables are for the disposable browser suite and must not be copied into production. See [testing strategy](../50-operations/testing-strategy.md) for the fixed local ports and reset contract.

Set Supabase's allowed redirect URLs to the intended application's confirmation endpoint as well as its Site URL. Configure email templates for the supported callback shape. [Setup](../50-operations/local-setup.md) describes verification; never assume a provider dashboard matches the environment file.
