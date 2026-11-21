<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Categories

Every category must pass one test: could most people name about 5 answers in
45 seconds? If not, don't add it. Rate each one in `data/difficulty.json`:
easy only if nearly anyone can name 10 or more, otherwise medium. Any argument
for medium means medium. Each day has at most 1 medium. Full rules in
`data/categories/README.md`.

Build answer lists this way:
combine several sources and clean them, rate rarity by how often a name
turns up in everyday text, use judgment where that fails (people, brands,
titles), and hand-pick each Starcore for fun: the most satisfying deep cut
that at least a few players will actually find.

Before expanding or adding any open-ended category (games, people, places,
species, titles), give it a Wikidata source in `scripts/fetch_wikidata.py`
with a cutoff loose enough to keep fair answers (roughly 10-35 Wikipedia
languages for big sets), fetch it, and spot-check the results for junk. Only
then use helpers for nicknames, typos and what Wikidata lacks. A thin list for
an open-ended category is a bug.
