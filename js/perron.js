// Perrons: de bestaande perrons uit OpenStreetMap, en het ontwerpen van een extra spoor met perron
// naast een station. Het ontwerp kijkt dwars op het spoor welke ruimte al bezet is (sporen, perrons)
// en legt het nieuwe spoor + perron aan de buitenkant, met wisselbogen aan beide uiteinden.

export class Perrons {
  constructor(data) {
    this.lijst = [];            // {vlak, pts:[x,y,...], bbox}
    this.raster = new Map();    // cel 250 m -> perrons
    for (const r of data?.p || []) {
      const pts = []; let x = 0, y = 0;
      for (let i = 1; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; pts.push(x, y); }
      this.voeg({ vlak: r[0] === 1, pts });
    }
  }
  voeg(p) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) { x0 = Math.min(x0, p.pts[i]); x1 = Math.max(x1, p.pts[i]); y0 = Math.min(y0, p.pts[i + 1]); y1 = Math.max(y1, p.pts[i + 1]); }
    p.bbox = [x0, y0, x1, y1];
    this.lijst.push(p);
    for (let i = Math.floor(x0 / 250); i <= Math.floor(x1 / 250); i++)
      for (let j = Math.floor(y0 / 250); j <= Math.floor(y1 / 250); j++) {
        const k = i + ',' + j; if (!this.raster.has(k)) this.raster.set(k, []); this.raster.get(k).push(p);
      }
    return p;
  }
  // ligt (x,y) op een perron (of binnen 2 m van een perronlijn)?
  op(x, y) {
    for (const p of this.raster.get(Math.floor(x / 250) + ',' + Math.floor(y / 250)) || []) {
      const [x0, y0, x1, y1] = p.bbox;
      if (x < x0 - 3 || x > x1 + 3 || y < y0 - 3 || y > y1 + 3) continue;
      if (p.vlak ? binnen(p.pts, x, y) : afstandLijn(p.pts, x, y) < 2.2) return true;
    }
    return false;
  }
  geojson(lonlat) {
    return {
      type: 'FeatureCollection', features: this.lijst.map(p => {
        const c = []; for (let i = 0; i < p.pts.length; i += 2) c.push(lonlat(p.pts[i], p.pts[i + 1]));
        return p.vlak ? { type: 'Feature', properties: { v: 1 }, geometry: { type: 'Polygon', coordinates: [c] } }
          : { type: 'Feature', properties: { v: 0 }, geometry: { type: 'LineString', coordinates: c } };
      }),
    };
  }
}

export function binnen(pts, x, y) {
  let in_ = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi) in_ = !in_;
  }
  return in_;
}
function afstandLijn(pts, x, y) {
  let d = Infinity;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], dx = pts[k] - ax, dy = pts[k + 1] - ay, l2 = dx * dx + dy * dy || 1e-9;
    const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    d = Math.min(d, Math.hypot(x - ax - dx * f, y - ay - dy * f));
  }
  return d;
}

// gelijkmatig herbemonsteren (elke stap meter)
function herbemonster(pts, stap) {
  const uit = [pts[0], pts[1]];
  let rest = 0;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], bx = pts[k], by = pts[k + 1], l = Math.hypot(bx - ax, by - ay);
    let s = stap - rest;
    while (s <= l) { uit.push(ax + (bx - ax) * s / l, ay + (by - ay) * s / l); s += stap; }
    rest = l - (s - stap);
  }
  uit.push(pts[pts.length - 2], pts[pts.length - 1]);
  return uit;
}

// Ontwerp voor een extra spoor met perron bij station (x, y).
// kant: 0 = automatisch (kant met de minste bebouwing), 1/-1 = links/rechts
export function ontwerpPerron(net, perrons, x, y, jaar, { kant = 0, lengte = 250, breedte = 5 } = {}) {
  const raak = net.dichtsteTak(x, y, 'trein', jaar, 400);
  if (!raak) return null;
  const t = raak.t;
  const a = net.stuk(t, Math.max(0, raak.s - 40), Math.min(t.lengte, raak.s + 40));
  let ux = a[a.length - 2] - a[0], uy = a[a.length - 1] - a[1];
  const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const nx = -uy, ny = ux;
  const cx = raak.x, cy = raak.y;
  const bezet = (d) => {
    for (const l of [-lengte * 0.4, 0, lengte * 0.4]) {
      const px = cx + ux * l + nx * d, py = cy + uy * l + ny * d;
      if (net.dichtsteTak(px, py, 'trein', jaar, 2.4)) return 'spoor';
      if (perrons.op(px, py)) return 'perron';
    }
    return null;
  };
  // per kant naar buiten lopen tot er 9 m vrij is
  const rand = teken => {
    let laatste = 0, soort = 'spoor';
    for (let d = 1; d < 90; d += 0.75) {
      const b = bezet(teken * d);
      if (b) { laatste = d; soort = b; } else if (d - laatste > 9) break;
    }
    return { d: laatste, soort };
  };
  const L = rand(1), R = rand(-1);
  const teken = kant || (L.d <= R.d ? 1 : -1);
  const r = teken > 0 ? L : R;
  const spoorD = teken * (r.d + (r.soort === 'perron' ? 1.75 : 4.5));
  const perronMidden = spoorD + teken * (1.65 + breedte / 2);
  // hoe ver loopt het buitenste spoor/perron door? Daar mag de wisselboog pas na beginnen.
  const reik = richting => {
    let l = lengte / 2;
    for (let d = 0; d < 700; d += 10) {
      const px = cx + ux * richting * d + nx * teken * (r.d - 0.5), py = cy + uy * richting * d + ny * teken * (r.d - 0.5);
      if (perrons.op(px, py)) l = Math.max(l, d + 15);
      else if (d > lengte / 2) break;
    }
    return Math.min(650, l);
  };
  const achter = r.soort === 'perron' ? reik(-1) : lengte / 2, voor = r.soort === 'perron' ? reik(1) : lengte / 2;
  // spoor: langs de bestaande as, met wisselbogen van 120 m aan beide kanten
  const boog = 120;
  const s0 = raak.s - achter - boog, s1 = raak.s + voor + boog;
  // het spoorstuk kan bij een wissel ophouden: daar de as recht doortrekken
  let as = net.stuk(t, Math.max(0, s0), Math.min(t.lengte, s1));
  const verleng = (pts, l, eind) => {
    if (l <= 0) return pts;
    const n = pts.length;
    const [ax, ay, bx, by] = eind ? [pts[n - 4], pts[n - 3], pts[n - 2], pts[n - 1]] : [pts[2], pts[3], pts[0], pts[1]];
    const d = Math.hypot(bx - ax, by - ay) || 1, ex = bx + (bx - ax) / d * l, ey = by + (by - ay) / d * l;
    return eind ? [...pts, ex, ey] : [ex, ey, ...pts];
  };
  as = verleng(verleng(as, -s0, false), s1 - t.lengte, true);
  as = herbemonster(as, 8);
  const punten = [];
  let cum = 0;
  for (let i = 0; i < as.length; i += 2) {
    if (i) cum += Math.hypot(as[i] - as[i - 2], as[i + 1] - as[i - 1]);
    const s = s0 + cum;
    const f = Math.max(0, Math.min(1, Math.min(s - s0, s1 - s) / boog));
    const g = f * f * (3 - 2 * f);        // vloeiende S-boog
    // lokale normaal
    const j = Math.min(as.length - 2, i + 2), h = Math.max(0, i - 2);
    let lx = as[j] - as[h], ly = as[j + 1] - as[h + 1]; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    punten.push([Math.round((as[i] - ly * spoorD * g) * 10) / 10, Math.round((as[i + 1] + lx * spoorD * g) * 10) / 10]);
  }
  // perron: rechthoek langs het spoor (in het midden van het ontwerp)
  const links = [], rechts = [];
  const p0 = Math.round((raak.s - lengte / 2 - s0) / 8) * 2, p1 = Math.round((raak.s + lengte / 2 - s0) / 8) * 2;
  const pm = as.slice(Math.max(0, p0), Math.min(as.length, p1 + 2));
  for (let i = 0; i < pm.length; i += 2) {
    const j = Math.min(pm.length - 2, i + 2), h = Math.max(0, i - 2);
    let lx = pm[j] - pm[h], ly = pm[j + 1] - pm[h + 1]; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    const b1 = perronMidden - breedte / 2, b2 = perronMidden + breedte / 2;
    links.push(pm[i] - ly * b1, pm[i + 1] + lx * b1);
    rechts.push(pm[i] - ly * b2, pm[i + 1] + lx * b2);
  }
  const vlak = [...links];
  for (let i = rechts.length - 2; i >= 0; i -= 2) vlak.push(rechts[i], rechts[i + 1]);
  vlak.push(vlak[0], vlak[1]);
  return { punten, perron: vlak.map(v => Math.round(v * 10) / 10), kant: teken, afstand: Math.abs(spoorD), naast: r.soort };
}
