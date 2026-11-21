import "server-only";
import { createClient } from "redis";

// Guesses that matched no answer, counted per day and category, so missing
// answers can be found and added. Stores only the category and the typed text.
// Uses the Redis database connected in Vercel (REDIS_URL). Without it,
// logging is skipped.

const REDIS_URL = process.env.REDIS_URL;
const KEEP_SECONDS = 60 * 60 * 24 * 40;

export const missesEnabled = Boolean(REDIS_URL);

type Client = ReturnType<typeof createClient>;
let client: Promise<Client> | null = null;

// One connection per server instance, reused across requests.
function redis(): Promise<Client> {
  if (!client) {
    const c = createClient({ url: REDIS_URL, socket: { connectTimeout: 3000 } });
    c.on("error", () => {});
    client = c.connect().catch((err) => {
      client = null;
      throw err;
    });
  }
  return client;
}

export function tidyGuess(guess: string): string {
  return guess.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 80);
}

export async function logMiss(date: string, categoryId: string, guess: string): Promise<void> {
  const text = tidyGuess(guess);
  if (!missesEnabled || text.length < 2) return;
  const key = `misses:${date}:${categoryId}`;
  const index = `misses:index:${date}`;
  const r = await redis();
  await r
    .multi()
    .hIncrBy(key, text, 1)
    .expire(key, KEEP_SECONDS)
    .sAdd(index, categoryId)
    .expire(index, KEEP_SECONDS)
    .exec();
}

/** Every missed guess for one day: { categoryId: { guess: count } }. */
export async function missesFor(date: string): Promise<Record<string, Record<string, number>>> {
  if (!missesEnabled) return {};
  const r = await redis();
  const ids = await r.sMembers(`misses:index:${date}`);
  const out: Record<string, Record<string, number>> = {};
  for (const id of ids) {
    const flat = await r.hGetAll(`misses:${date}:${id}`);
    out[id] = Object.fromEntries(Object.entries(flat).map(([k, v]) => [k, Number(v)]));
  }
  return out;
}
