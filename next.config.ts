import type { NextConfig } from "next";

/**
 * The Supabase host, read straight from the public project URL so feed media
 * can go through next/image. Deliberately non-throwing and inlined rather than
 * imported from `src/lib/env.ts`: a missing variable must not take the whole
 * build down, and next.config is evaluated outside the app's module graph.
 */
function supabaseHostname(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

const storageHost = supabaseHostname();

// Applied to every response. Deliberately no script-src: Next's inline
// bootstrap scripts would break, and React's escaping is the primary XSS
// defence. frame-ancestors is the part that matters here — it stops the
// authenticated House (including the Elder Council's role and deactivate
// controls) being framed and click-hijacked.
const securityHeaders = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  distDir: process.env.HOA_E2E === "1" ? ".next-e2e" : ".next",
  poweredByHeader: false,
  images: {
    remotePatterns: storageHost
      ? [
          {
            protocol: "https" as const,
            hostname: storageHost,
            pathname: "/storage/v1/object/**",
          },
        ]
      : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
