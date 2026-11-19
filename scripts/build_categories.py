#!/usr/bin/env python3
"""Build src/data/categories.json from data/categories/*.txt.

Tiers come from the source files: answers are listed under "--- 1" to
"--- 5" headings, sorted by how likely a player is to think of them (a
manual pass, the way Krillion curates rarity). Categories without headings
fall back to automatic tiers: each answer gets a familiarity score from the
`wordfreq` library, answers are ranked inside the category and split by
percentile. One answer per category becomes the Starcore.

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


ROMAN = {
    "i": "1", "ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10",
    "xi": "11", "xii": "12", "xiii": "13", "xiv": "14", "xv": "15", "xvi": "16", "xvii": "17", "xviii": "18",
    "xix": "19", "xx": "20",
}
NUMBER_WORDS = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
]
ORDINALS = [
    "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
    "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth",
    "nineteenth", "twentieth",
]
NUMBERS = dict(ROMAN)
NUMBERS.update({w: str(n) for n, w in enumerate(NUMBER_WORDS)})
NUMBERS.update({w: str(n) for n, w in enumerate(ORDINALS) if w})
for _n in range(1, 21):
    NUMBERS[str(_n) + {1: "st", 2: "nd", 3: "rd"}.get(_n, "th")] = str(_n)
FILLER = {"the", "a", "an", "of", "and", "part"}


def normalize_words(text: str) -> list[str]:
    """Must match normalizeWords() in src/lib/match.ts."""
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = t.replace("&", " and ").replace("+", " plus ").replace("#", " sharp ")
    t = re.sub("['’ʻ`]", "", t)
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    words = [NUMBERS.get(w, w) for w in t.split()] if t else []
    kept = [w for w in words if w not in FILLER]
    return kept or words


def normalize(text: str) -> str:
    """Must match normalize() in src/lib/match.ts."""
    return "".join(normalize_words(text))


def add_head_noun_aliases(rows: list[dict]) -> None:
    """Let "goblin" count for Goblin Shark and "cairn" for Cairn Terrier.

    A word that starts or ends many names in a category (shark, terrier,
    comet, queso) is a head noun. A name with one also gets an alias without
    it, as long as that alias is unique and doesn't clash with another name.
    """
    taken = {strip_plural(normalize(n)) for r in rows for n in [r["name"], *r["aliases"]]}
    words = [normalize_words(r["name"]) for r in rows]
    lasts: dict[str, int] = {}
    firsts: dict[str, int] = {}
    for w in words:
        if len(w) >= 2:
            lasts[w[-1]] = lasts.get(w[-1], 0) + 1
            firsts[w[0]] = firsts.get(w[0], 0) + 1
    floor = max(3, len(rows) * 0.03)
    owners: dict[str, set[int]] = {}
    for i, w in enumerate(words):
        if len(w) < 2:
            continue
        options = []
        if lasts.get(w[-1], 0) >= floor:
            options.append(w[:-1])
        if firsts.get(w[0], 0) >= floor:
            options.append(w[1:])
        for rest in options:
            key = strip_plural("".join(rest))
            if len(key) >= 4 and key not in taken:
                owners.setdefault(key, set()).add(i)
    for key, who in owners.items():
        if len(who) == 1:
            i = next(iter(who))
            rows[i]["aliases"] = [*rows[i]["aliases"], key]


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


WIKIDATA_DIR = ROOT / "data" / "wikidata"
PEOPLE = {"painters", "composers"}
# Official labels that nobody types.
ORIGIN_LABELS = re.compile(r"\s+\b(PDO|PGI|PAT|DOP|IGP|TSG|AOC|AOP|DOC|DOCG|DO|STG)\b\.?$", re.I)
# Entries that slip into a class but aren't what the category means.
BANNED = {
    "pasta": re.compile(r"\b(alla|all'|with|soup|dumplings?|sauce|salad|terre|mafia|baked|fried)\b", re.I),
    "cocktails": re.compile(r"\b(bar|hotel|restaurant|lounge|club)$", re.I),
    "breads": re.compile(r"\b(bakery|company)\b", re.I),
}
MAX_NEW_WORDS = 4
MAX_NEW_CHARS = 32


def tidy_wikidata(cid: str, item: dict) -> tuple[str, list[str]] | None:
    """Clean a Wikidata item into (display name, aliases), or None to skip."""
    names = []
    for n in [item["name"], *item["aliases"]]:
        for part in re.split(r"\s+/\s+", n):
            part = ORIGIN_LABELS.sub("", part).strip()
            if part and not part.lower().startswith(("category:", "list of", "template:")):
                names.append(part)
    if not names:
        return None
    name, aliases = names[0], names[1:]
    banned = BANNED.get(cid)
    if banned and banned.search(name):
        return None
    if len(name.split()) > MAX_NEW_WORDS or len(name) > MAX_NEW_CHARS:
        # Keep the item only if one of its other names is short enough.
        short = next((a for a in aliases if len(a.split()) <= MAX_NEW_WORDS and len(a) <= MAX_NEW_CHARS), None)
        if not short:
            return None
        aliases = [name, *[a for a in aliases if a != short]]
        name = short
    return name[0].upper() + name[1:], aliases


def wikidata_tier(links: int) -> int:
    """Tier for an answer only Wikidata knows about, by how many Wikipedia
    language editions cover it. The famous ones are already hand-sorted."""
    if links >= 30:
        return 3
    if links >= 10:
        return 4
    return 5


def merge_wikidata(cid: str, title: str, rows: list[dict]) -> int:
    """Fold data/wikidata/<cid>.json into the hand-sorted rows.

    Items that match an existing answer (by any name) add their alternate
    names as aliases. New items become new answers in the rare tiers.
    Returns how many answers were added.
    """
    path = WIKIDATA_DIR / f"{cid}.json"
    if not path.exists():
        return 0
    items = json.loads(path.read_text(encoding="utf-8"))

    def key(n: str) -> str:
        return strip_plural(normalize(n))

    generic = {strip_plural(w) for w in normalize_words(title)} | {key(title)}
    owner: dict[str, int] = {}
    for i, row in enumerate(rows):
        for n in [row["name"], *row["aliases"]]:
            owner.setdefault(key(n), i)

    def usable(k: str) -> bool:
        return len(k) >= 3 and k not in owner and k not in generic

    added = 0
    for item in items:
        tidy = tidy_wikidata(cid, item)
        if not tidy:
            continue
        name, extra = tidy
        names = [name, *extra]
        keys = [key(n) for n in names]
        hit = next((owner[k] for k in keys if k in owner), None)
        if hit is not None:
            for n, k in zip(names, keys):
                if usable(k):
                    rows[hit]["aliases"].append(n)
                    owner[k] = hit
            continue
        if not usable(key(name)):
            continue
        idx = len(rows)
        row = {"name": name, "aliases": [], "override": wikidata_tier(item["links"])}
        rows.append(row)
        owner[key(name)] = idx
        for n, k in zip(names[1:], keys[1:]):
            if usable(k):
                row["aliases"].append(n)
                owner[k] = idx
        if cid in PEOPLE:
            surname = name.split()[-1]
            if usable(key(surname)) and len(key(surname)) >= 4:
                row["aliases"].append(surname)
                owner[key(surname)] = idx
        added += 1
    return added


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
        m = re.fullmatch(r"---(?:\s*([1-5]))?", line)
        if m:
            in_body = True
            cur["section"] = int(m.group(1)) if m.group(1) else None
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
        cur["rows"].append(
            {"name": names[0], "aliases": names[1:], "override": override or cur.get("section")}
        )
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

    added = merge_wikidata(cid, raw["meta"]["title"], rows)
    if added:
        print(f"  {cid}: +{added} answers from Wikidata")
    add_head_noun_aliases(rows)

    for row in rows:
        row["zipf"] = familiarity(row["name"], row["aliases"])

    # Most familiar first. Ties go to the shorter name.
    ranked = sorted(rows, key=lambda r: (-r["zipf"], len(r["name"])))
    n = len(ranked)

    starcore_name = raw["meta"].get("starcore")
    if starcore_name:
        sk = strip_plural(normalize(starcore_name))
        star = next(
            (r for r in ranked if any(strip_plural(normalize(n)) == sk for n in [r["name"], *r["aliases"]])),
            None,
        )
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
