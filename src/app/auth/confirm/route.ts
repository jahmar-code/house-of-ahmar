import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Email confirmation / magic-link callback.
 *
 * Supabase sends users here after they click the link in their email. It
 * handles both link styles:
 *   - PKCE / OAuth     → `?code=...`            (exchangeCodeForSession)
 *   - OTP email links  → `?token_hash=&type=`   (verifyOtp)
 *
 * On success the session cookies are set and the user is forwarded to `next`
 * (defaults to /initiation). On failure they go to /sign-in with an error.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = sanitizeNext(searchParams.get("next"));

  // Build absolute redirects from the forwarded host so this works behind a
  // proxy/load balancer (Vercel, etc.) as well as locally.
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

/** Only allow same-site relative redirects to avoid open-redirect abuse. */
function sanitizeNext(next: string | null): string {
  // Must be a root-relative path. Reject protocol-relative ("//host") and
  // backslashes ("/\host"), which the WHATWG URL parser normalizes to "/",
  // both of which would escape to an off-site origin.
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("\\")
  ) {
    return next;
  }
  return "/initiation";
}

function resolveOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }
  return request.nextUrl.origin;
}
