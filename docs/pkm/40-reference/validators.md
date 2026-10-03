---
title: Input validators
summary: Runtime schemas, media boundaries, and cross-field validation.
source:
  - src/lib/validators.ts
  - src/lib/constants.ts
  - src/lib/media.ts
  - src/app/actions/members.ts
  - src/lib/supabase/storage.ts
verified: 2026-10-03
tags: [reference, validation]
---

# Input validators

Zod schemas validate untrusted values at mutation boundaries. UI limits make input comfortable; they do not replace server validation. Database constraints add a separate integrity layer.

| Schema | Contract |
|---|---|
| `accessCodeSchema` | Trimmed uppercase string, 4–32 characters |
| `birthdaySchema` | Real `YYYY-MM-DD` date from 1900 through today, verified by calendar round-trip |
| `profileSchema` | Display name 2–50 trimmed characters; bounded optional full name, biography, phone, birthday |
| `postSchema` | Text/photo/announcement type; up to 5,000 content characters, 10 media references, closed milestone set; at least text or media |
| `commentSchema` | Trimmed nonempty content, at most 2,000 characters |
| `gatheringSchema` | Title 2–100; bounded description/location; ISO timestamps; optional end strictly after start; boolean all-day |
| `messageSchema` | Trimmed nonempty content, at most 4,000 characters; optional reply UUID |
| `channelSchema` | Trimmed name 2–50; bounded description; general/announcement/private |
| `renameChannelSchema` | Trimmed name 2–50 and bounded description; does not change slug/type |
| `archiveThresholdSchema` | Integer days, 1–365 |
| `createAccessCodeSchema` | Optional label; integer uses 1–100; optional expiry days 1–365 |
| `houseSettingsSchema` | Trimmed House name 2–80, bounded tagline/welcome, empty/private-media/HTTPS cover reference |

## Resource validation beyond shape

A valid UUID is not proof that a target exists, is visible, is active, or belongs to the caller. Those checks belong in actions after parsing. Likewise an announcement enum does not authorize a member to create an announcement.

Media strings are bounded by the general post/profile schema; `ownedMediaUrl` validates the recognized House bucket and the caller's namespace before persistence. `parseMediaUrl` accepts relative private-route addresses and compatible configured-origin legacy URLs. `isSafeStoragePath` rejects traversal, empty segments, ambiguous percent encoding, query/fragment delimiters, backslashes, and control characters.

Upload helpers check file type/size before transfer; Storage policies and bucket MIME/size limits enforce server-side constraints. Client file metadata alone is not a trust boundary. The cover setting allows deliberate external HTTPS imagery, so it differs from ordinary member-upload ownership rules.

When changing a closed set, keep `constants.ts`, validators, database constraints/migrations, UI metadata, and tests synchronized. Test whitespace-only strings, wrong runtime types, impossible dates, malformed IDs, boundary lengths, and cross-field rules.
