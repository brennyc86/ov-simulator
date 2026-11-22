// Comfort, klassen, interieur, voorzieningen en samenstellingen.
// Elk materieeltype heeft een basiscomfort (0–10, rijkwaliteit en uitstraling) en een instapsnelheid (deuren).
// Het INTERIEUR hoort bij het voertuig en wordt per WAGON (bak) ingedeeld: een wagon is één geheel of bestaat
// uit delen (bv. half 1e, half 2e klas, of een halve wagon restauratie). Een serie met een eigen interieur krijgt
// een eigen naam (ICM_luxe naast ICM_basic). Daarnaast VOORZIENINGEN (koffieautomaat … restaurantkeuken) die
// plaatsen kosten. Klassen: Premium, 1e, 2e, 3e, 4e … ; de toeslagen per klasse gelden voor het hele bedrijf.
// Met een kaartje voor een hogere klasse mag je in een lagere zitten, niet andersom.
// Een SAMENSTELLING (per lijn) is een loc + losse rijtuigen (+ stuurstandrijtuig), of gekoppelde treinstellen.
import { TYPE } from './vloot.js';
import { bakkenVan } from './voertuig.js';

// basiscomfort en deuren (1 = gewoon, >1 = sneller in- en uitstappen, <1 = trager)
const KENMERK = {
  stoom3700: [3, 0.7], mat36: [5, 0.8], hondekop: [6, 0.8], planv: [5, 0.9], sgm: [4, 1.3], icm: [7, 0.85], ddr: [6, 0.9], ddz: [6.5, 1.0],
  virm6: [6.5, 0.95], icng5: [7.5, 1.0], slt6: [4.5, 1.4], sng4: [5, 1.35], flirt4: [5.5, 1.25], gtw: [5, 1.1], wink: [5.5, 1.1], lint41: [5, 1.0],
  buffel: [5, 1.0], ice3: [8.5, 0.8],
  coupe: [2.5, 1.3], staalrijtuig: [4, 0.8], plane: [5, 0.8], planw: [6, 0.75], icr: [7, 0.8], icrbvk: [7, 0.8], ddm1: [6, 0.9], ddm1bvk: [6, 0.9], viaggio: [8, 0.8], viaggiobvk: [8, 0.8],
  gvbm1: [3.5, 1.4], gvbm5: [4.5, 1.5], gvbm7: [5, 1.5], retmg2: [4, 1.3], retrsg3: [5, 1.4], regiocitadis: [5, 1.3], urbos100: [5, 1.35], sigsneltram: [3.5, 1.2],
  paardentram: [2, 0.8], stoomtram: [2.5, 0.8], tweeasser: [2.5, 1.0], pcc: [3.5, 1.1], gvb9g: [3.5, 1.1], gtl8: [4, 1.2], combino: [4.5, 1.4], citadis302: [4.5, 1.4], urbos15g: [5, 1.5], tina: [5, 1.5],
  omnibus: [1.5, 0.7], tbus: [2, 0.8], kromhout: [3, 0.9], leylandverheul: [4, 0.8], standaardstreek: [4.5, 0.8], csa1: [3.5, 1.1], citaro: [4.5, 1.15], citealle: [5, 0.95],
  citeaslfe: [4.5, 1.2], citeagelede: [4.5, 1.35], ebusco22: [4.5, 1.2], urbinoh2: [4.5, 1.2], trolley: [4.5, 1.3], futura: [7, 0.7], hovelektrisch: [5.5, 1.1], buurtbus: [4, 0.7], taxibus: [6, 0.8],
};
// het basistype van een serie (ICM_luxe -> icm)
export const basisId = typeId => TYPE[typeId]?.basis || typeId;
// de voertuigen waaruit een type bestaat (samenstelling) of het type zelf
export const delenVan = typeId => TYPE[typeId]?.samen || [typeId];
export function kenmerk(typeId) {
  const t = TYPE[typeId];
  if (t?.samen) { // samenstelling: gemiddelde van de rijtuigen, deuren van het traagste
    const r = t.samen.filter(c => TYPE[c]?.soort !== 'loc').map(kenmerk);
    if (r.length) return { comfort: r.reduce((a, k) => a + k.comfort, 0) / r.length, deuren: Math.min(...r.map(k => k.deuren)) };
  }
  const id = basisId(typeId), k = KENMERK[id], b = TYPE[id];
  if (k) return { comfort: k[0], deuren: k[1] };
  return { comfort: b?.modus === 'vlucht' ? 6 : b?.modus === 'veer' ? 5 : 4.5, deuren: 1 };
}

// ---------------------------------------------------------------- klassen en prijzen (bedrijfsbreed)
export const KLASSEN = ['P', '1', '2', '3', '4', '5', '6'];
export const klasseNaam = k => k === 'P' ? 'Premium' : `${k}e klas`;
export const KLASSE_NAAM = Object.fromEntries(KLASSEN.map(k => [k, klasseNaam(k)]));
// tot 1956 had de trein drie klassen (3e = gewoon tarief); in 1956 werd de 3e klas in heel Europa afgeschaft:
// de oude 2e werd 1e, de oude 3e werd 2e
export const DRIE_KLASSEN_TOT = 1956;
let JAAR = 2026;
const STD_NU = { P: 2.6, 1: 1.7, 2: 1, 3: 0.7, 4: 0.5, 5: 0.38, 6: 0.3 }, STD_OUD = { P: 3.2, 1: 2.2, 2: 1.5, 3: 1, 4: 0.7, 5: 0.5, 6: 0.4 };
export let STD_PRIJS = { ...STD_NU };
let PRIJS = { ...STD_PRIJS }, EIGEN_PRIJS = null;
// het speljaar bepaalt standaardinrichting, klassen en standaardprijzen
export const zetJaar = j => { JAAR = j; STD_PRIJS = j < DRIE_KLASSEN_TOT ? { ...STD_OUD } : { ...STD_NU }; PRIJS = { ...STD_PRIJS, ...(EIGEN_PRIJS || {}) }; };
// toeslagen per klasse instellen (spel.klassePrijs, factor t.o.v. het standaardtarief)
export const zetKlassePrijzen = p => { EIGEN_PRIJS = p || null; PRIJS = { ...STD_PRIJS, ...(p || {}) }; };
export const klassePrijs = k => PRIJS[k] ?? 1;
// rangorde: hoe hoger de klasse, hoe kleiner het getal (Premium = 0)
const rang = k => k === 'P' ? 0 : +k;
const sorteer = kl => kl.sort((a, b) => rang(a.klasse) - rang(b.klasse));
const staanMag = k => rang(k) >= 2; // in Premium en 1e klas staat niemand

// ---------------------------------------------------------------- stoelen, voorzieningen, catering
const STD_BREED = { trein: 4, metro: 4, sneltram: 4, tram: 4, bus: 4, hov: 4, belbus: 3, veer: 4, watertaxi: 3, vlucht: 5 };
export const BEEN = { krap: 70, normaal: 80, ruim: 95, royaal: 110 };
// soort stoel: comfort, plaatsfactor (dikke stoelen nemen ruimte) en prijs per stoel (inbouw)
export const STOEL = {
  hout:        { naam: 'houten bankjes',      comfort: -2.2, plaats: 1.05, prijs: 150 },
  bank:        { naam: 'beklede bankjes',     comfort: -1.0, plaats: 1.05, prijs: 400 },
  hard:        { naam: 'harde stoelen',       comfort: -0.7, plaats: 1.0,  prijs: 350 },
  bekleed:     { naam: 'beklede stoelen',     comfort: 0,    plaats: 1.0,  prijs: 900 },
  verstelbaar: { naam: 'verstelbare stoelen', comfort: 1.2,  plaats: 0.88, prijs: 2400 },
  massage:     { naam: 'massagestoelen',      comfort: 2.6,  plaats: 0.75, prijs: 7500 },
};
// voorzieningen in het voertuig: kosten plaatsen; bemand = personeel, alleen open waar de lijn dat wil
export const VOORZ = {
  koffie:     { naam: 'koffieautomaat', plekken: 2, comfort: 0.2, uur: 2, prijs: 6000 },
  automaten:  { naam: 'koffie- en koekjesautomaat', plekken: 4, comfort: 0.35, uur: 4, prijs: 14000 },
  kiosk:      { naam: 'bar/kiosk met personeel', plekken: 8, comfort: 0.6, uur: 28, prijs: 45000, bemand: true },
  pantry:     { naam: 'keukentje: gebak, broodjes en warme dranken', plekken: 22, comfort: 1.0, uur: 40, prijs: 120000, bemand: true },
  restaurant: { naam: 'restaurantkeuken met restaurant', plekken: 70, comfort: 1.6, uur: 90, prijs: 650000, bemand: true, minZit: 250 },
};
// stroom bij de stoel: USB-poortjes en/of stopcontacten (per zitdeel), beschikbaar vanaf een jaar per soort vervoer
export const STROOM = {
  '': { naam: 'geen', comfort: 0, prijs: 0 },
  usb: { naam: 'USB-poortjes', comfort: 0.2, prijs: 60 },
  stopcontact: { naam: 'stopcontacten', comfort: 0.4, prijs: 150 },
  beide: { naam: 'stopcontacten + USB', comfort: 0.5, prijs: 190 },
};
const STROOM_VANAF = { usb: 2010, stopcontact: { trein: 1995, metro: 1995, sneltram: 1995, tram: 1995, veer: 1990, vlucht: 2005, bus: 2012, hov: 2012, belbus: 2012, watertaxi: 2012 } };
export function stroomMag(soort, modus, jaar = JAAR) {
  if (!soort) return true;
  const u = jaar >= STROOM_VANAF.usb, s = jaar >= (STROOM_VANAF.stopcontact[modus] ?? 2012);
  return soort === 'usb' ? u : soort === 'stopcontact' ? s : u && s;
}
// standaard stroom per klasse door de jaren: in de trein eerst stopcontacten in de 1e, later ook de 2e, daarna ook USB;
// bus en tram sinds een paar jaar USB; metro nog niet standaard
export function stroomStandaard(modus, klasse, jaar = JAAR) {
  const eerste = klasse === '1' || klasse === 'P';
  if (modus === 'trein') return jaar >= 2018 ? 'beide' : jaar >= (eerste ? 2005 : 2015) ? 'stopcontact' : '';
  if (['bus', 'hov'].includes(modus)) return jaar >= 2020 ? 'usb' : '';
  if (['tram', 'sneltram'].includes(modus)) return jaar >= 2021 ? 'usb' : '';
  if (modus === 'veer') return jaar >= 2015 ? 'stopcontact' : '';
  return '';
}
// standaard stoel per klasse door de jaren: houten bankjes → beklede bankjes → stoelen, de hogere klasse eerst
export function stoelStandaard(modus, klasse, jaar = JAAR) {
  const eerste = klasse === '1' || klasse === 'P';
  if (modus === 'trein') {
    if (jaar < DRIE_KLASSEN_TOT) return klasse === '3' ? 'hout' : klasse === '2' ? 'bank' : jaar >= 1930 ? 'bekleed' : 'bank';
    return eerste ? 'bekleed' : jaar >= 1975 ? 'bekleed' : 'bank';
  }
  if (['bus', 'hov', 'belbus'].includes(modus)) return jaar < 1930 ? 'hout' : jaar < 1975 ? 'bank' : 'bekleed';
  if (['tram', 'sneltram'].includes(modus)) return jaar < 1930 ? 'hout' : jaar < 1960 ? 'bank' : jaar < 1990 ? 'hard' : 'bekleed';
  if (modus === 'metro') return jaar < 2000 ? 'hard' : 'bekleed';
  return 'bekleed';
}
// hoeveel stoelen naast elkaar kunnen er maximaal (breedte van het voertuig)
export function maxBreed(typeId) {
  const t = TYPE[typeId], m = t?.modus;
  if (m === 'trein') return (t?.breedte || 0) >= 3.1 ? 6 : 5;
  return { metro: 5, sneltram: 4, tram: 4, bus: 4, hov: 4, belbus: 3, watertaxi: 4, veer: 8, vlucht: 6 }[m] || 4;
}
// restauratie in een trein: een deel van een wagon (half = beperkte restauratie/bistro, heel = restauratierijtuig)
export const REST = {
  beperkt: { naam: 'beperkte restauratie (halve wagon)', comfort: 1.0, uur: 45, prijs: 250000 },
  vol:     { naam: 'restauratierijtuig (hele wagon)', comfort: 1.4, uur: 70, prijs: 450000 },
};
const restSoort = len => len >= 0.75 ? 'vol' : 'beperkt';
// catering per klasse (bij de lijn): comfort en netto kosten per voertuiguur (personeel en inkoop min verkoop)
export const CATERING = [
  { naam: 'geen', comfort: 0, uur: 0 },
  { naam: 'trolley: koffie en snacks', comfort: 0.4, uur: 18 },
  { naam: 'aan je plaats: broodjes en warme dranken', comfort: 0.9, uur: 32 },
  { naam: 'maaltijden aan je plaats', comfort: 1.5, uur: 55 },
];

// ---------------------------------------------------------------- interieur per wagon
// ink = { wagons: [{ delen: [{ soort:'zit', klasse, stoel, breed, been, len } | { soort:'rest', len }] }], voorz: ['koffie', …] }
export const wagonsVan = (typeId, modus) => bakkenVan(typeId, modus || TYPE[typeId]?.modus).filter(b => !b.loc);
const zitDeel = (klasse, modus, stoel, len) => ({ soort: 'zit', klasse, stoel: stoel === 'hout' ? 'hout' : stoelStandaard(modus, klasse), stroom: stroomStandaard(modus, klasse),
  breed: klasse === '1' || klasse === 'P' ? Math.max(2, (STD_BREED[modus] || 4) - 1) : STD_BREED[modus] || 4, been: klasse === '1' || klasse === 'P' ? 'ruim' : 'normaal', len });
// wagons vullen met klassen naar aandeel (in volgorde), knippen op de grenzen
function vul(n, aandelen, modus, stoel) {
  const wagons = Array.from({ length: n }, () => ({ delen: [] }));
  let pos = 0;
  for (const [klasse, aandeel] of aandelen) {
    let rest = aandeel * n;
    while (rest > 1e-6 && pos < n - 1e-9) {
      const w = Math.floor(pos + 1e-9), vrij = w + 1 - pos, stuk = Math.min(vrij, rest);
      wagons[w].delen.push(zitDeel(klasse, modus, stoel, Math.round(stuk * 100) / 100));
      pos += stuk; rest -= stuk;
    }
  }
  return wagons;
}
// standaardinterieur: treinen ~15% 1e klas (voorin), verder 2e; oud materieel houten bankjes
export function standaardInrichting(typeId, modus) {
  modus = modus || TYPE[typeId]?.modus;
  const n = Math.max(1, wagonsVan(typeId, modus).length), t = TYPE[typeId];
  const stoel = kenmerk(typeId).comfort < 3 ? 'hout' : 'bekleed';
  if (t?.soort === 'loc') return { wagons: [], voorz: [] };
  const oud = JAAR < DRIE_KLASSEN_TOT && modus === 'trein';
  const aandelen = modus === 'trein' && n >= 2 && !t?.soort ? (oud ? [['1', 0.1], ['2', 0.25], ['3', 0.65]] : [['1', Math.min(0.5, 0.6 / n + 0.05)], ['2', 1]]) : [[oud ? '3' : '2', 1]];
  const s = aandelen.reduce((a, x) => a + x[1], 0);
  return { wagons: vul(n, aandelen.map(([k, a]) => [k, a / s]), modus, stoel), voorz: [] };
}
// oud formaat (klassen met vloeraandeel) omzetten naar wagons
function naarWagons(ink, typeId) {
  if (!ink) return null;
  if (ink.wagons) return ink;
  const modus = TYPE[typeId]?.modus, n = Math.max(1, wagonsVan(typeId, modus).length), kl = ink?.klassen || [];
  const som = kl.reduce((a, k) => a + k.deel, 0) || 1;
  const w = vul(n, kl.map(k => [k.klasse, k.deel / som]), modus, 'bekleed');
  let i = 0; for (const wg of w) for (const d of wg.delen) { const o = kl.find(k => k.klasse === d.klasse) || kl[i]; Object.assign(d, { stoel: o?.stoel || 'bekleed', breed: o?.breed || d.breed, been: o?.been || d.been }); }
  if (ink?.restauratie && n) { const m = w[Math.floor(n / 2)]; m.delen = [{ ...m.delen[0], len: 0.5 }, { soort: 'rest', len: 0.5 }]; }
  return { wagons: w, voorz: [] };
}
// het interieur van een voertuig(serie)
export const serieInrichting = (typeId, modus) => naarWagons(TYPE[typeId]?.ink, typeId) || standaardInrichting(basisId(typeId), modus);
const eigenInk = typeId => TYPE[typeId]?.ink ? naarWagons(TYPE[typeId].ink, typeId) : standaardInrichting(basisId(typeId), TYPE[typeId]?.modus);

// alle voorzieningen in een (samengesteld) voertuig: [{naam, comfort, uur, bemand, prijs}]
export function voorzieningen(typeId) {
  const uit = [];
  for (const c of delenVan(typeId)) {
    const ink = eigenInk(c);
    for (const v of ink.voorz || []) if (VOORZ[v]) uit.push({ id: v, ...VOORZ[v] });
    for (const w of ink.wagons) for (const d of w.delen) if (d.soort === 'rest') uit.push({ id: restSoort(d.len), ...REST[restSoort(d.len)], bemand: true });
  }
  return uit;
}
export const heeftBemand = typeId => voorzieningen(typeId).some(v => v.bemand);
// deel van de reis dat bemande voorzieningen open zijn (lijn.restauratie: undefined = hele reis, 'dicht', of [van, tot] haltes)
export function restauratieOpen(lijn) {
  const r = lijn?.restauratie;
  if (r === 'dicht') return 0;
  if (Array.isArray(r) && lijn.km?.length) { const n = lijn.km.length - 1, tot = lijn.km[n] - lijn.km[0] || 1; return Math.max(0, Math.min(1, (lijn.km[Math.min(n, r[1])] - lijn.km[Math.max(0, r[0])]) / tot)); }
  return 1;
}
// wat de lijn bijdraagt: catering per klasse en openingsdeel van de restauratie
export function inrichtingVan(lijn, typeId) {
  return { typeId, catering: lijn?.catering || {}, open: restauratieOpen(lijn), modus: lijn?.modus };
}
// zit- en staplaatsen per klasse van één voertuig (zonder lijn), per wagon en samen
export function plaatsenPerWagon(ink, typeId) {
  const t = TYPE[typeId] || { zit: 60, sta: 40 }, modus = t.modus, sb = STD_BREED[modus] || 4;
  const wagons = wagonsVan(typeId, modus), L = wagons.reduce((a, w) => a + w.lengte, 0) || 1;
  const zitM = t.zit / L, staM = t.sta / L;
  const per = ink.wagons.map((w, i) => {
    const Lw = wagons[i]?.lengte || L / Math.max(1, ink.wagons.length);
    return w.delen.map(d => {
      if (d.soort !== 'zit') return { ...d, zit: 0, sta: 0 };
      const pitch = BEEN[d.been] || 80, st = STOEL[d.stoel] || STOEL.bekleed, breed = Math.min(d.breed, maxBreed(typeId));
      const zit = zitM * Lw * d.len * (breed / sb) * (80 / pitch) * st.plaats;
      const sta = staanMag(d.klasse) && d.stoel !== 'massage' ? staM * Lw * d.len * (d.breed <= sb ? 1 + (sb - d.breed) * 0.15 : Math.max(0, 1 - (d.breed - sb) * 0.25)) : 0;
      return { ...d, zit: Math.round(zit), sta: Math.round(sta), lengte: Lw * d.len };
    });
  });
  // bus: op de achterste rij (geen doorloop) past één stoel extra
  if (['bus', 'hov', 'belbus'].includes(modus)) { const w = per[per.length - 1], d = w && [...w].reverse().find(x => x.soort === 'zit'); if (d) d.zit += 1; }
  // voorzieningen kosten plaatsen: van het grootste zitdeel
  let kost = (ink.voorz || []).reduce((a, v) => a + (VOORZ[v]?.plekken || 0), 0);
  const alle = per.flat().filter(d => d.soort === 'zit').sort((a, b) => b.zit - a.zit);
  for (const d of alle) { if (kost <= 0) break; const af = Math.min(d.zit, kost); d.zit -= af; kost -= af; }
  return per;
}
// zit- en staplaatsen en comfort per klasse (gesorteerd van hoog naar laag), voor een lijn of los voertuig
export function klassenVan(lijnInk, typeId, modus) {
  const li = lijnInk?.wagons ? { catering: {}, open: 0, ink: lijnInk } : lijnInk || {};
  const vz = voorzieningen(typeId);
  const restComfort = Math.max(0, ...vz.map(v => v.comfort * (v.bemand ? li.open ?? 1 : 1)));
  const som = new Map();
  for (const c of delenVan(typeId)) {
    const t = TYPE[c]; if (!t || t.soort === 'loc') continue;
    const ink = li.ink && delenVan(typeId).length === 1 ? li.ink : eigenInk(c);
    const sb = STD_BREED[t.modus] || 4, basis = kenmerk(c).comfort;
    for (const d of plaatsenPerWagon(ink, c).flat()) {
      if (d.soort !== 'zit') continue;
      const pitch = BEEN[d.been] || 80, st = STOEL[d.stoel] || STOEL.bekleed;
      const comfort = Math.max(0, Math.min(10, basis + (sb - Math.min(d.breed, maxBreed(c))) * 0.9 + (pitch - 80) / 12 + st.comfort + (STROOM[d.stroom || '']?.comfort || 0) + (CATERING[li.catering?.[d.klasse] || 0]?.comfort || 0) + restComfort));
      const k = som.get(d.klasse) || { klasse: d.klasse, zit: 0, sta: 0, cw: 0, stoelen: {}, lengte: 0 };
      k.zit += d.zit; k.sta += d.sta; k.cw += comfort * Math.max(1, d.zit); k.n = (k.n || 0) + Math.max(1, d.zit); k.lengte += d.lengte || 0;
      k.stoelen[d.stoel] = (k.stoelen[d.stoel] || 0) + d.zit;
      som.set(d.klasse, k);
    }
  }
  return sorteer([...som.values()].map(k => ({ klasse: k.klasse, zit: k.zit, sta: k.sta, comfort: k.cw / k.n, prijs: klassePrijs(k.klasse),
    stoel: Object.entries(k.stoelen).sort((a, b) => b[1] - a[1])[0]?.[0], catering: li.catering?.[k.klasse] || 0, lengte: k.lengte })));
}

// ---------------------------------------------------------------- vraag
// vraageffect van interieur, catering en prijs: factor op het aantal reizigers, aandeel per klasse, gemiddelde prijsfactor
const BASIS_NU = { P: 0.03, 1: 0.07, 2: 0.9, 3: 0.12, 4: 0.12, 5: 0.12, 6: 0.12 }, BASIS_OUD = { P: 0.02, 1: 0.04, 2: 0.22, 3: 0.74, 4: 0.1, 5: 0.1, 6: 0.1 };
const BASIS_AANDEEL = new Proxy({}, { get: (_, k) => (JAAR < DRIE_KLASSEN_TOT ? BASIS_OUD : BASIS_NU)[k] });
const ELAST = { P: 0.25, 1: 0.35, 2: 0.55, 3: 0.75, 4: 0.85, 5: 0.95, 6: 1 };
const COMFORT_VERSCHIL = { P: 4, 1: 2, 2: 0, 3: -2, 4: -3, 5: -4, 6: -5 };
export function vraagEffect(lijn, typeId, comfortConcurrent = null) {
  const kl = klassenVan(inrichtingVan(lijn, typeId), typeId, lijn.modus);
  if (!kl.length) return { factor: 1, aandeel: [], klassen: kl, gemPrijs: 1, gemComfort: kenmerk(typeId).comfort, marktaandeel: 0.5 };
  const sid = delenVan(typeId).map(basisId).find(c => TYPE[c]?.soort !== 'loc') || basisId(typeId);
  const std = klassenVan(standaardInrichting(sid, lijn.modus), sid, lijn.modus);
  const refK = JAAR < DRIE_KLASSEN_TOT ? '3' : '2', ref = COMFORT_VERSCHIL[refK]; // het gewone tarief: vroeger 3e, nu 2e klas
  const stdComfort = std.find(k => k.klasse === refK)?.comfort ?? std[0]?.comfort ?? 5;
  let som = 0;
  const w = kl.map(k => {
    const m = Math.pow(Math.max(0.1, k.prijs) / (STD_PRIJS[k.klasse] ?? 1), -(ELAST[k.klasse] ?? 0.8)) * Math.max(0.2, 1 + 0.07 * (k.comfort - (stdComfort + (COMFORT_VERSCHIL[k.klasse] ?? 0) - ref)));
    const x = (BASIS_AANDEEL[k.klasse] ?? 0.1) * m; som += x; return x;
  });
  const basisSom = kl.reduce((a, k) => a + (BASIS_AANDEEL[k.klasse] ?? 0.1), 0);
  const aandeel = w.map(x => x / (som || 1));
  // minder klassen = minder keuze; de groep blijft wel reizen (normaliseren naar de standaardmix)
  const factor = som / (basisSom || 1);
  const gemPrijs = kl.reduce((a, k, i) => a + aandeel[i] * k.prijs, 0);
  const gemComfort = kl.reduce((a, k, i) => a + aandeel[i] * k.comfort, 0);
  let marktaandeel = 0.5;
  if (comfortConcurrent != null) marktaandeel = Math.max(0.1, Math.min(0.9, 0.5 + 0.08 * (gemComfort - comfortConcurrent) - 0.6 * Math.log(gemPrijs)));
  return { factor, aandeel, klassen: kl, gemPrijs, gemComfort, marktaandeel };
}

// ---------------------------------------------------------------- kosten
const stoelKosten = (ink, typeId) => plaatsenPerWagon(ink, typeId).flat().reduce((a, d) => a + (d.soort === 'zit' ? d.zit * ((STOEL[d.stoel] || STOEL.bekleed).prijs + (STROOM[d.stroom || '']?.prijs || 0)) : d.soort === 'rest' ? REST[restSoort(d.len)].prijs : 0), 0)
  + (ink.voorz || []).reduce((a, v) => a + (VOORZ[v]?.prijs || 0), 0);
// meerprijs van een interieur bij nieuwbouw t.o.v. het standaardinterieur (kan negatief zijn: kale bankjes)
export function interieurMeerprijs(ink, basis) {
  return Math.round((stoelKosten(ink, basis) - stoelKosten(standaardInrichting(basis), basis)) / 1000) * 1000;
}
// verbouwen per voertuig: vaste kosten + per gewijzigde wagon de nieuwe inrichting + voorzieningen erbij
export function ombouwKosten(oud, nieuw, typeId) {
  oud = naarWagons(oud, typeId);
  let k = 20000;
  const per = plaatsenPerWagon(nieuw, typeId);
  nieuw.wagons.forEach((w, i) => {
    if (JSON.stringify(w) === JSON.stringify(oud.wagons[i])) return;
    for (const d of per[i]) k += d.soort === 'zit' ? d.zit * ((STOEL[d.stoel] || STOEL.bekleed).prijs + (STROOM[d.stroom || '']?.prijs || 0) + 250) : REST[restSoort(d.len)].prijs * 0.8;
  });
  for (const v of nieuw.voorz || []) if (!(oud.voorz || []).includes(v)) k += VOORZ[v]?.prijs || 0;
  return Math.round(k / 1000) * 1000;
}
// kosten per voertuiguur: catering per klasse en bemande voorzieningen zolang ze open zijn
export function uurKosten(lijn, typeId) {
  const open = restauratieOpen(lijn), kl = klassenVan(inrichtingVan(lijn, typeId), typeId, lijn.modus);
  return kl.reduce((a, k) => a + (CATERING[k.catering]?.uur || 0), 0) + voorzieningen(typeId).reduce((a, v) => a + v.uur * (v.bemand ? open : 1), 0);
}
// instaptijd: meer deuren = sneller in- en uitstappen (factor op de haltetijd)
export const haltetijdFactor = typeId => 1 / kenmerk(typeId).deuren;
// zelfde interieur? (om een bestaande serie terug te vinden)
export const zelfdeInterieur = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
const norm = i => ({ v: [...(i.voorz || [])].sort(), w: (i.wagons || []).map(w => w.delen.map(d => d.soort === 'zit' ? [d.klasse, d.stoel, d.breed, d.been, Math.round(d.len * 100), d.stroom || ''] : ['rest', Math.round(d.len * 100)])) });
// welke voorzieningen passen: niet meer dan ~70% van de zitplaatsen
export function voorzMag(id, typeId) {
  const t = TYPE[typeId], v = VOORZ[id];
  if (!t || !v) return false;
  if (v.minZit && t.zit < v.minZit) return false;
  return v.plekken <= t.zit * 0.7;
}

// ---------------------------------------------------------------- series met een eigen interieur
// spel.series = [{id, basis, naam, ink}]; elk wordt een eigen type (TYPE[id]) met de rijeigenschappen van het basistype.
export function registreerSeries(series = []) {
  for (const k of Object.keys(TYPE)) if (TYPE[k].serie || TYPE[k].samen) delete TYPE[k];
  for (const s of series) {
    const b = TYPE[s.basis]; if (!b) continue;
    s.ink = naarWagons(s.ink, s.basis);
    TYPE[s.id] = { ...b, id: s.id, naam: s.naam, basis: s.basis, ink: s.ink, serie: true, prijs: Math.max(b.prijs * 0.8, b.prijs + interieurMeerprijs(s.ink, s.basis)) };
  }
}
// korte naam van een type voor seriebenamingen (ICM, VIRM6, SLT6 ...)
export function kortNaam(typeId) {
  const t = TYPE[basisId(typeId)]; if (!t) return String(typeId).toUpperCase();
  const k = t.naam.split(/ \(| "|,/)[0].replace(/^Materieel /, 'Mat').replace(/^(Rijtuig|Intercityrijtuig|Dubbeldeksrijtuig) /, '').trim();
  return k.length <= 12 ? k.replace(/\s+/g, '') : t.id.toUpperCase();
}
// voorstel voor een seriebenaming op basis van het interieur
export function serieNaamVoorstel(typeId, ink) {
  const d = ink.wagons.flatMap(w => w.delen), zit = d.filter(x => x.soort === 'zit');
  const gem = zit.reduce((a, x) => a + (STOEL[x.stoel] || STOEL.bekleed).comfort * x.len, 0) / (zit.reduce((a, x) => a + x.len, 0) || 1);
  const soort = zit.some(x => x.stoel === 'massage' || x.klasse === 'P') ? 'luxe' : zit.length && zit.every(x => rang(x.klasse) >= 3) ? 'budget' : gem >= 0.6 ? 'comfort' : gem <= -0.6 ? 'basic'
    : d.some(x => x.soort === 'rest') ? 'restauratie' : (ink.voorz || []).length ? 'plus' : 'eigen';
  return `${kortNaam(typeId)}_${soort}`;
}

// ---------------------------------------------------------------- samenstellingen
// id 'sam:loc1700+icr+icr+icrbvk' (rijtuigen mogen eigen series zijn). Geeft het samengestelde type.
export function samenstelling(ids) {
  const id = 'sam:' + ids.join('+');
  if (TYPE[id]) return TYPE[id];
  const d = ids.map(c => TYPE[c]); if (!d.length || d.some(x => !x)) return null;
  const locs = d.filter(x => x.soort === 'loc'), rijtuigen = d.filter(x => x.soort !== 'loc'), units = d.filter(x => !x.soort);
  const getrokken = rijtuigen.filter(x => x.soort).length;
  // trekkracht: een loc trekt ~6 rijtuigen op zijn eigen acceleratie; meer rijtuigen = trager optrekken
  const acc = locs.length ? Math.min(...locs.map(l => l.acc)) * Math.min(1.25, Math.sqrt(6 * locs.length / Math.max(1, getrokken + units.length * 4)))
    : Math.min(...d.map(x => x.acc || 1));
  const stuur = d.some(x => x.soort === 'stuurstand') || locs.length >= 2 || (!locs.length && units.length > 0) || d[d.length - 1]?.soort === 'loc' && d[0]?.soort === 'loc';
  const t = { id, samen: ids, modus: 'trein', naam: ids.map(c => kortNaam(c)).join(' + '), zit: d.reduce((a, x) => a + x.zit, 0), sta: d.reduce((a, x) => a + x.sta, 0),
    vmax: Math.min(...d.map(x => x.vmax)), acc, prijs: d.reduce((a, x) => a + x.prijs, 0), km: d.reduce((a, x) => a + x.km, 0),
    energie: (locs[0] || units[0] || d[0]).energie, pers: Math.max(1, ...d.map(x => x.pers || 0)), leven: Math.min(...d.map(x => x.leven)),
    van: Math.max(...d.map(x => x.van)), tot: Math.min(...d.map(x => x.tot)), wie: '', keerExtra: stuur ? 0 : 15, zonderTrekkracht: !locs.length && !units.length };
  TYPE[id] = t;
  return t;
}
export const samenstellingVan = id => typeof id === 'string' && id.startsWith('sam:') ? samenstelling(id.slice(4).split('+')) : null;
// hoeveel van elk voertuig zit er in één trein van dit type: {typeId: aantal}
export function nodigPer(typeId) {
  const uit = {};
  for (const c of delenVan(typeId)) uit[c] = (uit[c] || 0) + 1;
  return uit;
}
