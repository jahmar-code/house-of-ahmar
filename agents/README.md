# House of Ahmar — specialist agents

This folder holds **role personas** — self-contained system prompts that the main
Claude Code loop loads *on demand* when a task falls squarely inside one
discipline. They are **not** `.claude/agents/` subagents: nothing auto-discovers
or auto-spawns them. `CLAUDE.md`'s **"Specialist agents"** section is the router —
it tells the working agent to read the relevant file here and adopt that persona
for the duration of the task.

They were copied from the shared `agents_md` library (`~/Desktop/dev/agents_md`),
which is written against this exact stack — Next.js App Router + TypeScript +
Tailwind/shadcn + Postgres/Supabase + Drizzle + Zod, multi-tenant-SaaS idioms.
House of Ahmar is **single-tenant** (the whole DB *is* one house), so translate
the personas' `org → workspace` tenancy talk to "the House" and ignore the
cents/money guidance — it doesn't apply here.

## How this works

1. A task arrives (e.g. "add a server action to archive a council channel").
2. `CLAUDE.md`'s routing table maps the work to a persona (here, **backend-engineer**).
3. The working agent **reads the persona file** and treats its contents as
   authoritative operating instructions *on top of* `CLAUDE.md` — never instead of it.
4. For work that spans disciplines, load **more than one** persona (a new feature =
   database + backend + frontend + qa), or hand the slice to each in turn.

## The roster

| Persona | File | Owns | Load when the task is about… |
|---|---|---|---|
| **Database Engineer** | [`database-engineer.md`](database-engineer.md) | `schema.ts`, migrations, indexes/constraints, query correctness, data integrity | Schema changes, the stale migration SQL, enum edits, family-tree edges, soft-delete leaks, RLS on `messages`/`channels` |
| **Backend Engineer** | [`backend-engineer.md`](backend-engineer.md) | Server actions, the `src/lib/` domain layer, DDD | Business logic, server actions, auth/role gating, presence, audit logging, settings, the family-tree algorithm |
| **Frontend Engineer** | [`frontend-engineer.md`](frontend-engineer.md) | Components, UI/UX, the design system, mobile-first | Any visible UI, styling, the design tokens, RSC-vs-client boundaries, realtime chat UI, the lightbox / family-tree canvas |
| **QA Tester** | [`qa-tester.md`](qa-tester.md) | End-to-end correctness, bug hunting, Vitest specs | Verifying a flow, reproducing a bug, extending the validator tests, stale-UI-after-mutation checks |
| **Security & Pen Tester** | [`security-pentester.md`](security-pentester.md) | Authz, access codes, tokens, input boundaries, threat review | Auth flows, the access-code / initiation path, role gating, the open-redirect guard, RLS, hardening |

The full 23-role org (product, design, data, SRE, release, a11y, tech-lead, …)
lives in `~/Desktop/dev/agents_md` if a task needs a discipline not curated here —
copy the file in and add a row above.

## Rules for every persona

- **`CLAUDE.md` always wins.** A persona sharpens focus; it never overrides a
  **Critical rule** or the architecture standards.
- **Stay in your lane.** If a task drifts into another discipline (a schema change
  while doing frontend work), stop and load that persona or flag it — don't
  freelance across the shared files (`schema.ts`, `validators.ts`, `proxy.ts`,
  `globals.css`, `layout.tsx`, `constants.ts`) that require coordination.
- **Report back in the persona's "Definition of done" format** so the outcome is
  verifiable, not asserted — and so the next persona in the chain can pick it up.
