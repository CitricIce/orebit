export type TierId = 1 | 2 | 3 | 4 | 5 | 6;

export interface Tier {
  id: TierId;
  name: string;
  /** Meters drilled for one answer in this tier. */
  depth: number;
  /** Short flavor line shown in the legend. */
  blurb: string;
  /** CSS custom property holding the tier color. */
  color: string;
}

export const TIERS: Record<TierId, Tier> = {
  1: { id: 1, name: "Stone", depth: 10, blurb: "The obvious ones. Everyone digs these up.", color: "var(--t1)" },
  2: { id: 2, name: "Iron", depth: 20, blurb: "Solid, common ore.", color: "var(--t2)" },
  3: { id: 3, name: "Cobalt", depth: 35, blurb: "You know your stuff.", color: "var(--t3)" },
  4: { id: 4, name: "Gold", depth: 55, blurb: "A real find.", color: "var(--t4)" },
  5: { id: 5, name: "Crystal", depth: 90, blurb: "Deep cut. Few reach it.", color: "var(--t5)" },
  6: { id: 6, name: "Starcore", depth: 200, blurb: "One per asteroid. Legendary.", color: "var(--t6)" },
};

export const TIER_LIST: Tier[] = [1, 2, 3, 4, 5, 6].map((id) => TIERS[id as TierId]);

export const ROUND_SECONDS = 45;
export const ROUNDS_PER_DAY = 5;

export interface Rank {
  min: number;
  title: string;
}

/** Daily ranks by total meters drilled across all rounds. */
export const RANKS: Rank[] = [
  { min: 0, title: "Surface Scraper" },
  { min: 500, title: "Prospector" },
  { min: 900, title: "Driller" },
  { min: 1400, title: "Core Breaker" },
  { min: 2000, title: "Starcore Hunter" },
];

export function rankFor(depth: number): Rank {
  let r = RANKS[0];
  for (const rank of RANKS) if (depth >= rank.min) r = rank;
  return r;
}

export function ores(n: number): string {
  return `${n} ${n === 1 ? "ore" : "ores"}`;
}

export function formatMeters(m: number): string {
  return `${m.toLocaleString("en-US")} m`;
}
