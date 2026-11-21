#!/usr/bin/env python3
"""Autowegen uit OpenStreetMap (Overpass) in vakken van 10 x 10 km (RD), met per weg:
soort, aantal rijstroken, strookbreedte, stoep links/rechts, verhard/onverhard, brug/tunnel.

Gebruik:  python3 tools/wegen.py --gebied gooi|regio|nl [--uit data/wegen]
          python3 tools/wegen.py --rd x0,y0,x1,y1

Uitvoer:
  wegen/index.json     {"cel": 10000, "vakken": [[i, j, aantal], ...]}
  wegen/<i>_<j>.json   {"w": [[soort, stroken, breedte_dm, stoep, vlag, x0, y0, dx, dy, ...], ...]}

  soort  S snelweg  H hoofdweg (autoweg/provinciaal)  R regionale weg  L lokale weg/straat
         D dienstweg  B busbaan  O onverhard  F fietspad
  stoep  bit 1 = links, bit 2 = rechts (gezien in de tekenrichting)
  vlag   bit 1 = eenrichting, bit 2 = brug, bit 4 = tunnel, bit 8 = woonerf
"""
import argparse
import json
import math
import os
import sys
import time
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from rd import naar_rd  # noqa: E402
from osm import overpass, vereenvoudig  # noqa: E402

CEL = 10000
GEBIEDEN = {
    "gooi": (130000, 460000, 160000, 490000),
    "regio": (100000, 440000, 170000, 500000),
    "nl": (0, 300000, 280000, 620000),
}
K = [(0, 1, 3235.65389), (2, 0, -32.58297), (0, 2, -0.24750), (2, 1, -0.84978), (0, 3, -0.06550), (2, 2, -0.01709),
     (1, 0, -0.00738), (4, 0, 0.00530), (2, 3, -0.00039), (4, 1, 0.00033), (1, 1, -0.00012)]
L = [(1, 0, 5260.52916), (1, 1, 105.94684), (1, 2, 2.45656), (3, 0, -0.81885), (1, 3, 0.05594), (3, 1, -0.05607),
     (0, 1, 0.01199), (3, 2, -0.00256), (1, 4, 0.00128), (0, 2, 0.00022), (2, 0, -0.00022), (5, 0, 0.00026)]


def naar_wgs(x, y):
    dx, dy = (x - 155000) * 1e-5, (y - 463000) * 1e-5
    lat = 52.15517440 + sum(k * dx ** p * dy ** q for p, q, k in K) / 3600
    lon = 5.38720621 + sum(v * dx ** p * dy ** q for p, q, v in L) / 3600
    return lat, lon


WEGEN = ("motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|"
         "tertiary|tertiary_link|unclassified|residential|living_street|road|service|track|busway|bus_guideway")
ONVERHARD = {"unpaved", "gravel", "fine_gravel", "dirt", "earth", "ground", "grass", "sand", "compacted", "mud",
             "pebblestone", "woodchips", "shells", "grass_paver"}
SOORT = {"motorway": "S", "motorway_link": "S", "trunk": "H", "trunk_link": "H", "primary": "H", "primary_link": "H",
         "secondary": "R", "secondary_link": "R", "tertiary": "R", "tertiary_link": "R", "unclassified": "L",
         "residential": "L", "living_street": "L", "road": "L", "service": "D", "track": "O", "busway": "B",
         "bus_guideway": "B", "cycleway": "F"}
BREEDTE = {"S": 35, "H": 33, "R": 30, "L": 28, "D": 27, "B": 33, "O": 26, "F": 20}


def soort_van(t):
    hw = t.get("highway", "")
    s = SOORT.get(hw)
    if not s:
        return None
    if hw == "service" and t.get("service") in ("parking_aisle", "driveway", "drive-through", "emergency_access"):
        return None
    opp = t.get("surface", "")
    if s == "O":
        if opp and opp not in ONVERHARD:
            s = "L"
        elif not opp and t.get("tracktype") == "grade1":
            s = "L"
    elif opp in ONVERHARD and s not in ("S", "H", "F"):
        s = "O"
    return s


def getal(w, standaard):
    try:
        return max(1, min(8, int(float(str(w).split(";")[0]))))
    except (TypeError, ValueError):
        return standaard


def stroken(t, s, eenrichting):
    if "lanes" in t:
        return getal(t["lanes"], 2)
    if s == "S":
        return 2 if t.get("highway") == "motorway" else 1
    if s in ("H", "R"):
        return 1 if (eenrichting and t.get("highway", "").endswith("_link")) else (2 if not eenrichting or s == "H" else 1)
    if s == "L":
        return 1 if eenrichting else 2
    if s == "B":
        return 1 if eenrichting else 2
    return 1


def ja(v):
    return v in ("yes", "separate", "both", "sidepath")


def stoep_tags(t):
    """None = onbekend, anders bits (1 links, 2 rechts)."""
    sw = t.get("sidewalk")
    b = None
    if sw in ("both", "separate", "yes"):
        b = 3
    elif sw == "left":
        b = 1
    elif sw == "right":
        b = 2
    elif sw in ("no", "none"):
        b = 0
    if ja(t.get("sidewalk:both", "")):
        b = 3
    links, rechts = t.get("sidewalk:left"), t.get("sidewalk:right")
    if links or rechts:
        b = (1 if ja(links or "") else 0) | (2 if ja(rechts or "") else 0)
    return b


def snelheid(t):
    try:
        return int(str(t.get("maxspeed", "")).split()[0])
    except (ValueError, IndexError):
        return 0


def cel_ophalen(i, j, marge=150):
    x0, y0 = i * CEL - marge, j * CEL - marge
    x1, y1 = x0 + CEL + 2 * marge, y0 + CEL + 2 * marge
    hoeken = [naar_wgs(x0, y0), naar_wgs(x1, y0), naar_wgs(x0, y1), naar_wgs(x1, y1)]
    z, w = min(h[0] for h in hoeken), min(h[1] for h in hoeken)
    n, o = max(h[0] for h in hoeken), max(h[1] for h in hoeken)
    bb = f"{z:.5f},{w:.5f},{n:.5f},{o:.5f}"
    q = (f'[out:json][timeout:240];(way["highway"~"^({WEGEN})$"]({bb});'
         f'way["highway"="cycleway"]({bb});way["highway"="footway"]["footway"="sidewalk"]({bb});'
         f'way["highway"~"^(footway|path)$"]["bicycle"="designated"]({bb}););out tags geom;')
    return overpass(q)


def verwerk(i, j, res):
    wegen, stoepen = [], []
    for el in res.get("elements", []):
        if el.get("type") != "way" or "geometry" not in el:
            continue
        t = el.get("tags", {})
        pts = [naar_rd(g["lat"], g["lon"]) for g in el["geometry"]]
        if len(pts) < 2:
            continue
        if t.get("highway") == "footway" and t.get("footway") == "sidewalk":
            stoepen.append(pts)
            continue
        if t.get("highway") in ("footway", "path"):
            t = dict(t, highway="cycleway")
        s = soort_van(t)
        if not s:
            continue
        # elke weg hoort bij precies één vak: dat van zijn middelste punt
        mx, my = pts[len(pts) // 2]
        if (int(mx // CEL), int(my // CEL)) != (i, j):
            continue
        wegen.append((s, t, pts))

    # losse stoepen in een raster van 50 m om evenwijdige stoepen naast een weg te vinden
    raster = defaultdict(list)
    for pts in stoepen:
        for a in range(len(pts) - 1):
            (ax, ay), (bx, by) = pts[a], pts[a + 1]
            stap = max(1, int(math.hypot(bx - ax, by - ay) // 10))
            for k in range(stap + 1):
                px, py = ax + (bx - ax) * k / stap, ay + (by - ay) * k / stap
                raster[(int(px // 50), int(py // 50))].append((px, py))

    def zoek_stoep(pts):
        """Bemonster de weg en kijk of er links/rechts op 3-16 m een stoep loopt."""
        links = rechts = proef = 0
        for a in range(len(pts) - 1):
            (ax, ay), (bx, by) = pts[a], pts[a + 1]
            lengte = math.hypot(bx - ax, by - ay)
            if lengte < 1:
                continue
            ux, uy = (bx - ax) / lengte, (by - ay) / lengte
            for k in range(max(1, int(lengte // 20))):
                f = (k + 0.5) / max(1, int(lengte // 20))
                px, py = ax + (bx - ax) * f, ay + (by - ay) * f
                proef += 1
                l = r = False
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        for qx, qy in raster.get((int(px // 50) + dx, int(py // 50) + dy), ()):
                            vx, vy = qx - px, qy - py
                            langs = vx * ux + vy * uy
                            dwars = ux * vy - uy * vx
                            if abs(langs) < 12 and 3 < abs(dwars) < 16:
                                if dwars > 0:
                                    l = True
                                else:
                                    r = True
                links += l
                rechts += r
        if not proef:
            return 0
        return (1 if links / proef > 0.4 else 0) | (2 if rechts / proef > 0.4 else 0)

    uit = []
    for s, t, pts in wegen:
        hw = t.get("highway", "")
        eenr = t.get("oneway") in ("yes", "1", "true") or hw in ("motorway",) or t.get("junction") == "roundabout"
        if t.get("oneway") == "-1":
            pts = pts[::-1]
            eenr = True
        b = stroken(t, s, eenr)
        br = BREEDTE[s]
        if hw == "living_street":
            br = 25
        if s == "F":
            b, br = 1, (35 if t.get("oneway") != "yes" else 22)
        try:
            breedte = float(str(t.get("width", "")).replace(",", ".").split()[0])
            if 2 < breedte < 40 and s != "S":
                br = max(20, min(40, int(breedte * 10 / b)))
        except (ValueError, IndexError):
            pass
        st = None if s in ("S", "F", "O") else stoep_tags(t)
        if s in ("S", "F", "O"):
            st = 0
        if st is None:
            st = zoek_stoep(pts)
            mx, my = pts[len(pts) // 2]
            buurt = any(raster.get((int(mx // 50) + dx, int(my // 50) + dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
            if st == 0 and not buurt:
                # hier zijn geen losse stoepen ingetekend: schat op type en snelheid
                v = snelheid(t)
                if hw == "residential" or (s in ("R", "L") and 0 < v <= 50) or (s == "H" and 0 < v <= 50):
                    st = 3
        vlag = (1 if eenr else 0) | (2 if t.get("bridge") not in (None, "no") else 0) \
            | (4 if t.get("tunnel") not in (None, "no", "building_passage") else 0) | (8 if hw == "living_street" else 0)
        p = vereenvoudig(pts, 1.0)
        rij = [s, b, br, st, vlag]
        vx, vy = 0, 0
        for x, y in p:
            xi, yi = int(round(x)), int(round(y))
            rij += [xi - vx, yi - vy]
            vx, vy = xi, yi
        uit.append(rij)
    return uit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gebied", default="gooi", choices=sorted(GEBIEDEN))
    ap.add_argument("--rd", default="", help="x0,y0,x1,y1 in RD-meters")
    ap.add_argument("--uit", default="data/wegen")
    ap.add_argument("--pauze", type=float, default=2)
    ap.add_argument("--max-minuten", type=float, default=0, help="stop netjes na zoveel minuten (CI)")
    a = ap.parse_args()
    x0, y0, x1, y1 = [int(v) for v in a.rd.split(",")] if a.rd else GEBIEDEN[a.gebied]
    os.makedirs(a.uit, exist_ok=True)
    idx_pad = os.path.join(a.uit, "index.json")
    index = {}
    if os.path.exists(idx_pad):
        for i, j, n in json.load(open(idx_pad))["vakken"]:
            index[(i, j)] = n
    vakken = [(i, j) for j in range(y1 // CEL - 1, y0 // CEL - 1, -1) for i in range(x0 // CEL, x1 // CEL)]
    # vanaf 't Gooi naar buiten werken
    vakken.sort(key=lambda v: math.hypot(v[0] * CEL + 5000 - 140000, v[1] * CEL + 5000 - 472000))
    begin = time.time()
    for nr, (i, j) in enumerate(vakken, 1):
        if a.max_minuten and time.time() - begin > a.max_minuten * 60:
            print("  tijd op, de rest volgt bij de volgende run", flush=True)
            break
        pad = os.path.join(a.uit, f"{i}_{j}.json")
        if (i, j) in index and os.path.exists(pad):
            continue
        res = cel_ophalen(i, j)
        rijen = verwerk(i, j, res)
        del res
        if rijen:
            with open(pad, "w") as f:
                json.dump({"w": rijen}, f, separators=(",", ":"))
            index[(i, j)] = len(rijen)
        else:
            index[(i, j)] = 0
        print(f"  vak {nr}/{len(vakken)} {i}_{j}: {len(rijen)} wegen ({os.path.getsize(pad) / 1e6 if rijen else 0:.2f} MB)", flush=True)
        with open(idx_pad, "w") as f:
            json.dump({"cel": CEL, "vakken": [[i, j, n] for (i, j), n in sorted(index.items())]}, f, separators=(",", ":"))
        time.sleep(a.pauze)


if __name__ == "__main__":
    main()
