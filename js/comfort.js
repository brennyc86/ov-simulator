// Comfort, klassen, interieur en prijzen.
// Elk materieeltype heeft een basiscomfort (0–10, rijkwaliteit en uitstraling) en een instapsnelheid (deuren).
// Het INTERIEUR hoort bij het voertuig: dat kies je bij het kopen of verbouwen. Een serie met een eigen interieur
// krijgt een eigen naam (bv. ICM_luxe naast ICM_basic). Per klasse: stoelen naast elkaar, beenruimte, soort stoel
// en vloeraandeel; plus eventueel een restauratierijtuig. PRIJZEN, CATERING (per klasse, met niveau) en wanneer
// de restauratie open is, bepaal je per LIJN.
import { TYPE } from './vloot.js';

// basiscomfort en deuren (1 = gewoon, >1 = sneller in- en uitstappen, <1 = trager)
const KENMERK = {
  stoom3700: [3, 0.7], mat36: [5, 0.8], hondekop: [6, 0.8], planv: [5, 0.9], sgm: [4, 1.3], icm: [7, 0.85], ddr: [6, 0.9], ddz: [6.5, 1.0],
  virm6: [6.5, 0.95], icng5: [7.5, 1.0], slt6: [4.5, 1.4], sng4: [5, 1.35], flirt4: [5.5, 1.25], gtw: [5, 1.1], wink: [5.5, 1.1], lint41: [5, 1.0],
  buffel: [5, 1.0], ice3: [8.5, 0.8],
  gvbm1: [3.5, 1.4], gvbm5: [4.5, 1.5], gvbm7: [5, 1.5], retmg2: [4, 1.3], retrsg3: [5, 1.4], regiocitadis: [5, 1.3], urbos100: [5, 1.35], sigsneltram: [3.5, 1.2],
  paardentram: [2, 0.8], stoomtram: [2.5, 0.8], tweeasser: [2.5, 1.0], pcc: [3.5, 1.1], gvb9g: [3.5, 1.1], gtl8: [4, 1.2], combino: [4.5, 1.4], citadis302: [4.5, 1.4], urbos15g: [5, 1.5], tina: [5, 1.5],
  omnibus: [1.5, 0.7], tbus: [2, 0.8], kromhout: [3, 0.9], leylandverheul: [4, 0.8], standaardstreek: [4.5, 0.8], csa1: [3.5, 1.1], citaro: [4.5, 1.15], citealle: [5, 0.95],
  citeaslfe: [4.5, 1.2], citeagelede: [4.5, 1.35], ebusco22: [4.5, 1.2], urbinoh2: [4.5, 1.2], trolley: [4.5, 1.3], futura: [7, 0.7], hovelektrisch: [5.5, 1.1], buurtbus: [4, 0.7], taxibus: [6, 0.8],
};
// het basistype van een serie (ICM_luxe -> icm)
export const basisId = typeId => TYPE[typeId]?.basis || typeId;
export function kenmerk(typeId) {
  const id = basisId(typeId), k = KENMERK[id], t = TYPE[id];
  if (k) return { comfort: k[0], deuren: k[1] };
  return { comfort: t?.modus === 'vlucht' ? 6 : t?.modus === 'veer' ? 5 : 4.5, deuren: 1 };
}
// standaard stoelen naast elkaar en beenruimte per soort vervoer
const STD_BREED = { trein: 4, metro: 4, sneltram: 4, tram: 4, bus: 4, hov: 4, belbus: 3, veer: 4, watertaxi: 3, vlucht: 5 };
export const BEEN = { krap: 70, normaal: 80, ruim: 95, royaal: 110 };
export const KLASSE_NAAM = { P: 'Premium', 1: '1e klas', 2: '2e klas', 3: '3e klas' };
// soort stoel: comfort, plaatsfactor (dikke stoelen nemen ruimte) en prijs per stoel (inbouw)
export const STOEL = {
  hout:        { naam: 'houten bankjes',      comfort: -2.2, plaats: 1.05, prijs: 150 },
  bank:        { naam: 'beklede bankjes',     comfort: -1.0, plaats: 1.05, prijs: 400 },
  hard:        { naam: 'harde stoelen',       comfort: -0.7, plaats: 1.0,  prijs: 350 },
  bekleed:     { naam: 'beklede stoelen',     comfort: 0,    plaats: 1.0,  prijs: 900 },
  verstelbaar: { naam: 'verstelbare stoelen', comfort: 1.2,  plaats: 0.88, prijs: 2400 },
  massage:     { naam: 'massagestoelen',      comfort: 2.6,  plaats: 0.75, prijs: 7500 },
};
// catering per klasse (bij de lijn): comfort en netto kosten per voertuiguur (personeel en inkoop min verkoop)
export const CATERING = [
  { naam: 'geen', comfort: 0, uur: 0 },
  { naam: 'trolley: koffie en snacks', comfort: 0.4, uur: 18 },
  { naam: 'aan je plaats: broodjes en warme dranken', comfort: 0.9, uur: 32 },
  { naam: 'maaltijden aan je plaats', comfort: 1.5, uur: 55 },
];
// restauratierijtuig: neemt vloer in, geeft iedereen aan boord comfort zolang het open is
export const RESTAURATIE = { vloer: 0.12, comfort: 0.8, uur: 65, prijs: 450000, kanBij: ['trein', 'veer'] };

// standaardinterieur: treinen 1e en 2e klas, verder één klas; oud materieel houten bankjes
export function standaardInrichting(typeId, modus) {
  const sb = STD_BREED[modus] || 4;
  const stoel = kenmerk(typeId).comfort < 3 ? 'hout' : 'bekleed';
  if (modus === 'trein') return { klassen: [
    { klasse: '1', breed: 3, been: 'ruim', stoel, deel: 0.15 },
    { klasse: '2', breed: sb, been: 'normaal', stoel, deel: 0.85 },
  ], restauratie: false };
  return { klassen: [{ klasse: '2', breed: sb, been: 'normaal', stoel, deel: 1 }], restauratie: false };
}
// het interieur van een voertuig(serie)
export const serieInrichting = (typeId, modus) => TYPE[typeId]?.ink || standaardInrichting(basisId(typeId), modus || TYPE[typeId]?.modus);
const STD_PRIJS = { P: 2.6, 1: 1.7, 2: 1, 3: 0.7 };
// deel van de reis dat de restauratie open is (lijn.restauratie: undefined = hele reis, 'dicht', of [van, tot] haltes)
export function restauratieOpen(lijn, ink) {
  if (!ink.restauratie) return 0;
  const r = lijn?.restauratie;
  if (r === 'dicht') return 0;
  if (Array.isArray(r) && lijn.km?.length) { const n = lijn.km.length - 1, tot = lijn.km[n] - lijn.km[0] || 1; return Math.max(0, Math.min(1, (lijn.km[Math.min(n, r[1])] - lijn.km[Math.max(0, r[0])]) / tot)); }
  return 1;
}
// interieur van het voertuig + prijzen en catering van de lijn
export function inrichtingVan(lijn, typeId) {
  const ink = serieInrichting(typeId, lijn?.modus);
  const p = lijn?.prijzen || {}, c = lijn?.catering || {};
  return { klassen: ink.klassen.map(k => ({ ...k, prijs: p[k.klasse] ?? STD_PRIJS[k.klasse] ?? 1, catering: c[k.klasse] || 0 })), restauratie: !!ink.restauratie, restOpen: restauratieOpen(lijn, ink) };
}

// zit- en staplaatsen en comfort per klasse
export function klassenVan(ink, typeId, modus) {
  const t = TYPE[typeId] || { zit: 60, sta: 40 }, sb = STD_BREED[modus] || 4, basis = kenmerk(typeId).comfort;
  const kl = ink.klassen || ink;
  const somDeel = kl.reduce((a, k) => a + k.deel, 0) || 1, vloer = ink.restauratie ? 1 - RESTAURATIE.vloer : 1;
  return kl.map(k => {
    const deel = k.deel / somDeel * vloer, pitch = BEEN[k.been] || 80, st = STOEL[k.stoel] || STOEL.bekleed;
    // standaardinterieur ~ 2e klas: stoelen schalen met breedte, beenruimte en soort stoel
    const zit = Math.max(0, Math.round(t.zit * deel * (k.breed / sb) * (80 / pitch) * st.plaats));
    const staBasis = k.klasse === '1' || k.klasse === 'P' || k.stoel === 'massage' ? 0 : t.sta * deel;
    const sta = Math.max(0, Math.round(staBasis * (k.breed <= sb ? 1 + (sb - k.breed) * 0.15 : 1 - (k.breed - sb) * 0.25)));
    const comfort = Math.max(0, Math.min(10, basis + (sb - k.breed) * 0.9 + (pitch - 80) / 12 + st.comfort
      + (CATERING[k.catering || 0]?.comfort || 0) + (ink.restOpen || 0) * RESTAURATIE.comfort));
    return { klasse: k.klasse, zit, sta, comfort, prijs: k.prijs ?? 1, stoel: k.stoel, catering: k.catering || 0 };
  });
}

// vraageffect van interieur, catering en prijs: factor op het aantal reizigers, aandeel per klasse, gemiddelde prijsfactor
const BASIS_AANDEEL = { P: 0.03, 1: 0.07, 2: 0.9, 3: 0.12 };
const ELAST = { P: 0.25, 1: 0.35, 2: 0.55, 3: 0.75 };
export function vraagEffect(lijn, typeId, comfortConcurrent = null) {
  const kl = klassenVan(inrichtingVan(lijn, typeId), typeId, lijn.modus);
  const sid = basisId(typeId), std = klassenVan(standaardInrichting(sid, lijn.modus), sid, lijn.modus);
  const stdComfort = std.find(k => k.klasse === '2')?.comfort ?? std[0].comfort;
  let som = 0;
  const w = kl.map(k => {
    const ref = STD_PRIJS[k.klasse] ?? 1;
    const m = Math.pow(Math.max(0.1, k.prijs) / ref, -ELAST[k.klasse]) * Math.max(0.2, 1 + 0.07 * (k.comfort - (stdComfort + (k.klasse === '1' ? 2 : k.klasse === 'P' ? 4 : k.klasse === '3' ? -2 : 0))));
    const x = (BASIS_AANDEEL[k.klasse] ?? 0.1) * m; som += x; return x;
  });
  const basisSom = kl.reduce((a, k) => a + (BASIS_AANDEEL[k.klasse] ?? 0.1), 0);
  const aandeel = w.map(x => x / (som || 1));
  // minder klassen = minder keuze; de groep blijft wel reizen (normaliseren naar de standaardmix)
  const factor = som / (basisSom || 1);
  const gemPrijs = kl.reduce((a, k, i) => a + aandeel[i] * k.prijs, 0);
  const gemComfort = kl.reduce((a, k, i) => a + aandeel[i] * k.comfort, 0);
  // concurrentie op dezelfde haltes: wie goedkoper of comfortabeler is, trekt meer reizigers
  let marktaandeel = 0.5;
  if (comfortConcurrent != null) marktaandeel = Math.max(0.1, Math.min(0.9, 0.5 + 0.08 * (gemComfort - comfortConcurrent) - 0.6 * Math.log(gemPrijs)));
  return { factor, aandeel, klassen: kl, gemPrijs, gemComfort, marktaandeel };
}

// stoelen per klasse bij een interieur (zonder prijzen), voor kosten
const stoelen = (ink, typeId) => klassenVan({ ...ink, restOpen: 0 }, typeId, TYPE[typeId]?.modus);
// meerprijs van een interieur bij nieuwbouw t.o.v. het standaardinterieur (kan negatief zijn: kale bankjes)
export function interieurMeerprijs(ink, basis) {
  const nu = stoelen(ink, basis), std = stoelen(standaardInrichting(basis, TYPE[basis]?.modus), basis);
  const kost = (kl, i) => kl.reduce((a, k) => a + k.zit * (STOEL[k.stoel] || STOEL.bekleed).prijs, 0) + (i.restauratie ? RESTAURATIE.prijs : 0);
  return Math.round((kost(nu, ink) - kost(std, standaardInrichting(basis, TYPE[basis]?.modus))) / 1000) * 1000;
}
// verbouwen per voertuig: vaste kosten + nieuwe stoelen waar de indeling of stoel verandert + restauratie in/uit
export function ombouwKosten(oud, nieuw, typeId) {
  const kl = stoelen(nieuw, typeId);
  let k = 20000;
  nieuw.klassen.forEach((c, i) => {
    const o = oud.klassen.find(x => x.klasse === c.klasse);
    const andersIngedeeld = !o || o.breed !== c.breed || o.been !== c.been || Math.abs(o.deel - c.deel) > 0.02;
    if (andersIngedeeld || o.stoel !== c.stoel) k += kl[i].zit * ((STOEL[c.stoel] || STOEL.bekleed).prijs + (andersIngedeeld ? 250 : 0));
  });
  if (nieuw.restauratie && !oud.restauratie) k += RESTAURATIE.prijs * 0.8;
  if (!nieuw.restauratie && oud.restauratie) k += 40000;
  return Math.round(k / 1000) * 1000;
}
// kosten per voertuiguur: catering per klasse en een open restauratie
export function uurKosten(lijn, typeId) {
  const ink = inrichtingVan(lijn, typeId);
  return ink.klassen.reduce((a, k) => a + (CATERING[k.catering]?.uur || 0), 0) + ink.restOpen * RESTAURATIE.uur;
}
// instaptijd: meer deuren = sneller in- en uitstappen (factor op de haltetijd)
export const haltetijdFactor = typeId => 1 / kenmerk(typeId).deuren;
// zelfde interieur? (om een bestaande serie terug te vinden)
export const zelfdeInterieur = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const norm = i => ({ r: !!i.restauratie, k: i.klassen.map(k => [k.klasse, k.breed, k.been, k.stoel, Math.round(k.deel * 100)]) });

// ---------------------------------------------------------------- series met een eigen interieur
// spel.series = [{id, basis, naam, ink}]; elk wordt een eigen type (TYPE[id]) met de rijeigenschappen van het basistype.
export function registreerSeries(series = []) {
  for (const k of Object.keys(TYPE)) if (TYPE[k].serie) delete TYPE[k];
  for (const s of series) {
    const b = TYPE[s.basis]; if (!b) continue;
    TYPE[s.id] = { ...b, id: s.id, naam: s.naam, basis: s.basis, ink: s.ink, serie: true, prijs: Math.max(b.prijs * 0.8, b.prijs + interieurMeerprijs(s.ink, s.basis)) };
  }
}
// korte naam van een type voor seriebenamingen (ICM, VIRM6, SLT6 ...)
export function kortNaam(typeId) {
  const t = TYPE[basisId(typeId)]; if (!t) return String(typeId).toUpperCase();
  const k = t.naam.split(/ \(| "|,/)[0].replace(/^Materieel /, 'Mat').trim();
  return k.length <= 12 ? k.replace(/\s+/g, '') : t.id.toUpperCase();
}
// voorstel voor een seriebenaming op basis van het interieur
export function serieNaamVoorstel(typeId, ink) {
  const kl = ink.klassen, gem = kl.reduce((a, k) => a + (STOEL[k.stoel] || STOEL.bekleed).comfort * k.deel, 0) / (kl.reduce((a, k) => a + k.deel, 0) || 1);
  const soort = kl.some(k => k.stoel === 'massage') || kl.some(k => k.klasse === 'P') ? 'luxe' : gem >= 0.6 ? 'comfort' : gem <= -0.6 ? 'basic' : ink.restauratie ? 'restauratie' : 'eigen';
  return `${kortNaam(typeId)}_${soort}`;
}
