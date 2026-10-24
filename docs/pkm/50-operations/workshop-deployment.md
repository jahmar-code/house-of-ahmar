---
title: Workshop deployment
summary: Putting the Workshop on agents.kabul-afghanistan.ca — DNS, Vercel, Supabase Auth URLs, environment, migration, first sign-in, and local verification.
source:
  - src/proxy.ts
  - src/lib/workshop/routing.ts
  - src/lib/workshop/env.ts
  - src/app/auth/confirm/route.ts
  - src/lib/get-url.ts
  - .env.example
  - vercel.json
  - supabase/migrations/20261023120000_workshop_agents.sql
  - supabase/config.toml
  - scripts/local-stack.mjs
  - src/app/actions/workshop.database.test.ts
  - tests/integration/database-security.mjs
verified: 2026-10-23
tags: [operations, workshop, deployment, release]
---

# Workshop deployment

The Workshop ships inside the existing Vercel project and Supabase project. No new service is needed. Do these steps in order. Steps 3 and 4 touch the live family project, so follow the [migration runbook](migration-runbook.md) and take a [backup](backup-and-recovery.md) first.

The family site is `kabul-afghanistan.ca` and the Workshop is `agents.kabul-afghanistan.ca`. As of 2026-10-23 the domain is attached to the Vercel project and the three Workshop variables are set for Production; the DNS record, Supabase redirect URLs, migration and merge are still to do.

## 1. DNS and Vercel domain

1. In Vercel → the `house-of-ahmar` project → Settings → Domains, add `agents.kabul-afghanistan.ca`.
2. At the DNS host for `kabul-afghanistan.ca` (Google nameservers `ns-cloud-d*.googledomains.com`), create the record Vercel shows: `CNAME agents → c821003d51f1159b.vercel-dns-017.com.` (the generic `cname.vercel-dns.com` also works). Check with `vercel domains verify agents.kabul-afghanistan.ca`.
3. Wait for Vercel to report the domain as valid and issue the certificate.

The family site keeps its own domain. The Workshop host only ever serves `/workshop/*`, `/api/agents/*` and the shared auth routes. Any other path, including every family page, is rewritten under `/workshop` and 404s there (`workshopRewritePath`).

## 2. Environment (Vercel → Settings → Environment Variables, Production)

| Variable | Value |
|---|---|
| `HOA_WORKSHOP_HOST` | `agents.kabul-afghanistan.ca`: the bare host, no scheme |
| `HOA_WORKSHOP_ADMIN_EMAILS` | Both founders' emails, comma-separated |
| `CRON_SECRET` | A random string of 16+ chars (`openssl rand -hex 24`) |

Redeploy after setting them. These are validated separately from the House's required variables (`src/lib/workshop/env.ts`). A malformed value logs a `[workshop]` warning and disables only that feature: subdomain routing for a bad host, the cron for a short secret. It never takes the family site down. See [environment variables](../40-reference/environment-variables.md).

## 3. Supabase Auth: confirmations and URLs

**Precondition: "Confirm email" must be ON** (Authentication → Providers → Email). Workshop access is bound to a *confirmed* email. With confirmations off, Supabase marks every sign-up confirmed, and whoever registers a founder's address first would be provisioned as admin. Check this before setting `HOA_WORKSHOP_ADMIN_EMAILS`. The local test stack has confirmations off on purpose; never copy that to the hosted project.

In Supabase → Authentication → URL Configuration, add these redirect URLs:

- `https://agents.kabul-afghanistan.ca/auth/confirm`
- `https://agents.kabul-afghanistan.ca/**`

Workshop sign-in/sign-up build their confirmation link on the Workshop origin (`confirmOnCurrentOrigin`), and `/auth/confirm` returns to that origin only when the request host equals `HOA_WORKSHOP_HOST`. Without these redirect URLs, Supabase falls back to the Site URL and the session lands on the family host. Auth cookies are per host, so signing in on the Workshop host is separate from the family site.

## 4. Apply the migration

`supabase/migrations/20261023120000_workshop_agents.sql` is additive. It creates five tables, enables RLS with no policies and revokes client grants. It does not touch family tables. Apply it the way the migration runbook prescribes, never with `db:push`. Then run the verification query from the file's header. All five tables must show `relrowsecurity = true`.

## 5. First sign-in

1. Each founder opens `https://agents.kabul-afghanistan.ca`, chooses **Create account**, uses the email listed in `HOA_WORKSHOP_ADMIN_EMAILS`, and confirms it.
2. On the first confirmed sign-in they are provisioned as admins.
3. Anyone else must be added on **Operators** first, then sign up with that exact email.
4. A signed-in account that isn't on the list sees `/workshop/no-access`.

## 6. Connect agents

Register each agent, store its token as `HOA_AGENT_TOKEN` along with `HOA_WORKSHOP_URL=https://agents.kabul-afghanistan.ca`, and send heartbeats. See the [ingest API](../40-reference/agent-ingest-api.md) or the in-app Connect page. Share an agent with your partner from its page. They can watch it; only you can control it. A teammate connecting their own agents can hand [this metaprompt](../../workshop/teammate-agent-setup-prompt.md) to their Claude agent.

## Smoke checks after deploy

- `https://agents.kabul-afghanistan.ca/` while signed out → `/workshop/sign-in`.
- `https://agents.kabul-afghanistan.ca/feed` → not found.
- `curl -i https://agents.kabul-afghanistan.ca/api/agents/v1/control` → `401`.
- Register a test agent, send one heartbeat, see it appear as Running, pause it, and get `desiredState: "pause"` back. Then archive it.
- An authenticated browser session querying `/rest/v1/agents` gets nothing.

## Local verification (one stack at a time)

The worktree's disposable Supabase stack is named **`hoa-workshop`** (`project_id` in `supabase/config.toml`, checked by `scripts/local-stack.mjs`). That keeps `test:e2e:prepare` from wiping the main checkout's `house-of-ahmar` volumes. Both stacks bind ports 55321/55322, so **only one can run at a time**. Docker is expensive here:

1. Stop any other local stack first: `node_modules/.bin/supabase stop --project-id house-of-ahmar --no-backup`.
2. Run `npm run test:e2e:prepare`. Set `HOA_STACK_MINIMAL=1` to skip Realtime and Storage when you are only checking the Workshop. The full `npm run test:db` needs both.
3. Run `npm run test:db`. It covers `workshop.database.test.ts` (the real routes, actions and access rules on a rolled-back transaction) and the Data API denials in `database-security.mjs`.
4. **When done**, run `node_modules/.bin/supabase stop --project-id hoa-workshop --no-backup` and quit Docker Desktop. Don't leave either running.

To try the subdomain locally, start `next dev -p 3217` with the `.env.e2e.local` values plus `HOA_WORKSHOP_HOST=agents.localhost:3217` and open `http://agents.localhost:3217`. Never load `.env.local` (the live project) for this.
