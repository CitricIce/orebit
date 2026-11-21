#!/usr/bin/env python3
"""Build src/data/categories.json from data/categories/*.txt.

Tiers come from the source files: answers are listed under "--- 1" to
"--- 5" headings, sorted by how likely a player is to think of them (a
manual pass). Categories without headings
fall back to automatic tiers: each answer gets a familiarity score from the
`wordfreq` library, answers are ranked inside the category and split by
percentile. One answer per category becomes the Starcore.

Run with:  npm run build:data
Needs:     pip install wordfreq
"""

from __future__ import annotations

import json
import math
import os
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
# Extra answers for a category, one file per category id, in the same
# "--- N" tier format as the category files (no header lines needed).
ADDITIONS_DIR = ROOT / "data" / "additions"
# Hand-picked Starcore per category id: a niche but findable deep cut.
# Overrides any `starcore:` header and the automatic pick.
STARCORE_FILE = ROOT / "data" / "starcores.json"
STARCORES: dict[str, str] = (
    {k: v for k, v in json.loads(STARCORE_FILE.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    if STARCORE_FILE.exists()
    else {}
)

# Share of the non-Stone answers in Iron, Cobalt and Gold (Crystal gets the
# rest), capped so a huge list doesn't push its middle tiers into obscure
# answers. With the caps every category's Gold holds about the same kind of
# answer whether the list has 100 entries or 1,500.
DEEPER_SHARES = [0.15, 0.20, 0.25]
DEEPER_CAPS = [20, 30, 50]
STARCORE_TIER = 6
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
ORIGIN_LABELS = re.compile(r"\s+\b(PDO|PGI|PAT|DOP|IGP|TSG|AOC|AOP|DOC|DOCG|DO|STG)\b\.?$")
# Entries that slip into a class but aren't what the category means.
BANNED = {
    "pasta": re.compile(r"\b(alla|all'|with|soup|dumplings?|sauce|salad|terre|mafia|baked|fried)\b", re.I),
    "cocktails": re.compile(r"\b(bar|hotel|restaurant|lounge|club)$", re.I),
    "breads": re.compile(r"\b(bakery|company)\b", re.I),
    "fast-food": re.compile(
        r"\b(restaurant|restaurants|oldest|park|museum)\b|.+ mcdonald's$"
        r"|^(snack bar|kebab shop|hot dog stand|friterie|domino's pizza|potbelly sandwich shop|church's texas chicken)$",
        re.I,
    ),
    "instruments": re.compile(r"\b(microphone|soundbar|speaker|amplifier|foghorn|horn signal|siren)\b", re.I),
    "holidays": re.compile(r"^public holiday$|\d{4}|^ancient \w+ festival$|^festival$", re.I),
    "mexican-foods": re.compile(r"^(wrap|calavera|sugar skull)$", re.I),
    "american-foods": re.compile(r"^(mars|extra)$", re.I),
    "composers": re.compile(r"^(elton john)$", re.I),
    "car-brands": re.compile(r"^(stellantis\b.*|groupe psa|elbo|.*\bgroup)$", re.I),
    "sports": re.compile(r"^(battle rap|e-?sports? video game)$", re.I),
    "video-games": re.compile(r"\b(dlc|expansion pack|soundtrack|demo|beta|season pass|bundle|collection)\b", re.I),
    "fruits": re.compile(
        r"wikidata|^malus |^prunus |^citrus |^fruit of |'|^(walnut|almond|cashew|peanut|chestnut|hazelnut|pecan|pistachio|macadamia)$",
        re.I,
    ),
    "salads": re.compile(
        r"^(ajvar|relish|pickle relish|onion jam|fried cauliflower|rhyming recipe|baba ghanoush|vinegret)$", re.I
    ),
    "string-instruments": re.compile(
        r"^(bowed string instrument|violin family|guitars for type|soil|blackbird|kent|jew'?s harp)$", re.I
    ),
}
# Company-name endings. A Wikidata item like "Suzuki Motor Corporation" folds
# into the existing answer "Suzuki" instead of becoming its own answer.
CORPORATE = re.compile(
    r"\s+(motor (company|corporation|co\.?)|motors?( corporation| company| limited)?|group|limited|ltd\.?"
    r"|corporation|company|automobiles?|north america|industrial|professional|sport|cars?|inc\.?)$",
    re.I,
)
CORPORATE_CATS = {"car-brands", "tech-companies", "fashion-brands", "fast-food"}
# Categories whose Wikidata query is the rule: hand answers must match it.
# The set lists hand answers to keep anyway (Wikidata misses them).
WIKIDATA_ONLY: dict[str, set[str]] = {
    "us-cities": {"Los Angeles", "San Antonio", "Jacksonville", "Tampa", "Tacoma", "Ontario"},
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
    # Names that identify an answer: everything hand-written plus each Wikidata
    # item's main label. Only these merge an item into an existing answer.
    # Alternate names alone don't, because related items share them (George V
    # and George VI both list "George Windsor").
    strong = set(owner)

    def usable(k: str) -> bool:
        return len(k) >= 3 and k not in owner and k not in generic

    added = 0
    for item in items:
        tidy = tidy_wikidata(cid, item)
        if not tidy:
            continue
        name, extra = tidy
        # Drop alternate names that are just the label's first word ("electric"
        # for Electric guitar) or under 3 letters: with one-word dropping, they would
        # let "electric violin" count as Electric guitar.
        first = normalize_words(name)[:1]
        extra = [
            a for a in extra
            if len(key(a)) >= 3 and not (len(normalize_words(a)) == 1 and normalize_words(a) == first and len(normalize_words(name)) > 1)
        ]
        names = [name, *extra]
        keys = [key(n) for n in names]
        hit = next((owner[k] for k in keys if k in strong), None)
        if hit is None and cid in CORPORATE_CATS:
            base = key(CORPORATE.sub("", name))
            hit = owner.get(base) if base in strong and base != key(name) else None
        if hit is not None:
            rows[hit]["links"] = max(rows[hit].get("links", 0), item["links"])
            for n, k in zip(names, keys):
                if usable(k):
                    rows[hit]["aliases"].append(n)
                    owner[k] = hit
            continue
        if not usable(key(name)):
            continue
        idx = len(rows)
        row = {"name": name, "aliases": [], "override": wikidata_tier(item["links"]), "links": item["links"]}
        rows.append(row)
        owner[key(name)] = idx
        strong.add(key(name))
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


def parse_additions(path: Path) -> list[dict]:
    """Rows from a data/additions file. Lines before any "--- N" go to tier 4."""
    rows: list[dict] = []
    section = 4
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = re.fullmatch(r"---\s*([1-5])", line)
        if m:
            section = int(m.group(1))
            continue
        override = None
        m = re.search(r"\s@([1-5])$", line)
        if m:
            override = int(m.group(1))
            line = line[: m.start()].strip()
        names = [p.strip() for p in line.split("|") if p.strip()]
        if names:
            rows.append({"name": names[0], "aliases": names[1:], "override": override or section})
    return rows


def merge_head_word_twins(rows: list[dict], title: str) -> list[dict]:
    """Merge answers that differ only by the category's own word, like
    "Battenberg" and "Battenberg cake" in Cakes, so one cake can't score twice.
    The first row (hand-written rows come first) keeps its name and tier."""
    generic = {strip_plural(w) for w in normalize_words(title)}

    def key(name: str) -> str:
        words = [strip_plural(w) for w in normalize_words(name)]
        while len(words) > 1 and words[-1] in generic:
            words.pop()
        return "".join(words)

    kept: dict[str, dict] = {}
    out: list[dict] = []
    for row in rows:
        k = key(row["name"])
        twin = kept.get(k)
        if twin is None:
            kept[k] = row
            out.append(row)
            continue
        twin["aliases"] = sorted(set(twin["aliases"]) | set(row["aliases"]) | {row["name"]})
        if row["override"] and (not twin["override"] or row["override"] < twin["override"]):
            twin["override"] = row["override"]
    return out


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
    if cid in WIKIDATA_ONLY and (WIKIDATA_DIR / f"{cid}.json").exists():
        # The Wikidata query enforces a rule (U.S. cities: over 100,000
        # people), so hand-written answers it doesn't confirm are dropped.
        dropped = [r["name"] for r in rows if "links" not in r and r["name"] not in WIKIDATA_ONLY[cid]]
        rows = [r for r in rows if "links" in r or r["name"] in WIKIDATA_ONLY[cid]]
        if dropped and os.environ.get("SHOW_DROPPED"):
            print(f"  {cid}: dropped {len(dropped)}: {', '.join(dropped)}")
    rows = merge_head_word_twins(rows, raw["meta"]["title"])
    if added:
        print(f"  {cid}: +{added} answers from Wikidata")
    add_head_noun_aliases(rows)

    for row in rows:
        row["zipf"] = familiarity(row["name"], row["aliases"])
        # How many Wikipedia languages cover it, on the same rough scale as
        # word frequency (10 -> 2.6, 30 -> 3.7, 100 -> 5, 300 -> 6.2). Much better
        # than word frequency for people and titles.
        links = row.get("links", 0)
        # Prefer it whenever Wikidata knows the answer: word frequency
        # overrates brands that are also common words (Line, Orange, Sea).
        row["pop"] = 2.5 * math.log10(links + 1) if links else row["zipf"]

    # Most familiar first. Ties go to the shorter name.
    # Stone is exactly the hand-written "--- 1" list: the answers almost
    # everyone thinks of. Everything else is ranked from most to least likely
    # (hand tier first, then how common the name is) and split by
    # DEEPER_SHARES and DEEPER_CAPS, so Crystal, the deep cuts, is always the biggest tier.
    stone = [r for r in rows if r["override"] == 1]
    rest = sorted(
        (r for r in rows if r["override"] != 1),
        key=lambda r: (r["override"] or 3, -r["pop"], len(r["name"])),
    )
    tiers: dict[int, int] = {id(r): 1 for r in stone}
    bounds, acc = [], 0
    # Bigger lists get somewhat bigger middle tiers (up to double at 600+
    # answers), so Crystal stays genuinely deep in huge lists too.
    scale = min(2.0, max(1.0, math.sqrt(len(rest) / 150)))
    for share, cap in zip(DEEPER_SHARES, DEEPER_CAPS):
        acc += min(round(cap * scale), round(share * len(rest)))
        bounds.append(acc)
    for i, row in enumerate(rest):
        tiers[id(row)] = next((t for t, b in enumerate(bounds, 2) if i < b), 5)

    starcore_name = STARCORES.get(cid) or raw["meta"].get("starcore")
    if starcore_name:
        sk = strip_plural(normalize(starcore_name))
        star = next(
            (r for r in rows if any(strip_plural(normalize(n)) == sk for n in [r["name"], *r["aliases"]])),
            None,
        )
        if star is None:
            sys.exit(f"{cid}: starcore '{starcore_name}' is not in the answer list")
    else:
        # The most findable deep cut: the first answer in the Crystal tier.
        star = next((r for r in rest if tiers[id(r)] == 5), rest[-1] if rest else rows[-1])
    tiers[id(star)] = STARCORE_TIER

    answers = [
        {"name": r["name"], "aliases": r["aliases"], "tier": tiers[id(r)], "familiarity": r["zipf"]}
        for r in stone + rest
    ]

    return {
        "id": cid,
        "title": raw["meta"]["title"],
        "prompt": raw["meta"]["prompt"],
        "source": "hand",
        "family": Path(raw["file"]).stem,
        "answers": answers,
    }


# The bar every category must clear: most people can name about 5 answers in
# 45 seconds. The build can't ask people, so it checks the hand-sorted
# version: at least this many answers in the Stone tier, the ones almost
# everyone thinks of. See data/categories/README.md.
MIN_STONE = 5


def check_easy_enough(cats: list[dict]) -> None:
    short = {c["id"]: n for c in cats if (n := sum(1 for a in c["answers"] if a["tier"] == 1)) < MIN_STONE}
    if short:
        sys.exit(
            f"Too hard: these categories have fewer than {MIN_STONE} Stone answers {short}. "
            "Most players must be able to name about 5. Promote obvious answers to --- 1, "
            "or drop the category."
        )


CALENDAR_FILE = ROOT / "data" / "calendar.json"


def check_calendar(ids: set[str]) -> None:
    """Every category the calendar has already scheduled must still exist."""
    if not CALENDAR_FILE.exists():
        print("  note: no calendar yet. Run npm run plan:calendar")
        return
    days = json.loads(CALENDAR_FILE.read_text(encoding="utf-8"))["days"]
    missing = sorted({cid for day in days for cid in day if cid not in ids})
    if missing:
        sys.exit(f"Calendar uses categories that no longer exist: {missing[:10]}")
    print(f"  calendar: {len(days)} days scheduled")


def main() -> None:
    files = sorted(SRC_DIR.glob("*.txt"))
    if not files:
        sys.exit(f"No category files in {SRC_DIR}")
    raws = [c for f in files for c in parse_file(f)]
    ids = [c["id"] for c in raws]
    dupes = {i for i in ids if ids.count(i) > 1}
    if dupes:
        sys.exit(f"Duplicate category ids: {sorted(dupes)}")
    known = set(ids)
    for path in sorted(ADDITIONS_DIR.glob("*.txt")):
        if path.stem not in known:
            sys.exit(f"{path.relative_to(ROOT)}: no category with id '{path.stem}'")
    for raw in raws:
        extra = ADDITIONS_DIR / f"{raw['id']}.txt"
        if extra.exists():
            raw["rows"] += parse_additions(extra)

    # --only id[,id...] builds just those categories; --out path writes elsewhere.
    # Helpers use these to check one category without touching the real build.
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    out_file = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else OUT_FILE
    if only:
        raws = [r for r in raws if r["id"] in only]

    cats = [build_category(r) for r in sorted(raws, key=lambda r: r["id"])]
    check_easy_enough(cats)
    out_file.parent.mkdir(parents=True, exist_ok=True)
    out_file.write_text(
        json.dumps({"version": 2, "categories": cats}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    total = sum(len(c["answers"]) for c in cats)
    print(
        f"Built {len(cats)} categories with {total} answers -> {out_file}"
    )
    if "-v" in sys.argv:
        for c in cats:
            star = next(a["name"] for a in c["answers"] if a["tier"] == STARCORE_TIER)
            print(f"  {c['id']:<40} {len(c['answers']):>5} answers   starcore: {star}")
    if not only:
        check_calendar({c["id"] for c in cats})


if __name__ == "__main__":
    main()
