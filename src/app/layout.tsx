import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { SITE_URL } from "@/lib/site";
import s from "./layout.module.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Orebit · the daily mine",
    template: "%s · Orebit",
  },
  description:
    "Five asteroids a day, 45 seconds each. Name as many answers as you can. Obvious ones are plain stone. Rare ones are buried treasure.",
  openGraph: {
    title: "Orebit · the daily mine",
    description: "Five asteroids. 45 seconds each. How deep can you drill?",
    siteName: "Orebit",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#07060d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={<SiteHeader static />}>
          <SiteHeader />
        </Suspense>
        <main className={s.main}>{children}</main>
        <footer className={s.footer}>
          <span>Orebit</span>
          <span>New asteroids every day at local midnight.</span>
        </footer>
        {/* Alldle SDK, pinned so an update on their side can't break the game. */}
        <Script src="https://www.alldle.net/sdk/0.3.6/sdk.js" data-game="orebit" strategy="afterInteractive" />
      </body>
    </html>
  );
}
