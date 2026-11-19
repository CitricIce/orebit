import "server-only";
import data from "@/data/categories.json";
import calendar from "../../../data/calendar.json";
import { buildIndex, findAnswer, type AnswerIndex } from "../match";
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

const days = (calendar as { start: string; days: string[][] }).days;

/** The last date the calendar covers. Later dates have no survey yet. */
export const lastScheduledDay = days.length;

/**
 * The categories for a date, from data/calendar.json, where every category
 * is used on exactly one day. Returns null for a date the calendar doesn't
 * reach yet.
 */
export function categoriesForDate(date: string): Category[] | null {
  const ids = days[dayNumber(date) - 1];
  if (!ids) return null;
  const cats = ids.map((id) => byId.get(id));
  return cats.every(Boolean) ? (cats as Category[]) : null;
}

export const NOT_SCHEDULED = "New surveys are on the way. Check back soon.";

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
