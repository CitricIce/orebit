# Category source files

Each `.txt` file holds one or more categories. `scripts/build_categories.py`
reads them, merges duplicates, assigns tiers and writes
`src/data/categories.json`.

## The rule for every category

Most people must be able to name about 5 answers in 45 seconds without
thinking hard. "Pizza toppings" passes. "Booker Prize winners" doesn't. Ask
"could a random person name 5?" before adding anything. Too narrow (songs by
one artist) and too broad (mammals) are both out.

Accept the casual guesses people actually type: "Big Dipper" for Ursa Major,
"tabby" for cat breeds, "Caesar" for emperors.

The build enforces part of this: every category needs at least 5 answers in
the Stone tier (`--- 1`), the ones almost everyone thinks of. If an honest
Stone tier has fewer than 5, the category is too hard. Drop it.

## Method

How answer lists are built:

- Answer lists combine several sources (hand-written lists, Wikidata, other
  references) that are merged and cleaned.
- Rarity comes from how often a name turns up in everyday text. Where that
  fails (people, brands, titles), place answers by judgment.
- The Starcore is hand-picked for fun, not just rarity: the most satisfying
  deep cut that at least a few players will actually find. Set it with the
  `starcore:` line.

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
- `--- 1` to `--- 5` start a tier. `--- 1` is exactly the Stone tier: the
  answers almost everyone thinks of. The other headings only set the order.
  The build ranks every non-Stone answer (hand tier first, then how common the
  name is) and splits them 15% Iron, 20% Cobalt, 25% Gold, 40% Crystal, so
  Crystal, the deep cuts, is always the biggest tier.
- `starcore` names the one legendary answer (a name or any alias). It moves
  to the Starcore tier wherever it is listed. Leave it out and the build picks
  the most findable Crystal answer.
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
comes last. A day never has more than 1 medium (a test checks this).

- Easy: nearly anyone can name 10 or more in 45 seconds.
- Medium: most people can name about 5.
- If there's any argument that a category is medium, it's medium.

A category too hard for either level doesn't belong in the game.
After adding categories, run `npm run plan:calendar` to schedule them.
