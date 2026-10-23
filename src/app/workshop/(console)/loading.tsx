import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function WorkshopLoading() {
  return (
    <div>
      <PageHeaderSkeleton label="Loading the Workshop" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" aria-hidden="true" />
        ))}
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}
