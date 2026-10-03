# House of Ahmar — current status

Source reviewed: **2026-10-03**. This is a capability summary, not a claim that production has passed every check. Exact commands, environment limitations, browser results, and release outcome are recorded in the [October audit](docs/audits/2026-10-03/README.md).

| Area | Implemented behavior |
|---|---|
| Entry and identity | Sign-up/sign-in, confirmation callback, password recovery, invitation validation/redemption, founding Elder, profile/avatar settings |
| Great Hall | House welcome, recent posts, upcoming gatherings and birthdays, membership/presence summaries, first-run guidance |
| The Wall | Text/photo posts, milestones, Elder announcements/pinning, comments, six reactions, owner/Elder removal, keyboard photo viewing, older/newer pages |
| Gatherings | Create/edit, attending/maybe/not-attending RSVPs, cancellation/restoration, Elder archive sweep and archived browsing |
| Council | General/announcement/private chambers, live messages, replies, removal, reconnect feedback, earlier-message loading, Elder chamber management |
| Our People | Directory, active-member profiles, limited contact visibility for guests |
| Elder Council | Invitations, roles, activation, chambers, House identity, audit log |
| Delivery | Responsive dark interface, loading/error/not-found states, source tests, documented operations and agent workflow |

## October security correction

The configured live database was found without its intended RLS lockdown. Following a private backup, the migration chain was applied: all application tables now have RLS enabled, client write grants are removed, and all three House media buckets are private. See [backend evidence](docs/audits/2026-10-03/backend-security.md) for the checks. This database correction does not by itself prove the matching application revision was pushed or deployed; release state is recorded separately in [verification](docs/audits/2026-10-03/verification.md).

## Explicit limits

Archives and the family tree are retained schema concepts without current routes. Council attachments, delivered notifications, individual data export/account erasure, and full-text content search are not shipped. A manifest does not provide offline operation. See [known limits](docs/pkm/50-operations/known-limitations.md).

## Evidence policy

- Source inspection establishes implementation, not deployed configuration.
- Unit tests with mocks establish code behavior under their inputs, not RLS or concurrency on Postgres.
- Browser coverage must record viewport, role, environment, and outcomes.
- Migration files are not evidence that migrations ran against a remote project.
- A pushed commit is not evidence that a host deployed it successfully.

The old multi-pass status narrative contained stale features and historical test claims. Git history preserves it; current documentation uses source paths and dated, scoped evidence.
