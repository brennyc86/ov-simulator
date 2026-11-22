// Comfort, klassen, inrichting en prijzen.
// Elk materieeltype heeft een basiscomfort (0–10) en een instapsnelheid (deuren). Per lijn richt je het
// materieel in: klassen met stoelen naast elkaar, beenruimte, extra's, vloeraandeel en prijs. Daaruit volgen
// zit-/staplaatsen en comfort per klasse; reizigers kiezen op prijs en comfort.
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
export function kenmerk(typeId) {
  const k = KENMERK[typeId], t = TYPE[typeId];
  if (k) return { comfort: k[0], deuren: k[1] };
  return { comfort: t?.modus === 'vlucht' ? 6 : t?.modus === 'veer' ? 5 : 4.5, deuren: 1 };
}
// standaard stoelen naast elkaar en beenruimte per soort vervoer
const STD_BREED = { trein: 4, metro: 4, sneltram: 4, tram: 4, bus: 4, hov: 4, belbus: 3, veer: 4, watertaxi: 3, vlucht: 5 };
export const BEEN = { krap: 70, normaal: 80, ruim: 95, royaal: 110 };
export const EXTRA = { '': 'geen', kaal: 'kaal (houten bankjes)', catering: 'catering aan boord', massage: 'massagestoelen + catering' };
export const KLASSE_NAAM = { P: 'Premium', 1: '1e klas', 2: '2e klas', 3: '3e klas' };

// standaardinrichting: treinen 1e en 2e klas, verder één klas
export function standaardIndeling(typeId, modus) {
  const sb = STD_BREED[modus] || 4;
  const kaal = kenmerk(typeId).comfort < 3;
  if (modus === 'trein') return [
    { klasse: '1', breed: 3, been: 'ruim', extra: '', deel: 0.15, prijs: 1.7 },
    { klasse: '2', breed: sb, been: 'normaal', extra: kaal ? 'kaal' : '', deel: 0.85, prijs: 1 },
  ];
  return [{ klasse: '2', breed: sb, been: 'normaal', extra: kaal ? 'kaal' : '', deel: 1, prijs: 1 }];
}
export const inrichtingVan = (lijn, typeId) => lijn?.inrichting || standaardIndeling(typeId, lijn?.modus);

// zit- en staplaatsen en comfort per klasse
export function klassenVan(inrichting, typeId, modus) {
  const t = TYPE[typeId] || { zit: 60, sta: 40 }, sb = STD_BREED[modus] || 4, basis = kenmerk(typeId).comfort;
  const somDeel = inrichting.reduce((a, k) => a + k.deel, 0) || 1;
  return inrichting.map(k => {
    const deel = k.deel / somDeel, pitch = BEEN[k.been] || 80;
    // standaardinrichting ~ 2e klas: stoelen schalen met breedte en beenruimte
    const zit = Math.max(0, Math.round(t.zit * deel * (k.breed / sb) * (80 / pitch)));
    const staBasis = k.klasse === '1' || k.klasse === 'P' || k.extra === 'massage' ? 0 : t.sta * deel;
    const sta = Math.max(0, Math.round(staBasis * (k.breed <= sb ? 1 + (sb - k.breed) * 0.15 : 1 - (k.breed - sb) * 0.25)));
    const comfort = Math.max(0, Math.min(10, basis + (sb - k.breed) * 0.9 + (pitch - 80) / 12 + ({ kaal: -2, catering: 0.8, massage: 2.2 }[k.extra] || 0)));
    return { klasse: k.klasse, zit, sta, comfort, prijs: k.prijs, extra: k.extra };
  });
}

// vraageffect van inrichting en prijs: factor op het aantal reizigers, aandeel per klasse, gemiddelde prijsfactor
const BASIS_AANDEEL = { P: 0.03, 1: 0.07, 2: 0.9, 3: 0.12 };
const ELAST = { P: 0.25, 1: 0.35, 2: 0.55, 3: 0.75 };
export function vraagEffect(lijn, typeId, comfortConcurrent = null) {
  const ink = inrichtingVan(lijn, typeId), kl = klassenVan(ink, typeId, lijn.modus);
  const std = klassenVan(standaardIndeling(typeId, lijn.modus), typeId, lijn.modus);
  const stdComfort = std.find(k => k.klasse === '2')?.comfort ?? std[0].comfort;
  let som = 0;
  const w = kl.map(k => {
    const ref = k.klasse === '1' ? 1.7 : k.klasse === 'P' ? 2.6 : k.klasse === '3' ? 0.7 : 1;
    const m = Math.pow(Math.max(0.1, k.prijs) / ref, -ELAST[k.klasse]) * Math.max(0.2, 1 + 0.07 * (k.comfort - (stdComfort + (k.klasse === '1' ? 2 : k.klasse === 'P' ? 4 : k.klasse === '3' ? -2 : 0))));
    const x = (BASIS_AANDEEL[k.klasse] ?? 0.1) * m; som += x; return x;
  });
  const basisSom = kl.reduce((a, k) => a + (BASIS_AANDEEL[k.klasse] ?? 0.1), 0);
  const aandeel = w.map(x => x / (som || 1));
  // minder klassen = minder keuze; de groep blijft wel reizen (normaliseren naar de standaardmix)
  let factor = som / (basisSom || 1);
  const gemPrijs = kl.reduce((a, k, i) => a + aandeel[i] * k.prijs, 0);
  const gemComfort = kl.reduce((a, k, i) => a + aandeel[i] * k.comfort, 0);
  // concurrentie op dezelfde haltes: wie goedkoper of comfortabeler is, trekt meer reizigers
  let marktaandeel = 0.5;
  if (comfortConcurrent != null) marktaandeel = Math.max(0.1, Math.min(0.9, 0.5 + 0.08 * (gemComfort - comfortConcurrent) - 0.6 * Math.log(gemPrijs)));
  return { factor, aandeel, klassen: kl, gemPrijs, gemComfort, marktaandeel };
}

// kosten: ombouw per voertuig (eenmalig) en per voertuiguur (catering-personeel)
export function ombouwKosten(oud, nieuw, typeId) {
  const t = TYPE[typeId] || { zit: 60 };
  let k = 15000;
  for (const c of nieuw) {
    const o = oud.find(x => x.klasse === c.klasse);
    if (!o || o.breed !== c.breed || o.been !== c.been) k += t.zit * c.deel * 350;
    if (c.extra === 'massage' && o?.extra !== 'massage') k += t.zit * c.deel * 2500;
    if (c.extra === 'catering' && !['catering', 'massage'].includes(o?.extra)) k += 40000;
  }
  return k;
}
export const uurKosten = inrichting => inrichting.reduce((a, k) => a + (k.extra === 'catering' ? 30 : k.extra === 'massage' ? 45 : 0), 0);
// instaptijd: meer deuren = sneller in- en uitstappen (factor op de haltetijd)
export const haltetijdFactor = typeId => 1 / kenmerk(typeId).deuren;
