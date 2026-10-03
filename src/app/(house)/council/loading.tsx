import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// A chamber row is a 40px icon inside `py-4` card padding = 72px, stacked with
// the same `space-y-3` the real list uses.
export default function CouncilLoading() {
  return (
    <div>
      <PageHeaderSkeleton label="Loading the Council" />

      <div className="space-y-3" aria-hidden="true">
        <Skeleton className="h-[4.5rem] w-full rounded-xl" />
        <Skeleton className="h-[4.5rem] w-full rounded-xl" />
        <Skeleton className="h-[4.5rem] w-full rounded-xl" />
      </div>
    </div>
  );
}
