# Category source files

Each `.txt` file holds one or more categories. `scripts/build_categories.py`
reads them, merges duplicates, assigns tiers and writes
`src/data/categories.json`.

## Format

```
=== dog-breeds
title: Dog breeds
prompt: Name as many dog breeds as you can
starcore: Xoloitzcuintli
--- 1
Labrador Retriever | labrador | lab
Golden Retriever | golden
--- 2
Basenji
--- 5
Azawakh
```

- `=== <id>` starts a category. The id must be unique and URL safe.
- Header lines (`title`, `prompt`, `starcore`) come before the first `---`.
- `--- 1` to `--- 5` start a tier. Every answer below it lands in that tier:
  1 = Stone (the obvious ones), 2 = Iron, 3 = Cobalt, 4 = Gold, 5 = Crystal.
  Sort by how likely a player is to think of the answer in 45 seconds, not
  by how common the word is.
- `starcore` names the one legendary answer (a name or any alias). It moves
  to the Starcore tier wherever it is listed. Leave it out and the build picks
  a rare but findable answer.
- Each answer line: the display name first, then aliases after `|`. Aliases
  count as the same answer, so variants (Henry IV Part 1 and Part 2) should be
  aliases, not separate lines.
- Add `@1` to `@5` at the end of a line to override its tier.
- Lines starting with `#` are comments.
- A category with a bare `---` and no tier headings gets automatic tiers from
  word-frequency data.

After editing, run:

```bash
npm run build:data
```

The build warns when one alias points at two different answers. Fix those so
a guess can't match the wrong answer.

## Wikidata additions

`data/wikidata/<id>.json` holds extra answers pulled from Wikidata by
`npm run fetch:wikidata` (sources are listed in `scripts/fetch_wikidata.py`).
The build merges them into the matching category:

- An item that matches a hand-sorted answer by any name only adds its other
  names as aliases. Your tier stays.
- A new item joins as Cobalt (30+ Wikipedia languages), Gold (10+) or
  Crystal (fewer).
- To promote a Wikidata answer, add it to the `.txt` file under the tier you
  want. The hand-sorted entry wins.

## Difficulty

Every category needs a level in `data/difficulty.json` before it can be
scheduled. Each day plays 4 easy categories and at most 1 medium one, which
comes last. Hard categories stay in the build but are never scheduled.
After adding categories, run `npm run plan:calendar` to schedule them.
