/**
 * Answer matching. normalize() must stay in sync with normalize() in
 * scripts/build_categories.py so build-time dedupe and runtime lookups agree.
 */

const ROMAN: Record<string, string> = {
  i: "1", ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16", xvii: "17", xviii: "18", xix: "19", xx: "20",
};
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
];
const ORDINALS = [
  "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
  "nineteenth", "twentieth",
];
const NUMBERS: Record<string, string> = { ...ROMAN };
NUMBER_WORDS.forEach((w, n) => (NUMBERS[w] = String(n)));
ORDINALS.forEach((w, n) => {
  if (w) NUMBERS[w] = String(n);
});
for (let n = 1; n <= 20; n++) {
  NUMBERS[`${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`] = String(n);
}

/** Little words people add or drop without meaning anything different. */
const FILLER = new Set(["the", "a", "an", "of", "and", "part"]);

/**
 * Words of a name after cleanup: lowercase, no accents or punctuation,
 * numbers in one form (IV, four, fourth and 4 all become "4") and filler
 * words dropped. Must match normalize_words() in scripts/build_categories.py.
 */
export function normalizeWords(text: string): string[] {
  let t = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  t = t.toLowerCase();
  t = t.replace(/&/g, " and ").replace(/\+/g, " plus ").replace(/#/g, " sharp ");
  t = t.replace(/['’ʻ`]/g, "");
  t = t.replace(/[^a-z0-9]+/g, " ").trim();
  const words = t ? t.split(" ").map((w) => NUMBERS[w] ?? w) : [];
  const kept = words.filter((w) => !FILLER.has(w));
  return kept.length ? kept : words;
}

export function normalize(text: string): string {
  return normalizeWords(text).join("");
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
  /** Rarity tier (1 = most common). Breaks typo ties toward the likelier answer. */
  tier?: number;
  /** How often the name turns up in everyday text. The next tie-breaker. */
  familiarity?: number;
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
  if (len >= 11) return 3;
  if (len >= 8) return 2;
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

  // Then a small typo on the whole guess.
  const whole = closest(index, [stripPlural(raw)]);
  if (whole) return whole;

  // "Cheddar cheese", "pug dog": the guess with one extra word dropped,
  // exactly first, then with a typo ("strawberry cheescake").
  const words = normalizeWords(guess);
  if (words.length < 2) return null;
  const shorter: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const rest = stripPlural(words.filter((_, j) => j !== i).join(""));
    if (rest.length < 4) continue;
    const hit = index.exact.get(rest);
    if (hit) return hit;
    shorter.push(rest);
  }
  return closest(index, shorter);
}

/** The one answer closest to any of the keys within the typo allowance, or null on a tie. */
function closest<T extends Matchable>(index: AnswerIndex<T>, keys: string[]): T | null {
  let best = Infinity;
  let winners = new Set<T>();
  for (const key of keys) {
    const max = allowedTypos(key.length);
    if (max === 0) continue;
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
  }
  if (winners.size <= 1) return winners.size ? [...winners][0] : null;
  // A typo equally close to several answers goes to the likeliest one: the
  // more common tier, then the more familiar name, then the shorter name.
  // A close typo always counts for something.
  return [...winners].sort(
    (a, b) =>
      (a.tier ?? 99) - (b.tier ?? 99) ||
      (b.familiarity ?? 0) - (a.familiarity ?? 0) ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name),
  )[0];
}


