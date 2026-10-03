import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requirePageAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { GatheringForm } from "@/components/gatherings/gathering-form";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditGatheringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // A stale or mistyped link is a 404, not a raw Postgres uuid cast error.
  if (!UUID_RE.test(id)) notFound();
  const ctx = await requirePageAuth();

  const gathering = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, id),
  });
  if (!gathering) notFound();

  if (gathering.createdBy !== ctx.memberId && ctx.role !== "elder") {
    redirect(`/gatherings/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit Gathering" eyebrow="Gatherings" description={gathering.title} />
      <GatheringForm
        initial={{
          id: gathering.id,
          title: gathering.title,
          description: gathering.description,
          location: gathering.location,
          startsAt: gathering.startsAt.toISOString(),
          endsAt: gathering.endsAt ? gathering.endsAt.toISOString() : null,
          isAllDay: gathering.isAllDay ?? false,
        }}
      />
    </div>
  );
}
