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

// Composite types
export type PostWithAuthor = Post & { author: Member };
export type PostWithDetails = Post & {
  author: Member;
  comments: (Comment & { author: Member })[];
  reactions: Reaction[];
};
export type GatheringWithRsvps = Gathering & {
  creator: Member;
  rsvps: (Rsvp & { member: Member })[];
};
export type MessageWithAuthor = Message & { author: Member };

// Action result pattern
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };
