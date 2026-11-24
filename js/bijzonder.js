// Bijzondere ritten: eenmalige ritten die je zelf uitschrijft (bv. een stoomtrein Groningen – Maastricht via
// Amsterdam) of die een groep bij je boekt (charter). Mensen schrijven zich in tot de dag van de rit; de rit
// rijdt die dag echt over de kaart. Museummaterieel (buiten zijn eigen tijd) trekt extra belangstelling.
import { VLOOT, TYPE, MODI } from './vloot.js';
import { vangst, TARIEF, isWeekend, weekdag, kmKosten, nieuwId } from './spel.js';

// museummaterieel: gerestaureerd tweedehands te koop, ook als het type allang niet meer rijdt
export const museumTypen = jaar => VLOOT.filter(v => !v.soort && v.tot <= jaar && v.van < jaar && ['trein', 'tram', 'bus'].includes(v.modus));
export const museumPrijs = t => Math.round(t.prijs * 0.35 / 1000) * 1000;
export const isMuseum = (t, jaar) => !!t && jaar > t.tot;

// standaardprijs van een gewoon kaartje over deze afstand
export function gewonePrijs(modus, km) {
  const [instap, perKm] = TARIEF[modus] || TARIEF.trein;
  return instap + perKm * (modus === 'trein' ? Math.min(km, 40) + Math.max(0, km - 40) * 0.7 : km);
}

// verwachte inschrijvingen als de rit eindelijk rijdt (vóór de capaciteitsgrens)
export function belangstelling(spel, rit, plaatsen) {
  const t = TYPE[rit.typeId];
  let inw = 0;
  for (const h of rit.haltes) inw += vangst(plaatsen, h.x, h.y, 4000);
  let n = Math.sqrt(inw) * 0.35;
  if (isMuseum(t, spel.jaar)) n *= t.energie === 'kolen' ? 3.2 : 2.2;     // stoom en oud materieel: veel liefhebbers
  if (isWeekend(rit.dag)) n *= 1.7;
  // meer ritten op één dag: wat meer mensen in totaal, maar verdeeld over de ritten; terugkerend (museumlijn) is minder uniek
  const ritten = Math.max(1, rit.ritten || 1); n *= (1 + 0.5 * (ritten - 1)) / ritten;
  if (rit.terugkerend) n *= 0.55;
  const km = rit.lengteKm || 50;
  n *= km < 15 ? 0.5 : km < 60 ? 0.9 : km < 220 ? 1.15 : 0.8;              // een dagje uit: niet te kort, niet te lang
  const verhouding = rit.prijs / Math.max(1, gewonePrijs(rit.modus, km) * (isMuseum(t, spel.jaar) ? 1.6 : 1));
  n *= Math.pow(Math.max(0.2, verhouding), -1.15);
  return Math.max(0, Math.round(n));
}
// hoeveel er nu al ingeschreven staan: groeit naar de dag van de rit toe
export function inschrijvingen(spel, lijn, plaatsen, cap) {
  const b = lijn.bijzonder;
  const geplandDagen = Math.max(1, b.dag - b.gepland), verstreken = Math.max(0, Math.min(geplandDagen, spel.dag - b.gepland + spel.tijd / 1440 - 0.2));
  const eind = Math.min(cap, belangstelling(spel, { ...b, haltes: lijn.haltes, typeId: lijn.typeId, modus: lijn.modus, lengteKm: lijn.lengteKm }, plaatsen));
  return Math.round(eind * (1 - Math.exp(-3 * verstreken / geplandDagen)) / (1 - Math.exp(-3)));
}
// vertrektijden van een bijzondere lijn op een speldag: alleen op de dag zelf één rit
// eenmalig: op die ene dag (eventueel heen en weer pendelen); bijzonder (terugkerend): op de gekozen weekdagen
export const rittenVan = b => [b.heen || [b.vertrek], b.terug || []];
export const rijdtOp = (b, dag) => b.soort === 'bijzonder' ? dag >= (b.vanaf ?? 0) && (b.tot == null || dag <= b.tot) && (b.dagen || []).includes(weekdag(dag)) : dag === b.dag;
export const vertrekOpDag = (lijn, dag) => rijdtOp(lijn.bijzonder, dag) ? rittenVan(lijn.bijzonder).map(x => [...x]) : [[], []];
export const aantalRitten = b => rittenVan(b)[0].length + rittenVan(b)[1].length;
// vertrektijden: eerste vertrek, aantal keer heen-en-terug (0 = alleen heen), keertijd, rijtijd (s)
export function pendel(eerste, keer, keertijd, duur) {
  const rit = Math.ceil(duur / 60), heen = [eerste], terug = [];
  for (let k = 0; k < keer; k++) { const t = heen[k] + rit + keertijd; terug.push(t); if (k < keer - 1) heen.push(t + rit + keertijd); }
  return { heen, terug };
}

// kosten van de rit: energie/onderhoud per km (museum duurder) en personeel (machinist, conducteurs, begeleiding)
export function ritKosten(spel, lijn) {
  const t = TYPE[lijn.typeId], uren = (lijn.duur / 3600) + 1.5;
  // museummaterieel: vaste inzetkosten (opstoken en voorbereiden van een stoomloc duurt uren, controle, vrijwilligers)
  const inzet = isMuseum(t, spel.jaar) ? (t.energie === 'kolen' ? 6500 : 2500) : 600;
  return inzet + lijn.lengteKm * kmKosten(t, spel.jaar) * 1.3 + uren * (MODI[lijn.modus].loon * (t?.pers || 1) + 2 * 50);
}

// een groep vraagt een rit aan (charter)
const GROEPEN = ['Stichting Historisch Spoor', 'Personeelsvereniging Philips', 'VVV Gelderland', 'Fanfare Kunst en Genoegen', 'Bedrijfsuitje ASML', 'Rotary Club',
  'Seniorenvereniging De Zonnebloem', 'Voetbalsupporters', 'Trouwerij familie de Vries', 'Schoolreis basisschool De Regenboog', 'Spoorwegmuseum vrienden', 'Koor Zingen Doet Goed'];
export function bedenkCharter(spel, stations) {
  const groot = stations.filter(s => s.s === 'trein' && (s.p || 2) >= 4 && !(s.b && s.b > spel.jaar) && !(s.e && s.e <= spel.jaar));
  if (groot.length < 2) return null;
  const a = groot[Math.floor(Math.random() * groot.length)];
  const ver = groot.filter(s => { const d = Math.hypot(s.x - a.x, s.y - a.y); return d > 30000 && d < 180000; });
  if (!ver.length) return null;
  const b = ver[Math.floor(Math.random() * ver.length)];
  const wie = GROEPEN[Math.floor(Math.random() * GROEPEN.length)];
  const historisch = /Histor|museum|Spoor/i.test(wie) || Math.random() < 0.3;
  const km = Math.hypot(b.x - a.x, b.y - a.y) / 1000 * 1.2;
  const personen = 60 + Math.round(Math.random() * 340);
  const bod = Math.round((2500 + km * (historisch ? 90 : 45) + personen * 6) / 500) * 500;
  const dag = spel.dag + 10 + Math.floor(Math.random() * 30);
  return { id: nieuwId('v'), aan: 'speler', van: 'groep', vanNaam: wie, soort: 'charter', status: 'open', dag: spel.dag, tijd: spel.tijd,
    van_: { naam: a.n, x: a.x, y: a.y }, naar: { naam: b.n, x: b.x, y: b.y }, ritDag: dag, vertrek: 9 * 60 + 30, personen, historisch, minuten: 0, bod,
    tekst: `${wie} wil op dag ${dag + 1} met ${personen} personen een ${historisch ? 'rit met historisch materieel (stoom of oud materieel)' : 'eigen trein'} van ${a.n} naar ${b.n}, vertrek 09:30. Bod: € ${bod.toLocaleString('nl-NL')}.` };
}
