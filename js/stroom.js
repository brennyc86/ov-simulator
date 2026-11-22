// Elektrificatie en spoorwijdte.
// Elk spoorvak heeft een spanningssysteem (of geen bovenleiding). In Nederland: trein 1500 V gelijkstroom,
// HSL-Zuid en Betuweroute 25 kV wisselstroom, metro 750 V (meestal derde rail), tram 600 V, trolleybus ~700 V.
// Elektrisch materieel kan alleen rijden op systemen die het aankan (meersysteemtreinen kunnen er meer);
// diesel, stoom en accu rijden overal (paarden alleen op tramspoor). Ongeschikt materieel kan een sleeploc krijgen.
import { TYPE } from './vloot.js';

export const SYSTEMEN = {
  '1500DC': { naam: '1500 V gelijkstroom (NL-spoor)', soort: 'trein', km: 0.6e6 },
  '25kVAC': { naam: '25 kV wisselstroom (HSL, Betuweroute)', soort: 'trein', km: 0.9e6 },
  '3000DC': { naam: '3000 V gelijkstroom (België)', soort: 'trein', km: 0.7e6 },
  '15kVAC': { naam: '15 kV 16,7 Hz wisselstroom (Duitsland)', soort: 'trein', km: 0.9e6 },
  '750DC3': { naam: '750 V gelijkstroom, derde rail (metro)', soort: 'metro', km: 0.8e6 },
  '750DC': { naam: '750 V gelijkstroom, bovenleiding (sneltram/metro)', soort: 'metro', km: 0.6e6 },
  '600DC': { naam: '600 V gelijkstroom (tram)', soort: 'tram', km: 0.5e6 },
};
const ELEKTRISCH_KM = 1.2e6; // nieuwe bovenleiding per km (spoor zonder elektrificatie)

// welk systeem hoort bij een gemeten spanning (OSM voltage) en soort spoor (0 trein, 1 light rail, 2 metro, 3 tram)
function systeemVoor(elek, soort, vmax) {
  if (!elek) return null;
  if (elek === 1) return soort === 2 ? '750DC3' : soort === 1 ? '750DC' : soort === 3 ? '600DC' : vmax >= 250 ? '25kVAC' : '1500DC';
  if (elek < 0) return '750DC3';
  if (elek >= 20000) return '25kVAC';
  if (elek >= 10000) return '15kVAC';
  if (elek >= 2500) return '3000DC';
  if (elek >= 1000) return '1500DC';
  if (elek >= 720) return soort === 2 ? '750DC3' : '750DC';
  return '600DC';
}
// huidige systeem van een spoortak (eigen wijzigingen in spel.spanning gaan voor)
export function spanningVan(spel, t) {
  if (!t) return null;
  const eigen = spel?.spanning?.[t.i];
  if (eigen !== undefined) return eigen || null;
  if (!t.elek || !elektrischIn(t, spel?.jaar ?? 2026)) return null;
  return systeemVoor(t.elek, t.soort, t.vmax);
}
// Was dit spoor in dat jaar al elektrisch? Grove benadering van de geschiedenis (per lijn zijn de jaren niet bekend):
// treinspoor vanaf 1924 in de Randstad (Amsterdam–Haarlem–Leiden–Rotterdam), vanaf 1939 het grootste deel van het midden,
// vanaf 1956 ook noord, oost en zuid; tram elektrisch vanaf ~1900; metro vanaf 1968. Eigen spoor is altijd zoals gebouwd.
function elektrischIn(t, jaar) {
  if (t.i >= 1e6 || jaar >= 1980) return true;
  const m = (t.pts.length >> 2) * 2, x = t.pts[m], y = t.pts[m + 1];
  if (t.soort === 2) return jaar >= 1968;
  if (t.soort === 1 || t.soort === 3) return jaar >= 1900;
  if (jaar < 1924) return false;
  const randstad = x < 135000 && y > 430000 && y < 495000;
  if (jaar < 1939) return randstad;
  const midden = x < 200000 && y > 400000 && y < 520000;
  if (jaar < 1956) return midden;
  return true;
}
// systemen die je op dit soort spoor kunt kiezen
export const systemenVoorSoort = soort => Object.entries(SYSTEMEN).filter(([, s]) => (soort === 0 || soort >= 4) ? s.soort === 'trein' : s.soort !== 'trein').map(([k]) => k);

// welke systemen kan een voertuig(type) aan? null = niet elektrisch (rijdt overal, mits spoorwijdte past)
const EIGEN = {
  icng5: ['1500DC', '25kVAC'], ice3: ['1500DC', '15kVAC', '25kVAC', '3000DC'], loc186: ['1500DC', '25kVAC', '3000DC'], loc193: ['1500DC', '3000DC', '15kVAC', '25kVAC'],
  retrsg3: ['750DC3', '750DC'], regiocitadis: ['600DC', '750DC'], sigsneltram: ['750DC', '600DC'], urbos100: ['750DC'], gvbm5: ['750DC3', '600DC'], gvbm7: ['750DC3', '600DC'],
};
export function spanningenVan(typeId) {
  const t = TYPE[typeId]; if (!t) return null;
  if (t.samen) { // samenstelling: de loc(s) bepalen het; gekoppelde treinstellen moeten allemaal kunnen
    const locs = t.samen.filter(c => TYPE[c]?.soort === 'loc'), units = t.samen.filter(c => !TYPE[c]?.soort);
    if (locs.length) { const s = locs.map(spanningenVan); return s.some(x => x === null) ? null : [...new Set(s.flat())]; }
    const s = units.map(spanningenVan); if (s.every(x => x === null)) return null;
    return s.filter(Boolean).reduce((a, b) => a.filter(x => b.includes(x)));
  }
  const id = t.basis || typeId;
  if (EIGEN[id]) return EIGEN[id];
  if (!['elektrisch', 'bovenleiding'].includes(t.energie)) return null; // diesel, kolen, accu-hybride, paarden: geen bovenleiding nodig
  return t.modus === 'metro' ? ['750DC3'] : t.modus === 'sneltram' ? ['750DC', '600DC'] : t.modus === 'tram' ? ['600DC'] : ['1500DC'];
}
export const kanOp = (typeId, sys) => { const s = spanningenVan(typeId); return s === null || (!!sys && s.includes(sys)); };

// controle van een lijn: op welke stukken kan het materieel niet rijden? (sleeploc lost het op als die kan)
export function stroomCheck(spel, net, lijn, typeId = lijn.typeId) {
  const tk = lijn.route?.takken; if (!tk?.length || !['trein', 'metro', 'sneltram', 'tram'].includes(lijn.modus)) return { ok: true, probleem: [] };
  const per = new Map();
  for (const i of new Set(tk)) {
    const t = i >= 1e6 ? net.eigen[i - 1e6] : net.takken[i]; if (!t || t.dienst) continue;
    const sys = spanningVan(spel, t);
    if (kanOp(typeId, sys)) continue;
    if (lijn.sleeploc && kanOp(lijn.sleeploc, sys)) continue;
    const k = sys || 'geen'; per.set(k, (per.get(k) || 0) + t.lengte);
  }
  return { ok: !per.size, probleem: [...per].map(([sys, m]) => ({ sys, km: m / 1000, naam: sys === 'geen' ? 'geen bovenleiding' : SYSTEMEN[sys]?.naam || sys })) };
}
// baanvak rond een tak: doorlopen langs knopen met precies twee takken van dezelfde soort en hetzelfde systeem
export function baanvak(spel, net, t0, max = 40000) {
  const sys = spanningVan(spel, t0), uit = new Set([t0]); let lengte = t0.lengte;
  for (const start of [t0.a, t0.b]) {
    let k = start, vorige = t0;
    while (lengte < max) {
      const b = (net.buren.get(k) || []).filter(x => !x.t.dienst && x.t.soort === t0.soort);
      if (b.length !== 2) break;
      const volg = b.find(x => x.t !== vorige); if (!volg || uit.has(volg.t) || spanningVan(spel, volg.t) !== sys) break;
      uit.add(volg.t); lengte += volg.t.lengte; vorige = volg.t; k = volg.naar;
    }
  }
  return { takken: [...uit], lengte, sys };
}
export const ombouwKostenStroom = (van, naar, km) => !naar ? 0 : Math.round(km * (van ? SYSTEMEN[naar].km : ELEKTRISCH_KM) / 1e5) * 1e5;
