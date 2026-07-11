/**
 * Resolves the app's own origin so auth email links never point at the wrong
 * host. Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL        — explicit override (set this in production)
 *   2. NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL — Vercel deploys
 *   3. window.location.origin      — the actual origin in the browser
 *   4. http://localhost:3000       — local dev fallback
 *
 * Because the browser fallback (#3) is the live origin, the sign-up email
 * redirect is correct in every environment even when no env var is set — this
 * is what stops confirmation links from bouncing users to localhost.
 */
export function getURL(path = ""): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : undefined);

  const fromBrowser =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const base = (fromEnv || fromBrowser || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );

  if (!path) return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
