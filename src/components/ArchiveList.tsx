"use client";

import Link from "next/link";
import { addDays, dayNumber, formatShortDate, LAUNCH_DATE, localToday } from "@/lib/dates";
import { formatMeters, rankFor } from "@/lib/tiers";
import { totalDepth } from "@/lib/client/storage";
import { useDays } from "@/lib/client/useDays";
import { useMounted } from "@/lib/client/useMounted";
import s from "./Pages.module.css";

export default function ArchiveList() {
  const mounted = useMounted();
  const days = useDays();
  if (!mounted) return null;
  const today = localToday();

  const dates: string[] = [];
  for (let d = today; d >= LAUNCH_DATE; d = addDays(d, -1)) dates.push(d);
  const played = dates.filter((d) => days[d]?.completed).length;

  return (
    <section>
      <p className={s.kicker}>Survey archive</p>
      <h1 className={s.h1}>Every asteroid, every day.</h1>
      <p className={s.lede}>
        Missed a day? Replay any past survey. Archive runs don&apos;t count toward your stats or streak, only the Time Traveler achievement.
      </p>
      {dates.length > 0 && (
        <div className={s.archiveProgress}>
          <span className={s.archiveProgressText}>
            <strong>{played}</strong> of {dates.length} finished
          </span>
          <span className={s.archiveProgressTrack} aria-hidden="true">
            <span style={{ width: `${(played / dates.length) * 100}%` }} />
          </span>
        </div>
      )}
      <ul className={s.archive}>
        {dates.map((d) => {
          const rec = days[d];
          const done = rec?.completed;
          const started = rec && !done && rec.rounds.some(Boolean);
          const depth = rec ? totalDepth(rec) : 0;
          return (
            <li key={d}>
              <Link href={d === today ? "/" : `/archive/${d}`} className={s.archiveCard} data-done={!!done}>
                <span className={s.archiveNum}>#{dayNumber(d)}</span>
                <span className={s.archiveDate}>{d === today ? "Today" : formatShortDate(d)}</span>
                <span className={s.archiveState}>
                  {done ? `${formatMeters(depth)} · ${rankFor(depth).title}` : started ? "In progress" : "Not played"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
