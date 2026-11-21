# Orebit category expansion brief

Orebit is a daily word game. Players get 45 seconds to type as many answers as they can for a category. Every reasonable answer a real person might type must count; missing answers frustrate players. Your job: make ONE category's answer list EXTENSIVE and forgiving.

`$SCRATCH` is any scratch folder outside the repo.

## Steps
1. Read the category's hand list (the `=== <id>` section in the file named in your task) and look at the currently built answers:
   `python3 scripts/build_categories.py --only <id> --out $SCRATCH/h-<id>.json` then read that JSON.
2. List the category's sub-areas first (every region, era, medium, style), then fill each one. Include the long tail: obscure-but-valid answers are the Crystal deep cuts.
3. Add aliases for how people actually type: nicknames, short forms, regional/alternate names, US/UK spellings, plural or verb forms, common misspellings.
4. Write ONLY these two new files:
   - `data/additions/<id>.txt` — section headers `--- 2` (very commonly named), `--- 3` (common), `--- 4` (less common), `--- 5` (deep cuts). Never `--- 1`. Each line: `Display Name | alias | alias`. To add aliases to an EXISTING answer, write a line with its exact display name plus the new aliases (rows merge by name). Put obscure answers in 4 and 5 — do not file obscure entries under 2 or 3.
   - `data/guesses/<id>.txt` — 40 to 60 realistic guesses a real player would type: lowercase, casual phrasing, typos, plurals. Optionally `guess => Exact Display Name` to pin a specific answer. If the guesses file already exists, keep its lines and add more until it has 40 to 60.
5. Check, and repeat until there are no `warning:` lines from the build and no MISS/WRONG from the checker:
   `python3 scripts/build_categories.py --only <id> --out $SCRATCH/h-<id>.json`
   `npx tsx scripts/check_guesses.ts --data $SCRATCH/h-<id>.json <id>`
   A `warning:` means one alias points at two answers: remove or fix that alias.

## Rules
- Only answers that genuinely fit the category. Loose-but-fair is OK; wrong is not. No generic words that just restate the category (e.g. "vehicle" in Vehicles, "planet" in Solar system objects).
- Never let one alias point at two answers. Avoid short, ambiguous aliases.
- Keep display names short (about 4 words max).
- Edit NO other file. Do not run `npm run build:data`, `npm test`, or any git command. Do not write to src/data/categories.json.
- Spend about 5 to 10 minutes per category.

## Method
- Place answers in tiers by how likely a typical player is to think of them in 45 seconds. For people, brands and titles, trust your judgment over how common the word is.
- Propose ONE Starcore. It should be a satisfying deep cut that roughly 5-10 players in a hundred would find in 45 seconds: not something everyone names, but not so obscure nobody ever gets it. Too easy: Anchovies (pizza toppings), Spider-Woman (superheroes). About right: Theremin (instruments), Quokka (Australian animals), Squirrel Girl (superheroes), Okapi (African animals). Too obscure: Waterphone, Gqom, Arrokoth. Keep the current Starcore if it already meets this bar. Give the exact display name and a one-line reason.

## Reply
Answers added, the final checker line, your Starcore pick with its reason, and anything you were unsure about (one short paragraph).
