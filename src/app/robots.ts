import type { MetadataRoute } from "next";

// Private, invite-only space — keep every crawler out.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
