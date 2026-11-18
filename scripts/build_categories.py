#!/usr/bin/env python3
"""Build src/data/categories.json from data/categories/*.txt.

Each answer gets a familiarity score from the `wordfreq` library (a Zipf
value: roughly how often the name shows up in real text). Answers are then
ranked inside their category and split into tiers by percentile, so the most
familiar answers are Regolith and the least familiar are Crystal. One answer
per category becomes the Starcore.

Run with:  npm run build:data
Needs:     pip install wordfreq
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    from wordfreq import zipf_frequency
except ImportError:  # pragma: no cover
    sys.exit("wordfreq is missing. Run: pip install wordfreq")

ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "data" / "categories"
OUT_FILE = ROOT / "src" / "data" / "categories.json"

# Share of answers in each tier, most familiar first. Must sum to 1.
TIER_SHARES = [0.30, 0.25, 0.20, 0.15, 0.10]
STARCORE_TIER = 6
AUTO_STARCORE_PERCENTILE = 0.88
PHRASE_PENALTY = 0.6
STOPWORDS = {"the", "of", "and", "de", "la", "di", "du", "le"}


def normalize(text: str) -> str:
    """Must match normalize() in src/lib/match.ts."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = t.replace("&", " and ").replace("+", " plus ").replace("#", " sharp ")
    t = re.sub(r"['’ʻ`]", "", t)
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    if t.startswith("the "):
        t = t[4:]
    return t.replace(" ", "")


def strip_plural(key: str) -> str:
    if len(key) > 3 and key.endswith("s") and not key.endswith("ss"):
        return key[:-1]
    return key


def phrase_score(text: str) -> float:
    """Zipf score for a name. wordfreq rates phrases like "jack russell
    terrier" as common because each word is common, so a multi-word name is
    scored by its rarest word minus a penalty per extra word."""
    clean = unicodedata.normalize("NFKD", text)
    clean = "".join(c for c in clean if not unicodedata.combining(c)).lower()
    words = [w for w in re.split(r"[^a-z0-9']+", clean) if w and w not in STOPWORDS]
    if not words:
        return 0.0
    if len(words) == 1:
        return zipf_frequency(words[0], "en")
    return max(0.0, min(zipf_frequency(w, "en") for w in words) - PHRASE_PENALTY * (len(words) - 1))


def familiarity(name: str, aliases: list[str]) -> float:
    # Aliases count too ("golden" for Golden Retriever), except very short
    # ones like "lab" or "car" that are mostly other words.
    candidates = [name] + [a for a in aliases if len(normalize(a)) > 3]
    return round(max(phrase_score(c) for c in candidates), 2)


def parse_file(path: Path) -> list[dict]:
    cats: list[dict] = []
    cur: dict | None = None
    in_body = False
    for lineno, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("==="):
            cur = {"id": line[3:].strip(), "meta": {}, "rows": [], "file": path.name}
            cats.append(cur)
            in_body = False
            continue
        if cur is None:
            sys.exit(f"{path.name}:{lineno}: content before the first === header")
        if line == "---":
            in_body = True
            continue
        if not in_body:
            key, _, val = line.partition(":")
            cur["meta"][key.strip().lower()] = val.strip()
            continue
        override = None
        m = re.search(r"\s@([1-5])$", line)
        if m:
            override = int(m.group(1))
            line = line[: m.start()].strip()
        names = [p.strip() for p in line.split("|") if p.strip()]
        cur["rows"].append({"name": names[0], "aliases": names[1:], "override": override})
    return cats


def build_category(raw: dict) -> dict:
    cid = raw["id"]
    if not re.fullmatch(r"[a-z0-9-]+", cid):
        sys.exit(f"Bad category id: {cid!r}")
    for field in ("title", "prompt"):
        if field not in raw["meta"]:
            sys.exit(f"{cid}: missing '{field}' header")

    # Merge duplicate rows (same name after normalizing, plurals included).
    merged: dict[str, dict] = {}
    order: list[str] = []
    for row in raw["rows"]:
        k = strip_plural(normalize(row["name"]))
        if k in merged:
            m = merged[k]
            m["aliases"] = sorted(set(m["aliases"]) | set(row["aliases"]))
            m["override"] = m["override"] or row["override"]
            continue
        merged[k] = dict(row)
        order.append(k)
    rows = [merged[k] for k in order]

    # Warn when one alias points at two different answers.
    owner: dict[str, str] = {}
    for row in rows:
        for n in [row["name"]] + row["aliases"]:
            k = strip_plural(normalize(n))
            if k in owner and owner[k] != row["name"]:
                print(f"  warning: {cid}: '{n}' matches both '{owner[k]}' and '{row['name']}'")
            owner.setdefault(k, row["name"])

    for row in rows:
        row["zipf"] = familiarity(row["name"], row["aliases"])

    # Most familiar first. Ties go to the shorter name.
    ranked = sorted(rows, key=lambda r: (-r["zipf"], len(r["name"])))
    n = len(ranked)

    starcore_name = raw["meta"].get("starcore")
    if starcore_name:
        sk = strip_plural(normalize(starcore_name))
        star = next((r for r in ranked if strip_plural(normalize(r["name"])) == sk), None)
        if star is None:
            sys.exit(f"{cid}: starcore '{starcore_name}' is not in the answer list")
    else:
        star = ranked[min(n - 1, int(n * AUTO_STARCORE_PERCENTILE))]

    bounds = []
    acc = 0.0
    for share in TIER_SHARES:
        acc += share
        bounds.append(acc)

    answers = []
    for i, row in enumerate(ranked):
        pct = (i + 0.5) / n
        tier = next(t for t, b in enumerate(bounds, 1) if pct <= b + 1e-9)
        if row["override"]:
            tier = row["override"]
        if row is star:
            tier = STARCORE_TIER
        answers.append(
            {
                "name": row["name"],
                "aliases": row["aliases"],
                "tier": tier,
                "familiarity": row["zipf"],
            }
        )

    return {
        "id": cid,
        "title": raw["meta"]["title"],
        "prompt": raw["meta"]["prompt"],
        "answers": answers,
    }


def main() -> None:
    files = sorted(SRC_DIR.glob("*.txt"))
    if not files:
        sys.exit(f"No category files in {SRC_DIR}")
    raws = [c for f in files for c in parse_file(f)]
    ids = [c["id"] for c in raws]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        sys.exit(f"Duplicate category ids: {sorted(dupes)}")

    cats = [build_category(r) for r in sorted(raws, key=lambda r: r["id"])]
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps({"version": 1, "categories": cats}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8",
    )
    total = sum(len(c["answers"]) for c in cats)
    print(f"Built {len(cats)} categories with {total} answers -> {OUT_FILE.relative_to(ROOT)}")
    for c in cats:
        star = next(a["name"] for a in c["answers"] if a["tier"] == STARCORE_TIER)
        print(f"  {c['id']:<22} {len(c['answers']):>4} answers   starcore: {star}")


if __name__ == "__main__":
    main()
