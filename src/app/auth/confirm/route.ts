import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getServerEnv } from "@/lib/env";
import { getWorkshopEnv } from "@/lib/workshop/env";

/**
 * Email confirmation / magic-link / password-recovery callback.
 *
 * Supabase sends users here after they click the link in their email. It
 * handles both link styles:
 *   - PKCE / OAuth     → `?code=...`            (exchangeCodeForSession)
 *   - OTP email links  → `?token_hash=&type=`   (verifyOtp)
 *
 * On success the session cookies are set and the user is forwarded to `next`
 * (defaults to /initiation; password recovery passes /reset-password). On
 * failure they go to /sign-in with an error, where they can ask for a new link.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Same open-redirect guard the sign-in form uses, so the two can't drift.
  const next = safeRedirectPath(searchParams.get("next"), "/initiation");

  // Pin redirects to the configured origin, never caller-controlled forwarded headers.
  const origin = resolveOrigin(request);
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const signIn = next === "/workshop" || next.startsWith("/workshop/") ? "/workshop/sign-in" : "/sign-in";
  return NextResponse.redirect(
    new URL(`${signIn}?error=confirmation_failed`, origin)
  );
}

function resolveOrigin(request: NextRequest): string {
  // The Workshop host keeps its own session cookie, so a link that arrived on
  // it returns there. Accepted only on an exact match with the configured
  // host, never from forwarded headers.
  const workshopHost = getWorkshopEnv().host;
  if (workshopHost && request.nextUrl.host.toLowerCase() === workshopHost) {
    return `${request.nextUrl.protocol}//${workshopHost}`;
  }

  // Prefer the configured site URL so a spoofed `x-forwarded-host` can't turn
  // the post-confirmation redirect into an off-site open redirect.
  const configured = getServerEnv().NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // Never derive a redirect destination from caller-controlled forwarded headers.
  return request.nextUrl.origin;
}
