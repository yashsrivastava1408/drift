import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";
import "./globals.css";

// D-DIN, the typeface used by SpaceX. Open Font License, see ./fonts/LICENSE.txt.
const ddin = localFont({
  src: [
    { path: "./fonts/D-DIN.woff2", weight: "400", style: "normal" },
    { path: "./fonts/D-DIN-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-ddin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Expense Tracker",
  description: "Your personal expense tracker",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Renders on every request so each page gets its own security nonce.
  await connection();
  return (
    <html lang="en" className={ddin.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
