import { PageHeaderSkeleton } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The baseline streaming fallback for every route in the House.
 *
 * Without a `loading.tsx` the App Router cannot stream: Next holds the
 * previous page fully painted until the new route's RSC payload is complete,
 * so a tap on the bottom tab bar does visibly nothing on a phone. This paints
 * the shell of the next page immediately; the per-route files below it swap in
 * a closer likeness where the shape is worth matching.
 */
export default function HouseLoading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}
