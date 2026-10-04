import { Skeleton } from "@/components/ui/skeleton";

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  /**
   * Heading level for the title. Pages keep the default `h1`; a section that
   * sits under an existing page heading passes `as="h2"` so the document
   * outline never skips a level.
   */
  as?: "h1" | "h2";
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  as: Heading = "h1",
  children,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {eyebrow}
          </p>
        )}
        <Heading className="font-heading text-2xl font-bold tracking-tight text-foreground text-balance wrap-anywhere sm:text-3xl">
          {title}
        </Heading>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/**
 * The header shape every `loading.tsx` in the House opens with. The block
 * sizes mirror the real header's line boxes (2rem title / 2.25rem at `sm`,
 * 1.25rem description + its 0.375rem gap) so the skeleton and the page it
 * becomes occupy the same space and nothing jumps.
 *
 * It also carries the one polite "loading" announcement per route, so screen
 * readers get told a navigation is in flight instead of sitting in silence.
 */
export function PageHeaderSkeleton({
  /** What is loading, for the screen-reader announcement. */
  label = "Loading",
}: {
  label?: string;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton className="h-8 w-48 sm:h-9 sm:w-64" aria-hidden="true" />
      <Skeleton
        className="mt-1.5 h-5 w-full max-w-xs"
        aria-hidden="true"
      />
    </div>
  );
}
