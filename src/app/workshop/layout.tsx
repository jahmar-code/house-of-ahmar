import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Workshop", template: "%s · Workshop" },
  description: "Agent monitoring for the House of Ahmar.",
  robots: { index: false, follow: false },
};

export default function WorkshopRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
