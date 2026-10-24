/** The Workshop's entry pages: brand mark, heading, and the form beneath. */
export function WorkshopAuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mb-5 flex justify-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-primary font-mono text-2xl font-bold text-primary-foreground">
              W
            </span>
          </div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">House of Ahmar</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
