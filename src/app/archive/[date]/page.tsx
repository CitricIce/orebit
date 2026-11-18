import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DailyGame from "@/components/DailyGame";
import { dayNumber, isDateString, LAUNCH_DATE } from "@/lib/dates";

export async function generateMetadata({ params }: PageProps<"/archive/[date]">): Promise<Metadata> {
  const { date } = await params;
  return { title: isDateString(date) ? `Survey #${dayNumber(date)}` : "Archive" };
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
