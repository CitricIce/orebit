# Orebit

A daily category game set on an asteroid. Every day you get five asteroids, each one a category. You have 45 seconds per asteroid to name as many answers as you can. The obvious answers are plain stone. Rare answers are buried deeper and worth more. Each asteroid hides one legendary answer, the Starcore.

## Tiers

| Tier | Depth | What lands here |
| --- | --- | --- |
| Stone | 10 m | The obvious answers almost everyone names |
| Iron | 20 m | Well known |
| Cobalt | 35 m | You know your stuff |
| Gold | 55 m | Enthusiast level |
| Crystal | 90 m | Deep cuts |
| Starcore | 250 m | One legendary answer per category |

## How the answer data works

1. Answer lists live in `data/categories/*.txt`, one file per theme. The format is in `data/categories/README.md`.
2. Answers are listed under tier headings (`--- 1` to `--- 5`), sorted by how likely a player is to think of them in 45 seconds. This is a manual pass, the same approach Krillion describes for answers word counts can't rank. Aliases (other names, short forms, alternate spellings) go on the same line after `|`.
3. `scripts/build_categories.py` merges duplicates, warns when one alias points at two answers, and writes `src/data/categories.json`. The server reads it. Answer lists never ship to the browser until the day is finished.
4. A category without tier headings falls back to automatic tiers from the `wordfreq` library's word-frequency data.

To rebuild the data after editing a category:

```bash
pip install wordfreq
```

```bash
npm run build:data
```

## Daily schedule

Every player gets the same five categories for a date (`ROUNDS_PER_DAY` in `src/lib/tiers.ts`). `src/lib/schedule.ts` shuffles all categories into a deck, deals five a day, and only repeats a category after every other one has been used. With 43 categories, each one comes back about every 8 to 9 days. Add more categories to stretch that out.

To hand-pick a day, add it to `data/schedule.json`:

```json
{ "days": { "2026-12-25": ["cakes", "breads", "cocktails", "candy", "cheeses"] } }
```

Set the launch day (puzzle #1) with `LAUNCH_DATE` in `src/lib/dates.ts`.

## Running it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

Other scripts:

- `npm test` runs the matching and schedule tests.
- `npm run lint` and `npm run build` check everything before deploy.

## Deploying

The app is a standard Next.js project. On Vercel, import the repo and deploy. Set `NEXT_PUBLIC_SITE_URL` to your domain so link previews use the right address.

## API

| Route | What it does |
| --- | --- |
| `GET /api/day/:date` | The day's five categories, without answers |
| `POST /api/guess` | Body `{ date, round, guess }`. Returns the matched answer and tier, or a miss |
| `GET /api/reveal/:date/:round` | The full answer list for a round |

Matching ignores case, accents, punctuation, "the" and plural endings, and allows one typo on names of 5+ letters and two on 9+ letters when only one answer is that close.

## Where things are stored

Player progress, streaks and stats live in the browser's localStorage. There are no accounts or database yet.

## Known limits

- The reveal endpoint doesn't check whether a round is over, so a determined player can peek at answers early.
- Stats don't sync between devices.
- There's no global "how many players found this" data yet. That needs a database.
