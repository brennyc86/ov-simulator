// Goederenvervoer (eenvoudig begin). Klanten vragen een goederentrein aan tussen twee goederenplekken (ook over de
// grens). De klant zorgt voor de wagons; jij voor de loc(s), het pad en het personeel. Een zware trein moet in de
// dienstregeling mee kunnen komen: hoe drukker het tijdvak, hoe meer trekkracht per ton nodig is (nacht licht,
// overdag buiten de spits zwaarder, in de spits het zwaarst). Locs die 's nachts of in het dal goederen trekken,
// kunnen in de spits een reizigerstrein trekken. De vergoeding is (bewust) ruim: in twee rijdagen verdien je de
// benodigde locs terug.
import { vermogen } from './techniek.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const kies = l => l[Math.floor(Math.random() * l.length)];

// goederenplekken (lat, lon) met wat er typisch vandaan komt of heen gaat
export const PLEKKEN = [
  ['Maasvlakte (haven Rotterdam)', 51.955, 4.03, 'containers'], ['Kijfhoek (rangeerterrein)', 51.83, 4.61, 'gemengd'], ['Botlek (chemie)', 51.885, 4.31, 'chemie'],
  ['Amsterdam Westhaven', 52.405, 4.81, 'kolen en bulk'], ['Moerdijk', 51.69, 4.6, 'containers'], ['Vlissingen-Sloe', 51.45, 3.69, 'bulk'],
  ['Venlo (Trade Port)', 51.38, 6.15, 'containers'], ['Oldenzaal', 52.31, 6.93, 'gemengd'], ['Geleen (Chemelot)', 50.97, 5.79, 'chemie'],
  ['Delfzijl (chemie)', 53.32, 6.92, 'chemie'], ['Beverwijk (Tata Steel)', 52.48, 4.6, 'staal'], ['Born (Nedcar)', 51.03, 5.82, 'auto\'s'],
  ['Antwerpen haven', 51.28, 4.33, 'containers'], ['Gent (Volvo, ArcelorMittal)', 51.08, 3.73, 'staal'], ['Luik (Kinkempois)', 50.62, 5.57, 'staal'],
  ['Zeebrugge', 51.33, 3.2, 'auto\'s'], ['Bettembourg (Luxemburg)', 49.52, 6.1, 'containers'],
  ['Duisburg (haven)', 51.43, 6.76, 'containers'], ['Keulen-Eifeltor', 50.9, 6.93, 'containers'], ['Ludwigshafen (BASF)', 49.5, 8.42, 'chemie'],
  ['Metz-Sablon', 49.1, 6.18, 'gemengd'], ['Dunkerque (haven)', 51.03, 2.3, 'staal'],
];
const KLANTEN = { containers: ['ECT', 'Hutchison Ports', 'Contargo', 'Hupac', 'Kombiverkehr'], chemie: ['Dow', 'SABIC', 'BASF', 'Shell', 'LyondellBasell'], staal: ['Tata Steel', 'ArcelorMittal', 'Thyssenkrupp'],
  'kolen en bulk': ['OBA Bulk', 'EMO', 'Vopak'], bulk: ['Zeeland Refinery', 'Ovet'], 'auto\'s': ['VDL Nedcar', 'ICO Zeebrugge', 'Volvo Cars'], gemengd: ['DB Cargo-klant', 'Lineas-klant', 'Rail Force One-klant'] };
// trekkracht per ton (kW/t) per tijdvak; vertrektijden die bij dat tijdvak horen
export const VENSTER = {
  nacht: { naam: 'nacht (00–06)', kwPerTon: 1.0, tijden: [0, 60, 120, 180, 240, 300] },
  dal: { naam: 'overdag buiten de spits', kwPerTon: 2.5, tijden: [570, 630, 690, 750, 810, 870, 930, 1140, 1200, 1260, 1320] },
  spits: { naam: 'spits (mee met het reizigersverkeer)', kwPerTon: 5.0, tijden: [420, 450, 480, 960, 990, 1020, 1050] },
};
export const FREQ = { eenmalig: { naam: 'eenmalig', dagen: null }, dagelijks: { naam: 'elke dag', dagen: [0, 1, 2, 3, 4, 5, 6] }, werkdagen: { naam: 'op werkdagen', dagen: [0, 1, 2, 3, 4] },
  wekelijks: { naam: 'één keer per week', dagen: null } };
export const WAGON_TON = 80, WAGON_M = 16;
export const vensterVan = minuten => { const m = ((minuten % 1440) + 1440) % 1440; return m < 360 ? 'nacht' : (m >= 420 && m < 540) || (m >= 960 && m < 1110) ? 'spits' : 'dal'; };

// hoeveel kW is nodig voor deze trein in dit tijdvak (wagons + een loc van ~90 t)
export const nodigKw = (ton, venster) => Math.round((ton + 90) * VENSTER[venster].kwPerTon);
// referentie: zoveel moderne locs (6400 kW, ~5 mln) heb je typisch nodig; daarop is de vergoeding gebaseerd
export const refLocs = (ton, venster) => Math.max(1, Math.ceil(nodigKw(ton, venster) / 6400));
// vergoeding per rit: locs in twee rijdagen terugverdienen (plus wat voor pad, personeel en eventueel spoor)
export const vergoeding = (ton, venster, km) => Math.round((refLocs(ton, venster) * 5e6 / 2 * 1.3 + km * 40) / 1000) * 1000;

// nieuwe aanvraag; route wordt door de aanroeper gecontroleerd (kanRijden)
// niveau 0..4: begint eenvoudig (kort, licht, binnen Nederland) en wordt groter naarmate je ritten goed rijdt
export const vrachtNiveau = spel => Math.min(4, Math.floor((spel.vrachtRitten || 0) / 3));
const NIVEAU = [{ km: [20, 90], wagons: [8, 16], buitenland: false }, { km: [25, 150], wagons: [10, 22], buitenland: false }, { km: [30, 250], wagons: [12, 28], buitenland: true },
  { km: [40, 350], wagons: [15, 35], buitenland: true }, { km: [60, 450], wagons: [20, 40], buitenland: true }];
const inNL = p => p[1] > 50.75 && p[1] < 53.6 && p[2] > 3.3 && p[2] < 7.25 && !/Antwerpen|Gent|Luik|Zeebrugge|Duisburg|Keulen/.test(p[0]);
export function bedenkAanvraag(spel, plekRd, kanRijden, niveau = vrachtNiveau(spel)) {
  const nv = NIVEAU[niveau];
  for (let poging = 0; poging < 16; poging++) {
    const a = kies(PLEKKEN), b = kies(PLEKKEN); if (a === b) continue;
    if (!nv.buitenland && (!inNL(a) || !inNL(b))) continue;
    const pa = plekRd(a), pb = plekRd(b), km = Math.hypot(pa.x - pb.x, pa.y - pb.y) / 1000;
    if (km < nv.km[0] || km > nv.km[1]) continue;
    const route = kanRijden(pa, pb); if (!route) continue;
    const soort = Math.random() < 0.5 ? a[3] : b[3], wagons = rnd(nv.wagons[0], nv.wagons[1]), ton = wagons * WAGON_TON;
    const freq = niveau === 0 ? kies(['eenmalig', 'eenmalig', 'werkdagen', 'wekelijks']) : kies(['eenmalig', 'dagelijks', 'dagelijks', 'werkdagen', 'werkdagen', 'wekelijks']);
    return { id: 'g' + Math.random().toString(36).slice(2, 9), klant: kies(KLANTEN[soort] || KLANTEN.gemengd), lading: soort, van: { naam: a[0], ...pa }, naar: { naam: b[0], ...pb },
      wagons, ton, lengte: wagons * WAGON_M, km: Math.round(route.lengte / 1000), freq, niveau, dag: spel.dag, tot: spel.dag + rnd(6, 16), route,
      // de wagons zijn van de klant en moeten terug: leeg, of vol met andere lading (betaalt meer); lossen kost tijd
      retour: Math.random() < 0.3 ? 'vol' : 'leeg', losUren: rnd(2, 8), tonVol: Math.round(ton * (0.6 + Math.random() * 0.9)) };
  }
  return null;
}

// samengesteld type voor een goederentrein: n locs + wagons van de klant (de wagons tel je niet in je vloot)
export const vrachtTypeId = (loc, n, wagons) => `sam:${Array(n).fill(loc).concat(Array(wagons).fill('goederenwagen')).join('+')}`;
export const trekkracht = (loc, n) => vermogen(loc) * n;
export const locsNodig = (loc, ton, venster) => Math.max(1, Math.ceil(nodigKw(ton, venster) / Math.max(1, vermogen(loc))));
export const isVrachtLoc = v => v?.soort === 'loc' && v.modus === 'trein';

// trekkracht voor de terugrit: lege wagons wegen ongeveer een kwart
export const tonTerug = a => a.retour === 'vol' ? (a.tonVol || a.ton) : Math.round(a.ton * 0.28); // andere lading kan lichter of zwaarder zijn
// samenstelling uit een lijst locs (verschillende typen mogen) en de wagons van de klant
export const vrachtTypeIdMix = (locs, wagons) => `sam:${locs.flatMap(x => Array(x.n).fill(x.id)).concat(Array(wagons).fill('goederenwagen')).join('+')}`;
// vergoeding voor heen en terug samen (een terugrit met lading betaalt 60% extra)
export const vergoedingRetour = (a, venster) => Math.round(vergoeding(a.ton, venster, a.km) * (a.retour === 'vol' ? 1.6 : 1) / 1000) * 1000;
// geschatte rijtijd (min) voor een goederentrein over deze afstand
export const vrachtRijtijd = km => Math.round(km / 65 * 60 + 10);
