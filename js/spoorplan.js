// Spoorplanner: de dienstregeling ligt van tevoren vast en is conflictvrij.
// - Enkelspoor: een trein rijdt een enkelspoorstuk pas op als er geen tegentrein op rijdt. Hij wacht daarvoor op
//   de laatste halte vóór dat stuk (een station of het eind van het dubbelspoor), zodat de treinen elkaar kruisen
//   waar dat kan. Een passeerspoor (kort stukje dubbelspoor) splitst een enkelspoorstuk in tweeën.
// - Zelfde richting (ook op dubbelspoor): minstens VOLG seconden tussen twee treinen en niet door elkaar heen
//   rijden; een snellere trein wacht dus tot hij achter de voorganger past. Vanaf 3 sporen kan inhalen.
// Bestaande vervoerders rijden hun echte dienstregeling: die ligt vast en wordt alleen geboekt (niet verschoven).
// Daarna worden jouw lijnen (en bijzondere ritten en goederentreinen) op vertrektijd ingepland.
// Resultaat per lijn: lijn._ritWacht = Map('r:vertrek' -> [{t, w, h}] wachtplekken (op een halte of vóór het enkelspoor))
// en lijn._kruis = { ritten, wacht, mislukt } voor het overzicht.
import { puntOp } from './spel.js';
import { MODI } from './vloot.js';

const STAP = 150;          // m tussen proefpunten langs de lijn
const ZOEK = 35;           // m: zo ver mag het spoor van de lijn liggen
export const VOLG = 120;   // s opvolgtijd in dezelfde richting
export const KRUIS = 30;   // s marge tussen tegentreinen op enkelspoor
const MAX_WACHT = 25 * 60;
const MIN_ENKEL = 1500;   // m: korter enkelspoor telt niet als enkelspoorbaanvak // s: meer wachten dan dit per rit lossen we niet op (te vol)

// projectie van (x, y) op tak t: afstand vanaf knoop a
function opTak(t, x, y) {
  const p = t.pts; let s = 0, bs = 0, bd = Infinity;
  for (let k = 2; k < p.length; k += 2) {
    const ax = p[k - 2], ay = p[k - 1], dx = p[k] - ax, dy = p[k + 1] - ay, l2 = dx * dx + dy * dy || 1e-9, l = Math.sqrt(l2);
    const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), d = Math.hypot(x - ax - dx * f, y - ay - dy * f);
    if (d < bd) { bd = d; bs = s + f * l; }
    s += l;
  }
  return bs;
}

// stukken spoor langs de lijn (in lijn-meters, cum): [{tak, s0, s1, dir, enkel}], plus enkelspoorblokken
export function blokkenVan(lijn, net, jaar, bijStation = () => false) {
  if (lijn._blokVan === lijn.route?.pts && lijn._blokJaar === jaar && lijn._blokVersie === (bijStation.versie || 0)) return lijn._blok;
  const cum = lijn.cum, L = cum?.[cum.length - 1] || 0, stukken = [];
  let cur = null;
  for (let s = STAP / 2; s < L; s += STAP) {
    const [x, y] = puntOp(lijn, s), b = net.dichtsteTak(x, y, 'trein', jaar, ZOEK), t = b?.t;
    if (!t || t.dienst) { cur = null; continue; }
    // pA/pB: plek op de tak (m vanaf knoop a) aan het begin en eind van dit stuk van de lijn
    if (cur && cur.tak === t.i && cur.station === bijStation(x, y)) { cur.s1 = Math.min(L, s + STAP / 2); cur.pB = b.s; cur.n++; continue; }
    cur = { tak: t.i, s0: Math.max(0, s - STAP / 2), s1: Math.min(L, s + STAP / 2), pA: b.s, pB: b.s, n: 1, lengte: t.lengte, sporen: t.sporen || 1, station: bijStation(x, y) };
    stukken.push(cur);
  }
  // richting op de tak en de plek op de tak doortrekken tot de randen van het stuk (halve stap)
  for (const st of stukken) {
    if (st.n === 1) { const [x, y] = puntOp(lijn, Math.min(L, (st.s0 + st.s1) / 2 + 25)); const t = net.takKlaar(st.tak); st.pB = opTak(t, x, y); }
    st.dir = st.pB >= st.pA ? 1 : -1;
    const k = (st.pB - st.pA) / Math.max(1, (st.s1 - st.s0) - (st.n > 1 ? STAP : 0) || 1);
    const rand = st.n > 1 ? STAP / 2 : 0;
    st.pA = Math.max(0, Math.min(st.lengte, st.pA - k * rand)); st.pB = Math.max(0, Math.min(st.lengte, st.pB + k * rand));
    if (st.n === 1) { st.pA = Math.max(0, Math.min(st.lengte, st.pA - st.dir * STAP / 2)); st.pB = Math.max(0, Math.min(st.lengte, st.pA + st.dir * STAP)); }
  }
  // blokken: aaneengesloten enkelspoor wordt één blok (je kunt er niet halverwege kruisen); de rest per stuk
  const blok = [];
  for (const st of stukken) {
    // stations zijn kruispunten (perron- of passeersporen); enkelspoor telt pas buiten de stations
    const enkel = st.sporen <= 1 && !st.station, vorig = blok[blok.length - 1];
    if (enkel && vorig?.enkel && Math.abs(vorig.s1 - st.s0) < 1) { vorig.s1 = st.s1; vorig.stukken.push(st); continue; }
    // op een station (meer perronsporen dan de data laat zien) kan een trein wachten of ingehaald worden
    blok.push({ s0: st.s0, s1: st.s1, enkel, inhalen: st.sporen >= 3 || st.station, stukken: [st] });
  }
  // korte stukjes 'enkelspoor' (boogjes bij een kruising, ongelijkvloerse aansluitingen, gaten in de data) worden in één
  // richting bereden: geen echt enkelspoor
  for (const b of blok) if (b.enkel && b.s1 - b.s0 < MIN_ENKEL) b.enkel = false;
  lijn._blokVan = lijn.route?.pts; lijn._blokJaar = jaar; lijn._blokVersie = bijStation.versie || 0; lijn._blok = blok;
  return blok;
}

// tijden van één rit (s vanaf middernacht van de vertrekdag) per halte in rijvolgorde, met planwachttijden w
function ritTijden(lijn, r, v, stops = []) {
  const t = lijn.tr?.[r] || lijn.t, n = t.length, halte = lijn._halteTijd ?? MODI[lijn.modus]?.halteTijd ?? 30;
  const dep = new Float64Array(n), aan = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const extra = (lijn.halteWacht?.[`${r}:${i}`] || lijn.dw?.[i] || 0) * 60;
    aan[i] = v * 60 + (i ? t[i] - (i < n - 1 ? halte : 0) : 0);
    dep[i] = v * 60 + t[i] + extra;
  }
  return { dep, aan, stops };
}
// afstand langs de rijrichting voor lijn-meter s
const rijAfst = (lijn, r, s) => r ? lijn.cum[lijn.cum.length - 1] - s : s;
// halte-afstanden in rijvolgorde
function halteAfst(lijn, r) {
  const n = lijn.km.length, L = lijn.cum[lijn.cum.length - 1];
  return Array.from({ length: n }, (_, i) => { const k = r ? lijn.km[n - 1 - i] : lijn.km[i]; return r ? L - k : k; });
}
// tijdstip op rijafstand d (zonder planwachttijden), en met: elke wachtplek vóór d schuift de tijd op
function basisTijd(D, T, d) {
  const n = D.length;
  if (d <= D[0]) return T.dep[0];
  for (let i = 0; i < n - 1; i++) if (d <= D[i + 1]) { const f = (d - D[i]) / Math.max(1, D[i + 1] - D[i]); return T.dep[i] + (T.aan[i + 1] - T.dep[i]) * f; }
  return T.aan[n - 1];
}
function tijdOp(D, T, d) { let t = basisTijd(D, T, d); for (const s of T.stops) if (s.d < d - 1) t += s.w; return t; }

// bezetting per tak per uur: key `${tak}:${uur}` -> [{in, uit, dir, enkel}]
class Bezetting {
  constructor() { this.m = new Map(); }
  *rond(tak, a, b) {
    const seen = new Set();
    for (let h = Math.floor(a / 3600) - 1; h <= Math.floor(b / 3600) + 1; h++) for (const o of this.m.get(tak * 64 + h) || []) if (!seen.has(o)) { seen.add(o); yield o; }
  }
  zet(tak, o) {
    const a = Math.min(o.in, o.tA, o.tB), b = Math.max(o.uit, o.tA, o.tB); if (!(b - a < 86400)) return;
    for (let h = Math.floor(a / 3600); h <= Math.floor(b / 3600); h++) { const k = tak * 64 + h; let l = this.m.get(k); if (!l) this.m.set(k, l = []); l.push(o); }
  }
}

// tijd waarop een boeking (of rit) op plek p van de tak is (lineair binnen het stuk)
const tijdBij = (o, p) => o.tA + (o.tB - o.tA) * Math.max(0, Math.min(1, (p - o.pA) / ((o.pB - o.pA) || 1)));
// benodigde vertraging (s) om dit blok conflictvrij te berijden; 0 = vrij. eigen: stukken met {pA,pB,tA,tB,dir} van deze rit
function nodigVoor(bez, blok, eigenStukken, tin, tuit, wie) {
  let d = 0;
  for (const e of eigenStukken) {
    const lo0 = Math.min(e.pA, e.pB), hi0 = Math.max(e.pA, e.pB);
    for (const o of bez.rond(e.tak, Math.min(e.tA, e.tB, tin) - 600, Math.max(e.tA, e.tB, tuit) + 600)) {
      if (o.wie === wie) continue;
      const lo = Math.max(lo0, Math.min(o.pA, o.pB)), hi = Math.min(hi0, Math.max(o.pA, o.pB));
      if (hi - lo < 30) continue; // ander deel van de tak
      if (o.dir !== e.dir) {
        // tegentrein: alleen op enkelspoor een probleem (dan mag er niemand tegen in rijden tot het blok vrij is)
        if (!(blok.enkel || o.enkel)) continue;
        const a0 = blok.enkel ? tin : Math.min(e.tA, e.tB), a1 = blok.enkel ? tuit : Math.max(e.tA, e.tB);
        const b0 = o.enkel ? o.in : Math.min(o.tA, o.tB), b1 = o.enkel ? o.uit : Math.max(o.tA, o.tB);
        if (a0 < b1 + KRUIS && a1 > b0 - KRUIS) { d = Math.max(d, b1 + KRUIS - a0); log('tegen', e.tak, o, a0, a1, wie); }
      } else if (!blok.inhalen && !o.inhalen) {
        // zelfde richting: op het gedeelde stuk voor de ander blijven, of er netjes achter
        const p0 = e.dir > 0 ? lo : hi, p1 = e.dir > 0 ? hi : lo; // in rijrichting: eerst p0, dan p1
        const a0 = tijdBij(e, p0), a1 = tijdBij(e, p1), b0 = tijdBij(o, p0), b1 = tijdBij(o, p1);
        const voor = a0 <= b0 - VOLG && a1 <= b1 - VOLG, achter = a0 >= b0 + VOLG && a1 >= b1 + VOLG;
        if (!voor && !achter) { d = Math.max(d, b0 + VOLG - a0, b1 + VOLG - a1); log('volg', e.tak, o, a0, a1, wie); }
      }
    }
  }
  return Math.max(0, d);
}
const log = (soort, tak, o, a0, a1, wie) => { if (globalThis.__planLog && wie.lijn === globalThis.__planDoel) globalThis.__planLog.push([soort, tak, o.wie.lijn.naam, Math.round(Math.min(o.tA, o.tB)), Math.round(Math.max(o.tA, o.tB)), Math.round(a0), Math.round(a1)]); };

// plan één rit: wachttijden per halte (rijvolgorde) zodat alle blokken vrij zijn; daarna boeken
function planRit(bez, lijn, r, v, blokken, wie, vast = false, relevant = null) {
  const t = lijn.tr?.[r] || lijn.t, n = t.length;
  const D = halteAfst(lijn, r);
  const rdir = r ? -1 : 1;
  // alleen het deel van de route tussen de eerste en laatste halte (een vorm kan langer zijn dan de rit)
  const lo = D[0], hi = D[n - 1];
  const bl = blokken.map(b => { const a = rijAfst(lijn, r, b.s0), c = rijAfst(lijn, r, b.s1); return { b, in: Math.max(lo, Math.min(a, c)), uit: Math.min(hi, Math.max(a, c)) }; })
    .filter(x => x.uit - x.in > 20).sort((x, y) => x.in - y.in);
  // stukken van een blok met hun plek op de tak en tijden (in rijrichting)
  const stukTijden = (x, T) => x.b.stukken.flatMap(st => {
    let dA = rijAfst(lijn, r, st.s0), dB = rijAfst(lijn, r, st.s1); // rijafstand bij pA en pB
    const k = (st.pB - st.pA) / ((dB - dA) || 1);
    const clamp = d => Math.max(lo, Math.min(hi, d));
    const cA = clamp(dA), cB = clamp(dB); if (Math.abs(cB - cA) < 20) return [];
    const pA = st.pA + k * (cA - dA), pB = st.pA + k * (cB - dA);
    return [{ tak: st.tak, pA, pB, tA: tijdOp(D, T, cA), tB: tijdOp(D, T, cB), dir: st.dir * rdir }];
  });
  // wachtplekken: {d (rijafstand), w (s), h (halte-index of -1 = bij een sein/passeerspoor vóór het enkelspoor)}
  const stops = [];
  let T = ritTijden(lijn, r, v, stops), totaal = 0, mislukt = false;
  for (let k = 0; k < (vast ? 0 : bl.length); k++) {
    const x = bl[k];
    for (let poging = 0; poging < 8; poging++) {
      const tin = tijdOp(D, T, x.in), tuit = tijdOp(D, T, x.uit);
      const d = nodigVoor(bez, x.b, stukTijden(x, T), tin, tuit, wie);
      if (d <= 0.5) break;
      // waar wachten: op de laatste halte vóór het blok als die dichtbij ligt (reizigers kunnen dan uitstappen),
      // anders vlak voor het blok (op het passeerspoor, dubbelspoor of bij het sein)
      let h = 0; for (let i = 0; i < n - 1; i++) if (D[i] <= x.in + 5) h = i;
      const bijHalte = x.in - D[h] < 1500 || k === 0;
      const plek = bijHalte ? D[h] : x.in - 60;
      const stap = Math.ceil(d / 30) * 30;
      if (totaal + stap > MAX_WACHT) { mislukt = true; break; }
      const st = stops.find(q => Math.abs(q.d - plek) < 1);
      if (st) st.w += stap; else { stops.push({ d: plek, w: stap, h: bijHalte ? h : -1 }); stops.sort((a, b) => a.d - b.d); }
      totaal += stap;
      // eerdere blokken na de wachtplek opnieuw nalopen (hun tijden zijn verschoven)
      const terug = bl.findIndex(y => y.uit > plek);
      if (terug >= 0 && terug < k) { k = terug - 1; break; }
    }
    if (mislukt) break;
  }
  // past de rit niet, dan rijdt hij niet (geen pad) en bezet hij ook geen spoor
  for (const x of mislukt ? [] : bl) {
    // vaste ritten alleen boeken waar ze ertoe doen: op spoor dat jouw treinen ook gebruiken
    if (relevant && !x.b.stukken.some(st => relevant.has(st.tak))) continue;
    const tin = tijdOp(D, T, x.in), tuit = tijdOp(D, T, x.uit);
    for (const e of stukTijden(x, T)) bez.zet(e.tak, { tak: e.tak, pA: e.pA, pB: e.pB, tA: e.tA, tB: e.tB, dir: e.dir, in: tin, uit: tuit, enkel: x.b.enkel, inhalen: x.b.inhalen, wie });
  }
  // voor de weergave: per wachtplek de tijd (s na vertrek, zonder eerdere wachttijden) waarop de trein er staat
  const v60 = v * 60, w = stops.map(q => ({ t: (q.h >= 0 ? T.dep[q.h] : basisTijd(D, T, q.d)) - v60, w: q.w, h: q.h }));
  return { w, totaal, mislukt };
}

// alle treinlijnen plannen. lijnen: [{lijn, vast}] (vast = bestaande vervoerder: eerst). Asynchroon in plakjes.
export async function planAlles(lijnen, net, jaar, { budget = 12, stop = () => false, bijStation } = {}) {
  const ok = l => l.modus === 'trein' && l.actief !== false && l.vertrek && l.cum && l.km?.length;
  const eigen = lijnen.filter(x => !x.vast && ok(x.lijn));
  const uit = new Map();
  let t0 = performance.now();
  const adem = async () => { if (performance.now() - t0 > budget) { await new Promise(res => setTimeout(res, 0)); if (stop()) return true; t0 = performance.now(); } return false; };
  // het spoor dat jouw treinen gebruiken; vaste ritten van anderen tellen alleen daar
  const relevant = new Set(), vakken = [];
  for (const { lijn } of eigen) { if (await adem()) return null; for (const b of blokkenVan(lijn, net, jaar, bijStation)) for (const st of b.stukken) relevant.add(st.tak); vakken.push(lijn.bbox); }
  const raakt = l => l.bbox && vakken.some(b => b && !(l.bbox[0] > b[2] + 500 || l.bbox[2] < b[0] - 500 || l.bbox[1] > b[3] + 500 || l.bbox[3] < b[1] - 500));
  const ritten = [];
  for (const { lijn, vast } of lijnen) {
    if (!ok(lijn) || (vast && !raakt(lijn))) continue;
    for (let r = 0; r < 2; r++) for (const v of lijn.vertrek[r] || []) ritten.push({ lijn, r, v, vast });
  }
  ritten.sort((a, b) => (b.vast - a.vast) || a.v - b.v);
  const bez = new Bezetting();
  for (const rit of ritten) {
    if (await adem()) return null;
    const blokken = blokkenVan(rit.lijn, net, jaar, bijStation);
    if (!blokken.length) continue;
    const p = planRit(bez, rit.lijn, rit.r, rit.v, blokken, rit, rit.vast, rit.vast ? relevant : null);
    if (rit.vast) continue;
    if (!uit.has(rit.lijn)) uit.set(rit.lijn, { wacht: new Map(), kruis: { ritten: 0, wacht: 0, mislukt: 0, mislukte: [] } });
    const u = uit.get(rit.lijn);
    if (p.totaal > 0) { u.wacht.set(`${rit.r}:${rit.v}`, p.w); u.kruis.ritten++; u.kruis.wacht += p.totaal; }
    if (p.mislukt) { u.kruis.mislukt++; u.kruis.mislukte.push(`${rit.r}:${rit.v}`); }
  }
  // pas aan het eind toepassen: tot dan rijdt alles op het vorige plan
  for (const { lijn } of lijnen) { const u = uit.get(lijn); lijn._ritWacht = u?.wacht.size ? u.wacht : null; lijn._kruis = u?.kruis || null; }
  return { ritten: ritten.length };
}

// wachtplekken van één rit: [{t (s na vertrek in de dienstregeling zonder planwachten), w (s), h (halte, of -1)}]
export const ritWacht = (lijn, r, v) => lijn._ritWacht?.get(`${r}:${v}`) || null;
export function ritExtra(lijn, r, v) { const w = ritWacht(lijn, r, v); if (!w) return 0; let s = 0; for (const x of w) s += x.w; return s; }

// snel opzoeken of een punt bij een treinstation ligt (stations: [{s, x, y}]); r in m
export function stationZoeker(stations, r = 450) {
  const g = new Map();
  for (const st of stations) if (st.s === 'trein') { const k = Math.floor(st.x / 1000) + ',' + Math.floor(st.y / 1000); if (!g.has(k)) g.set(k, []); g.get(k).push(st); }
  return (x, y) => {
    const ci = Math.floor(x / 1000), cj = Math.floor(y / 1000);
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (const st of g.get(i + ',' + j) || []) if (Math.hypot(st.x - x, st.y - y) < r) return true;
    return false;
  };
}
