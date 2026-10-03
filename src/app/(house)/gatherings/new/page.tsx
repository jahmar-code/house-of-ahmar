import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { GatheringForm } from "@/components/gatherings/gathering-form";

export default async function NewGatheringPage() {
  // Guests are read-only: createGathering refuses them server-side, so don't
  // render a form that can only ever fail. The list page already hides the
  // entry point — this closes the direct-URL path.
  const ctx = await requirePageAuth();
  if (ctx.role === "guest") redirect("/gatherings");

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Plan a Gathering" eyebrow="Gatherings" />
      <GatheringForm />
    </div>
  );
}
