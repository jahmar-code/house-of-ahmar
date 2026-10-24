// Pure host routing for the Workshop subdomain. Kept free of Next imports so
// it is unit-testable and safe in the proxy.

/** Paths the Workshop host serves as-is: its own pages plus shared auth plumbing. */
const PASSTHROUGH = ["/workshop", "/api/agents", "/auth", "/forgot-password", "/reset-password", "/robots.txt", "/manifest.webmanifest"];

const ALIASES: Record<string, string> = {
  "/sign-in": "/workshop/sign-in",
  "/sign-up": "/workshop/sign-up",
};

function matches(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * On the Workshop host, returns the internal path to rewrite to, or null to
 * serve the request unchanged. Any other host always gets null. Every House
 * path is mapped under /workshop, where it 404s rather than rendering family
 * content on the operators' domain.
 */
export function workshopRewritePath(pathname: string, host: string, workshopHost: string | undefined): string | null {
  if (!workshopHost || host !== workshopHost) return null;
  if (PASSTHROUGH.some((p) => matches(pathname, p))) return null;
  if (ALIASES[pathname]) return ALIASES[pathname];
  return pathname === "/" ? "/workshop" : `/workshop${pathname}`;
}
