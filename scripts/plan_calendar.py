#!/usr/bin/env python3
"""Schedule categories onto days so that none ever repeats.

data/calendar.json lists, for each day starting at LAUNCH_DATE, the five
category ids played that day. This script only ever appends: days already
in the file are never changed, so archives and players' saved runs stay
correct. Each run fills as many new days as the unused categories allow.

Mixing rules for each new day:
- Every category has a level in data/difficulty.json, easy or medium. Each
  day gets EASY_PER_DAY easy categories and one medium one, and the medium
  one is played last (the farthest asteroid).
- Different families on the same day where possible (no two food categories
  together). When only a few families have categories left, a family may
  appear at most MAX_PER_FAMILY times in one day.
- Families take turns, so one big family can't crowd out the rest.
- Never two categories from the same group in data/overlaps.json on one day
  (Sharks and Sea creatures, Cakes and Cookies).

Categories listed under "hold" in data/schedule.json are never scheduled.
Hand-picked days in data/schedule.json are honored when that date is first
planned, and the categories pinned there are never used on any other day.
A pin can list fewer than five categories; the rest are filled as usual. Run with:  npm run plan:calendar
To throw away scheduled days from a date on and plan them again (only for
days nobody has played yet):  npm run plan:calendar -- --rebuild-from 2026-12-01
"""

from __future__ import annotations

import json
import os
import random
import re
import sys
from collections import defaultdict, deque
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CATEGORIES = ROOT / "src" / "data" / "categories.json"
CALENDAR = ROOT / "data" / "calendar.json"
PINS = ROOT / "data" / "schedule.json"
LEVELS = ROOT / "data" / "difficulty.json"
OVERLAPS = ROOT / "data" / "overlaps.json"
DATES_TS = ROOT / "src" / "lib" / "dates.ts"
ROUNDS_PER_DAY = 5
EASY_PER_DAY = 4
MAX_PER_FAMILY = 2
SEED = int(os.environ.get("PLAN_SEED", 0x0EB17))


def launch_date() -> date:
    m = re.search(r'LAUNCH_DATE = "(\d{4}-\d{2}-\d{2})"', DATES_TS.read_text())
    if not m:
        sys.exit("Couldn't find LAUNCH_DATE in src/lib/dates.ts")
    return date.fromisoformat(m.group(1))


def load_levels(ids: list[str]) -> dict[str, str]:
    data = json.loads(LEVELS.read_text(encoding="utf-8"))
    levels = {cid: lvl for lvl in ("easy", "medium") for cid in data[lvl]}
    missing = [cid for cid in ids if cid not in levels]
    if missing:
        sys.exit(f"Give these categories a level in data/difficulty.json first: {missing}")
    return levels


def main() -> None:
    cats = json.loads(CATEGORIES.read_text(encoding="utf-8"))["categories"]
    info = {c["id"]: c for c in cats}
    levels = load_levels(list(info))
    calendar = (
        json.loads(CALENDAR.read_text(encoding="utf-8"))
        if CALENDAR.exists()
        else {"start": launch_date().isoformat(), "days": []}
    )
    start = date.fromisoformat(calendar["start"])
    days: list[list[str]] = calendar["days"]
    if "--rebuild-from" in sys.argv:
        cut = date.fromisoformat(sys.argv[sys.argv.index("--rebuild-from") + 1])
        del days[max(0, (cut - start).days):]
    used = {cid for day in days for cid in day}
    schedule = json.loads(PINS.read_text(encoding="utf-8")) if PINS.exists() else {}
    pins = schedule.get("days", {})
    # Categories taken out of rotation for now (still in the game data).
    on_hold = set(schedule.get("hold", []))

    groups: dict[str, set[str]] = defaultdict(set)
    for name, ids in json.loads(OVERLAPS.read_text(encoding="utf-8"))["groups"].items():
        for cid in ids:
            if cid not in info:
                sys.exit(f"data/overlaps.json group '{name}' names an unknown category: {cid}")
            groups[cid].add(name)

    # Categories pinned to a later date are held back until that date, so a
    # holiday category like Christmas things lands on its holiday.
    last_planned = start + timedelta(days=len(days) - 1)
    held = {cid for d, ids in pins.items() if date.fromisoformat(d) > last_planned for cid in ids}

    rng = random.Random(SEED + len(days))
    unused = [c for c in cats if c["id"] not in used and c["id"] not in held and c["id"] not in on_hold]
    rng.shuffle(unused)

    # One queue per (level, family), so families can take turns.
    queues: dict[tuple[str, str], deque] = defaultdict(deque)
    for c in unused:
        queues[(levels[c["id"]], c["family"])].append(c["id"])

    def take(level: str, counts: dict[str, int], limit: int, taken: set[str]) -> str | None:
        # The first category in each family queue that overlaps nothing picked today.
        def first_free(q: deque) -> str | None:
            return next((cid for cid in q if not (groups[cid] & taken)), None)

        options = [
            k for k, q in queues.items()
            if k[0] == level and q and counts.get(k[1], 0) < limit and first_free(q)
        ]
        if not options:
            return None
        # Bigger families give up a category more often, but everyone gets turns.
        weights = [len(queues[k]) ** 0.5 for k in options]
        key = rng.choices(options, weights=weights)[0]
        cid = first_free(queues[key])
        queues[key].remove(cid)
        return cid

    def remove(cid: str) -> None:
        for q in queues.values():
            if cid in q:
                q.remove(cid)
                return

    added = 0
    while True:
        day_date = start + timedelta(days=len(days))
        pinned = pins.get(day_date.isoformat())
        if pinned:
            pinned = [cid for cid in pinned if cid in info and cid not in used]
        picks: list[str] = list(pinned or [])[:ROUNDS_PER_DAY]
        for cid in picks:
            remove(cid)
        counts: dict[str, int] = defaultdict(int)
        for cid in picks:
            counts[info[cid]["family"]] += 1

        def fill(level: str, upto: int) -> None:
            while sum(1 for c in picks if levels[c] == level) < upto and len(picks) < ROUNDS_PER_DAY:
                taken = set().union(*(groups[c] for c in picks)) if picks else set()
                cid = take(level, counts, 1, taken) or take(level, counts, MAX_PER_FAMILY, taken)
                if not cid:
                    return
                picks.append(cid)
                counts[info[cid]["family"]] += 1

        fill("medium", ROUNDS_PER_DAY - EASY_PER_DAY)
        fill("easy", ROUNDS_PER_DAY)
        if len(picks) < ROUNDS_PER_DAY:
            # Not enough left for a full day. Put them back for next time.
            for cid in picks:
                if cid not in (pinned or []):
                    queues[(levels[cid], info[cid]["family"])].appendleft(cid)
            break
        # Easy rounds first in random order, the medium one last.
        rng.shuffle(picks)
        picks.sort(key=lambda cid: levels[cid] != "easy")
        days.append(picks)
        used.update(picks)
        added += 1

    CALENDAR.write_text(json.dumps(calendar, indent=1) + "\n", encoding="utf-8")
    left = sum(len(q) for q in queues.values())
    last = start + timedelta(days=len(days) - 1)
    print(f"Added {added} days. Calendar covers {len(days)} days, {start} to {last}.")
    print(f"{left} categories unused (not enough easy ones left for a full day).")


if __name__ == "__main__":
    main()
