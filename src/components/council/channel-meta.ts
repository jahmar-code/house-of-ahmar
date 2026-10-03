import { Hash, Lock, Megaphone } from "lucide-react";
import type { Channel } from "@/types";

/**
 * How a chamber presents itself — one place, so the list and the chamber
 * header can never disagree about what a room is.
 */
export const CHANNEL_ICONS = {
  general: Hash,
  announcement: Megaphone,
  private: Lock,
} as const;

// Restraint: only the "loud" chamber types earn the accent; general stays neutral.
export const CHANNEL_ICON_CLASS = {
  general: "text-muted-foreground",
  announcement: "text-primary",
  private: "text-primary",
} as const;

/**
 * Plain words, not the raw enum. Who a room is for is never carried by the
 * icon colour alone — the label always says it.
 */
export const CHANNEL_LABELS: Record<Channel["type"], string> = {
  general: "Open to everyone",
  announcement: "Announcements",
  private: "Elders only",
};
