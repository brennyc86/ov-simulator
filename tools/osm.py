#!/usr/bin/env python3
"""Haalt het Nederlandse OV-netwerk uit OpenStreetMap (Overpass) en schrijft compacte
JSON-bestanden in RD-meters voor de simulator.

Gebruik:  python3 tools/osm.py [--bbox zuid,west,noord,oost] [--uit data]

Uitvoer:
  spoor.json     spoorgraaf: knopen + takken (trein, sneltram, metro, tram, historisch)
  stations.json  stations, haltes, busstations, veerterminals
  wissels.json   wisselposities
  perrons.json   perrons (vlakken en lijnen)
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


LANDEN = "NL|BE|LU|DE|FR"  # de RD-formule is tot in Duitsland en Frankrijk op enkele meters nauwkeurig
LAND_NR = {"NL": 0, "BE": 1, "LU": 2, "DE": 3, "FR": 4}
DETAIL = {"NL", "BE", "LU"}  # perrons, wissels, gebouwen en voorzieningen alleen hier (DE/FR zijn te groot)
GROOT = {  # grote landen in stukken vragen (zuid, west, noord, oost), anders lopen de servers vast
    "DE": [(47.2, 5.8, 51.2, 10.5), (47.2, 10.5, 51.2, 15.1), (51.2, 5.8, 55.1, 10.5), (51.2, 10.5, 55.1, 15.1)],
    "FR": [(41.3, -5.3, 46.3, 2.5), (41.3, 2.5, 46.3, 9.7), (46.3, -5.3, 51.2, 2.5), (46.3, 2.5, 51.2, 9.7)],
}


def gebied(bbox):
    if bbox:
        return "", f"({bbox})"
    return "@GEBIED@", "(area.nl)"


def overpass(query, pogingen=8, detail=False):
    """Eén vraag per land (een gecombineerde vraag over meerdere landen gaf onvolledige antwoorden en time-outs),
    grote landen in vier stukken; de elementen worden samengevoegd (dubbelen langs grenzen één keer) en
    krijgen het land mee in e["_l"]. query mag ook een functie van het land zijn (lichtere vraag voor DE/FR).
    detail=True: alleen NL, BE en LU."""
    if not callable(query) and "@GEBIED@" not in query:
        return overpass_een(query, pogingen)
    alles, gezien, eerste = [], set(), True
    for land in LANDEN.split("|"):
        if detail and land not in DETAIL:
            continue
        q = query(land) if callable(query) else query
        if "@GEBIED@" not in q:  # vraag met bbox (testen): één keer
            return overpass_een(q, pogingen)
        q = q.replace("@GEBIED@", f'area["ISO3166-1"="{land}"]["admin_level"="2"]->.nl;')
        stukken = [q.replace("(area.nl)", f"(area.nl)({z},{w},{n},{o})") for z, w, n, o in GROOT[land]] if land in GROOT else [q]
        n = 0
        try:
            for st in stukken:
                if not eerste:
                    time.sleep(15)
                eerste = False
                res = overpass_een(st, pogingen if land in DETAIL else 5)
                for e in res.get("elements", []):
                    k = (e["type"], e.get("id"))
                    if k in gezien:
                        continue
                    gezien.add(k); e["_l"] = LAND_NR.get(land, 0); alles.append(e); n += 1
        except SystemExit as fout:
            if land in DETAIL:
                raise
            print(f"    {land}: overgeslagen ({fout})", flush=True)  # buurland mislukt: de rest gaat door
            continue
        print(f"    {land}: {n} elementen", flush=True)
    return {"elements": alles}


def overpass_een(query, pogingen=8):
    data = urllib.parse.urlencode({"data": query}).encode()
    laatste = None
    for i in range(pogingen):
        url = OVERPASS[i % len(OVERPASS)]
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=1200) as r:
                res = json.load(r)
            opm = res.get("remark", "")
            if "error" in opm.lower() or "timed out" in opm.lower():  # half antwoord na een time-out op de server
                raise RuntimeError(f"onvolledig antwoord: {opm[:120]}")
            return res
        except Exception as e:  # noqa: BLE001
            laatste = e
            wacht = min(90, 20 * (i + 1))
            print(f"  overpass {url} faalde ({e}), opnieuw over {wacht} s", flush=True)
            time.sleep(wacht)
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
        lengte = math.hypot(dx, dy)
        verst, idx = 0.0, -1
        gesloten = lengte < 1e-6  # begin = eind (rotonde, perronvlak): afstand tot het beginpunt
        for i in range(a + 1, b):
            px, py = punten[i]
            d = math.hypot(px - ax, py - ay) if gesloten else abs(dy * px - dx * py + bx * ay - by * ax) / lengte
            if d > verst:
                verst, idx = d, i
        if verst > tol and idx > 0:
            houd[idx] = True
            stapel.append((a, idx))
            stapel.append((idx, b))
    return [p for p, h in zip(punten, houd) if h]


def in_nl(x, y):
    """Europees vasteland rond NL (NL, BE, LU, DE, FR); de RD-formule geldt niet voor Caribisch Nederland."""
    return -800000 < x < 1000000 and -800000 < y < 1000000


def rd_int(lat, lon):
    x, y = naar_rd(lat, lon)
    return int(round(x)), int(round(y))


# --------------------------------------------------------------------------- perrons
def perrons(bbox, uit):
    """Perrons (railway=platform) als vlak of als lijn, in hele RD-meters, delta-gecodeerd."""
    voor, g = gebied(bbox)
    # perrons zijn op veel manieren ingetekend: railway=platform, of alleen public_transport=platform
    # (vaak zonder train=yes). Bushaltes (bus=yes zonder trein/tram) laten we weg.
    q = (f'[out:json][timeout:900];{voor}(way["railway"="platform"]{g};relation["railway"="platform"]{g};'
         f'way["public_transport"="platform"]["bus"!="yes"]["highway"!="bus_stop"]{g};'
         f'way["public_transport"="platform"]["train"="yes"]{g};way["public_transport"="platform"]["tram"="yes"]{g};'
         f'relation["public_transport"="platform"]["bus"!="yes"]{g};);out tags geom;')
    res = overpass(q, detail=True)
    gezien, lijst = set(), []

    def voeg(geom, vlak):
        pts = [rd_int(p["lat"], p["lon"]) for p in geom if p]
        if len(pts) < 2 or not in_nl(*pts[0]):
            return
        if not vlak:  # gesloten vormen niet vereenvoudigen (begin = eind laat Douglas-Peucker instorten)
            pts = vereenvoudig(pts, 0.5)
        rij, vx, vy = [1 if vlak else 0], 0, 0
        for x, y in pts:
            rij += [x - vx, y - vy]
            vx, vy = x, y
        lijst.append(rij)

    for el in res.get("elements", []):
        if el["id"] in gezien:
            continue
        gezien.add(el["id"])
        t = el.get("tags", {})
        if el["type"] == "way" and "geometry" in el:
            g0 = el["geometry"]
            vlak = (g0[0] == g0[-1] and len(g0) > 3) or t.get("area") == "yes"
            voeg(g0, vlak)
        elif el["type"] == "relation":
            for m in el.get("members", []):
                if m.get("role") == "outer" and "geometry" in m:
                    voeg(m["geometry"], True)
    print(f"  {len(lijst)} perrons", flush=True)
    schrijf(uit, "perrons.json", {"uitleg": "[1=vlak/0=lijn, x0, y0, dx, dy, ...] RD-meters", "p": lijst})


def stationsgebouwen(bbox, uit):
    """Stationsgebouwen en gebouwtjes op perrons (wachtkamers, kiosken, winkels): vlakken in RD-meters."""
    voor, g = gebied(bbox)
    q = (f'[out:json][timeout:900];{voor}(way["building"="train_station"]{g};way["building"]["railway"="station"]{g};'
         f'way["building"]["public_transport"="station"]{g};relation["building"="train_station"]{g};)->.st;'
         f'(way["railway"="platform"]{g};way["public_transport"="platform"]["train"="yes"]{g};)->.p;'
         f'.p map_to_area->.pa;way["building"]["building"!="roof"](area.pa)->.op;(.st;.op;);out tags geom;')
    res = overpass(q, detail=True)
    gezien, lijst = set(), []
    for el in res.get("elements", []):
        if el["id"] in gezien:
            continue
        gezien.add(el["id"])
        geoms = [el["geometry"]] if el["type"] == "way" and "geometry" in el else [m["geometry"] for m in el.get("members", []) if m.get("role") == "outer" and "geometry" in m]
        for geom in geoms:
            pts = [rd_int(p["lat"], p["lon"]) for p in geom if p]
            if len(pts) < 4 or not in_nl(*pts[0]):
                continue
            rij, vx, vy = [], 0, 0
            for x, y in pts:
                rij += [x - vx, y - vy]
                vx, vy = x, y
            lijst.append(rij)
    print(f"  {len(lijst)} stationsgebouwen en perrongebouwtjes", flush=True)
    if len(lijst) < 100:  # Overpass gaf (bijna) niets: vorige versie laten staan
        raise RuntimeError("te weinig stationsgebouwen, vorige versie blijft staan")
    schrijf(uit, "stationsgebouwen.json", {"uitleg": "[x0, y0, dx, dy, ...] RD-meters, gesloten vlakken", "g": lijst})


POI_SOORT = [  # (soort, overpass-filter)
    ("school", '["amenity"="school"]'), ("hogeschool", '["amenity"~"^(university|college)$"]'), ("ziekenhuis", '["amenity"="hospital"]'),
    ("museum", '["tourism"="museum"]'), ("dierentuin", '["tourism"~"^(zoo|theme_park)$"]'), ("zwembad", '["leisure"~"^(sports_centre|water_park)$"]["sport"~"swimming"]'),
    ("zwembad", '["leisure"="water_park"]'), ("stadion", '["leisure"="stadium"]'), ("theater", '["amenity"~"^(theatre|cinema)$"]'), ("winkelcentrum", '["shop"="mall"]'),
    ("bedrijventerrein", '["landuse"="industrial"]'), ("gemeentehuis", '["amenity"="townhall"]'),
]


def voorzieningen(bbox, uit):
    """Benoemde voorzieningen (scholen, musea, zwembaden, ziekenhuizen ...) als punt: [naam, x, y, soortIdx]."""
    voor, g = gebied(bbox)
    soorten = sorted(set(s for s, _ in POI_SOORT))
    lijst, gezien = [], set()
    for soort, f in POI_SOORT:
        q = f'[out:json][timeout:600];{voor}(nwr{f}["name"]{g};);out center tags;'
        try:
            res = overpass(q, detail=True)
        except Exception as e:  # noqa: BLE001
            print(f"  {soort} mislukt: {e}", flush=True)
            continue
        n = 0
        for el in res.get("elements", []):
            c = el.get("center") or ({"lat": el.get("lat"), "lon": el.get("lon")} if "lat" in el else None)
            naam = el.get("tags", {}).get("name")
            if not c or not naam:
                continue
            x, y = rd_int(c["lat"], c["lon"])
            if not in_nl(x, y) or (naam, x // 200, y // 200) in gezien:
                continue
            gezien.add((naam, x // 200, y // 200))
            lijst.append([naam, x, y, soorten.index(soort)])
            n += 1
        print(f"  {soort}: {n}", flush=True)
        time.sleep(5)
    if len(lijst) < 1000:  # Overpass gaf (bijna) niets: vorige versie laten staan
        raise RuntimeError("te weinig voorzieningen, vorige versie blijft staan")
    schrijf(uit, "voorzieningen.json", {"uitleg": "[naam, x, y, soortIdx] RD", "soorten": soorten, "v": lijst})


# --------------------------------------------------------------------------- spoor
def spoor(bbox, uit):
    voor, g = gebied(bbox)
    soorten = "|".join(SOORT.keys())

    def q(land):
        if land in DETAIL:
            return f"""[out:json][timeout:900];{voor}
(way{g}["railway"~"^({soorten})$"];);
out body geom;"""
        return f"""[out:json][timeout:900];{voor}
(way{g}["railway"="rail"]["usage"~"^(main|branch)$"]["service"!~"^(yard|siding|spur)$"];);
out body geom;"""  # DE/FR: eerst alleen het landelijke net (hoofd- en zijlijnen); regionaal (tram, metro) later
    print("spoor ophalen…", flush=True)
    res = overpass(q)
    wegen = [e for e in res["elements"] if e["type"] == "way" and e.get("geometry")]
    print(f"  {len(wegen)} spoorwegen", flush=True)
    if not bbox and len(wegen) < (5000 if "NL" in LANDEN else 100):
        raise SystemExit("verdacht weinig spoor, gestopt (de vorige data blijft staan)")

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
        # elektrificatie: 0 = geen, anders de spanning in volt (1 = wel elektrisch, spanning onbekend);
        # 3e rail (metro) krijgt een negatief getal: -750 = 750 V via derde rail
        elek = 0
        if t.get("electrified", "no") not in ("no", ""):
            try:
                v = int(re.match(r"\d+", t.get("voltage", "").split(";")[0]).group(0))
            except (AttributeError, ValueError):
                v = 1
            elek = -v if t.get("electrified") == "rail" and v > 1 else v
        start = jaar(t.get("start_date") or t.get("opening_date"))
        eind = jaar(t.get("end_date") or t.get("closing_date") or t.get("abandoned:date")
                    or t.get("razed:date"))
        naam = t.get("name", "")
        # hoogte: -1 ondergronds (tunnel, layer<0, location=underground), 1 verhoogd (brug/viaduct), 0 maaiveld
        try:
            laag = int(t.get("layer", "0") or 0)
        except ValueError:
            laag = 0
        if t.get("tunnel", "no") not in ("no", "") or t.get("location") == "underground" or laag < 0:
            hoogte = -1
        elif t.get("bridge", "no") not in ("no", "") or t.get("location") == "overground" or laag > 0:
            hoogte = 1
        else:
            hoogte = 0
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
                    tol = 2.0 if dienst else 4.0 if w.get("_l", 0) < 3 else 10.0  # DE/FR grover (bestandsgrootte)
                    vs = vereenvoudig(stuk, tol)
                    tussen = []
                    px, py = vs[0]
                    for x, y in vs[1:-1]:
                        tussen += [x - px, y - py]
                        px, py = x, y
                    takken.append({"a": a, "b": b, "soort": soort, "dienst": dienst,
                                   "gebruik": gebr, "sporen": sporen_tag, "vmax": vmax,
                                   "elek": elek, "start": start, "eind": eind,
                                   "naam": naam, "pts": vs, "tussen": tussen, "hoogte": hoogte,
                                   "land": w.get("_l", 0)})
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
                    tk["vmax"], tk["elek"], tk["start"], tk["eind"], naam_idx[n], tk["tussen"], tk["hoogte"], tk["land"]])
    schrijf(uit, "spoor.json", {
        "uitleg": "takken: [knoopA, knoopB, soort, dienst, gebruik, sporen, vmax, elek, "
                  "startjaar, eindjaar, naamIdx, tussenpunten(delta vanaf A), hoogte(-1 tunnel, 1 viaduct), land]",
        "landen": list(LAND_NR.keys()),
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
    q_vol = f"""[out:json][timeout:600];{voor}
(
 nwr{g}["railway"~"^(station|halt|tram_stop)$"];
 nwr{g}["public_transport"="station"];
 nwr{g}["amenity"~"^(bus_station|ferry_terminal)$"];
 nwr{g}["disused:railway"~"^(station|halt)$"];
 nwr{g}["abandoned:railway"~"^(station|halt)$"];
 nwr{g}["historic"="railway_station"];
);
out center tags;"""
    q_licht = f"""[out:json][timeout:600];{voor}
(
 nwr{g}["railway"~"^(station|halt)$"]["station"!~"^(subway|light_rail|tram)$"];
);
out center tags;"""
    q = lambda land: q_vol if land in DETAIL else q_licht
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
    res = overpass(f'[out:json][timeout:600];{voor}node{g}["railway"="switch"];out skel;', detail=True)
    pts = []
    for e in res["elements"]:
        pts += rd_int(e["lat"], e["lon"])
    print(f"  {len(pts) // 2} wissels", flush=True)
    schrijf(uit, "wissels.json", {"wissels": pts})


def overig_ophalen(bbox):
    """Plaatsen, veren en vliegvelden in één Overpass-verzoek (de servers remmen af na veel losse verzoeken)."""
    voor, g = gebied(bbox)
    return overpass(lambda land: f"""[out:json][timeout:900];{voor}
node{g}["place"~"^(city|town{'|village' if land in DETAIL else ''})$"];out body;
way{g}["route"="ferry"];out tags geom;
nwr{g}["aeroway"~"^({'aerodrome|airstrip|heliport' if land in DETAIL else 'aerodrome'})$"]{'' if land in DETAIL else '["iata"]'};out center tags;
way{g}["aeroway"="runway"]{'' if land in DETAIL else '["length"]'};out tags geom;""")


def plaatsen(bbox, uit, res=None):
    res = res or overig_ophalen(bbox)
    lijst = []
    for e in res["elements"]:
        t = e.get("tags", {})
        if e["type"] != "node" or "place" not in t or t["place"] not in ("city", "town", "village"):
            continue
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


def veren(bbox, uit, res=None):
    res = res or overig_ophalen(bbox)
    lijst = []
    for e in res["elements"]:
        t = e.get("tags", {})
        if not e.get("geometry") or t.get("route") != "ferry":
            continue
        pts = vereenvoudig([rd_int(p["lat"], p["lon"]) for p in e["geometry"]], 10)
        plat = []
        for x, y in pts:
            plat += [x, y]
        lijst.append({"n": t.get("name", ""), "o": t.get("operator", ""),
                      "m": 1 if t.get("motor_vehicle") in ("yes", "designated") else 0, "c": plat})
    print(f"  {len(lijst)} veerverbindingen", flush=True)
    schrijf(uit, "veren.json", {"veren": lijst})


def vliegvelden(bbox, uit, res=None):
    """Alle vliegvelden, ook kleine (grasbanen, zweefvliegvelden) en helihavens, met de langste baan."""
    res = res or overig_ophalen(bbox)
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


# --------------------------------------------------------------------------- trolleybus
def trolley(bbox, uit):
    """Trolleybuslijnen (route=trolleybus) en wegen met bovenleiding (trolley_wire=yes)."""
    voor, g = gebied(bbox)
    q = f"""[out:json][timeout:300];{voor}
(relation{g}["route"="trolleybus"];way{g}["trolley_wire"~"^(yes|forward|backward|both)$"];);
(._;>;);
out body geom;"""
    print("trolleybus ophalen…", flush=True)
    res = overpass(q, detail=True)
    lijnen, gezien = [], set()
    ways = {e["id"]: e for e in res["elements"] if e["type"] == "way" and e.get("geometry")}
    namen = {}
    for e in res["elements"]:
        if e["type"] == "relation":
            for m in e.get("members", []):
                if m["type"] == "way":
                    namen.setdefault(m["ref"], set()).add(e.get("tags", {}).get("ref", ""))
    for wid, w in ways.items():
        t = w.get("tags", {})
        if wid not in namen and t.get("trolley_wire", "no") == "no":
            continue
        if not t.get("highway") and wid not in namen:
            continue
        pts = vereenvoudig([rd_int(p["lat"], p["lon"]) for p in w["geometry"]], 3.0)
        d = [pts[0][0], pts[0][1]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            d += [x1 - x0, y1 - y0]
        lijnen.append({"d": d, "l": sorted(x for x in namen.get(wid, []) if x)})
    print(f"  {len(lijnen)} wegen met bovenleiding", flush=True)
    schrijf(uit, "trolley.json", {"uitleg": "d = [x0, y0, dx, dy, ...] RD; l = lijnnummers", "w": lijnen})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bbox", default="", help="zuid,west,noord,oost (voor testen)")
    ap.add_argument("--uit", default="data")
    ap.add_argument("--alleen", default="", help="bijv. perrons: alleen dat onderdeel")
    ap.add_argument("--landen", default="NL|BE|LU|DE|FR", help="ISO-landcodes gescheiden door |")
    a = ap.parse_args()
    global LANDEN
    LANDEN = a.landen
    os.makedirs(a.uit, exist_ok=True)
    if a.alleen == "spoor":
        takken = spoor(a.bbox, a.uit)
        time.sleep(20)
        stations(a.bbox, a.uit, takken)
        return
    if a.alleen == "spoorkaal":  # alleen het spoornet (zonder stations)
        spoor(a.bbox, a.uit)
        return
    if a.alleen == "trolley":
        trolley(a.bbox, a.uit)
        return
    if a.alleen == "voorzieningen":
        voorzieningen(a.bbox, a.uit)
        return
    if a.alleen == "gebouwen":
        stationsgebouwen(a.bbox, a.uit)
        return
    if a.alleen == "perrons":
        os.makedirs(a.uit, exist_ok=True)
        perrons(a.bbox, a.uit)
        return
    takken = spoor(a.bbox, a.uit)
    stations(a.bbox, a.uit, takken)
    wissels(a.bbox, a.uit)
    perrons(a.bbox, a.uit)
    try:
        voorzieningen(a.bbox, a.uit)
    except Exception as e:  # noqa: BLE001
        print("voorzieningen mislukt:", e, flush=True)
    try:
        stationsgebouwen(a.bbox, a.uit)
    except Exception as e:  # noqa: BLE001
        print("stationsgebouwen mislukt:", e, flush=True)
    print("plaatsen, veren en vliegvelden ophalen (eerst even wachten, Overpass remt af na zware verzoeken)…", flush=True)
    time.sleep(45)
    rest = overig_ophalen(a.bbox)
    plaatsen(a.bbox, a.uit, rest)
    veren(a.bbox, a.uit, rest)
    vliegvelden(a.bbox, a.uit, rest)
    historie(a.uit)
    try:
        trolley(a.bbox, a.uit)
    except Exception as e:  # noqa: BLE001
        print("trolleybus mislukt:", e, flush=True)


if __name__ == "__main__":
    main()
