import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { getHouseSettings } from "@/lib/settings";
import { HouseSidebar } from "@/components/layout/house-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PresenceProvider } from "@/components/layout/presence-provider";

export default async function HouseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/initiation");

  const settings = await getHouseSettings();

  return (
    <div className="min-h-screen bg-background">
      {/* First thing in the tab order: skip the six sidebar links and the
          account menu on every route change. Invisible until focused. */}
      <a
        href="#main-content"
        className="sr-only rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
      >
        Skip to content
      </a>

      <PresenceProvider />
      <HouseSidebar
        role={ctx.role}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
        houseName={settings.houseName}
      />

      <MobileHeader
        role={ctx.role}
        displayName={ctx.displayName}
        avatarUrl={ctx.avatarUrl}
        houseName={settings.houseName}
      />

      {/* Main content area — `tabIndex={-1}` so the skip link actually moves
          focus here, not just the scroll position. */}
      <main
        id="main-content"
        tabIndex={-1}
        // The horizontal insets matter now that `viewportFit: "cover"` is set:
        // in landscape on a notched iPhone the notch eats 44px of one side,
        // and without these the text runs underneath it.
        className="pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:pl-64"
      >
        <div className="mx-auto max-w-5xl px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
