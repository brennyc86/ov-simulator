#!/usr/bin/env python3
"""Haalt het Nederlandse OV-netwerk uit OpenStreetMap (Overpass) en schrijft compacte
JSON-bestanden in RD-meters voor de simulator.

Gebruik:  python3 tools/osm.py [--bbox zuid,west,noord,oost] [--uit data]

Uitvoer:
  spoor.json     spoorgraaf: knopen + takken (trein, sneltram, metro, tram, historisch)
  stations.json  stations, haltes, busstations, veerterminals
  wissels.json   wisselposities
  plaatsen.json  steden/dorpen met inwonertal (voor de vraag naar vervoer)
  veren.json     veerverbindingen (geometrie)
  historie.json  beschikbare jaren van de Kadaster-tijdreiskaart
"""
import argparse
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from rd import naar_rd  # noqa: E402

OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
UA = "ov-simulator-datapijplijn (github.com/brennyc86/ov-simulator)"

SOORT = {"rail": 0, "light_rail": 1, "subway": 2, "tram": 3, "narrow_gauge": 4,
         "disused": 5, "abandoned": 6, "razed": 6, "construction": 7, "preserved": 8}
DIENST = {"": 0, "siding": 1, "yard": 2, "spur": 3, "crossover": 4}
GEBRUIK = {"main": 0, "branch": 1, "industrial": 2, "tourism": 3, "military": 4}


def gebied(bbox):
    if bbox:
        return "", f"({bbox})"
    return 'area["ISO3166-1"="NL"]["admin_level"="2"]->.nl;', "(area.nl)"


def overpass(query, pogingen=8):
    data = urllib.parse.urlencode({"data": query}).encode()
    laatste = None
    for i in range(pogingen):
        url = OVERPASS[i % len(OVERPASS)]
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=1200) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            laatste = e
            print(f"  overpass {url} faalde ({e}), opnieuw over {30 * (i + 1)} s", flush=True)
            time.sleep(30 * (i + 1))
    raise SystemExit(f"Overpass bleef falen: {laatste}")


def jaar(waarde):
    if not waarde:
        return 0
    m = re.search(r"(1[6-9]\d\d|20\d\d)", str(waarde))
    return int(m.group(1)) if m else 0


def vereenvoudig(punten, tol):
    """Douglas-Peucker, eerste en laatste punt blijven altijd staan."""
    if len(punten) < 3:
        return punten
    houd = [False] * len(punten)
    houd[0] = houd[-1] = True
    stapel = [(0, len(punten) - 1)]
    while stapel:
        a, b = stapel.pop()
        ax, ay = punten[a]
        bx, by = punten[b]
        dx, dy = bx - ax, by - ay
        lengte = math.hypot(dx, dy) or 1e-9
        verst, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = punten[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / lengte
            if d > verst:
                verst, idx = d, i
        if verst > tol and idx > 0:
            houd[idx] = True
            stapel.append((a, idx))
            stapel.append((idx, b))
    return [p for p, h in zip(punten, houd) if h]


def in_nl(x, y):
    """Europees Nederland (de RD-formule geldt niet voor Caribisch Nederland)."""
    return -30000 < x < 330000 and 270000 < y < 680000


def rd_int(lat, lon):
    x, y = naar_rd(lat, lon)
    return int(round(x)), int(round(y))


# --------------------------------------------------------------------------- spoor
def spoor(bbox, uit):
    voor, g = gebied(bbox)
    soorten = "|".join(SOORT.keys())
    q = f"""[out:json][timeout:900];{voor}
(way{g}["railway"~"^({soorten})$"];);
out body geom;"""
    print("spoor ophalen…", flush=True)
    res = overpass(q)
    wegen = [e for e in res["elements"] if e["type"] == "way" and e.get("geometry")]
    print(f"  {len(wegen)} spoorwegen", flush=True)

    gebruik_telling = defaultdict(int)
    for w in wegen:
        for n in w["nodes"]:
            gebruik_telling[n] += 1
    knoop_idx, knopen = {}, []

    def knoop(nid, xy):
        if nid not in knoop_idx:
            knoop_idx[nid] = len(knopen) // 2
            knopen.extend(xy)
        return knoop_idx[nid]

    takken = []
    for w in wegen:
        t = w.get("tags", {})
        soort = SOORT.get(t.get("railway"), 0)
        dienst = DIENST.get(t.get("service", ""), 0)
        gebr = GEBRUIK.get(t.get("usage", ""), 0)
        try:
            sporen_tag = int(t.get("tracks", "0") or 0)
        except ValueError:
            sporen_tag = 0
        try:
            vmax = int(re.match(r"\d+", t.get("maxspeed", "0")).group(0))
        except (AttributeError, ValueError):
            vmax = 0
        elek = 1 if t.get("electrified", "no") not in ("no", "") else 0
        start = jaar(t.get("start_date") or t.get("opening_date"))
        eind = jaar(t.get("end_date") or t.get("closing_date") or t.get("abandoned:date")
                    or t.get("razed:date"))
        naam = t.get("name", "")
        pts = [rd_int(p["lat"], p["lon"]) for p in w["geometry"]]
        ids = w["nodes"]
        # splitsen op knooppunten (eindpunten en gedeelde nodes)
        begin = 0
        for i in range(1, len(ids)):
            if i == len(ids) - 1 or gebruik_telling[ids[i]] > 1:
                stuk = pts[begin:i + 1]
                if len(stuk) >= 2:
                    a = knoop(ids[begin], stuk[0])
                    b = knoop(ids[i], stuk[-1])
                    tol = 2.0 if dienst else 4.0
                    vs = vereenvoudig(stuk, tol)
                    tussen = []
                    px, py = vs[0]
                    for x, y in vs[1:-1]:
                        tussen += [x - px, y - py]
                        px, py = x, y
                    takken.append({"a": a, "b": b, "soort": soort, "dienst": dienst,
                                   "gebruik": gebr, "sporen": sporen_tag, "vmax": vmax,
                                   "elek": elek, "start": start, "eind": eind,
                                   "naam": naam, "pts": vs, "tussen": tussen})
                begin = i

    schat_sporen(takken)

    namen, naam_idx = [], {}
    rij = []
    for tk in takken:
        n = tk["naam"]
        if n not in naam_idx:
            naam_idx[n] = len(namen)
            namen.append(n)
        rij.append([tk["a"], tk["b"], tk["soort"], tk["dienst"], tk["gebruik"], tk["sporen"],
                    tk["vmax"], tk["elek"], tk["start"], tk["eind"], naam_idx[n], tk["tussen"]])
    schrijf(uit, "spoor.json", {
        "uitleg": "takken: [knoopA, knoopB, soort, dienst, gebruik, sporen, vmax, elek, "
                  "startjaar, eindjaar, naamIdx, tussenpunten(delta vanaf A)]",
        "soorten": list(SOORT.keys()), "diensten": list(DIENST.keys()),
        "gebruik": list(GEBRUIK.keys()),
        "knopen": knopen, "namen": namen, "takken": rij})
    return takken


def schat_sporen(takken):
    """OSM tekent in NL vaak elk spoor als aparte lijn. Tel per hoofdspoor-tak hoeveel
    evenwijdige hoofdsporen er binnen 14 m liggen; dat is een goede schatting van
    enkel / dubbel / viersporig."""
    cel = 25.0
    raster = defaultdict(list)

    def richting(p, q):
        return math.atan2(q[1] - p[1], q[0] - p[0]) % math.pi

    kandidaten = [i for i, t in enumerate(takken) if t["dienst"] == 0 and t["soort"] in (0, 1, 2, 4)]
    for i in kandidaten:
        pts = takken[i]["pts"]
        for p, q in zip(pts, pts[1:]):
            lengte = math.hypot(q[0] - p[0], q[1] - p[1])
            stappen = max(1, int(lengte / 20))
            r = richting(p, q)
            for s in range(stappen + 1):
                f = s / stappen
                x = p[0] + (q[0] - p[0]) * f
                y = p[1] + (q[1] - p[1]) * f
                raster[(int(x // cel), int(y // cel))].append((i, x, y, r))
    for i in kandidaten:
        t = takken[i]
        pts = t["pts"]
        # meetpunt halverwege de langste lijnstuk
        p, q = max(zip(pts, pts[1:]), key=lambda pq: math.hypot(pq[1][0] - pq[0][0], pq[1][1] - pq[0][1]))
        mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        r0 = richting(p, q)
        buren = set()
        cx, cy = int(mx // cel), int(my // cel)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for j, x, y, r in raster.get((cx + dx, cy + dy), ()):
                    if j == i or j in buren:
                        continue
                    dr = abs(r - r0)
                    dr = min(dr, math.pi - dr)
                    if dr < 0.35 and math.hypot(x - mx, y - my) < 14:
                        buren.add(j)
        t["sporen"] = max(t["sporen"], 1 + len(buren))


# --------------------------------------------------------------------------- stations
def stations(bbox, uit, takken):
    voor, g = gebied(bbox)
    q = f"""[out:json][timeout:600];{voor}
(
 nwr{g}["railway"~"^(station|halt|tram_stop)$"];
 nwr{g}["public_transport"="station"];
 nwr{g}["amenity"~"^(bus_station|ferry_terminal)$"];
 nwr{g}["disused:railway"~"^(station|halt)$"];
 nwr{g}["abandoned:railway"~"^(station|halt)$"];
 nwr{g}["historic"="railway_station"];
);
out center tags;"""
    print("stations ophalen…", flush=True)
    res = overpass(q)
    lijst = []
    gezien = set()
    for e in res["elements"]:
        t = e.get("tags", {})
        c = e.get("center") or e
        if "lat" not in c:
            continue
        naam = t.get("name") or t.get("official_name") or ""
        if not naam:
            continue
        x, y = rd_int(c["lat"], c["lon"])
        rw = t.get("railway", "")
        st = t.get("station", "")
        verdwenen = 1 if ("disused:railway" in t or "abandoned:railway" in t
                          or t.get("historic") == "railway_station") else 0
        if rw == "tram_stop" or (t.get("tram") == "yes" and rw != "station"):
            soort = "tram"
        elif st == "subway" or t.get("subway") == "yes":
            soort = "metro"
        elif st == "light_rail" or t.get("light_rail") == "yes":
            soort = "sneltram"
        elif rw in ("station", "halt") or t.get("train") == "yes" or verdwenen:
            soort = "trein"
        elif t.get("amenity") == "ferry_terminal" or t.get("ferry") == "yes":
            soort = "veer"
        elif t.get("amenity") == "bus_station" or t.get("bus") == "yes":
            soort = "busstation"
        else:
            continue
        sleutel = (soort, naam, x // 150, y // 150)
        if sleutel in gezien:
            continue
        gezien.add(sleutel)
        lijst.append({"n": naam, "s": soort, "x": x, "y": y,
                      "c": t.get("railway:ref", ""),
                      "o": t.get("operator", "")[:40],
                      "b": jaar(t.get("start_date") or t.get("opening_date")),
                      "e": jaar(t.get("end_date") or t.get("closing_date")) or (1 if verdwenen else 0)})
    # sporen langs het perron schatten: aantal treinsporen (geen opstel/emplacement) binnen 45 m
    cel = 60
    raster = defaultdict(set)
    for i, tk in enumerate(takken):
        if tk["soort"] not in (0, 1, 2, 4) or tk["dienst"] == 2:
            continue
        for x, y in tk["pts"]:
            raster[(x // cel, y // cel)].add(i)
    for s in lijst:
        if s["s"] not in ("trein", "metro", "sneltram"):
            continue
        dichtbij = set()
        cx, cy = s["x"] // cel, s["y"] // cel
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in raster.get((cx + dx, cy + dy), ()):
                    if any(math.hypot(x - s["x"], y - s["y"]) < 55 for x, y in punten_dicht(takken[i]["pts"])):
                        dichtbij.add(i)
        s["p"] = max(1, len(dichtbij))
    lijst.sort(key=lambda s: (s["s"], s["n"]))
    print(f"  {len(lijst)} stations/haltes", flush=True)
    schrijf(uit, "stations.json", {
        "uitleg": "n naam, s soort, x/y RD, c stationscode, o beheerder/vervoerder, b openingsjaar, "
                  "e sluitingsjaar (1 = verdwenen, jaar onbekend), p geschat aantal sporen",
        "stations": lijst})


def punten_dicht(pts):
    """Punten elke ~20 m langs een lijn, zodat lange rechte stukken ook meetellen."""
    uit = []
    for p, q in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / 20))
        for s in range(n + 1):
            f = s / n
            uit.append((p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f))
    return uit


# --------------------------------------------------------------------------- overig
def wissels(bbox, uit):
    voor, g = gebied(bbox)
    res = overpass(f'[out:json][timeout:600];{voor}node{g}["railway"="switch"];out skel;')
    pts = []
    for e in res["elements"]:
        pts += rd_int(e["lat"], e["lon"])
    print(f"  {len(pts) // 2} wissels", flush=True)
    schrijf(uit, "wissels.json", {"wissels": pts})


def plaatsen(bbox, uit):
    voor, g = gebied(bbox)
    res = overpass(f'[out:json][timeout:600];{voor}node{g}["place"~"^(city|town|village)$"];out body;')
    lijst = []
    for e in res["elements"]:
        t = e.get("tags", {})
        try:
            inw = int(re.sub(r"[^\d]", "", t.get("population", "")) or 0)
        except ValueError:
            inw = 0
        if not inw:
            inw = {"city": 60000, "town": 12000, "village": 1500}[t["place"]]
        x, y = rd_int(e["lat"], e["lon"])
        g = "NL" if in_nl(x, y) else "CN"
        if g != "NL":
            x = y = 0
        lijst.append([t.get("name", ""), x, y, inw, t["place"][0], g, round(e["lat"], 5), round(e["lon"], 5)])
    lijst.sort(key=lambda r: -r[3])
    print(f"  {len(lijst)} plaatsen", flush=True)
    schrijf(uit, "plaatsen.json", {"uitleg": "[naam, x, y, inwoners, c/t/v, gebied NL/CN, lat, lon]", "plaatsen": lijst})


def veren(bbox, uit):
    voor, g = gebied(bbox)
    res = overpass(f'[out:json][timeout:600];{voor}way{g}["route"="ferry"];out tags geom;')
    lijst = []
    for e in res["elements"]:
        if not e.get("geometry"):
            continue
        t = e.get("tags", {})
        pts = vereenvoudig([rd_int(p["lat"], p["lon"]) for p in e["geometry"]], 10)
        plat = []
        for x, y in pts:
            plat += [x, y]
        lijst.append({"n": t.get("name", ""), "o": t.get("operator", ""),
                      "m": 1 if t.get("motor_vehicle") in ("yes", "designated") else 0, "c": plat})
    print(f"  {len(lijst)} veerverbindingen", flush=True)
    schrijf(uit, "veren.json", {"veren": lijst})


def vliegvelden(bbox, uit):
    """Alle vliegvelden, ook kleine (grasbanen, zweefvliegvelden) en helihavens, met de langste baan."""
    voor, g = gebied(bbox)
    res = overpass(f"""[out:json][timeout:600];{voor}
(nwr{g}["aeroway"~"^(aerodrome|airstrip|heliport)$"];);
out center tags;
way{g}["aeroway"="runway"];
out tags geom;""")
    velden, banen = [], []
    for e in res["elements"]:
        t = e.get("tags", {})
        if t.get("aeroway") == "runway" and e.get("geometry"):
            # lengte via lat/lon (werkt ook buiten Europees Nederland)
            geo = e["geometry"]
            lengte = sum(math.hypot((b["lat"] - a["lat"]) * 111320, (b["lon"] - a["lon"]) * 111320 * math.cos(math.radians(a["lat"])))
                         for a, b in zip(geo, geo[1:]))
            try:
                lengte = max(lengte, float(re.sub(r"[^\d.]", "", t.get("length", "")) or 0))
            except ValueError:
                pass
            cla = sum(p["lat"] for p in geo) / len(geo)
            clo = sum(p["lon"] for p in geo) / len(geo)
            verhard = t.get("surface", "") in ("asphalt", "concrete", "paved", "paving_stones")
            banen.append((cla, clo, lengte, verhard))
            continue
        c = e.get("center") or e
        if "lat" not in c or t.get("aeroway") not in ("aerodrome", "airstrip", "heliport"):
            continue
        naam = t.get("name") or t.get("name:nl") or ""
        if not naam:
            continue
        x, y = rd_int(c["lat"], c["lon"])
        deel = "NL" if in_nl(x, y) else "CN"  # CN = Caribisch deel van het Koninkrijk (RD geldt daar niet)
        if deel != "NL":
            x = y = 0
        soort = t.get("aerodrome:type") or t.get("aerodrome") or ""
        if t.get("aeroway") == "heliport":
            soort = "heliport"
        elif t.get("military") or t.get("landuse") == "military" or "military" in soort:
            soort = "militair"
        elif t.get("iata") and soort in ("", "public"):
            soort = "regionaal"
        velden.append({"n": naam, "x": x, "y": y, "g": deel, "la": round(c["lat"], 5), "lo": round(c["lon"], 5), "icao": t.get("icao", ""), "iata": t.get("iata", ""),
                       "s": soort or ("airstrip" if t.get("aeroway") == "airstrip" else "veld"),
                       "b": jaar(t.get("start_date") or t.get("opening_date")), "baan": 0, "verhard": 0})
    for v in velden:
        for bla, blo, lengte, verhard in banen:
            d = math.hypot((bla - v["la"]) * 111320, (blo - v["lo"]) * 111320 * math.cos(math.radians(v["la"])))
            if d < 3500 and lengte > v["baan"]:
                v["baan"], v["verhard"] = int(lengte), int(verhard)
    velden.sort(key=lambda v: -v["baan"])
    print(f"  {len(velden)} vliegvelden ({sum(1 for v in velden if v['iata'])} met IATA-code)", flush=True)
    schrijf(uit, "vliegvelden.json", {"uitleg": "n naam, s soort, baan langste baan (m), verhard 1/0, b openingsjaar",
                                      "vliegvelden": velden})


def historie(uit):
    url = "https://tiles.arcgis.com/tiles/nSZVuSZjHpEZZbRo/arcgis/rest/services?f=json"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        d = json.load(r)
    jaren = sorted({int(m.group(1)) for s in d.get("services", [])
                    for m in [re.match(r"Historische_tijdreis_(\d{4})$", s["name"])] if m})
    print(f"  {len(jaren)} kaartjaren ({jaren[0]}–{jaren[-1]})", flush=True)
    schrijf(uit, "historie.json", {"jaren": jaren})


def schrijf(uit, naam, obj):
    pad = os.path.join(uit, naam)
    with open(pad, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  → {pad} ({os.path.getsize(pad) / 1e6:.2f} MB)", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", default="", help="zuid,west,noord,oost (voor testen)")
    ap.add_argument("--uit", default="data")
    a = ap.parse_args()
    os.makedirs(a.uit, exist_ok=True)
    takken = spoor(a.bbox, a.uit)
    stations(a.bbox, a.uit, takken)
    wissels(a.bbox, a.uit)
    plaatsen(a.bbox, a.uit)
    veren(a.bbox, a.uit)
    vliegvelden(a.bbox, a.uit)
    historie(a.uit)


if __name__ == "__main__":
    main()
