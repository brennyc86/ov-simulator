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
  // ligt er een perron binnen r meter van (x,y)?
  dichtbij(x, y, r) {
    const gezien = new Set();
    for (let i = Math.floor((x - r) / 250); i <= Math.floor((x + r) / 250); i++)
      for (let j = Math.floor((y - r) / 250); j <= Math.floor((y + r) / 250); j++)
        for (const p of this.raster.get(i + ',' + j) || []) {
          if (gezien.has(p) || p.gemaakt) continue; gezien.add(p);
          const [x0, y0, x1, y1] = p.bbox;
          if (x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r) return true;
        }
    return false;
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
export function ontwerpPerron(net, perrons, x, y, jaar, { kant = 0, lengte = 250, breedte = 5, vorm = 'zij', eind = 1 } = {}) {
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
  // spoor: langs de bestaande as, met wisselbogen van 120 m
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
  as = herbemonster(verleng(verleng(as, -s0, false), s1 - t.lengte, true), 8);
  const asS = [s0]; for (let i = 2; i < as.length; i += 2) asS.push(asS[asS.length - 1] + Math.hypot(as[i] - as[i - 2], as[i + 1] - as[i - 1]));
  const normaal = i => { const j = Math.min(as.length - 2, i + 2), h = Math.max(0, i - 2); let lx = as[j] - as[h], ly = as[j + 1] - as[h + 1]; const ll = Math.hypot(lx, ly) || 1; return [lx / ll, ly / ll]; };
  // spoor op afstand D van de as tussen a en b; bogen alleen aan de kant(en) met een wissel
  const spoorOp = (D, a, b, boogA, boogB) => {
    const pts = [];
    for (let i = 0; i < as.length; i += 2) {
      const sv = asS[i / 2]; if (sv < a - 1e-6 || sv > b + 1e-6) continue;
      const f = Math.max(0, Math.min(1, Math.min(boogA ? (sv - a) / boog : 1, boogB ? (b - sv) / boog : 1)));
      const g = f * f * (3 - 2 * f), [lx, ly] = normaal(i);
      pts.push([Math.round((as[i] - ly * D * g) * 10) / 10, Math.round((as[i + 1] + lx * D * g) * 10) / 10]);
    }
    return pts;
  };
  // perron: rechthoek langs de as tussen a en b, van afstand d1 tot d2
  const perronOp = (d1, d2, a, b) => {
    const L = [], R = [];
    for (let i = 0; i < as.length; i += 2) {
      const sv = asS[i / 2]; if (sv < a || sv > b) continue;
      const [lx, ly] = normaal(i);
      L.push(as[i] - ly * d1, as[i + 1] + lx * d1); R.push(as[i] - ly * d2, as[i + 1] + lx * d2);
    }
    const v = [...L]; for (let i = R.length - 2; i >= 0; i -= 2) v.push(R[i], R[i + 1]); v.push(v[0], v[1]);
    return v.map(x => Math.round(x * 10) / 10);
  };
  // vormen: zij (spoor + zijperron), eiland (2 sporen + eilandperron), langs (alleen spoor langs bestaand perron),
  // kop (kopspoor + perron), kopLangs (kopspoor langs bestaand perron), kop2 (2 kopsporen met eilandperron)
  const naastPerron = r.soort === 'perron';
  if ((vorm === 'langs' || vorm === 'kopLangs') && !naastPerron) vorm = vorm === 'langs' ? 'zij' : 'kop';
  const T = teken, D1 = spoorD, pa = raak.s - lengte / 2, pb = raak.s + lengte / 2;
  const kop = vorm.startsWith('kop');
  // kopspoor: wissel aan één eind (eind = 1: aan de 'voor'-kant), stootjuk aan het andere eind van het perron
  const [ka, kb, bA, bB] = !kop ? [s0, s1, true, true] : eind > 0 ? [pa, s1, false, true] : [s0, pb, true, false];
  const sporen = [], vlakken = [];
  const bE = 8, bZ = breedte; // breedte eilandperron en zijperron
  if (vorm === 'zij' || vorm === 'kop') { sporen.push(spoorOp(D1, ka, kb, bA, bB)); vlakken.push(perronOp(D1 + T * 1.65, D1 + T * (1.65 + bZ), pa, pb)); }
  else if (vorm === 'langs' || vorm === 'kopLangs') sporen.push(spoorOp(D1, ka, kb, bA, bB));
  else if (vorm === 'eiland' || vorm === 'kop2') {
    const D2 = D1 + T * (3.3 + bE);
    sporen.push(spoorOp(D1, ka, kb, bA, bB), spoorOp(D2, ka, kb, bA, bB));
    vlakken.push(perronOp(D1 + T * 1.65, D1 + T * (1.65 + bE), pa, pb));
  }
  return { punten: sporen[0], perron: vlakken[0] || null, sporen, vlakken, vorm, eind, naastPerron, kant: teken, afstand: Math.abs(spoorD), naast: r.soort,
    lengte: sporen.reduce((a, p) => a + p.reduce((s2, q, i) => i ? s2 + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0), 0) };
}

// Enkelspoor verdubbelen: een tweede spoor evenwijdig aan de hele spoortak (van wissel tot wissel),
// op 4,5 m hart-op-hart aan de vrije kant, met wisselbogen aan beide uiteinden.
export function ontwerpVerdubbeling(net, perrons, x, y, jaar, kant = 0) {
  const raak = net.dichtsteTak(x, y, 'trein', jaar, 150);
  if (!raak) return { fout: 'Hier ligt geen spoor.' };
  const t = raak.t;
  if ((t.sporen || 1) >= 2) return { fout: 'Dit stuk is al dubbelspoor.' };
  if (t.lengte < 150) return { fout: 'Dit stuk spoor is te kort om te verdubbelen (minder dan 150 m tussen twee wissels).' };
  let as = herbemonster(net.stuk(t, 0, t.lengte), 10);
  const n = as.length / 2, cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(as[i * 2] - as[i * 2 - 2], as[i * 2 + 1] - as[i * 2 - 1]));
  const normaal = i => { const j = Math.min(n - 1, i + 1), h = Math.max(0, i - 1); let lx = as[j * 2] - as[h * 2], ly = as[j * 2 + 1] - as[h * 2 + 1]; const ll = Math.hypot(lx, ly) || 1; return [lx / ll, ly / ll]; };
  // welke kant is vrij? tel obstakels (ander spoor, perrons) op 4,5 m
  const obstakels = tk => { let k = 0; for (let i = 0; i < n; i += 3) { const [lx, ly] = normaal(i), px = as[i * 2] - ly * 4.5 * tk, py = as[i * 2 + 1] + lx * 4.5 * tk; const d = net.dichtsteTak(px, py, 'trein', jaar, 2); if ((d && d.t !== t) || perrons.op(px, py)) k++; } return k; };
  const tk = kant || (obstakels(1) <= obstakels(-1) ? 1 : -1);
  const boog = Math.min(120, t.lengte / 3), L = cum[n - 1], punten = [];
  for (let i = 0; i < n; i++) {
    const f = Math.min(1, cum[i] / boog, (L - cum[i]) / boog), g = f * f * (3 - 2 * f), [lx, ly] = normaal(i);
    punten.push([Math.round((as[i * 2] - ly * 4.5 * tk * g) * 10) / 10, Math.round((as[i * 2 + 1] + lx * 4.5 * tk * g) * 10) / 10]);
  }
  return { punten, sporen: [punten], vlakken: [], perron: null, kant: tk, lengte: L, tak: t.i, vrij: obstakels(tk) === 0 };
}

// Een eenvoudig perron langs een spoorlijn (voor oude stations zonder ingetekend perron).
// pts = lijn [x,y,...], (x,y) = station; het perron komt aan de kant waar het station ligt.
export function perronLangs(pts, x, y, lengte = 120, breedte = 3.5) {
  let bd = Infinity, bs = 0, cum = 0, zij = 1;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], dx = pts[k] - ax, dy = pts[k + 1] - ay, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
    if (l2 < 1e-6) continue;
    const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
    const d = Math.hypot(x - ax - dx * f, y - ay - dy * f);
    if (d < bd) { bd = d; bs = cum + f * l; zij = (dx * (y - ay) - dy * (x - ax)) >= 0 ? 1 : -1; }
    cum += l;
  }
  if (bd > 80) return null;
  const s0 = Math.max(0, bs - lengte / 2), s1 = Math.min(cum, bs + lengte / 2);
  // punten langs de lijn tussen s0 en s1
  const langs = [];
  let c = 0;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], bx = pts[k], by = pts[k + 1], l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    for (let s = Math.max(s0, c); s <= Math.min(s1, c + l) + 1e-6; s += 10) {
      const f = (s - c) / l; langs.push([ax + (bx - ax) * f, ay + (by - ay) * f, (bx - ax) / l, (by - ay) / l]);
    }
    c += l;
    if (c > s1) break;
  }
  if (langs.length < 2) return null;
  const a = 1.65, b = 1.65 + breedte, links = [], rechts = [];
  for (const [px, py, ux, uy] of langs) {
    links.push(px - uy * a * zij, py + ux * a * zij);
    rechts.push(px - uy * b * zij, py + ux * b * zij);
  }
  const vlak = [...links];
  for (let i = rechts.length - 2; i >= 0; i -= 2) vlak.push(rechts[i], rechts[i + 1]);
  vlak.push(vlak[0], vlak[1]);
  return vlak;
}

// ---------------------------------------------------------------- nieuw station met sporen en perrons
// Dwarsdoorsnede van links naar rechts: 'B' = bestaand spoor, 'S' = nieuw spoor, 'P' = perron.
// sporen = totaal aantal sporen; doorgaand = bestaande sporen blijven zonder perron (snelle treinen rijden door);
// kant = 1/-1: aan welke kant het enige perron of het extra spoor komt.
export function stationDoorsnede(bestaand, sporen, doorgaand, kant = 1) {
  sporen = Math.max(bestaand, sporen);
  const nieuw = sporen - bestaand;
  // naar buiten vanaf het bestaande blok: welke reeks hoort bij k nieuwe sporen aan die kant
  const zijde = (k, langsBestaand) => {
    const uit = [];
    if (langsBestaand) { uit.push('P'); let n = 0; while (n < k) { uit.push('S'); n++; if (n < k) { uit.push('S'); n++; uit.push('P'); } } return uit; }
    let n = 0; while (n < k) { uit.push('S'); n++; uit.push('P'); if (n < k) { uit.push('S'); n++; } }
    return uit;
  };
  let links, rechts;
  if (bestaand === 1 && !doorgaand && nieuw === 0) { links = kant < 0 ? ['P'] : []; rechts = kant > 0 ? ['P'] : []; }
  else {
    const a = Math.floor(nieuw / 2), b = nieuw - a; // het meeste aan de gekozen kant
    const [kl, kr] = kant > 0 ? [a, b] : [b, a];
    if (bestaand === 1 && !doorgaand) { // één bestaand spoor: perron aan één kant, nieuwe sporen aan de andere kant via een eiland
      links = kant < 0 ? zijde(kl + kr, true) : zijde(0, false); rechts = kant > 0 ? zijde(kl + kr, true) : zijde(0, false);
      if (kant > 0) { links = []; rechts = zijde(nieuw, true); } else { rechts = []; links = zijde(nieuw, true); }
    } else { links = zijde(kl, !doorgaand); rechts = zijde(kr, !doorgaand); }
  }
  return [...links.reverse(), ...Array(bestaand).fill('B'), ...rechts];
}
export const doorsnedeTekst = d => d.join(' ').replace(/B/g, '═').replace(/S/g, '─').replace(/P/g, '▭');

export function ontwerpStation(net, perrons, x, y, jaar, { sporen = 0, doorgaand = false, kant = 1, lengte = 220, modus = 'trein' } = {}) {
  const raak = net.dichtsteTak(x, y, modus, jaar, 150);
  if (!raak) return null;
  const t = raak.t;
  const a = net.stuk(t, Math.max(0, raak.s - 40), Math.min(t.lengte, raak.s + 40));
  let ux = a[a.length - 2] - a[0], uy = a[a.length - 1] - a[1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
  const nx = -uy, ny = ux;
  // is er een tweede bestaand spoor naast (dubbelspoor)? aan welke kant?
  const ander = d => { for (const l of [-60, 0, 60]) { const r = net.dichtsteTak(raak.x + ux * l + nx * d, raak.y + uy * l + ny * d, modus, jaar, 1.2); if (r && r.t !== t) return true; } return false; };
  let tweede = 0;
  for (let d = 3.5; d <= 6; d += 0.5) { if (ander(d)) { tweede = d; break; } if (ander(-d)) { tweede = -d; break; } }
  const bestaand = tweede ? 2 : 1;
  const doorsnede = stationDoorsnede(bestaand, sporen || bestaand, doorgaand, kant);
  // posities (m, links = negatief) van elk element; het bestaande blok ligt op 0 en 'tweede'
  const B0 = Math.min(0, tweede), B1 = Math.max(0, tweede);
  const iB = doorsnede.indexOf('B'), pos = new Array(doorsnede.length);
  const breedte = (i) => { const l = doorsnede[i - 1], r = doorsnede[i + 1]; return (l === 'S' || l === 'B') && (r === 'S' || r === 'B') ? 8 : 4.5; }; // eiland of zijperron
  const stap = (i, j) => { const p = doorsnede[i], q = doorsnede[j]; if (p !== 'P' && q !== 'P') return 4.5; const w = p === 'P' ? breedte(i) : breedte(j); return 1.65 + w / 2; };
  pos[iB] = B0; if (bestaand === 2) pos[iB + 1] = B1;
  for (let i = iB - 1; i >= 0; i--) pos[i] = pos[i + 1] - stap(i, i + 1);
  for (let i = iB + bestaand; i < doorsnede.length; i++) pos[i] = pos[i - 1] + stap(i - 1, i);
  // as langs het bestaande spoor
  const boog = 120, s0 = raak.s - lengte / 2 - boog, s1 = raak.s + lengte / 2 + boog;
  let as = net.stuk(t, Math.max(0, s0), Math.min(t.lengte, s1));
  const verleng = (pts, l, eind) => { if (l <= 0) return pts; const n = pts.length; const [ax, ay, bx, by] = eind ? [pts[n - 4], pts[n - 3], pts[n - 2], pts[n - 1]] : [pts[2], pts[3], pts[0], pts[1]]; const d = Math.hypot(bx - ax, by - ay) || 1; return eind ? [...pts, bx + (bx - ax) / d * l, by + (by - ay) / d * l] : [bx + (bx - ax) / d * l, by + (by - ay) / d * l, ...pts]; };
  as = herbemonster(verleng(verleng(as, -s0, false), s1 - t.lengte, true), 8);
  const asS = [s0]; for (let i = 2; i < as.length; i += 2) asS.push(asS[asS.length - 1] + Math.hypot(as[i] - as[i - 2], as[i + 1] - as[i - 1]));
  // positie langs de as: links van de rijrichting is +normaal; onze 'links' (negatief) ligt aan de -normaal-kant
  const normaal = i => { const j = Math.min(as.length - 2, i + 2), h = Math.max(0, i - 2); let lx = as[j] - as[h], ly = as[j + 1] - as[h + 1]; const ll = Math.hypot(lx, ly) || 1; return [lx / ll, ly / ll]; };
  const spoorOp = D => { const pts = []; for (let i = 0; i < as.length; i += 2) { const sv = asS[i / 2], f = Math.max(0, Math.min(1, (sv - s0) / boog, (s1 - sv) / boog)), g = f * f * (3 - 2 * f), [lx, ly] = normaal(i); pts.push([Math.round((as[i] - ly * D * g) * 10) / 10, Math.round((as[i + 1] + lx * D * g) * 10) / 10]); } return pts; };
  const perronOp = (d1, d2) => { const L = [], R = []; for (let i = 0; i < as.length; i += 2) { const sv = asS[i / 2]; if (sv < raak.s - lengte / 2 || sv > raak.s + lengte / 2) continue; const [lx, ly] = normaal(i); L.push(as[i] - ly * d1, as[i + 1] + lx * d1); R.push(as[i] - ly * d2, as[i + 1] + lx * d2); } const v = [...L]; for (let i = R.length - 2; i >= 0; i -= 2) v.push(R[i], R[i + 1]); v.push(v[0], v[1]); return v.map(q => Math.round(q * 10) / 10); };
  const sporenUit = [], vlakken = [];
  doorsnede.forEach((e, i) => {
    if (e === 'S') sporenUit.push(spoorOp(pos[i]));
    if (e === 'P') { const w = breedte(i); vlakken.push(perronOp(pos[i] - w / 2, pos[i] + w / 2)); }
  });
  const lengteSpoor = sporenUit.reduce((s, p) => s + p.reduce((a2, q, i) => i ? a2 + Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) : 0, 0), 0);
  return { doorsnede, bestaand, sporen: sporenUit, vlakken, lengte: lengteSpoor, eilanden: doorsnede.filter((e, i) => e === 'P' && breedte(i) === 8).length, x: raak.x, y: raak.y, punten: sporenUit[0] || [[raak.x, raak.y]] };
}
