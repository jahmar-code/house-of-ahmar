import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { gatherings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { GatheringForm } from "@/components/gatherings/gathering-form";

export default async function EditGatheringPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAuth();

  const gathering = await db.query.gatherings.findFirst({
    where: eq(gatherings.id, id),
  });
  if (!gathering) notFound();

  if (gathering.createdBy !== ctx.memberId && ctx.role !== "elder") {
    redirect(`/gatherings/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit Gathering" description={gathering.title} />
      <GatheringForm
        initial={{
          id: gathering.id,
          title: gathering.title,
          description: gathering.description,
          location: gathering.location,
          startsAt: gathering.startsAt.toISOString(),
          endsAt: gathering.endsAt ? gathering.endsAt.toISOString() : null,
        }}
      />
    </div>
  );
}
