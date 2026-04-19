import { PageHeader } from "@/components/shared/page-header";
import { GatheringForm } from "@/components/gatherings/gathering-form";

export default function NewGatheringPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Plan a Gathering" />
      <GatheringForm />
    </div>
  );
}
