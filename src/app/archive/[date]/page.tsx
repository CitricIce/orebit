import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DailyGame from "@/components/DailyGame";
import { dayNumber, formatLongDate, isDateString, LAUNCH_DATE } from "@/lib/dates";

export async function generateMetadata({ params }: PageProps<"/archive/[date]">): Promise<Metadata> {
  const { date } = await params;
  if (!isDateString(date)) return { title: "Archive" };
  return {
    title: `Survey #${dayNumber(date)} · ${formatLongDate(date)}`,
    description: `Play Orebit survey #${dayNumber(date)} from ${formatLongDate(date)}: five asteroids, 45 seconds each.`,
    alternates: { canonical: `/archive/${date}` },
  };
}

async function ArchiveDayGame({ params }: { params: PageProps<"/archive/[date]">["params"] }) {
  const { date } = await params;
  if (!isDateString(date) || date < LAUNCH_DATE) notFound();
  return <DailyGame date={date} />;
}

export default function ArchiveDay({ params }: PageProps<"/archive/[date]">) {
  return (
    <Suspense fallback={null}>
      <ArchiveDayGame params={params} />
    </Suspense>
  );
}
