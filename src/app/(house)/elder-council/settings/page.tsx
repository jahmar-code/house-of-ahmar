import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getHouseSettings } from "@/lib/settings";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "./settings-form";

export default async function HouseSettingsPage() {
  try {
    await requireRole("elder");
  } catch {
    redirect("/dashboard");
  }

  const settings = await getHouseSettings();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="House Settings"
        description="Configure how the House of Ahmar appears to your family."
      />
      <SettingsForm initial={settings} />
    </div>
  );
}
