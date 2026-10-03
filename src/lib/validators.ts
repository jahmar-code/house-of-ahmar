import { z } from "zod";
import { MILESTONE_KEYS } from "@/lib/constants";
import { parseMediaUrl } from "@/lib/media";

export const accessCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "Code must be at least 4 characters")
    .max(32, "Code is too long")
    .trim()
    .toUpperCase(),
});

const EARLIEST_BIRTH_YEAR = 1900;

export const birthdaySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a birthday as year, month and day")
  .refine((value) => {
    const [y, mo, d] = value.split("-").map(Number);
    const asDate = new Date(y, mo - 1, d);
    if (
      asDate.getFullYear() !== y ||
      asDate.getMonth() !== mo - 1 ||
      asDate.getDate() !== d
    ) {
      return false;
    }
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return y >= EARLIEST_BIRTH_YEAR && asDate <= today;
  }, "That birthday isn't a real date in the past");

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name is too long")
    .trim(),
  fullName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  // A real calendar day, not an arbitrary string — it lands in a Postgres
  // `date` column (which rejects 2000-02-31 outright) and drives the Great
  // Hall's birthday card. `Date.parse` is not enough: it silently rolls
  // 2000-02-31 into March, so round-trip through a LOCAL date and compare.
  birthday: birthdaySchema.optional(),
  phone: z.string().max(20).optional(),
});

export const postSchema = z
  .object({
    // Optional on its own: a photo-only post IS the photo, and the composer
    // sends no `content` for one. The refine below keeps an entirely empty
    // post impossible.
    content: z.string().max(5000, "Post is too long").optional(),
    type: z.enum(["text", "photo", "announcement"]).default("text"),
    // Ownership and configured Storage origin are checked by the server action.
    mediaUrls: z.array(z.string().min(1).max(2048)).max(10).optional(),
    // Derived from MILESTONE_KINDS (constants.ts) so the two can never drift.
    milestoneKind: z.enum(MILESTONE_KEYS).optional(),
  })
  .refine(
    (data) =>
      (data.content !== undefined && data.content.trim().length > 0) ||
      (data.mediaUrls?.length ?? 0) > 0,
    { message: "Write something or add a photo", path: ["content"] }
  );

export const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment is too long"),
});

export const gatheringSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(2, "Title is too short")
      .max(100, "Title is too long"),
    description: z.string().max(5000).optional(),
    location: z.string().max(200).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().optional(),
    isAllDay: z.boolean().default(false),
  })
  .transform((data) => data.isAllDay ? {
    ...data,
    // Calendar dates use their UTC date part, independently of the server or
    // submitting browser's timezone. Enforce the convention at the boundary.
    startsAt: `${data.startsAt.slice(0, 10)}T00:00:00.000Z`,
    endsAt: `${(data.endsAt ?? data.startsAt).slice(0, 10)}T23:59:59.999Z`,
  } : data)
  // Mirrors the `gatherings_time_order_ck` CHECK in migration 0004 — the DB
  // owns the truth, this owns the friendly message.
  .refine(
    (d) => !d.endsAt || new Date(d.endsAt).getTime() > new Date(d.startsAt).getTime(),
    {
      message: "End time must be after the start time",
      path: ["endsAt"],
    }
  );

// No mediaUrls: the Council composer has no media UI and sendMessage never
// persisted the field, so the schema no longer advertises what it can't honour.
export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long"),
  replyToId: z.string().uuid().optional(),
});

export const renameChannelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(50, "Name is too long")
    .trim(),
  description: z.string().max(500).optional(),
});

export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name is too short")
    .max(50, "Name is too long"),
  description: z.string().max(500).optional(),
  type: z.enum(["general", "announcement", "private"]).default("general"),
});

// Bulk archive boundary — an Elder-supplied day count that reaches a WHERE
// clause on a bulk UPDATE, so it gets the same scrutiny as any other input.
export const archiveThresholdSchema = z
  .number()
  .int("Threshold must be a whole number of days")
  .min(1, "Threshold must be at least 1 day")
  .max(365, "Threshold cannot exceed 365 days");

export const createAccessCodeSchema = z.object({
  label: z.string().max(100).optional(),
  maxUses: z.coerce
    .number()
    .int("Uses must be a whole number")
    .min(1, "A code must allow at least 1 use")
    .max(100, "A code cannot allow more than 100 uses")
    .default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const houseSettingsSchema = z.object({
  houseName: z
    .string()
    .trim()
    .min(2, "House name is too short")
    .max(80, "House name is too long")
    .trim(),
  houseTagline: z.string().max(280, "Tagline is too long").optional().default(""),
  welcomeMessage: z
    .string()
    .max(500, "Welcome message is too long")
    .optional()
    .default(""),
  coverImageUrl: z
    .string().max(2048).refine((value) => {
      if (!value || parseMediaUrl(value)) return true;
      try { return new URL(value).protocol === "https:"; } catch { return false; }
    }, "Use a secure HTTPS photo URL or a photo uploaded to the House")
    .optional()
    .default(""),
});
