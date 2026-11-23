// Eén vast kaartthema ("speelbord"): groen land, donkergroen bos, blauw water, geel zand/strand,
// rood bebouwd gebied. Wegen worden in echte meters getekend (rijstroken, stoepen), zodat dezelfde
// maten later ook voor een 3D-weergave bruikbaar zijn.

export const THEMA = {
  land: '#9ccc6f', gras: '#a6d277', akker: '#97c76a', bos: '#4f8f45', moeras: '#86bf86',
  water: '#3f97d6', waterlijn: '#3a8ccb', zand: '#f0d36b', strand: '#f5dd84',
  bebouwd: '#d9705f', industrie: '#c9655a', gebouw: '#a94a3f', gebouwRand: '#8a3a31',
  asfalt: { S: '#585d63', H: '#666b70', R: '#72767b', L: '#7e8287', D: '#8a8d91', B: '#a5523f', O: '#c9a866', F: '#b9483b' },
  rand: '#3f4448', stoep: '#cfc9bd', stoepRand: '#a59f93', markering: '#ffffff', brug: '#2f3336',
  tekst: '#1f2b24', halo: '#ffffff', grens: '#3b2c50', waterTekst: '#0f4f80',
};

// pixels per meter op zoom z (breedtegraad ~52,2°, 512-pixeltegels)
const PPM = z => 2 ** z * 512 / (40075016.686 * Math.cos(52.2 * Math.PI / 180));

// lijndikte in pixels voor een breedte in meters (mag een expressie zijn), met een minimum in pixels
export function meters(m, min = 0.5) {
  const stops = [];
  for (const z of [6, 10, 12, 14, 16, 18, 20, 22]) stops.push(z, ['max', min * (z < 12 ? 0.6 : 1), ['*', m, PPM(z)]]);
  return ['interpolate', ['exponential', 2], ['zoom'], ...stops];
}
// verschuiving in pixels voor meters (geen minimum)
export function metersVast(m) {
  return ['interpolate', ['exponential', 2], ['zoom'], 10, ['*', m, PPM(10)], 22, ['*', m, PPM(22)]];
}

// standaardbreedte (m) van wegen uit de vectortegels, voor waar nog geen eigen wegendata is
const TEGELBREEDTE = ['match', ['get', 'class'], 'motorway', 11, 'trunk', 9, 'primary', 8, 'secondary', 7, 'tertiary', 6.5, 'minor', 5.5, 'service', 3.5, 'track', 3, 'busway', 6, 5];
const TEGELKLEUR = ['case', ['==', ['get', 'surface'], 'unpaved'], THEMA.asfalt.O,
  ['match', ['get', 'class'], 'motorway', THEMA.asfalt.S, ['trunk', 'primary'], THEMA.asfalt.H, ['secondary', 'tertiary'], THEMA.asfalt.R, 'busway', THEMA.asfalt.B, 'track', THEMA.asfalt.O, THEMA.asfalt.L]];
export const TEGELWEGLAGEN = ['tegelweg-rand', 'tegelweg'];

export function kaartStijl() {
  const k = THEMA;
  const naam = ['coalesce', ['get', 'name:nl'], ['get', 'name']];
  const lc = (id, klassen, kleur, extra = {}) => ({ id, type: 'fill', source: 'osm', 'source-layer': 'landcover',
    filter: ['match', ['get', 'class'], klassen, true, false], paint: { 'fill-color': kleur, 'fill-antialias': false, ...extra } });
  const tegelFilter = ['all', ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'busway'], true, false],
    ['!=', ['get', 'brunnel'], 'tunnel']];
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap-bijdragers, OpenFreeMap' },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': k.land } },
      lc('akker', ['farmland'], k.akker),
      lc('gras', ['grass'], k.gras),
      lc('moeras', ['wetland'], k.moeras),
      lc('bos', ['wood', 'forest'], k.bos),
      { id: 'zand', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['sand', 'beach'], true, false],
        paint: { 'fill-color': ['match', ['get', 'subclass'], 'beach', k.strand, k.zand], 'fill-antialias': false } },
      { id: 'park', type: 'fill', source: 'osm', 'source-layer': 'park', paint: { 'fill-color': k.gras } },
      { id: 'bebouwd', type: 'fill', source: 'osm', 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'school', 'hospital', 'university', 'college', 'kindergarten', 'religious', 'garages'], true, false],
        // functie van de bebouwing: wonen, winkels, voorzieningen (scholen, ziekenhuizen, kerken)
        paint: { 'fill-color': ['match', ['get', 'class'], ['commercial', 'retail'], k.winkels || '#e0a04a', ['school', 'hospital', 'university', 'college', 'kindergarten', 'religious'], k.voorzieningen || '#8e9ccc', k.bebouwd], 'fill-antialias': false } },
      { id: 'industrie', type: 'fill', source: 'osm', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['industrial', 'railway', 'quarry', 'military'], true, false],
        paint: { 'fill-color': k.industrie, 'fill-antialias': false } },
      { id: 'zand-landuse', type: 'fill', source: 'osm', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['beach', 'sand'], true, false], paint: { 'fill-color': k.strand } },
      { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': k.water } },
      { id: 'waterloop', type: 'line', source: 'osm', 'source-layer': 'waterway', minzoom: 9,
        paint: { 'line-color': k.waterlijn, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 9, 0.5, 14, 2, 18, 8] } },
      // gebouwen met een schaduw naar rechtsonder: geeft al een idee van hoogte (later echt 3D via render_height)
      { id: 'gebouw-schaduw', type: 'fill', source: 'osm', 'source-layer': 'building', minzoom: 15,
        paint: { 'fill-color': 'rgba(60,25,20,0.35)', 'fill-translate': ['interpolate', ['exponential', 2], ['zoom'], 15, ['literal', [1, 1]], 19, ['literal', [8, 8]]], 'fill-antialias': false } },
      { id: 'gebouw', type: 'fill', source: 'osm', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': k.gebouw, 'fill-outline-color': k.gebouwRand } },
      { id: 'landingsbaan', type: 'line', source: 'osm', 'source-layer': 'aeroway', filter: ['==', ['get', 'class'], 'runway'],
        paint: { 'line-color': k.asfalt.S, 'line-width': meters(45, 1) } },
      { id: 'taxibaan', type: 'line', source: 'osm', 'source-layer': 'aeroway', minzoom: 12, filter: ['==', ['get', 'class'], 'taxiway'],
        paint: { 'line-color': k.asfalt.H, 'line-width': meters(18, 0.5) } },
      // wegen uit de vectortegels: op lage zoom overal, op hoge zoom alleen waar nog geen eigen wegendata is
      { id: 'tegelweg-rand', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom: 11, filter: tegelFilter,
        layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'layer'] }, paint: { 'line-color': k.rand, 'line-width': meters(['+', TEGELBREEDTE, 0.8], 0.8) } },
      { id: 'tegelweg', type: 'line', source: 'osm', 'source-layer': 'transportation', filter: ['all', tegelFilter, ['any', ['>=', ['zoom'], 11], ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false]]],
        layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'layer'] }, paint: { 'line-color': TEGELKLEUR, 'line-width': meters(TEGELBREEDTE, 0.6) } },
      { id: 'grens', type: 'line', source: 'osm', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 2], paint: { 'line-color': k.grens, 'line-opacity': 0.95, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2, 9, 3.5, 14, 5.5] } },
      { id: 'water-naam', type: 'symbol', source: 'osm', 'source-layer': 'water_name', minzoom: 8,
        layout: { 'text-field': naam, 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'symbol-placement': 'point' }, paint: { 'text-color': k.waterTekst, 'text-halo-color': k.halo, 'text-halo-width': 1 } },
      { id: 'plaats', type: 'symbol', source: 'osm', 'source-layer': 'place', filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
        layout: { 'text-field': naam, 'text-font': ['Noto Sans Bold'], 'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 12.5, 11], 'symbol-sort-key': ['get', 'rank'], 'text-padding': 4 },
        paint: { 'text-color': k.tekst, 'text-halo-color': k.halo, 'text-halo-width': 1.4, 'text-opacity': 0.85 } },
    ],
  };
}

// Lagen voor de eigen wegendata (bron 'wegen'), in echte breedtes: stoep, rand, asfalt, belijning.
export function wegLagen() {
  const k = THEMA;
  const B = ['*', ['get', 'b'], ['/', ['get', 'lb'], 10]];           // rijbaanbreedte in meters
  const tunnel = ['case', ['==', ['get', 'tun'], 1], 0.35, 1];
  const lay = { 'line-cap': 'butt', 'line-join': 'round', 'line-sort-key': ['get', 'laag'] };
  const lagen = [];
  const L = (id, filter, paint, minzoom = 0) => lagen.push({ id, type: 'line', source: 'wegen', minzoom, ...(filter ? { filter } : {}), layout: lay, paint: { 'line-opacity': tunnel, ...paint } });
  // stoepen: aan beide kanten één brede lijn, aan één kant een verschoven lijn
  L('weg-stoep', ['==', ['get', 'st'], 3], { 'line-color': k.stoep, 'line-width': meters(['+', B, 4.6], 0) }, 14);
  L('weg-stoep-l', ['==', ['get', 'st'], 1], { 'line-color': k.stoep, 'line-width': meters(2.3, 0), 'line-offset': metersVast(['*', -1, ['+', ['/', B, 2], 1.15]]) }, 14);
  L('weg-stoep-r', ['==', ['get', 'st'], 2], { 'line-color': k.stoep, 'line-width': meters(2.3, 0), 'line-offset': metersVast(['+', ['/', B, 2], 1.15]) }, 14);
  // rand (stoeprand/berm) en brugleuning
  L('weg-rand', ['!=', ['get', 's'], 'F'], { 'line-color': ['case', ['==', ['get', 'brug'], 1], k.brug, ['==', ['get', 's'], 'O'], '#9a7f45', k.rand],
    'line-width': meters(['+', B, ['case', ['==', ['get', 'brug'], 1], 1.6, 0.5]], 0.9) });
  L('weg-asfalt', null, { 'line-color': ['match', ['get', 's'], 'S', k.asfalt.S, 'H', k.asfalt.H, 'R', k.asfalt.R, 'D', k.asfalt.D, 'B', k.asfalt.B, 'O', k.asfalt.O, 'F', k.asfalt.F, k.asfalt.L],
    'line-width': meters(B, 0.6) });
  // belijning: strookscheiding gestreept, kantstrepen doorgetrokken (alleen op gemarkeerde wegen)
  const gemarkeerd = ['match', ['get', 's'], ['S', 'H', 'R', 'B'], true, false];
  for (let i = 1; i < 6; i++) {
    L(`weg-streep-${i}`, ['all', gemarkeerd, ['>', ['get', 'b'], i]],
      { 'line-color': k.markering, 'line-width': meters(0.15, 0.4), 'line-dasharray': [3, 6], 'line-offset': metersVast(['*', ['-', i, ['/', ['get', 'b'], 2]], ['/', ['get', 'lb'], 10]]) }, 15.5);
  }
  for (const kant of [-1, 1]) {
    L(`weg-kant-${kant < 0 ? 'l' : 'r'}`, ['match', ['get', 's'], ['S', 'H'], true, false],
      { 'line-color': k.markering, 'line-width': meters(0.2, 0.4), 'line-offset': metersVast(['*', kant, ['-', ['/', B, 2], 0.45]]) }, 15.5);
  }
  return lagen;
}

// Kleuren voor het OV-netwerk bovenop de kaart (één thema, ook in donkere modus)
export function netKleuren() {
  return { spoor: '#1d2624', zij: '#5d6763', tram: '#7a1fa2', metro: '#1f4fd1', snel: '#0b6e7a', oud: '#6b4423', smal: '#4f3f2a', veer: '#0d5f8f', halo: '#ffffff' };
}

// Ver ingezoomd: elk OSM-spoor (in Nederland is elk spoor apart ingetekend) als echt spoortje
// met ballastbed, dwarsliggers en twee staven (normaalspoor 1435 mm). Tram ligt in de straat.
// ondergronds spoor (tunnel) licht en half doorzichtig; op elke uitkomst van een zoom-interpolatie toegepast
export const TUNNEL = (v, f = 0.3) => ['*', v, ['case', ['==', ['coalesce', ['get', 'h'], 0], -1], f, 1]];
const metTunnel = (expr, f) => expr.map((x, i) => i >= 4 && i % 2 === 0 ? TUNNEL(x, f) : x);
export const SPOOR_UIT = metTunnel(['interpolate', ['linear'], ['zoom'], 14.6, 1, 15.6, 0], 0.35);
export function spoorLagen() {
  const in_ = metTunnel(['interpolate', ['linear'], ['zoom'], 14.6, 0, 15.4, 1], 0.18);
  const geenTram = ['!=', ['get', 'k'], 'tram'];
  const lay = { 'line-cap': 'butt', 'line-join': 'round' };
  const L = (id, filter, paint) => ({ id, type: 'line', source: 'spoor', minzoom: 14.6, filter, layout: lay, paint: { 'line-opacity': in_, ...paint } });
  const staaf = kant => L(`spoor-staaf-${kant < 0 ? 'l' : 'r'}`, ['!=', ['get', 'k'], 'oud'], {
    'line-color': ['match', ['get', 'k'], 'tram', '#55595e', '#3b3f44'],
    'line-width': meters(0.16, 0.7),
    'line-offset': metersVast(['match', ['get', 'k'], 'smal', kant * 0.5, kant * 0.7175]),
  });
  return [
    L('spoor-ballast', geenTram, { 'line-color': ['match', ['get', 'k'], 'oud', '#b1a78f', '#9a9184'], 'line-width': meters(['match', ['get', 'k'], 'smal', 2.8, 4], 0) }),
    L('spoor-trambed', ['==', ['get', 'k'], 'tram'], { 'line-color': '#9b9a94', 'line-width': meters(2.4, 0) }),
    L('spoor-dwars', ['all', geenTram, ['!=', ['get', 'k'], 'oud']], {
      'line-color': ['match', ['get', 'k'], ['zij', 'smal'], '#6e5340', '#b8b2a7'],
      'line-width': meters(['match', ['get', 'k'], 'smal', 1.8, 2.6], 0), 'line-dasharray': [0.1, 0.14],
    }),
    staaf(-1), staaf(1),
    // viaduct/brug: de randen van de bak langs het spoor
    { id: 'spoor-viaduct', type: 'line', source: 'spoor', minzoom: 12, filter: ['==', ['coalesce', ['get', 'h'], 0], 1], layout: lay,
      paint: { 'line-color': '#4a4f52', 'line-width': meters(0.45, 0.9), 'line-gap-width': meters(['match', ['get', 'k'], ['h2', 'h3', 'metro', 'snel'], 9, 5.5], 3.2) } },
  ];
}
