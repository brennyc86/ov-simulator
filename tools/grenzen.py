#!/usr/bin/env python3
"""Gemeente- en provinciegrenzen (CBS gebiedsindelingen via PDOK, gegeneraliseerd) naar data/grenzen.json.

Uitvoer (RD, hele meters, ringen als delta's):
  {"jaar": 2025, "p": [[code, naam, ring, ring, ...], ...],
                 "g": [[code, naam, provincie-index, ring, ...], ...]}
  ring = [x0, y0, dx, dy, dx, dy, ...]  (buiten- en binnenringen door elkaar; even-odd vullen)
Elke gemeente hoort bij de provincie waarin haar labelpunt ligt.
"""
import argparse, json, math, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rd import naar_rd

API = "https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1/collections/{c}/items?f=json&limit=1000&jaarcode={j}&crs=http://www.opengis.net/def/crs/EPSG/0/28992"


def haal(c, j):
    req = urllib.request.Request(API.format(c=c, j=j), headers={"User-Agent": "ov-simulator-datapijplijn"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)["features"]


def dp(pts, tol):
    """Douglas-Peucker (iteratief) op [(x, y), ...]"""
    if len(pts) < 4:
        return pts
    houd = [False] * len(pts)
    houd[0] = houd[-1] = True
    stapel = [(0, len(pts) - 1)]
    while stapel:
        a, b = stapel.pop()
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        l = math.hypot(dx, dy) or 1e-9
        best, bi = -1, -1
        for i in range(a + 1, b):
            d = abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / l if (dx or dy) else math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            if d > best:
                best, bi = d, i
        if best > tol:
            houd[bi] = True
            stapel += [(a, bi), (bi, b)]
    return [p for p, h in zip(pts, houd) if h]


def ringen(geom, tol):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    uit = []
    for poly in polys:
        for ring in poly:
            r = dp([(round(x), round(y)) for x, y in ring], tol)
            if len(r) < 4:
                continue
            v = [r[0][0], r[0][1]]
            for (px, py), (x, y) in zip(r, r[1:]):
                if (x, y) != (px, py):
                    v += [x - px, y - py]
            uit.append(v)
    return uit


def binnen(x, y, geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    n = 0
    for poly in polys:
        for ring in poly:
            for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
                if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                    n += 1
    return n % 2 == 1


# België en Luxemburg: geoBoundaries (open, vereenvoudigd, WGS84) omgezet naar RD.
# België: provincies (ADM2, met Brussel) en gemeenten (ADM4); Luxemburg: kantons (ADM1) en gemeenten (ADM2).
GB = "https://www.geoboundaries.org/api/current/gbOpen/{c}/"
# Duitsland: deelstaten (ADM1) en regierungsbezirke (ADM2, als 'gemeente'); Frankrijk: regio's (ADM1) en departementen (ADM2).
# (land, provincies, gemeenten, tolerantie provincie, tolerantie gemeente in meters)
BUITENLAND = [("BE", "BEL/ADM2", "BEL/ADM4", 25, 15), ("LU", "LUX/ADM1", "LUX/ADM2", 25, 15),
              ("DE", "DEU/ADM1", "DEU/ADM2", 300, 200), ("FR", "FRA/ADM1", "FRA/ADM2", 300, 200)]
NAAM = {"Brussels": "Brussel", "Limburg": "Limburg (BE)", "Luxemburg": "Luxemburg (BE)"}


def haal_gb(c):
    req = urllib.request.Request(GB.format(c=c), headers={"User-Agent": "ov-simulator-datapijplijn"})
    with urllib.request.urlopen(req, timeout=60) as r:
        url = json.load(r)["simplifiedGeometryGeoJSON"]
    req = urllib.request.Request(url, headers={"User-Agent": "ov-simulator-datapijplijn"})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)["features"]


def naar_rd_geom(g):
    conv = lambda ring: [list(naar_rd(la, lo)) for lo, la, *_ in ring]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    return {"type": "MultiPolygon", "coordinates": [[conv(r) for r in poly] for poly in polys]}


def eerste_punt(g):
    c = g["coordinates"]
    while isinstance(c[0], list):
        c = c[0]
    return c


def binnenpunt(g):
    """punt binnen de (grootste) polygoon: zwaartepunt, anders een punt op een horizontale doorsnede"""
    poly = max(g["coordinates"], key=lambda p: len(p[0]))
    ring = poly[0]
    a = cx = cy = 0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        k = x1 * y2 - x2 * y1; a += k; cx += (x1 + x2) * k; cy += (y1 + y2) * k
    if a:
        x, y = cx / (3 * a), cy / (3 * a)
        if binnen(x, y, {"type": "Polygon", "coordinates": poly}):
            return x, y
    ys = sorted(p[1] for p in ring); y = (ys[0] + ys[-1]) / 2
    xs = sorted(x1 + (y - y1) * (x2 - x1) / (y2 - y1) for (x1, y1), (x2, y2) in zip(ring, ring[1:]) if (y1 > y) != (y2 > y))
    return ((xs[0] + xs[1]) / 2 if len(xs) >= 2 else ring[0][0]), y


def buitenland(P, G, land):
    for code, cp, cg, tp, tg in BUITENLAND:
        try:
            prov, gem = haal_gb(cp), haal_gb(cg)
        except Exception as e:
            print(f"  {code}: ophalen mislukt ({e}), overgeslagen", file=sys.stderr)
            continue
        # alleen Europees grondgebied (Frankrijk heeft overzeese regio's; daar geldt RD niet)
        europees = lambda f: (lambda c: 41 < c[1] < 56 and -6 < c[0] < 16)(eerste_punt(f["geometry"]))
        prov = [f for f in prov if europees(f)]; gem = [f for f in gem if europees(f)]
        prov.sort(key=lambda f: f["properties"]["shapeName"])
        start = len(P)
        geoms = []
        for i, f in enumerate(prov):
            g = naar_rd_geom(f["geometry"]); geoms.append(g)
            naam = f["properties"]["shapeName"]
            naam = NAAM.get(naam, naam).replace("Canton ", "Kanton ")
            pc = f["properties"].get("shapeISO") or f"{code}-P{i}"
            P.append([pc, naam, *ringen(g, tp)]); land[pc] = code
        n = 0
        for f in sorted(gem, key=lambda f: f["properties"]["shapeName"]):
            g = naar_rd_geom(f["geometry"]); x, y = binnenpunt(g)
            pi = next((start + i for i, pg in enumerate(geoms) if binnen(x, y, pg)), -1)
            G.append([f"{code}-{f['properties']['shapeID'][:10]}", f["properties"]["shapeName"], pi, *ringen(g, tg)]); n += 1
        print(f"  {code}: {len(prov)} provincies/kantons, {n} gemeenten", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jaar", type=int, default=2025)
    ap.add_argument("--uit", default="data")
    a = ap.parse_args()
    prov = haal("provincie_gegeneraliseerd", a.jaar)
    gem = haal("gemeente_gegeneraliseerd", a.jaar)
    lab = {f["properties"]["statcode"]: f["geometry"]["coordinates"] for f in haal("gemeente_labelpoint", a.jaar)}
    print(f"{len(prov)} provincies, {len(gem)} gemeenten, {len(lab)} labelpunten", flush=True)
    if len(prov) < 12 or len(gem) < 300:
        print("te weinig gebieden, gestopt", file=sys.stderr)
        return 1
    prov.sort(key=lambda f: f["properties"]["statnaam"])
    P = [[f["properties"]["statcode"], f["properties"]["statnaam"], *ringen(f["geometry"], 25)] for f in prov]
    G = []
    for f in sorted(gem, key=lambda f: f["properties"]["statnaam"]):
        pr = f["properties"]
        g = f["geometry"]
        x, y = lab.get(pr["statcode"]) or (g["coordinates"][0][0][0] if g["type"] == "MultiPolygon" else g["coordinates"][0][0])
        pi = next((i for i, p in enumerate(prov) if binnen(x, y, p["geometry"])), -1)
        if pi < 0:
            print("  geen provincie voor", pr["statnaam"], file=sys.stderr)
        G.append([pr["statcode"], pr["statnaam"], pi, *ringen(f["geometry"], 15)])
    land = {}
    buitenland(P, G, land)
    os.makedirs(a.uit, exist_ok=True)
    pad = os.path.join(a.uit, "grenzen.json")
    with open(pad, "w") as fh:
        json.dump({"jaar": a.jaar, "bron": "CBS gebiedsindelingen (PDOK); België, Luxemburg, Duitsland en Frankrijk: geoBoundaries (gbOpen)", "landen": {"NL": "Nederland", "BE": "België", "LU": "Luxemburg", "DE": "Duitsland", "FR": "Frankrijk"},
                   "land": land, "p": P, "g": G}, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"→ {pad} ({os.path.getsize(pad) / 1e3:.0f} kB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
