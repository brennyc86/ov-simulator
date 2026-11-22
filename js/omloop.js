// Omlopen: elk voertuig rijdt een reeks ritten achter elkaar en verdwijnt nooit.
// Na aankomst blijft het staan en keert het voor de volgende rit (vaak dezelfde lijn terug). Bij een lange
// pauze en 's nachts gaat een trein, metro of tram naar een opstelspoor in de buurt en komt op tijd terug.
// Bussen blijven bij hun eindhalte staan. Omlopen worden per pool berekend: alle lijnen van één vervoerder
// met hetzelfde soort vervoer en materieel, zodat een trein na aankomst ook op een andere lijn verder kan.
import { ritPositie, ritPlek, puntOp } from './spel.js';
import { MODI } from './vloot.js';

const SPOOR = ['trein', 'metro', 'sneltram', 'tram'];
const LANG = { trein: 40, metro: 30, sneltram: 30, tram: 35 };   // langer wachten dan dit: naar het opstelspoor
const RANGEER_V = 25 / 3.6;                                       // m/s bij rangeren
const ZOEK = { trein: 4000, metro: 4000, sneltram: 3000, tram: 3000 };

const tijden = (l, r) => l.tr?.[r] || l.t;
const eindVan = (l, r) => { const h = l.haltes; return r ? h[0] : h[h.length - 1]; };
const beginVan = (l, r) => { const h = l.haltes; return r ? h[h.length - 1] : h[0]; };

// alle ritten van een groep; omloop: [{ritten:[...], }]
export function maakOmloop(lijnen) {
  const ritten = [];
  for (const l of lijnen) {
    if (l.actief === false || !l.vertrek) continue;
    for (let r = 0; r < 2; r++) {
      const t = tijden(l, r);
      if (!t?.length) continue;
      const duur = t[t.length - 1] / 60;
      for (const v of l.vertrek[r]) ritten.push({ l, r, dep: v, arr: v + duur, van: beginVan(l, r), naar: eindVan(l, r) });
    }
  }
  ritten.sort((a, b) => a.dep - b.dep);
  const keer = MODI[lijnen[0]?.modus]?.keer ?? 5;
  const voertuigen = [];
  // wachtende voertuigen per eindpunt (stationsnaam); best passend = kortste keertijd
  const wachtrij = new Map();
  for (const rit of ritten) {
    const rij = wachtrij.get(rit.van.naam) || [];
    let bi = -1;
    for (let k = 0; k < rij.length; k++) {
      const laatst = rij[k].ritten[rij[k].ritten.length - 1];
      if (laatst.arr + keer > rit.dep) continue;
      if (bi < 0 || laatst.arr > rij[bi].ritten[rij[bi].ritten.length - 1].arr) bi = k;
    }
    let v;
    if (bi >= 0) v = rij.splice(bi, 1)[0];
    else { v = { nr: voertuigen.length + 1, ritten: [] }; voertuigen.push(v); }
    v.ritten.push(rit);
    const doel = rit.naar.naam;
    if (!wachtrij.has(doel)) wachtrij.set(doel, []);
    wachtrij.get(doel).push(v);
  }
  return { voertuigen, ritten: ritten.length };
}

// ---------------------------------------------------------------- opstelsporen
function eindPunt(rit) {
  // de plek waar het voertuig na deze rit stilstaat (einde van zijn rijbaan of route)
  const p = ritPlek(rit.l, rit.r, (tijden(rit.l, rit.r).length) - 2, 1, rit.dep);
  return p;
}
function beginPunt(rit) { return ritPlek(rit.l, rit.r, 0, 0, rit.dep); }

// Opstelplek zoeken: dichtstbijzijnd opstel- of rangeerspoor (siding/yard) dat over het net bereikbaar is.
// Per opsteltak worden plekken uitgedeeld zodat voertuigen niet op elkaar staan.
export class Opstel {
  constructor(net, jaar) { this.net = net; this.jaar = jaar; this.cache = new Map(); this.bezet = new Map(); }
  wis() { this.cache.clear(); this.bezet.clear(); }
  // geeft {heen: baan, terug: baan, park: baan, s} of null
  plek(x, y, modus, lengte, sleutel) {
    const k = sleutel;
    if (this.cache.has(k)) return this.cache.get(k);
    if (this.budget !== undefined && this.budget-- <= 0) return null; // later dit beeld; niet onthouden
    let uit = null;
    const net = this.net, max = ZOEK[modus] || 3000;
    const kand = [];
    const ci = Math.floor(x / 1000), cj = Math.floor(y / 1000), rr = Math.ceil(max / 1000), gezien = new Set();
    for (let i = ci - rr; i <= ci + rr; i++) for (let j = cj - rr; j <= cj + rr; j++) for (const t of net.tRaster.get(i + ',' + j) || []) {
      if (gezien.has(t)) continue; gezien.add(t);
      if ((t.dienst !== 1 && t.dienst !== 2) || t.lengte < 60 || !net.rijdbaar(t, modus, this.jaar)) continue;
      const mx = t.pts[(t.pts.length >> 2) * 2], my = t.pts[(t.pts.length >> 2) * 2 + 1];
      const d = Math.hypot(mx - x, my - y);
      if (d < max) kand.push({ t, d });
    }
    kand.sort((a, b) => a.d - b.d);
    for (const { t } of kand.slice(0, 6)) {
      const al = this.bezet.get(t) || 0;
      const s = 15 + al * (lengte + 8) + lengte / 2;
      if (s + lengte / 2 > t.lengte - 5) continue;           // vol
      const [px, py] = net.stuk(t, s, s).slice(0, 2);
      const heen = net.route([x, y], [px, py], modus, this.jaar);
      if (!heen || heen.lengte > Math.hypot(px - x, py - y) * 3 + 1500) continue;
      const terug = net.route([px, py], [x, y], modus, this.jaar);
      if (!terug) continue;
      this.bezet.set(t, al + 1);
      uit = { heen: baan(heen.pts), terug: baan(terug.pts) };
      break;
    }
    this.cache.set(k, uit);
    return uit;
  }
}
function baan(pts) {
  const cum = [0];
  for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  return { route: { pts }, cum, lengte: cum[cum.length - 1] };
}

// ---------------------------------------------------------------- posities op tijd tm
// Geeft per voertuig één positie: rijdend, wachtend bij een halte, rangerend of opgesteld.
export function voertuigenOmloop(omloop, tm, uit, opstel, lengteVan, inZicht = null) {
  for (const v of omloop.voertuigen) {
    const R = v.ritten;
    // rit die nu loopt of de laatste die al begonnen is
    let i = -1;
    for (let k = 0; k < R.length; k++) { if (R[k].dep <= tm) i = k; else break; }
    const nu = i >= 0 ? R[i] : null;
    if (inZicht && !inZicht((nu || R[0]).l) && !(R[i + 1] && inZicht(R[i + 1].l))) continue;
    if (nu && tm <= nu.arr) {
      const p = ritPositie(nu.l, nu.r, nu.dep, tm);
      if (p) { p.omloop = v; uit.push(p); continue; }
    }
    const vorige = nu, volgende = R[i + 1] || null;
    const l = (vorige || volgende).l, modus = l.modus;
    const wacht = vorige && volgende ? volgende.dep - vorige.arr : Infinity;
    // kort keren: blijven staan op het eindpunt van de vorige rit
    if (vorige && wacht <= (LANG[modus] ?? Infinity)) { const p = eindPunt(vorige); if (p) { uit.push(Object.assign(p, { staat: true, wacht: 'keren', omloop: v, volgende })); } continue; }
    // lang wachten, 's nachts of nog niet begonnen: opstellen (alleen spoor)
    const anker = vorige ? eindPunt(vorige) : beginPunt(volgende);
    if (!anker) continue;
    const sleutel = `${v.nr}:${omloop.id}:${Math.round(anker.x / 50)},${Math.round(anker.y / 50)}`;
    const plek = SPOOR.includes(modus) && opstel ? opstel.plek(anker.x, anker.y, modus, lengteVan(l), sleutel) : null;
    if (!plek) { uit.push(Object.assign(anker, { staat: true, wacht: vorige ? 'wacht' : 'klaar', omloop: v, volgende })); continue; }
    const duurH = plek.heen.lengte / RANGEER_V / 60, duurT = plek.terug.lengte / RANGEER_V / 60;
    let baanNu, s;
    if (vorige && tm < vorige.arr + 3) { uit.push(Object.assign(eindPunt(vorige), { staat: true, wacht: 'wacht', omloop: v, volgende })); continue; }
    if (vorige && tm < vorige.arr + 3 + duurH) { baanNu = plek.heen; s = (tm - vorige.arr - 3) * 60 * RANGEER_V; }
    else if (volgende && tm > volgende.dep - 5 - duurT) {
      if (tm > volgende.dep - 5) { uit.push(Object.assign(beginPunt(volgende), { staat: true, wacht: 'instappen', omloop: v, volgende })); continue; }
      baanNu = plek.terug; s = (tm - (volgende.dep - 5 - duurT)) * 60 * RANGEER_V;
    } else { baanNu = plek.heen; s = plek.heen.lengte; }
    s = Math.max(0, Math.min(baanNu.lengte, s));
    const [x, y, hoek] = puntOp(baanNu, s);
    uit.push({ x, y, hoek, lijn: l, r: 0, vertrek: (volgende || vorige).dep, f: 0, staat: s >= baanNu.lengte || s <= 0, s, baan: baanNu, omloop: v, volgende,
      wacht: s >= baanNu.lengte && baanNu === plek.heen ? 'opgesteld' : 'rangeert' });
  }
  return uit;
}
