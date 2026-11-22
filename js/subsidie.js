// Aangeboden subsidies: de provincie wil verbindingen ontsluiten en biedt daar geld voor, met eisen.
// Er staan altijd een paar aanbiedingen open. Een eigen lijn die beide eindpunten bedient en aan de eisen
// voldoet, krijgt de vergoeding (per dienstregelingsuur of per reiziger) zolang hij blijft voldoen.
import { TYPE, MODI } from './vloot.js';
import { klassenVan, inrichtingVan, delenVan, KLASSE_NAAM } from './comfort.js';
import { nieuwId, SUBSIDIE_UUR } from './spel.js';

const NAAR = 600; // halte binnen 600 m van het eindpunt telt als bediend
const kies = a => a[Math.floor(Math.random() * a.length)];
const afst = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// eisen passend bij het jaar: elektrisch pas als het kon, comfort en frequentie naar de tijd
function eisenVoor(jaar, modus) {
  const e = {};
  const elektrischKan = modus === 'trein' ? jaar >= 1930 : modus === 'bus' || modus === 'hov' ? jaar >= 2015 : false;
  if (elektrischKan && Math.random() < (jaar >= 2015 ? 0.6 : 0.25)) e.elektrisch = true;
  if (jaar >= 1950 && Math.random() < 0.5) e.comfort = { klasse: '2', min: modus === 'trein' ? 6 : 4.8 };
  if (modus === 'trein' && jaar >= 1960 && Math.random() < 0.25) e.klasse = '1'; // ook een 1e klas
  const dal = jaar < 1940 ? (modus === 'trein' ? 0.34 : 0.5) : jaar < 1970 ? 1 : modus === 'trein' ? 2 : modus === 'bus' ? 2 : 2;
  e.perUur = dal; // minimaal aantal ritten per uur per richting overdag (10–16 uur)
  return e;
}
export function eisenTekst(e) {
  const t = [];
  if (e.perUur) t.push(e.perUur >= 1 ? `minstens ${e.perUur}× per uur per richting overdag` : `minstens elke ${Math.round(60 / e.perUur)} minuten overdag`);
  if (e.elektrisch) t.push('elektrisch materieel');
  if (e.comfort) t.push(`comfort ${KLASSE_NAAM[e.comfort.klasse]} minstens ${String(e.comfort.min).replace('.', ',')}`);
  if (e.klasse) t.push(`met een ${KLASSE_NAAM[e.klasse]}`);
  return t.join(', ');
}

// een nieuwe aanbieding bedenken: twee plaatsen of stations die beter verbonden moeten worden
export function bedenkAanbieding(spel, stations, plaatsen) {
  const jaar = spel.jaar;
  const trein = Math.random() < 0.45;
  let a, b, modus;
  if (trein) {
    const st = stations.filter(s => s.s === 'trein' && !(s.b && s.b > jaar) && !(s.e && s.e <= jaar));
    for (let k = 0; k < 40 && !b; k++) { a = kies(st); const ver = st.filter(s => { const d = afst(a, s); return d > 12000 && d < 60000; }); if (ver.length) b = kies(ver); }
    modus = 'trein';
    if (b) { a = { naam: a.n, x: a.x, y: a.y }; b = { naam: b.n, x: b.x, y: b.y }; }
  }
  if (!b) {
    const pl = plaatsen.filter(p => p[3] >= 3000);
    for (let k = 0; k < 40 && !b; k++) { a = kies(pl); const ver = pl.filter(p => { const d = Math.hypot(p[1] - a[1], p[2] - a[2]); return d > 5000 && d < 25000; }); if (ver.length) b = kies(ver); }
    if (!b) return null;
    modus = Math.hypot(b[1] - a[1], b[2] - a[2]) > 15000 && jaar >= 1990 && Math.random() < 0.4 ? 'hov' : 'bus';
    a = { naam: a[0], x: a[1], y: a[2] }; b = { naam: b[0], x: b[1], y: b[2] };
  }
  if ((spel.aanbiedingen || []).some(x => x.status !== 'verlopen' && [x.a.naam, x.b.naam].sort().join() === [a.naam, b.naam].sort().join())) return null;
  const e = eisenVoor(jaar, modus);
  const perReiziger = Math.random() < 0.4;
  const km = afst(a, b) / 1000;
  const vergoeding = perReiziger ? { perReiziger: Math.round((modus === 'trein' ? 0.8 + km * 0.05 : 0.5 + km * 0.06) * 20) / 20 }
    : { perUur: Math.round((SUBSIDIE_UUR[modus] || 50) * (1.2 + Math.random() * 0.8) + (e.elektrisch ? 20 : 0) + (e.comfort ? 15 : 0)) };
  return { id: nieuwId('sub'), a, b, modus, eisen: e, vergoeding, status: 'open', dag: spel.dag, tot: spel.dag + 90 + Math.floor(Math.random() * 90), lijnId: null };
}
export function vergoedingTekst(v) { return v.perReiziger ? `€ ${v.perReiziger.toFixed(2).replace('.', ',')} per reiziger` : `€ ${v.perUur} per dienstregelingsuur`; }

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
  if (!lijn.actief) r.push('de lijn rijdt niet');
  return { ok: !r.length, redenen: r };
}
