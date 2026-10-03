import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getServerEnv } from "@/lib/env";

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

  return NextResponse.redirect(
    new URL("/sign-in?error=confirmation_failed", origin)
  );
}

function resolveOrigin(request: NextRequest): string {
  // Prefer the configured site URL so a spoofed `x-forwarded-host` can't turn
  // the post-confirmation redirect into an off-site open redirect.
  const configured = getServerEnv().NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // Never derive a redirect destination from caller-controlled forwarded headers.
  return request.nextUrl.origin;
}
