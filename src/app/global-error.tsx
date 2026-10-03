"use client";

import { useEffect } from "react";

// Catches errors in the root layout itself (must render its own <html>/<body>).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "1.5rem",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>
          The House did not load.
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#a3a3a3", maxWidth: "24rem" }}>
          Something broke before the page could open. It is not something you
          did — try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: "0.5rem",
            minHeight: "2.75rem",
            padding: "0 1.25rem",
            borderRadius: "0.5rem",
            border: "none",
            // --primary (orange-400) written out: this boundary replaces the
            // root layout, so the stylesheet and its tokens may never load.
            background: "#ff8904",
            color: "#0a0a0a",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
        {/* Deliberately a plain anchor, not next/link: the root layout is the
            thing that failed, so a full document reload is the recovery. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "2.75rem",
            padding: "0 1.25rem",
            fontSize: "0.875rem",
            color: "#a3a3a3",
          }}
        >
          Take me home
        </a>
      </body>
    </html>
  );
}
