import type { MetadataRoute } from "next";

// PWA manifest — makes "Add to Home Screen" render as a real app on phones.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "House of Ahmar",
    short_name: "Ahmar",
    description: "A private home for the House of Ahmar. By initiation only.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon", type: "image/png", sizes: "180x180" },
    ],
  };
}
