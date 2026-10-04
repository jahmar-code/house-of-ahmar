---
title: Design and accessibility
summary: Responsive visual rules and the checks required for accessible family flows.
source:
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/(house)/layout.tsx
  - src/components/layout/mobile-nav.tsx
  - src/components/layout/house-sidebar.tsx
  - src/components/ui/button-variants.ts
  - src/components/ui/dialog.tsx
  - src/components/ui/sheet.tsx
  - src/components/shared/confirm-dialog.tsx
  - src/components/shared/hydrated-fieldset.tsx
  - src/components/shared/activity-time.tsx
  - src/components/shared/use-modal-focus-guard-names.ts
  - src/components/gatherings/gathering-form.tsx
  - src/components/feed/post-card.tsx
  - src/app/(house)/members/[id]/page.tsx
  - src/app/(house)/gatherings/[id]/page.tsx
  - tests/e2e/helpers.ts
verified: 2026-10-03
tags: [design, accessibility]
---

# Design and accessibility

The visual language is dark neutral surfaces, high-contrast text, one orange accent, and a restrained sans-serif type scale. Semantic Tailwind tokens in `globals.css` are authoritative. Historic `gold` or heading aliases do not imply a second visual system. Lucide supplies UI icons; fixed reaction glyphs are the deliberate exception.

## Responsive shell

Desktop uses a sidebar; narrower screens use a sticky header and bottom navigation. Content padding accounts for fixed chrome and device safe areas. The root viewport configuration and shell safe-area rules belong together. Council's available height must keep its message composer above navigation and the software keyboard.

Content must reflow at narrow widths, long names, larger system text, and zoom. User-supplied text that can be one long word or link, such as profile names, bios, email and gathering locations, uses `wrap-anywhere` rather than clipping inside its card; the browser `checkLayout` helper fails when any clipping box in `main` hides content horizontally. Avoid relying on hover for essential actions; provide keyboard and touch access. Wide admin tables need an intentional compact or scrollable presentation with visible controls.

## Interaction contract

- Every input has a persistent label and useful constraints; errors identify a recovery step.
- The Wall, profile, sign-in, signup, forgotten-password, and gathering forms use `HydratedFieldset` to defer editing until their controlled input handlers are attached. The fieldset preserves the rendered layout and native disabled semantics during this brief initialization. The gathering form also passes `disabled` while saving, sets `aria-busy`, and returns focus to Save after a failure.
- Hydrated activity timestamps use `ActivityTime` to render a stable initial placeholder before browser-local clock/relative text. Server and browser clocks or timezones must not produce different hydration text.
- Buttons and links retain visible focus, sufficient contrast, and comfortable touch targets. Do not offer a control or link the viewer's role cannot use; show read-only state instead, as the Wall does for guests' reaction counts.
- Destructive actions use the shared confirmation pattern, name the affected content, disable during submission, and explain failures.
- Dialogs support Escape, sensible initial focus, focus return, and keyboard navigation.
- Shared dialogs and navigation sheets name Base UI's Safari-only focus boundary buttons through `useModalFocusGuardNames`. The adapter preserves their roles, tab order, and focus handlers for VoiceOver; it watches only the current portal and labels unnamed adjacent guards. This addresses the [upstream unnamed-guard issue](https://github.com/mui/base-ui/issues/5237) without hiding the Safari controls from assistive technology.
- Successful actions update the visible list/count/state. A toast alone is not proof of a completed flow.
- A skip link moves focus to the main content. Loading regions and important asynchronous errors have accessible status semantics.
- Respect reduced motion and preserve reading position in chat. A newly published Wall post scrolls into view smoothly, or instantly under reduced motion. New messages below the reader get a deliberate jump-to-latest affordance.
- Images have meaningful alternative text when content-bearing; decorative imagery does not create repeated screen-reader noise.

## Verification expectations

Inspect mobile and desktop with actual content, empty lists, invalid inputs, loading, failure, and long text. Cover keyboard-only operation, focus order, dialog return, chat keyboard overlap, safe areas, and zoom. Automated accessibility checks are useful regression coverage, not a WCAG conformance certificate. Record browser/version, viewport, role, and screenshots in the [audit evidence](../../audits/2026-10-03/README.md).

Do not mark the UX perfect based on screenshots alone. Confirm task completion and permissions through [participation flows](../30-flows/participate-and-moderate.md).
