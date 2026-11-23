"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DayResponse, RevealResponse } from "@/lib/api-types";
import { formatLongDate } from "@/lib/dates";
import { formatMeters, ores, rankFor, RANKS, TIERS, type TierId } from "@/lib/tiers";
import { achievementStates } from "@/lib/achievements";
import { computeStats, markAchievementsSeen, recordShare, seenAchievements, shareCount, totalDepth, type DayRecord } from "@/lib/client/storage";
import { useDays } from "@/lib/client/useDays";
import { useMounted } from "@/lib/client/useMounted";
import { alldle } from "@/lib/client/alldle";
import { shareImage } from "@/lib/client/share";
import AchievementToasts from "./AchievementToasts";
import RevealList from "./RevealList";
import s from "./Game.module.css";

function useNextDailyCountdown(enabled: boolean): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const ms = midnight.getTime() - now.getTime();
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const sec = Math.floor((ms % 60_000) / 1000);
      setLabel(`${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return label;
}

export default function Summary({ day, record, mode }: { day: DayResponse; record: DayRecord; mode: "daily" | "archive" }) {
  const total = totalDepth(record);
  const rank = rankFor(total);
  const nextRank = RANKS.find((r) => r.min > total);
  const countdown = useNextDailyCountdown(mode === "daily");
  const mounted = useMounted();
  const days = useDays();
  const streak = useMemo(() => (mounted ? computeStats(days).currentStreak : 0), [mounted, days]);
  // Achievements unlocked since the player last saw this screen. The "seen"
  // list is read once, so the banner stays up after they're marked seen.
  const seenAtOpen = useMemo(() => (mounted ? seenAchievements() : null), [mounted]);
  // Bumped after each share so share achievements unlock right away.
  const [shares, setShares] = useState<number | null>(null);
  const shareTotal = shares ?? (mounted ? shareCount() : 0);
  const newAchievements = useMemo(
    () =>
      seenAtOpen
        ? achievementStates(Object.values(days), shareTotal).filter((a) => a.unlocked && !seenAtOpen.has(a.achievement.id))
        : [],
    [seenAtOpen, days, shareTotal],
  );
  useEffect(() => {
    if (newAchievements.length) markAchievementsSeen(newAchievements.map((a) => a.achievement.id));
  }, [newAchievements]);
  const [copied, setCopied] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const answersRef = useRef<HTMLDivElement>(null);
  // From the pager at the bottom, jump back up to the newly chosen list.
  const pageTo = (i: number) => {
    setTab(i);
    answersRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [reveals, setReveals] = useState<Record<number, RevealResponse>>({});

  useEffect(() => {
    if (reveals[tab]) return;
    let cancelled = false;
    fetch(`/api/reveal/${day.date}/${tab}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !cancelled) setReveals((prev) => ({ ...prev, [tab]: data }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tab, day.date, reveals]);

  const shareData = () => ({
    number: day.number,
    date: day.date,
    total,
    rounds: record.rounds,
    url: mode === "daily" ? window.location.origin : `${window.location.origin}/archive/${day.date}`,
  });

  const flash = (msg: string) => {
    setCopied(msg);
    setTimeout(() => setCopied(null), 2200);
  };

  // Share the result card (no category names, so no spoilers). Where the
  // device can't share files, download it instead.
  const share = async () => {
    const data = shareData();
    const blob = await shareImage(data);
    if (!blob) return flash("Couldn't draw the card.");
    const file = new File([blob], `orebit-${day.number}.png`, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `Orebit #${day.number} · ${data.url}` });
        if (mode === "daily") setShares(recordShare());
        alldle.track("result_shared", { how: "share_sheet" });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Otherwise fall through to download.
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash("Card saved");
    if (mode === "daily") setShares(recordShare());
    alldle.track("result_shared", { how: "download" });
  };

  const allFound = record.rounds.flatMap((r) => r?.found ?? []);
  const tierTally = ([6, 5, 4, 3, 2, 1] as TierId[]).map((t) => ({
    t,
    n: allFound.filter((o) => o.tier === t).length,
  }));

  return (
    <section className={s.summary}>
      <p className={s.kicker}>
        Mission report · #{day.number} · {formatLongDate(day.date)}
      </p>
      <div className={s.summaryHero}>
        <div>
          <span className={s.heroNum}>{total.toLocaleString("en-US")}</span>
          <span className={s.heroUnit}>m</span>
        </div>
        <p className={s.rank}>{rank.title}</p>
        {nextRank && (
          <p className={s.rankNext}>
            {nextRank.min - total} m short of {nextRank.title}
          </p>
        )}
      </div>

      <div className={s.tally}>
        {tierTally.map(({ t, n }) => (
          <div key={t} className={s.tallyItem} data-zero={n === 0} style={{ "--c": TIERS[t].color } as React.CSSProperties}>
            <span className={s.gem} data-tier={t} />
            <span className={s.tallyNum}>{n}</span>
            <span className={s.tallyName}>{TIERS[t].name}</span>
          </div>
        ))}
      </div>

      <div className={s.shareRow}>
        <button className={s.primaryBtn} onClick={share}>
          Share result
        </button>
      </div>
      <p className={s.toast} aria-live="polite">
        {copied ?? " "}
      </p>

      <div className={s.metaRow}>
        {mode === "daily" ? (
          <>
            <div>
              <span className={s.metaNum}>{countdown}</span>
              <span className={s.statLabel}>until the next survey</span>
            </div>
            <div>
              <span className={s.metaNum}>{streak}</span>
              <span className={s.statLabel}>day streak</span>
            </div>
          </>
        ) : (
          <div>
            <span className={s.statLabel}>Archive runs don&apos;t count toward your stats, streak or achievements.</span>
          </div>
        )}
        <div className={s.metaLinks}>
          <Link href="/stats">Your stats</Link>
          <Link href="/archive">Archive</Link>
        </div>
      </div>

      <div className={s.answersHead} ref={answersRef}>
        <h2 className={s.answersTitle}>Every answer</h2>
        <p className={s.answersHint}>Pick an asteroid to see all of its answers.</p>
      </div>
      <div className={s.tabs} role="tablist" aria-label="Asteroids">
        {day.rounds.map((r, i) => {
          const res = record.rounds[i];
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={tab === i}
              className={s.tab}
              onClick={() => setTab(i)}
            >
              <span className={s.tabTitle}>
                <span className={s.tabNum}>{i + 1}</span>
                {r.title}
              </span>
              <span className={s.tabMeta}>
                {ores(res?.found.length ?? 0)} · {formatMeters(res?.depth ?? 0)}
              </span>
            </button>
          );
        })}
      </div>
      <RevealList answers={reveals[tab]?.answers ?? null} found={record.rounds[tab]?.found ?? []} />
      <div className={s.tabPager}>
        <button className={s.pagerBtn} onClick={() => pageTo(tab - 1)} disabled={tab === 0}>
          {tab > 0 ? <>&lsaquo; {day.rounds[tab - 1].title}</> : <>&lsaquo;</>}
        </button>
        <span className={s.pagerPos}>
          {tab + 1} of {day.rounds.length}
        </span>
        <button className={s.pagerBtn} onClick={() => pageTo(tab + 1)} disabled={tab === day.rounds.length - 1}>
          {tab < day.rounds.length - 1 ? <>{day.rounds[tab + 1].title} &rsaquo;</> : <>&rsaquo;</>}
        </button>
      </div>

      {newAchievements.length > 0 && (
        <div className={s.achievementsNew} role="status">
          <p className={s.achievementsKicker}>Achievement{newAchievements.length > 1 ? "s" : ""} unlocked</p>
          <ul>
            {newAchievements.map(({ achievement }) => (
              <li key={achievement.id}>
                <strong>{achievement.title}</strong>
                <span>{achievement.description}</span>
              </li>
            ))}
          </ul>
          <Link href="/stats#achievements" className={s.achievementsLink}>
            See all achievements
          </Link>
        </div>
      )}
      <AchievementToasts items={newAchievements.map((a) => a.achievement)} />
    </section>
  );
}
