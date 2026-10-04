# House of Ahmar — engineering instructions

Build a calm, private home for one inclusive family. Read [product vision](docs/pkm/00-overview/product-vision.md), then the relevant note in [Home](docs/pkm/Home.md). This file is the shared instruction source for coding agents; [CLAUDE.md](CLAUDE.md) is a thin entry point.

## Work safely and finish the request

1. Inspect `git status`, the task, and affected source before editing. Preserve changes belonging to others. Do not infer production safety from a localhost URL; the database and Storage target come from the environment.
2. Load the matching [persona](agents/README.md). For broad work explicitly authorized for delegation, assign independent, bounded slices with one owner each. For a small task, adopt the persona inline. The coordinator owns integration and release.
3. State scope, acceptance checks, source ownership, and shared contracts before parallel edits. Coordinate changes to `schema.ts`, `validators.ts`, `types/index.ts`, `globals.css`, root layouts, package files, and migration ordering.
4. Implement the whole user flow: useful empty state, validation, pending feedback, error/retry, successful mutation, and refreshed views. Server Components are the default; use client components for interaction.
5. Verify the actual changed behavior, update affected docs, obtain independent review when warranted, and report evidence and remaining limitations. A passed mocked test does not prove a database policy or browser flow.

## Invariants

- One House per database. Do not introduce organizations, subscriptions, onboarding funnels, or unrelated HotSeat features.
- Active database membership and role/ownership decide access. Supabase user metadata and client UI are not authorization. Every private read and mutation must enforce its own trust boundary; parent layout redirects alone do not authorize a child data loader.
- Server Actions authenticate, validate untrusted input, check resource state/ownership, mutate through Drizzle, and return the established result shape. Do not trust TypeScript unions, IDs, or supplied media paths at runtime.
- The server database connection can bypass RLS. Keep application checks **and** deny-by-default Data API policies. No service-role key in app/browser code.
- Preserve family history: soft-delete content, deactivate members, archive chambers/events. Reactions may be removed as an interaction toggle. Protect the final active Elder and bounded invite redemption under concurrency.
- Treat birthdays as calendar dates and event instants as timestamps. Do not parse a birthday string as UTC midnight for display.
- Limit browser member projections to what the surface needs. Contact details, auth IDs, invite codes, message text, and credentials must not leak through logs or diagnostic artifacts.
- Media and realtime access must match active membership, including deactivation. Test direct URLs and Data API access, not just navigation.
- Neutral dark surfaces, orange accent, Inter/system sans, Lucide icons, and the fixed reaction set. Use semantic tokens. Preserve visible focus, contrast, reduced motion, safe areas, keyboard operation, and mobile composer access.
- Follow [migration safety](docs/pkm/50-operations/migration-runbook.md); never run `drizzle-kit push` or legacy SQL against existing family data; `drizzle.config.ts` refuses direct pushes except to the disposable local test database.

## Quality and documentation gates

Run `npm run check` and `npm run build`, plus the relevant browser/integration checks in [testing strategy](docs/pkm/50-operations/testing-strategy.md). Inspect `package.json` for the current script contract. Report failed, passed, skipped, and not-run checks separately. Do not label the app perfect or fully verified while required environments or flows are untested.

Before changing behavior, find its notes with `rg -l 'source/path' docs/pkm`. Update those notes in the same change. Every vault note has source paths and a `verified` date: stamp only after reading its substantive claims against current source. Cite file and symbol names rather than frozen line numbers. Update indexes for new notes and keep local links valid.

Use `codex/` branches by default. Follow explicit user branch/push instructions; a user-authorized push to `master` does not authorize destructive database changes. Never force-push shared branches. Review the final diff and check status before staging so unrelated work is not silently included.

See [AI development process](docs/pkm/50-operations/ai-development-process.md) for routing, handoff templates, the review loop, and release evidence.
