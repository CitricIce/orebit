import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIndex, findAnswer, normalize } from "./match";
import calendar from "../../data/calendar.json";
import levels from "../../data/difficulty.json";
import catalog from "../data/categories.json";
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

test("each day has at most one medium category and no question repeats", () => {
  const titles = new Map(catalog.categories.map((c) => [c.id, normalize(c.title)]));
  const seen = new Set<string>();
  for (const day of calendar.days) {
    const medium = day.filter((id) => levels.medium.includes(id));
    assert.ok(medium.length <= 1, `more than one medium category on a day: ${day}`);
    for (const id of day) {
      assert.ok(levels.easy.includes(id) || levels.medium.includes(id), `${id} has no level`);
      const title = titles.get(id);
      assert.ok(title, `${id} is missing from the catalog`);
      assert.ok(!seen.has(title), `${id} repeats an earlier question`);
      seen.add(title);
    }
  }
});

test("the calendar starts on launch day", async () => {
  const { LAUNCH_DATE } = await import("./dates");
  assert.equal(calendar.start, LAUNCH_DATE);
});

test("a typo still counts when the guess has an extra word", () => {
  const desserts = buildIndex(catalog.categories.find((c) => c.id === "desserts")!.answers);
  assert.equal(findAnswer(desserts, "strawberry cheescake")?.name, "Cheesecake");
  assert.equal(findAnswer(desserts, "chocolate brownee")?.name, "Brownie");
  assert.equal(findAnswer(desserts, "tirimasu")?.name, "Tiramisu");
});

test("no day has two categories from the same overlap group", async () => {
  const { default: overlaps } = await import("../../data/overlaps.json");
  const groupsOf = new Map<string, string[]>();
  for (const [name, ids] of Object.entries(overlaps.groups)) {
    for (const id of ids) groupsOf.set(id, [...(groupsOf.get(id) ?? []), name]);
  }
  for (const day of calendar.days) {
    const seen = new Map<string, string>();
    for (const id of day) {
      for (const g of groupsOf.get(id) ?? []) {
        assert.ok(!seen.has(g), `${seen.get(g)} and ${id} share "${g}" on one day`);
        seen.set(g, id);
      }
    }
  }
});

test("every saved player guess still finds its answer", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const dir = new URL("../../data/guesses/", import.meta.url);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".txt"))) {
    const id = file.slice(0, -4);
    const cat = catalog.categories.find((c) => c.id === id);
    assert.ok(cat, `data/guesses/${file}: no such category`);
    const index = buildIndex(cat.answers);
    for (const raw of readFileSync(new URL(file, dir), "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const [guess, expected] = line.split("=>").map((s) => s.trim());
      const hit = findAnswer(index, guess);
      assert.ok(hit, `${id}: "${guess}" matches nothing`);
      if (expected) assert.equal(hit.name, expected, `${id}: "${guess}"`);
    }
  }
});

test("pinned categories only appear on their pinned date", async () => {
  const { default: schedule } = await import("../../data/schedule.json");
  const { addDays } = await import("./dates");
  calendar.days.forEach((day, i) => {
    const date = addDays(calendar.start, i);
    for (const [pinDate, ids] of Object.entries(schedule.days as Record<string, string[]>)) {
      for (const id of ids) {
        if (day.includes(id)) assert.equal(date, pinDate, `${id} is pinned to ${pinDate} but scheduled on ${date}`);
      }
    }
  });
});
