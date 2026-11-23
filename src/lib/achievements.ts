import { addDays } from "./dates";
import { RANKS, TIERS, type TierId } from "./tiers";

// Achievements are worked out from the player's saved runs, so they need no
// server and unlock retroactively.

interface Found {
  tier: TierId;
}
interface Round {
  found: Found[];
  depth: number;
  peakSecs?: number;
}
export interface PlayedDay {
  date: string;
  playedOn?: string;
  finishedAt?: number;
  completed: boolean;
  rounds: (Round | null | undefined)[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** How far along the player is, for the progress bar. */
  progress: (f: Facts) => number;
  goal: number;
}

export interface Facts {
  surveys: number;
  archiveSurveys: number;
  bestStreak: number;
  bestDay: number;
  mostInRound: number;
  tier: Record<TierId, number>;
  totalOres: number;
  mostStarcoresInDay: number;
  fullSpectrumRounds: number;
  emptyRounds: number;
  noStoneRounds: number;
  shares: number;
  midnightFinishes: number;
  bestPeakSecs: number;
}

const roundDepth = (r: Round) => r.found.reduce((sum, o) => sum + TIERS[o.tier].depth, 0);

export function factsFrom(days: PlayedDay[], shares = 0): Facts {
  // Archive replays don't count, only dailies played on their own day.
  const done = days.filter((d) => d.completed && (!d.playedOn || d.playedOn === d.date));
  // The one exception: Time Traveler counts archive replays.
  const archiveSurveys = days.filter((d) => d.completed && d.playedOn && d.playedOn !== d.date).length;
  const tier: Record<TierId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const f: Facts = {
    surveys: done.length,
    archiveSurveys,
    bestStreak: 0,
    bestDay: 0,
    mostInRound: 0,
    tier,
    totalOres: 0,
    mostStarcoresInDay: 0,
    fullSpectrumRounds: 0,
    emptyRounds: 0,
    noStoneRounds: 0,
    shares,
    midnightFinishes: 0,
    bestPeakSecs: 0,
  };
  for (const d of done) {
    // Finished the new daily by 12:05:59 AM, right after it unlocks at midnight.
    if (d.finishedAt && d.playedOn === d.date) {
      const t = new Date(d.finishedAt);
      if (t.getHours() === 0 && t.getMinutes() <= 5) f.midnightFinishes++;
    }
    const rounds = d.rounds.filter((r): r is Round => Boolean(r));
    f.bestDay = Math.max(f.bestDay, rounds.reduce((sum, r) => sum + roundDepth(r), 0));
    let starcores = 0;
    rounds.forEach((r) => {
      f.mostInRound = Math.max(f.mostInRound, r.found.length);
      f.bestPeakSecs = Math.max(f.bestPeakSecs, r.peakSecs ?? 0);
      f.totalOres += r.found.length;
      const tiers = new Set(r.found.map((o) => o.tier));
      if ([1, 2, 3, 4, 5].every((t) => tiers.has(t as TierId))) f.fullSpectrumRounds++;
      if (r.found.length === 0) f.emptyRounds++;
      if (r.found.length >= 10 && !tiers.has(1)) f.noStoneRounds++;
      for (const o of r.found) {
        tier[o.tier]++;
        if (o.tier === 6) starcores++;
      }
    });
    f.mostStarcoresInDay = Math.max(f.mostStarcoresInDay, starcores);
  }
  // Streaks count dailies played on their own day only.
  const onTime = [...new Set(done.filter((d) => d.playedOn === d.date).map((d) => d.date))].sort();
  let run = 0;
  onTime.forEach((date, i) => {
    run = i > 0 && addDays(onTime[i - 1], 1) === date ? run + 1 : 1;
    f.bestStreak = Math.max(f.bestStreak, run);
  });
  return f;
}

const rankMin = (title: string) => RANKS.find((r) => r.title === title)!.min;

function a(id: string, title: string, description: string, goal: number, progress: (f: Facts) => number): Achievement {
  return { id, title, description, goal, progress };
}

export const ACHIEVEMENTS: Achievement[] = [
  a("first-survey", "First Descent", "Finish your first survey.", 1, (f) => f.surveys),
  a("surveys-10", "Regular", "Finish 10 surveys.", 10, (f) => f.surveys),
  a("surveys-50", "Veteran Miner", "Finish 50 surveys.", 50, (f) => f.surveys),
  a("streak-3", "Warming Up", "Play the daily 3 days in a row.", 3, (f) => f.bestStreak),
  a("streak-7", "Week in Orbit", "Play the daily 7 days in a row.", 7, (f) => f.bestStreak),
  a("streak-30", "Month Underground", "Play the daily 30 days in a row.", 30, (f) => f.bestStreak),
  a("rank-prospector", "Prospector", `Drill ${rankMin("Prospector").toLocaleString("en-US")} m in one survey.`, rankMin("Prospector"), (f) => f.bestDay),
  a("rank-driller", "Driller", `Drill ${rankMin("Driller").toLocaleString("en-US")} m in one survey.`, rankMin("Driller"), (f) => f.bestDay),
  a("rank-core-breaker", "Core Breaker", `Drill ${rankMin("Core Breaker").toLocaleString("en-US")} m in one survey.`, rankMin("Core Breaker"), (f) => f.bestDay),
  a("rank-starcore-hunter", "Starcore Hunter", `Drill ${rankMin("Starcore Hunter").toLocaleString("en-US")} m in one survey.`, rankMin("Starcore Hunter"), (f) => f.bestDay),
  a("round-20", "Quick Hands", "Find 20 ores on one asteroid.", 20, (f) => f.mostInRound),
  a("round-30", "Machine Drill", "Find 30 ores on one asteroid.", 30, (f) => f.mostInRound),
  a("round-40", "Unstoppable", "Find 40 ores on one asteroid.", 40, (f) => f.mostInRound),
  a("full-spectrum", "Full Spectrum", "Find Stone, Iron, Cobalt, Gold and Crystal on one asteroid.", 1, (f) => f.fullSpectrumRounds),
  a("no-stone", "No Stone Unturned", "Find at least 10 ores on one asteroid without a single Stone.", 1, (f) => f.noStoneRounds),
  a("empty-shaft", "Dry Hole", "Drill 0 m on an asteroid.", 1, (f) => f.emptyRounds),
  a("crystal-50", "Crystal Collector", "Find 50 Crystals.", 50, (f) => f.tier[5]),
  a("starcore-1", "Starcore!", "Find a Starcore.", 1, (f) => f.tier[6]),
  a("starcore-5", "Legend Hunter", "Find 5 Starcores.", 5, (f) => f.tier[6]),
  a("starcore-15", "Core Collector", "Find 15 Starcores.", 15, (f) => f.tier[6]),
  a("starcore-double", "Double Core", "Find 2 Starcores in one survey.", 2, (f) => f.mostStarcoresInDay),
  a("ores-500", "Ore Baron", "Mine 500 ores in total.", 500, (f) => f.totalOres),
  a("ores-2000", "Mining Magnate", "Mine 2,000 ores in total.", 2000, (f) => f.totalOres),
  a("overtime", "Overtime", "Get the clock up to a full minute with time bonuses.", 60, (f) => f.bestPeakSecs),
  a("midnight", "Night Shift", "Finish the daily by 12:05 AM, right after it unlocks at midnight.", 1, (f) => f.midnightFinishes),
  a("archive-5", "Time Traveler", "Finish 5 surveys from the archive.", 5, (f) => f.archiveSurveys),
  a("share-1", "Show and Tell", "Share your result.", 1, (f) => f.shares),
  a("share-10", "Mission Control", "Share your result on 10 different days.", 10, (f) => f.shares),
];

export interface AchievementState {
  achievement: Achievement;
  value: number;
  unlocked: boolean;
}

export function achievementStates(days: PlayedDay[], shares = 0): AchievementState[] {
  const facts = factsFrom(days, shares);
  return ACHIEVEMENTS.map((achievement) => {
    const value = Math.min(achievement.goal, achievement.progress(facts));
    return { achievement, value, unlocked: value >= achievement.goal };
  });
}
