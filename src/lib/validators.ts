import { z } from "zod";

export const accessCodeSchema = z.object({
  code: z
    .string()
    .min(4, "Code must be at least 4 characters")
    .max(32, "Code is too long")
    .trim()
    .toUpperCase(),
});

export const profileSchema = z.object({
  displayName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name is too long")
    .trim(),
  fullName: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  birthday: z.string().optional(),
  phone: z.string().max(20).optional(),
});

export const postSchema = z.object({
  content: z
    .string()
    .min(1, "Post cannot be empty")
    .max(5000, "Post is too long"),
  type: z.enum(["text", "photo", "announcement"]).default("text"),
  mediaUrls: z.array(z.string().url()).max(10).optional(),
});

export const commentSchema = z.object({
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment is too long"),
});

export const gatheringSchema = z.object({
  title: z
    .string()
    .min(2, "Title is too short")
    .max(100, "Title is too long"),
  description: z.string().max(5000).optional(),
  location: z.string().max(200).optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional(),
  isAllDay: z.boolean().default(false),
});

export const messageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message is too long"),
  mediaUrls: z.array(z.string().url()).max(5).optional(),
  replyToId: z.string().uuid().optional(),
});

export const channelSchema = z.object({
  name: z
    .string()
    .min(2, "Name is too short")
    .max(50, "Name is too long"),
  description: z.string().max(500).optional(),
  type: z.enum(["general", "announcement", "private"]).default("general"),
});

export const createAccessCodeSchema = z.object({
  label: z.string().max(100).optional(),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export const relationshipSchema = z
  .object({
    parentId: z.string().uuid("Invalid parent id"),
    childId: z.string().uuid("Invalid child id"),
  })
  .refine((d) => d.parentId !== d.childId, {
    message: "A member cannot be their own parent",
    path: ["parentId"],
  });

export const houseSettingsSchema = z.object({
  houseName: z
    .string()
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
    .union([z.string().url("Cover URL must be a valid URL"), z.literal("")])
    .optional()
    .default(""),
});
