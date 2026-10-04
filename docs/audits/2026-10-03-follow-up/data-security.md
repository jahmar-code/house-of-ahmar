# Data, security, and architecture follow-up audit

Audit date: 2026-10-03. Reviewed commit: `f239065ad943131eece5f17ad99fded541d863e1`.

**Verdict: request changes.** The previous release materially improved authorization, privacy, and reliability. This independent pass nevertheless confirmed one high-priority media revocation defect and two medium-priority defects. None was repaired during this audit-only task.

## Scope, constraints, and persona coverage

Read the complete sibling persona files under `../agents_md`, the repository `AGENTS.md`, product vision, relevant architecture/domain/operation notes, and the prior backend/security audit. The House's single-family scope overrides generic persona examples about organizations, payments, warehouses, and tenant selectors.

| Persona | Work performed | Result |
|---|---|---|
| `backend-engineer` | Traced every Server Action family: onboarding, invites, members, settings, Wall, Council, Gatherings, and presence; reviewed guards, runtime validation, resource state, transactions, and invalidation. | DS-02 and DS-03; related state-transition checks remain review candidates below. |
| `database-engineer` | Read Drizzle schema and the full lockdown/integrity/private-media migration chain; checked membership helpers, column grants, transaction locks, cursor precision, and actual local Storage helper definitions. | DS-01 and DS-03; real database race coverage still needs expansion. |
| `security-pentester` | Reviewed browser/API/action/Storage boundaries; reproduced media signing after membership revocation using a dedicated local identity, and privacy-contract failures using mocked action edges. | DS-01 P1 and DS-02 P2. No live exploitation or family-data access was attempted. |
| `software-architect` | Checked the single deployable, owner DB connection plus application guards, independent Data API policies, user-scoped media proxy, and domain boundaries against the product's privacy/reliability priorities. | Keep the existing overall architecture; fix the Storage operation boundary and atomic resource transitions. Optional refactors below. |
| `data-engineer` | Reviewed backup scope, history/tombstone semantics, Auth identity linkage, local fixture lineage/cleanup, and the absence of analytical pipelines. | Recovery rehearsal remains a documented gap. No warehouse, CDC pipeline, or analytical data product is warranted by current scope. |
| `code-reviewer` | Independently challenged prior fixes and tests, distinguishing execution evidence from source-only claims and comparing the privacy instructions with the previous audit's accepted message previews. | Request changes for the three proven defects; preserve the security and usability improvements already shipped. |

Only this report was added to the repository by this specialist. Temporary tests live under `/private/tmp/hoa-follow-up-audit`; no application/configuration/test-suite files were edited. Local Supabase ports were validated as API `55321` and database `55322`. Dedicated synthetic Auth/member/gathering/object fixtures were removed; a final aggregate check returned zero remaining rows/objects for every audit fixture category. Existing E2E fixture accounts were not changed.

## Confirmed defects

### DS-01 — P1: members can mint bearer media URLs that survive deactivation

**Owner:** database-engineer with security-pentester; backend-engineer validates the proxy contract.

**Sources:** `supabase/migrations/20261003175118_security_and_private_media.sql`, `house_media_read` at lines 117–119 and `house_media_read_guard` at lines 125–127; `private.can_read_media` at lines 85–90. The app proxy is `src/app/api/media/[bucket]/[...path]/route.ts`, `GET`.

Both Storage SELECT policies check active membership and bucket scope, but neither distinguishes authenticated downloads from signing operations. Supabase uses SELECT permission for more than one Storage operation. An active member can call `storage.from('feed-media').createSignedUrl(path, 86400)` directly, without the application proxy. A subsequently deactivated member, or anyone holding that URL, can still retrieve the image anonymously until the signed URL expires.

**Executed local proof:** a separate synthetic member uploaded a one-pixel PNG, minted a 24-hour signed URL, and was deactivated. Results:

```json
{
  "activeMemberCanMintSignedUrl": true,
  "authenticatedDownloadDeniedAfterDeactivation": true,
  "anonymousSignedDownloadStatusAfterDeactivation": 200,
  "anonymousSignedDownloadBytesMatch": true,
  "newSignedUrlDeniedAfterDeactivation": true,
  "syntheticObjectCleaned": true,
  "syntheticAuthCleaned": true
}
```

The probe downloaded the object through the signed URL only after deactivation. This is continued retrieval from the server, distinct from a member retaining bytes or screenshots obtained while authorized. Previously obtained copies cannot be recalled and remain an unavoidable boundary.

**Impact and qualification:** this violates the stated current-membership requirement for subsequent media access. A lower-trust active guest also has media SELECT permission under the same helper, though the executed probe used a member. Production exploitation was **not** exercised. The source policy and prior release evidence establish why the same class of risk applies to an environment using these policies; target configuration must still be verified before rollout.

**Minimal remediation:** add a new migration that makes the restrictive SELECT guard operation-aware for House buckets, allowing the authenticated download/info operations needed by the current user-scoped proxy while denying signed-URL creation, including batch signing. Do not merely change the app's TTL or remove app calls: callers can invoke Storage directly. Do not add a service-role client to application code. Confirm all required operation names against the installed Storage version, and ensure an older permissive policy cannot reopen signing. The local database already contains `storage.allow_any_operation(text[])` and `storage.allow_only_operation(text)`; read-only catalog inspection confirmed exact normalized-operation matching and a false result when the operation is unset. Verify their availability on the deployment target before using them.

Preventing future signing does not invalidate existing signed URLs. Prepare a separate operator-reviewed plan for already issued URLs, supported by the target platform's capabilities. Do not blindly rotate Auth keys, delete objects, or rewrite family media references.

**Acceptance:** on fresh and upgraded isolated projects, verify member/guest/Elder authenticated media reads, correct Archives role scope, anonymous/non-member/deactivated denial, and refusal of both single and batch signing by client sessions. Verify the app media route still returns the expected private/no-store headers. Test restrictive-policy behavior with a synthetic legacy broad permissive policy. Record how existing bearer URLs are handled; do not claim instantaneous revocation of already issued URLs without evidence.

Primary references: [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [operation-aware Storage helpers](https://supabase.com/docs/guides/storage/schema/helper-functions), and [private asset delivery and signed URL lifetime](https://supabase.com/docs/guides/storage/serving/downloads). The latter explicitly explains that Storage signed URLs use a separate signing key and remain valid independently of Auth key changes.

### DS-02 — P2: audit metadata duplicates invitation secrets and deleted message text

**Owner:** backend-engineer with security-pentester; frontend owner updates the audit summary presentation.

**Sources:** `src/app/actions/admin.ts`, `createAccessCode` lines 58–68 and `revokeAccessCode` lines 94–99; `src/app/actions/council.ts`, `deleteMessage` lines 144–153; `src/lib/audit.ts`, `logAudit` lines 44–53; `src/app/(house)/elder-council/audit-log/page.tsx`, `summarizeMetadata` lines 29–32.

Creating or revoking an invitation sends its raw code into audit metadata. Elder message deletion copies the first 140 characters into `metadata.preview` after clearing the original message content. `logAudit` persists this metadata unchanged. The audit page deliberately displays stored invite codes. The previous host-log fix sanitizes only the `console.error` failure branch; it does not sanitize successful audit inserts.

**Executed proof:** three temporary Vitest tests invoked the real `createAccessCode`, `revokeAccessCode`, and `deleteMessage` functions with mocked auth/database/audit/cache edges. Every action succeeded, then all three privacy assertions failed: created code absent from metadata, revoked code absent from metadata, and deleted message text absent from the audit payload. These are deliberately red regression contracts, not failures of the committed test suite. No actual invitation, message, or production data was involved.

**Impact and qualification:** unnecessary sensitive-data duplication and retention, contrary to the current `AGENTS.md` instruction that invite codes and message text must not leak through logs. Audit access is Elder-only and the table's browser Data API access is denied. No lower-role or anonymous disclosure was proven, so this is P2, not a public-data-exposure claim. The prior audit explicitly called the preview intentional; that statement conflicts with today's stronger repository privacy instruction and should be reconciled rather than silently carried forward.

**Minimal remediation:** use a typed, per-action metadata allow-list containing entity IDs, action state, safe labels/counts, and other necessary accountability fields. Remove raw invitation codes and content previews from audit writes; apply the same content minimization to Wall post/comment moderation previews. Update audit summaries to identify invitations by label or non-secret entity reference. Scope any cleanup of existing audit metadata to those sensitive keys, preserving event identity/actor/action/time. Review a backed-up, targeted cleanup plan before touching existing production audit rows.

**Acceptance:** permanent tests assert all affected actions still mutate and record accountability while raw invite codes, message/post/comment text, auth IDs, and contact fields are absent from allowed audit payloads. Test successful and failed audit-sink paths. Keep the audit page useful and verify it renders no secret codes, including old metadata if retained temporarily. Do not strip information needed to identify the affected entity.

### DS-03 — P2: a concurrent archive can turn a successful edit into a hidden future gathering

**Owner:** backend-engineer with database-engineer; QA owns a real interleaving regression.

**Sources:** `src/app/actions/gatherings.ts`, `updateGathering` state read at lines 113–132 and unconditional-ID update at lines 146–160; `archivePastGatherings` at lines 224–253.

The action checks that a gathering is not cancelled or archived before validation, then later writes by `id` alone. If an Elder's archival update commits between those operations, the edit still succeeds and can move the date into the future without clearing `archived_at`. That future gathering remains excluded from normal lists and cannot be edited through the ordinary UI.

**Executed real local proof:** a temporary Vitest test imported the real action and real Drizzle connection, mocking only auth/cache/audit. It created one dedicated past gathering, intercepted completion of the action's initial read, committed an archive update to that same fixture, then let the action reschedule it to 2099. The write and resulting persisted row were real PostgreSQL operations. Output:

```json
{
  "actionAcknowledged": true,
  "archived": true,
  "future": true,
  "interleavingExecuted": true
}
```

The contract asserting that the action cannot acknowledge a hidden future event failed. The injected competing archive write targeted only the synthetic row; this was a controlled interleaving, not a timing-based production stress test. Cleanup removed the gathering and its synthetic member/Auth identities.

**Minimal remediation:** include the still-active resource-state predicates in the UPDATE itself, use `returning()` to distinguish zero affected rows, and return a friendly conflict when the event was archived/cancelled after it was loaded. Alternatively serialize the relevant transitions under the same row lock if that better serves the complete event contract. Preserve ownership/role checks and ensure the bulk archiver reevaluates the effective end time when racing a reschedule. Do not auto-unarchive a row merely to make the edit succeed.

**Acceptance:** real isolated database tests cover both orders of archive versus reschedule and cancel versus edit. If archival/cancellation wins, the action returns a recoverable refusal and leaves that state intact; if rescheduling wins first, the archiver does not archive the future event. Existing all-day/timed-event validations, ownership checks, and route refresh behavior stay green.

## Prior work independently checked

These protections remain present in source and should be preserved during Claude's fixes:

- `getAuthContext` verifies the Supabase identity and resolves active membership/role from PostgreSQL, rather than user metadata. Private pages and streamed Wall reads authorize before their data query.
- Onboarding performs the same-user retry check again under its transaction advisory lock and locks the invite row before redemption. Member administration shares a separate transaction lock and rechecks the actor, protecting the final active Elder through the application write path.
- Browser Data API permissions are narrow: byline member columns and channel-scoped messages. Private chamber access checks the current role; archived chambers deny reads. The security-definer membership helpers have explicit execution grants, a non-exposed schema, and an empty search path.
- The media proxy checks membership independently, constrains buckets/paths/types, and downloads with the caller's session. Ownership validation constrains post/avatar references to the caller's namespace. DS-01 concerns another Storage operation that the proxy does not control, not removal of these useful protections.
- Council startup now awaits realtime authentication and distinguishes socket join from database-stream readiness. Cursor comparisons preserve PostgreSQL microsecond ordering. Soft-deleted messages become content-free tombstones for ordinary client reads.
- Invite caps, RSVP uniqueness, reaction uniqueness, gathering time order, and stable message reply references have database enforcement or appropriate atomic upserts. Settings update their related rows in one transaction.
- The backup script keeps passwords out of process arguments, creates private unique output directories, guards local output paths, and writes its completion manifest only after requested work succeeds. Its Auth omission is explicit rather than disguised as complete disaster recovery.

This pass did not repeat the prior live RLS/catalog audit or production browser journeys. Those historical checks remain evidence of the earlier release, not new verification. Root owns the fresh full-suite results for this follow-up.

## Verification gaps and targeted review candidates

| ID | Type | What remains and why |
|---|---|---|
| DS-V01 | Verification gap | Real concurrent invite redemption/revocation and final-Elder demotion/deactivation tests remain needed. Existing mocks serialize their own transaction queue, and the ordinary policy suite does not reproduce multi-connection transaction contention. The source locking is encouraging; it is not a substitute for a race test. |
| DS-V02 | Verification gap | Complete identity-preserving restore and Storage object restore have not been rehearsed in this audit. The documented public-schema dump excludes Auth identities and private helper schema; successful dump creation alone cannot prove fresh-project recovery. Follow the existing recovery runbook rather than inventing account relinking. |
| DS-V03 | Review candidate | `sendMessage`, `addComment`, `updateRsvp`, and cancellation/archive state changes also perform separated resource-state reads and writes. Trace each permitted interleaving and reproduce any consequential failure before filing an additional confirmed finding. DS-03 proves one instance only. |
| DS-V04 | Verification gap | Test current-membership revocation on an already connected realtime subscription and check that no new private event arrives after deactivation/demotion. SQL policy tests cover role snapshots; they do not alone prove all stream lifecycles. |
| DS-V05 | Confirmed in the experience lane | `message-sync.ts::reconcile` intentionally preserves loaded messages older than the latest full 100-row snapshot. The coordinator's completed local browser/SQL probe confirmed that a missed older deletion survives a fresh recovery snapshot. Track implementation under [UX-06](experience.md#ux-06--p2--recovery-cannot-remove-a-missed-deletion-from-loaded-older-history), not as a duplicate defect. |

Shared-store rate limiting, best-effort rather than transactional audit logging, and full script-source CSP remain already documented architectural limitations. They are not newly discovered authorization defects. The process-local limiter is not grounds to bolt on unrelated infrastructure without a threat/cost decision.

## Optional refactors, after correctness fixes

1. **Narrow action/domain boundaries where they improve tested invariants.** Extract the event state-transition predicate/conditional write and typed audit-payload builders; keep Next cache invalidation at the action boundary. Do not rewrite every simple CRUD action into a repository framework merely to follow generic persona prose.
2. **Make replay behavior explicit for create operations.** Onboarding already has retry recovery; Wall posts, messages, and gatherings rely primarily on client pending guards. Consider client-generated operation IDs with unique server enforcement if uncertain-response retries are a observed family problem. Treat this as a focused design decision with a real retry test, not an immediate distributed queue/outbox project.
3. **Use lightweight decision records for the load-bearing choices.** Record the single-House deployment boundary, privileged server database plus separate browser RLS, operation-constrained media access, and backup identity scope. The existing architecture vault is substantial; add rationale and fitness checks where missing rather than duplicating it wholesale.
4. **Keep query optimization evidence-driven.** The Wall uses offset pagination and includes all live comments/reactions for each page. This can grow, but no production latency defect was measured here. A stable cursor and bounded secondary collections are future candidates after representative-size query plans show a need.

## Intentional exclusions

No organizations, billing/subscriptions, public social feed, warehouse/BI stack, CDC infrastructure, notification service, Archives UI, family-tree UI, or offline application was inferred as missing work. Retained historical tables are not advertisements for shipped features. No legal/privacy certification, universal security guarantee, or production performance percentile is asserted.

## Executed evidence and reproducibility

| Check | Result | Scope |
|---|---|---|
| Temporary action audit-payload contracts | **3 deliberately red tests** | Real action code; mocked external edges; confirms DS-02. |
| Temporary archival/reschedule contract | **1 deliberately red test** | Real action and local Drizzle/PostgreSQL; confirms DS-03. |
| Local signed-media revocation probe | **Defect reproduced** | Active member signs; revoked member cannot download normally; anonymous signed GET still returns matching bytes. |
| Storage helper catalog inspection | **Passed** | Both operation-aware helper definitions present in the current isolated stack. |
| Synthetic fixture cleanup inventory | **Passed** | `auth_rows=0`, `member_rows=0`, `gathering_rows=0`, `object_rows=0`. |
| Production exploitation or family-data fixtures | **Not run** | Explicitly outside this audit's execution scope. |
| Full restored-project recovery/concurrency stress | **Not run** | Verification work remains as described above. |

Temporary evidence paths are `/private/tmp/hoa-follow-up-audit/privacy.test.ts`, `gathering-race.test.ts`, `storage-revocation.mjs`, and `vitest.config.mts`. They use the guarded local E2E environment; no credentials or signed URLs are printed. The privacy test uses synthetic content only. Initial harness resolution/sandbox failures were corrected before the reported reproductions; those setup errors are not counted as product findings.

Use these reproductions to add durable regression tests to the appropriate owned test suites during implementation. Do not copy a temporary machine-specific test configuration into the project unchanged. The coordinator's Claude handoff should reference DS-01 through DS-03, schedule their ownership, retain the acceptance checks, and separately track DS-V01 through DS-V05.
