import assert from "node:assert/strict";
import test from "node:test";
import { achievementStates, factsFrom, type PlayedDay } from "./achievements";

const round = (tiers: number[]) => ({ found: tiers.map((t) => ({ tier: t as 1 })), depth: 0 });

test("achievements unlock from saved runs", () => {
  const days: PlayedDay[] = [
    { date: "2026-11-21", playedOn: "2026-11-21", completed: true, rounds: [round([1, 2, 3, 4, 5]), round([6]), round([1]), round([1]), round([6, 1])] },
    { date: "2026-11-22", playedOn: "2026-11-22", completed: true, rounds: [round(Array(22).fill(1)), round([]), round([2, 3, 3, 4, 5, 2, 2, 3, 4, 5])] },
    { date: "2026-11-23", playedOn: "2026-11-23", completed: true, rounds: [round([1])] },
    { date: "2026-11-01", playedOn: "2026-11-23", completed: true, rounds: [round([1])] },
    { date: "2026-11-24", completed: false, rounds: [round(Array(40).fill(6))] },
  ];
  const f = factsFrom(days);
  assert.equal(f.surveys, 4);
  assert.equal(f.archiveSurveys, 1);
  assert.equal(f.bestStreak, 3);
  assert.equal(f.mostStarcoresInDay, 2);
  assert.equal(f.fullSpectrumRounds, 1);
  assert.equal(f.mostInRound, 22, "unfinished days don't count");
  assert.equal(f.emptyRounds, 1);
  assert.equal(f.noStoneRounds, 1);
  const midnight = new Date(2026, 10, 25, 0, 4).getTime();
  const late = new Date(2026, 10, 26, 0, 7).getTime();
  assert.equal(
    factsFrom([
      { date: "2026-11-25", playedOn: "2026-11-25", finishedAt: midnight, completed: true, rounds: [] },
      { date: "2026-11-26", playedOn: "2026-11-26", finishedAt: late, completed: true, rounds: [] },
    ]).midnightFinishes,
    1,
  );
  const unlocked = new Set(achievementStates(days).filter((a) => a.unlocked).map((a) => a.achievement.id));
  for (const id of ["first-survey", "streak-3", "starcore-1", "starcore-double", "full-spectrum", "round-20", "empty-shaft", "no-stone"]) {
    assert.ok(unlocked.has(id), `${id} should be unlocked`);
  }
  assert.ok(!unlocked.has("streak-7"));
  assert.ok(!unlocked.has("round-30"));
});
