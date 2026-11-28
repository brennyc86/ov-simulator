// Tweedehandsmarkt en renovatie.
// Grote vervoerders doen bij een vlootvernieuwing hun oude materieel in partijen van de hand; af en toe duikt er
// een klassieker op (bij een verzamelaar, museum of uit een loods). Oud materieel is duurder in onderhoud en per km
// (slijtage, minder kennis, minder zuinig: zie ouderdomFactor in spel.js). Renoveren maakt het technisch weer
// jonger, maar kost tijd: zolang staan de voertuigen niet ter beschikking. Het type (en dus de nostalgische waarde)
// blijft hetzelfde; het interieur vernieuw je los daarvan (of juist niet).
import { VLOOT, TYPE } from './vloot.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const kies = l => l[Math.floor(Math.random() * l.length)];
const id = () => 'm' + Math.random().toString(36).slice(2, 9);
const MODI_MARKT = ['trein', 'metro', 'sneltram', 'tram', 'bus'];
export const STAAT = { goed: { naam: 'goed onderhouden', prijs: 1 }, matig: { naam: 'gebruikt, matig', prijs: 0.8 }, slecht: { naam: 'slecht, niet rijvaardig', prijs: 0.5 } };
const VERZAMELAARS = ['een particuliere verzamelaar', 'Stichting Museummaterieel', 'een museumspoorlijn', 'een failliete toeristenlijn', 'een verzamelaar in België', 'een loods in Duitsland', 'een stichting die opheft'];

// waarde per stuk van een gebruikt voertuig
export function marktPrijs(t, leeftijd, staat) {
  const leven = t.leven || 30;
  const klassiek = leeftijd > leven;
  const basis = klassiek ? t.prijs * 0.18 : t.prijs * Math.max(0.06, 0.75 * (1 - leeftijd / leven));
  return Math.max(5000, Math.round(basis * (STAAT[staat]?.prijs || 1) / 1000) * 1000);
}
const verkoperVan = t => { const w = (t.wie || '').split(/[,(]/)[0].trim(); return w && w !== 'diverse' ? w : 'een vervoerder'; };

// een partij van een vervoerder die zijn vloot vernieuwt
function partij(spel) {
  const j = spel.jaar;
  const kand = VLOOT.filter(v => MODI_MARKT.includes(v.modus) && !v.samen && v.soort !== 'wagon' && v.van <= j - 12 && v.tot >= j - 1 && !['ice3', 'ice4', 'tgvduplex', 'thalys'].includes(v.id));
  if (!kand.length) return null;
  // vaker typen die (bijna) uitgefaseerd worden
  const gewogen = kand.flatMap(v => Array(v.tot - j <= 5 ? 4 : 1).fill(v));
  const t = kies(gewogen), leven = t.leven || 30;
  const leeftijd = Math.max(8, Math.min(leven + 8, j - t.van - rnd(0, 6)));
  const staat = leeftijd < leven * 0.6 ? 'goed' : leeftijd < leven ? kies(['goed', 'matig', 'matig']) : kies(['matig', 'slecht']);
  const n = t.soort === 'loc' ? rnd(2, 8) : t.soort ? rnd(6, 30) : rnd(3, 18);
  return { id: id(), typeId: t.id, n, leeftijd, staat, prijs: marktPrijs(t, leeftijd, staat), van: verkoperVan(t), tot: spel.dag + rnd(20, 45), soort: 'partij' };
}
// een klassieker: lang uit dienst, één of een paar stuks
function klassieker(spel) {
  const j = spel.jaar;
  const kand = VLOOT.filter(v => MODI_MARKT.includes(v.modus) && !v.samen && v.soort !== 'wagon' && v.tot < j - 5 && v.van < j);
  if (!kand.length) return null;
  const t = kies(kand), leeftijd = j - t.van - rnd(0, Math.max(0, t.tot - t.van));
  const staat = kies(['slecht', 'slecht', 'matig', 'goed']);
  const n = t.soort === 'rijtuig' ? rnd(1, 4) : rnd(1, 2);
  return { id: id(), typeId: t.id, n, leeftijd, staat, prijs: marktPrijs(t, leeftijd, staat), van: kies(VERZAMELAARS), tot: spel.dag + rnd(15, 40), soort: 'klassieker' };
}

// elke speldag: verlopen aanbiedingen weg, soms een nieuwe partij of klassieker. Geeft nieuwe aanbiedingen terug.
export function marktBijwerken(spel) {
  spel.markt = (spel.markt || []).filter(a => a.tot >= spel.dag && a.n > 0);
  const nieuw = [];
  if (!spel.markt.length || Math.random() < 1 / 12) { const a = partij(spel); if (a) nieuw.push(a); }
  if (Math.random() < 1 / 45) { const a = klassieker(spel); if (a) nieuw.push(a); }
  spel.markt.push(...nieuw);
  return nieuw;
}

// kopen: voertuigen komen in de vloot met hun leeftijd; 'slecht' moet eerst technisch gerenoveerd worden
export function koopVanMarkt(spel, aanbod, n) {
  n = Math.max(1, Math.min(aanbod.n, n));
  // een loc-getrokken trein (stoomtrein, DDM met loc ...) komt binnen als losse loc en losse rijtuigen
  const delen = {}; for (const c of TYPE[aanbod.typeId]?.deel || [aanbod.typeId]) delen[c] = (delen[c] || 0) + n;
  for (const [c, k] of Object.entries(delen)) {
    spel.voertuigen[c] = (spel.voertuigen[c] || 0) + k;
    (spel.aankopen = spel.aankopen || []).unshift({ id: c, n: k, dag: spel.dag, jaar: spel.jaar, oud: aanbod.leeftijd, staat: aanbod.staat });
    if (aanbod.staat === 'slecht') (spel.renovaties = spel.renovaties || []).push({ id: id(), typeId: c, n: k, soort: 'wacht', oud: aanbod.leeftijd });
  }
  aanbod.n -= n;
  return n;
}

// ---------------------------------------------------------------- renovatie
// technische revisie: kosten en duur per voertuig; daarna telt het voertuig technisch als ruim de helft jonger (minstens 5 jaar)
export function renovatieKosten(t) { return Math.round(t.prijs * (t.soort === 'rijtuig' || t.soort === 'stuurstand' ? 0.16 : 0.22) / 1000) * 1000; }
export const renovatieDagen = t => t.modus === 'bus' ? 21 : t.soort === 'loc' || !t.soort ? 45 : 30;
// voertuigen die nu niet inzetbaar zijn (in revisie of wachtend op revisie)
export const buitenDienst = (spel, typeId) => (spel.renovaties || []).filter(r => r.typeId === typeId).reduce((a, r) => a + r.n, 0);
export const inzetbaar = (spel, typeId) => Math.max(0, (spel.voertuigen[typeId] || 0) - buitenDienst(spel, typeId));
export const wachtOpRevisie = (spel, typeId) => (spel.renovaties || []).filter(r => r.typeId === typeId && r.soort === 'wacht').reduce((a, r) => a + r.n, 0);

// revisie starten voor n voertuigen van dit type (eerst de wachtende, niet-rijvaardige)
export function startRevisie(spel, typeId, n) {
  const t = TYPE[typeId]; if (!t) return 0;
  const vrij = inzetbaar(spel, typeId) + wachtOpRevisie(spel, typeId); n = Math.max(0, Math.min(n, vrij)); if (!n) return 0;
  let rest = n;
  for (const r of spel.renovaties || []) { if (r.typeId !== typeId || r.soort !== 'wacht' || !rest) continue; const k = Math.min(r.n, rest); r.n -= k; rest -= k; }
  spel.renovaties = (spel.renovaties || []).filter(r => r.n > 0);
  spel.renovaties.push({ id: id(), typeId, n, soort: 'revisie', klaar: spel.dag + renovatieDagen(t) });
  return n;
}
// klaar? dan de leeftijd van de oudste n voertuigen verlagen. Geeft de afgeronde revisies terug.
export function renovatiesAfronden(spel, leeftijden) {
  const klaar = (spel.renovaties || []).filter(r => r.soort === 'revisie' && r.klaar <= spel.dag);
  if (!klaar.length) return [];
  spel.renovaties = spel.renovaties.filter(r => !klaar.includes(r));
  const lt = leeftijden(spel);
  for (const r of klaar) {
    const t = TYPE[r.typeId], leven = t?.leven || 30, gem = lt[r.typeId]?.gem ?? 0;
    // de oudste aankopen van dit type inleveren en als 'gereviseerd' terugzetten
    const ak = (spel.aankopen || []).filter(a => a.id === r.typeId).sort((a, b) => (a.jaar - (a.oud || 0)) - (b.jaar - (b.oud || 0)));
    let rest = r.n; for (const a of ak) { if (!rest) break; const k = Math.min(a.n, rest); a.n -= k; rest -= k; }
    spel.aankopen = (spel.aankopen || []).filter(a => a.n > 0);
    spel.aankopen.unshift({ id: r.typeId, n: r.n, dag: spel.dag, jaar: spel.jaar, oud: Math.max(5, Math.min(gem, leven) * 0.55), staat: 'gereviseerd' });
  }
  return klaar;
}

// bij de start: een kleine markt met locs en treinstellen die niet meer nieuw gemaakt worden (met de gevolgen:
// duurder onderhoud en verbruik), en soms een klassieker
export function marktStart(spel) {
  if (spel.marktGestart) return; spel.marktGestart = true;
  const j = spel.jaar, uit = VLOOT.filter(v => ['trein', 'tram', 'bus'].includes(v.modus) && !v.samen && v.soort !== 'wagon' && v.soort !== 'rijtuig' && v.tot < j && v.tot >= j - 12 && v.van < j - 10);
  const gekozen = [...uit].sort(() => Math.random() - 0.5).slice(0, 4);
  spel.markt = spel.markt || [];
  for (const t of gekozen) {
    const leven = t.leven || 30, leeftijd = Math.max(10, Math.min(leven + 15, j - t.van - rnd(0, 8)));
    const staat = leeftijd < leven ? kies(['goed', 'matig']) : kies(['matig', 'matig', 'slecht']);
    spel.markt.push({ id: id(), typeId: t.id, n: t.soort === 'loc' ? rnd(1, 4) : rnd(2, 6), leeftijd, staat, prijs: marktPrijs(t, leeftijd, staat), van: verkoperVan(t), tot: spel.dag + rnd(25, 50), soort: 'partij' });
  }
  const k = klassieker(spel); if (k) spel.markt.push(k);
}
