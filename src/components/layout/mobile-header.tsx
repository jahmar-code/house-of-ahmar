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
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold/30 bg-card">
          <span className="font-heading text-base font-bold text-gold">A</span>
        </div>
        <span className="font-heading text-base font-semibold text-foreground">
          {houseName}
        </span>
      </Link>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open menu" />
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
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-gold"
                      : "text-foreground/70 hover:bg-secondary/50 hover:text-foreground"
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
                    "flex items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    isNavActive(pathname, "/elder-council")
                      ? "bg-secondary text-gold"
                      : "text-gold/70 hover:bg-secondary/50 hover:text-gold"
                  )}
                >
                  <Shield className="h-5 w-5" />
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
              className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm font-medium text-foreground/70 transition-colors hover:bg-secondary/50 hover:text-foreground"
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
