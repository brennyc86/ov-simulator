#!/usr/bin/env python3
"""Zet de landelijke GTFS-dienstregeling (gtfs.ovapi.nl) om naar compacte bestanden per
vervoerder: lijnen, haltevolgorde, rijtijden, vertrektijden en de route over de weg/het spoor.

Gebruik:
  python3 tools/gtfs.py --zip gtfs-nl.zip --uit data
  python3 tools/gtfs.py --url https://gtfs.ovapi.nl/nl/gtfs-nl.zip --uit data --max-rijen 400000   (test zonder download)

Uitvoer:
  vervoerders.json        alle vervoerders met modi en aantal lijnen
  haltes.json             alle gebruikte haltes/stations (samengevoegd per halte-gebied)
  lijnen/<vervoerder>.json
"""
import argparse
import csv
import datetime as dt
import io
import json
import math
import os
import re
import statistics
import sys
import urllib.request
import zipfile
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from rd import naar_rd  # noqa: E402
from osm import vereenvoudig  # noqa: E402

UA = "ov-simulator-datapijplijn (github.com/brennyc86/ov-simulator)"


def modus(route_type):
    t = int(route_type)
    if t in (0,) or 900 <= t <= 906:
        return "tram"
    if t in (1,) or 400 <= t <= 404:
        return "metro"
    if t in (2,) or 100 <= t <= 117:
        return "trein"
    if t == 715 or t == 1501:
        return "belbus"
    if t in (3,) or 700 <= t <= 716 or t == 200:
        return "bus"
    if t in (4, 1000, 1200):
        return "veer"
    return "overig"


class HttpBestand(io.RawIOBase):
    """Leest een bestand op afstand met HTTP Range-verzoeken, zodat zipfile er
    losse bestanden uit kan halen zonder de hele zip te downloaden."""

    def __init__(self, url):
        self.url, self.pos = url, 0
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
        with urllib.request.urlopen(req) as r:
            self.lengte = int(r.headers["Content-Length"])
        self.buf_start, self.buf = -1, b""

    def seekable(self):
        return True

    def readable(self):
        return True

    def seek(self, off, whence=0):
        self.pos = {0: off, 1: self.pos + off, 2: self.lengte + off}[whence]
        return self.pos

    def tell(self):
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.lengte - self.pos
        if n == 0 or self.pos >= self.lengte:
            return b""
        if not (self.buf_start <= self.pos and self.pos + n <= self.buf_start + len(self.buf)):
            blok = max(n, 1 << 20)
            eind = min(self.lengte, self.pos + blok) - 1
            req = urllib.request.Request(self.url, headers={"User-Agent": UA,
                                                             "Range": f"bytes={self.pos}-{eind}"})
            with urllib.request.urlopen(req) as r:
                self.buf = r.read()
            self.buf_start = self.pos
        s = self.pos - self.buf_start
        data = self.buf[s:s + n]
        self.pos += len(data)
        return data

    def readinto(self, b):
        d = self.read(len(b))
        b[:len(d)] = d
        return len(d)


def lees(zf, naam, max_rijen=None):
    with zf.open(naam) as f:
        tekst = io.TextIOWrapper(f, encoding="utf-8-sig", newline="")
        for i, rij in enumerate(csv.DictReader(tekst)):
            if max_rijen and i >= max_rijen:
                break
            yield rij


def tijd_sec(t):
    if not t:
        return None
    h, m, s = t.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


def kies_dag(zf):
    """Kies een gewone dinsdag/woensdag/donderdag met de meeste actieve diensten."""
    per_dag = defaultdict(set)
    for r in lees(zf, "calendar_dates.txt"):
        if r["exception_type"] == "1":
            per_dag[r["date"]].add(r["service_id"])
    if "calendar.txt" in zf.namelist():
        dagen = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for r in lees(zf, "calendar.txt"):
            d0 = dt.datetime.strptime(r["start_date"], "%Y%m%d").date()
            d1 = dt.datetime.strptime(r["end_date"], "%Y%m%d").date()
            d = d0
            while d <= d1 and (d - d0).days < 60:
                if r[dagen[d.weekday()]] == "1":
                    per_dag[d.strftime("%Y%m%d")].add(r["service_id"])
                d += dt.timedelta(days=1)
    kandidaten = [(len(s), d) for d, s in per_dag.items()
                  if dt.datetime.strptime(d, "%Y%m%d").weekday() in (1, 2, 3)]
    kandidaten.sort(reverse=True)
    dag = kandidaten[0][1]
    print(f"  dienstregeling van {dag} ({kandidaten[0][0]} diensten)", flush=True)
    return dag, per_dag[dag]


def langs_lijn(pts, haltes_xy):
    """Afstand (m) langs de lijn voor elke halte, oplopend gezocht."""
    cum = [0.0]
    for p, q in zip(pts, pts[1:]):
        cum.append(cum[-1] + math.hypot(q[0] - p[0], q[1] - p[1]))
    uit, start = [], 0
    for hx, hy in haltes_xy:
        best, best_d = start, 1e18
        best_km = cum[start]
        for i in range(start, len(pts) - 1):
            ax, ay = pts[i]
            bx, by = pts[i + 1]
            dx, dy = bx - ax, by - ay
            l2 = dx * dx + dy * dy or 1e-9
            f = max(0.0, min(1.0, ((hx - ax) * dx + (hy - ay) * dy) / l2))
            px, py = ax + dx * f, ay + dy * f
            d = math.hypot(hx - px, hy - py)
            if d < best_d:
                best_d, best, best_km = d, i, cum[i] + f * math.sqrt(l2)
            if best_d < 30 and cum[i] - best_km > 3000:
                break
        uit.append(int(best_km))
        start = best
    return uit


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip")
    ap.add_argument("--url")
    ap.add_argument("--uit", default="data")
    ap.add_argument("--max-rijen", type=int, default=0)
    ap.add_argument("--toevoegen", action="store_true", help="bij bestaande haltes.json/vervoerders.json in --uit voegen (meerdere bronnen)")
    ap.add_argument("--land", default="", help="landcode voor de vervoerders (bv. BE, LU); wordt voor de id gezet")
    a = ap.parse_args()
    bron = open(a.zip, "rb") if a.zip else io.BufferedReader(HttpBestand(a.url), 1 << 20)
    zf = zipfile.ZipFile(bron)
    maxr = a.max_rijen or None
    os.makedirs(os.path.join(a.uit, "lijnen"), exist_ok=True)

    agencies = {r["agency_id"]: r for r in lees(zf, "agency.txt")}
    routes = {r["route_id"]: r for r in lees(zf, "routes.txt")}
    dag, diensten = kies_dag(zf)

    trips = {}
    for r in lees(zf, "trips.txt"):
        if r["service_id"] in diensten and r["route_id"] in routes:
            trips[r["trip_id"]] = (r["route_id"], r.get("direction_id", "0") or "0",
                                   r.get("shape_id", ""), r.get("trip_headsign", ""))
    print(f"  {len(trips)} ritten op die dag", flush=True)

    stops = {}
    for r in lees(zf, "stops.txt"):
        stops[r["stop_id"]] = r

    def halte_sleutel(sid):
        s = stops.get(sid)
        if not s:
            return sid
        return s.get("parent_station") or sid

    ritten = defaultdict(list)
    n = 0
    for r in lees(zf, "stop_times.txt", maxr):
        tid = r["trip_id"]
        if tid not in trips:
            continue
        t = tijd_sec(r["departure_time"]) or tijd_sec(r["arrival_time"])
        if t is None:
            continue
        ritten[tid].append((int(r["stop_sequence"]), halte_sleutel(r["stop_id"]), t))
        n += 1
        if n % 2_000_000 == 0:
            print(f"  … {n} halteringen", flush=True)
    print(f"  {n} halteringen in {len(ritten)} ritten", flush=True)

    # patronen per lijn en richting
    patronen = defaultdict(lambda: defaultdict(list))  # (route, richting) -> patroon -> [rit]
    for tid, rij in ritten.items():
        rij.sort()
        # dubbele haltes achter elkaar (aankomst/vertrek op ander perron) samenvoegen
        volg, tijden = [], []
        for _, h, t in rij:
            if volg and volg[-1] == h:
                tijden[-1] = t
                continue
            volg.append(h)
            tijden.append(t)
        if len(volg) < 2:
            continue
        route_id, richting, shape, kop = trips[tid]
        patronen[(route_id, richting)][tuple(volg)].append((tijden, shape, kop))
    del ritten

    gekozen = []  # (route_id, richting, volg, ritten)
    nodig_shapes = set()
    for (route_id, richting), pats in patronen.items():
        totaal = sum(len(v) for v in pats.values())
        beste = sorted(pats.items(), key=lambda kv: -len(kv[1]))
        for i, (volg, rr) in enumerate(beste[:3]):
            if i > 0 and len(rr) < 0.15 * totaal:
                break
            shape = Counter(r[1] for r in rr).most_common(1)[0][0]
            if shape:
                nodig_shapes.add(shape)
            gekozen.append((route_id, richting, volg, rr, shape))
    print(f"  {len(gekozen)} lijnpatronen, {len(nodig_shapes)} routevormen nodig", flush=True)

    vormen = defaultdict(list)
    if "shapes.txt" in zf.namelist():
        for r in lees(zf, "shapes.txt", maxr * 3 if maxr else None):
            if r["shape_id"] in nodig_shapes:
                vormen[r["shape_id"]].append((int(r["shape_pt_sequence"]),
                                              float(r["shape_pt_lat"]), float(r["shape_pt_lon"])))
    vorm_rd = {}
    for sid, pts in vormen.items():
        pts.sort()
        rd = [tuple(int(round(v)) for v in naar_rd(la, lo)) for _, la, lo in pts]
        vorm_rd[sid] = vereenvoudig(rd, 6)
    del vormen

    # haltes (bij --toevoegen doorgenummerd na de bestaande)
    halte_idx, haltes = {}, []
    MODBIT = {"trein": 1, "metro": 2, "tram": 4, "bus": 8, "veer": 16, "belbus": 32, "overig": 64}
    oude_vervoerders = []
    if a.toevoegen and os.path.exists(os.path.join(a.uit, "haltes.json")):
        terug = {v: k for k, v in MODBIT.items()}
        for n_, x_, y_, bits in json.load(open(os.path.join(a.uit, "haltes.json"), encoding="utf-8"))["haltes"]:
            haltes.append([n_, x_, y_, {terug[b] for b in terug if bits & b}])
        oude_vervoerders = json.load(open(os.path.join(a.uit, "vervoerders.json"), encoding="utf-8"))["vervoerders"]
        print(f"  toevoegen na {len(haltes)} bestaande haltes en {len(oude_vervoerders)} vervoerders", flush=True)

    def halte(sleutel, mod):
        if sleutel not in halte_idx:
            s = stops.get(sleutel) or {}
            try:
                x, y = naar_rd(float(s["stop_lat"]), float(s["stop_lon"]))
            except (KeyError, ValueError):
                x, y = 0, 0
            naam = re.sub(r"\s+", " ", s.get("stop_name", sleutel)).strip()
            halte_idx[sleutel] = len(haltes)
            haltes.append([naam, int(round(x)), int(round(y)), set()])
        haltes[halte_idx[sleutel]][3].add(mod)
        return halte_idx[sleutel]

    per_vervoerder = defaultdict(dict)
    for route_id, richting, volg, rr, shape in gekozen:
        rt = routes[route_id]
        mod = modus(rt.get("route_type", "3"))
        ag = rt.get("agency_id") or next(iter(agencies), "onbekend")
        if ag not in agencies and len(agencies) == 1:
            ag = next(iter(agencies))
        hidx = [halte(h, mod) for h in volg]
        # rijtijden: mediaan per halte t.o.v. vertrek eerste halte
        rel = list(zip(*[[t - r[0][0] for t in r[0]] for r in rr]))
        rijtijd = [int(statistics.median(k)) for k in rel]
        vertrek = sorted(r[0][0] // 60 for r in rr)
        kop = Counter(r[2] for r in rr).most_common(1)[0][0]
        lijn = per_vervoerder[ag].setdefault(route_id, {
            "id": route_id, "nr": rt.get("route_short_name", ""),
            "naam": rt.get("route_long_name", ""), "m": mod,
            "kl": (rt.get("route_color") or "").upper(), "r": []})
        rich = {"rt": richting, "kop": kop, "h": hidx, "t": rijtijd, "v": vertrek}
        if shape in vorm_rd and len(vorm_rd[shape]) >= 2:
            pts = vorm_rd[shape]
            rich["km"] = langs_lijn(pts, [(haltes[i][1], haltes[i][2]) for i in hidx])
            plat, px, py = [pts[0][0], pts[0][1]], pts[0][0], pts[0][1]
            for x, y in pts[1:]:
                plat += [x - px, y - py]
                px, py = x, y
            rich["vorm"] = plat
        lijn["r"].append(rich)

    vervoerders = []
    for ag, lijnen in per_vervoerder.items():
        info = agencies.get(ag, {})
        modi = Counter(l["m"] for l in lijnen.values())
        xs = [haltes[h][1] for l in lijnen.values() for r in l["r"] for h in r["h"]]
        ys = [haltes[h][2] for l in lijnen.values() for r in l["r"] for h in r["h"]]
        ritten_dag = sum(len(r["v"]) for l in lijnen.values() for r in l["r"])
        vid = f"{a.land}-{ag}" if a.land else ag
        bestand = re.sub(r"[^A-Za-z0-9_-]", "_", vid) + ".json"
        vervoerders.append({"id": vid, "land": a.land or "NL", "naam": info.get("agency_name", ag), "url": info.get("agency_url", ""),
                            "modi": dict(modi), "lijnen": len(lijnen), "ritten": ritten_dag,
                            "bbox": [min(xs), min(ys), max(xs), max(ys)] if xs else None,
                            "bestand": bestand})
        lijst = sorted(lijnen.values(), key=lambda l: (l["m"], len(l["nr"]), l["nr"]))
        with open(os.path.join(a.uit, "lijnen", bestand), "w", encoding="utf-8") as f:
            json.dump({"vervoerder": vid, "dag": dag, "lijnen": lijst}, f,
                      ensure_ascii=False, separators=(",", ":"))
    for v in vervoerders:
        print(f"  {v['naam']:<32} {v['lijnen']:>5} lijnen {v['ritten']:>7} ritten {v['modi']}")
    vervoerders = sorted(oude_vervoerders + vervoerders, key=lambda v: -v["ritten"])
    with open(os.path.join(a.uit, "haltes.json"), "w", encoding="utf-8") as f:
        json.dump({"uitleg": "[naam, x, y, modi-bits trein1 metro2 tram4 bus8 veer16 belbus32]",
                   "haltes": [[n, x, y, sum(MODBIT.get(m, 64) for m in ms)] for n, x, y, ms in haltes]},
                  f, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(a.uit, "vervoerders.json"), "w", encoding="utf-8") as f:
        json.dump({"dag": dag, "vervoerders": vervoerders}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {len(haltes)} haltes, {len(vervoerders)} vervoerders", flush=True)


if __name__ == "__main__":
    main()
