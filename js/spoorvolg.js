// Routes van andere vervoerders (vormen uit de dienstregeling) op het echte spoor leggen, zodat
// treinen, metro's en trams netjes over de getekende sporen rijden. In Nederland rijden treinen
// rechts: bij meer sporen naast elkaar kiezen we het spoor rechts van de rijrichting.
import { glad } from './net.js';

const SOORTEN = { trein: [0, 4, 8], sneltram: [1, 3, 2], metro: [2, 1], tram: [3, 1] };

function herbemonster(pts, stap) {
  const uit = [pts[0], pts[1]];
  let rest = 0;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], bx = pts[k], by = pts[k + 1], l = Math.hypot(bx - ax, by - ay);
    if (l < 1e-6) continue;
    let s = stap - rest;
    while (s <= l) { uit.push(ax + (bx - ax) * s / l, ay + (by - ay) * s / l); s += stap; }
    rest = l - (s - stap);
  }
  uit.push(pts[pts.length - 2], pts[pts.length - 1]);
  return uit;
}

// geeft nieuwe punten [x,y,...] of null als er geen spoor in de buurt ligt
export function opSpoor(net, pts, modus, jaar) {
  const toegestaan = SOORTEN[modus];
  if (!toegestaan || pts.length < 4) return null;
  const p = herbemonster(pts, 12);
  const uit = [];
  let vorige = null, geraakt = 0;
  for (let i = 0; i < p.length; i += 2) {
    const x = p[i], y = p[i + 1];
    const j = Math.min(p.length - 2, i + 2), h = Math.max(0, i - 2);
    let ux = p[j] - p[h], uy = p[j + 1] - p[h + 1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    let beste = null, bk = Infinity;
    const ci = Math.floor(x / 1000), cj = Math.floor(y / 1000);
    for (let a = ci - 1; a <= ci + 1; a++) for (let b = cj - 1; b <= cj + 1; b++) {
      for (const t of net.tRaster.get(a + ',' + b) || []) {
        if (!toegestaan.includes(t.soort) || t.weg || (t.start && t.start > jaar) || (t.eind && t.eind <= jaar)) continue;
        const [x0, y0, x1, y1] = t.bbox;
        if (x < x0 - 30 || x > x1 + 30 || y < y0 - 30 || y > y1 + 30) continue;
        const q = t.pts;
        for (let k = 2; k < q.length; k += 2) {
          const ax = q[k - 2], ay = q[k - 1], dx = q[k] - ax, dy = q[k + 1] - ay, l2 = dx * dx + dy * dy;
          if (l2 < 1e-6) continue;
          const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
          const px = ax + dx * f, py = ay + dy * f;
          const d = Math.hypot(x - px, y - py);
          if (d > 30) continue;
          const l = Math.sqrt(l2), richting = Math.abs((dx * ux + dy * uy) / l);
          if (richting < 0.85) continue;                         // dwars liggend spoor (overweg, wissel naar elders)
          const rechts = uy * (px - x) - ux * (py - y);          // > 0: spoor ligt rechts van de rijrichting
          // rechts houden: het spoor direct rechts krijgt voorrang, maar niet verder dan het naastgelegen spoor
          const kosten = d - 1.25 * Math.max(-6, Math.min(rechts, 6)) + (t.dienst ? 8 : 0) + (vorige && vorige !== t ? 1.5 : 0) + (1 - richting) * 40;
          if (kosten < bk) { bk = kosten; beste = { px, py, t }; }
        }
      }
    }
    if (beste) { uit.push(beste.px, beste.py); vorige = beste.t; geraakt++; }
    else { uit.push(x, y); vorige = null; }
  }
  if (geraakt < (p.length / 2) * 0.5) return null;
  // Punten blijven precies op het spoor (geen gemiddelde: dat snijdt bochten af en legt de trein tussen twee sporen).
  // Alleen waar de trein van spoor wisselt een korte, rechte overgang (zoals over een wissel), ~70 m lang.
  const gl = uit.slice(), n = uit.length / 2, W = 3;
  for (let i = 1; i < n; i++) {
    const sprong = Math.hypot(uit[i * 2] - uit[i * 2 - 2], uit[i * 2 + 1] - uit[i * 2 - 1]);
    if (sprong < 16) continue; // gewone stap (~12 m): zelfde spoor
    const a = Math.max(0, i - 1 - W), b = Math.min(n - 1, i + W);
    for (let k = a + 1; k < b; k++) { const f = (k - a) / (b - a); gl[k * 2] = uit[a * 2] + (uit[b * 2] - uit[a * 2]) * f; gl[k * 2 + 1] = uit[a * 2 + 1] + (uit[b * 2 + 1] - uit[a * 2 + 1]) * f; }
  }
  return glad(gl, 6);
}

// lijn bijwerken: nieuwe route, cumulatieve afstanden en haltes opnieuw op de route geprojecteerd
export function lijnOpSpoor(net, lijn, jaar) {
  if (lijn._spoor !== undefined) return;
  lijn._spoor = false;
  let gids = lijn.route.pts;
  // zonder echte vorm (alleen rechte lijnen tussen haltes): eerst over het spoornet van halte naar halte
  const lengte = lijn.cum?.[lijn.cum.length - 1] || 0;
  if (gids.length / 2 < lijn.haltes.length * 3 || lengte / (gids.length / 2) > 400) {
    const pts = [];
    for (let i = 1; i < lijn.haltes.length; i++) {
      const a = lijn.haltes[i - 1], b = lijn.haltes[i];
      const r = net.route([a.x, a.y], [b.x, b.y], lijn.modus, jaar);
      const stuk = r && r.lengte < Math.hypot(b.x - a.x, b.y - a.y) * 2.5 + 500 ? r.pts : [a.x, a.y, b.x, b.y];
      pts.push(...(pts.length ? stuk.slice(2) : stuk));
    }
    if (pts.length >= 4) gids = pts;
  }
  const nieuw = opSpoor(net, gids, lijn.modus, jaar) || (gids !== lijn.route.pts ? glad(gids, 30) : null);
  if (!nieuw) return;
  const cum = [0];
  for (let k = 2; k < nieuw.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(nieuw[k] - nieuw[k - 2], nieuw[k + 1] - nieuw[k - 1]));
  // haltes: dichtstbijzijnd punt verder langs de route dan de vorige halte
  const km = [];
  let start = 0;
  for (const h of lijn.haltes) {
    let bd = Infinity, bi = start;
    for (let i = start; i < cum.length; i++) {
      const d = Math.hypot(nieuw[i * 2] - h.x, nieuw[i * 2 + 1] - h.y);
      if (d < bd) { bd = d; bi = i; }
      if (bd < 20 && d > bd + 300) break;
    }
    km.push(cum[bi]); start = bi;
  }
  lijn.route = { ...lijn.route, pts: nieuw, lengte: cum[cum.length - 1] };
  lijn.cum = cum; lijn.km = km; lijn._spoor = true;
}

// Rijbanen voor weergave van lijnen die in twee richtingen rijden (eigen lijnen, nagebouwde lijnen):
// heen en terug elk op het spoor rechts van hun rijrichting. De route zelf (opslag, rijtijden) blijft gelijk.
// lijn._banen = [heen, terug], elk { route: {pts}, cum, km } met km per halte in de volgorde van die rijrichting.
function baanVan(pts, haltes) {
  const cum = [0];
  for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  const km = [];
  let start = 0;
  for (const h of haltes) {
    let bd = Infinity, bi = start;
    for (let i = start; i < cum.length; i++) {
      const d = Math.hypot(pts[i * 2] - h.x, pts[i * 2 + 1] - h.y);
      if (d < bd) { bd = d; bi = i; }
      if (bd < 20 && d > bd + 300) break;
    }
    km.push(cum[bi]); start = bi;
  }
  return { route: { pts }, cum, km };
}
export function rijBanen(net, lijn, jaar) {
  lijn._banenVan = lijn.route.pts; lijn._banen = null;
  const p = lijn.route.pts;
  if (!SOORTEN[lijn.modus] || p.length < 4 || !lijn.vertrek?.[1]?.length) return;
  const omgekeerd = [];
  for (let i = p.length - 2; i >= 0; i -= 2) omgekeerd.push(p[i], p[i + 1]);
  const heen = opSpoor(net, p, lijn.modus, jaar), terug = opSpoor(net, omgekeerd, lijn.modus, jaar);
  if (!heen || !terug) return;
  lijn._banen = [baanVan(heen, lijn.haltes), baanVan(terug, [...lijn.haltes].reverse())];
}
