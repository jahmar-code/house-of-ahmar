import Link from "next/link";

export default function InitiationCompletePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 px-6 text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-gold/40 bg-card glow-gold">
          <span className="font-heading text-4xl font-bold text-gold">A</span>
        </div>

        <div className="space-y-3">
          <h1 className="font-heading text-3xl font-bold text-foreground">
            Welcome to the House
          </h1>
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
          <p className="text-muted-foreground">
            You are now a member of the House of Ahmar.
            <br />
            <span className="text-gold/80">The gates open for you.</span>
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-md bg-gold px-8 text-sm font-medium text-gold-foreground transition-colors hover:bg-gold/90"
        >
          Enter the Great Hall
        </Link>
      </div>
    </div>
  );
}
