#!/usr/bin/env python3
"""Pull extra answers and alternate names from Wikidata.

For each category below, this asks Wikidata's public query service for
every matching item (every dog breed, every cheese, every dinosaur genus)
with its English name, English alternate names and how many Wikipedia
language editions cover it (a rough fame score). Results are saved to
data/wikidata/<category>.json and committed, so normal builds work offline.
build_categories.py merges them: items already in the hand-sorted lists
gain their alternate names, and new items join the rare tiers.

Run with:  npm run fetch:wikidata            (all categories)
           npm run fetch:wikidata -- cheeses  (one category)
"""

from __future__ import annotations

import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "data" / "wikidata"
ENDPOINT = "https://query.wikidata.org/sparql"
USER_AGENT = "orebit-data-builder/1.0 (category answer lists)"


def inst(q: str) -> str:
    return f"?item wdt:P31 wd:{q} ."


def tree(q: str) -> str:
    """Instances or subclasses of q, at any depth (food types are often subclasses)."""
    return f"?item (wdt:P31|wdt:P279)/wdt:P279* wd:{q} ."


def taxa(parent: str, rank: str = "Q7432") -> str:
    """Taxa under a parent taxon at a given rank (species by default)."""
    return f"?item wdt:P171+ wd:{parent} ; wdt:P105 wd:{rank} ."


def people(occupation: str) -> str:
    return f"?item wdt:P31 wd:Q5 ; wdt:P106 wd:{occupation} ."


def dishes_from(country: str, cuisine: str) -> str:
    return (
        f"{tree('Q746549')} {{ ?item wdt:P495 wd:{country} }} UNION {{ ?item wdt:P2012 wd:{cuisine} }}"
    )


# Each category: one or more (pattern, minimum sitelinks) pairs.
# The minimum drops entries so obscure nobody could reasonably know them.
SOURCES: dict[str, list[tuple[str, int]]] = {
    "dog-breeds": [(inst("Q39367"), 1)],
    "cat-breeds": [(inst("Q43577"), 1)],
    "cheeses": [(tree("Q10943"), 1)],
    "breads": [(tree("Q7802"), 1)],
    "cocktails": [(tree("Q134768"), 1)],
    "cakes": [(tree("Q13276"), 1)],
    "pasta": [(tree("Q178"), 1)],
    "herbs-spices": [(tree("Q42527"), 1), (tree("Q207123"), 2)],
    "gemstones": [(tree("Q83437"), 1)],
    "board-games": [(inst("Q131436"), 5)],
    "card-games": [(tree("Q142714"), 2)],
    "programming-languages": [(tree("Q9143"), 4)],
    "car-brands": [(inst("Q786820"), 4), (inst("Q10429667"), 3)],
    "string-instruments": [(tree("Q1798603"), 2)],
    # Gods from any mythology: Greek, Roman and Norse in depth, every other
    # pantheon's well-known deities through the general "deity" item.
    "gods": [
        (tree("Q22989102"), 2),
        (tree("Q11688446"), 2),
        (tree("Q16513881"), 3),
        ("?item wdt:P31/wdt:P279* wd:Q178885 .", 12),
    ],
    # Anyone who held an emperor's title (Roman, Chinese, Mughal, Russian...).
    "emperors": [("?item wdt:P31 wd:Q5 ; wdt:P39/wdt:P279* wd:Q39018 .", 12)],
    "mexican-foods": [(dishes_from("Q96", "Q207965"), 2)],
    "candy": [(tree("Q185583"), 3), (tree("Q1361086"), 2)],
    "solar-system": [
        (inst("Q2537"), 2),
        (inst("Q2199"), 1),
        (inst("Q3559"), 6),
    ],
    "cetaceans": [(taxa("Q160"), 1)],
    "dinosaurs": [(taxa("Q430", "Q34740") + " ?item wdt:P31 wd:Q23038290 .", 2)],
    "painters": [(people("Q1028181"), 25)],
    # Composers, minus people mainly known for pop, rock or other fields:
    # singer-songwriters, rappers, actors, guitarists, comedians, record
    # producers, footballers and monarchs.
    "composers": [
        (
            people("Q36834")
            + " ?item wdt:P569 ?born . FILTER(YEAR(?born) < 1960)"
            + " FILTER NOT EXISTS { ?item wdt:P106 ?other . VALUES ?other {"
            + " wd:Q488205 wd:Q2252262 wd:Q33999 wd:Q855091 wd:Q245068 wd:Q183945 wd:Q116 wd:Q937857 } }",
            25,
        )
    ],
    # Added for the second wave of categories.
    "desserts": [(tree("Q182940"), 3)],
    "fruits": [(tree("Q3314483"), 8)],
    "vegetables": [(tree("Q11004"), 5)],
    "cookies": [(tree("Q13266"), 2)],
    "salads": [(tree("Q9266"), 2)],
    "spirits": [(tree("Q154"), 8)],
    "mythical-creatures": [(tree("Q2239243"), 15)],
    "holidays": [(tree("Q1445650"), 20)],
    "cartoon-characters": [(inst("Q15711870"), 8)],
    "video-games": [(inst("Q7889"), 15)],
    "game-consoles": [(tree("Q8076"), 10)],
    "movie-franchises": [(inst("Q24856"), 12)],
    "disney-pixar-movies": [
        ("?item wdt:P31 wd:Q11424 ; wdt:P272 ?studio . VALUES ?studio { wd:Q191224 wd:Q127552 }", 5)
    ],
    "instruments": [(tree("Q34379"), 15)],
    "singers": [(people("Q177220"), 35)],
    "actors": [(people("Q33999") + " ?item wdt:P21 wd:Q6581097 .", 35)],
    "actresses": [(people("Q33999") + " ?item wdt:P21 wd:Q6581072 .", 30)],
    "bands": [(inst("Q215380"), 20), (inst("Q5741069"), 15)],
    "us-cities": [(inst("Q1093829"), 40)],
    "european-cities": [("?item wdt:P31 wd:Q1549591 ; wdt:P17/wdt:P30 wd:Q46 .", 20)],
    "asian-cities": [("?item wdt:P31 wd:Q1549591 ; wdt:P17/wdt:P30 wd:Q48 .", 20)],
    "islands": [(inst("Q23442"), 20)],
    "lakes": [(inst("Q23397"), 15)],
    "rivers": [(inst("Q4022"), 20)],
    "mountains": [(inst("Q8502"), 15)],
    "currencies": [(inst("Q8142"), 10)],
    "fast-food": [(tree("Q1751429"), 5)],
    "italian-foods": [(dishes_from("Q38", "Q192786"), 3)],
    "chinese-foods": [(dishes_from("Q148", "Q27477249"), 3)],
    "indian-foods": [(dishes_from("Q668", "Q192087"), 3)],
    "french-foods": [(dishes_from("Q142", "Q6661"), 3)],
    "spanish-foods": [(dishes_from("Q29", "Q622512"), 3)],
    "american-foods": [(dishes_from("Q30", "Q1352460"), 4)],
    # Sources for open-ended categories that had none.
    "athletes": [("?item wdt:P31 wd:Q5 ; wdt:P106/wdt:P279* wd:Q2066131 .", 60)],
    # Famous people who died before 1960, one occupation at a time (a single
    # query over every person times out).
    "historical-figures": [
        (people("Q116") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # monarch
        (people("Q82955") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # politician
        (people("Q189290") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # military officer
        (people("Q11900058") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # explorer
        (people("Q901") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # scientist
        (people("Q4964182") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # philosopher
        (people("Q36180") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # writer
        (people("Q1423891") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # religious leader
        (people("Q205375") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # inventor
        (people("Q3242115") + " ?item wdt:P570 ?died . FILTER(YEAR(?died) < 1960)", 80),  # revolutionary
    ],
    "languages": [(inst("Q1288568"), 25)],
    "sandwiches": [(tree("Q28803"), 3)],
    "soups": [(tree("Q41415"), 3)],
}

QUERY = """
SELECT ?item ?label ?links ?sci (GROUP_CONCAT(DISTINCT ?alt; separator="\\u001f") AS ?alts) WHERE {{
  {pattern}
  ?item wikibase:sitelinks ?links .
  FILTER(?links >= {minimum})
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  OPTIONAL {{ ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }}
  OPTIONAL {{ ?item wdt:P225 ?sci }}
}}
GROUP BY ?item ?label ?links ?sci
"""

LATIN = re.compile(r"^[\w\s'’&+#.,!:/()\-–]+$")


def ssl_context() -> ssl.SSLContext:
    for var in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
        path = os.environ.get(var)
        if path and Path(path).exists():
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


def run(query: str) -> list[dict]:
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    req = urllib.request.Request(
        ENDPOINT, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/sparql-results+json"}
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90, context=ssl_context()) as resp:
                return json.load(resp)["results"]["bindings"]
        except Exception as err:  # noqa: BLE001 - retry anything, report the last one
            if attempt == 3:
                raise
            print(f"    retrying after {err}")
            time.sleep(5 * (attempt + 1))
    return []


def clean(name: str) -> str | None:
    name = re.sub(r"\s*\([^)]*\)\s*", " ", name).strip()  # drop "(dog)", "(cheese)"
    name = re.sub(r"\s+", " ", name)
    if not name or len(name) > 48 or re.fullmatch(r"Q\d+", name):
        return None
    plain = unicodedata.normalize("NFKD", name)
    plain = "".join(c for c in plain if not unicodedata.combining(c))
    if not LATIN.match(plain) or not re.search(r"[A-Za-z]", plain):
        return None
    return name


def fetch(cid: str) -> list[dict]:
    items: dict[str, dict] = {}
    for pattern, minimum in SOURCES[cid]:
        rows = run(QUERY.format(pattern=pattern, minimum=minimum))
        for b in rows:
            qid = b["item"]["value"].rsplit("/", 1)[-1]
            label = clean(b["label"]["value"])
            if not label:
                continue
            alts = [clean(a) for a in b.get("alts", {}).get("value", "").split("\u001f") if a]
            sci = clean(b["sci"]["value"]) if "sci" in b else None
            names = [n for n in [*alts, sci] if n and n.lower() != label.lower()]
            entry = items.setdefault(qid, {"name": label, "aliases": [], "links": int(b["links"]["value"])})
            entry["aliases"] = sorted(set(entry["aliases"]) | set(names), key=str.lower)
        time.sleep(1.5)
    out = sorted(items.values(), key=lambda e: (-e["links"], e["name"].lower()))
    return out


def main() -> None:
    wanted = sys.argv[1:] or list(SOURCES)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failed = []
    for cid in wanted:
        if cid not in SOURCES:
            sys.exit(f"Unknown category: {cid}")
        print(f"  {cid} ...", flush=True)
        try:
            items = fetch(cid)
        except Exception as err:  # noqa: BLE001 - keep going, report at the end
            print(f"  {cid}: FAILED ({err}). The previous file, if any, is kept.", flush=True)
            failed.append(cid)
            continue
        (OUT_DIR / f"{cid}.json").write_text(json.dumps(items, ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
        print(f"  {cid}: {len(items)} items", flush=True)
    if failed:
        sys.exit(f"Failed: {', '.join(failed)}. Run again for just those.")


if __name__ == "__main__":
    main()
