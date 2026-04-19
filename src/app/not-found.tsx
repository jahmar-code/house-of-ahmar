import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-6">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-gold/20 bg-card">
          <span className="font-heading text-3xl font-bold text-gold/50">?</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          You have wandered beyond the walls.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This path does not lead anywhere within the House.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md border border-gold/30 bg-gold/10 px-6 text-sm text-gold transition-colors hover:bg-gold/20"
        >
          Return to the Great Hall
        </Link>
      </div>
    </div>
  );
}
