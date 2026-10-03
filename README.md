# House of Ahmar

A private home on the internet for one family. Relatives share updates on **The Wall**, plan **Gatherings**, talk in **The Council**, and keep up in **The Great Hall**. Elders invite people and care for the House. Family includes spouses, in-laws, partners, and adopted children.

The app is a single-house Next.js application with Supabase Auth, Postgres, Realtime, and Storage. A Supabase account alone does not grant membership: joining also requires a valid invitation. House content is for active members.

## Start here

- [Documentation map](docs/pkm/Home.md) — product, architecture, domains, and operations.
- [Local setup](docs/pkm/50-operations/local-setup.md) — install, configure, prepare Supabase, and create the first Elder.
- [Development rules](AGENTS.md) and [specialist agents](agents/README.md) — safe, focused implementation and handoffs.
- [Testing strategy](docs/pkm/50-operations/testing-strategy.md) — local checks and browser coverage.
- [Release runbook](docs/pkm/50-operations/release-runbook.md) and [backup and recovery](docs/pkm/50-operations/backup-and-recovery.md).
- [Current status](BUILD_STATUS.md) — implemented scope and what verification actually establishes.

## Development

Use Node 24 (`.nvmrc`), then:

```bash
npm ci
cp .env.example .env.local
# Fill in values for the intended Supabase environment.
npm run dev
```

Database schema, access policies, Storage, and Auth URLs must be prepared before the app is usable; follow the setup runbook. Never point a destructive test at the family's live project.

```bash
npm run check
npm run build
```

`check` and a production build are separate gates. Browser and integration results belong in the dated [audit evidence](docs/audits/2026-10-03/README.md), including any setup failures or skipped flows.

## Product boundaries

The shipped experience includes invitation onboarding, password recovery, profiles and member discovery, posts/photos/comments/reactions/milestones, gatherings and RSVPs, realtime chat, and Elder administration. The schema retains album/photo and relationship tables, but there is no Archives or family-tree product surface. There are no notification delivery, billing, public feed, or multi-house features. See [vision and scope](docs/pkm/00-overview/product-vision.md).

Historical implementation details are available through Git history. Current behavior is documented from source in `docs/pkm/`; old progress claims are not release evidence.
