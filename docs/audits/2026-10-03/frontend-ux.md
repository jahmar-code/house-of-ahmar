# Frontend, UX, accessibility, mobile, and performance audit

Audit date: 2026-10-03. Scope: current working tree, preserving the existing uncommitted redesign. This report covers the frontend-engineer, UX-designer, UX-researcher, accessibility-specialist, mobile-engineer, and performance-engineer lanes from `../agents_md` together with the local project personas and `CLAUDE.md`.

## Product intent

House of Ahmar is one family's private home. The primary jobs are joining through a family invitation, seeing recent family news, sharing photos and milestones, arranging gatherings, responding to invitations, and talking in Council chambers. Elders keep the home organized and admit relatives. The existing neutral/orange, dark-only design and affectionate House vocabulary are intentional and retained.

A relative should be able to recover from a failed request without losing a draft, reach past family memories, see accurate gathering times, and understand whether they can contribute in a particular space. Private media must remain authenticated even when displayed in a thumbnail or full-screen viewer.

## Findings and completed fixes

| Finding | Outcome | Verification |
| --- | --- | --- |
| Council Enter could send twice during a pending request and send unfinished IME composition. | Synchronous in-flight guard; Enter respects composition; input becomes read-only while sending and regains focus afterward. | Typecheck; browser coverage owned by root QA lane. |
| Council composer could erase text typed during a request. | Draft is read-only until the send resolves; failed drafts remain intact. | Code-path review. |
| Council refresh retained deleted newest/all messages and stale author details when IDs were unchanged. | Timestamped authoritative snapshots reconcile deletion windows while preserving newer realtime arrivals and loaded earlier history. | Dedicated Vitest regressions. |
| Late author hydration could resurrect a message already deleted through Realtime. | Deletion tombstones are checked before inserting the hydrated row. | Code-path review. |
| A message could fall between initial server load and the initial subscription. | First subscribe and reconnect both refresh the server snapshot. | Code-path review. |
| Council history stopped at the newest 100 messages. | Load-earlier control calls the role-gated cursor action, deduplicates history, and preserves the scroll position. | Typecheck; backend action tested in its own lane. |
| Announcement chambers showed a composer to ordinary members. | UI follows the new elder-only server rule, with a plain-language read-only explanation. Guests also receive an explanation. | Permission agreement with backend lane. |
| Wall history stopped at 50 posts. | Stable sorted, 50-post pages with Newer/Older navigation and explicit end states. | Typecheck; query and link review. |
| Archived gatherings vanished from all navigation. | Current/Archived views retain access to old gathering pages and RSVPs. | Typecheck; query and link review. |
| Posted images were permanently cropped. | Accessible full-photo dialog, previous/next controls, arrow keys, Escape, and image position announcement. | Browser verification below. |
| Private image URLs could be sent through the public Next image optimizer. | Feed thumbnails and full-size photos use direct authenticated browser requests (`unoptimized`). | Backend security integration review. |
| Migrated private cover URLs would break the unauthenticated gate or native URL input validation. | Gate omits private covers; settings accepts relative private media paths while server validation remains authoritative. External cover visibility is explained. | Typecheck; code-path review. |
| Multiple action forms stayed busy after thrown network/auth errors. | Auth, initiation, posts/comments/reactions/pins, RSVP, gatherings, chamber/settings/invites, profile upload, and restore flows recover with feedback and preserve drafts. | Typecheck and lint. |
| Confirmation dialogs closed after returned business failures or detached archive transitions. | Confirm handlers report failure, retain the dialog, show recoverable feedback, and await actual archive completion. | Typecheck; handler review. |
| Sign-out ignored returned errors. | Failed sign-out displays feedback instead of navigating as if the session ended. | Code-path review. |
| Background heartbeat rejection escaped as an unhandled promise. | Temporary heartbeat failure is contained; the next scheduled heartbeat retries. | Code-path review. |
| Gathering times were rendered in the deployment server timezone. | Small client date leaf renders timed events in the reader's device timezone with a hydration-safe placeholder; all-day events use UTC calendar-day semantics consistently across creation, editing, and display. | Typecheck; 9 regression cases in Toronto, Honolulu, and Auckland. |
| Cancel on a directly opened gathering form could navigate out of the app. | Cancel navigates to its gathering/detail or list explicitly. | Link/handler review. |
| Installed phone viewport could put the header under a status bar. | Top safe-area padding and matching Council height calculation; existing side/bottom safe-area padding retained. | Browser/mobile visual verification below. |
| Long gathering locations and descriptions could overflow compact layouts. | Wrapping and truncation are applied within constrained flex children. | Browser/mobile visual verification below. |
| Sidebar could overflow short desktop windows. | Navigation scrolls independently while account controls remain reachable. | Layout review. |
| Cold page input could arrive before controlled form handlers attached, dropping a Wall caption or combining profile biography text. | A reusable hydration-aware fieldset keeps Wall/profile and account-entry inputs disabled until their client handlers are ready. | Reproduced in WebKit Wall and Chromium profile browser traces; integrated rerun recorded in verification ledger. |
| Changing the House name left prerendered public account-page monograms stale. | Settings save invalidates the root layout and all descendants. | Permanent Elder-save/public-brand regression warms account routes first and restores fixture settings afterward. |
| Relative timestamps could cross a minute boundary during Wall hydration; Council times also used the server timezone in their initial HTML. | `ActivityTime` shares a stable server/initial-browser placeholder, then renders the reader's relative or local clock time. | WebKit trace reproduced a text hydration error on the Wall; the Council regression now reloads a second session in Honolulu and asserts zero page errors. |
| Base UI's Safari focus guards were exposed as unnamed buttons while a photo dialog was open. | Shared dialogs and sheets name the adjacent guards while preserving their roles, tab order, and focus handlers. | The browser journey retains unfiltered axe checks, adds forward/backward modal focus containment, and checks the open navigation sheet. Final rerun evidence is in the verification ledger. |

## Accessibility and interaction review

Uploaded-avatar image alternatives were audited separately because empty fixture avatars do not exercise image accessibility: decorative portraits next to names use empty alternatives, and portrait-only attendee stacks use each member's display name. Long reply-author names are constrained so they cannot force horizontal chat overflow.

The existing shared Base UI primitives are retained. Controls have accessible names, form labels, aria-invalid/error associations where applicable, visible keyboard focus, and explicit pending states. Council announces new messages through a log, preserves readers' scroll position, and exposes a new-message jump control. Destructive operations require a confirmation that names the affected content/person. Navigation landmarks now have distinct names; the existing skip link, heading hierarchy, reduced-motion rules, and 44px primary mobile controls remain.

The photo viewer uses the shared modal's focus trap and Escape behavior. Arrow-key navigation is scoped to its dialog. Full-size images retain meaningful context labels; these labels describe who shared a photo, not the semantic content of the photo itself. Author-provided alternative text remains a potential enhancement, not an implemented capability.

Safari intentionally exposes Base UI focus boundaries as buttons so VoiceOver can trigger their focus handlers. `useModalFocusGuardNames` gives those unnamed buttons descriptive first/last-control labels and observes the containing portal for late role assignment or guard replacement. It does not alter focus behavior or hide the guards. This bounded adapter addresses the [upstream accessibility issue](https://github.com/mui/base-ui/issues/5237); automated WebKit focus containment and axe checks complement, but do not replace, a physical Safari/VoiceOver session.

No claim of full WCAG conformance is made from static review alone. Automated axe checks and actual browser results are recorded by the root QA lane; screen-reader use, touch keyboards, zoom, and physical-device behavior require their own evidence.

## Performance assessment

No performance-speedup claim is made without a before/after trace. The existing streamed Wall boundary, server-rendered pages, public byline projections, bounded initial chat query, reserved image geometry, visibility-aware presence, and reduced-motion handling are preserved. Feed pagination makes older content reachable with bounded per-page reads. Conversation history is loaded only on request.

The required privacy change deliberately bypasses the image optimizer, so uploaded image sizes matter; existing byte and count caps remain. Responsive image generation and field Core Web Vitals should be measured before claiming image delivery is optimized. No production load testing was run in this frontend lane.

## Live browser findings

A separate production server on loopback port 3101 used only the isolated local Supabase fixtures. Headless Chromium visited 44 route/role/viewport combinations: member and Elder screens at 375×812 and 1440×1000. No document-width overflow, broken loaded images, or uncaught page JavaScript errors were detected. Representative dashboard, Wall, gathering form, and member-management screenshots were visually inspected.

This pass found weak/invisible form boundaries on dark cards and a truncated mobile statistics label. A later root-suite pass added a long-name relative and exposed a 420px-wide directory on a 375px viewport; the directory now uses an explicit `minmax(0, 1fr)` mobile column and shrinkable links/text. Root axe also found insufficient contrast on the expired reset-link message; the shared destructive/crimson token was brightened for readable error text across dark surfaces. The input token now provides a visible outline; the label wraps. Root's axe run found color-only inline authentication links, which now have permanent underlines across sign-in, sign-up, recovery, and member contact surfaces. Archived gathering detail now suppresses inapplicable edit/cancel/RSVP controls and explains the preserved read-only state. Root rebuilds and runs the complete cross-browser suite after these changes.

## Verification evidence

- `npx tsc --noEmit`: passed after integration of the frontend changes and backend history-action contract.
- `npx eslint src/components src/app`: passed during the audit; final repository gate is run by the root agent.
- `npx vitest run src/components/council/message-sync.test.ts`: 7 regression cases passed (empty/deleted history, new realtime arrivals, changed author/content, deleted tail rows, retained older history, stable timestamp ties, retained history at a tied cursor boundary).
- `npx vitest run src/components/gatherings/calendar-date.test.ts src/components/council/message-sync.test.ts`: 16 tests passed after the calendar fix.
- Root QA owns the complete build, repository checks, cross-browser functional tests, and release evidence.

## Independent interaction regression coverage

The final review added `tests/e2e/interactions.spec.ts` to the same isolated three-project browser harness. Its four journeys verify two-photo arrow navigation and Escape/focus return, mobile menu focus return, authenticated avatar persistence and anonymous denial, IME composition and a deliberately held send request, mobile composer clearance, and all-day display/editing in Honolulu and Auckland. The send test checks that a repeated Enter produces exactly one Server Action request while the draft is read-only. The gathering journey includes a valid, long unbroken location to check reflow.

The route sweep in `house.spec.ts` retains its zero-page-error assertion. A WebKit trace identified a canceled RSC prefetch exactly when the harness redundantly reloaded the just-opened dashboard; the harness now keeps the existing dashboard and lets background requests finish before subsequent deliberate full-document probes. It does not filter browser errors.

The added open-menu axe check initially sampled a mobile sheet 86ms into its 200ms entry animation, yielding dimmed temporary foreground colors and inconsistent background overlap. The shared helper now awaits actual finite animation completion before unfiltered axe analysis. The cross-timezone Council reload regression uses the same background-request sequencing as the route sweep; its trace showed a canceled dashboard prefetch 8ms after deliberate document replacement, rather than a hydration failure.

The first hosted Linux WebKit run also sent an arrow key before Base UI's animation-frame initial-focus handoff. The trace still showed the entering-dialog state when the key was sent, and the eventual screenshot showed the first photo control focused. The photo test now explicitly asserts focus has entered the dialog before navigation, matching the navigation-sheet readiness check. It still requires actual arrow-key behavior, forward/backward containment, Escape, and focus return; no programmatic focus is inserted before the first arrow.

The independent visual review inspected the integrated desktop Great Hall and Wall, plus the 375px mobile Great Hall, member directory, and gathering list screenshots. Long directory names remained within their cards, mobile statistics labels wrapped, and gathering summaries stayed within the screen. Actual execution totals, infrastructure failures, and the final rerun outcome belong to the [verification ledger](verification.md). These checks do not emulate a physical software keyboard or establish screen-reader conformance.

## Limits and follow-up evidence

- All-day gatherings now encode calendar days as UTC midnight through 23:59:59.999, and display/edit the UTC date without timezone conversion. A read-only aggregate check by the backend lane found zero existing live all-day gatherings before establishing the convention, so no ambiguous family dates were rewritten. Timed gatherings still use absolute instants shown in the reader's timezone; a named event timezone is not stored.
- The UI supports expiry/failure states and local recovery; it does not provide offline draft persistence or offline writes.
- Wall pagination uses stable ordered offsets. Simultaneous insertions/pin changes may shift page boundaries until refresh; cursor pagination is a future improvement if activity warrants it.
- Manual assistive-technology and physical iOS/Android keyboard coverage should complement the automated browser suite.
