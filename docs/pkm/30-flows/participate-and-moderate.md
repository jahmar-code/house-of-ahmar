---
title: Participate and moderate
summary: Trace a family action from an interactive control to persistent and refreshed state.
source:
  - src/app/actions/feed.ts
  - src/app/actions/gatherings.ts
  - src/app/actions/council.ts
  - src/components/feed/post-form.tsx
  - src/components/feed/post-card.tsx
  - src/components/gatherings/gathering-form.tsx
  - src/components/gatherings/rsvp-button.tsx
  - src/components/council/realtime-message-list.tsx
verified: 2026-10-03
tags: [flow, interaction]
---

# Participate and moderate

Every contribution has four observable stages: deliberate user input, authenticated validation, persistent change, and visible confirmation. Test all four; a success toast only demonstrates the last UI branch ran.

## Wall contribution

The composer validates text/photos, submits `createPost`, and navigates to `/feed?post=<id>`, which opens the page that now holds the new post and highlights it. The action resolves a member, validates content/media/milestone, rejects unauthorized announcements, inserts, and invalidates feed and dashboard. Card controls call comment/reaction/remove actions. Owner/Elder checks remain server-side even when the UI omits restricted controls; guests see reaction counts without reaction buttons.

Check photo-only posts, retained drafts after failure, repeated clicks while pending, pin order, deleted-target interactions, and synchronized dashboard summaries.

## Gathering and RSVP

The planner converts the input time, freezes the whole form (fields, Save and Cancel) while create/update runs, and navigates to the result; a failed save leaves the draft editable and focuses Save. An edit or cancellation that loses a race with an archive or cancellation returns a recoverable message instead of a false success. A relative can select attending/maybe/not-attending; `updateRsvp` upserts the current member's row. The control refreshes the current route so the selected status, totals, and people list agree. Cancellation blocks RSVP while retaining an understandable event; restoration reopens it. Archival preserves history and hides the old event from ordinary lists.

## Conversation and moderation

The composer calls `sendMessage` with a chamber and optional same-chamber reply. The server checks both role and chamber state, inserts, and invalidates. The local list receives the update through realtime or a server refresh and reconciles by identity/time. Deletion needs the owner/Elder gate, a confirmed action, database soft-delete, and removal from every connected view, including older history loaded before a missed deletion (`findRemovedMessages`).

## Cross-cutting acceptance

Repeat each flow as the permitted role and an unauthorized role. Check pending cancellation, server failures, offline recovery, keyboard-only navigation, long names/content, narrow screens, and a direct route reload. After moderation, verify actual data state and the audit entry where applicable; the entry identifies the content, never copies it. Do not use the live family project to generate test conversations or destructive role scenarios; use a disposable fixture environment.
