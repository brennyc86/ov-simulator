#!/usr/bin/env python3
"""Bebouwing door de tijd uit de BAG (bouwjaar van elk pand).

Leest bag-light.gpkg (PDOK) en maakt een raster van 100 m: per cel het jaar waarin die echt bebouwd raakte
(het jaar waarin 30% van de huidige panden er stond, minimaal 3 panden) afgerond op 5 jaar, en de
belangrijkste functie (wonen, winkels, bedrijven, voorzieningen) uit de gebruiksdoelen van de verblijfsobjecten.
Uitvoer bebouwing.json: per rij (y) reeksen cellen met hetzelfde jaar en dezelfde functie.
Gesloopte panden staan niet meer in de BAG; oude wijken die zijn afgebroken ontbreken dus.
"""
import argparse, json, math, os, sqlite3, sys
from collections import defaultdict

CEL = 100
FUNCTIES = ["wonen", "winkels", "bedrijven", "voorzieningen"]
DOEL = {  # gebruiksdoel -> functie-index
    "woonfunctie": 0, "logiesfunctie": 0,
    "winkelfunctie": 1,
    "industriefunctie": 2, "kantoorfunctie": 2, "overige gebruiksfunctie": 2,
    "onderwijsfunctie": 3, "gezondheidszorgfunctie": 3, "sportfunctie": 3, "bijeenkomstfunctie": 3, "celfunctie": 3,
}


def kolommen(db, tabel):
    return [r[1] for r in db.execute(f'PRAGMA table_info("{tabel}")')]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gpkg", required=True)
    ap.add_argument("--uit", default="data")
    a = ap.parse_args()
    db = sqlite3.connect(a.gpkg)
    tabellen = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    print("tabellen:", [t for t in tabellen if not t.startswith(("gpkg", "rtree_"))], flush=True)
    pand = next(t for t in tabellen if t.lower() == "pand")
    pk = kolommen(db, pand)
    print("pand-kolommen:", pk, flush=True)
    rtree = next(t for t in tabellen if t.lower().startswith("rtree_pand"))
    fid = "fid" if "fid" in pk else pk[0]
    status = "status" if "status" in pk else None
    ident = next((c for c in pk if c.lower() in ("identificatie", "pand_identificatie")), None)

    # functie per pand uit de verblijfsobjecten (als die tabel er is)
    functie = {}
    vbo = next((t for t in tabellen if t.lower() == "verblijfsobject"), None)
    if vbo and ident:
        vk = kolommen(db, vbo)
        print("verblijfsobject-kolommen:", vk, flush=True)
        pkol = next((c for c in vk if "pand" in c.lower() and "ident" in c.lower()), None)
        dkol = next((c for c in vk if "gebruiksdoel" in c.lower()), None)
        if pkol and dkol:
            tel = defaultdict(lambda: [0, 0, 0, 0])
            for p, d in db.execute(f'SELECT "{pkol}", "{dkol}" FROM "{vbo}"'):
                if not p or not d:
                    continue
                for doel in str(d).lower().split(","):
                    f = DOEL.get(doel.strip())
                    if f is not None:
                        for pi in str(p).split(","):
                            tel[pi.strip()][f] += 1
            for p, t in tel.items():
                functie[p] = max(range(4), key=lambda i: t[i])
            print(f"  functie bekend voor {len(functie)} panden", flush=True)

    cellen = defaultdict(list)  # (i, j) -> [(jaar, functie)]
    q = f'SELECT p."bouwjaar", (r.minx + r.maxx) / 2, (r.miny + r.maxy) / 2' + (f', p."{status}"' if status else ", ''") + (f', p."{ident}"' if ident else ", ''") + \
        f' FROM "{pand}" p JOIN "{rtree}" r ON p."{fid}" = r.id'
    n = 0
    for bj, x, y, st, pid in db.execute(q):
        n += 1
        if st and ("gesloopt" in str(st).lower() or "niet gerealiseerd" in str(st).lower() or "bouwvergunning" in str(st).lower()):
            continue
        try:
            bj = int(bj)
        except (TypeError, ValueError):
            continue
        if bj < 1000 or bj > 2100:
            continue
        if x < 1000:  # coördinaten in graden? dan is de gpkg niet in RD
            print("onverwacht coördinatenstelsel", x, y, file=sys.stderr)
            return 1
        cellen[(int(x // CEL), int(y // CEL))].append((max(1800, bj), functie.get(str(pid), 0)))
        if n % 2000000 == 0:
            print(f"  {n} panden…", flush=True)
    print(f"{n} panden, {len(cellen)} cellen met panden", flush=True)

    rijen = defaultdict(list)
    for (i, j), lijst in cellen.items():
        if len(lijst) < 3:
            continue  # losse boerderij of schuur: geen bebouwde kom
        lijst.sort()
        k = max(2, math.ceil(0.3 * len(lijst))) - 1
        jaar = int(lijst[min(k, len(lijst) - 1)][0] // 5 * 5)
        tel = [0, 0, 0, 0]
        for _, f in lijst:
            tel[f] += 1
        f = max(range(4), key=lambda q2: tel[q2])
        rijen[j].append((i, jaar, f))
    uit, cellenTotaal = [], 0
    for j in sorted(rijen):
        cel = sorted(rijen[j])
        reeks = []
        for i, jaar, f in cel:
            if reeks and reeks[-1][0] + reeks[-1][1] == i and reeks[-1][2] == jaar and reeks[-1][3] == f:
                reeks[-1][1] += 1
            else:
                reeks.append([i, 1, jaar, f])
            cellenTotaal += 1
        uit.append([j] + [v for r in reeks for v in r])
    os.makedirs(a.uit, exist_ok=True)
    pad = os.path.join(a.uit, "bebouwing.json")
    with open(pad, "w") as fh:
        json.dump({"uitleg": "per rij: [j, i0, aantal, jaar, functie, ...]; cel = 100 m (RD, i = x//100, j = y//100); jaar = bebouwd vanaf (per 5 jaar)",
                   "cel": CEL, "functies": FUNCTIES, "r": uit}, fh, separators=(",", ":"))
    print(f"{cellenTotaal} bebouwde cellen → {pad} ({os.path.getsize(pad) / 1e6:.1f} MB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
