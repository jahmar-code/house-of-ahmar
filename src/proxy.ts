import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getWorkshopEnv } from "@/lib/workshop/env";
import { workshopRewritePath } from "@/lib/workshop/routing";

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
// - /api/agents authenticates each request itself (agent bearer token or the
//   cron secret). A cookie redirect would only break agents.
// - /workshop/sign-in and /workshop/sign-up are the Workshop's own entry pages.
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
  "/api/agents",
  "/workshop/sign-in",
  "/workshop/sign-up",
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Agents carry no cookies; skip the Supabase session round-trip entirely.
  if (pathname.startsWith("/api/agents/")) return NextResponse.next();

  const { supabaseResponse, user } = await updateSession(request);

  // On the Workshop host (e.g. agents.example.af) every House page maps into
  // /workshop, so the subdomain can never show family content.
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const rewrite = workshopRewritePath(pathname, host, getWorkshopEnv().host);
  const effectivePath = rewrite ?? pathname;

  if (!isPublic(effectivePath) && !user) {
    const url = request.nextUrl.clone();
    const isWorkshop = effectivePath === "/workshop" || effectivePath.startsWith("/workshop/");
    url.pathname = isWorkshop ? "/workshop/sign-in" : "/sign-in";
    url.search = "";
    url.searchParams.set("next", effectivePath);
    const response = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  if (rewrite) {
    const url = request.nextUrl.clone();
    url.pathname = rewrite;
    const response = NextResponse.rewrite(url, { request });
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return response;
  }

  // Membership and role are resolved from Postgres in the protected layout,
  // pages, actions and media route. User-editable metadata is not an access
  // gate: stale/missing metadata must never lock a valid member in a loop.
  // Workshop access is resolved the same way, from the operators table.

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
