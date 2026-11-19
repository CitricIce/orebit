import "server-only";
import data from "@/data/categories.json";
import overrides from "../../../data/schedule.json";
import { buildIndex, findAnswer, type AnswerIndex } from "../match";
import { categoriesFor } from "../schedule";
import { dayNumber } from "../dates";
import type { TierId } from "../tiers";

export interface Answer {
  name: string;
  aliases: string[];
  tier: TierId;
  familiarity: number;
}

export interface Category {
  id: string;
  title: string;
  prompt: string;
  answers: Answer[];
}

const categories = (data as { categories: Category[] }).categories;
const byId = new Map(categories.map((c) => [c.id, c]));
const indexes = new Map<string, AnswerIndex<Answer>>();

export const allCategoryIds = categories.map((c) => c.id);

export function getCategory(id: string): Category | undefined {
  return byId.get(id);
}

function indexFor(cat: Category): AnswerIndex<Answer> {
  let idx = indexes.get(cat.id);
  if (!idx) {
    idx = buildIndex(cat.answers);
    indexes.set(cat.id, idx);
  }
  return idx;
}

export function categoriesForDate(date: string): Category[] {
  const scheduled = (overrides as { days?: Record<string, string[]> }).days ?? {};
  return categoriesFor(date, allCategoryIds, scheduled).map((id) => byId.get(id)!);
}

export function matchGuess(cat: Category, guess: string): Answer | null {
  return findAnswer(indexFor(cat), guess);
}

/** Short code for an asteroid, like "AST-0042-C". Pure flavor. */
export function designation(date: string, round: number): string {
  return `AST-${String(dayNumber(date)).padStart(4, "0")}-${"ABCDE"[round] ?? round}`;
}

export function tierCounts(cat: Category): Record<TierId, number> {
  const counts: Record<TierId, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const a of cat.answers) counts[a.tier]++;
  return counts;
}
