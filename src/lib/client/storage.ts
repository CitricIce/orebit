"use client";

import { addDays, localToday } from "../dates";
import { ROUND_SECONDS, TIERS, type TierId } from "../tiers";

export interface FoundOre {
  name: string;
  tier: TierId;
}

export interface RoundResult {
  id: string;
  title: string;
  found: FoundOre[];
  depth: number;
}

export interface ActiveRound {
  index: number;
  startedAt: number;
  found: FoundOre[];
}

export interface DayRecord {
  date: string;
  /** Local date the player finished the run (archive plays differ from date). */
  playedOn?: string;
  rounds: RoundResult[];
  active?: ActiveRound;
  completed: boolean;
}

// v6: the schedule was replanned for easier days, so older saves no longer match.
const DAYS_KEY = "orebit:v6:days";
const SOUND_KEY = "orebit:v1:sound";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked. The game still works, it just won't remember.
  }
}

export function depthOf(found: FoundOre[]): number {
  return found.reduce((sum, o) => sum + TIERS[o.tier].depth, 0);
}

export function loadAllDays(): Record<string, DayRecord> {
  return read<Record<string, DayRecord>>(DAYS_KEY, {});
}

export function loadDay(date: string): DayRecord | null {
  return loadAllDays()[date] ?? null;
}

export function saveDay(record: DayRecord): void {
  const all = loadAllDays();
  all[record.date] = record;
  write(DAYS_KEY, all);
}

/** Grace period after the timer for a slow network on the final guess. */
const GRACE_MS = 3000;

/**
 * If the player left mid-round and the clock has run out, lock the round in
 * with whatever they found. This stops "refresh to retry".
 */
export function settleExpiredRound(record: DayRecord, titles: Record<string, string>, ids: string[]): DayRecord {
  const a = record.active;
  if (!a) return record;
  if (Date.now() - a.startedAt < ROUND_SECONDS * 1000 + GRACE_MS) return record;
  const id = ids[a.index];
  const rounds = [...record.rounds];
  rounds[a.index] = { id, title: titles[id] ?? id, found: a.found, depth: depthOf(a.found) };
  return { ...record, rounds, active: undefined };
}

export function totalDepth(record: DayRecord): number {
  return record.rounds.reduce((s, r) => s + (r?.depth ?? 0), 0);
}

export function soundEnabled(): boolean {
  return read<boolean>(SOUND_KEY, true);
}

export function setSoundEnabled(on: boolean): void {
  write(SOUND_KEY, on);
}

export interface Stats {
  played: number;
  currentStreak: number;
  maxStreak: number;
  bestDepth: number;
  bestDate: string | null;
  averageDepth: number;
  totalOres: number;
  tierTotals: Record<TierId, number>;
  starcores: { date: string; name: string; category: string }[];
  bestRound: { date: string; title: string; depth: number; count: number } | null;
  recent: { date: string; depth: number }[];
}

export function computeStats(all: Record<string, DayRecord> = loadAllDays(), today = localToday()): Stats {
  const done = Object.values(all)
    .filter((d) => d.completed)
    .sort((a, b) => a.date.localeCompare(b.date));

  const tierTotals: Record<TierId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const starcores: Stats["starcores"] = [];
  let bestDepth = 0;
  let bestDate: string | null = null;
  let totalOres = 0;
  let sum = 0;
  let bestRound: Stats["bestRound"] = null;

  for (const d of done) {
    const t = totalDepth(d);
    sum += t;
    if (t > bestDepth) {
      bestDepth = t;
      bestDate = d.date;
    }
    for (const r of d.rounds) {
      if (!r) continue;
      totalOres += r.found.length;
      if (!bestRound || r.depth > bestRound.depth) {
        bestRound = { date: d.date, title: r.title, depth: r.depth, count: r.found.length };
      }
      for (const o of r.found) {
        tierTotals[o.tier]++;
        if (o.tier === 6) starcores.push({ date: d.date, name: o.name, category: r.title });
      }
    }
  }

  // Streaks only count dailies played on their own day, not archive replays.
  const onTime = new Set(done.filter((d) => d.playedOn === d.date).map((d) => d.date));
  let maxStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const date of [...onTime].sort()) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    prev = date;
  }
  let currentStreak = 0;
  let cursor = onTime.has(today) ? today : addDays(today, -1);
  while (onTime.has(cursor)) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

  return {
    played: done.length,
    currentStreak,
    maxStreak,
    bestDepth,
    bestDate,
    averageDepth: done.length ? Math.round(sum / done.length) : 0,
    totalOres,
    tierTotals,
    starcores: starcores.reverse(),
    bestRound,
    recent: done.slice(-14).map((d) => ({ date: d.date, depth: totalDepth(d) })),
  };
}
