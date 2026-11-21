#!/usr/bin/env python3
"""Verdwenen spoor- en tramlijnen (en hun haltes) uit OpenHistoricalMap, met openings- en sluitingsjaar.

Gebruik:  python3 tools/ohm.py [--uit data]

Uitvoer historisch.json:
  l: [[soort, start, eind, naamIdx, x0, y0, dx, dy, ...], ...]   soort: tram|rail|smal|light_rail|subway
  s: [[naamIdx, x, y, start, eind, soort], ...]                    stations en tramhaltes
  n: [namen]
Alleen wat een einddatum heeft (wat nu nog bestaat komt uit OpenStreetMap).
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
from osm import vereenvoudig, rd_int, in_nl, schrijf  # noqa: E402

OHM = "https://overpass-api.openhistoricalmap.org/api/interpreter"
UA = "ov-simulator-datapijplijn (github.com/brennyc86/ov-simulator)"
BBOX = "50.7,3.3,53.6,7.25"
SOORT = {"tram": "tram", "rail": "rail", "narrow_gauge": "smal", "light_rail": "light_rail", "subway": "subway",
         "abandoned": "rail", "disused": "rail", "razed": "rail"}


def vraag(q, pogingen=6):
    data = urllib.parse.urlencode({"data": q}).encode()
    for i in range(pogingen):
        try:
            req = urllib.request.Request(OHM, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=900) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            print(f"  OHM faalde ({e}), opnieuw over {30 * (i + 1)} s", flush=True)
            time.sleep(30 * (i + 1))
    raise SystemExit("OpenHistoricalMap bleef falen")


def jaar(v):
    m = re.match(r"\s*(-?\d{3,4})", str(v or ""))
    return int(m.group(1)) if m else 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--uit", default="data")
    a = ap.parse_args()
    q = (f'[out:json][timeout:800];(way["railway"~"^(tram|rail|narrow_gauge|light_rail|subway)$"]["end_date"]({BBOX});'
         f'node["railway"~"^(station|halt|tram_stop)$"]["end_date"]({BBOX}););out tags geom;')
    res = vraag(q)
    namen, idx = [], {}

    def naam(n):
        if not n:
            return -1
        if n not in idx:
            idx[n] = len(namen)
            namen.append(n)
        return idx[n]

    lijnen, stations = [], []
    for el in res.get("elements", []):
        t = el.get("tags", {})
        eind, start = jaar(t.get("end_date")), jaar(t.get("start_date"))
        if not eind or eind < 1800:
            continue
        if el["type"] == "way" and "geometry" in el:
            pts = [rd_int(g["lat"], g["lon"]) for g in el["geometry"] if g]
            if len(pts) < 2 or not any(in_nl(x, y) for x, y in pts[:: max(1, len(pts) // 4)]):
                continue
            pts = vereenvoudig(pts, 3)
            rij = [SOORT.get(t.get("railway"), "rail"), start, eind, naam(t.get("name") or t.get("operator"))]
            vx = vy = 0
            for x, y in pts:
                rij += [x - vx, y - vy]
                vx, vy = x, y
            lijnen.append(rij)
        elif el["type"] == "node":
            x, y = rd_int(el["lat"], el["lon"])
            if in_nl(x, y) and t.get("name"):
                stations.append([naam(t["name"]), x, y, start, eind, "tram" if t.get("railway") == "tram_stop" or t.get("tram") == "yes" else "trein"])
    soorten = {}
    for r in lijnen:
        soorten[r[0]] = soorten.get(r[0], 0) + 1
    print(f"  {len(lijnen)} verdwenen lijnstukken {soorten}, {len(stations)} haltes", flush=True)
    os.makedirs(a.uit, exist_ok=True)
    schrijf(a.uit, "historisch.json", {"bron": "OpenHistoricalMap (CC0)", "l": lijnen, "s": stations, "n": namen})


if __name__ == "__main__":
    main()
