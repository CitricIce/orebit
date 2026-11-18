"use client";

import { localToday } from "@/lib/dates";
import { useMounted } from "@/lib/client/useMounted";
import Game from "./Game";

/**
 * "Today" depends on the player's clock, so it has to be worked out in the
 * browser. Picks archive mode when a past date is opened from the archive.
 */
export default function DailyGame({ date }: { date?: string }) {
  const mounted = useMounted();
  if (!mounted) return null;
  const today = localToday();
  const target = date ?? today;
  return <Game key={target} date={target} mode={target === today ? "daily" : "archive"} />;
}
