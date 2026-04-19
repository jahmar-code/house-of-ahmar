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
