interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
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
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground text-balance sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      )}
    </div>
  );
}
