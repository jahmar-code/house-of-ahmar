# Experience audit — follow-up

Baseline: `f239065ad943131eece5f17ad99fded541d863e1` on 2026-10-03. This is a fresh review and targeted reproduction pass, not an implementation or a new release certification. No app source was changed. The coordinator prepared a fresh disposable Supabase stack at API/database ports 55321/55322 and production test server at 3217. Only synthetic local records were written.

## Persona coverage

All six requested sibling files were read in full, with repository instructions and product vision taking precedence over generic persona prescriptions.

| Persona from `../agents_md` | Actual coverage | Limit |
|---|---|---|
| `frontend-engineer.md` | Wall composition, reactions, pagination, photo viewer; Council state/recovery/history; gathering/profile/admin forms; responsive shell and shared primitives | Targeted probes, not every state in every engine |
| `mobile-engineer.md` | Responsive web at 390×844 and 320×812, mobile navigation/composer source, safe-area and manifest boundaries | There is no native iOS/Android/Expo app; native signing, stores, SDKs and native offline architecture are not applicable. No physical device, software-keyboard or lifecycle test was performed |
| `accessibility-specialist.md` | Native semantics and state/error wiring, prior automated evidence, 320px long-content reflow/clipping, dialog focus adapter review | No VoiceOver, NVDA, JAWS, TalkBack or switch-access session. No conformance claim |
| `performance-engineer.md` | RSC boundaries, parallel/streamed reads, bounded lists, raw image delivery and upload ceilings, absence of measurement evidence | No latency distribution, browser profile, representative photo benchmark, load/soak test or production RUM; no claim of optimized p75/p99 |
| `ux-designer.md` | Permissions versus visible actions; creation visibility; pending edits; date consistency; empty/error/success and recovery paths | Heuristic/source assessment and synthetic behavior, not observed family preferences |
| `ux-researcher.md` | Product jobs, evidence quality and proposed family-task protocol | Zero research participants; no conversion, preference or usability-rate claim |

Local evidence is under ignored `artifacts/audit-2026-10-03-follow-up/`: `experience-results.json`, `experience-history-results.json`, `wall-page-two.png`, `guest-reaction.png`, `profile-long-content.png`, and `stale-history.png`. These contain synthetic data only. The coordinator completed the final timezone/history probes and owns the consolidated verification ledger. Earlier 57-browser and production-smoke results remain previous-release evidence; they did not exercise these edge cases.

## Confirmed findings

### UX-01 — P2 — A successful post from an older Wall page is invisible

- **Source:** `src/app/(house)/feed/page.tsx`, `FeedPage`/`PostList`; `src/components/feed/post-form.tsx`, `PostForm.handleSubmit`, line 182.
- **Trigger:** Open `/feed?page=2` after the Wall contains more than 50 posts, then publish a new post.
- **Observed:** Chromium 153.0.8010.12 stayed on `/feed?page=2`; the post existed in the local database and success toast appeared, but its text occurred zero times in the page. Navigating to `/feed` showed it once.
- **Cause/impact:** The composer is present on every page, but success only refreshes the current offset. The new post sorts onto the newest page. The member cannot see the result and may retry unnecessarily.
- **Scoped fix:** Define a deterministic post-success destination or reveal the created post. At minimum navigate to the newest page and reveal the new item; account for pinned posts consuming the first page. Keep history pagination intact.
- **Acceptance:** Seed 51+ synthetic posts, publish from page 2, and assert the committed post becomes visible once without a manual navigation. Add a pinned-content case. Keep the existing first-page and photo-only tests.

### UX-02 — P2 — Guests are offered reactions that always fail

- **Source:** `src/components/feed/post-card.tsx`, `PostCard`, lines 249–262; `src/app/actions/feed.ts`, `toggleReaction`, line 227.
- **Trigger:** A Guest opens a nonempty Wall and taps a reaction.
- **Observed:** The reaction button was enabled. The server correctly refused the action; the UI displayed “Couldn't update that reaction. Please try again.” Retrying cannot succeed with the same role.
- **Cause/impact:** The composer and comment form respect `currentRole`, but reaction controls do not. This is a usability/permissions mismatch, not an authorization bypass.
- **Scoped fix:** Render readable reaction counts without an enabled mutation control for Guests, or an explicitly explained unavailable control. Preserve member/Elder toggle behavior and server enforcement. Review the related guest dashboard empty-state CTA: `UpcomingGatherings` always offers `/gatherings/new`, although that page redirects Guests back to the list.
- **Acceptance:** Guest can inspect counts without submitting reaction mutations or receiving a retry error. Member/Elder can still add/remove reactions; direct Guest mutations remain rejected. Empty-state actions must lead to allowed tasks.

### UX-03 — P2 — Valid profile text is clipped at narrow widths

- **Source:** `src/app/(house)/members/[id]/page.tsx`, `MemberProfilePage`, name/full-name/bio around lines 127–157; shared Card clips overflowing content.
- **Trigger:** A valid display name or biography contains a long unbroken token, such as a long name or URL; view the member profile at 320 CSS pixels.
- **Observed:** With a 50-character name and a 500-character biography accepted by the existing limits, the heading measured 1252.6875px inside a 320px viewport and was visibly cut off by the card. The biography was also clipped. `documentElement.scrollWidth` remained 320, so the current document-overflow assertion passed despite content loss. Screenshot: `profile-long-content.png`.
- **Impact:** Family profile content cannot be read; automated layout checks miss the clipping. Relevant accessibility concern: reflow/content visibility at narrow widths; this was exposed by browser geometry and visual inspection, not a manual screen-reader test.
- **Scoped fix:** Constrain profile text to the available width and wrap unbroken content (`overflow-wrap:anywhere` or an equivalent token-consistent rule). Review name, full name and bio together; keep readable normal-word wrapping.
- **Acceptance:** Long allowed name/full-name/bio remain readable at 320px, 390px and desktop; no hidden text or horizontal clipping. Extend layout assertions to text containment/actual bounds where cards can hide overflow. Include 200% text and 400% zoom in the manual matrix.

### UX-04 — P2 — A member's gathering summary uses a different calendar date

- **Source:** `src/app/(house)/members/[id]/page.tsx`, `MemberProfilePage` upcoming-gathering link, line 284; compare `src/components/gatherings/gathering-date.tsx`, `GatheringDate`.
- **Trigger:** A viewer's timezone and the server's timezone place a timed gathering on different dates.
- **Cause:** Profile cards directly call server `format(new Date(gathering.startsAt), ...)`, whereas gathering details and the main cards use the browser-local `GatheringDate` contract. The profile path also omits the all-day calendar conversion.
- **Observed:** The completed Auckland browser probe waited for hydrated detail text. For the same synthetic event, the profile showed “Saturday, June 15” while the detail showed “Sunday, June 16, 2030 at 2:00 PM — 3:00 PM”. The initial probe captured a detail placeholder and was inconclusive; the completed result is in `experience-history-results.json`. This proves the timed-date inconsistency; it does not replace the full all-day/multiple-server-timezone acceptance matrix.
- **Scoped fix:** Use the same date contract on profile cards, preserving all-day dates. Review `HallSummary` and birthday “today/tomorrow” wording for server-local versus viewer-local assumptions, but do not treat untested cases as proven defects.
- **Acceptance:** The same timed event near UTC midnight has the same date on its detail, member profile, list and dashboard for Honolulu and Auckland browser contexts. All-day events retain their calendar date with server TZ varied. Capture hydration errors as well as text.

### UX-05 — P2 — Gathering edits made during Save are silently discarded

- **Source:** `src/components/gatherings/gathering-form.tsx`, `GatheringForm.handleSubmit`, lines 60–119; fields around lines 135–220 and Cancel/Save controls around lines 235–255.
- **Trigger:** Submit an edit over a slow connection, then change the title or another field while the request is pending.
- **Observed:** A local Playwright route gate held the real Server Action. The title remained editable after Save changed to “Saving...”. A second title was typed. Releasing the request persisted the first submitted title and navigated away, losing the newer visible draft.
- **Cause/impact:** Only Submit disables; the handler captures `FormData` before awaiting and unconditionally navigates on success. Cancel is also still offered while the mutation is underway.
- **Scoped fix:** Make pending-state semantics consistent: freeze editable controls and prevent an in-flight “Cancel” from implying that the request was aborted, or explicitly track newer dirty edits and avoid discarding them. Apply the same review to other forms, but do not mechanically disable fields before capturing `FormData`.
- **Acceptance:** Hold a real local save request and prove that editing/canceling cannot silently lose a newer draft. On failure, the original draft must remain editable and retryable; successful saves must show the committed state once.

### UX-06 — P2 — Recovery cannot remove a missed deletion from loaded older history

- **Source:** `src/components/council/message-sync.ts`, `reconcile`, lines 39–53; `src/components/council/realtime-message-list.tsx`, `pullLatest`, recovery system callback and `handleLoadEarlier`.
- **Trigger:** Load more than 100 messages, lose the realtime deletion event for an older loaded message, and recover/refresh the subscription.
- **Cause:** The recovery snapshot contains only the latest 100 rows. `reconcile` deliberately preserves every older loaded row absent from that snapshot. Therefore it has no authoritative evidence to remove deleted older text. A full reload discards the older client window, masking this gap.
- **Observed:** The coordinator completed a real Chromium/local-PostgreSQL probe with 101 synthetic messages. After loading the older row, the probe injected a stream-health error, soft-deleted that row in SQL and dropped its realtime UPDATE. It also changed the newest row and dropped that UPDATE. After a health recovery, the HTTP 200 refresh rendered the changed newest text, proving a fresh snapshot had been applied, but the deleted older text still appeared once. A full reload removed it. The websocket transport and database were real; health events and dropped updates were controlled test injections. Evidence: `experience-history-results.json` and `stale-history.png`.
- **Scoped fix:** Reconcile the entire loaded range after recovery using authorized tombstones or a bounded range/snapshot protocol; alternatively explicitly reset the older window with understandable feedback and preserved reading context. Do not remove all old rows during ordinary successful refreshes, and do not fetch unbounded chamber history.
- **Acceptance:** With 101+ messages and loaded history, drop the old row's deletion event, delete it in another local session, recover, and assert the old text is removed without a full reload. Retain microsecond cursor ordering, pending inserts, deduplication and reader-position tests.

## Verification gaps and scoped refactors

| ID | Classification | Evidence and next action |
|---|---|---|
| UX-G01 | Required human accessibility/device verification | Prior axe/keyboard emulation is useful, but actual VoiceOver/Safari iPhone, NVDA/Firefox desktop, software-keyboard overlap, notch/landscape, dynamic text, zoom and route announcement were not tested here. Complete join, post/photo, RSVP, chat/reply and profile-save tasks with the relevant setup; record which combinations were actually exercised |
| UX-G02 | Performance measurement gap | `PostPhotos` uses full original private images with `unoptimized`; composer permits ten 8MiB photos and avatars permit 5MiB. This is a concrete transfer-size risk, not a measured latency regression. Benchmark representative camera images on throttled mobile before choosing protected thumbnail generation. Keep active-membership authorization on every derivative; do not restore public URLs/CDN caching to make it fast |
| UX-G03 | Research gap | No family usability sessions have been run. Product/UX should test 5 relatives with varying familiarity using goal-only tasks: join from an invite, share a photo, respond to a gathering, find/reply to an older message, recover access. Observe without naming controls; record assistance and task-blocking errors, anonymize notes, and revise only where observations warrant. Small-sample findings are diagnostic, not success-rate estimates |
| UX-R01 | Optional maintainability refactor | `RealtimeMessageList` combines transport lifecycle, scrolling, pagination, reconciliation and moderation in roughly 400 lines; `PostCard` and `PostForm` also combine multiple responsibilities. Extract only behind behavioral tests, with one owner and stable contracts. No rewrite is required merely to meet a line-count target |
| UX-R02 | Scoped wording/wayfinding cleanup | `ArchivePastButton` says events that “started” more than seven days ago are archived, but the action correctly uses end time where present. Correct the description. Private routes inherit the root document title; assess route-specific titles and route announcements with actual AT. `ActivityTime` has no ticking subscription, so relative labels age only when another render occurs; decide whether a shared minute-level clock materially helps this family |
| UX-R03 | Accessible photo descriptions — product decision | Generated “Photo N of M shared by [name]” labels identify navigation but do not describe the pictured content. Evaluate an optional author-supplied description/caption workflow with disabled relatives; do not assert that indexed labels alone make family photographs understandable. This requires a deliberate small data/UI change, not fabricated AI captions |

## Preserve the previous work

Keep the established dark/orange tokens, Server Component boundaries, private-media path, active-membership authorization, last-Elder/invite safeguards, soft-delete/archive contracts, microsecond message cursor, authenticated stream readiness, IME/send guard, hydration-safe controls/timestamps, focus-guard adapter, self-hosted fonts, isolated local test harness, and existing browser/SQL coverage. Avoid adding native applications, offline sync, notifications, full-text search, archives/tree UI or multi-house scope under the label of refactoring. They are unshipped capabilities, not automatic audit defects.

The follow-up should add narrow permanent regressions for the confirmed failures, then run the repository's required gates and relevant three-project browser matrix. The temporary history harness initially waited indefinitely for a streamed response to finish; the completed probe instead asserted a freshly rendered snapshot marker. That harness failure is not an additional app defect. Keep unit, browser, real database, manual-device and research evidence separate. Report unavailable environments honestly.
