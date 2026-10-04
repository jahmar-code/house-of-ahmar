---
title: Membership and invitations
summary: How a Supabase identity becomes a family member and stays authorized.
source:
  - src/app/actions/onboarding.ts
  - src/app/actions/members.ts
  - src/app/actions/admin.ts
  - src/lib/auth.ts
  - src/lib/validators.ts
  - src/app/initiation/page.tsx
  - src/app/(house)/members/page.tsx
  - src/app/(house)/members/[id]/page.tsx
  - src/app/(house)/settings/profile-settings-form.tsx
  - src/components/shared/hydrated-fieldset.tsx
  - src/components/gatherings/gathering-date.tsx
  - src/app/actions/concurrency.database.test.ts
verified: 2026-10-03
tags: [membership, auth]
---

# Membership and invitations

An Auth user may exist without membership. Initiation creates the application member only after a valid invite is redeemed. An inactive member is still a historical identity, not a new joiner.

## Invitation lifecycle

Elders generate random uppercase codes with optional labels, expiry, and bounded uses. Revocation closes a code regardless of remaining uses. Creation and revocation are audited by label and entity ID; the code itself is never copied into the audit trail. Validation on the first screen is advisory: `completeInitiation` checks and redeems the code again on the server.

The founding-Elder path is serialized with the same transaction as code redemption. `HOA_DEFAULT_ACCESS_CODE` can create the first member only; it is not a permanent master invitation. Remove it after founding. A successful ordinary invite creates a member, not an Elder. Expiry/use counters are authoritative in Postgres; retries must not spend the code twice.

Membership no longer requires a Supabase metadata update. A retry resolves an existing active member; the transaction rechecks the same-user race after acquiring the invite lock. Inactive membership is rejected and never reactivated by initiation. Role and deactivation operations are Elder-only and must preserve at least one active Elder, including concurrent attempts.

## Profiles and discovery

Members edit their own display/full name, biography, birthday, phone, and avatar. An absent avatar field preserves the photo; an explicitly empty field removes it. Birthday validation rejects impossible or future dates and uses a date-only representation. Media input must reference authorized House storage rather than an arbitrary external tracker.

The controlled profile form uses `HydratedFieldset` to keep inputs and the file chooser disabled until client handlers are attached. This prevents early keystrokes or photo selections from being lost or overwritten while a cold page hydrates. Failed requests preserve the controlled draft.

Our People queries only directory fields (ID, display name, avatar, role, bio, and last-seen time), lists active members, and links to profiles. Profiles show public family information, recent posts, upcoming attended gatherings, and contact details where the viewing role permits them. A guest may see their own contact information but not another relative's. Deactivated profiles are not exposed by direct ID links. Valid names, full names, bios, email and empty-state text wrap anywhere instead of clipping, so a single long word or link stays inside the card at 320px. "Coming up" uses `GatheringDate` with `style="date"`, the same viewer-local timed / stored all-day day as the [gatherings](gatherings.md) pages.

Presence is approximate: a client heartbeat updates `last_seen_at`; the timeout defines online status. It is not a read receipt or an exact session audit.

## Verify

Exercise first-member bootstrap, ordinary invitation, used/expired/revoked codes, simultaneous redemptions, retry after an interrupted response, inactive-user sign-in, guest profile access, avatar removal, impossible birthdays, and concurrent attempts to remove the final Elder. `concurrency.database.test.ts` exercises last-use redemption, founding-Elder creation, duplicate retry, and Elder demote/deactivate races on real PostgreSQL connections, including failure injection that proves a missing lock would be caught. See [join and recover](../30-flows/join-and-recover.md) and [auth security](../10-architecture/auth-and-security.md).
