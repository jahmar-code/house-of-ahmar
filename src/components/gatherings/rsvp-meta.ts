import { Check, HelpCircle, X, type LucideIcon } from "lucide-react";
import type { Rsvp } from "@/types";

/**
 * The single vocabulary for an RSVP state.
 *
 * The card said "Going / Maybe / Not going" while the buttons said
 * "Attending / Maybe / Can't make it" — the same three states named two
 * different ways on screens one tap apart. `verb` is what you press, `label`
 * is what you are.
 *
 * Colours come from the `--success` / `--warning` tokens rather than raw
 * Tailwind hues, so the palette stays retunable from globals.css. Every state
 * also carries an icon, so it never reads by colour alone.
 */
export const RSVP_META: Record<
  Rsvp["status"],
  { label: string; verb: string; Icon: LucideIcon; badgeClass: string; activeClass: string }
> = {
  attending: {
    label: "Going",
    verb: "Going",
    Icon: Check,
    badgeClass: "border-success/40 text-success",
    activeClass: "border-success/40 bg-success/10 text-success hover:bg-success/15",
  },
  maybe: {
    label: "Maybe",
    verb: "Maybe",
    Icon: HelpCircle,
    badgeClass: "border-warning/40 text-warning",
    activeClass: "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
  },
  not_attending: {
    label: "Not going",
    verb: "Can't make it",
    Icon: X,
    badgeClass: "border-border text-muted-foreground",
    activeClass:
      "border-destructive/40 bg-destructive/10 text-foreground hover:bg-destructive/15",
  },
};

/** Render order for the three RSVP controls. */
export const RSVP_ORDER = ["attending", "maybe", "not_attending"] as const;
