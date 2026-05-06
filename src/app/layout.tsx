import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// Inter for everything — matches jawaadahmar.com landing-page typography.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// `--font-serif` is intentionally aliased to Inter so the legacy
// `font-heading` utility still resolves to a real font without pulling in a
// separate serif family.
export const metadata: Metadata = {
  title: "House of Ahmar",
  description: "The gates are closed. Only blood enters.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${inter.className} ${geistMono.variable} antialiased`}
        style={{ ["--font-serif" as string]: "var(--font-sans)" }}
      >
        <TooltipProvider>
          {children}
          <Toaster
            theme="dark"
            toastOptions={{
              style: {
                background: "#0a0a0a",
                border: "1px solid #262626",
                color: "#ededed",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
