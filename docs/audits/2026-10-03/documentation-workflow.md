# Documentation and workflow audit

Reviewed source and authored documentation on 2026-10-03. This workstream did not apply remote migrations or perform a disaster-recovery drill.

## Findings repaired

- Root files duplicated long architecture/status inventories and contradicted current code. `BUILD_STATUS.md` still advertised historical family-tree/Archives features; these are retained schema with no current product routes.
- Setup falsely called all SQL migrations idempotent and recommended replaying plain-CREATE `0001` after `db:push`. Current operations documentation separates fresh migration-chain provisioning from additive upgrades of existing schemas.
- Bootstrap documentation described a permanent master invite, but the implementation retires it once the first member exists.
- Guest descriptions omitted the deliberate RSVP and own-profile exceptions, and owner cleanup can survive role demotion.
- Backup instructions implied ordinary signup automatically reconnects historical accounts in a fresh project. The public-schema dump excludes Auth and needs identity-preserving recovery or a reviewed mapping procedure.
- Historical test claims, missing CI claims, environment assumptions, and broad privacy guarantees were mixed with current operating instructions. The vault now separates source behavior from dated execution/deployment evidence.
- Local personas were generic and incomplete for accessibility, performance, review, release, and docs work. A focused roster and shared `AGENTS.md` now define bounded ownership and evidence-based handoffs.

## Coverage

The vault covers product vision and roles; repository and component maps; architecture/auth/design; invitations/members, Wall, Gatherings, Council, and Elder administration; joining/recovery and participation/moderation flows; action/schema/config/tooling references; and setup, migrations, recovery, testing, release, agent workflow, and limitations.

Source claims come from the App Router pages/actions, shared libraries, schema/SQL, interactive components, package/config files, and operational scripts listed in each note's frontmatter. Root entry points link to this knowledge instead of restating it. The useful HotSeat `docs/pkm` organization and verification discipline were adapted to the House's single-family scope.

## Verification scope

Documentation link/source checks establish navigability and provenance shape. They do not establish prose correctness or live Supabase security. Final checks and runtime limitations are recorded in [verification](verification.md); remote security state belongs to [backend/security](backend-security.md).

## Integration review follow-up

The review surfaced archived detail controls that offered actions the server would reject, incomplete backup bucket coverage, and a reusable local test stack that did not refresh migration state. These were handed to their owners for correction. Protected loaders received direct membership guards; the directory query/type was narrowed to fields it renders. The directory remains a Server Component: its earlier full-record query alone was **not** evidence of a browser data leak.

Documentation was reconciled with the final contracts: private media and remote lockdown status, metadata-free membership, concurrent role protection, Wall/Council history navigation, archived read-only gathering views, UTC calendar-day all-day semantics, Node 24, local fixture ports, real database checks, and CI. Individual execution outcomes remain in the verification ledger.

A final operational review caught backup directory collisions between runs in the same second, shared production/test Next.js output despite build-inlined browser configuration, database fixture guards that allowed arbitrary local ports, and a local Auth limit below the full browser suite's request volume. The coordinator repaired these contracts: unique backup directories, `.next-e2e` output, fixed fixture ports, and a disposable Auth limit of 200 requests per five minutes. Source and operations notes were rechecked after the fixes; browser/build execution remains recorded separately in verification.

Subsequent runtime checks exposed stale local Supabase service containers after a CLI upgrade. Preparation now verifies the exact disposable project ID, stops that stack with `--no-backup`, and starts fresh services/volumes so Storage, Realtime, and the migrated database are compatible. The testing and troubleshooting notes describe this full reset, including local media removal. The additional browser interaction scenarios are mapped in the testing strategy; their execution results are recorded in the release ledger.
