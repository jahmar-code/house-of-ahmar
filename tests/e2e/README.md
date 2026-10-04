# Browser verification

Read the [testing strategy](../../docs/pkm/50-operations/testing-strategy.md) for scope, fixtures, environment boundaries, and evidence rules.

Use Node 24 and a working Docker daemon. The suite has its own local Supabase ports and generated test credentials; never substitute the family's live project.

```bash
npm run test:e2e:prepare
npx playwright install chromium webkit
npm run build:e2e
npm run test:e2e
```

Preparation resets the dedicated local database and replays migrations; existing synthetic test content is removed. The runner uses ignored `.env.e2e.local`, starts a production app on port 3217, and exercises desktop Chromium plus mobile Chromium/WebKit. `follow-up.spec.ts` holds the regressions for the 2026-10-03 follow-up findings; it seeds its own rows through `testDatabase`/`fixtureMemberId` in `helpers.ts`, which accept only the loopback test database on port 55322, and removes them afterwards. `checkLayout` also fails when a clipping box inside `main` hides content horizontally. Playwright artifacts are ignored and retained on failure.

On the same prepared stack, `npm run test:db` runs the real SQL and Storage policy checks plus the opt-in `*.database.test.ts` suites, and `npm run test:restore` backs up, recreates and restores the whole stack. Run the restore rehearsal after the browser suite, as CI does, because it replaces local fixtures with their restored copies. Report every failure or unexecuted scenario honestly in the dated audit; unit-test success does not replace the browser run.
