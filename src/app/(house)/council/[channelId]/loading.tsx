import { Skeleton } from "@/components/ui/skeleton";

// A loading.tsx cascades to every nested route without its own, so the chamber
// LIST skeleton was painting over the chat view. A chamber is a header strip
// plus a stack of message rows — show that instead.
export default function ChannelLoading() {
  return (
    <div className="flex h-[calc(100dvh-10rem-env(safe-area-inset-bottom))] flex-col lg:h-[calc(100dvh-6rem)]">
      <p role="status" className="sr-only">
        Loading the chamber
      </p>

      <div
        className="flex items-center gap-3 border-b border-border pb-4"
        aria-hidden="true"
      >
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      <div className="flex-1 space-y-4 py-4" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-2">
            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className={i % 2 === 0 ? "h-4 w-3/4" : "h-4 w-1/2"} />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border pt-4" aria-hidden="true">
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}
