import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// Heights track the real components so the swap does not shift the page:
// StatsCard is a 44px icon inside `py-4` card padding plus `p-4 sm:p-5`
// content padding (108px, 116px at `sm`); the four summary cards are a card
// header plus two rows of content.
export default function DashboardLoading() {
  return (
    <div>
      <PageHeaderSkeleton label="Loading the Great Hall" />

      <div aria-hidden="true">
        {/* HallSummary — the one warm line */}
        <Skeleton className="mb-8 h-5 w-full max-w-md" />

        <div className="mb-8 grid grid-cols-2 gap-4">
          <Skeleton className="h-[6.75rem] rounded-xl sm:h-[7.25rem]" />
          <Skeleton className="h-[6.75rem] rounded-xl sm:h-[7.25rem]" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
