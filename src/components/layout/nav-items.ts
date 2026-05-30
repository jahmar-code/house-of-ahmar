import {
  LayoutDashboard,
  Scroll,
  Calendar,
  MessageSquare,
  Image,
  Users,
  TreePine,
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
 */
export const NAV_ITEMS: NavItem[] = [
  {
    name: "The Great Hall",
    shortName: "Hall",
    href: "/dashboard",
    icon: LayoutDashboard,
    inBottomNav: true,
  },
  {
    name: "The Wall",
    shortName: "Wall",
    href: "/feed",
    icon: Scroll,
    inBottomNav: true,
  },
  {
    name: "Gatherings",
    shortName: "Gather",
    href: "/gatherings",
    icon: Calendar,
    inBottomNav: true,
  },
  {
    name: "The Council",
    shortName: "Council",
    href: "/council",
    icon: MessageSquare,
    inBottomNav: true,
  },
  {
    name: "The Archives",
    shortName: "Archives",
    href: "/archives",
    icon: Image,
    inBottomNav: false,
  },
  {
    name: "Members",
    shortName: "Members",
    href: "/members",
    icon: Users,
    inBottomNav: true,
  },
  {
    name: "Family Tree",
    shortName: "Family",
    href: "/family",
    icon: TreePine,
    inBottomNav: false,
  },
];

/** Returns true when a nav href should be highlighted for the given path. */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
