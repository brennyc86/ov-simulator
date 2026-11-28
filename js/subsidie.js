// Aangeboden subsidies: de provincie wil verbindingen ontsluiten en biedt daar geld voor, met eisen.
// Er staan altijd een paar aanbiedingen open. Een eigen lijn die beide eindpunten bedient en aan de eisen
// voldoet, krijgt de vergoeding (per dienstregelingsuur of per reiziger) zolang hij blijft voldoen.
import { TYPE, MODI, beschikbaar } from './vloot.js';
import { klassenVan, inrichtingVan, delenVan, KLASSE_NAAM, basisId, klassePrijs } from './comfort.js';
import { nieuwId, vraagLijn, TARIEF, kmKosten, standaardTypeVoor, LOON } from './spel.js';

// De provincie rekent een aanbieding door: verwachte reizigers en kaartjes, exploitatiekosten en de investering
// (materieel en haltes). De subsidie dekt het exploitatietekort (met een kleine marge) en, in de eerste
// AANLOOP_DAGEN, ook de investering: wie de lijn goed neerzet, heeft zijn aanschaf in twee speldagen terugverdiend.
export const AANLOOP_DAGEN = 2;
const DIENST_UREN = 18;                  // ongeveer 6:00–24:00
const VGEM = { trein: 75, sneltram: 35, metro: 32, tram: 18, bus: 24, hov: 38, belbus: 30, veer: 12, watertaxi: 25 };
const HALTE_PRIJS = { bus: 15000, hov: 60000, belbus: 5000, tram: 400000 };
const TUSSEN_BUS = 900;                  // m tussen haltes van een gewone bus (HOV: 2,5 km)

const NAAR = 600; // halte binnen 600 m van het eindpunt telt als bediend
// bezoekers per dag die (extra) met het OV naar een bestemming willen
const BEZOEK = { museum: 250, zwembad: 200, winkelcentrum: 600, dierentuin: 900, pretpark: 1500, stadion: 1200, ziekenhuis: 700, hogeschool: 1500, attractie: 400, theater: 250 };
const kies = a => a[Math.floor(Math.random() * a.length)];
const afst = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// eisen passend bij het jaar: elektrisch pas als het kon, comfort en frequentie naar de tijd; soms een stoppatroon,
// een bepaald type materieel of een minimum aantal zitplaatsen van een bepaald comfort
function eisenVoor(jaar, modus, tussen, niveau = 2) {
  const e = {};
  if (niveau === 0) { e.perUur = jaar < 1940 ? 0.5 : 1; if (modus === 'trein' && tussen.length) e.stops = { soort: 'alle' }; return e; } // eenvoudig: gewoon rijden en overal stoppen
  const elektrischKan = modus === 'trein' ? jaar >= 1930 : modus === 'bus' || modus === 'hov' ? jaar >= 2015 : false;
  if (elektrischKan && Math.random() < (jaar >= 2015 ? 0.5 : 0.2)) e.elektrisch = true;
  if (jaar >= 1950 && Math.random() < 0.35) e.comfort = { klasse: '2', min: modus === 'trein' ? 6 : 4.8 };
  if (modus === 'trein' && jaar >= 1960 && Math.random() < 0.2) e.klasse = '1'; // ook een 1e klas
  e.perUur = jaar < 1940 ? (modus === 'trein' ? 0.34 : 0.5) : jaar < 1970 ? 1 : 2; // minimaal per uur per richting overdag (10–16 uur)
  // stoppatroon: juist overal stoppen (ontsluiten) of juist snel (hooguit n tussenstops)
  if (modus === 'trein' && tussen.length >= 2) { const k = Math.random(); if (k < 0.35) e.stops = { soort: 'alle' }; else if (k < 0.6) e.stops = { soort: 'max', n: Math.floor(Math.random() * Math.min(3, tussen.length - 1)) }; }
  // type materieel (een type dat in dit jaar te koop is)
  const typen = beschikbaar(jaar, modus).filter(t => t.energie !== 'bovenleiding' && (!e.elektrisch || ['elektrisch', 'waterstof', 'accu-hybride'].includes(t.energie)));
  if (niveau === 1) { delete e.klasse; delete e.comfort; return e; }
  // hogere niveaus: snelle verbinding, juist goedkoop, of beter comfort omdat reizigers ontevreden zijn
  if (niveau >= 3) { const r = Math.random();
    if (r < 0.3 && modus === 'trein') { e.stops = { soort: 'max', n: Math.min(1, tussen.length) }; e.reden = 'snel'; }
    else if (r < 0.55) { e.goedkoop = 0.85; e.reden = 'goedkoop'; }
    else if (r < 0.85 && jaar >= 1950) { e.comfort = { klasse: '2', min: modus === 'trein' ? 7 : 5.5 }; e.reden = 'comfort'; }
    if (niveau >= 4 && modus === 'trein' && jaar >= 1960) e.klasse = '1'; }
  if (typen.length > 1 && Math.random() < 0.22) e.typeId = kies(typen).id;
  // minimum aantal zitplaatsen van een bepaald comfort per rit
  else if (jaar >= 1950 && Math.random() < 0.3) {
    const klasse = modus === 'trein' && Math.random() < 0.4 ? '1' : '2';
    e.plaatsen = { klasse, min: modus === 'trein' ? (klasse === '1' ? 40 : 160) + 10 * Math.floor(Math.random() * 6) : 30 + 5 * Math.floor(Math.random() * 4), comfort: modus === 'trein' ? 5.5 : 4.5 };
  }
  return e;
}
export function eisenTekst(e) {
  const t = [];
  if (e.perUur) t.push(e.perUur >= 1 ? `minstens ${e.perUur}× per uur per richting overdag` : `minstens elke ${Math.round(60 / e.perUur)} minuten overdag`);
  if (e.stops) t.push(e.stops.soort === 'alle' ? 'stopt op alle stations onderweg' : e.stops.n ? `hooguit ${e.stops.n} tussenstop${e.stops.n > 1 ? 's' : ''}` : 'zonder tussenstops');
  if (e.elektrisch) t.push('elektrisch materieel');
  if (e.typeId) t.push(`materieel: ${TYPE[e.typeId]?.naam || e.typeId}`);
  if (e.comfort) t.push(`comfort ${KLASSE_NAAM[e.comfort.klasse]} minstens ${String(e.comfort.min).replace('.', ',')}`);
  if (e.klasse) t.push(`met een ${KLASSE_NAAM[e.klasse]}`);
  if (e.goedkoop) t.push(`2e-klastarief hooguit ${Math.round(e.goedkoop * 100)}% van het standaardtarief`);
  if (e.plaatsen) t.push(`minstens ${e.plaatsen.min} zitplaatsen ${KLASSE_NAAM[e.plaatsen.klasse]} met comfort ${String(e.plaatsen.comfort).replace('.', ',')} of meer`);
  return t.join(', ');
}

// stations op of vlak bij de rechte lijn a–b (in volgorde), zonder a en b zelf
function tussenStations(stations, a, b, jaar) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, l = Math.sqrt(l2), uit = [];
  for (const s of stations) {
    if (s.s !== 'trein' || (s.b && s.b > jaar) || (s.e && s.e <= jaar)) continue;
    const f = ((s.x - a.x) * dx + (s.y - a.y) * dy) / l2; if (f <= 0.02 || f >= 0.98) continue;
    const d = Math.abs((s.x - a.x) * dy - (s.y - a.y) * dx) / l;
    if (d < Math.max(1500, l * 0.06) && afst(s, a) > 800 && afst(s, b) > 800) uit.push({ naam: s.n, x: s.x, y: s.y, f });
  }
  return uit.sort((p, q) => p.f - q.f).filter((s, i, r) => !i || afst(s, r[i - 1]) > 600);
}
// welke tussenhaltes de raming gebruikt: alle stations, hooguit n, of (bus) elke ~900 m
function haltesVoor(a, b, modus, tussen, eisen) {
  const km = afst(a, b);
  if (modus === 'trein') {
    let t = tussen;
    if (eisen.stops?.soort === 'max') t = eisen.stops.n ? tussen.filter((_, i) => (i + 1) % Math.ceil((tussen.length + 1) / (eisen.stops.n + 1)) === 0).slice(0, eisen.stops.n) : [];
    else if (eisen.stops?.soort !== 'alle') t = tussen.filter((_, i) => i % 2 === 1); // gemiddeld: ongeveer de helft
    return [a, ...t, b];
  }
  const stap = modus === 'hov' ? 2500 : modus === 'belbus' ? 3000 : TUSSEN_BUS, n = Math.max(0, Math.round(km / stap) - 1), uit = [a];
  for (let i = 1; i <= n; i++) uit.push({ x: a.x + (b.x - a.x) * i / (n + 1), y: a.y + (b.y - a.y) * i / (n + 1) });
  return [...uit, b];
}
// raming voor de provincie (en om aan de speler te laten zien)
export function raming(spel, a, plaatsen) {
  const e = a.eisen, modus = a.modus, mod = MODI[modus] || MODI.bus;
  const haltes = haltesVoor(a.a, a.b, modus, a.tussen || [], e);
  const omweg = modus === 'trein' ? 1.15 : 1.3;
  const km = []; let s = 0; haltes.forEach((h, i) => { if (i) s += afst(h, haltes[i - 1]) * omweg; km.push(s); });
  const lengteKm = s / 1000, perUur = Math.max(e.perUur || 1, modus === 'trein' ? 1 : 2);
  const duurMin = lengteKm / (VGEM[modus] || 25) * 60 + (haltes.length - 2) * (mod.halteTijd / 60) * 0.6;
  const vertrekPerRichting = Math.round(perUur * DIENST_UREN);
  const nep = { modus, haltes: haltes.map(h => ({ x: h.x, y: h.y })), km, lengteKm, duur: duurMin * 60, richting: 'beide',
    vertrek: [Array(vertrekPerRichting).fill(0), Array(vertrekPerRichting).fill(0)] };
  const { perDag, gemKm } = vraagLijn(nep, plaatsen, 0);
  const reizigers = perDag * (0.6 + 0.4 * ((spel.reputatie ?? 60) / 100));
  const [instap, perKm] = TARIEF[modus] || TARIEF.bus;
  const ritprijs = instap + perKm * (modus === 'trein' ? Math.min(gemKm, 40) + Math.max(0, gemKm - 40) * 0.7 : gemKm);
  const kaartjes = reizigers * ritprijs * 0.96; // min zwartrijders
  // materieel: genoeg voor de gevraagde frequentie (heen en terug plus keren), bij de trein één reserve
  const typeId = e.typeId || standaardTypeVoor(spel, modus), t = TYPE[typeId] || {};
  const inzet = Math.max(1, Math.ceil(2 * (duurMin + mod.keer) / (60 / perUur)));
  const voertuigen = inzet + (modus === 'trein' && inzet > 2 ? 1 : 0);
  const vu = inzet * DIENST_UREN, kmDag = 2 * vertrekPerRichting * lengteKm;
  const kosten = vu * mod.loon * (t.pers || 1) + kmDag * kmKosten(t, spel.jaar)
    + (modus === 'trein' ? kmDag * 1.95 + 2 * vertrekPerRichting * haltes.length * 6 : ['tram', 'metro', 'sneltram'].includes(modus) ? kmDag * 0.9 : 0);
  const infra = (HALTE_PRIJS[modus] || 0) * Math.max(2, Math.round(haltes.length * 0.5));
  const investering = voertuigen * (t.prijs || 1e6) + infra;
  return { reizigers: Math.round(reizigers), kaartjes: Math.round(kaartjes), kosten: Math.round(kosten), investering: Math.round(investering), voertuigen, typeId,
    vu, lengteKm: Math.round(lengteKm * 10) / 10, stops: haltes.length - 2, ritprijs: Math.round(ritprijs * 100) / 100 };
}
// vergoeding uit de raming: doorlopend het exploitatietekort + 15% marge (per dienstuur of per reiziger),
// en een startbijdrage ter hoogte van de investering, uitbetaald in de eerste AANLOOP_DAGEN
function vergoedingUit(r, perReiziger) {
  const tekort = Math.max(r.kosten * 0.15, r.kosten * 1.15 - r.kaartjes), start = Math.round(r.investering / 1e5) * 1e5;
  return perReiziger ? { perReiziger: Math.round(tekort / Math.max(30, r.reizigers) * 20) / 20, start, aanloopDagen: AANLOOP_DAGEN }
    : { perUur: Math.round(tekort / r.vu), start, aanloopDagen: AANLOOP_DAGEN };
}

// een nieuwe aanbieding bedenken: twee plaatsen of stations die beter verbonden moeten worden
// opties: { modus: 'trein' | 'bus' | 'hov' (vast), binnen: (x, y) => bool (vertrekpunt in deze regio) }
// niveau 0..4: eerst eenvoudige, korte verbindingen; wie ze goed rijdt, krijgt grotere en lastigere aanbiedingen.
// Een grote vervoerder (bv. NS) begint hoger, maar krijgt er minder.
export const subsidieNiveau = spel => Math.min(4, Math.floor((spel.subsidieSucces || 0) / 2) + (spel.groot ? 2 : 0));
const AFSTAND = { trein: [[10000, 30000], [12000, 45000], [12000, 60000], [30000, 100000], [50000, 160000]], bus: [[4000, 15000], [5000, 20000], [5000, 25000], [8000, 30000], [12000, 40000]] };
const REDEN = { snel: 'De provincie wil een snelle verbinding.', goedkoop: 'Er is vraag naar goedkoop vervoer (studenten, ouderen).', comfort: 'Reizigers zijn ontevreden over het comfort op deze verbinding.' };
export const redenTekst = a => a.doel ? `Bezoekers willen met het OV naar ${a.doel.naam} (${a.doel.soort}) vanaf ${a.a.naam}. De halte mag op hooguit 600 m liggen.` : a.opheffing ? `${a.opheffing.vervoerder} stopt met lijn ${a.opheffing.nr}; de provincie zoekt een nieuwe vervoerder.` : REDEN[a.eisen?.reden] || '';
// treinsubsidies alleen waar spoor in de kaartgegevens zit (in landen zonder spoordata is een trein niet reëel)
let treinGebied = () => true;
export const zetTreinGebied = f => { treinGebied = f || (() => true); };
export const treinMogelijk = a => a.modus !== 'trein' || (treinGebied(a.a.x, a.a.y) && treinGebied(a.b.x, a.b.y));
export function bedenkAanbieding(spel, stations, plaatsen, opties = {}) {
  const jaar = spel.jaar, binnen = opties.binnen || (() => true), niveau = opties.niveau ?? subsidieNiveau(spel);
  const [dt0, dt1] = AFSTAND.trein[niveau], [db0, db1] = AFSTAND.bus[niveau];
  const trein = opties.modus ? opties.modus === 'trein' : Math.random() < 0.45;
  let a, b, modus;
  if (trein) {
    const st = stations.filter(s => s.s === 'trein' && !(s.b && s.b > jaar) && !(s.e && s.e <= jaar) && treinGebied(s.x, s.y)), start = st.filter(s => binnen(s.x, s.y));
    for (let k = 0; k < 40 && !b && start.length; k++) { a = kies(start); const ver = st.filter(s => { const d = afst(a, s); return d > dt0 && d < dt1 && (!opties.doelBinnen || opties.doelBinnen(s.x, s.y)); }); if (ver.length) b = kies(ver);
      // naar een belangrijk punt buiten de regio: liefst een groot station
      if (!opties.doelBinnen && opties.binnen && b) { const groot = st.filter(s => (s.p || 0) >= 6 && !opties.binnen(s.x, s.y) && afst(a, s) < dt1 * 1.5); if (groot.length) b = kies(groot); } }
    modus = 'trein';
    if (b) { a = { naam: a.n, x: a.x, y: a.y }; b = { naam: b.n, x: b.x, y: b.y }; }
  }
  if (!b && opties.modus === 'trein') return null;
  // bestemming: een museum, zwembad, winkelcentrum ... bereikbaar maken vanaf het dichtstbijzijnde station of de plaats
  let doel = null;
  if (!b && opties.voorz?.length && !opties.modus && Math.random() < 0.4) {
    const soorten = ['museum', 'museum', 'zwembad', 'zwembad', 'winkelcentrum', 'winkelcentrum', 'dierentuin', 'pretpark', 'stadion', 'ziekenhuis', 'hogeschool', 'attractie', 'theater'];
    for (let k = 0; k < 30 && !b; k++) {
      const soort = kies(soorten), kand = opties.voorz.filter(v => v.s === soort && binnen(v.x, v.y) && /[A-Z0-9]/.test(v.n) && v.n.length > 4); if (!kand.length) continue; // geen naamloze 'kinderboerderij'
      const v = kies(kand), maxA = ['pretpark', 'dierentuin', 'stadion'].includes(soort) ? 25000 : 12000;
      const st = stations.filter(s => s.s === 'trein' && !(s.b && s.b > jaar) && !(s.e && s.e <= jaar)).map(s => [s, afst(s, v)]).filter(([, d]) => d > 1200 && d < maxA).sort((p, q) => p[1] - q[1])[0];
      if (!st) continue;
      a = { naam: st[0].n, x: st[0].x, y: st[0].y }; b = { naam: v.n, x: v.x, y: v.y };
      doel = { naam: v.n, s: soort, soort: { winkelcentrum: 'winkelcentrum', attractie: 'bezienswaardigheid', hogeschool: 'hogeschool/universiteit' }[soort] || soort };
      modus = st[1] > 15000 && jaar >= 1990 ? 'hov' : 'bus';
    }
  }
  if (!b) {
    const pl = plaatsen.filter(p => p[3] >= 3000), start = pl.filter(p => binnen(p[1], p[2]));
    for (let k = 0; k < 40 && !b && start.length; k++) { a = kies(start); const ver = pl.filter(p => { const d = Math.hypot(p[1] - a[1], p[2] - a[2]); return d > db0 && d < db1 && (!opties.doelBinnen || opties.doelBinnen(p[1], p[2])); }); if (ver.length) b = kies(ver); }
    if (!b) return null;
    modus = opties.modus || (Math.hypot(b[1] - a[1], b[2] - a[2]) > 15000 && jaar >= 1990 && Math.random() < 0.4 ? 'hov' : 'bus');
    a = { naam: a[0], x: a[1], y: a[2] }; b = { naam: b[0], x: b[1], y: b[2] };
  }
  if ((spel.aanbiedingen || []).some(x => x.status !== 'verlopen' && [x.a.naam, x.b.naam].sort().join() === [a.naam, b.naam].sort().join())) return null;
  const tussen = modus === 'trein' ? tussenStations(stations, a, b, jaar) : [];
  const e = eisenVoor(jaar, modus, tussen, niveau);
  const ag = { a, b, modus, eisen: e, tussen, niveau, ...(doel ? { doel } : {}) };
  const r = raming(spel, ag, plaatsen);
  // een bestemming trekt bezoekers, ook als er weinig mensen wonen
  if (doel) { r.reizigers += Math.round((BEZOEK[doel.s] || 200) * (0.6 + Math.random() * 0.8)); r.kaartjes = Math.round(r.reizigers * r.ritprijs * 0.96); }
  if (r.reizigers < 25) return null; // vrijwel niemand: geen aanbieding
  const vergoeding = vergoedingUit(r, r.reizigers >= 300 && Math.random() < 0.4); // per reiziger alleen bij genoeg reizigers
  return { id: nieuwId('sub'), ...ag, raming: r, vergoeding, status: 'open', dag: spel.dag, tot: spel.dag + 90 + Math.floor(Math.random() * 90), lijnId: null };
}
const mln = n => n >= 1e6 ? `€ ${(n / 1e6).toFixed(1).replace('.', ',')} mln` : `€ ${Math.round(n).toLocaleString('nl-NL')}`;
export function vergoedingTekst(v) {
  const door = v.perReiziger ? `€ ${v.perReiziger.toFixed(2).replace('.', ',')} per reiziger` : `€ ${v.perUur} per dienstregelingsuur`;
  return v.start ? `startbijdrage ${mln(v.start)} (in de eerste ${v.aanloopDagen || 2} dagen) + ${door}` : door;
}
// uitleg van de raming: waarom dit bedrag
export function ramingTekst(r) {
  if (!r) return '';
  const winst = r.kaartjes - r.kosten;
  return `verwacht ${r.reizigers.toLocaleString('nl-NL')} reizigers per dag (€ ${r.ritprijs.toFixed(2).replace('.', ',')} per rit) · kaartjes ${mln(r.kaartjes)}/dag, kosten ${mln(r.kosten)}/dag · investering ${mln(r.investering)} (${r.voertuigen}× ${TYPE[r.typeId]?.naam || r.typeId}${r.stops ? `, ${r.stops} tussenstops` : ''})` + (winst < 0 ? ' · zonder subsidie verlieslatend' : '');
}

// bedient de lijn beide eindpunten (in een van de richtingen)?
export function bedient(lijn, a) {
  const bij = p => lijn.haltes.some(h => Math.hypot(h.x - p.x, h.y - p.y) < NAAR);
  const modusOk = a.modus === lijn.modus || (a.modus === 'bus' && ['bus', 'hov'].includes(lijn.modus)) || (a.modus === 'hov' && ['hov', 'bus'].includes(lijn.modus));
  return modusOk && bij(a.a) && bij(a.b);
}
// voldoet de lijn aan de eisen? geeft {ok, redenen}
export function toetsEisen(lijn, a) {
  const r = [];
  if (!bedient(lijn, a)) r.push(`bedient niet zowel ${a.a.naam} als ${a.b.naam} met een ${MODI[a.modus].naam.toLowerCase()}`);
  const e = a.eisen;
  if (e.perUur) {
    const n = Math.min(...lijn.vertrek.filter((v, i) => i === 0 || v.length).map(v => v.filter(t => t >= 10 * 60 && t < 16 * 60).length / 6));
    if (n + 1e-6 < e.perUur) r.push(`rijdt overdag ${n >= 1 ? `${n.toFixed(1).replace('.', ',')}× per uur` : `elke ${Math.round(60 / Math.max(0.01, n))} min`}; gevraagd ${e.perUur >= 1 ? `${e.perUur}× per uur` : `elke ${Math.round(60 / e.perUur)} min`}`);
  }
  const t = TYPE[lijn.typeId];
  if (e.elektrisch) {
    const en = delenVan(lijn.typeId).map(c => TYPE[c]).filter(x => x && x.soort !== 'rijtuig' && x.soort !== 'stuurstand').map(x => x.energie);
    if (!en.every(x => ['elektrisch', 'bovenleiding', 'waterstof', 'accu-hybride'].includes(x))) r.push(`materieel is niet elektrisch (${en.join(', ') || t?.energie})`);
  }
  if (e.comfort || e.klasse) {
    const kl = klassenVan(inrichtingVan(lijn, lijn.typeId), lijn.typeId, lijn.modus);
    if (e.comfort) { const k = kl.find(x => x.klasse === e.comfort.klasse); if (!k) r.push(`geen ${KLASSE_NAAM[e.comfort.klasse]}`); else if (k.comfort + 1e-6 < e.comfort.min) r.push(`comfort ${KLASSE_NAAM[e.comfort.klasse]} is ${k.comfort.toFixed(1).replace('.', ',')}, gevraagd ${String(e.comfort.min).replace('.', ',')}`); }
    if (e.klasse && !kl.some(x => x.klasse === e.klasse)) r.push(`geen ${KLASSE_NAAM[e.klasse]}`);
  }
  if (e.stops) {
    // tussenstops tussen de haltes bij a en b
    const ia = lijn.haltes.findIndex(h => afst(h, a.a) < NAAR), ib = lijn.haltes.findIndex(h => afst(h, a.b) < NAAR);
    if (ia >= 0 && ib >= 0) {
      const tus = lijn.haltes.slice(Math.min(ia, ib) + 1, Math.max(ia, ib));
      if (e.stops.soort === 'max' && tus.length > e.stops.n) r.push(`stopt ${tus.length}× onderweg; hooguit ${e.stops.n} toegestaan`);
      if (e.stops.soort === 'alle') { const mist = (a.tussen || []).filter(s => !tus.some(h => afst(h, s) < NAAR)); if (mist.length) r.push(`stopt niet in ${mist.slice(0, 4).map(s => s.naam).join(', ')}${mist.length > 4 ? ` en ${mist.length - 4} andere` : ''}`); }
    }
  }
  if (e.typeId && !delenVan(lijn.typeId).some(c => basisId(c) === e.typeId || c === e.typeId) && basisId(lijn.typeId) !== e.typeId) r.push(`rijdt niet met ${TYPE[e.typeId]?.naam || e.typeId}`);
  if (e.plaatsen) {
    const kl = klassenVan(inrichtingVan(lijn, lijn.typeId), lijn.typeId, lijn.modus).find(x => x.klasse === e.plaatsen.klasse);
    const n = kl && kl.comfort + 1e-6 >= e.plaatsen.comfort ? kl.zit : 0;
    if (n < e.plaatsen.min) r.push(`${n} zitplaatsen ${KLASSE_NAAM[e.plaatsen.klasse]} met comfort ${String(e.plaatsen.comfort).replace('.', ',')}+; gevraagd ${e.plaatsen.min}`);
  }
  if (e.goedkoop && klassePrijs('2') > e.goedkoop + 1e-6) r.push(`2e-klastarief is ${Math.round(klassePrijs('2') * 100)}% van standaard; gevraagd hooguit ${Math.round(e.goedkoop * 100)}%`);
  if (!lijn.actief) r.push('de lijn rijdt niet');
  return { ok: !r.length, redenen: r };
}

// een andere vervoerder stopt (in het spel) met een korte lijn: de provincie zoekt een opvolger. Eenvoudige eisen
// (zelfde haltes, ongeveer dezelfde frequentie), dus een goede eerste opdracht.
export function opheffingAanbieding(spel, ai, plaatsen) {
  const h = ai.haltes; if (h.length < 2) return null;
  const a = { naam: h[0].naam, x: h[0].x, y: h[0].y }, b = { naam: h[h.length - 1].naam, x: h[h.length - 1].x, y: h[h.length - 1].y };
  const tussen = ai.modus === 'trein' ? h.slice(1, -1).map(x => ({ naam: x.naam, x: x.x, y: x.y })) : [];
  const overdag = (ai.vertrek?.[0] || []).filter(t => t >= 600 && t < 960).length / 6;
  const e = { perUur: Math.max(0.5, Math.min(2, Math.round(overdag * 2) / 2 || 1)) };
  if (ai.modus === 'trein' && tussen.length) e.stops = { soort: 'alle' };
  const modus = ai.modus === 'trein' ? 'trein' : ['bus', 'hov'].includes(ai.modus) ? ai.modus : null; if (!modus) return null;
  const ag = { a, b, modus, eisen: e, tussen, niveau: 0, opheffing: { vervoerder: ai.vervoerderNaam, nr: ai.nr, sleutel: `${ai.vervoerder}:${ai.lijnId}` } };
  const r = raming(spel, ag, plaatsen); if (r.reizigers < 15) return null;
  return { id: nieuwId('sub'), ...ag, raming: r, vergoeding: vergoedingUit(r, false), status: 'open', dag: spel.dag, tot: spel.dag + 60 + Math.floor(Math.random() * 60), lijnId: null };
}
