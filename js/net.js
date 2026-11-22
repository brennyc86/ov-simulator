// Spoorgraaf uit data/spoor.json: tekenen per jaar en routes zoeken (Dijkstra).
import { rdNaarWgs, wgsNaarRd } from './geo.js';

// soorten: 0 rail, 1 light_rail, 2 subway, 3 tram, 4 narrow_gauge, 5 disused, 6 abandoned/razed, 7 construction, 8 preserved
const MODUS_SOORT = { trein: [0, 4, 8], sneltram: [1, 3, 2], metro: [2, 1], tram: [3, 1] };

// Hoeken in het spoor licht afronden (de OSM-lijnen zijn vereenvoudigd en daardoor hoekig).
// Begin- en eindpunt blijven staan, zodat de takken aan elkaar blijven zitten.
export function glad(pts, max = 60) {
  const uit = [pts[0], pts[1]];
  for (let k = 2; k < pts.length - 2; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], px = pts[k], py = pts[k + 1], bx = pts[k + 2], by = pts[k + 3];
    const l1 = Math.hypot(px - ax, py - ay), l2 = Math.hypot(bx - px, by - py);
    if (l1 < 0.5 || l2 < 0.5) { uit.push(px, py); continue; }
    const u1x = (px - ax) / l1, u1y = (py - ay) / l1, u2x = (bx - px) / l2, u2y = (by - py) / l2;
    const cos = u1x * u2x + u1y * u2y;
    if (cos > 0.99985 || cos < 0.3) { uit.push(px, py); continue; } // recht genoeg, of een echte knik (kopspoor)
    const d = Math.min(l1 * 0.45, l2 * 0.45, max);
    const sx = px - u1x * d, sy = py - u1y * d, ex = px + u2x * d, ey = py + u2y * d;
    const n = cos > 0.998 ? 2 : 5;
    for (let i = 0; i <= n; i++) {
      const f = i / n, g = 1 - f;
      uit.push(g * g * sx + 2 * g * f * px + f * f * ex, g * g * sy + 2 * g * f * py + f * f * ey);
    }
  }
  uit.push(pts[pts.length - 2], pts[pts.length - 1]);
  return uit;
}

export class Net {
  constructor(spoor) {
    this.knopen = spoor ? Float64Array.from(spoor.knopen) : new Float64Array();
    this.namen = spoor?.namen || [];
    this.takken = (spoor?.takken || []).map((t, i) => {
      const [a, b, soort, dienst, gebruik, sporen, vmax, elek, start, eind, naam, tussen] = t;
      let pts = [this.knopen[a * 2], this.knopen[a * 2 + 1]];
      let x = pts[0], y = pts[1];
      for (let k = 0; k < tussen.length; k += 2) { x += tussen[k]; y += tussen[k + 1]; pts.push(x, y); }
      pts.push(this.knopen[b * 2], this.knopen[b * 2 + 1]);
      if (pts.length > 4) pts = glad(pts);
      let lengte = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < pts.length; k += 2) {
        if (k) lengte += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
        x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]);
      }
      return { i, a, b, soort, dienst, gebruik, sporen, vmax, elek, start, eind, naam, pts, lengte, bbox: [x0, y0, x1, y1], eigenaar: 'prorail' };
    });
    this.eigen = []; // door spelers aangelegd spoor
    this.bouwBuren();
    this.paden = new Map();
  }
  bouwBuren() {
    this.buren = new Map();
    this.tRaster = new Map();
    for (const t of [...this.takken, ...this.eigen]) {
      if (t.weg) continue;
      for (const [k, ander] of [[t.a, t.b], [t.b, t.a]]) {
        if (!this.buren.has(k)) this.buren.set(k, []);
        this.buren.get(k).push({ t, naar: ander });
      }
      const [x0, y0, x1, y1] = t.bbox;
      for (let i = Math.floor(x0 / 1000); i <= Math.floor(x1 / 1000); i++)
        for (let j = Math.floor(y0 / 1000); j <= Math.floor(y1 / 1000); j++) {
          const sl = i + ',' + j;
          if (!this.tRaster.has(sl)) this.tRaster.set(sl, []);
          this.tRaster.get(sl).push(t);
        }
    }
  }
  // Verdwenen lijnen (OpenHistoricalMap) als losse takken toevoegen, zodat ze in hun jaren berijdbaar zijn.
  // Uiteinden die (bijna) samenvallen krijgen dezelfde knoop; ze worden niet op het huidige net aangesloten.
  voegHistorischToe(lijnen) {
    const SOORT = { tram: 3, rail: 0, smal: 4, light_rail: 1, subway: 2 };
    const knopen = new Map();
    let volgende = -1e6 - this.extra.size;
    // knopen binnen 6 m van elkaar samenvoegen (raster van 6 m, buren meegezocht)
    const knoop = (x, y) => {
      const ci = Math.floor(x / 6), cj = Math.floor(y / 6);
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++)
        for (const id of knopen.get(i + ',' + j) || []) { const [kx, ky] = this.extra.get(id); if (Math.hypot(kx - x, ky - y) < 6) return id; }
      const id = volgende--; this.extra.set(id, [x, y]);
      const sl = ci + ',' + cj; if (!knopen.has(sl)) knopen.set(sl, []); knopen.get(sl).push(id);
      return id;
    };
    for (const l of lijnen) {
      if (l.pts.length < 4) continue;
      const pts = l.pts.length > 4 ? glad(l.pts) : l.pts;
      let lengte = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let k = 0; k < pts.length; k += 2) {
        if (k) lengte += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
        x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]);
      }
      const a = knoop(pts[0], pts[1]), b = knoop(pts[pts.length - 2], pts[pts.length - 1]);
      this.takken.push({ i: this.takken.length, a, b, soort: SOORT[l.soort] ?? 0, dienst: 0, gebruik: 0, sporen: 1, vmax: l.soort === 'tram' ? 25 : 80, elek: 0,
        start: l.van, eind: l.tot, naam: -1, pts, lengte, bbox: [x0, y0, x1, y1], eigenaar: 'historisch', hist: true });
    }
    this.bouwBuren();
  }
  knoopX(k) { return k >= 0 ? this.knopen[k * 2] : this.extra.get(k)[0]; }
  knoopY(k) { return k >= 0 ? this.knopen[k * 2 + 1] : this.extra.get(k)[1]; }
  get extra() { return this._extra || (this._extra = new Map()); }

  bestaat(t, jaar) {
    if (t.soort === 7) return false;
    if (t.start && t.start > jaar) return false;
    if (t.soort === 5 || t.soort === 6) {
      // opgeheven spoor: alleen tonen vóór het eindjaar; zonder eindjaar alleen in historische jaren (< 1990)
      return t.eind ? jaar < t.eind : jaar < 1990;
    }
    if (t.eind && t.eind <= jaar) return false;
    return true;
  }
  rijdbaar(t, modus, jaar) {
    if (!this.bestaat(t, jaar)) return false;
    const toegestaan = MODUS_SOORT[modus] || [];
    if (toegestaan.includes(t.soort)) return true;
    // opgeheven spoor telt in het verleden als het soort dat het toen was (onbekend: trein)
    return (t.soort === 5 || t.soort === 6) && modus === 'trein';
  }
  // dichtstbijzijnde punt op rijdbaar spoor: {t, s (m vanaf knoop a), x, y, d}
  dichtsteTak(x, y, modus, jaar, max = 600) {
    let beste = null, bd = max;
    const ci = Math.floor(x / 1000), cj = Math.floor(y / 1000), r = Math.ceil(max / 1000);
    const gezien = new Set();
    for (let i = ci - r; i <= ci + r; i++) for (let j = cj - r; j <= cj + r; j++) {
      for (const t of this.tRaster.get(i + ',' + j) || []) {
        if (gezien.has(t)) continue; gezien.add(t);
        if (!this.rijdbaar(t, modus, jaar)) continue;
        const [x0, y0, x1, y1] = t.bbox;
        if (x < x0 - bd || x > x1 + bd || y < y0 - bd || y > y1 + bd) continue;
        const p = t.pts; let s = 0;
        for (let k = 2; k < p.length; k += 2) {
          const ax = p[k - 2], ay = p[k - 1], dx = p[k] - ax, dy = p[k + 1] - ay, l2 = dx * dx + dy * dy || 1e-9;
          const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
          const px = ax + dx * f, py = ay + dy * f, d = Math.hypot(x - px, y - py), l = Math.sqrt(l2);
          // hoofdsporen licht voortrekken boven opstelsporen
          const dd = d + (t.dienst ? 15 : 0);
          if (dd < bd) { bd = dd; beste = { t, s: s + f * l, x: px, y: py, d }; }
          s += l;
        }
      }
    }
    return beste;
  }
  dichtsteKnoop(x, y, modus, jaar, max = 600) { const p = this.dichtsteTak(x, y, modus, jaar, max); return p ? p : null; }
  // punten langs tak t van afstand s0 naar s1 (mag terug lopen)
  stuk(t, s0, s1) {
    const p = t.pts, cum = [0];
    for (let k = 2; k < p.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(p[k] - p[k - 2], p[k + 1] - p[k - 1]));
    const op = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = Math.max(0, Math.min(1, (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1))); return [p[(i - 1) * 2] + (p[i * 2] - p[(i - 1) * 2]) * f, p[(i - 1) * 2 + 1] + (p[i * 2 + 1] - p[(i - 1) * 2 + 1]) * f]; };
    const uit = [...op(s0)];
    if (s1 >= s0) { for (let i = 0; i < cum.length; i++) if (cum[i] > s0 && cum[i] < s1) uit.push(p[i * 2], p[i * 2 + 1]); }
    else { for (let i = cum.length - 1; i >= 0; i--) if (cum[i] < s0 && cum[i] > s1) uit.push(p[i * 2], p[i * 2 + 1]); }
    uit.push(...op(s1));
    return uit;
  }
  kosten(t) {
    const v = (t.vmax || (t.soort === 3 ? 40 : 100)) / 3.6;
    return t.lengte / v * (t.dienst === 2 || t.dienst === 1 ? 3 : 1);
  }
  // kortste reistijd over het spoor; geeft {pts:[x,y,...], lengte, takken:[...]} of null
  route(van, naar, modus, jaar) {
    const A = this.dichtsteTak(van[0], van[1], modus, jaar), B = this.dichtsteTak(naar[0], naar[1], modus, jaar);
    if (!A || !B) return null;
    if (A.t === B.t) {
      const pts = this.stuk(A.t, A.s, B.s);
      return { pts, lengte: Math.abs(B.s - A.s), takken: [A.t.i] };
    }
    const fa = this.kosten(A.t) / A.t.lengte, fb = this.kosten(B.t) / B.t.lengte;
    const dist = new Map(), vorig = new Map(), heap = [];
    const zet = (k, g, v) => { if (g < (dist.get(k) ?? Infinity)) { dist.set(k, g); vorig.set(k, v); heapPush(heap, [g, k]); } };
    zet(A.t.a, A.s * fa, null); zet(A.t.b, (A.t.lengte - A.s) * fa, null);
    const doelA = B.t.a, doelB = B.t.b;
    let klaar = 0, grens = Infinity;
    while (heap.length) {
      const [g, k] = heapPop(heap);
      if (g > (dist.get(k) ?? Infinity)) continue;
      if (g > grens) break;
      if (k === doelA || k === doelB) {
        klaar++;
        const eind = Math.min((dist.get(doelA) ?? Infinity) + B.s * fb, (dist.get(doelB) ?? Infinity) + (B.t.lengte - B.s) * fb);
        grens = eind;
        if (klaar >= 2) break;
      }
      for (const { t, naar: n } of this.buren.get(k) || []) {
        if (t === A.t || t === B.t || !this.rijdbaar(t, modus, jaar)) continue;
        zet(n, g + this.kosten(t), { k, t });
      }
    }
    const viaA = (dist.get(doelA) ?? Infinity) + B.s * fb, viaB = (dist.get(doelB) ?? Infinity) + (B.t.lengte - B.s) * fb;
    if (!isFinite(Math.min(viaA, viaB))) return null;
    const eindKnoop = viaA <= viaB ? doelA : doelB;
    const reeks = [];
    let k = eindKnoop;
    while (vorig.get(k)) { const v = vorig.get(k); reeks.push({ t: v.t, van: v.k }); k = v.k; }
    reeks.reverse();
    const startKnoop = k; // A.t.a of A.t.b
    const pts = [van[0], van[1], ...this.stuk(A.t, A.s, startKnoop === A.t.a ? 0 : A.t.lengte)];
    let lengte = startKnoop === A.t.a ? A.s : A.t.lengte - A.s;
    const takken = [A.t.i];
    for (const { t, van: vk } of reeks) {
      const p = t.pts, vooruit = t.a === vk;
      takken.push(t.i);
      for (let i = 0; i < p.length; i += 2) { const j = vooruit ? i : p.length - 2 - i; pts.push(p[j], p[j + 1]); }
      lengte += t.lengte;
    }
    pts.push(...this.stuk(B.t, eindKnoop === B.t.a ? 0 : B.t.lengte, B.s), naar[0], naar[1]);
    lengte += eindKnoop === B.t.a ? B.s : B.t.lengte - B.s;
    takken.push(B.t.i);
    return { pts, lengte, takken };
  }
  // tak t splitsen op afstand s; geeft de nieuwe knoop
  splits(t, s) {
    const nk = -1 - this.extra.size;
    const [x, y] = this.stuk(t, s, s).slice(0, 2);
    this.extra.set(nk, [x, y]);
    const p1 = this.stuk(t, 0, s), p2 = this.stuk(t, s, t.lengte);
    const lijst = t.eigenaar === 'prorail' ? this.takken : this.eigen;
    const t2 = { ...t, i: t.eigenaar === 'prorail' ? this.takken.length : 1e6 + this.eigen.length, a: nk, b: t.b, pts: p2, lengte: t.lengte - s, bbox: bboxVan(p2) };
    Object.assign(t, { b: nk, pts: p1, lengte: s, bbox: bboxVan(p1) });
    lijst.push(t2);
    return nk;
  }
  // minste aantal sporen langs een reeks takken (enkelspoor bepaalt de capaciteit)
  minSporen(takken) {
    let m = 9;
    for (const i of takken) {
      const t = this.takken[i] || this.eigen.find(e => e.i === i);
      if (t && t.dienst === 0) m = Math.min(m, Math.max(1, t.sporen || 1));
    }
    return m === 9 ? 2 : m;
  }
  voegEigenSpoorToe(punten, eigenaar, sporen, jaar) {
    // begin en eind worden aan het dichtstbijzijnde spoor gekoppeld (binnen 250 m), anders losse eindpunten
    const koppel = (p) => {
      const d = this.dichtsteTak(p[0], p[1], 'trein', jaar, 250);
      if (d) {
        if (d.s < 5) return d.t.a;
        if (d.t.lengte - d.s < 5) return d.t.b;
        return this.splits(d.t, d.s);
      }
      const nk = -1 - this.extra.size;
      this.extra.set(nk, p);
      return nk;
    };
    const a = koppel(punten[0]), b = koppel(punten[punten.length - 1]);
    const pts = [this.knoopX(a), this.knoopY(a)];
    for (const p of punten.slice(1, -1)) pts.push(p[0], p[1]);
    pts.push(this.knoopX(b), this.knoopY(b));
    let lengte = 0;
    for (let k = 2; k < pts.length; k += 2) lengte += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]);
    const t = { i: 1e6 + this.eigen.length, a, b, soort: 0, dienst: 0, gebruik: 0, sporen, vmax: 140, elek: 1,
      start: jaar, eind: 0, naam: 0, pts, lengte, bbox: bboxVan(pts), eigenaar };
    this.eigen.push(t);
    this.bouwBuren();
    return t;
  }
}

export function bboxVan(pts) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (let k = 0; k < pts.length; k += 2) {
    x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]);
  }
  return [x0, y0, x1, y1];
}

function heapPush(h, v) { h.push(v); let i = h.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } }
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) { h[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < h.length && h[l][0] < h[m][0]) m = l; if (r < h.length && h[r][0] < h[m][0]) m = r; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
  return top;
}

// Busroute over de weg via de openbare OSRM-server (zoals de reisplanner); valt terug op rechte lijnen.
const osrmCache = new Map();
export async function wegRoute(punten) {
  const sleutel = punten.map(p => p.map(Math.round).join(',')).join(';');
  if (osrmCache.has(sleutel)) return osrmCache.get(sleutel);
  try {
    const coords = punten.map(([x, y]) => { const [la, lo] = rdNaarWgs(x, y); return `${lo.toFixed(5)},${la.toFixed(5)}`; }).join(';');
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=simplified&geometries=geojson`);
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    const pts = [];
    for (const [lo, la] of j.routes[0].geometry.coordinates) { const [x, y] = wgsNaarRd(la, lo); pts.push(Math.round(x), Math.round(y)); }
    const uit = { pts, lengte: j.routes[0].distance, weg: true };
    osrmCache.set(sleutel, uit);
    return uit;
  } catch {
    const pts = punten.flat();
    let lengte = 0;
    for (let k = 2; k < pts.length; k += 2) lengte += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]) * 1.3;
    return { pts, lengte, weg: false };
  }
}
