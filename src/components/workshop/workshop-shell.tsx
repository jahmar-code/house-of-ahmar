"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, Cable, LogOut, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/workshop", label: "Agents", icon: Bot, exact: true },
  { href: "/workshop/connect", label: "Connect", icon: Cable },
  { href: "/workshop/operators", label: "Operators", icon: Users, adminOnly: true },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href || pathname.startsWith("/workshop/agents");
  return pathname === href || pathname.startsWith(href + "/");
}

export function WorkshopShell({
  displayName,
  role,
  children,
}: {
  displayName: string;
  role: "admin" | "operator";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV.filter((item) => !("adminOnly" in item) || role === "admin");

  async function signOut() {
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.push("/workshop/sign-in");
      router.refresh();
    } catch {
      toast.error("Couldn't sign out. Check your connection and try again.");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#workshop-main"
        className="sr-only rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60]"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 lg:px-8">
          <Link
            href="/workshop"
            className="flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">
              W
            </span>
            <span className="hidden flex-col leading-tight sm:flex">
              <span className="text-sm font-semibold tracking-tight text-foreground">Workshop</span>
              <span className="text-[11px] text-muted-foreground">House of Ahmar</span>
            </span>
          </Link>

          <nav aria-label="Workshop" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {items.map((item) => {
              const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("size-4", active && "text-primary")} aria-hidden="true" />
                  <span className="hidden sm:inline">{item.label}</span>
                  <span className="sr-only sm:hidden">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden text-right leading-tight md:block">
              <p className="max-w-40 truncate text-sm font-medium text-foreground">{displayName}</p>
              <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main
        id="workshop-main"
        tabIndex={-1}
        className="mx-auto max-w-6xl px-4 py-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[calc(2rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] focus:outline-none lg:px-8 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}
