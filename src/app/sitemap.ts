import type { MetadataRoute } from "next";
import { addDays, LAUNCH_DATE, latestOpenDate } from "@/lib/dates";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/archive`, changeFrequency: "daily", priority: 0.6 },
  ];
  // Past surveys, newest first. Today's lives at the home page.
  const today = latestOpenDate();
  for (let d = addDays(today, -1); d >= LAUNCH_DATE; d = addDays(d, -1)) {
    pages.push({ url: `${SITE_URL}/archive/${d}`, changeFrequency: "yearly", priority: 0.3 });
  }
  return pages;
}
