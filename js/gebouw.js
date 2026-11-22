// Stationsgebouwen: vroeger nodig voor het loket (zonder gebouw geen kaartverkoop, dus minder reizigers),
// later vooral winkels en uitstraling. Stijlen per tijdperk, in drie groottes. Plattegrond als eenvoudige vorm
// in de richting van het spoor.
export const STIJLEN = [
  { id: 'ss', naam: 'Standaardstation (SS-type)', van: 1860, tot: 1940, kleur: '#9c4a2f', vorm: 'blok' },
  { id: 'hsm', naam: 'Standaardstation (HSM-type)', van: 1865, tot: 1935, kleur: '#b0623a', vorm: 'blok' },
  { id: 'monumentaal', naam: 'Monumentaal (Amsterdam Centraal-achtig)', van: 1880, tot: 2100, kleur: '#8a3b2a', vorm: 'torens', min: 'middel', extra: 0.04 },
  { id: 'jugendstil', naam: 'Jugendstil (Haarlem-achtig)', van: 1900, tot: 2100, kleur: '#a9714b', vorm: 'hal', min: 'middel', extra: 0.03 },
  { id: 'zakelijk', naam: 'Nieuwe Zakelijkheid (Naarden-Bussum-achtig)', van: 1925, tot: 2100, kleur: '#c9b98f', vorm: 'blok', extra: 0.01 },
  { id: 'wederopbouw', naam: 'Wederopbouw (jaren \'50)', van: 1948, tot: 2100, kleur: '#b8a88a', vorm: 'blok' },
  { id: 'jaren80', naam: 'Jaren \'80 (Sloterdijk, Duivendrecht, Almere, Zaandam-achtig)', van: 1978, tot: 2100, kleur: '#d7d2c4', vorm: 'hal' },
  { id: 'jaren90', naam: 'Jaren \'90 (Hilversum-achtig)', van: 1989, tot: 2100, kleur: '#c7c9cc', vorm: 'blok' },
  { id: 'modern', naam: 'Modern (Arnhem-achtig)', van: 2010, tot: 2100, kleur: '#e6e8ea', vorm: 'golf', extra: 0.02 },
];
// afmetingen (m), bouwsom, onderhoud en winkelhuur per maand, reizigersbonus
export const GROOTTE = {
  klein:  { naam: 'klein (wachtruimte en loket)', l: 18, b: 10, prijs: 0.8e6, onderhoud: 1500, huur: 0, bonus: 0.02 },
  middel: { naam: 'middel (loket, wachtkamer, kiosk)', l: 40, b: 16, prijs: 3e6, onderhoud: 5000, huur: 3000, bonus: 0.05 },
  groot:  { naam: 'groot (stationshal met winkels)', l: 90, b: 26, prijs: 12e6, onderhoud: 16000, huur: 14000, bonus: 0.08 },
};
export const stijlenVoor = jaar => STIJLEN.filter(s => s.van <= jaar && s.tot >= jaar);
export const gebouwPrijs = (stijl, grootte) => Math.round(GROOTTE[grootte].prijs * (stijl.vorm === 'torens' ? 1.8 : stijl.vorm === 'hal' ? 1.3 : stijl.vorm === 'golf' ? 1.5 : 1) / 1e5) * 1e5;
// winkels leveren pas echt wat op na de jaren '80; vroeger alleen een kiosk
export const winkelHuur = (grootte, jaar) => GROOTTE[grootte].huur * (jaar >= 1985 ? 1 : 0.3);

// plattegrond: veelhoeken [x,y,...] rond (x,y), lange zijde langs richting (ux,uy)
export function plattegrond(stijl, grootte, x, y, ux, uy) {
  const g = GROOTTE[grootte], nx = -uy, ny = ux;
  const rh = (cl, cb, l, b) => { const v = []; for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]]) v.push(x + ux * (cl + a * l / 2) + nx * (cb + c * b / 2), y + uy * (cl + a * l / 2) + ny * (cb + c * b / 2)); return v; };
  const uit = [rh(0, 0, g.l, g.b)];
  if (stijl.vorm === 'torens') { const t = Math.max(6, g.b * 0.45); uit.push(rh(-g.l * 0.3, -g.b / 2 - t * 0.3, t, t), rh(g.l * 0.3, -g.b / 2 - t * 0.3, t, t)); }
  if (stijl.vorm === 'hal') uit.push(rh(0, g.b * 0.75, g.l * 0.7, g.b * 0.6)); // overkapping/hal aan de sporenkant
  if (stijl.vorm === 'golf') uit.push(rh(g.l * 0.35, g.b * 0.6, g.l * 0.5, g.b * 0.9), rh(-g.l * 0.35, g.b * 0.6, g.l * 0.4, g.b * 0.7));
  return uit.map(v => v.map(q => Math.round(q * 10) / 10));
}
