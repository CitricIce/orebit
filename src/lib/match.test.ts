import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, findAnswer, normalize } from "./match";
import calendar from "../../data/calendar.json";
import { ROUNDS_PER_DAY } from "./tiers";

const answers = [
  { name: "Labrador Retriever", aliases: ["labrador", "lab"] },
  { name: "Golden Retriever", aliases: ["golden"] },
  { name: "Côte d'Ivoire", aliases: ["ivory coast"] },
  { name: "C++", aliases: ["cpp"] },
  { name: "C", aliases: [] },
  { name: "C#", aliases: ["c sharp"] },
  { name: "Brussels Sprouts", aliases: ["sprouts"] },
  { name: "Cherry", aliases: [] },
  { name: "Xoloitzcuintli", aliases: ["xolo"] },
  { name: "Mali", aliases: [] },
  { name: "Bali", aliases: [] },
];
const idx = buildIndex(answers);
const find = (g: string) => findAnswer(idx, g)?.name ?? null;

test("normalize ignores case, accents, punctuation and a leading 'the'", () => {
  assert.equal(normalize("Côte d'Ivoire"), "cotedivoire");
  assert.equal(normalize("  The Bahamas "), "bahamas");
  assert.notEqual(normalize("C++"), normalize("C"));
  assert.notEqual(normalize("C#"), normalize("C"));
});

test("exact names and aliases match", () => {
  assert.equal(find("lab"), "Labrador Retriever");
  assert.equal(find("GOLDEN"), "Golden Retriever");
  assert.equal(find("ivory coast"), "Côte d'Ivoire");
  assert.equal(find("cote divoire"), "Côte d'Ivoire");
  assert.equal(find("c++"), "C++");
  assert.equal(find("c"), "C");
  assert.equal(find("c#"), "C#");
});

test("plurals count", () => {
  assert.equal(find("cherries"), "Cherry");
  assert.equal(find("brussels sprout"), "Brussels Sprouts");
  assert.equal(find("labradors"), "Labrador Retriever");
});

test("small typos count on longer names", () => {
  assert.equal(find("labrador retreiver"), "Labrador Retriever");
  assert.equal(find("xoloitzcuintle"), "Xoloitzcuintli");
  assert.equal(find("chery"), "Cherry");
});

test("numbers, filler words and extra words are forgiven", () => {
  const plays = buildIndex([
    { name: "Henry IV", aliases: ["henry the fourth", "henry iv part 1", "henry iv part 2"] },
    { name: "Henry V", aliases: ["henry the fifth"] },
    { name: "Richard III", aliases: [] },
    { name: "The Merchant of Venice", aliases: [] },
    { name: "Cheddar", aliases: [] },
  ]);
  const f = (g: string) => findAnswer(plays, g)?.name ?? null;
  assert.equal(f("henry IV part 1"), "Henry IV");
  assert.equal(f("Henry 4 part one"), "Henry IV");
  assert.equal(f("henry iv pt 1"), "Henry IV");
  assert.equal(f("henry 4"), "Henry IV");
  assert.equal(f("henry fifth"), "Henry V");
  assert.equal(f("richard 3"), "Richard III");
  assert.equal(f("richard the third"), "Richard III");
  assert.equal(f("merchant venice"), "The Merchant of Venice");
  assert.equal(f("cheddar cheese"), "Cheddar");
  assert.equal(normalize("Henry IV, Part 1"), normalize("henry 4 part one"));
});

test("short words need to be exact, and ties are rejected", () => {
  assert.equal(find("mal"), null);
  assert.equal(find("kali"), null);
  assert.equal(find("dog"), null);
  assert.equal(find(""), null);
});

test("the calendar never repeats a category", () => {
  const seen = new Set<string>();
  for (const day of calendar.days) {
    assert.equal(day.length, ROUNDS_PER_DAY);
    for (const id of day) {
      assert.ok(!seen.has(id), `${id} appears twice`);
      seen.add(id);
    }
  }
});
