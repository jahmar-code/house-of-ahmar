import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function GatheringsLoading() {
  return (
    <div>
      <PageHeaderSkeleton label="Loading gatherings" />

      <div aria-hidden="true">
        {/* The "Upcoming" section label */}
        <Skeleton className="mb-4 h-4 w-24" />
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
