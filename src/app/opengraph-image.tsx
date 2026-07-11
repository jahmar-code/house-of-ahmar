import { ImageResponse } from "next/og";

// Branded social-share card (WhatsApp/iMessage/Twitter link previews).
export const alt = "House of Ahmar — a private home for our family.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "sans-serif",
        }}
      >
        {/* Monogram */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 132,
            height: 132,
            borderRadius: 30,
            border: "2px solid rgba(251,146,60,0.35)",
            background: "rgba(251,146,60,0.08)",
            marginBottom: 48,
          }}
        >
          <div style={{ fontSize: 78, fontWeight: 800, color: "#fb923c" }}>A</div>
        </div>

        <div style={{ fontSize: 78, fontWeight: 800, letterSpacing: -2 }}>
          House of Ahmar
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#a3a3a3",
            marginTop: 22,
          }}
        >
          A private home for our family — kept, not scrolled away.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 20,
            color: "#fb923c",
            letterSpacing: 8,
            marginTop: 44,
          }}
        >
          EST. AHMAR
        </div>
      </div>
    ),
    { ...size }
  );
}
