import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewGatheringLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeaderSkeleton label="Loading the gathering form" />
      <Skeleton className="h-[34rem] w-full rounded-xl" aria-hidden="true" />
    </div>
  );
}
