# Orebit

A daily category game set on an asteroid. Every day you get five asteroids, each one a category. You have 30 seconds per asteroid to name as many answers as you can. Common answers are surface dust. Rare answers are buried deeper and worth more. Each asteroid hides one legendary answer, the Starcore.

## Tiers

| Tier | Depth | Share of answers |
| --- | --- | --- |
| Regolith | 10 m | most familiar 30% |
| Iron | 20 m | next 25% |
| Cobalt | 35 m | next 20% |
| Gold | 55 m | next 15% |
| Crystal | 90 m | rarest 10% |
| Starcore | 250 m | one per category |

## How the answer data works

1. Answer lists live in `data/categories/*.txt`. The format is in `data/categories/README.md`.
2. `scripts/build_categories.py` scores each answer with the `wordfreq` library, which measures how often a word or name appears in real text. Multi-word names are scored by their rarest word with a small penalty per extra word.
3. Answers are ranked inside their category and split into tiers by percentile. You can force a tier with `@1` to `@5` on any line when the numbers get it wrong.
4. The build writes `src/data/categories.json`. The server reads it. Answer lists never ship to the browser until a round ends.

To rebuild the data after editing a category:

```bash
pip install wordfreq
```

```bash
npm run build:data
```

## Daily schedule

Every player gets the same five categories for a date (`ROUNDS_PER_DAY` in `src/lib/tiers.ts`). `src/lib/schedule.ts` shuffles all categories into a deck, deals five a day, and only repeats a category after every other one has been used. With 28 categories, each one comes back about every 5 to 6 days. Add more categories to stretch that out.

To hand-pick a day, add it to `data/schedule.json`:

```json
{ "days": { "2026-12-25": ["desserts", "trees", "colors", "birds", "fruits"] } }
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
