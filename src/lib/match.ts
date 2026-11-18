/**
 * Answer matching. normalize() must stay in sync with normalize() in
 * scripts/build_categories.py so build-time dedupe and runtime lookups agree.
 */

export function normalize(text: string): string {
  let t = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  t = t.toLowerCase();
  t = t.replace(/&/g, " and ").replace(/\+/g, " plus ").replace(/#/g, " sharp ");
  t = t.replace(/['’ʻ`]/g, "");
  t = t.replace(/[^a-z0-9]+/g, " ").trim();
  if (t.startsWith("the ")) t = t.slice(4);
  return t.replace(/ /g, "");
}

export function stripPlural(key: string): string {
  if (key.length > 3 && key.endsWith("s") && !key.endsWith("ss")) return key.slice(0, -1);
  return key;
}

/** Optimal string alignment distance (Levenshtein plus adjacent swaps). */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const n = a.length;
  const m = b.length;
  let prev2: number[] = new Array(m + 1).fill(0);
  let prev: number[] = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[m];
}

export interface Matchable {
  name: string;
  aliases: string[];
}

export interface AnswerIndex<T extends Matchable> {
  exact: Map<string, T>;
  keys: { key: string; answer: T }[];
}

export function buildIndex<T extends Matchable>(answers: T[]): AnswerIndex<T> {
  const exact = new Map<string, T>();
  const keys: { key: string; answer: T }[] = [];
  for (const answer of answers) {
    for (const n of [answer.name, ...answer.aliases]) {
      const k = stripPlural(normalize(n));
      if (!k) continue;
      if (!exact.has(k)) exact.set(k, answer);
      keys.push({ key: k, answer });
    }
  }
  return { exact, keys };
}

function allowedTypos(len: number): number {
  if (len >= 9) return 2;
  if (len >= 5) return 1;
  return 0;
}

/**
 * Find the answer a guess refers to. Exact matches (ignoring case, accents,
 * punctuation, spaces and a trailing "s") win. Otherwise a small number of
 * typos is allowed, but only when exactly one answer is the closest.
 */
export function findAnswer<T extends Matchable>(index: AnswerIndex<T>, guess: string): T | null {
  const raw = normalize(guess);
  if (!raw) return null;
  const candidates = new Set([raw, stripPlural(raw)]);
  if (raw.endsWith("ies")) candidates.add(raw.slice(0, -3) + "y");
  if (raw.endsWith("es")) candidates.add(raw.slice(0, -2));
  for (const c of candidates) {
    const hit = index.exact.get(c);
    if (hit) return hit;
  }

  const key = stripPlural(raw);
  const max = allowedTypos(key.length);
  if (max === 0) return null;

  let best = max + 1;
  let winners = new Set<T>();
  for (const entry of index.keys) {
    const entryMax = Math.min(max, allowedTypos(entry.key.length));
    if (entryMax === 0) continue;
    const d = editDistance(key, entry.key, entryMax);
    if (d > entryMax) continue;
    if (d < best) {
      best = d;
      winners = new Set([entry.answer]);
    } else if (d === best) {
      winners.add(entry.answer);
    }
  }
  if (best <= max && winners.size === 1) return [...winners][0];
  return null;
}
