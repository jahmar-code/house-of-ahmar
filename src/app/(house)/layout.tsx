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

      {/* Main content area */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
