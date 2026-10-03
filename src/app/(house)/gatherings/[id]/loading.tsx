import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Without this the gatherings LIST skeleton cascades down onto the detail
// route, so opening a gathering flashed a stack of cards that never appear.
export default function GatheringDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeaderSkeleton label="Loading this gathering" />
      <Skeleton className="h-96 w-full rounded-xl" aria-hidden="true" />
    </div>
  );
}
