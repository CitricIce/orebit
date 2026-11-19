#!/usr/bin/env python3
"""Schedule categories onto days so that none ever repeats.

data/calendar.json lists, for each day starting at LAUNCH_DATE, the five
category ids played that day. This script only ever appends: days already
in the file are never changed, so archives and players' saved runs stay
correct. Each run fills as many new days as the unused categories allow.

Mixing rules for each new day:
- Hand-made categories are spread out, up to HAND_PER_DAY per day, so the
  best curated ones last as long as the generated ones.
- Different families on the same day where possible (no "Songs by ABBA" and
  "Songs by Queen" together). When only a few families have categories
  left, a family may appear at most MAX_PER_FAMILY times in one day.
- Families take turns, so one big family can't crowd out the rest.

Hand-picked days in data/schedule.json are honored when that date is first
planned. Run with:  npm run plan:calendar
"""

from __future__ import annotations

import json
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
DATES_TS = ROOT / "src" / "lib" / "dates.ts"
ROUNDS_PER_DAY = 5
HAND_PER_DAY = 2
MAX_PER_FAMILY = 2
SEED = 0x0EB17


def launch_date() -> date:
    m = re.search(r'LAUNCH_DATE = "(\d{4}-\d{2}-\d{2})"', DATES_TS.read_text())
    if not m:
        sys.exit("Couldn't find LAUNCH_DATE in src/lib/dates.ts")
    return date.fromisoformat(m.group(1))


def main() -> None:
    cats = json.loads(CATEGORIES.read_text(encoding="utf-8"))["categories"]
    info = {c["id"]: c for c in cats}
    calendar = (
        json.loads(CALENDAR.read_text(encoding="utf-8"))
        if CALENDAR.exists()
        else {"start": launch_date().isoformat(), "days": []}
    )
    start = date.fromisoformat(calendar["start"])
    days: list[list[str]] = calendar["days"]
    used = {cid for day in days for cid in day}
    pins = json.loads(PINS.read_text(encoding="utf-8")).get("days", {}) if PINS.exists() else {}

    rng = random.Random(SEED + len(days))
    unused = [c for c in cats if c["id"] not in used]
    rng.shuffle(unused)

    # One queue per (source, family), so families can take turns.
    queues: dict[tuple[str, str], deque] = defaultdict(deque)
    for c in unused:
        queues[(c["source"], c["family"])].append(c["id"])

    def take(source: str, counts: dict[str, int], limit: int) -> str | None:
        options = [k for k, q in queues.items() if k[0] == source and q and counts.get(k[1], 0) < limit]
        if not options:
            return None
        # Bigger families give up a category more often, but everyone gets turns.
        weights = [len(queues[k]) ** 0.5 for k in options]
        key = rng.choices(options, weights=weights)[0]
        return queues[key].popleft()

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
        hand_today = sum(1 for cid in picks if info[cid]["source"] == "hand")
        while len(picks) < ROUNDS_PER_DAY:
            cid = None
            for limit in (1, MAX_PER_FAMILY):
                if hand_today < HAND_PER_DAY:
                    cid = take("hand", counts, limit)
                    if cid:
                        hand_today += 1
                cid = cid or take("generated", counts, limit) or take("hand", counts, limit)
                if cid:
                    break
            if not cid:
                break
            picks.append(cid)
            counts[info[cid]["family"]] += 1
        if len(picks) < ROUNDS_PER_DAY:
            # Not enough left for a full day. Put them back for next time.
            break
        rng.shuffle(picks)
        days.append(picks)
        used.update(picks)
        added += 1

    CALENDAR.write_text(json.dumps(calendar, indent=1) + "\n", encoding="utf-8")
    left = sum(len(q) for q in queues.values())
    last = start + timedelta(days=len(days) - 1)
    print(f"Added {added} days. Calendar covers {len(days)} days, {start} to {last}.")
    print(f"{left} categories unused (not enough variety left for a full day).")


if __name__ == "__main__":
    main()
