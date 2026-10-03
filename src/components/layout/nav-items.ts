import {
  Home,
  Newspaper,
  CalendarHeart,
  MessagesSquare,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  /** Label used in the sidebar and mobile menu. */
  name: string;
  /** Shorter label used in the compact bottom tab bar. */
  shortName: string;
  href: string;
  icon: LucideIcon;
  /** Whether the item appears in the compact mobile bottom tab bar. */
  inBottomNav: boolean;
}

/**
 * Single source of truth for the primary house navigation. Consumed by the
 * desktop sidebar, the mobile menu sheet, and the mobile bottom tab bar so the
 * three stay in sync.
 *
 * These five glyphs are the whole visual identity of the bottom tab bar on a
 * phone, so they are warm and literal — a home, a paper, a date, a
 * conversation, people. Every `name` matches the h1 of the page it opens.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    name: "The Great Hall",
    shortName: "Hall",
    href: "/dashboard",
    icon: Home,
    inBottomNav: true,
  },
  {
    name: "The Wall",
    shortName: "Wall",
    href: "/feed",
    icon: Newspaper,
    inBottomNav: true,
  },
  {
    name: "Gatherings",
    shortName: "Gather",
    href: "/gatherings",
    icon: CalendarHeart,
    inBottomNav: true,
  },
  {
    name: "The Council",
    shortName: "Council",
    href: "/council",
    icon: MessagesSquare,
    inBottomNav: true,
  },
  {
    name: "Our People",
    shortName: "People",
    href: "/members",
    icon: Users,
    inBottomNav: true,
  },
];

/** Returns true when a nav href should be highlighted for the given path. */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
