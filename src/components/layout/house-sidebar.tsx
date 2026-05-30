"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Shield, LogOut } from "lucide-react";
import { NAV_ITEMS, isNavActive } from "./nav-items";

interface HouseSidebarProps {
  role: string;
  displayName: string;
  avatarUrl?: string | null;
  houseName: string;
}

export function HouseSidebar({ role, displayName, avatarUrl, houseName }: HouseSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-sidebar-border bg-sidebar">
      <div className="flex h-full flex-col gap-y-5 px-4 py-6">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-card">
            <span className="font-heading text-lg font-bold text-gold">A</span>
          </div>
          <span className="font-heading text-lg font-semibold text-sidebar-foreground">
            {houseName}
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}

          {/* Elder Council — admin only */}
          {role === "elder" && (
            <>
              <div className="my-3 h-px bg-sidebar-border" />
              <Link
                href="/elder-council"
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith("/elder-council")
                    ? "bg-sidebar-accent text-gold"
                    : "text-gold/60 hover:bg-sidebar-accent/50 hover:text-gold"
                )}
              >
                <Shield className="h-4 w-4" />
                Elder Council
              </Link>
            </>
          )}
        </nav>

        {/* User section */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-md border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent/50"
              />
            }
          >
            <Avatar>
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {displayName}
              </p>
              <p className="text-xs capitalize text-sidebar-foreground/50">
                {role}
              </p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
