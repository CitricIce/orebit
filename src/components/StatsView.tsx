"use client";

import Link from "next/link";
import { useMemo } from "react";
import { achievementStates } from "@/lib/achievements";
import { computeStats } from "@/lib/client/storage";
import { useDays } from "@/lib/client/useDays";
import { useMounted } from "@/lib/client/useMounted";
import { formatShortDate } from "@/lib/dates";
import { formatMeters, ores, TIER_LIST } from "@/lib/tiers";
import s from "./Pages.module.css";

export default function StatsView() {
  const mounted = useMounted();
  const days = useDays();
  const stats = useMemo(() => (mounted ? computeStats(days) : null), [mounted, days]);
  const achievements = useMemo(() => achievementStates(Object.values(days)), [days]);
  if (!stats) return null;

  if (stats.played === 0) {
    return (
      <section>
        <p className={s.kicker}>Pilot record</p>
        <h1 className={s.h1}>No surveys logged yet.</h1>
        <p className={s.lede}>Finish your first daily mission and your stats show up here.</p>
        <Link href="/" className={s.cta}>
          Start today&apos;s survey
        </Link>
        <div style={{ marginTop: 32 }}>
          <Achievements states={achievements} />
        </div>
      </section>
    );
  }

  const maxRecent = Math.max(1, ...stats.recent.map((r) => r.depth));
  const maxTier = Math.max(1, ...Object.values(stats.tierTotals));

  return (
    <section>
      <p className={s.kicker}>Pilot record</p>
      <h1 className={s.h1}>Your stats</h1>

      <div className={s.statGrid}>
        <Stat label="Surveys finished" value={stats.played} />
        <Stat label="Current streak" value={stats.currentStreak} />
        <Stat label="Best streak" value={stats.maxStreak} />
        <Stat label="Deepest day" value={formatMeters(stats.bestDepth)} sub={stats.bestDate ? formatShortDate(stats.bestDate) : undefined} />
        <Stat label="Average day" value={formatMeters(stats.averageDepth)} />
        <Stat label="Ores mined" value={stats.totalOres} />
      </div>

      <div className={s.panels}>
        <div className={s.panel}>
          <h2 className={s.h2}>Ore collection</h2>
          <ul className={s.bars}>
            {[...TIER_LIST].reverse().map((t) => (
              <li key={t.id} style={{ "--c": t.color } as React.CSSProperties}>
                <span className={s.barLabel}>{t.name}</span>
                <span className={s.barTrack}>
                  <span className={s.barFill} style={{ width: `${(stats.tierTotals[t.id] / maxTier) * 100}%` }} />
                </span>
                <span className={s.barNum}>{stats.tierTotals[t.id]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={s.panel}>
          <h2 className={s.h2}>Recent depth</h2>
          <div className={s.spark} role="img" aria-label="Depth for your recent surveys">
            {stats.recent.map((r) => (
              <div key={r.date} className={s.sparkCol} title={`${formatShortDate(r.date)}: ${formatMeters(r.depth)}`}>
                <span className={s.sparkBar} style={{ height: `${Math.max(4, (r.depth / maxRecent) * 100)}%` }} />
                <span className={s.sparkLabel}>{formatShortDate(r.date).split(" ")[1]}</span>
              </div>
            ))}
          </div>
          {stats.bestRound && (
            <p className={s.note}>
              Best single rock: {stats.bestRound.title}, {ores(stats.bestRound.count)} for {formatMeters(stats.bestRound.depth)}.
            </p>
          )}
        </div>
      </div>

      <div className={s.panel}>
        <h2 className={s.h2}>Starcores found</h2>
        {stats.starcores.length === 0 ? (
          <p className={s.note}>None yet. Each asteroid hides exactly one. Think of the answer only a real fan would know.</p>
        ) : (
          <ul className={s.starcores}>
            {stats.starcores.map((c) => (
              <li key={`${c.date}-${c.name}`}>
                <span className={s.starGem} />
                <strong>{c.name}</strong>
                <span className={s.muted}>
                  {c.category} · {formatShortDate(c.date)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Achievements states={achievements} />
    </section>
  );
}

function Achievements({ states }: { states: ReturnType<typeof achievementStates> }) {
  const unlocked = states.filter((a) => a.unlocked).length;
  return (
    <div className={`${s.panel} ${s.achievementsPanel}`} id="achievements">
      <h2 className={s.h2}>
        Achievements <span className={s.muted}>{unlocked} / {states.length}</span>
      </h2>
      <ul className={s.achievements}>
        {states.map(({ achievement, value, unlocked }) => (
          <li key={achievement.id} className={s.achievement} data-unlocked={unlocked}>
            <span className={s.achievementBadge} aria-hidden="true">
              {unlocked ? "\u2605" : "\u2606"}
            </span>
            <span className={s.achievementText}>
              <strong>{achievement.title}</strong>
              <span className={s.muted}>{achievement.description}</span>
              {!unlocked && achievement.goal > 1 && (
                <span className={s.achievementProgress}>
                  <span className={s.achievementTrack}>
                    <span style={{ width: `${(value / achievement.goal) * 100}%` }} />
                  </span>
                  <span className={s.achievementCount}>
                    {value.toLocaleString("en-US")} / {achievement.goal.toLocaleString("en-US")}
                  </span>
                </span>
              )}
            </span>
            <span className="sr-only">{unlocked ? "Unlocked" : "Locked"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className={s.stat}>
      <span className={s.statValue}>{value}</span>
      <span className={s.statLabel}>{label}</span>
      {sub && <span className={s.statSub}>{sub}</span>}
    </div>
  );
}
