// Spelkern: bedrijf, lijnen, dienstregeling, voertuigposities, geld en reizigers.
import { MODI, TYPE, standaardType } from './vloot.js';
import { bboxVan } from './net.js';
import { inrichtingVan, klassenVan, vraagEffect, uurKosten, haltetijdFactor, nodigPer, nodigLijn } from './comfort.js';

export const TARIEF = {
  // instaptarief + per km (OV-chipkaart 2026, benaderd); trein degressief na 40 km
  bus: [1.08, 0.20], hov: [1.08, 0.20], tram: [1.08, 0.20], metro: [1.08, 0.20], sneltram: [1.08, 0.20],
  belbus: [3.00, 0.25], trein: [2.60, 0.21], veer: [2.50, 0.30], watertaxi: [8.00, 1.20], vlucht: [45, 0.35],
};
// subsidie per dienstregelingsuur bij een concessie (benadering)
export const SUBSIDIE_UUR = { bus: 45, hov: 50, tram: 65, metro: 80, sneltram: 70, belbus: 35, trein: 160, veer: 120, watertaxi: 0, vlucht: 0 };
export const BOETE = 50;
export const LOON = { controleur: 52, conducteur: 50 };
export const PERIODES = [
  { id: 'vroeg', naam: 'Vroeg', van: 5 * 60, tot: 7 * 60, vraag: 0.5 },
  { id: 'ochtendspits', naam: 'Ochtendspits', van: 7 * 60, tot: 9 * 60, vraag: 1.9 },
  { id: 'dal', naam: 'Dal', van: 9 * 60, tot: 16 * 60, vraag: 0.9 },
  { id: 'avondspits', naam: 'Avondspits', van: 16 * 60, tot: 18.5 * 60, vraag: 1.7 },
  { id: 'avond', naam: 'Avond', van: 18.5 * 60, tot: 24.5 * 60, vraag: 0.45 },
  { id: 'nacht', naam: 'Nacht', van: 24.5 * 60, tot: 29 * 60, vraag: 0.04 },
];
// In het weekend geen spits: later op gang, druk overdag en 's avonds (uitjes, familie, winkelen)
export const WEEKEND_VRAAG = { vroeg: 0.2, ochtendspits: 0.55, dal: 1.15, avondspits: 0.9, avond: 0.65, nacht: 0.1 };
// dag 0 van het spel is maandag 1 januari; een speljaar heeft 12 maanden van 30 dagen
export const WEEKDAG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
export const MAAND = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const weekdag = dag => ((dag % 7) + 7) % 7;
export const isWeekend = dag => weekdag(dag) >= 5;
export const datumTekst = (dag, kort = false) => {
  const d = ((dag % 360) + 360) % 360, w = WEEKDAG[weekdag(dag)], m = MAAND[Math.floor(d / 30)];
  return kort ? `${w.slice(0, 2)} ${d % 30 + 1} ${m.slice(0, 3)}` : `${w} ${d % 30 + 1} ${m}`;
};
export const vraagFactor = (dag, periode) => periode ? (isWeekend(dag) ? WEEKEND_VRAAG[periode.id] ?? periode.vraag : periode.vraag) : 0;
// zonshoogte (graden) in het midden van Nederland; tijd in minuten na middernacht (wintertijd, zomertijd apr–okt)
export function zonshoogte(dag, minuten) {
  const d = ((dag % 360) + 360) % 360, jd = d * 365 / 360;
  const zomer = d >= 85 && d < 300 ? 60 : 0;
  const dekl = -23.44 * Math.cos(2 * Math.PI * (jd + 10) / 365) * Math.PI / 180;
  const uurhoek = ((minuten - zomer - 60) / 60 - 12 + 5.3 / 15) * 15 * Math.PI / 180; // klok CET, lengte 5,3°O
  const lat = 52.2 * Math.PI / 180;
  return Math.asin(Math.sin(lat) * Math.sin(dekl) + Math.cos(lat) * Math.cos(dekl) * Math.cos(uurhoek)) * 180 / Math.PI;
}
// dienstregeling: in het weekend rijden de spitsritten niet (daldienst)
let weekendDienst = false;
export const zetWeekend = w => { weekendDienst = w; };
export const ZWARTRIJDEN_BASIS = { bus: 0.012, hov: 0.02, tram: 0.07, metro: 0.05, sneltram: 0.06, belbus: 0.0, trein: 0.04, veer: 0.03, watertaxi: 0, vlucht: 0 };

export const euro = n => (n < 0 ? '−' : '') + '€ ' + Math.abs(Math.round(n)).toLocaleString('nl-NL');
export const euroKort = n => {
  const a = Math.abs(n), t = n < 0 ? '−' : '';
  if (a >= 1e9) return `${t}€ ${(a / 1e9).toFixed(1).replace('.', ',')} mld`;
  if (a >= 1e6) return `${t}€ ${(a / 1e6).toFixed(1).replace('.', ',')} mln`;
  if (a >= 1e4) return `${t}€ ${Math.round(a / 1e3)}k`;
  return euro(n);
};
export const klok = m => { m = ((Math.floor(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

let teller = 1;
export const nieuwId = p => `${p}${Date.now().toString(36)}${(teller++).toString(36)}`;

export function nieuwSpel({ naam, kleur, jaar, start, vervoerder, kapitaal }) {
  return {
    versie: 1, naam, kleur, jaar, start, vervoerder: vervoerder || null,
    dag: 0, tijd: 6 * 60, // minuten sinds middernacht
    geld: kapitaal, historie: [], maand: nieuweMaand(),
    voertuigen: {}, // typeId -> aantal in bezit (ook eigen series)
    series: [], // eigen interieurs: {id, basis, naam, ink}
    lijnen: [], haltes: [], // eigen haltes/stations {id, naam, modus, x, y, perrons, eigen}
    controle: { steekproef: 0, poortjes: false, chauffeur: true, ploegen: [] },
    berichten: [], verzoeken: [], goodwill: {}, spoor: [], prorail: [], volgendeAI: 2 * 1440,
    reputatie: 60,
  };
}
export function nieuweMaand() { return { inkomsten: 0, kaartjes: 0, boetes: 0, subsidie: 0, personeel: 0, energie: 0, afschrijving: 0, gebruik: 0, overig: 0, reizigers: 0, zwart: 0, betrapt: 0 }; }

// ---------------------------------------------------------------- lijnen en dienstregeling
export function maakLijn(spel, { nr, naam, modus, typeId, haltes, route, interval, eerste, laatste, concessie, richting }) {
  const lijn = {
    id: nieuwId('l'), nr, naam, modus, typeId, haltes, richting: richting || 'beide', // beide | heen (alleen deze richting) | rond (rondlijn) // haltes: [{naam,x,y,ref}]
    route, // {pts, lengte}
    interval: interval || { vroeg: 30, ochtendspits: 15, dal: 30, avondspits: 15, avond: 60 },
    eerste: eerste ?? 6 * 60, laatste: laatste ?? 23 * 60, offset: 0, concessie: !!concessie,
    kleur: MODI[modus]?.kleur || '#555', controle: 0, actief: true, startDag: spel.dag ?? 0,
  };
  herbereken(lijn);
  spel.lijnen.push(lijn);
  return lijn;
}

// ---------------------------------------------------------------- baanvaksnelheden
// Het spoornet (voor de maximumsnelheid per baanvak) wordt door main.js gezet.
let NET = null;
export const zetNet = n => { NET = n; };
const STANDAARD_V = { 0: 120, 1: 80, 2: 70, 3: 50, 4: 60, 5: 80, 6: 60 };
// stukken [{van, tot, v}] in meters langs de route, met de toegestane snelheid (km/u) per tak
function baanProfiel(lijn, factor) {
  const tk = lijn.route?.takken;
  if (!NET || !tk?.length || !['trein', 'metro', 'sneltram', 'tram'].includes(lijn.modus)) return null;
  const tak = i => i >= 1e6 ? NET.eigen[i - 1e6] : NET.takken[i];
  const T = tk.map(tak).filter(Boolean);
  if (!T.length) return null;
  const totaal = (lijn.route.lengte || lijn.cum[lijn.cum.length - 1] * factor);
  const midden = T.slice(1, -1).reduce((a, t) => a + t.lengte, 0);
  const rand = Math.max(0, totaal - midden), randDelen = T.length > 1 ? [T[0].lengte, T[T.length - 1].lengte] : [1, 0];
  const randSom = randDelen[0] + randDelen[1] || 1;
  const uit = []; let s = 0;
  T.forEach((t, k) => {
    const len = T.length === 1 ? totaal : k === 0 ? rand * randDelen[0] / randSom : k === T.length - 1 ? rand * randDelen[1] / randSom : t.lengte;
    let v = t.vmax || STANDAARD_V[t.soort] || 100;
    if (!t.vmax && t.soort === 0) v = t.sporen >= 2 ? 130 : 100;
    if (t.dienst) v = Math.min(v, 40);
    uit.push({ van: s, tot: s + len, v }); s += len;
  });
  return uit;
}
// Over de weg (bus, tram op straat): binnen de bebouwde kom 50, in centra en woonwijken 30, daarbuiten 80 km/u;
// snelbussen (HOV) halen buiten de kom 100 op autoweg/snelweg (een gewone streekbus houdt 80 aan). Plaatsen als cirkels.
let PLAATSEN = [];
export const zetPlaatsenVoorSnelheid = p => { PLAATSEN = (p || []).filter(x => x[3] >= 1500).map(x => ({ x: x[1], y: x[2], r: 250 + 9 * Math.sqrt(x[3]), rc: 120 + 3 * Math.sqrt(x[3]) })); };
function wegProfiel(lijn, factor) {
  if (!['bus', 'hov', 'belbus', 'tram'].includes(lijn.modus) || !PLAATSEN.length || lijn.route?.takken?.length) return null;
  const pts = lijn.route.pts, cum = lijn.cum, uit = [];
  const buiten = lijn.modus === 'hov' ? 100 : lijn.modus === 'tram' ? 70 : 80;
  for (let i = 1; i < cum.length; i++) {
    const x = (pts[i * 2] + pts[i * 2 - 2]) / 2, y = (pts[i * 2 + 1] + pts[i * 2 - 1]) / 2;
    let v = buiten;
    for (const p of PLAATSEN) { const d = Math.abs(p.x - x) + Math.abs(p.y - y); if (d > p.r * 1.5) continue; const e = Math.hypot(p.x - x, p.y - y); if (e < p.rc) { v = 30; break; } if (e < p.r) v = Math.min(v, 50); }
    const van = cum[i - 1] * factor, tot = cum[i] * factor, l = uit[uit.length - 1];
    if (l && l.v === v) l.tot = tot; else uit.push({ van, tot, v });
  }
  return uit;
}
// rijtijd (s) van a naar b (m langs de route): elk stuk op min(baanvak, materieel), plus optrekken en remmen
function rijtijdProfiel(profiel, a, b, type) {
  let t = 0, top = 0;
  const vmat = type.vmax * 0.97;
  for (const p of profiel) {
    const lo = Math.max(a, p.van), hi = Math.min(b, p.tot);
    if (hi <= lo) continue;
    const v = Math.min(vmat, p.v) / 3.6;
    t += (hi - lo) / v; top = Math.max(top, v);
  }
  const d = b - a, acc = type.acc || 0.5;
  if (!top) return d / (vmat / 3.6);
  const haalbaar = Math.sqrt(Math.max(1, d) * acc); // korte stukken halen de topsnelheid niet
  if (haalbaar < top) return 2 * Math.sqrt(Math.max(1, d) / acc);
  return t + top / acc; // optrekken en remmen kosten samen ~ v/a extra
}

// rijtijden per halte (sec), km per halte langs de route en de vertrektijden
export function herbereken(lijn) {
  const type = TYPE[lijn.typeId] || TYPE.citealle;
  const mod = MODI[lijn.modus];
  const pts = lijn.route.pts;
  // km van elke halte langs de route (oplopend dichtstbijzijnde punt)
  const cum = [0];
  for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  const factor = lijn.route.lengte && cum[cum.length - 1] ? lijn.route.lengte / cum[cum.length - 1] : 1;
  let start = 0;
  lijn.km = lijn.haltes.map(h => {
    let beste = start, bd = Infinity;
    for (let i = start; i < cum.length; i++) {
      const d = Math.hypot(pts[i * 2] - h.x, pts[i * 2 + 1] - h.y);
      if (d < bd) { bd = d; beste = i; }
    }
    start = beste;
    return cum[beste];
  });
  lijn.cum = cum;
  const v = type.vmax / 3.6 * (lijn.modus === 'bus' || lijn.modus === 'belbus' ? 0.55 : lijn.modus === 'tram' ? 0.6 : 0.8);
  const vlucht = lijn.modus === 'vlucht';
  const extraHalte = lijn.modus === 'bus' && lijn.chauffeurControle ? 5 : 0;
  lijn._halteTijd = Math.round(mod.halteTijd * haltetijdFactor(lijn.typeId)); // meer deuren: sneller in- en uitstappen
  const profiel = baanProfiel(lijn, factor) || wegProfiel(lijn, factor);
  lijn.t = [0];
  for (let i = 1; i < lijn.haltes.length; i++) {
    const d = (lijn.km[i] - lijn.km[i - 1]) * factor;
    let rij;
    if (profiel) rij = rijtijdProfiel(profiel, lijn.km[i - 1] * factor, lijn.km[i] * factor, type);
    else {
      const vEff = Math.min(v, Math.sqrt(Math.max(1, d) * type.acc)); // korte stukken halen de topsnelheid niet
      rij = vlucht ? d / v + 20 * 60 : d / Math.max(2, vEff) + vEff / type.acc; // vliegen: taxiën, opstijgen en naderen ~20 min
    }
    lijn.t.push(lijn.t[i - 1] + rij * 1.07 + (i < lijn.haltes.length - 1 ? lijn._halteTijd + extraHalte : 0));
  }
  if (lijn.echt) {
    // bestaande lijn uit de echte dienstregeling: echte rijtijden en vertrektijden
    if (lijn.echt.km && lijn.echt.km.length === lijn.haltes.length) lijn.km = lijn.echt.km;
    if (lijn.echt.t && lijn.echt.t.length === lijn.haltes.length) lijn.t = lijn.echt.t;
  }
  // per richting r in rijvolgorde: tr[r][i] = vertrek bij halte i (zonder extra wachten), trMin[r][i] = vroegst mogelijke aankomst.
  // Extra wachttijd (halteWacht) en gewenste aankomsttijden (aankomstWens, s na vertrek bij de eerste halte):
  // later aankomen = rustiger rijden; eerst langer wachten eet die marge op tot de maximale snelheid.
  const n = lijn.t.length, dw = lijn.halteWacht || {}, wens = lijn.aankomstWens || {};
  const h = lijn._halteTijd + extraHalte;
  lijn.tr = [[0], [0]]; lijn.trMin = [[0], [0]];
  for (let r = 0; r < 2; r++) for (let i = 1; i < n; i++) {
    const j = r ? n - i : i; // stuk in de oorspronkelijke volgorde: van j-1 naar j
    const rit = Math.max(15, lijn.t[j] - lijn.t[j - 1] - (j < n - 1 ? h : 0));
    const weg = lijn.tr[r][i - 1] + (dw[`${r}:${i - 1}`] || 0) * 60;
    const vroegst = weg + rit, w = wens[`${r}:${i}`];
    const aan = w != null ? Math.max(vroegst, Math.min(w, vroegst + 30 * 60)) : vroegst;
    lijn.trMin[r].push(vroegst);
    lijn.tr[r].push(aan + (i < n - 1 ? h : 0));
  }
  const t0 = lijn.tr[0], t1 = lijn.tr[1];
  lijn.duur = Math.max(60, t0[n - 1], t1[n - 1]);
  lijn.lengteKm = (lijn.route.lengte || cum[cum.length - 1]) / 1000;
  lijn.bbox = bboxVan(pts);
  lijn.vertrek = lijn.echt?.v && !lijn.aangepast ? lijn.echt.v : vertrekken(lijn);
  lijn.nodig = materieelNodig(lijn);
}

// hoeveel richtingen rijden er: heen en terug, of alleen heen (eenrichting of rondlijn)
export const ritRichtingen = l => l.richting === 'heen' || l.richting === 'rond' ? 1 : 2;
export function vertrekken(lijn) {
  // beide richtingen; [richting][minuten]
  const uit = [[], []];
  for (let r = 0; r < ritRichtingen(lijn); r++) {
    let t = lijn.eerste + lijn.offset + (r ? Math.round((lijn.interval.dal || 30) / 2) : 0);
    while (t <= lijn.laatste) {
      uit[r].push(t);
      const p = PERIODES.find(p => t >= p.van && t < p.tot) || PERIODES[4];
      const id = weekendDienst && (p.id === 'ochtendspits' || p.id === 'avondspits') ? 'dal' : p.id;
      t += Math.max(3, lijn.interval[id] || lijn.interval.avond || 60);
    }
  }
  return uit;
}

// eenheden per rit: in de spits (werkdagen) rijden treinen met 'spitsDubbel' gekoppeld (2 eenheden)
export const isSpits = (dag, minuten) => !isWeekend(dag) && ((minuten >= 7 * 60 && minuten < 9 * 60) || (minuten >= 16 * 60 && minuten < 18.5 * 60));
export const eenheden = (lijn, dag, dep) => lijn.modus === 'trein' && (lijn.spitsDubbel ?? !!lijn.ai) && isSpits(dag, dep) ? 2 : 1;
export function materieelNodig(lijn) {
  // drukste uur: ritten (beide richtingen) × (rijtijd + keertijd) / 60
  const mod = MODI[lijn.modus];
  const perUur = new Array(30).fill(0);
  for (const r of lijn.vertrek) for (const v of r) perUur[Math.min(29, Math.floor(v / 60))] += eenheden(lijn, 0, v); // dag 0 = werkdag
  const piek = Math.max(...perUur);
  const leegTerug = lijn.richting === 'heen' && !lijn.paar ? 2 : 1; // eenrichting zonder terugweg: leeg terugrijden
  const keer = mod.keer + (TYPE[lijn.typeId]?.keerExtra || 0); // loc zonder stuurstandrijtuig: omlopen bij het keren
  const wissel = (lijn._wissels || 0) * 8; // loc-wissel aan de grens (WISSEL_MIN in stroom.js)
  return Math.max(1, Math.ceil(piek * (lijn.duur / 60 * leegTerug + keer + wissel) / 60));
}

// positie langs de lijn op afstand s (m langs de route-punten)
export function puntOp(lijn, s) { // lijn: alles met .cum en .route.pts (ook een rijbaan)
  const cum = lijn.cum, pts = lijn.route.pts;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const seg = cum[hi] - cum[lo] || 1, f = Math.max(0, Math.min(1, (s - cum[lo]) / seg));
  const x0 = pts[lo * 2], y0 = pts[lo * 2 + 1], x1 = pts[hi * 2], y1 = pts[hi * 2 + 1];
  return [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, Math.atan2(y1 - y0, x1 - x0)];
}

// positie van één rit (richting r, vertrek v in minuten) op tijd tm; null als de rit niet rijdt
export function ritPositie(lijn, r, v, tm, zonderStops = false) {
  if (v > tm) return null;
  const verstreken = (tm - v) * 60;
  const t = lijn.tr?.[r] || lijn.t, n = t.length;
  if (verstreken > t[n - 1]) return null;
  if (zonderStops) { // lege rit: gelijkmatig door, niet stilstaan bij haltes
    const s = verstreken / t[n - 1] * (n - 1), i = Math.min(n - 2, Math.floor(s));
    return ritPlek(lijn, r, i, s - i, v);
  }
  let i = 0;
  while (i < n - 2 && t[i + 1] <= verstreken) i++;
  const halte = lijn._halteTijd ?? MODI[lijn.modus].halteTijd;
  // extra wachttijd bij de halte waar dit stuk begint: eerst blijven staan
  const extra = (lijn.halteWacht?.[`${r}:${i}`] || lijn.dw?.[i] || 0) * 60;
  const begin = t[i] + extra, eind = t[i + 1] - (i + 1 < n - 1 ? halte : 0);
  const f = Math.max(0, Math.min(1, (verstreken - begin) / Math.max(1, eind - begin)));
  return ritPlek(lijn, r, i, f, v);
}
// plek tussen halte i en i+1 (in rijvolgorde van richting r), fractie f
export function ritPlek(lijn, r, i, f, v) {
  const n = (lijn.tr?.[r] || lijn.t).length;
  const baan = lijn._banen?.[r];
  if (baan && baan.km.length === n) {
    // eigen rijbaan per richting (rechts rijden): altijd vooruit langs de baan
    const ka = baan.km[i], kb = baan.km[i + 1];
    const [x, y, hoek] = puntOp(baan, ka + (kb - ka) * f);
    return { x, y, hoek, lijn, r, vertrek: v, f, staat: f >= 1, s: ka + (kb - ka) * f, baan };
  }
  const ri = r === 0 ? i : n - 1 - i, rj = r === 0 ? i + 1 : n - 2 - i;
  const ka = lijn.km[ri], kb = lijn.km[rj];
  const [x, y, hoek] = puntOp(lijn, ka + (kb - ka) * f);
  return { x, y, hoek: r ? hoek + Math.PI : hoek, lijn, r, vertrek: v, f, staat: f >= 1, s: ka + (kb - ka) * f };
}
// alle rijdende voertuigen van een lijn op tijd tm (minuten)
export function voertuigenOp(lijn, tm, uit) {
  for (let r = 0; r < 2; r++) for (const v of lijn.vertrek[r]) {
    if (v > tm) break;
    const p = ritPositie(lijn, r, v, tm);
    if (p) uit.push(p);
  }
  return uit;
}

// ---------------------------------------------------------------- vraag naar vervoer
// vangst: inwoners binnen bereik van een halte (exponentiële afname met afstand)
export function vangst(plaatsen, x, y, bereik) {
  let som = 0;
  const max = bereik * 6;
  for (const [, px, py, inw] of plaatsen) {
    const d = Math.hypot(px - x, py - y);
    if (d > max + 4000) continue;
    // grote plaatsen zijn uitgestrekt: hun inwoners liggen gespreid rond het centrum
    const straal = Math.sqrt(inw) * 6;
    som += inw * Math.exp(-Math.max(0, d - straal * 0.3) / (bereik + straal * 0.5)) * Math.min(1, bereik / (straal + 1));
  }
  return som;
}

// factor op het verzorgingsgebied van een halte (stationsgebouw, loket): door main.js gezet
export let halteFactor = () => 1;
export const zetHalteFactor = f => { halteFactor = f; };
export function vraagLijn(lijn, plaatsen, concurrentie = 0) {
  const mod = MODI[lijn.modus];
  if (!lijn._vangst) lijn._vangst = lijn.haltes.map(h => vangst(plaatsen, h.x, h.y, mod.bereik) * halteFactor(h, lijn));
  const V = lijn._vangst, n = V.length;
  let paren = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const d = Math.abs(lijn.km[j] - lijn.km[i]) / 1000;
    paren += V[i] * V[j] / Math.pow(d + 2, 1.3);
  }
  const enkel = ritRichtingen(lijn) === 1;
  const ritten = (lijn.vertrek[0].length + lijn.vertrek[1].length) * (enkel ? 2 : 1); // frequentie per richting
  const aanbod = 1 - Math.exp(-ritten / 50);
  const lengteKm = lijn.lengteKm ?? (lijn.route?.lengte || 0) / 1000; // lijnen van anderen hebben geen lengteKm
  const snelheid = Math.min(1.3, Math.max(0.4, (lengteKm / (lijn.duur / 3600 || 1)) / 30));
  const schaal = { trein: 0.0016, sneltram: 0.0009, metro: 0.0012, tram: 0.0007, bus: 0.00045, hov: 0.0006, belbus: 0.00005, veer: 0.002, watertaxi: 0.0004, vlucht: 0.0003 }[lijn.modus] || 0.0005;
  // eenrichtingslijn: alleen de reizigers in deze richting (een rondlijn brengt iedereen rond)
  const perDag = Math.sqrt(paren) * schaal * 100 * aanbod * snelheid * (1 - concurrentie * 0.5) * (lijn.richting === 'heen' ? 0.5 : 1);
  // gemiddelde reisafstand: bij twee haltes de hele lijn, bij veel haltes een deel ervan
  const deel = n <= 2 ? 1 : Math.min(1, 0.38 + 0.6 / n);
  return { perDag: isFinite(perDag) ? perDag : 0, gemKm: Math.max(1.5, lengteKm * deel) };
}

// capaciteit per rit
export const capaciteit = lijn => { const t = TYPE[lijn.typeId]; if (!t) return 80; return klassenVan(inrichtingVan(lijn, lijn.typeId), lijn.typeId, lijn.modus).reduce((a, k) => a + k.zit + k.sta, 0); };
// onderhoud en energie per km: materieel dat buiten zijn eigen tijd rijdt (museum) is per km fors duurder
export function kmKosten(type, jaar) {
  if (!type) return 1;
  const oud = jaar > type.tot + 5 ? (type.energie === 'kolen' ? 3.2 : 2.2) : 1;
  return type.km * oud;
}
// vaste onderhoudskosten per voertuig per maand (deels tijd, deels km): museummaterieel staat vooral stil
export function vastOnderhoud(type, jaar) { return !type ? 0 : type.prijs * (jaar > type.tot + 5 ? 0.006 : 0.02) / 12; }
// vergelijkbaar comfort bij de concurrent (standaardmaterieel van die soort)
const COMFORT_CONCURRENT = { trein: 6, metro: 4.5, sneltram: 5, tram: 4.5, bus: 4.5, hov: 6, belbus: 5, veer: 5, watertaxi: 6, vlucht: 6 };

// ---------------------------------------------------------------- geld per uur
// Wordt elk speluur aangeroepen voor het uur dat net voorbij is.
export function verrekenUur(spel, ctx, uurBegin) {
  const m = spel.maand;
  const periode = PERIODES.find(p => uurBegin >= p.van && uurBegin < p.tot);
  for (const lijn of spel.lijnen) {
    if (!lijn.actief || lijn.bijzonder) continue; // bijzondere ritten worden per rit afgerekend
    const type = TYPE[lijn.typeId];
    const mod = MODI[lijn.modus];
    // ritten die in dit uur vertrokken
    let ritten = 0;
    for (const r of lijn.vertrek) for (const v of r) if (v >= uurBegin && v < uurBegin + 60) ritten++;
    // voertuiguren: voertuigen in omloop in dit uur
    const actief = periode ? Math.min(lijn.nodig, Math.ceil(ritten * (lijn.duur / 60 + mod.keer) / 60)) : 0;
    if (!ritten && !actief) continue;
    // te weinig materieel: ritten vallen uit
    const inBezit = beschikbaarVoor(spel, lijn);
    const rijdt = Math.min(1, inBezit / Math.max(1, lijn.nodig));
    ritten *= rijdt;
    const voertuigUren = actief * rijdt;
    const km = ritten * lijn.lengteKm;

    // reizigers
    const conc = ctx.concurrentie(lijn);
    const eff = vraagEffect(lijn, lijn.typeId, conc > 0 ? COMFORT_CONCURRENT[lijn.modus] : null);
    lijn._eff = eff;
    let { perDag, gemKm } = vraagLijn(lijn, ctx.plaatsen, 0);
    perDag *= eff.factor * (1 - conc * (1 - eff.marktaandeel));
    const totaalVraag = PERIODES.reduce((s, p) => s + p.vraag * (p.tot - p.van) / 60, 0);
    let reizigers = periode ? perDag * vraagFactor(spel.dag, periode) / totaalVraag : 0;
    const eh = eenheden(lijn, spel.dag, uurBegin + 30);
    reizigers *= 0.6 + 0.4 * (spel.reputatie / 100);
    // capaciteit per klasse (klassen van hoog naar laag): wie in zijn klasse geen plek heeft mag lager staan/zitten;
    // bij drukte koopt een deel een duurder kaartje voor een zitplaats; met het beleid 'opwaarderen' mogen
    // reizigers bij drukte gratis een klasse hoger zitten (minder achterblijvers, wel klachten zonder korting)
    const vraagUur = reizigers, kl = eff.klassen.length ? eff.klassen : [{ zit: capaciteit(lijn), sta: 0, prijs: 1 }];
    const aand = eff.aandeel.length ? eff.aandeel : [1];
    const vrij = kl.map(k => (k.zit + k.sta) * eh * ritten * 0.8);
    let over = 0, vervoerd = 0;
    for (let i = 0; i < kl.length; i++) { const nodig = vraagUur * aand[i] + over, mee = Math.min(nodig, vrij[i]); vrij[i] -= mee; over = nodig - mee; vervoerd += mee; }
    const laag = kl[kl.length - 1], pl = Math.max(0.1, laag.prijs || 1);
    let meerPrijs = 0, opgewaardeerd = 0;
    for (let j = kl.length - 2; j >= 0 && over > 0; j--) { // duurder kaartje om mee te kunnen of te zitten
      const w = Math.max(0, Math.min(0.7, 1.6 - 0.6 * (kl[j].prijs || 1) / pl)), koop = Math.min(vrij[j], over * w);
      vrij[j] -= koop; over -= koop; vervoerd += koop; meerPrijs += koop * ((kl[j].prijs || 1) - pl);
    }
    if (spel.beleid?.opwaarderen && over > 0) { const op = Math.min(over, vrij.reduce((a, b) => a + b, 0)); opgewaardeerd = op; over -= op; vervoerd += op; }
    reizigers = vervoerd;
    lijn.dag = lijn.dag || { vraag: 0, achter: 0 }; lijn.dag.vraag += vraagUur; lijn.dag.achter += over;
    const [instap, perKm] = TARIEF[lijn.modus] || TARIEF.bus;
    const ritprijs = instap + perKm * (lijn.modus === 'trein' ? Math.min(gemKm, 40) + Math.max(0, gemKm - 40) * 0.7 : gemKm);
    // zwartrijden en controle
    const pak = pakkans(spel, lijn);
    const basis = ZWARTRIJDEN_BASIS[lijn.modus] ?? 0.03;
    const zwartFractie = basis * (spel.controle.poortjes && (lijn.modus === 'trein' || lijn.modus === 'metro') ? 0.35 : 1)
      * (lijn.modus === 'bus' && spel.controle.chauffeur ? 0.5 : 1) * Math.exp(-pak * 6) * 1.6;
    const zwart = reizigers * zwartFractie;
    const betrapt = zwart * pak;
    // reizigers in een hogere klasse krijgen bij opwaarderen eventueel korting (klachten afkopen)
    const hoger = reizigers * (1 - (aand[aand.length - 1] || 1)), korting = opgewaardeerd > 0 ? (spel.beleid?.korting || 0) : 0;
    const kaartjes = (reizigers - zwart) * ritprijs * eff.gemPrijs + meerPrijs * ritprijs * (1 - zwartFractie) - hoger * ritprijs * eff.gemPrijs * korting;
    if (opgewaardeerd > 0) spel.reputatie = Math.max(0, spel.reputatie - Math.min(0.3, opgewaardeerd / 4000) * (1 - Math.min(1, korting * 3)));
    const boetes = betrapt * (BOETE + ritprijs) * 0.75; // niet elke boete wordt geïnd

    // kosten
    const personeel = voertuigUren * mod.loon * (type?.pers || 1) + (lijn.conducteur ? voertuigUren * LOON.conducteur : 0) + voertuigUren * uurKosten(lijn, lijn.typeId);
    const energie = km * kmKosten(type, spel.jaar) * eh * (spel._ouderdom?.[(type?.samen || [lijn.typeId])[0]] || 1); // oud materieel: duurder per km
    // spoorhuur: ProRail per treinkilometer en per stop; tram/metro en trolleybus huren baan en bovenleiding
    const gebruik = lijn.modus === 'trein' ? km * gebruiksvergoeding(spel, lijn) + ritten * lijn.haltes.length * 6
      : ['tram', 'metro', 'sneltram'].includes(lijn.modus) ? (lijn.eigenSpoor ? 0 : km * 0.9)
      : TYPE[lijn.typeId]?.energie === 'bovenleiding' ? km * 0.35
      : lijn.modus === 'vlucht' ? ritten * (lijn.haltes.length - 1) * landingsgeld(lijn, type) : 0;
    // subsidie: per dienstregelingsuur (plus extra afgesproken met de provincie) en eventueel per reiziger
    const subsidie = (lijn.concessie ? voertuigUren * ((SUBSIDIE_UUR[lijn.modus] || 0) + (lijn.subsidieUurExtra || 0)) + reizigers * (lijn.subsidiePerReiziger || 0) : 0)
      // aangeboden subsidie (provincie): alleen zolang de lijn aan de eisen voldoet
      + (lijn.aanbod && lijn.aanbodOk ? voertuigUren * (lijn.aanbod.perUur || 0) + reizigers * (lijn.aanbod.perReiziger || 0) + startBijdrage(spel, lijn, voertuigUren) : 0);

    m.kaartjes += kaartjes; m.boetes += boetes; m.subsidie += subsidie;
    m.personeel += personeel; m.energie += energie; m.gebruik += gebruik;
    m.reizigers += reizigers; m.zwart += zwart; m.betrapt += betrapt;
    lijn.stat = lijn.stat || { reizigers: 0, opbrengst: 0, kosten: 0, ritten: 0, uitval: 0 };
    lijn.stat.vu = (lijn.stat.vu || 0) + voertuigUren; lijn.stat.subsidie = (lijn.stat.subsidie || 0) + subsidie; lijn.stat.kaartjes = (lijn.stat.kaartjes || 0) + kaartjes + boetes;
    lijn.stat.reizigers += reizigers; lijn.stat.opbrengst += kaartjes + boetes + subsidie; lijn.stat.achter = (lijn.stat.achter || 0) + over; lijn.stat.vraag = (lijn.stat.vraag || 0) + vraagUur;
    lijn.stat.kosten += personeel + energie + gebruik; lijn.stat.ritten += ritten;
    lijn.stat.uitval += ritten / Math.max(rijdt, 0.001) - ritten;
    lijn.bezetting = ritten ? reizigers / (ritten * capaciteit(lijn)) : 0;
    spel.geld += kaartjes + boetes + subsidie - personeel - energie - gebruik;
  }
  // controleurs (steekproef en ploegen)
  if (periode) {
    const ploegKosten = spel.controle.ploegen.reduce((s, p) => s + (uurBegin >= p.van && uurBegin < p.tot ? p.mensen * LOON.controleur : 0), 0);
    const steek = spel.controle.steekproef * 0.01 * spel.lijnen.reduce((s, l) => s + (l.actief ? Math.min(l.nodig, beschikbaarVoor(spel, l)) : 0), 0) * LOON.controleur;
    m.personeel += ploegKosten + steek; spel.geld -= ploegKosten + steek;
  }
}

// startbijdrage van een aangeboden subsidie: de geraamde investering, verdeeld over de eerste 2 dienstdagen
// (18 uur per dag) waarin de lijn aan de eisen voldoet; alleen voor lijnen die na de aanbieding zijn aangelegd
function startBijdrage(spel, lijn, voertuigUren) {
  const a = (spel.aanbiedingen || []).find(x => x.id === lijn.aanbod.id);
  if (!a?.vergoeding?.start || !voertuigUren || !((lijn.startDag ?? -1) >= a.dag - 1)) return 0;
  const rest = a.vergoeding.start - (a.startBetaald || 0); if (rest <= 0) return 0;
  const deel = Math.min(rest, a.vergoeding.start / ((a.vergoeding.aanloopDagen || 2) * 18));
  a.startBetaald = (a.startBetaald || 0) + deel;
  return deel;
}
// landings- en passagiersgelden: groot vliegveld duur, grasveldje bijna gratis
export function landingsgeld(lijn, type) {
  const per = lijn.haltes.map(h => h.landing ?? 60);
  const gem = per.reduce((s, x) => s + x, 0) / Math.max(1, per.length);
  return gem * Math.max(0.15, (type?.zit || 50) / 100);
}

export function gebruiksvergoeding(spel, lijn) {
  // ProRail rekent per treinkilometer; over eigen spoor betaal je niets (benadering)
  return lijn.eigenSpoor ? 0 : 1.95;
}

export function pakkans(spel, lijn) {
  let p = spel.controle.steekproef / 100 * 0.7;
  if (lijn.conducteur) p = Math.max(p, 0.85);
  for (const pl of spel.controle.ploegen) {
    if (!pl.lijnen.includes(lijn.id)) continue;
    // een controleur haalt ongeveer 2 voertuigen per uur, gedeeld over de lijnen van zijn ploeg
    const dekking = pl.mensen * 2 / Math.max(1, pl.lijnen.length * Math.max(1, lijn.nodig));
    p = Math.max(p, Math.min(0.8, dekking * 0.6) * ((pl.tot - pl.van) / (19 * 60)));
  }
  // geen doorloop tussen gekoppelde treinstellen: controleurs wisselen pas op een station van deel; met veel stops
  // gaat dat vaak genoeg, op lange stukken zonder stop (Amersfoort–Zwolle) wordt een deel van de trein niet gecontroleerd
  const t = TYPE[lijn.typeId];
  if (t?.samen && t.doorloop === false) { const delen = 1 + t.samen.filter((c, i) => i > 0 && !TYPE[c]?.soort).length, stopsPerKm = (lijn.haltes?.length || 2) / Math.max(1, lijn.lengteKm || 10); p *= 1 / delen + (1 - 1 / delen) * Math.min(1, stopsPerKm * 4); }
  return Math.min(0.95, p);
}

// welk deel van het benodigde materieel heeft deze lijn (vloot wordt eerlijk verdeeld)
// Een samenstelling (loc + rijtuigen) heeft van elk onderdeel genoeg nodig; onderdelen worden eerlijk verdeeld
// over alle lijnen die ze gebruiken (ook als los treinstel op een andere lijn).
function eigenDeel(spel, lijn, typeId) {
  const per = nodigPer(typeId), eigen = nodigLijn(lijn, typeId);
  let deel = lijn.nodig, totaal = Infinity, vraag = 0;
  for (const [c, kk] of Object.entries(eigen)) {
    const t = spel.voertuigen[c] || 0, k = Math.max(1, per[c] || kk / Math.max(1, lijn.nodig));
    const v = spel.lijnen.filter(l => l.actief).reduce((s, l) => s + (nodigLijn(l, l === lijn ? typeId : l.typeId)[c] || 0), 0) + (lijn.actief ? 0 : kk);
    const d = v <= t ? lijn.nodig : Math.floor(t * lijn.nodig * k / v / k);
    if (d < deel) deel = d;
    totaal = Math.min(totaal, Math.floor(t / k)); vraag = Math.max(vraag, Math.ceil(v / k));
  }
  return { totaal, vraag, deel: Math.max(0, deel) };
}
// hoeveel voertuigen kan deze lijn inzetten (eigen type + eventueel alternatief type dat over is)
export function beschikbaarVoor(spel, lijn) {
  const e = eigenDeel(spel, lijn, lijn.typeId);
  if (e.deel >= lijn.nodig || !lijn.altTypeId) return e.deel;
  const a = eigenDeel(spel, lijn, lijn.altTypeId);
  const over = Math.max(0, a.totaal - a.vraag);
  // het reservemateriaal wordt verdeeld over de lijnen die het als alternatief hebben
  const delers = spel.lijnen.filter(l => l.actief && l.altTypeId === lijn.altTypeId && eigenDeel(spel, l, l.typeId).deel < l.nodig).length || 1;
  return e.deel + Math.min(lijn.nodig - e.deel, Math.floor(over / delers));
}
// welk deel van de ritten rijdt met het alternatieve materieel
export function altDeel(spel, lijn) {
  if (!lijn.altTypeId) return 0;
  const e = eigenDeel(spel, lijn, lijn.typeId).deel;
  if (e >= lijn.nodig) return 0;
  return Math.max(0, (beschikbaarVoor(spel, lijn) - e) / lijn.nodig);
}

// Leeftijd per voertuigtype (jaren): uit de aankopen; wat al in de vloot zat bij de start telt als halverwege zijn tijd
export function leeftijden(spel) {
  const uit = {};
  for (const [id, n] of Object.entries(spel.voertuigen)) {
    if (!n) continue;
    const t = TYPE[id]; if (!t) continue;
    const k = (spel.aankopen || []).filter(a => a.id === id); let som = 0, m = 0;
    for (const a of k) { const nn = Math.min(a.n, n - m); if (nn <= 0) break; som += nn * Math.max(0, spel.jaar - a.jaar + (spel.dag - a.dag) / 360 % 1); m += nn; }
    const oud = Math.max(0, Math.min(t.leven || 30, (spel.jaar - (t.van || spel.jaar)) * 0.5)); // al in de vloot bij de start
    som += (n - m) * oud;
    uit[id] = { gem: som / n, leven: t.leven || 30, n };
  }
  return uit;
}
// onderhoudsfactor door ouderdom: rustig oplopend, na de levensduur flink duurder
export const ouderdomFactor = (gem, leven) => 1 + 0.6 * Math.pow(Math.max(0, gem) / Math.max(1, leven), 2) + Math.max(0, gem - leven) * 0.05;
export function maandAfsluiten(spel) {
  const m = spel.maand;
  // afschrijving van de vloot per maand
  let afschr = 0;
  for (const [id, n] of Object.entries(spel.voertuigen)) {
    const t = TYPE[id]; if (t) afschr += n * t.prijs / t.leven / 12;
  }
  // vast onderhoud per voertuig (kasuitgave)
  let vast = 0;
  const lt = leeftijden(spel); spel._ouderdom = {};
  // stilstand: voertuigen die niet op een lijn rijden roesten (extra onderhoud bij weer in gebruik nemen)
  const gebruikt = {}; for (const l of spel.lijnen) if (l.actief) for (const id of (TYPE[l.typeId]?.samen || [l.typeId])) gebruikt[id] = (gebruikt[id] || 0) + l.nodig;
  let stil = 0;
  for (const [id, n] of Object.entries(spel.voertuigen)) {
    const f = lt[id] ? ouderdomFactor(lt[id].gem, lt[id].leven) : 1; spel._ouderdom[id] = f;
    vast += n * vastOnderhoud(TYPE[id], spel.jaar) * f;
    const ongebruikt = Math.max(0, n - (gebruikt[id] || 0));
    stil += ongebruikt * vastOnderhoud(TYPE[id], spel.jaar) * 0.25;
  }
  m.stilstand = stil; vast += stil;
  m.overig += vast; spel.geld -= vast;
  // poortjes: onderhoud
  const poortjes = spel.controle.poortjes ? spel.haltes.filter(h => h.modus === 'trein' || h.modus === 'metro').length * 4000 : 0;
  m.afschrijving = afschr; m.overig += poortjes;
  // rente op de lening (zelfde formule als in het geldpaneel)
  if (spel.lening) { const rente = spel.lening * spel.lening_rente / 12 || 0; m.rente = rente; m.overig += rente; spel.geld -= rente; }
  spel.geld -= poortjes; // afschrijving is geen kasuitgave: aanschaf is al betaald
  m.inkomsten = m.kaartjes + m.boetes + m.subsidie;
  m.resultaat = m.inkomsten - m.personeel - m.energie - m.gebruik - m.overig - afschr;
  m.dag = spel.dag;
  spel.historie.push(m);
  if (spel.historie.length > 36) spel.historie.shift();
  spel.maand = nieuweMaand();
  for (const l of spel.lijnen) l.stat = null;
}

export function standaardTypeVoor(spel, modus) {
  return standaardType(spel.vervoerder?.naam || '', modus, spel.jaar).id;
}
