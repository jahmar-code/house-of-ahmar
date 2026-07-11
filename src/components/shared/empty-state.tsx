import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
