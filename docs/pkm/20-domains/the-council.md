---
title: The Council
summary: Realtime chat, chamber visibility, reply integrity, and failure recovery.
source:
  - src/app/actions/council.ts
  - src/app/(house)/council/page.tsx
  - src/app/(house)/council/[channelId]/page.tsx
  - src/components/council/realtime-message-list.tsx
  - src/components/council/message-row.tsx
  - src/components/shared/activity-time.tsx
  - src/components/council/message-sync.ts
  - src/components/council/message-input.tsx
  - src/lib/db/message-projection.ts
  - src/lib/message-order.ts
  - src/lib/constants.ts
  - tests/e2e/realtime-recovery.spec.ts
  - tests/e2e/follow-up.spec.ts
  - supabase/migrations
verified: 2026-10-03
tags: [council, realtime]
---

# The Council

Council is a set of chambers backed by `channels` and `messages`. General chambers support member conversation; private chambers are Elder-only. Announcement chambers are intended for Elder announcements with permitted members able to read. Archived chambers disappear from normal lists and reject new messages; Elders may reopen them.

## Read and write paths

A Server Component loads the most recent 100 messages and public author projections in reverse chronological order, then presents oldest-to-newest for chat. Load earlier messages calls `loadOlderMessages` for pages of 50; the action checks active membership/chamber access and uses the oldest message ID to resolve a `(created_at, id)` cursor. A browser subscription listens for database changes scoped to the chamber. Browser policy enforcement must agree with server visibility; no direct client message writes are required.

`MESSAGE_PRECISION_COLUMNS` carries PostgreSQL microseconds separately from display `Date` values. `compareMessages` uses that exact timestamp and the ID tie-breaker for refreshed snapshots and realtime arrivals, so messages within one millisecond retain database order and pagination cannot skip them.

History cursors keep timestamps inside PostgreSQL. Server projections also carry `createdAtMicros`, and realtime timestamps retain their fractional precision through `message-order.ts`. Both paths sort by microseconds and then message ID. JavaScript `Date` remains useful for display but must not decide ordering among rows created within the same millisecond.

`MessageRow` renders display timestamps through `ActivityTime`. Its server and initial browser output use the same placeholder, then show today's clock time or older relative text in the reader's timezone, with a full local date tooltip. A server deployed in UTC must not cause a text hydration mismatch for a relative in another timezone.

`sendMessage` validates content, target channel, archival/type permissions, and optional reply ID. A reply must reference a live message in the same chamber. A quote from another chamber is not accepted. The author or an Elder can soft-delete; moderation of another person's message is audited with its author and chamber, never the removed words.

Channel creation/rename/archive/reopen are Elder-only. Slugs are stable through rename. Similar/conflicting names surface actionable errors instead of raw database exceptions.

## Reconciliation and resilience

Realtime is one delivery path, not the only one. `realtime-message-list.tsx` also incorporates refreshed server data and refreshes around connection recovery. `message-sync.ts` centralizes ordering/deduplication/reconciliation. A removed message must disappear even when an update event is missed or the refreshed server window becomes empty.

The refreshed snapshot covers only the newest 100 rows, so it cannot vouch for older history the reader loaded with "Load earlier". When more than 100 rows are loaded, `verifyLoadedHistory` calls `findRemovedMessages(channelId, ids)` after the database stream reports ready (including after recovery), on rejoin, and on return to the tab, throttled like the ordinary refresh except after stream recovery. The action applies the same chamber read rules as `loadOlderMessages`, refuses malformed input or more than `LOADED_HISTORY_CHECK_LIMIT` (500) IDs before reading, and returns the IDs that are no longer live; the client batches larger histories and removes only those rows, keeping the reader's position. A failed check changes nothing on screen and the next recovery tries again.

The UI distinguishes connection states and provides recovery feedback. It preserves the reader's position when new messages arrive below them, provides a jump-to-latest action, and respects reduced motion. The composer needs access above mobile bottom navigation and the software keyboard.

Socket subscription and database-stream readiness are separate. A `postgres_changes` system error or timeout shows the reconnecting notice even after the socket joins. A successful system event forces a fresh snapshot, bypassing the ordinary five-second visibility-refresh throttle so messages sent during stream setup or recovery are not missed. These are the database subscription health messages defined by the [Supabase Realtime protocol](https://supabase.com/docs/guides/realtime/protocol), separate from the optional Broadcast replication-ready notification.

Before subscribing, the effect awaits `supabase.realtime.setAuth()` so the browser client's asynchronous cookie-session initialization has supplied the user's access token. Joining earlier can attach an anonymous subscription even though server-rendered navigation is authenticated. Cleanup cancels a delayed join when the member navigates away.

## Verify

Use two authenticated browser contexts: send/reply, observe ordered arrival, remove as owner/Elder, disconnect/reconnect, refresh after missed deletion (including one in loaded older history, as `follow-up.spec.ts` does), and verify no duplicate message. Try guest writing, member access to private chambers, a reply across chambers, archived channel submission, and deactivation of a connected user. Unit reconciliation tests cannot prove live RLS delivery. See [testing strategy](../50-operations/testing-strategy.md).

Current scope excludes message attachments, full-text search, delivered notifications, and read receipts. Earlier history is available through the explicit load-earlier control.
