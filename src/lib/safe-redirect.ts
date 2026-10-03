/**
 * Single source of truth for "is this `next` value safe to redirect to".
 *
 * Only same-site, root-relative paths are allowed. Everything else falls back
 * to a caller-supplied default. This guards two entry points that both accept a
 * user-supplied `next` — the email-confirmation callback and the sign-in form —
 * so they can never drift apart again.
 */
export function safeRedirectPath(
  next: string | null | undefined,
  fallback: string
): string {
  if (typeof next !== "string" || next.length === 0) return fallback;

  // Must be root-relative. Reject protocol-relative ("//host") and backslash
  // ("/\host") forms, which the WHATWG URL parser normalises to an off-site
  // origin, plus anything carrying an explicit scheme.
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  if (next.includes("://")) return fallback;
  // WHATWG strips tabs/newlines before parsing: `/\n/evil.example` becomes
  // protocol-relative even though the original string did not start with //.
  if (/[\u0000-\u0020\u007f]/.test(next)) return fallback;

  const base = "https://house.invalid";
  try {
    if (new URL(next, base).origin !== base) return fallback;
  } catch {
    return fallback;
  }

  return next;
}
