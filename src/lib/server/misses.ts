import "server-only";

// Guesses that matched no answer, counted per day and category, so missing
// answers can be found and added. Stores only the category and the typed text.
// Uses Upstash Redis over REST (Vercel's Upstash integration sets these env
// vars). Without them, logging is skipped.

const URL = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
const KEEP_SECONDS = 60 * 60 * 24 * 40;

export const missesEnabled = Boolean(URL && TOKEN);

async function redis(commands: (string | number)[][]): Promise<{ result: unknown }[]> {
  const res = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return res.json();
}

export function tidyGuess(guess: string): string {
  return guess.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export async function logMiss(date: string, categoryId: string, guess: string): Promise<void> {
  const text = tidyGuess(guess);
  if (!missesEnabled || text.length < 2) return;
  const key = `misses:${date}:${categoryId}`;
  const index = `misses:index:${date}`;
  await redis([
    ["HINCRBY", key, text, 1],
    ["EXPIRE", key, KEEP_SECONDS],
    ["SADD", index, categoryId],
    ["EXPIRE", index, KEEP_SECONDS],
  ]);
}

/** Every missed guess for one day: { categoryId: { guess: count } }. */
export async function missesFor(date: string): Promise<Record<string, Record<string, number>>> {
  if (!missesEnabled) return {};
  const [{ result: ids }] = await redis([["SMEMBERS", `misses:index:${date}`]]);
  const list = (ids as string[]) ?? [];
  if (!list.length) return {};
  const rows = await redis(list.map((id) => ["HGETALL", `misses:${date}:${id}`]));
  const out: Record<string, Record<string, number>> = {};
  list.forEach((id, i) => {
    const flat = (rows[i].result as string[]) ?? [];
    const counts: Record<string, number> = {};
    for (let j = 0; j < flat.length; j += 2) counts[flat[j]] = Number(flat[j + 1]);
    out[id] = counts;
  });
  return out;
}
