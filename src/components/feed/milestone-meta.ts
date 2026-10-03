import {
  Baby,
  Briefcase,
  GraduationCap,
  Heart,
  Home,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { MILESTONE_KINDS, type MilestoneKind } from "@/lib/constants";

// One icon per milestone the family celebrates. Lucide only — the six
// REACTION_EMOJIS are the app's only sanctioned emoji.
const MILESTONE_ICONS: Record<MilestoneKind, LucideIcon> = {
  birth: Baby,
  graduation: GraduationCap,
  marriage: Heart,
  new_job: Briefcase,
  new_home: Home,
  achievement: Trophy,
  other: Sparkles,
};

export interface MilestoneMeta {
  key: MilestoneKind;
  label: string;
  Icon: LucideIcon;
}

/** The composer's picker list — label + icon for every milestone kind. */
export const MILESTONE_OPTIONS: MilestoneMeta[] = MILESTONE_KINDS.map((m) => ({
  key: m.key,
  label: m.label,
  Icon: MILESTONE_ICONS[m.key],
}));

/** Resolves a stored `milestone_kind` string to its label + icon, or null. */
export function milestoneMeta(kind: string | null | undefined): MilestoneMeta | null {
  if (!kind) return null;
  return MILESTONE_OPTIONS.find((m) => m.key === kind) ?? null;
}
