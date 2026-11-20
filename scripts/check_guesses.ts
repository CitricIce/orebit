/**
 * Run realistic player guesses through the real matcher.
 *
 * data/guesses/<id>.txt holds one guess per line, optionally "guess => Answer"
 * to require a specific answer. Prints every guess that matches nothing, or
 * matches the wrong answer. Exit code 1 if any fail.
 *
 *   npx tsx scripts/check_guesses.ts [--data path/to/categories.json] [--all] id ...
 * --all also prints what every passing guess matched.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { buildIndex, findAnswer } from "../src/lib/match";

const args = process.argv.slice(2);
const dataArg = args.indexOf("--data");
const dataPath = dataArg >= 0 ? args[dataArg + 1] : "src/data/categories.json";
const showAll = args.includes("--all");
let ids = args.filter((a, i) => !a.startsWith("--") && (dataArg < 0 || i !== dataArg + 1));
if (ids.length === 0) ids = readdirSync("data/guesses").filter((f) => f.endsWith(".txt")).map((f) => f.slice(0, -4));

const catalog = JSON.parse(readFileSync(dataPath, "utf8")) as {
  categories: { id: string; answers: { name: string; aliases: string[]; tier: number }[] }[];
};
let failures = 0;
for (const id of ids) {
  const cat = catalog.categories.find((c) => c.id === id);
  const file = `data/guesses/${id}.txt`;
  if (!cat) { console.log(`${id}: not in ${dataPath}`); failures++; continue; }
  if (!existsSync(file)) { console.log(`${id}: no ${file}`); continue; }
  const index = buildIndex(cat.answers);
  const lines = readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  let bad = 0;
  for (const line of lines) {
    const [guess, expected] = line.split("=>").map((s) => s.trim());
    const hit = findAnswer(index, guess);
    if (!hit) { console.log(`${id}: MISS   "${guess}"`); bad++; }
    else if (expected && hit.name !== expected) { console.log(`${id}: WRONG  "${guess}" -> ${hit.name} (wanted ${expected})`); bad++; }
    else if (showAll) console.log(`${id}: ok     "${guess}" -> ${hit.name} [tier ${hit.tier}]`);
  }
  console.log(`${id}: ${lines.length - bad}/${lines.length} guesses pass, ${cat.answers.length} answers`);
  failures += bad;
}
process.exit(failures ? 1 : 0);
