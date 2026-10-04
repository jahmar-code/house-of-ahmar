---
title: The Wall
summary: Posts, photos, comments, reactions, milestones, and moderation.
source:
  - src/app/actions/feed.ts
  - src/app/(house)/feed/page.tsx
  - src/components/feed/post-form.tsx
  - src/components/feed/post-card.tsx
  - src/components/feed/post-photos.tsx
  - src/components/dashboard/recent-posts.tsx
  - tests/e2e/follow-up.spec.ts
  - src/components/shared/hydrated-fieldset.tsx
  - src/components/shared/activity-time.tsx
  - src/lib/constants.ts
  - src/lib/validators.ts
  - src/lib/db/schema.ts
verified: 2026-10-03
tags: [feed, media]
---

# The Wall

The Wall is the family's update stream. Members and Elders can create text/photo posts, optionally marking a life milestone. A photo-only post is valid; an empty post is not. Announcements and pin/unpin are Elder capabilities.

## Data and ordering

`posts` holds content, type, media references, optional milestone, pin/deletion flags, author, and timestamps. The query excludes soft-deleted posts and orders pinned posts first, then newest. The route accepts a positive `page` query parameter (bounded to 10,000), loads 51 rows to detect a next page, and displays 50 with Newer/Older navigation. Ordering includes an ID tie-breaker, and live comments/reactions accompany each page. The feed-specific partial index supports the main ordering. Offset pages may shift as posts are added or pinned; there is no full-text search.

A `post` query parameter (a UUID) asks for the page that holds that live post. `pageContaining` counts live posts ahead of it with a PostgreSQL tuple comparison on `(is_pinned, created_at, id)`, so pins and microsecond ordering are respected, and the route falls back to the requested page when the post is missing or deleted.

`PUBLIC_MEMBER_COLUMNS` limits author data delivered to the client. Comments retain their author and are soft-deleted. Reactions are unique on post/member/reaction key; the stored value is a key such as `heart`, not the displayed glyph. Closed milestone and reaction sets live in `constants.ts` and database constraints.

## Interaction

PostForm validates uploads and text, prevents overlapping submissions, and after a successful post navigates to `/feed?post=<id>` without scrolling the page, so the new post appears wherever it now sorts: page 1 from an older page, or page 2 when pins fill page 1. `PostCard` marks that post (`data-highlighted`, a stronger ring) and scrolls it into view, instantly under reduced motion. The card presents photos, reactions, comments, and permitted moderation actions. Guests, whose reactions the server refuses, get a read-only list of non-zero reaction counts instead of reaction buttons, and the Great Hall's empty-Wall card (`RecentPosts`) offers them no "Write the first post" link. Errors must retain the member's draft so retry is practical.

Its `HydratedFieldset` keeps the controlled composer and photo controls disabled until client event handlers attach. A cold page must not accept a caption that appears in the textbox but is absent from the submitted client state.

Post and comment timestamps use `ActivityTime`: the server and first hydration render share a stable placeholder, then the browser supplies relative text and a local full-date tooltip. This avoids replacing a hydrated Wall when a relative-minute boundary passes between server rendering and browser startup.

`PostPhotos` opens a full-photo dialog with previous/next controls, scoped arrow-key navigation, Escape dismissal, and focus return. Base UI establishes initial focus asynchronously; browser tests assert that focus has entered the dialog before sending navigation keys, as well as checking forward/backward containment and return to the original thumbnail.

`createPost` rejects non-Elder announcement attempts. Authors or Elders may remove a post/comment; Elder removal of another person's content is audited without a copy of the removed text (a post removal records the author, `hadText`, and `photoCount`). Pin changes are audited. New comments/reactions must target a live post, not a missing or deleted one.

Private image delivery and bucket policies are part of this feature's privacy contract. A successful authenticated page render does not prove an image's direct URL is protected. Test logged-out access, inactive membership, upload path ownership, unsupported files, and old stored URL compatibility.

## Verify

Create text-only and photo-only posts; reject blank/oversized input; add/remove each reaction; comment and remove; compare member versus guest/Elder controls, including the guest's read-only reaction counts; post from page 2 and with fifty pins and confirm the new post is shown; pin and confirm order; delete with confirmation and ensure summaries update; inspect lightbox keyboard/focus behavior and mobile loading. See [participation flow](../30-flows/participate-and-moderate.md).
