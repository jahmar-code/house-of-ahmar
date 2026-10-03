"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu, Shield, LogOut, UserRound, ChevronRight } from "lucide-react";
import { HouseMonogram } from "@/components/shared/house-monogram";
import { NAV_ITEMS, isNavActive } from "./nav-items";

interface MobileHeaderProps {
  role: string;
  displayName: string;
  avatarUrl?: string | null;
  houseName: string;
}

export function MobileHeader({
  role,
  displayName,
  avatarUrl,
  houseName,
}: MobileHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setOpen(false);
      router.push("/sign-in");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Check your connection and try again.");
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] backdrop-blur-sm supports-backdrop-filter:bg-background/80 lg:hidden">
      <Link
        href="/dashboard"
        className="group flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <HouseMonogram houseName={houseName} size="xs" variant="brand" />
        <span className="truncate text-base font-semibold tracking-tight text-foreground">
          {houseName}
        </span>
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="size-11"
            />
          }
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="right" className="w-72 gap-0 p-0">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>

          {/* User header — doubles as the way into your own profile */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 border-b border-border p-4 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            <Avatar className="h-10 w-10">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-xs capitalize text-muted-foreground">{role}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>

          {/* Navigation */}
          <nav aria-label="Main menu" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isActive
                      ? "bg-muted text-primary"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}

            {role === "elder" && (
              <>
                <div className="my-2 h-px bg-border" />
                <Link
                  href="/elder-council"
                  aria-current={
                    isNavActive(pathname, "/elder-council") ? "page" : undefined
                  }
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    isNavActive(pathname, "/elder-council")
                      ? "bg-muted text-primary"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Shield className="h-5 w-5 text-primary" />
                  Elder Council
                </Link>
              </>
            )}
          </nav>

          {/* Your profile + sign out */}
          <div className="space-y-1 border-t border-border p-3">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isNavActive(pathname, "/settings")
                  ? "bg-muted text-primary"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              )}
            >
              <UserRound className="h-5 w-5" />
              Your profile
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
