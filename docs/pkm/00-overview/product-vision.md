---
title: Product vision and scope
summary: The family outcomes the House serves and the boundaries of its shipped product.
source:
  - src/lib/settings.ts
  - src/components/layout/nav-items.ts
  - src/app/(house)/dashboard/page.tsx
  - src/lib/db/schema.ts
verified: 2026-10-03
tags: [product, overview]
---

# Product vision and scope

House of Ahmar is one family's online home: a place to see familiar faces, share a photograph, make plans, and talk. Success is a relative completing those tasks comfortably on a phone, and an Elder being able to invite and support them without exposing family information.

The default welcome is intentionally inclusive. Family includes spouses, in-laws, partners, and adopted children; vocabulary must never imply bloodline tests or membership by surname. The names Great Hall, Wall, Council, and Elder give the House character, while supporting copy should explain ordinary actions plainly.

## Primary jobs

| Person | Outcome | Evidence to seek |
|---|---|---|
| Invited relative | Join and recover access without help | Valid invite completes; invalid/expired codes and failed email links explain recovery |
| Active member | Catch up and contribute on any screen | Post, comment, react, RSVP, and send a message; success appears immediately |
| Guest | Feel included with limited standing | Read permitted content, RSVP, and edit own profile; restricted controls agree with server enforcement |
| Elder | Keep the House welcoming and private | Invite/revoke, moderate, manage roles/chambers/settings, recover mistakes |

These are acceptance outcomes, not measured production metrics. No usage analytics or family research results are asserted by this document.

## Shipped scope

The Great Hall summarizes current activity; The Wall holds updates and milestones; Gatherings coordinates events; Council supports conversations; Our People shows active relatives; Settings manages one's profile; Elder Council handles administration. [Domain notes](../Home.md#product-domains) trace each to source.

The database represents exactly one House. There is no tenant selector, billing, public content feed, notification service, or generalized SaaS administration. `albums`, `photos`, and `member_relationships` remain in the schema, but their historic UI was removed. A database table is not a shipped feature.

## Quality priorities

1. Family privacy and recoverable administration.
2. Dependable invitation, posting, RSVP, and conversation flows.
3. Comfortable mobile interaction and equivalent desktop capability.
4. Preserve history and make recovery practical.
5. Keep implementation, documentation, and checks simple enough for the next maintainer.

Feature additions should solve an observed family need. Current scale limits are explicit in [known limits](../50-operations/known-limitations.md).
