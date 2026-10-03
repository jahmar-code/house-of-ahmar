import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * Heading level for the title. An empty state normally sits directly under
   * the page `<h1>`, so `h2` is the default; pass `h3` when it lives inside a
   * section that already has its own `h2`.
   */
  as?: "h2" | "h3";
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  as: Heading = "h2",
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <Heading className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </Heading>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
