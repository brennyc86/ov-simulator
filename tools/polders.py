#!/usr/bin/env python3
"""Land dat er vroeger nog niet was: polders met hun jaar van drooglegging (vóór dat jaar = water).

Gebruik:  python3 tools/polders.py [--uit data]
Uitvoer polders.json: {"p": [{"n": naam, "j": jaar, "r": [[x0, y0, dx, dy, ...], ...]}]}

De polders worden benaderd met gemeentegrenzen uit OpenStreetMap (Urk, ooit een eiland, valt erbuiten).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from osm import overpass, vereenvoudig, rd_int, schrijf  # noqa: E402

POLDERS = [  # (naam in OSM, admin_level, jaar droog, weergavenaam)
    ("Noordoostpolder", "8", 1942, "Noordoostpolder"),
    ("Dronten", "8", 1957, "Oostelijk Flevoland"),
    ("Lelystad", "8", 1957, "Oostelijk Flevoland"),
    ("Almere", "8", 1968, "Zuidelijk Flevoland"),
    ("Zeewolde", "8", 1968, "Zuidelijk Flevoland"),
    ("Haarlemmermeer", "8", 1852, "Haarlemmermeer"),
]


def ringen(rel):
    """Buitenste ringen van een multipolygoon aan elkaar knopen."""
    stukken = [[(round(g["lat"], 6), round(g["lon"], 6)) for g in m["geometry"]]
               for m in rel.get("members", []) if m.get("type") == "way" and m.get("role") in ("outer", "") and m.get("geometry")]
    uit = []
    while stukken:
        ring = stukken.pop(0)
        veranderd = True
        while ring[0] != ring[-1] and veranderd:
            veranderd = False
            for i, s in enumerate(stukken):
                if s[0] == ring[-1]:
                    ring += s[1:]
                elif s[-1] == ring[-1]:
                    ring += s[::-1][1:]
                elif s[-1] == ring[0]:
                    ring = s[:-1] + ring
                elif s[0] == ring[0]:
                    ring = s[::-1][:-1] + ring
                else:
                    continue
                stukken.pop(i)
                veranderd = True
                break
        if len(ring) > 3:
            uit.append(ring)
    return uit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uit", default="data")
    a = ap.parse_args()
    namen = "|".join(n for n, *_ in POLDERS)
    q = (f'[out:json][timeout:300];relation["boundary"="administrative"]["admin_level"="8"]["name"~"^({namen})$"]'
         f'(51.5,3.5,53.5,6.5);out geom;')
    res = overpass(q)
    lijst = []
    for rel in res.get("elements", []):
        naam = rel.get("tags", {}).get("name")
        p = next((x for x in POLDERS if x[0] == naam), None)
        if not p:
            continue
        rs = []
        for ring in ringen(rel):
            pts = vereenvoudig([rd_int(la, lo) for la, lo in ring], 40)
            rij, vx, vy = [], 0, 0
            for x, y in pts:
                rij += [x - vx, y - vy]
                vx, vy = x, y
            rs.append(rij)
        lijst.append({"n": p[3], "g": naam, "j": p[2], "r": rs})
        print(f"  {naam}: {len(rs)} ring(en), droog in {p[2]}", flush=True)
    # de Wieringermeer (1930) is geen gemeente meer: benadering met de oude dijkring
    wm = [(52.9195, 4.9745), (52.9230, 5.0420), (52.8980, 5.1040), (52.8560, 5.1450), (52.8120, 5.1510),
          (52.7830, 5.1110), (52.7880, 5.0310), (52.8240, 4.9880), (52.8790, 4.9690), (52.9195, 4.9745)]
    pts = [rd_int(la, lo) for la, lo in wm]
    rij, vx, vy = [], 0, 0
    for x, y in pts:
        rij += [x - vx, y - vy]
        vx, vy = x, y
    lijst.append({"n": "Wieringermeer", "g": "", "j": 1930, "r": [rij]})
    schrijf(a.uit, "polders.json", {"uitleg": "voor jaar j is dit water; ringen in RD, delta-gecodeerd", "p": lijst})


if __name__ == "__main__":
    main()
