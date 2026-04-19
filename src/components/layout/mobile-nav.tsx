"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Scroll,
  Calendar,
  MessageSquare,
  Users,
  TreePine,
} from "lucide-react";

const mobileNav = [
  { name: "Hall", href: "/dashboard", icon: LayoutDashboard },
  { name: "Wall", href: "/feed", icon: Scroll },
  { name: "Gather", href: "/gatherings", icon: Calendar },
  { name: "Council", href: "/council", icon: MessageSquare },
  { name: "Family", href: "/family", icon: TreePine },
  { name: "Members", href: "/members", icon: Users },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm lg:hidden">
      <div className="flex items-center justify-around py-2">
        {mobileNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-1.5 text-xs transition-colors",
                isActive
                  ? "text-gold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
