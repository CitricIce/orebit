import { daysBetween, LAUNCH_DATE } from "./dates";
import { ROUNDS_PER_DAY } from "./tiers";

/** Small fast seeded PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  const rand = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const SEED_SALT = 0x0eb17;

/**
 * Pick the categories for a date.
 *
 * Hand-picked days in `overrides` win. Every other day draws from a stream of
 * shuffled decks: each deck holds every category once, so a category only
 * repeats after all the others have been used. The result depends only on
 * the date and the category list, so every player gets the same rocks.
 */
export function categoriesFor(
  date: string,
  allIds: string[],
  overrides: Record<string, string[]> = {},
): string[] {
  const forced = overrides[date];
  if (forced && forced.length === ROUNDS_PER_DAY && forced.every((id) => allIds.includes(id))) {
    return forced;
  }
  const ids = [...allIds].sort();
  const day = Math.max(0, daysBetween(LAUNCH_DATE, date));
  const start = day * ROUNDS_PER_DAY;

  const picked: string[] = [];
  let pos = start;
  while (picked.length < ROUNDS_PER_DAY) {
    const deckNo = Math.floor(pos / ids.length);
    const deck = shuffled(ids, SEED_SALT + deckNo * 7919);
    const id = deck[pos % ids.length];
    // At a deck boundary the next deck could repeat today's pick. Skip it.
    if (!picked.includes(id)) picked.push(id);
    pos++;
  }
  return picked;
}
