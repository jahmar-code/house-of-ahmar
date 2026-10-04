---
title: Server Actions reference
summary: Mutation entry points and their required identities.
source:
  - src/app/actions/admin.ts
  - src/app/actions/council.ts
  - src/app/actions/feed.ts
  - src/app/actions/gatherings.ts
  - src/app/actions/members.ts
  - src/app/actions/onboarding.ts
  - src/app/actions/presence.ts
  - src/app/actions/settings.ts
  - src/lib/constants.ts
verified: 2026-10-03
tags: [reference, actions]
---

# Server Actions reference

Actions live in `src/app/actions`. Caller-supplied IDs, strings, enums, media, and role values are untrusted at runtime. See [validators](validators.md) for shape limits and [media security](../10-architecture/auth-and-security.md) for resource authorization. The table names public action symbols; inspect the current source before extending their contract.

| Module | Symbols | Boundary |
|---|---|---|
| `onboarding.ts` | `validateAccessCode`, `completeInitiation` | Verified Supabase user; invite validation/redemption and active-membership recovery |
| `feed.ts` | `createPost`, `addComment`, `toggleReaction` | Member or Elder; announcement creation Elder-only |
| `feed.ts` | `togglePostPin` | Elder |
| `feed.ts` | `deletePost`, `deleteComment` | Active author or Elder |
| `gatherings.ts` | `createGathering` | Member or Elder |
| `gatherings.ts` | `updateGathering`, `cancelGathering`, `uncancelGathering` | Active creator or Elder; state rechecked inside the conditional UPDATE, recoverable conflict when an archive/cancel landed after the read |
| `gatherings.ts` | `updateRsvp` | Any active member, including guest; available target |
| `gatherings.ts` | `archivePastGatherings` | Elder; bounded threshold |
| `council.ts` | `loadOlderMessages` | Active member with chamber visibility and validated cursor |
| `council.ts` | `findRemovedMessages` | Same chamber visibility; at most `LOADED_HISTORY_CHECK_LIMIT` valid IDs; returns loaded IDs no longer live |
| `council.ts` | `sendMessage` | Member/Elder with chamber-type and archival checks; announcements Elder-only |
| `council.ts` | `deleteMessage` | Active author or Elder |
| `council.ts` | `createChannel`, `renameChannel`, `archiveChannel`, `unarchiveChannel` | Elder |
| `members.ts` | `updateProfile` | Active member, own profile |
| `members.ts` | `updateMemberRole`, `deactivateMember`, `reactivateMember` | Elder; final-active-Elder invariant |
| `admin.ts` | `createAccessCode`, `revokeAccessCode` | Elder |
| `settings.ts` | `updateHouseSettings` | Elder |
| `presence.ts` | `heartbeat` | Active member context |

Discover additions:

```bash
rg '^export async function' src/app/actions
```

## Revalidation

Cross-surface changes should invalidate all affected pages: feed actions reach Wall/Great Hall; gathering changes reach list/summary/detail; identity changes reach bylines/profile/settings; chamber changes reach Council/admin lists and current chamber. Client state may still require `router.refresh()` or explicit reconciliation. Auth failures may throw; client callers must handle unexpected failures separately from returned validation errors.

`updateHouseSettings` invalidates `/` with the `layout` scope because House identity also appears in prerendered public account pages. Invalidating only the gate and dashboard would leave those cached monograms stale.

See the domain notes for state/ownership constraints and [architecture](../10-architecture/system-architecture.md) for transaction boundaries. A function appearing in this table is not a statement that its database path has passed integration tests.
