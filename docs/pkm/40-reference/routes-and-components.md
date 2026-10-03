---
title: Routes and components
summary: Navigable surfaces and the component groups implementing them.
source:
  - src/app
  - src/components
  - src/proxy.ts
  - src/components/layout/nav-items.ts
verified: 2026-10-03
tags: [reference, routes]
---

# Routes and components

The `(house)` directory is an App Router group, not part of browser URLs. Private routes require an active database member; Elder routes additionally require that role.

| Route | Audience and purpose | Main components |
|---|---|---|
| `/` | Public House front door | House monogram and public identity |
| `/sign-in`, `/sign-up` | Auth entry | Sign-in/sign-up forms |
| `/forgot-password`, `/reset-password` | Account recovery | Recovery/reset forms |
| `/auth/confirm` | Auth callback | Route handler, safe redirect helper |
| `/api/media/[bucket]/[...path]` | Active-membership-protected images | Cookie-authenticated route and Storage policy |
| `/initiation` | Authenticated non-member or paused-access guidance | AccessCodeForm |
| `/initiation/profile` | Invited identity completing its profile | ProfileForm |
| `/initiation/complete` | Completed initiation welcome | Great Hall link |
| `/dashboard` | Great Hall | HallSummary, FirstRunCard, recent posts, upcoming events/birthdays, online members |
| `/feed?page=N` | The Wall with older/newer pages | PostForm, PostCard, lightbox and comment/reaction controls |
| `/gatherings`, `/gatherings?view=archived` | Current/archived event lists | GatheringCard, ArchivePastButton |
| `/gatherings/new` | Member/Elder planning | GatheringForm |
| `/gatherings/[id]` | Event detail and RSVP | RsvpButton, GatheringActions |
| `/gatherings/[id]/edit` | Creator/Elder editing | GatheringForm |
| `/council` | Available chambers | ChannelList |
| `/council/[channelId]` | Chamber conversation | CouncilChannel, RealtimeMessageList, MessageInput, MessageRow |
| `/members`, `/members/[id]` | Directory/profile | MemberGrid and profile panels |
| `/settings` | Own profile | ProfileSettingsForm |
| `/elder-council` | Elder overview | Administrative summary links |
| `/elder-council/access-codes` | Invitations | CreateCodeForm, revoke/copy controls |
| `/elder-council/members` | Role and activity | MemberManagement |
| `/elder-council/channels` | Chamber administration | CreateChannelForm, ChannelActions |
| `/elder-council/settings` | House identity | SettingsForm |
| `/elder-council/audit-log` | Administrative history | Audit event list |

Metadata routes include robots and the app manifest. Private media has its own authenticated route; see [auth/security](../10-architecture/auth-and-security.md). Error, loading, and not-found boundaries sit beside product pages and should be preserved when adding nested routes.

Discover the complete current route and primitive inventory:

```bash
rg --files src/app | rg '/(page|route|loading|error|not-found)\.tsx?$'
rg --files src/components/ui src/components/shared
```

`ui` contains Base UI-backed primitives; `shared` holds reusable House patterns such as page headers, empty states, monogram, and confirmation. Domain-specific business rules belong beside domain components/actions, not in a generic primitive.
