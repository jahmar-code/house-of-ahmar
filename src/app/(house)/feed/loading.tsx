import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div>
      <PageHeaderSkeleton label="Loading The Wall" />

      <div aria-hidden="true">
        {/* PostForm: type chips, textarea, action row */}
        <Skeleton className="h-56 w-full rounded-xl" />

        <div className="mt-6 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
