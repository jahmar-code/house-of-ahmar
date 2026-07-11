"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { Menu, Shield, LogOut } from "lucide-react";
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
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-sm supports-backdrop-filter:bg-background/80 lg:hidden">
      <Link
        href="/dashboard"
        className="group flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground">
          A
        </span>
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

          {/* User header */}
          <div className="flex items-center gap-3 border-b border-border p-4">
            <Avatar className="h-10 w-10">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-xs capitalize text-muted-foreground">{role}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {NAV_ITEMS.map((item) => {
              const isActive = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
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

          {/* Sign out */}
          <div className="border-t border-border p-3">
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
