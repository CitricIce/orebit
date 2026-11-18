# Category source files

Each `.txt` file holds one or more categories. `scripts/build_categories.py`
reads them, scores every answer with word-frequency data, assigns tiers, and
writes `src/data/categories.json`.

## Format

```
=== dog-breeds
title: Dog breeds
prompt: Name as many dog breeds as you can
starcore: Xoloitzcuintli
---
Labrador Retriever | lab | labrador
Golden Retriever | golden
Basenji @4
```

- `=== <id>` starts a category. The id must be unique and URL safe.
- Header lines (`title`, `prompt`, `starcore`) come before `---`.
- `starcore` is optional. It names the one legendary answer. If you leave it
  out, the build picks a rare but findable answer automatically.
- After `---`, each line is one answer. The first name is the one shown to
  players. Extra names after `|` are aliases that also count.
- Add `@1` to `@5` at the end of a line to force a tier when word frequency
  gets it wrong (for example "Boxer" is a common word but not a common
  dog breed answer). 1 = Regolith, 2 = Iron, 3 = Cobalt, 4 = Gold, 5 = Crystal.
- Lines starting with `#` are comments.

After editing, run:

```bash
npm run build:data
```
