import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import s from "./layout.module.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Orebit · the daily asteroid dig",
    template: "%s · Orebit",
  },
  description:
    "Three asteroids a day, thirty seconds each. Name as many answers as you can. Common ones are surface dust. Rare ones are buried treasure.",
  openGraph: {
    title: "Orebit · the daily asteroid dig",
    description: "Three asteroids. Thirty seconds each. How deep can you drill?",
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
      </body>
    </html>
  );
}
