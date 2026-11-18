import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, findAnswer, normalize } from "./match";
import { categoriesFor } from "./schedule";
import { addDays, LAUNCH_DATE } from "./dates";

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

test("short words need to be exact, and ties are rejected", () => {
  assert.equal(find("mal"), null);
  assert.equal(find("kali"), null);
  assert.equal(find("dog"), null);
  assert.equal(find(""), null);
});

test("schedule is stable and never repeats a category within a day", () => {
  const ids = Array.from({ length: 28 }, (_, i) => `cat-${i}`);
  for (let i = 0; i < 400; i++) {
    const d = addDays(LAUNCH_DATE, i);
    const a = categoriesFor(d, ids);
    assert.equal(a.length, 3);
    assert.equal(new Set(a).size, 3);
    assert.deepEqual(a, categoriesFor(d, [...ids].reverse()));
  }
  assert.deepEqual(categoriesFor("2027-01-01", ids, { "2027-01-01": ["cat-1", "cat-2", "cat-3"] }), ["cat-1", "cat-2", "cat-3"]);
});
