// OV-manager — materieel per lijn: welke soorten voertuigen, hoeveel, in welke volgorde en wanneer
//
// Een eigen lijn heeft een "mix": [{ id: typeId, n: toegewezen aantal, rol: 'hoofd' | 'spits' }], in volgorde van voorrang.
//   hoofd — rijdt de hele dag (zoveel als nodig is, in volgorde van voorrang)
//   spits — alleen in de spits (op werkdagen 7–9 en 16–18:30), als extra bovenop het hoofdmaterieel
// Per uur wordt bepaald hoeveel voertuigen de dienstregeling vraagt; dat wordt gevuld in volgorde van de mix
// (bv. eerst het comfortabele materieel, het oude alleen als extra in de spits).
// Toegewezen voertuigen zijn van die lijn; lijnen zonder mix delen wat over is (oude manier: eerlijk verdelen).
// Zijn er minder voertuigen dan toegewezen (revisie, verkocht), dan krijgt elke lijn naar verhouding minder.

import { TYPE, MODI } from './vloot.js';
import { nodigPer, nodigLijn } from './comfort.js';
import { inzetbaar } from './markt.js';
import { isSpits } from './spel.js';

export const ROLLEN = { hoofd: 'Hele dag', spits: 'Alleen spits' };
export const heeftMix = l => Array.isArray(l?.mix) && l.mix.length > 0;
const geldig = m => m && TYPE[m.id] && m.n >= 0;

/** Hoeveel van onderdeel c (los voertuig of deel van een samenstelling) is toegewezen aan lijnen met een mix */
export function toegewezen(spel, c, behalve = null) {
  let n = 0;
  for (const l of spel.lijnen) {
    if (l === behalve || l.ai || !heeftMix(l) || (!l.actief && !l.wacht)) continue;
    for (const m of l.mix) if (geldig(m)) n += (m.n || 0) * (nodigPer(m.id)[c] || 0);
  }
  return n;
}
/** Wat lijnen zonder mix (oude manier, eerlijk verdeeld) nu van onderdeel c gebruiken */
function autoGebruik(spel, c, behalve) {
  let n = 0;
  for (const l of spel.lijnen) if (l !== behalve && !l.ai && l.actief && !l.bijzonder && !heeftMix(l)) n += nodigLijn(l)[c] || 0;
  return n;
}
/** Hoeveel van deze soort kun je nog extra toewijzen: niet toegewezen aan andere lijnen en niet in gebruik bij lijnen zonder mix */
export function vrijVoor(spel, typeId, behalve = null) {
  let vrij = Infinity;
  for (const [c, k] of Object.entries(nodigPer(typeId))) {
    const over = inzetbaar(spel, c) - toegewezen(spel, c, behalve);
    vrij = Math.min(vrij, Math.floor((over - Math.min(Math.max(0, over), autoGebruik(spel, c, behalve))) / Math.max(1, k)));
  }
  return Math.max(0, vrij === Infinity ? 0 : vrij);
}
/** Wat een mix-regel echt kan inzetten: minder als er van een onderdeel minder is dan toegewezen (revisie, verkocht) */
function effectief(spel, m) {
  let f = 1;
  for (const c of Object.keys(nodigPer(m.id))) { const t = toegewezen(spel, c); if (t > 0) f = Math.min(f, inzetbaar(spel, c) / t); }
  return Math.floor((m.n || 0) * Math.max(0, Math.min(1, f)));
}

// hoeveel voertuigen de dienstregeling vraagt in het uur rond `minuut` (zelfde rekensom als materieelNodig, maar per uur)
export function nodigOp(lijn, dag, minuut) {
  const uur = Math.floor(minuut / 60) * 60, mod = MODI[lijn.modus];
  let ritten = 0;
  for (const r of lijn.vertrek || []) for (const v of r) if (v >= uur && v < uur + 60) ritten += lijn.modus === 'trein' && (lijn.spitsDubbel ?? !!lijn.ai) && isSpits(dag, v) ? 2 : 1;
  if (!ritten) return 0;
  const leegTerug = lijn.richting === 'heen' && !lijn.paar ? 2 : 1, keer = (mod?.keer || 10) + (TYPE[lijn.typeId]?.keerExtra || 0), wissel = (lijn._wissels || 0) * 8;
  return Math.min(lijn.nodig || 1, Math.max(1, Math.ceil(ritten * (lijn.duur / 60 * leegTerug + keer + wissel) / 60)));
}
/** Welk materieel rijdt er in dat uur: { nodig, inzet: [{id, n}], rijdt } (rijdt = aantal dat echt kan rijden) */
export function verdeling(spel, lijn, dag, minuut) {
  const nodig = nodigOp(lijn, dag, minuut), spits = isSpits(dag, minuut), inzet = [];
  let rest = nodig;
  for (const m of lijn.mix || []) {
    if (!geldig(m) || rest <= 0) continue;
    if (m.rol === 'spits' && !spits) continue;
    const k = Math.min(rest, effectief(spel, m));
    if (k > 0) { inzet.push({ id: m.id, n: k }); rest -= k; }
  }
  return { nodig, inzet, rijdt: nodig - rest };
}
/** Inzetbaar in het drukste uur (spits): alles wat is toegewezen telt mee */
export function inzetbaarMix(spel, lijn) {
  return Math.min(lijn.nodig || 0, (lijn.mix || []).filter(geldig).reduce((s, m) => s + effectief(spel, m), 0));
}
/** Hoofdmaterieel: de eerste soort die de hele dag rijdt (bepaalt rijtijden en de "naam" van de lijn) */
export const hoofdType = l => (l.mix || []).find(m => geldig(m) && m.rol !== 'spits')?.id || (l.mix || []).find(geldig)?.id || l.typeId;
/** Welke soort rijdt deze rit (voor de tekening): verdeeld naar het aandeel in dat uur */
export function typeBijRit(spel, lijn, dag, dep, r = 0) {
  const v = verdeling(spel, lijn, dag, dep); if (!v.inzet.length) return lijn.typeId;
  const tot = v.inzet.reduce((s, x) => s + x.n, 0);
  let h = Math.abs(Math.round(dep * 7 + r * 3)) % 1000 / 1000 * tot;
  for (const x of v.inzet) { if (h < x.n) return x.id; h -= x.n; }
  return v.inzet[0].id;
}
/** Een mix maken uit de oude instelling (standaard + alternatief) met wat de lijn nu inzet */
export function mixUitOud(spel, lijn, deelVan) {
  const uit = [{ id: lijn.typeId, n: Math.max(0, deelVan(lijn.typeId)), rol: 'hoofd' }];
  if (lijn.altTypeId && TYPE[lijn.altTypeId]) uit.push({ id: lijn.altTypeId, n: Math.max(0, deelVan(lijn.altTypeId)), rol: 'hoofd' });
  return uit;
}
