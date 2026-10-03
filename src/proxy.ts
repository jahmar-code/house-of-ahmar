import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Allow-list, never a deny-list: a route missing from here fails safe to
// "sign in required".
//
// - /forgot-password and /reset-password are the account-recovery pair. The
//   recovery link signs the user in *before* they land on /reset-password, and
//   that user may have no member row yet, so it must stay outside the
//   membership gate below or they bounce into /initiation mid-reset.
// - The metadata routes (/robots.txt, /sitemap.xml, /manifest.webmanifest) are
//   generated files, not pages: without this a crawler asking for /robots.txt
//   gets a 307 to an HTML sign-in page, which Google reads as "no robots.txt"
//   and then crawls the House anyway.
const PUBLIC_PATHS = [
  "/",
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return supabaseResponse;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  // Membership and role are resolved from Postgres in the protected layout,
  // pages, actions and media route. User-editable metadata is not an access
  // gate: stale/missing metadata must never lock a valid member in a loop.

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
