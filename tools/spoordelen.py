#!/usr/bin/env python3
"""Spoornet per provincie (en Duits regierungsbezirk, Frans departement ...) opdelen, zodat het spel alleen laadt
wat nodig is.

Invoer: data/spoor.json (hele net) en data/grenzen.json (provincies). Uitvoer:
  data/spoor/index.json   {"delen": [{"c": code, "n": naam, "l": land, "b": [x0, y0, x1, y1], "t": takken, "kb": grootte}]}
  data/spoor/<code>.json  zelfde opbouw als spoor.json, maar alleen de takken van dat gebied (met hun knopen).
Een tak hoort bij het gebied waarin zijn middelste punt ligt; takken buiten alle gebieden komen in 'X-<land>'.
De client voegt delen samen op knoopcoördinaat (grensknopen zitten in beide delen).
"""
import argparse, json, os, sys
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree


def ringen(rr):
    uit = []
    for r in rr:
        pts, x, y = [], 0, 0
        for i in range(0, len(r), 2):
            x = r[0] if i == 0 else x + r[i]
            y = r[1] if i == 0 else y + r[i + 1]
            pts.append((x, y))
        if len(pts) >= 3:
            uit.append(pts)
    return uit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spoor", default="data/spoor.json")
    ap.add_argument("--grenzen", default="data/grenzen.json")
    ap.add_argument("--uit", default="data/spoor")
    a = ap.parse_args()
    sp = json.load(open(a.spoor))
    gr = json.load(open(a.grenzen))
    land = gr.get("land", {})
    # provincies als polygonen (buiten- en binnenringen door elkaar: per ring een polygoon, even-odd benaderd met xor)
    delen, geoms = [], []
    for p in gr["p"]:
        code, naam, rr = p[0], p[1], p[2:]
        g = None
        for r in ringen(rr):
            pg = Polygon(r).buffer(0)
            g = pg if g is None else g.symmetric_difference(pg)
        if g is None or g.is_empty:
            continue
        delen.append({"c": code, "n": naam, "l": land.get(code, "NL")})
        geoms.append(g)
    boom = STRtree(geoms)
    kn = sp["knopen"]
    LANDEN = ["NL", "BE", "LU", "DE", "FR"]
    per = {}
    for t in sp["takken"]:
        a_, b_ = t[0], t[1]
        tussen = t[11] or []
        if tussen:
            # middelste tussenpunt (delta's vanaf knoop a)
            x, y = kn[a_ * 2], kn[a_ * 2 + 1]
            m = len(tussen) // 4 * 2
            for i in range(0, m + 2, 2):
                x += tussen[i]; y += tussen[i + 1]
        else:
            x = (kn[a_ * 2] + kn[b_ * 2]) / 2; y = (kn[a_ * 2 + 1] + kn[b_ * 2 + 1]) / 2
        pt = Point(x, y)
        code = None
        for i in boom.query(pt):
            if geoms[i].contains(pt):
                code = delen[i]["c"]; break
        if code is None:
            ln = t[13] if len(t) > 13 else 0
            code = "X-" + (LANDEN[ln] if isinstance(ln, int) and ln < len(LANDEN) else str(ln))
        per.setdefault(code, []).append(t)
    os.makedirs(a.uit, exist_ok=True)
    info = {d["c"]: d for d in delen}
    index = []
    for code, takken in sorted(per.items()):
        nieuw, kaart, kn2 = {}, [], []
        namen, naamMap = [], {}
        def knoop(i):
            if i not in nieuw:
                nieuw[i] = len(kn2) // 2; kn2.extend([kn[i * 2], kn[i * 2 + 1]])
            return nieuw[i]
        rijen = []
        x0 = y0 = 1e12; x1 = y1 = -1e12
        for t in takken:
            r = list(t)
            r[0], r[1] = knoop(t[0]), knoop(t[1])
            if t[10] is not None and t[10] >= 0:
                if t[10] not in naamMap:
                    naamMap[t[10]] = len(namen); namen.append(sp["namen"][t[10]])
                r[10] = naamMap[t[10]]
            rijen.append(r)
        for i in range(0, len(kn2), 2):
            x0 = min(x0, kn2[i]); x1 = max(x1, kn2[i]); y0 = min(y0, kn2[i + 1]); y1 = max(y1, kn2[i + 1])
        uit = {k: v for k, v in sp.items() if k not in ("knopen", "takken", "namen")}
        uit.update({"knopen": kn2, "namen": namen, "takken": rijen, "deel": code})
        pad = os.path.join(a.uit, code + ".json")
        with open(pad, "w") as fh:
            json.dump(uit, fh, separators=(",", ":"), ensure_ascii=False)
        d = info.get(code, {"c": code, "n": "Overig " + code[2:], "l": code[2:] if code.startswith("X-") else "NL"})
        index.append({**d, "b": [round(x0), round(y0), round(x1), round(y1)], "t": len(rijen), "kb": round(os.path.getsize(pad) / 1000)})
    # buren: gebieden die elkaar raken (binnen 1,5 km), voor 'grensprovincies meteen laden'
    geom = {d["c"]: g for d, g in zip(delen, geoms)}
    for d in index:
        g = geom.get(d["c"])
        d["n2"] = sorted(c for c, h in geom.items() if c != d["c"] and g is not None and h.distance(g) < 1500 and c in per) if g is not None else []
    with open(os.path.join(a.uit, "index.json"), "w") as fh:
        json.dump({"uitleg": "spoornet per provincie: c code, n naam, l land, b bbox (RD), t takken, kb grootte", "delen": index}, fh, separators=(",", ":"), ensure_ascii=False)
    tot = sum(d["kb"] for d in index)
    print(f"{len(index)} delen, {sum(d['t'] for d in index)} takken, {tot / 1000:.1f} MB", flush=True)
    for d in sorted(index, key=lambda d: -d["kb"])[:8]:
        print(f"  {d['l']}: {d['n']} {d['t']} takken {d['kb']} kB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
