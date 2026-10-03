import type {
  members,
  accessCodes,
  posts,
  comments,
  reactions,
  gatherings,
  rsvps,
  channels,
  messages,
  albums,
  photos,
} from "@/lib/db/schema";

// Inferred select types
export type Member = typeof members.$inferSelect;
export type AccessCode = typeof accessCodes.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Reaction = typeof reactions.$inferSelect;
export type Gathering = typeof gatherings.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type Photo = typeof photos.$inferSelect;

// Inferred insert types
export type NewMember = typeof members.$inferInsert;
export type NewPost = typeof posts.$inferInsert;
export type NewComment = typeof comments.$inferInsert;
export type NewGathering = typeof gatherings.$inferInsert;
export type NewRsvp = typeof rsvps.$inferInsert;
export type NewMessage = typeof messages.$inferInsert;
export type NewAlbum = typeof albums.$inferInsert;
export type NewPhoto = typeof photos.$inferInsert;

// ─── Read model ───
// The only member fields a byline needs. It is byte-for-byte the column grant
// migration 0002 gives the browser (`grant select (id, display_name,
// avatar_url, role) on public.members`), so what a page serializes into a
// client component can never exceed what the Data API would hand out. Never
// widen this to `Member` — email, phone, bio, birthday and auth_user_id have
// no business in an RSC payload for The Wall or the Council.
export type PublicMember = Pick<
  Member,
  "id" | "displayName" | "avatarUrl" | "role"
>;

/** The `columns` projection to pass to a Drizzle `with: { author: … }` join. */
export const PUBLIC_MEMBER_COLUMNS = {
  id: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} as const;

// Composite types
export type PostWithAuthor = Post & { author: PublicMember };
export type PostWithDetails = Post & {
  author: PublicMember;
  comments: (Comment & { author: PublicMember })[];
  reactions: Reaction[];
};
export type GatheringWithRsvps = Gathering & {
  creator: Member;
  rsvps: (Rsvp & { member: Member })[];
};
export type MessageWithAuthor = Message & {
  author: PublicMember;
  /** Exact PostgreSQL timestamp for history cursors and Realtime reconciliation. */
  createdAtMicros?: string;
};

// Action result pattern
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
