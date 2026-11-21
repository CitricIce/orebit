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
}
export interface PlayedDay {
  date: string;
  playedOn?: string;
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
  bestFinalRound: number;
  tier: Record<TierId, number>;
  totalOres: number;
  mostStarcoresInDay: number;
  fullSpectrumRounds: number;
}

const roundDepth = (r: Round) => r.found.reduce((sum, o) => sum + TIERS[o.tier].depth, 0);

export function factsFrom(days: PlayedDay[]): Facts {
  const done = days.filter((d) => d.completed);
  const tier: Record<TierId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const f: Facts = {
    surveys: done.length,
    archiveSurveys: done.filter((d) => d.playedOn && d.playedOn !== d.date).length,
    bestStreak: 0,
    bestDay: 0,
    mostInRound: 0,
    bestFinalRound: 0,
    tier,
    totalOres: 0,
    mostStarcoresInDay: 0,
    fullSpectrumRounds: 0,
  };
  for (const d of done) {
    const rounds = d.rounds.filter((r): r is Round => Boolean(r));
    f.bestDay = Math.max(f.bestDay, rounds.reduce((sum, r) => sum + roundDepth(r), 0));
    let starcores = 0;
    rounds.forEach((r) => {
      f.mostInRound = Math.max(f.mostInRound, r.found.length);
      f.totalOres += r.found.length;
      const tiers = new Set(r.found.map((o) => o.tier));
      if ([1, 2, 3, 4, 5].every((t) => tiers.has(t as TierId))) f.fullSpectrumRounds++;
      for (const o of r.found) {
        tier[o.tier]++;
        if (o.tier === 6) starcores++;
      }
    });
    const last = d.rounds[d.rounds.length - 1];
    if (last) f.bestFinalRound = Math.max(f.bestFinalRound, roundDepth(last));
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
  a("rank-prospector", "Prospector", `Drill ${rankMin("Prospector")} m in one survey.`, rankMin("Prospector"), (f) => f.bestDay),
  a("rank-driller", "Driller", `Drill ${rankMin("Driller").toLocaleString("en-US")} m in one survey.`, rankMin("Driller"), (f) => f.bestDay),
  a("rank-core-breaker", "Core Breaker", `Drill ${rankMin("Core Breaker").toLocaleString("en-US")} m in one survey.`, rankMin("Core Breaker"), (f) => f.bestDay),
  a("rank-starcore-hunter", "Starcore Hunter", `Drill ${rankMin("Starcore Hunter").toLocaleString("en-US")} m in one survey.`, rankMin("Starcore Hunter"), (f) => f.bestDay),
  a("round-10", "Quick Hands", "Find 10 ores on one asteroid.", 10, (f) => f.mostInRound),
  a("round-20", "Machine Drill", "Find 20 ores on one asteroid.", 20, (f) => f.mostInRound),
  a("round-30", "Unstoppable", "Find 30 ores on one asteroid.", 30, (f) => f.mostInRound),
  a("final-400", "Far Side", "Drill 400 m on the last (hardest) asteroid of a day.", 400, (f) => f.bestFinalRound),
  a("full-spectrum", "Full Spectrum", "Find Stone, Iron, Cobalt, Gold and Crystal on one asteroid.", 1, (f) => f.fullSpectrumRounds),
  a("crystal-1", "Deep Cut", "Find a Crystal.", 1, (f) => f.tier[5]),
  a("crystal-25", "Crystal Collector", "Find 25 Crystals.", 25, (f) => f.tier[5]),
  a("starcore-1", "Starcore!", "Find a Starcore.", 1, (f) => f.tier[6]),
  a("starcore-5", "Legend Hunter", "Find 5 Starcores.", 5, (f) => f.tier[6]),
  a("starcore-double", "Double Core", "Find 2 Starcores in one survey.", 2, (f) => f.mostStarcoresInDay),
  a("ores-500", "Ore Baron", "Mine 500 ores in total.", 500, (f) => f.totalOres),
  a("ores-2000", "Mining Magnate", "Mine 2,000 ores in total.", 2000, (f) => f.totalOres),
  a("archive-5", "Time Traveler", "Finish 5 surveys from the archive.", 5, (f) => f.archiveSurveys),
];

export interface AchievementState {
  achievement: Achievement;
  value: number;
  unlocked: boolean;
}

export function achievementStates(days: PlayedDay[]): AchievementState[] {
  const facts = factsFrom(days);
  return ACHIEVEMENTS.map((achievement) => {
    const value = Math.min(achievement.goal, achievement.progress(facts));
    return { achievement, value, unlocked: value >= achievement.goal };
  });
}
