import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

// A member card is a 48px avatar inside `py-4` card padding plus `p-4` content
// padding = 112px, in the same 1/2/3-column grid.
export default function MembersLoading() {
  return (
    <div>
      <PageHeaderSkeleton label="Loading our people" />

      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
