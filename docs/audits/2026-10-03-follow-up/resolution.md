# Follow-up resolution and evidence

Date: 2026-10-03. Branch `claude/agent-audit-metaprompt-ae6bcf`, based on the audit baseline `f239065`. This records what the implementation pass changed, what was proved and how, and what is still open. It adds to the [audit](README.md); the original findings stay as written.

**Live actions, with the owner's approval on 2026-10-04 (UTC):**

1. A verified backup was taken.
2. The DS-01 migration was applied to the live House at about 15:37 and verified.
3. The DS-02 historical redaction was committed at about 15:38.

Release state is recorded under [Release](#release). Before this pass, production ran `bce6125` (Vercel deployment `dpl_4Uu4x5jzAU1FhBhwAc7fypfLLUnZ`). OP-01's hosted rehearsal and OP-02's gate still need the owner.

## Status of every finding

"Fixed locally" means the defect was reproduced, the code changed, and new permanent tests that failed on the baseline now pass. It does not mean deployed.

| ID | Status | What changed | Evidence |
|---|---|---|---|
| DS-01 | **Fixed and applied live** (2026-10-04); already-issued URLs closed by evidence | New migration `20261003200000_operation_aware_media.sql`: browser sessions may only download/inspect and directly upload House media; signing, batch signing, signed uploads, listing, copy/move, render, TUS and S3 are refused even beside legacy permissive policies; restrictive guards stop clients changing House bucket rows (e.g. making one public). Aborts unless the target's Storage has the operation helpers and grants them to `authenticated` | Before: 30 of 93 real Storage API checks failed (members, guests and Elders could sign; members could mint signed upload URLs and list names). After: `storage-media.mjs` 97/97 with a positive signing control; `database-security.mjs` 192/192 including an upgrade replay |
| DS-02 | **Fixed; live history redacted** (2026-10-04) | Typed per-action audit metadata with a runtime allow-list (`src/lib/audit.ts`); no invite codes or removed-content previews; `summarizeAuditEntry` never renders them from older rows; audit page loads only bylines; operator script `supabase/operations/redact-audit-secrets.sql` | Before: 4/5 real-action contracts failed. After: pass, plus allow-list, sink-failure and legacy-row rendering tests; redaction rehearsed on a throwaway copy (dry run, `apply=0`, `apply=false` roll back; `apply=true` removes only `code`/`preview`) |
| DS-03 | Fixed locally | Edit and cancel put the still-editable predicates in the `UPDATE … RETURNING` and return a recoverable conflict | Before: real-PostgreSQL interleavings failed. After: 6 interleavings pass in both orders, including the archiver waiting on a reschedule's row lock |
| OP-01 | Fixed locally; **hosted restore not rehearsed** | Versioned schema + data-only archive: `backup.mjs` (one exported snapshot, Auth identities, hashed SQL files, object hashes, isolated env), `restore.mjs` (fresh provisioned empty target only, typed confirmation, one transaction with in-transaction emptiness and count checks), `restore-rehearsal.mjs` (`npm run test:restore`, also in CI) | Before: the public-only dump referenced `private.*` twice and created neither. After: rehearsal restored 80 rows / 9 identities / 24 objects into a recreated stack; original sign-in, photo download, Council reads and denials pass, then all three policy suites pass on the restored target |
| OP-03 | Fixed | Deleted `confirm-test-user.mjs` and `seed-past-gathering.mjs`; manual confirmation is a named operator procedure in [troubleshooting](../../pkm/50-operations/troubleshooting.md) | Source; references removed |
| CO-01 | Fixed | No `db:push` script; `drizzle.config.ts` refuses `push`/`migrate`/`drop`/`up` outside the local test database; stale comments in the config, backup header, migrations `0002`–`0004`, `AGENTS.md`, `.env.example` corrected; runbook aligned | Guard refused a non-local URL before connecting |
| UX-01 | Fixed locally | Posting navigates (replace) to `/feed?post=<id>`; the Wall finds that post's page in its own order inside the streamed list and scrolls it into view | Before: browser test failed. After: passes on 3 projects, including when 50 pins fill page 1 |
| UX-02 | Fixed locally | Guests see read-only reaction counts; Great Hall cards and first-run copy offer guests no planning/posting links | Before: failed. After: passes with genuinely empty Great Hall cards |
| UX-03 | Fixed locally | Profile name/full name/bio/email/empty states wrap; the same fix for gathering location, organizer/attendee names, comment and Recent Posts authors, page titles; `checkLayout` now fails on any clipped box | Before: failed at 320px. The new check also caught the clipped gathering location in an existing test |
| UX-04 | Fixed locally | Profile summaries use `GatheringDate style="date"`; the Great Hall sentence uses `GatheringDayPhrase` | Before: Saturday/Sunday mismatch. After: profile, detail, list, dashboard and Great Hall agree in Honolulu and Auckland; timed edits far from the server keep their instant |
| UX-05 | Fixed locally | The whole form and Cancel freeze from submit until the next page replaces it; Save stays focusable (`aria-disabled`); a failed save keeps the draft and returns focus | Before: failed. After: holds both the action and the following navigation |
| UX-06 | Fixed locally | `findRemovedMessages` (same chamber rules, ≤500 ids) checks loaded rows after recovery, rejoin or tab return; reruns a check requested mid-flight; clears a reply to a removed message | Before: deleted older text survived recovery. After: removed without reload, other history kept |
| OP-04 | Fixed (coverage) | `src/test/isolated-database.ts` plus `concurrency.database.test.ts`: real transactions on independent connections, a barrier that releases on an observed lock wait, failure injection | 15 tests: last invite use, retry, founding, reciprocal and mixed demote/deactivate, stale actor. Removing locks or the actor recheck makes them fail (or be caught by the new redemption guard). All green on the baseline too: the locks were right, the evidence was missing |
| OP-02 | Prepared, **owner decision open** | `.github/workflows/promote.yml` deploys only the exact SHA that passed, only while it is master's tip, with the token confined to Vercel steps; inert until enabled. Enabling steps, a preview-only drill and rollback in the [release runbook](../../pkm/50-operations/release-runbook.md#production-gate) | Not executed: needs a Vercel token, repository settings and `vercel.json` |

### Found during this pass

| ID | Status | Detail |
|---|---|---|
| DS-04 (new defect) | Fixed locally | `archivePastGatherings` bound a raw `Date` inside `sql```; against real PostgreSQL it threw `Received an instance of Date`, so the Elder's **Archive past** button could not work in production. Now binds typed ISO text. Proved by real-database tests and a browser test that failed on the baseline with the same server error |
| DS-05 (new, from review) | Fixed locally | Drizzle's failed-query message carries every bound parameter (message text, invite codes, contact details) into host logs whenever the database errors. `installDatabaseErrorSanitizer` keeps only the SQLSTATE; unit-tested at Drizzle's single wrapping point |
| Guest gathering management (review) | Fixed locally | A guest who created a gathering before a role change could still edit/cancel it, and was offered the actions. Both now require Member |
| Invite redemption guard (review) | Hardened | Redemption now rolls the new member back if the use-count update matches no row |

## Candidates reviewed, not promoted

- **DS-V01:** covered by OP-04, except a revoke-versus-redeem race. The invite row lock plus the redemption guard protect it; no dedicated test.
- **DS-V02:** covered by OP-01 locally. A hosted restore is not covered.
- **DS-V03:** message, comment and RSVP writes can be acknowledged for a parent archived or deleted a moment earlier. The write lands on a hidden parent; no data is lost and no access widens. Low impact, not changed.
- **DS-V04:** disproved. `realtime-revocation.mjs` shows an open subscription stops after demotion (private chamber) or deactivation (everything). An authorized observer proves the rows streamed, and a self-echo drains the revoked socket. Now in `test:db`.
- **DS-V05:** this is UX-06.
- **Edit-form timezone (experience review):** disproved. With the server in EDT and the browser in Honolulu, the form showed local time and a plain save kept the stored instant. Kept as a regression.
- **Birthday "today/tomorrow" wording** on the Great Hall and profile still uses the server's date. Plausible near midnight; not proved, not changed.
- **UX-G01–G03:** physical devices and assistive technology, representative photo-size benchmarks, and family usability sessions were not run.
- **UX-R01–R03:**
  - The archive dialog wording is now corrected.
  - Component extraction, route titles, a ticking relative clock and photo captions remain product decisions.

## Fresh verification

Local, on macOS with Node 24.19.0, Storage API v1.79.28 and PostgreSQL 17.11. Every run used the disposable stack (API 55321, DB 55322, app 3217).

Final integrated run, in CI order, against uncommitted changes on base `f239065`. It ran on 2026-10-04 from 00:07 to 00:15 UTC (2026-10-03 evening EDT).

| Command | Result |
|---|---|
| `npm run check` | Passed: typecheck, lint, 222 unit tests in 16 files and the docs check (75 files, 301 links, 29 notes, 285 source paths). The 21 opt-in real-database tests are skipped by this gate by design and run under `test:db` |
| `npm run test:e2e:prepare` | Passed; fresh disposable stack and synthetic accounts |
| `npm run test:db` | Passed: 192 PostgreSQL policy assertions, 97 real Storage API assertions, 5 real Realtime revocation assertions, and 21 real-database action tests (interleavings, races, failure injection) |
| `npm run build:e2e` | Passed (`next build`, isolated output) |
| `npm run test:e2e` | **81/81 passed**: 27 journeys on each of desktop Chromium, mobile Chromium and mobile WebKit, with zero retries, in 3.2 min |
| `npm run test:restore` | Passed: backed up, recreated the stack from the migrations, and restored and verified 68 rows, 9 identities and 15 objects; 12 recovery assertions, then all three policy suites on the restored target |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` | 13 development advisories (9 high, 4 moderate), the same set as the audit; not force-fixed |
| `npm run build` with live settings | **Not run:** this worktree has no `.env.local`, and it was deliberately not copied. `build:e2e` exercised `next build` |
| Hosted CI, including the new restore step and `promote.yml` | **Not run:** nothing is pushed |
| Production smoke and live catalog checks | **Not run** |

An earlier integrated run in this pass passed 74 of 78 browser cases:

- **3 failures:** the new clipping check caught the gathering location clipping in an existing test, on all three projects. The location is now fixed.
- **1 failure:** a navigation race in a new WebKit test, now fixed.

The baseline comparison ran the new tests on a detached `f239065` checkout:

- **Action privacy contracts:** 4 of 5 failed.
- **Real-database gathering tests:** 5 failed.
- **Browser follow-up tests:** 7 of 7 failed.
- **Concurrency suite:** 13 of 13 passed. It covers already-correct locks.

## Live operator actions

All of these ran against the configured live House from `.env.local`, through a helper that passes the password in the environment and prints neither it nor the URL. Every output was catalog metadata or counts; no family rows, codes or URLs were printed.

### Backup (2026-10-04, 15:34 UTC)

Taken with the new `scripts/backup.mjs` into the ignored `backups/2026-10-04T15-34-36-6ZSQfG/`:

- One exported snapshot.
- 50 rows in 14 tables, plus 8 Auth users and identities.
- 0 Storage objects in the House buckets.
- Owner-only files, with SHA-256 hashes for both SQL files.

It is a private local copy. It is not in Git and has not yet been copied off the device.

### DS-01 rollout

1. **Read-only preflight.**
   - `storage.allow_any_operation` and `storage.allow_only_operation` exist, and `authenticated` can execute them.
   - Live Storage has the `operation-function` and `operation-ergonomics` migrations, the same as the tested local Storage.
   - The old operation-blind guards were in place, with no bucket policies.
   - All House buckets were private, and 14/14 tables had RLS.
   - There were 0 objects in Storage at all.
2. **Applied** `20261003200000_operation_aware_media.sql` with `ON_ERROR_STOP`; it exited 0.
3. **Verified.**
   - The read and upload guards now reference the operation helpers.
   - The three bucket write guards exist.
   - `authenticated` can execute the helpers and `anon` cannot.
   - Simulated an active member on a synthetic object row, in a transaction that rolled back: the download operation saw it, while single and batch signing saw nothing. Nothing persisted.
4. **Still to confirm by the owner:** post one photo in the app and confirm it displays. That exercises the real Storage server's download operation on production, which no synthetic check here could do without creating family data.
5. **Rollback, only if photos fail to load:** recreate the two guards as defined in `20261003175118_security_and_private_media.sql`. This reopens signing, so treat it as a last resort.

### DS-01 already-issued signed URLs

Storage caps a signed URL's lifetime only at about 285,000 years, so a URL signed earlier never meaningfully expires. When the migration was applied, the live House Storage held **no objects at all**.

A signed URL needs an existing object to sign, and serves only that path. New uploads get fresh random paths. So no URL issued before 2026-10-04 15:37 UTC can retrieve family media, and nothing needed re-keying.

For another environment with existing objects:

1. Count `POST /storage/v1/object/sign*` requests in the Storage logs since its buckets went private.
2. If there are any, or the logs don't cover that period, copy the affected objects to new paths. Rewrite their references in one reviewed transaction after a backup, then delete the old paths.

Do not rotate Auth keys for this.

### DS-02 historical redaction

1. The dry run found exactly one `access_code.created` row holding a copied `code`, and no previews.
2. `-v apply=true` committed.
3. Afterwards there were 0 rows with `code` and 0 with `preview`, and all 11 audit events were kept.

Older backups, including the one above, still hold that code. The invite itself is unchanged in `access_codes`.

### OP-01 hosted restore

Not run. Rehearse once in a disposable hosted project:

1. Provision it from the migrations.
2. Restore with `node scripts/restore.mjs --from <backup> --env <that project's env file> --confirm-target <host:port>`.
3. Confirm that its `postgres` role may insert into `auth.users` and `auth.identities`.

Then choose a backup schedule and an encrypted off-device copy.

### OP-02 release gate

Not enabled; it needs a Vercel token and repository settings. Follow the runbook's enabling steps and drill when ready.

### Release

The implementation is the commit that adds this document. The owner approved pushing it to `master` on 2026-10-04 (no force), and Vercel's Git integration deploys production from that push. The gate above is not enabled yet, so the deploy runs alongside CI.

A file cannot record its own commit's hosted CI run or deployment. Read those from the commit's GitHub checks and the Vercel deployment list, and confirm the deployed SHA there before treating production as updated. The live database changes above are independent of the app deploy: the new policies need no app change, and the new app code needs no further migration.

## Remaining limits

- **Not run:** real SMTP delivery, a hosted restore, physical phones and screen readers, production latency or photo transfer benchmarks, family research sessions, and the production smoke suite.
- **Development advisories:** they are tracked, not force-fixed.
