// Historische vervoerders en een dienstregeling die past bij het jaar.
// Jaartallen en werkgebieden zijn benaderingen; waar een bedrijf in meerdere fases bestond is de
// bekendste periode genomen. Aanvullingen zijn welkom.

// grove provinciegrenzen in RD (overlap is niet erg)
export const PROVINCIES = {
  GR: [200000, 540000, 280000, 620000], FR: [120000, 530000, 230000, 620000], DR: [200000, 510000, 270000, 575000],
  OV: [180000, 445000, 270000, 535000], FL: [140000, 470000, 190000, 540000], GE: [130000, 410000, 255000, 500000],
  UT: [115000, 435000, 170000, 485000], NH: [95000, 460000, 150000, 580000], ZH: [55000, 410000, 130000, 485000],
  ZE: [10000, 360000, 80000, 420000], NB: [50000, 370000, 200000, 420000], LI: [165000, 305000, 210000, 420000],
  NL: [10000, 305000, 280000, 620000],
};
// stadsgebieden voor stadsvervoerders (middelpunt RD, straal m)
const STAD = {
  Amsterdam: [121500, 487300, 12000], Rotterdam: [92500, 437500, 12000], DenHaag: [81000, 455000, 10000],
  Utrecht: [136000, 456000, 8000], Groningen: [233500, 582000, 7000], Arnhem: [190500, 444000, 7000],
  Eindhoven: [161500, 383500, 8000], Nijmegen: [187500, 428500, 7000],
};

// modi: welke soorten vervoer; gebied: provincies of stad
export const HIST_VERVOERDERS = [
  // ---- spoorwegen ----
  { id: 'hijsm', naam: 'Hollandsche IJzeren Spoorweg-Maatschappij (HSM)', van: 1839, tot: 1937, modi: ['trein'], gebied: ['NH', 'ZH', 'UT', 'GE'], kleur: '#7a2e2e' },
  { id: 'ss', naam: 'Staatsspoorwegen (SS)', van: 1863, tot: 1937, modi: ['trein'], gebied: ['NB', 'LI', 'GE', 'UT', 'OV', 'FR', 'GR', 'DR', 'ZE'], kleur: '#2e4a7a' },
  { id: 'ncs', naam: 'Nederlandsche Centraal-Spoorweg-Maatschappij (NCS)', van: 1860, tot: 1919, modi: ['trein'], gebied: ['UT', 'GE', 'OV'], kleur: '#4a6a3a' },
  { id: 'ns', naam: 'Nederlandse Spoorwegen (NS)', van: 1938, tot: 2100, modi: ['trein'], gebied: ['NL'], kleur: '#1f3f8f' },
  { id: 'noordned', naam: 'NoordNed', van: 1999, tot: 2005, modi: ['trein', 'bus'], gebied: ['FR', 'GR'], kleur: '#d0421b' },
  { id: 'syntus', naam: 'Syntus', van: 1999, tot: 2017, modi: ['trein', 'bus'], gebied: ['GE', 'OV'], kleur: '#e2001a' },
  { id: 'veolia', naam: 'Veolia Transport', van: 2007, tot: 2016, modi: ['trein', 'bus'], gebied: ['LI'], kleur: '#d6001c' },
  { id: 'arriva', naam: 'Arriva', van: 1998, tot: 2100, modi: ['trein', 'bus'], gebied: ['FR', 'GR', 'DR', 'ZH', 'LI', 'NB'], kleur: '#00a3c4' },
  // ---- stads- en tramvervoer ----
  { id: 'gvb', naam: 'GVB (Gemeentevervoerbedrijf Amsterdam)', van: 1900, tot: 2100, modi: ['tram', 'bus', 'metro', 'veer'], stad: 'Amsterdam', kleur: '#003b7c' },
  { id: 'ret', naam: 'RET (Rotterdamse Elektrische Tram)', van: 1927, tot: 2100, modi: ['tram', 'bus', 'metro'], stad: 'Rotterdam', kleur: '#e30613' },
  { id: 'htm', naam: 'HTM (Haagsche Tramweg-Maatschappij)', van: 1887, tot: 2100, modi: ['tram', 'bus'], stad: 'DenHaag', kleur: '#c8102e' },
  { id: 'gvu', naam: 'GVU (Gemeentelijk Vervoerbedrijf Utrecht)', van: 1904, tot: 2008, modi: ['tram', 'bus'], stad: 'Utrecht', kleur: '#c4161c' },
  { id: 'gado', naam: 'GADO / Stadsbus Groningen', van: 1926, tot: 1999, modi: ['bus'], stad: 'Groningen', kleur: '#c8102e' },
  { id: 'hermes', naam: 'Hermes', van: 1999, tot: 2100, modi: ['bus'], stad: 'Eindhoven', kleur: '#e2007a' },
  { id: 'stadsvervoernijmegen', naam: 'Stadsvervoer Nijmegen (SNG)', van: 1955, tot: 2000, modi: ['bus'], stad: 'Nijmegen', kleur: '#6b2c91' },
  { id: 'gtw', naam: 'Gemeentelijke Tram Arnhem (trolleybus)', van: 1949, tot: 2000, modi: ['bus'], stad: 'Arnhem', kleur: '#2d6a2d' },
  // ---- tram- en streekvervoer (vroeger) ----
  { id: 'rtm', naam: 'Rotterdamsche Tramweg-Maatschappij (RTM)', van: 1878, tot: 1965, modi: ['tram', 'bus', 'veer'], gebied: ['ZH', 'ZE'], kleur: '#6a4a2a' },
  { id: 'ntm', naam: 'Nederlandsche Tramweg-Maatschappij (NTM)', van: 1880, tot: 1947, modi: ['tram', 'bus'], gebied: ['FR', 'GR'], kleur: '#5a5a2a' },
  { id: 'gtw2', naam: 'Geldersche Tramwegen (GTW)', van: 1880, tot: 1960, modi: ['tram', 'bus'], gebied: ['GE', 'OV'], kleur: '#3a5a2a' },
  { id: 'nzh', naam: 'Noord-Zuid-Hollandsche Vervoer Maatschappij (NZH)', van: 1919, tot: 1999, modi: ['tram', 'bus'], gebied: ['NH', 'ZH'], kleur: '#e2b100' },
  { id: 'bba', naam: 'BBA (Brabantsche Buurtspoorwegen en Autodiensten)', van: 1919, tot: 1999, modi: ['bus'], gebied: ['NB'], kleur: '#e2001a' },
  { id: 'cn', naam: 'Centraal Nederland', van: 1971, tot: 1994, modi: ['bus'], gebied: ['UT', 'NH'], kleur: '#e2001a' },
  { id: 'fram', naam: 'FRAM (Friesche Rijwiel- en Automobielmaatschappij)', van: 1928, tot: 1999, modi: ['bus'], gebied: ['FR'], kleur: '#f2a900' },
  { id: 'gsm', naam: 'GSM (Groninger Autobusdiensten)', van: 1927, tot: 1999, modi: ['bus'], gebied: ['GR', 'DR'], kleur: '#c4161c' },
  { id: 'zwn', naam: 'ZWN (Zuid-West Nederland)', van: 1972, tot: 1999, modi: ['bus'], gebied: ['ZH', 'ZE'], kleur: '#00843d' },
  { id: 'zuidooster', naam: 'Zuidooster', van: 1994, tot: 1999, modi: ['bus'], gebied: ['GE', 'NB', 'LI'], kleur: '#00843d' },
  { id: 'midnet', naam: 'Midnet', van: 1994, tot: 1999, modi: ['bus'], gebied: ['UT', 'NH'], kleur: '#e30613' },
  { id: 'oostnet', naam: 'Oostnet', van: 1994, tot: 1999, modi: ['bus'], gebied: ['OV', 'GE'], kleur: '#e30613' },
  { id: 'westnet', naam: 'Westnet', van: 1994, tot: 1999, modi: ['bus', 'sneltram'], gebied: ['ZH', 'UT'], kleur: '#e30613' },
  { id: 'connexxion', naam: 'Connexxion', van: 1999, tot: 2100, modi: ['bus', 'veer', 'belbus'], gebied: ['NH', 'ZH', 'UT', 'GE', 'FL', 'ZE'], kleur: '#00843d' },
  { id: 'qbuzz', naam: 'Qbuzz', van: 2008, tot: 2100, modi: ['bus', 'hov'], gebied: ['GR', 'DR', 'UT', 'ZH'], kleur: '#ff6600' },
  { id: 'ebs', naam: 'EBS', van: 2012, tot: 2100, modi: ['bus'], gebied: ['ZH', 'NH'], kleur: '#0072bc' },
  { id: 'keolis', naam: 'Keolis', van: 2017, tot: 2100, modi: ['trein', 'bus'], gebied: ['OV', 'GE', 'FL'], kleur: '#7a1f6e' },
  // ---- water ----
  { id: 'teso', naam: 'TESO (Texels Eigen Stoomboot Onderneming)', van: 1907, tot: 2100, modi: ['veer'], gebied: ['NH'], filter: 'Texel', kleur: '#003a70' },
  { id: 'doeksen', naam: 'Rederij Doeksen', van: 1908, tot: 2100, modi: ['veer'], gebied: ['FR'], filter: 'Terschelling|Vlieland', kleur: '#003a70' },
  { id: 'wagenborg', naam: 'Wagenborg Passagiersdiensten', van: 1950, tot: 2100, modi: ['veer'], gebied: ['FR', 'GR'], filter: 'Ameland|Schiermonnikoog', kleur: '#003a70' },
  { id: 'psd', naam: 'Provinciale Stoombootdiensten Zeeland (PSD)', van: 1875, tot: 2002, modi: ['veer'], gebied: ['ZE'], kleur: '#0d4a8b' },
  { id: 'westerschelde', naam: 'Westerschelde Ferry', van: 2003, tot: 2100, modi: ['veer'], gebied: ['ZE'], kleur: '#0d4a8b' },
  // ---- lucht ----
  { id: 'klm', naam: 'KLM', van: 1920, tot: 2100, modi: ['vlucht'], gebied: ['NL'], kleur: '#00a1de' },
  { id: 'nlm', naam: 'NLM CityHopper', van: 1966, tot: 1991, modi: ['vlucht'], gebied: ['NL'], kleur: '#00a1de' },
];

export function vervoerdersIn(jaar) {
  return HIST_VERVOERDERS.filter(v => v.van <= jaar && v.tot >= jaar);
}
export function gebiedVan(v) {
  if (v.stad) { const [x, y, r] = STAD[v.stad]; return [x - r, y - r, x + r, y + r]; }
  const b = v.gebied.map(p => PROVINCIES[p]);
  return [Math.min(...b.map(q => q[0])), Math.min(...b.map(q => q[1])), Math.max(...b.map(q => q[2])), Math.max(...b.map(q => q[3]))];
}
export function binnen(v, x, y) {
  if (v.stad) { const [cx, cy, r] = STAD[v.stad]; return Math.hypot(x - cx, y - cy) < r; }
  return v.gebied.some(p => { const b = PROVINCIES[p]; return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]; });
}

// Dienstregeling-niveau per tijdperk (minuten tussen ritten): [spits, dal, avond]
export function frequentie(modus, jaar, belangrijk) {
  if (modus === 'trein') {
    if (jaar < 1900) return belangrijk ? [120, 180, 240] : [180, 240, 999];
    if (jaar < 1938) return belangrijk ? [60, 120, 180] : [120, 180, 240];
    if (jaar < 1970) return belangrijk ? [60, 60, 120] : [60, 120, 120];
    if (jaar < 2007) return belangrijk ? [30, 30, 60] : [30, 60, 60];
    return belangrijk ? [15, 30, 30] : [30, 30, 60];
  }
  if (modus === 'tram') return jaar < 1900 ? [20, 30, 60] : jaar < 1960 ? [10, 15, 20] : [8, 10, 15];
  if (modus === 'metro') return [5, 8, 10];
  if (modus === 'veer') return jaar < 1950 ? [180, 240, 999] : [60, 120, 120];
  if (modus === 'vlucht') return [240, 480, 999];
  return jaar < 1950 ? (belangrijk ? [60, 120, 999] : [120, 240, 999]) : (belangrijk ? [15, 30, 60] : [30, 60, 120]);
}

// Naamswijzigingen van stations: [huidige naam, oude naam, jaar van de nieuwe naam].
// Bronnen: Wikidata (officiële naam met start/eind) en bekende hernoemingen.
export const NAAMWIJZIGINGEN = [
  ['Dieren', 'Dieren-Doesburg', 1976],
  ['De Westereen', 'Zwaagwesteinde', 2015],
  ['Heerhugowaard', 'Heerhugowaard-Broek op Langendijk', 1976],
  ['Schiedam Centrum', 'Schiedam-Rotterdam West', 1998],
  ['Eindhoven Centraal', 'Eindhoven', 2019],
  ['Amsterdam Bijlmer ArenA', 'Amsterdam Bijlmer', 2007],
  ['Hilversum Media Park', 'Hilversum Noord', 2006],
  ['Amersfoort Centraal', 'Amersfoort', 2016],
  ['Arnhem Centraal', 'Arnhem', 2015],
];

// naam van een station in een bepaald jaar
export function stationsnaam(naam, jaar, oud = []) {
  for (const [nu, vroeger, sinds] of NAAMWIJZIGINGEN) if (naam === nu && jaar < sinds) return vroeger;
  // oude namen uit OpenHistoricalMap op dezelfde plek: [naam, van, tot]
  for (const [n, van, tot] of oud) if (jaar >= (van || 0) && jaar < tot && n !== naam) return n;
  // "X Centraal" heette tot ongeveer 2000 "X CS" (Centraal Station)
  if (jaar < 2000 && / Centraal$/.test(naam) && !NAAMWIJZIGINGEN.some(w => w[0] === naam)) return naam.replace(/ Centraal$/, ' CS');
  return naam;
}

// Openingsjaren van spoorlijnen die in OpenStreetMap geen startdatum hebben (naam van de lijn in OSM).
export const LIJNJAREN = {
  'Flevolijn': 1987, 'Schiphollijn': 1981, 'HSL-Zuid': 2009, 'HSL Breda aansluiting': 2009, 'Betuweroute': 2007, 'Hanzelijn': 2012,
  'Zoetermeer Stadslijn': 1977, 'Uithoflijn': 2019, 'Calandlijn': 1982, 'Erasmuslijn': 1968, 'Noord/Zuidlijn': 2018,
  'Oosterheemlijn': 2007, 'Beneluxlijn': 2002, 'Westelijke Ringspoorbaan': 1986, 'Zuidelijke Ringspoorbaan': 1993,
  'Utrechtboog': 2006, 'Hemboog': 2003, 'Schipholboog': 1986, 'Nootdorpboog': 2006, 'Ringlijn': 1997, 'Oostlijn': 1977,
  'Amstelveenlijn': 1990, 'Nieuwegeinlijn': 1983, 'RandstadRail': 2006,
};
