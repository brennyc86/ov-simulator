// Coördinaten (Rijksdriehoek <-> WGS84) en tegelschema's van de achtergrondkaarten.

const K = [[0,1,3235.65389],[2,0,-32.58297],[0,2,-0.24750],[2,1,-0.84978],[0,3,-0.06550],[2,2,-0.01709],[1,0,-0.00738],[4,0,0.00530],[2,3,-0.00039],[4,1,0.00033],[1,1,-0.00012]];
const L = [[1,0,5260.52916],[1,1,105.94684],[1,2,2.45656],[3,0,-0.81885],[1,3,0.05594],[3,1,-0.05607],[0,1,0.01199],[3,2,-0.00256],[1,4,0.00128],[0,2,0.00022],[2,0,-0.00022],[5,0,0.00026]];
const R = [[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-0.705],[3,1,-2.340],[1,3,-0.608],[0,2,-0.008],[2,3,0.148]];
const S = [[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,0.433],[2,2,-6.439],[1,1,-0.032],[0,4,0.092],[1,4,-0.054]];

function rdNaarWgsReeks(x, y) {
  const dx = (x - 155000) * 1e-5, dy = (y - 463000) * 1e-5;
  let lat = 52.15517440, lon = 5.38720621;
  for (const [p, q, k] of K) lat += k * dx ** p * dy ** q / 3600;
  for (const [p, q, l] of L) lon += l * dx ** p * dy ** q / 3600;
  return [lat, lon];
}
// De reeks is gemaakt voor Nederland; verder weg (Duitsland, Frankrijk) wijkt hij tientallen meters af.
// Daar een paar Newton-stappen met de heenweg, zodat heen en terug weer precies op elkaar passen.
export function rdNaarWgs(x, y) {
  let [lat, lon] = rdNaarWgsReeks(x, y);
  if (Math.abs(x - 155000) < 180000 && Math.abs(y - 463000) < 220000) return [lat, lon];
  for (let i = 0; i < 3; i++) {
    const [fx, fy] = wgsNaarRd(lat, lon), e = 1e-4;
    const [ax, ay] = wgsNaarRd(lat + e, lon), [bx, by] = wgsNaarRd(lat, lon + e);
    const j11 = (ax - fx) / e, j21 = (ay - fy) / e, j12 = (bx - fx) / e, j22 = (by - fy) / e, d = j11 * j22 - j12 * j21;
    const rx = x - fx, ry = y - fy;
    lat += (j22 * rx - j12 * ry) / d; lon += (j11 * ry - j21 * rx) / d;
    if (Math.abs(rx) + Math.abs(ry) < 0.01) break;
  }
  return [lat, lon];
}
export function wgsNaarRd(lat, lon) {
  const dp = 0.36 * (lat - 52.15517440), dl = 0.36 * (lon - 5.38720621);
  let x = 155000, y = 463000;
  for (const [p, q, r] of R) x += r * dp ** p * dl ** q;
  for (const [p, q, s] of S) y += s * dp ** p * dl ** q;
  return [x, y];
}

// PDOK en de Kadaster-tijdreiskaart gebruiken allebei RD, maar met een eigen tegelschema.
const pdokRes = Array.from({ length: 15 }, (_, z) => 3440.640 / 2 ** z);
const kadasterRes = [3251.206502413005, 1625.6032512065026, 812.8016256032513, 406.40081280162565, 203.20040640081282,
  101.60020320040641, 50.800101600203206, 25.400050800101603, 12.700025400050801, 6.350012700025401, 3.1750063500127004, 1.5875031750063502];

export const ACHTERGRONDEN = {
  grijs: { naam: 'Kaart (grijs)', ox: -285401.92, oy: 903401.92, res: pdokRes,
    url: (z, x, y) => `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:28992/${z}/${x}/${y}.png`,
    bron: '© Kadaster / PDOK BRT-Achtergrondkaart' },
  standaard: { naam: 'Kaart (kleur)', ox: -285401.92, oy: 903401.92, res: pdokRes,
    url: (z, x, y) => `https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:28992/${z}/${x}/${y}.png`,
    bron: '© Kadaster / PDOK BRT-Achtergrondkaart' },
  luchtfoto: { naam: 'Luchtfoto', ox: -285401.92, oy: 903401.92, res: pdokRes,
    url: (z, x, y) => `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:28992/${z}/${x}/${y}.jpeg`,
    bron: '© Beeldmateriaal Nederland / PDOK' },
  historisch: { naam: 'Historische kaart', ox: -30515500.0, oy: 31112399.999999993, res: kadasterRes,
    url: (z, x, y, jaar) => `https://tiles.arcgis.com/tiles/nSZVuSZjHpEZZbRo/arcgis/rest/services/Historische_tijdreis_${jaar}/MapServer/tile/${z}/${y}/${x}`,
    bron: '© Kadaster / Esri Nederland, Topotijdreis' },
  geen: { naam: 'Alleen netwerk', res: [] },
};

// Jaren waarvoor de tijdreiskaart bestaat (wordt overschreven met data/historie.json als die er is)
export let KAARTJAREN = [1815,1850,1865,1880,1900,1910,1920,1930,1940,1950,1960,1970,1980,1990,2000,2010,2015];
export function zetKaartjaren(j) { if (Array.isArray(j) && j.length) KAARTJAREN = j; }
// het dichtstbijzijnde kaartjaar (een paar jaar eerder of later stoort minder dan een kaart uit een heel ander tijdperk)
export function kaartjaarVoor(jaar) {
  let beste = KAARTJAREN[0];
  for (const j of KAARTJAREN) if (Math.abs(j - jaar) < Math.abs(beste - jaar) || (Math.abs(j - jaar) === Math.abs(beste - jaar) && j < beste)) beste = j;
  return beste;
}

export const afstand = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
