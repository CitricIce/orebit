#!/usr/bin/env python3
"""Generate narrow categories from Wikidata, for a calendar that never repeats.

Builds "famous list" categories from Wikidata: award winners (Best Actress
Oscar winners, Ballon d'Or), office holders (Roman emperors, UK prime
ministers), league teams (NBA, NFL), studio films (Pixar, Studio Ghibli) and
one-off lists (Pokemon, volcanoes, fast food chains). Each needs enough
answers, including enough well-known ones, to be playable. Results are saved
to data/generated/<family>.json and committed, so builds stay offline.

Narrower splits (songs by one artist, cheeses from one country, cities in one
country) were tried and dropped: too specific for a daily game.

Run with:  npm run generate:categories              (all families)
           npm run generate:categories -- songs      (one family)
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_wikidata import clean, run  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "generated"

MIN_ANSWERS = 25  # a category needs at least this many answers
MIN_FAMOUS = 5  # ...and this many well-known ones (FAMOUS_LINKS+ Wikipedia languages)
FAMOUS_LINKS = 10


def tree(q: str) -> str:
    return f"?item (wdt:P31|wdt:P279)/wdt:P279* wd:{q} ."


def values(*qids: str) -> str:
    return "VALUES ?group { " + " ".join(f"wd:{q}" for q in qids) + " }"


# Named groups: a fixed list of groups with hand-written titles.
NAMED: dict[str, tuple[str, int, dict[str, tuple[str, str]]]] = {
    "award": (
        "?item wdt:P166 ?group .",
        1,
        {
            "Q103916": ("Best Actor Oscar winners", "Name actors who won the Academy Award for Best Actor"),
            "Q103618": ("Best Actress Oscar winners", "Name actresses who won the Academy Award for Best Actress"),
            "Q103360": ("Best Director Oscar winners", "Name winners of the Academy Award for Best Director"),
            "Q166177": ("Ballon d'Or winners", "Name footballers who won the Ballon d'Or"),
            "Q37922": ("Nobel Prize in Literature winners", "Name winners of the Nobel Prize in Literature"),
            "Q35637": ("Nobel Peace Prize winners", "Name winners of the Nobel Peace Prize"),
            "Q904528": ("Grammy Album of the Year winners", "Name artists who won the Grammy for Album of the Year"),
            "Q833633": ("Pulitzer Prize for Fiction winners", "Name winners of the Pulitzer Prize for Fiction"),
            "Q160082": ("Booker Prize winners", "Name winners of the Booker Prize"),
        },
    ),
    # The film awards are also recorded on producers and directors, so ask for films only.
    "film-award": (
        "?item wdt:P31 wd:Q11424 ; wdt:P166 ?group .",
        1,
        {
            "Q102427": ("Best Picture winners", "Name films that won the Academy Award for Best Picture"),
            "Q179808": ("Palme d'Or winners", "Name films that won the Palme d'Or"),
        },
    ),
    "office": (
        "?item wdt:P39 ?group .",
        1,
        {
            "Q14211": ("Prime ministers of the UK", "Name British prime ministers"),
            "Q191954": ("Presidents of France", "Name presidents of France"),
            "Q839078": ("Prime ministers of Canada", "Name prime ministers of Canada"),
            "Q319145": ("Prime ministers of Australia", "Name prime ministers of Australia"),
            "Q842606": ("Roman emperors", "Name Roman emperors"),
            "Q11699": ("U.S. vice presidents", "Name vice presidents of the United States"),
            "Q274948": ("Prime ministers of Japan", "Name prime ministers of Japan"),
            "Q192711": ("Prime ministers of India", "Name prime ministers of India"),
            "Q19546": ("Popes", "Name popes"),
            "Q14213": ("U.S. secretaries of state", "Name U.S. secretaries of state"),
        },
    ),
    "league": (
        "?item wdt:P118 ?group .",
        1,
        {
            "Q155223": ("NBA teams", "Name NBA teams"),
            "Q1215884": ("NFL teams", "Name NFL teams"),
            "Q1163715": ("MLB teams", "Name Major League Baseball teams"),
            "Q1215892": ("NHL teams", "Name NHL teams"),
            "Q9448": ("Premier League clubs", "Name clubs that have played in the Premier League"),
        },
    ),
    "studio": (
        "?item wdt:P31 wd:Q11424 ; wdt:P272 ?group .",
        1,
        {
            "Q127552": ("Pixar films", "Name Pixar films"),
            "Q1047410": ("Disney animated films", "Name Walt Disney Animation Studios films"),
            "Q182950": ("Studio Ghibli films", "Name Studio Ghibli films"),
        },
    ),
}

# One-off lists: id -> (pattern, min sitelinks, title, prompt).
LISTS: dict[str, tuple[str, int, str, str]] = {
    "named-stars": ("?item wdt:P31 wd:Q523 .", 25, "Named stars", "Name stars in the night sky"),
    "volcanoes": ("?item wdt:P31 wd:Q8072 .", 25, "Volcanoes", "Name volcanoes"),
    "fast-food-chains": ("?item wdt:P31 wd:Q18509232 .", 4, "Fast food chains", "Name fast food chains"),
    "soft-drinks": ("?item wdt:P31 wd:Q147538 .", 4, "Soft drinks", "Name soft drinks and sodas"),
    "typefaces": ("?item wdt:P31 wd:Q17451 .", 6, "Fonts", "Name fonts and typefaces"),
    "video-game-consoles": ("?item wdt:P31 wd:Q8076 .", 8, "Video game consoles", "Name video game consoles"),
    "operas": ("?item wdt:P31 wd:Q1344 .", 15, "Operas", "Name operas"),
    "musicals": ("?item wdt:P31 wd:Q2743 .", 10, "Musicals", "Name stage musicals"),
    "cryptocurrencies": ("?item wdt:P31 wd:Q13479982 .", 8, "Cryptocurrencies", "Name cryptocurrencies"),
    "web-browsers": ("?item wdt:P31 wd:Q6368 .", 6, "Web browsers", "Name web browsers"),
    "operating-systems": ("?item wdt:P31 wd:Q9135 .", 15, "Operating systems", "Name operating systems"),
    "airlines": ("?item wdt:P31 wd:Q46970 .", 25, "Airlines", "Name airlines"),
    "liqueurs": (tree("Q178780"), 4, "Liqueurs", "Name liqueurs"),
    "breakfast-cereals": (tree("Q768267"), 2, "Breakfast cereals", "Name breakfast cereals"),
    "pokemon": ("?item wdt:P31 wd:Q3966183 .", 1, "Pokémon", "Name Pokémon"),
    "mcu-films": (
        "?item wdt:P31 wd:Q11424 . { ?item wdt:P179 wd:Q642878 } UNION { ?item wdt:P361 wd:Q642878 }",
        1,
        "Marvel Cinematic Universe films",
        "Name Marvel Cinematic Universe films",
    ),
}

GROUP_QUERY = """
SELECT ?item ?label ?links ?group ?groupLabel ?sci (GROUP_CONCAT(DISTINCT ?alt; separator="\\u001f") AS ?alts) WHERE {{
  {pattern}
  ?item wikibase:sitelinks ?links . FILTER(?links >= {minimum})
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  ?group rdfs:label ?groupLabel . FILTER(LANG(?groupLabel) = "en")
  OPTIONAL {{ ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }}
  OPTIONAL {{ ?item wdt:P225 ?sci }}
}}
GROUP BY ?item ?label ?links ?group ?groupLabel ?sci
"""


def slug(text: str) -> str:
    t = unicodedata.normalize("NFKD", text)
    t = "".join(c for c in t if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")[:60]


# Place names that take "the" in English.
NEEDS_THE = re.compile(
    r"^(United (Kingdom|States|Arab Emirates)|Netherlands|Philippines|Czech Republic|Bahamas|Gambia|Maldives|"
    r"Democratic Republic of the Congo|Republic of the Congo|Central African Republic|Dominican Republic|"
    r"Solomon Islands|Marshall Islands|Faroe Islands|Soviet Union|Vatican City|Ivory Coast)$"
)


def tidy_group(label: str) -> str:
    label = re.sub(r"\s*\([^)]*\)", "", label).strip()
    label = re.sub(r"\s+cuisine$", "", label, flags=re.I)
    return f"the {label}" if NEEDS_THE.match(label) else label


def collect(rows: list[dict], require_common_name: bool = False) -> dict[str, dict]:
    """Group query rows into {group_qid: {"label": ..., "items": {qid: item}}}."""
    groups: dict[str, dict] = {}
    for b in rows:
        label = clean(b["label"]["value"])
        if not label:
            continue
        sci = b.get("sci", {}).get("value")
        if require_common_name and (not sci or label.lower() == sci.lower()):
            continue
        gq = b["group"]["value"].rsplit("/", 1)[-1]
        g = groups.setdefault(gq, {"label": tidy_group(b["groupLabel"]["value"]), "items": {}})
        qid = b["item"]["value"].rsplit("/", 1)[-1]
        alts = [clean(a) for a in b.get("alts", {}).get("value", "").split("\u001f") if a]
        names = [n for n in [*alts, clean(sci) if sci else None] if n and n.lower() != label.lower()]
        item = g["items"].setdefault(qid, {"name": label, "aliases": [], "links": int(b["links"]["value"])})
        item["aliases"] = sorted(set(item["aliases"]) | set(names), key=str.lower)
    return groups


def playable(items: list[dict]) -> bool:
    return len(items) >= MIN_ANSWERS and sum(1 for i in items if i["links"] >= FAMOUS_LINKS) >= MIN_FAMOUS


def to_category(cid: str, title: str, prompt: str, items: dict[str, dict]) -> dict | None:
    answers = sorted(items.values(), key=lambda i: (-i["links"], i["name"].lower()))
    if not playable(answers):
        return None
    return {"id": cid, "title": title, "prompt": prompt, "answers": answers}


def generate(family: str) -> list[dict]:
    cats: list[dict] = []
    if family in NAMED:
        pattern, minimum, titles = NAMED[family]
        query = GROUP_QUERY.format(pattern=values(*titles) + " " + pattern, minimum=minimum)
        groups = collect(run(query))
        for gq, (title, prompt) in titles.items():
            if gq in groups:
                cat = to_category(slug(title), title, prompt, groups[gq]["items"])
                if cat:
                    cats.append(cat)
    elif family == "lists":
        for cid, (pattern, minimum, title, prompt) in LISTS.items():
            query = GROUP_QUERY.format(pattern=pattern + " BIND(wd:Q35120 AS ?group)", minimum=minimum)
            try:
                groups = collect(run(query))
            except Exception as err:  # noqa: BLE001
                print(f"    {title}: FAILED ({err})", flush=True)
                continue
            items = {k: v for g in groups.values() for k, v in g["items"].items()}
            cat = to_category(cid, title, prompt, items)
            print(f"    {title}: {len(items)} items{'' if cat else ' (too few, skipped)'}", flush=True)
            if cat:
                cats.append(cat)
            time.sleep(1)
    return sorted(cats, key=lambda c: -sum(a["links"] for a in c["answers"][:20]))


FAMILIES = [*NAMED, "lists"]


def main() -> None:
    wanted = sys.argv[1:] or FAMILIES
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for family in wanted:
        if family not in FAMILIES:
            sys.exit(f"Unknown family: {family}. Choose from: {', '.join(FAMILIES)}")
        print(f"  {family} ...", flush=True)
        try:
            cats = generate(family)
        except Exception as err:  # noqa: BLE001 - keep going, report at the end
            print(f"  {family}: FAILED ({err}). The previous file, if any, is kept.", flush=True)
            failed.append(family)
            continue
        out = {"family": family, "categories": cats}
        (OUT_DIR / f"{family}.json").write_text(json.dumps(out, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
        print(f"  {family}: {len(cats)} categories", flush=True)
        time.sleep(2)
    if failed:
        sys.exit(f"Failed: {', '.join(failed)}. Run again for just those.")


if __name__ == "__main__":
    main()
