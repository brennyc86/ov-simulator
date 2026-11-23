#!/usr/bin/env python3
"""Gemeente- en provinciegrenzen (CBS gebiedsindelingen via PDOK, gegeneraliseerd) naar data/grenzen.json.

Uitvoer (RD, hele meters, ringen als delta's):
  {"jaar": 2025, "p": [[code, naam, ring, ring, ...], ...],
                 "g": [[code, naam, provincie-index, ring, ...], ...]}
  ring = [x0, y0, dx, dy, dx, dy, ...]  (buiten- en binnenringen door elkaar; even-odd vullen)
Elke gemeente hoort bij de provincie waarin haar labelpunt ligt.
"""
import argparse, json, math, os, sys, urllib.request

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
    os.makedirs(a.uit, exist_ok=True)
    pad = os.path.join(a.uit, "grenzen.json")
    with open(pad, "w") as fh:
        json.dump({"jaar": a.jaar, "bron": "CBS gebiedsindelingen (PDOK), gegeneraliseerd", "p": P, "g": G}, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"→ {pad} ({os.path.getsize(pad) / 1e3:.0f} kB)", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
