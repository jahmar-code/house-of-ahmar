export const HOA_ROLES = ["elder", "member", "guest"] as const;
export type HoaRole = (typeof HOA_ROLES)[number];

export const ROLE_HIERARCHY: Record<HoaRole, number> = {
  guest: 0,
  member: 1,
  elder: 2,
};

export const POST_TYPES = ["text", "photo", "announcement"] as const;
export const RSVP_STATUSES = ["attending", "maybe", "not_attending"] as const;
export const CHANNEL_TYPES = ["general", "announcement", "private"] as const;
export const CODE_STATUSES = ["active", "used", "revoked"] as const;

export const REACTION_EMOJIS = [
  { key: "heart", emoji: "❤️" },
  { key: "fire", emoji: "🔥" },
  { key: "salute", emoji: "🫡" },
  { key: "laugh", emoji: "😂" },
  { key: "pray", emoji: "🤲" },
  { key: "clap", emoji: "👏" },
] as const;

export const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 1 minute

// Life milestones the family celebrates together (a post can be tagged with one).
export const MILESTONE_KINDS = [
  { key: "birth", label: "New Arrival" },
  { key: "graduation", label: "Graduation" },
  { key: "marriage", label: "Marriage" },
  { key: "new_job", label: "New Job" },
  { key: "new_home", label: "New Home" },
  { key: "achievement", label: "Achievement" },
  { key: "other", label: "Milestone" },
] as const;

export type MilestoneKind = (typeof MILESTONE_KINDS)[number]["key"];
// Typed as a non-empty tuple so validators.ts can feed it straight to z.enum()
// — MILESTONE_KINDS stays the single source of truth for the closed set.
export const MILESTONE_KEYS = MILESTONE_KINDS.map((m) => m.key) as unknown as [
  MilestoneKind,
  ...MilestoneKind[],
];

export type ReactionKey = (typeof REACTION_EMOJIS)[number]["key"];
// Same shape as MILESTONE_KEYS — the closed set the `reactions.emoji` column
// stores (it holds the KEY, not the glyph) and the DB CHECK constrains.
export const REACTION_KEYS = REACTION_EMOJIS.map((r) => r.key) as unknown as [
  ReactionKey,
  ...ReactionKey[],
];

/** Most loaded Council rows one recovery tombstone check accepts; clients batch. */
export const LOADED_HISTORY_CHECK_LIMIT = 500;
