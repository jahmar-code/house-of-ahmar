---
title: Roles and vocabulary
summary: Product terms and permission boundaries for one House.
source:
  - src/lib/constants.ts
  - src/lib/auth.ts
  - src/app/actions/feed.ts
  - src/app/actions/council.ts
  - src/app/actions/gatherings.ts
  - src/app/actions/members.ts
verified: 2026-10-03
tags: [roles, product]
---

# Roles and vocabulary

| Term | Meaning |
|---|---|
| House | The single family represented by this database |
| Great Hall | `/dashboard`, the home summary |
| Wall | `/feed`, family posts and responses |
| Gathering | Event with a creator, time, optional end, and per-member RSVP |
| Council / chamber | Chat area / individual channel |
| Elder Council | Administrative routes under `/elder-council` |
| Initiation | Invite redemption and profile creation after authentication |
| Member row | Application identity linked to a Supabase Auth user; can be inactive |
| Guest | An active member with limited privileges, not an anonymous visitor |

## Role matrix

The ranking is `guest < member < elder` in `ROLE_HIERARCHY`. A database role check is authoritative; hiding a button is only presentation.

| Capability | Guest | Member | Elder |
|---|---|---|---|
| Read active House content and general chambers | Yes | Yes | Yes |
| Edit own profile and send heartbeat | Yes | Yes | Yes |
| RSVP to available gatherings | Yes | Yes | Yes |
| Create posts/comments/reactions/gatherings | No | Yes | Yes |
| Send Council messages | No | General chambers | Permitted chambers |
| Read private chambers | No | No | Yes |
| Post announcements, pin posts | No | No | Yes |
| Manage codes, members, chambers, identity, audit log | No | No | Yes |
| Remove owned content or change owned gathering | Ownership gate | Ownership gate | Any permitted target |

Owner checks can still allow a demoted guest to remove their previous content or manage an event they created. Guest read-only language therefore describes new contributions, with RSVP, own profile, and ownership cleanup exceptions. [Council](../20-domains/the-council.md) documents channel-type rules.

A deactivated member has no valid application auth context. Historical content remains, while direct action requests are denied. Role and activity must be re-read from Postgres; `hoa_role` and `hoa_member_id` user metadata do not grant membership or route access.
