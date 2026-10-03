# Browser verification

Read the [testing strategy](../../docs/pkm/50-operations/testing-strategy.md) for scope, fixtures, environment boundaries, and evidence rules.

Use Node 24 and a working Docker daemon. The suite has its own local Supabase ports and generated test credentials; never substitute the family's live project.

```bash
npm run test:e2e:prepare
npx playwright install chromium webkit
npm run build:e2e
npm run test:e2e
```

Preparation resets the dedicated local database and replays migrations; existing synthetic test content is removed. The runner uses ignored `.env.e2e.local`, starts a production app on port 3217, and exercises desktop Chromium plus mobile Chromium/WebKit. Playwright artifacts are ignored and retained on failure. Report every failure or unexecuted scenario honestly in the dated audit; unit-test success does not replace the browser run.
