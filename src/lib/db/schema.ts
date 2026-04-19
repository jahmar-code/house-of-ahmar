import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  date,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const memberRoleEnum = pgEnum("member_role", [
  "elder",
  "member",
  "guest",
]);
export const postTypeEnum = pgEnum("post_type", [
  "text",
  "photo",
  "announcement",
]);
export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "attending",
  "maybe",
  "not_attending",
]);
export const channelTypeEnum = pgEnum("channel_type", [
  "general",
  "announcement",
  "private",
]);
export const codeStatusEnum = pgEnum("code_status", [
  "active",
  "used",
  "revoked",
]);

// ─── Members ───
export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authUserId: uuid("auth_user_id").notNull().unique(),
    displayName: text("display_name").notNull(),
    fullName: text("full_name"),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    birthday: date("birthday"),
    role: memberRoleEnum("role").notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("members_role_idx").on(table.role),
    index("members_is_active_idx").on(table.isActive),
  ]
);

// ─── Access Codes ───
export const accessCodes = pgTable(
  "access_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    label: text("label"),
    status: codeStatusEnum("status").notNull().default("active"),
    maxUses: integer("max_uses").default(1),
    useCount: integer("use_count").notNull().default(0),
    createdBy: uuid("created_by").references(() => members.id),
    usedBy: uuid("used_by").references(() => members.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("access_codes_status_idx").on(table.status)]
);

// ─── Posts ───
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    type: postTypeEnum("type").notNull().default("text"),
    content: text("content"),
    mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
    isPinned: boolean("is_pinned").default(false),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("posts_author_idx").on(table.authorId),
    index("posts_created_at_idx").on(table.createdAt),
  ]
);

// ─── Comments ───
export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    content: text("content").notNull(),
    isDeleted: boolean("is_deleted").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("comments_post_idx").on(table.postId, table.createdAt)]
);

// ─── Reactions ───
export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("reactions_unique_idx").on(
      table.postId,
      table.memberId,
      table.emoji
    ),
  ]
);

// ─── Gatherings ───
export const gatherings = pgTable(
  "gatherings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    coverImageUrl: text("cover_image_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isAllDay: boolean("is_all_day").default(false),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => members.id),
    isCancelled: boolean("is_cancelled").default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("gatherings_starts_at_idx").on(table.startsAt),
    index("gatherings_created_by_idx").on(table.createdBy),
    index("gatherings_archived_at_idx").on(table.archivedAt),
  ]
);

// ─── RSVPs ───
export const rsvps = pgTable(
  "rsvps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gatheringId: uuid("gathering_id")
      .notNull()
      .references(() => gatherings.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    status: rsvpStatusEnum("status").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex("rsvps_unique_idx").on(table.gatheringId, table.memberId),
  ]
);

// ─── Channels ───
export const channels = pgTable(
  "channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    type: channelTypeEnum("type").notNull().default("general"),
    isArchived: boolean("is_archived").default(false),
    sortOrder: integer("sort_order").default(0),
    createdBy: uuid("created_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("channels_sort_order_idx").on(table.sortOrder)]
);

// ─── Messages ───
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => members.id),
    content: text("content").notNull(),
    mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
    isDeleted: boolean("is_deleted").default(false),
    replyToId: uuid("reply_to_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("messages_channel_idx").on(table.channelId, table.createdAt),
    index("messages_author_idx").on(table.authorId),
  ]
);

// ─── Albums ───
export const albums = pgTable(
  "albums",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    coverPhotoUrl: text("cover_photo_url"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => members.id),
    isPrivate: boolean("is_private").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("albums_created_at_idx").on(table.createdAt)]
);

// ─── Photos ───
export const photos = pgTable(
  "photos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    albumId: uuid("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => members.id),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    caption: text("caption"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("photos_album_idx").on(table.albumId, table.sortOrder)]
);

// ─── House Settings ───
export const houseSettings = pgTable("house_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => members.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─── Member Relationships (parent → child edges) ───
export const memberRelationships = pgTable(
  "member_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    childId: uuid("child_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("member_relationships_unique_idx").on(
      table.parentId,
      table.childId
    ),
    index("member_relationships_child_idx").on(table.childId),
  ]
);

// ─── Audit Logs ───
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => members.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_created_at_idx").on(table.createdAt),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  ]
);

// ─── Relations ───
export const membersRelations = relations(members, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  reactions: many(reactions),
  rsvps: many(rsvps),
  messages: many(messages),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(members, { fields: [posts.authorId], references: [members.id] }),
  comments: many(comments),
  reactions: many(reactions),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(members, {
    fields: [comments.authorId],
    references: [members.id],
  }),
}));

export const reactionsRelations = relations(reactions, ({ one }) => ({
  post: one(posts, { fields: [reactions.postId], references: [posts.id] }),
  member: one(members, {
    fields: [reactions.memberId],
    references: [members.id],
  }),
}));

export const gatheringsRelations = relations(gatherings, ({ one, many }) => ({
  creator: one(members, {
    fields: [gatherings.createdBy],
    references: [members.id],
  }),
  rsvps: many(rsvps),
}));

export const rsvpsRelations = relations(rsvps, ({ one }) => ({
  gathering: one(gatherings, {
    fields: [rsvps.gatheringId],
    references: [gatherings.id],
  }),
  member: one(members, { fields: [rsvps.memberId], references: [members.id] }),
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  author: one(members, {
    fields: [messages.authorId],
    references: [members.id],
  }),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  creator: one(members, {
    fields: [albums.createdBy],
    references: [members.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  album: one(albums, { fields: [photos.albumId], references: [albums.id] }),
  uploader: one(members, {
    fields: [photos.uploadedBy],
    references: [members.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(members, { fields: [auditLogs.actorId], references: [members.id] }),
}));

export const memberRelationshipsRelations = relations(
  memberRelationships,
  ({ one }) => ({
    parent: one(members, {
      fields: [memberRelationships.parentId],
      references: [members.id],
      relationName: "parent_of",
    }),
    child: one(members, {
      fields: [memberRelationships.childId],
      references: [members.id],
      relationName: "child_of",
    }),
  })
);
