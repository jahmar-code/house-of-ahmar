---
title: Repository map
summary: Where the product, platform code, checks, and durable knowledge live.
source:
  - package.json
  - src/app
  - src/components
  - src/lib
  - supabase/migrations
  - scripts
  - agents
  - AGENTS.md
verified: 2026-10-03
tags: [repository, overview]
---

# Repository map

| Path | Responsibility |
|---|---|
| `src/app/page.tsx` | Public front door and House identity |
| `src/app/sign-in`, `sign-up`, `forgot-password`, `reset-password` | Auth forms and recovery |
| `src/app/auth/confirm/route.ts` | Session exchange/OTP confirmation callback |
| `src/app/initiation` | Access-code and first-profile flow |
| `src/app/(house)` | Protected House shell and product pages; route group is absent from URLs |
| `src/app/actions` | Authenticated and validated server mutation boundaries |
| `src/components/{dashboard,feed,gatherings,council,members}` | Domain UI |
| `src/components/layout` | Responsive navigation and presence |
| `src/components/shared`, `ui` | Shared patterns and Base UI primitives |
| `src/lib/auth.ts`, `env.ts`, `settings.ts`, `audit.ts` | Cross-cutting contracts |
| `src/lib/supabase` | Server/browser clients, session refresh, and upload helpers |
| `src/lib/db` | Drizzle connection and schema |
| `src/lib/validators.ts`, `constants.ts`, `src/types/index.ts` | Input, closed sets, and shared result/projection types |
| `src/proxy.ts`, `next.config.ts` | Route/session perimeter, image allow-list, headers |
| `supabase/migrations` | SQL security/integrity history; see migration runbook before executing |
| `scripts` | Backup, realtime setup, diagnostics, seeds, and verification support |
| `agents`, `AGENTS.md` | Role doctrine and development routing |
| `docs/pkm`, `docs/audits` | Current knowledge and dated execution evidence |

Discover current files without trusting a frozen count:

```bash
rg --files src/app src/components src/lib
rg --files -g '*test*' -g '*spec*' -g '!node_modules'
rg --files supabase scripts
```

Start at the [route/component reference](../40-reference/routes-and-components.md) or [Server Actions](../40-reference/server-actions.md), then follow that domain's invariant note. Keep infrastructure changes out of unrelated UI work unless a shared contract requires both.
