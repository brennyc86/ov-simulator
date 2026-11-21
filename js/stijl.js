// Eigen kaartstijl op de OpenStreetMap-vectortegels van OpenFreeMap (OpenMapTiles-schema).
// Rustig "speelbord"-landschap: het OV-netwerk moet erbovenop opvallen.

export function kaartStijl(donker) {
  const k = donker ? {
    land: '#1c2522', bos: '#1f3328', gras: '#22302a', akker: '#202a24', stad: '#2a302e', industrie: '#2c2b2a', zand: '#36332a',
    water: '#12303b', waterlijn: '#1b4352', weg: '#3d4744', hoofdweg: '#5a5f52', snelweg: '#7a6a43', rand: '#141b19',
    gebouw: '#323a37', tekst: '#c9d3cf', halo: '#141b19', grens: '#4b5652',
  } : {
    land: '#eef1e6', bos: '#cfe0c1', gras: '#dfe9d2', akker: '#e9ecd9', stad: '#e6e2db', industrie: '#e2ddd6', zand: '#f1e8cf',
    water: '#a9d3e0', waterlijn: '#8ec3d4', weg: '#ffffff', hoofdweg: '#fdf3d7', snelweg: '#f6d58c', rand: '#c9ccc3',
    gebouw: '#dcd6cd', tekst: '#3b4744', halo: '#ffffff', grens: '#a7a29a',
  };
  const naam = ['coalesce', ['get', 'name:nl'], ['get', 'name']];
  const weg = (id, klassen, kleur, breed, minzoom = 0, rand = true) => {
    const filter = ['match', ['get', 'class'], klassen, true, false];
    const lagen = [];
    const w = ['interpolate', ['exponential', 1.6], ['zoom'], 6, breed[0], 10, breed[1], 14, breed[2], 18, breed[3]];
    if (rand) lagen.push({ id: id + '-rand', type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom, filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': k.rand, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 6, breed[0] + 0.6, 10, breed[1] + 1, 14, breed[2] + 1.6, 18, breed[3] + 2.5] } });
    lagen.push({ id, type: 'line', source: 'osm', 'source-layer': 'transportation', minzoom, filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': kleur, 'line-width': w } });
    return lagen;
  };
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      osm: { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenStreetMap-bijdragers, OpenFreeMap' },
    },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': k.land } },
      { id: 'akker', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['farmland'], true, false], paint: { 'fill-color': k.akker } },
      { id: 'gras', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['grass', 'wetland'], true, false], paint: { 'fill-color': k.gras } },
      { id: 'bos', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false], paint: { 'fill-color': k.bos } },
      { id: 'zand', type: 'fill', source: 'osm', 'source-layer': 'landcover', filter: ['match', ['get', 'class'], ['sand', 'beach'], true, false], paint: { 'fill-color': k.zand } },
      { id: 'park', type: 'fill', source: 'osm', 'source-layer': 'park', paint: { 'fill-color': k.gras, 'fill-opacity': 0.8 } },
      { id: 'stad', type: 'fill', source: 'osm', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail'], true, false], paint: { 'fill-color': k.stad } },
      { id: 'industrie', type: 'fill', source: 'osm', 'source-layer': 'landuse', filter: ['match', ['get', 'class'], ['industrial', 'railway', 'quarry'], true, false], paint: { 'fill-color': k.industrie } },
      { id: 'water', type: 'fill', source: 'osm', 'source-layer': 'water', paint: { 'fill-color': k.water } },
      { id: 'waterloop', type: 'line', source: 'osm', 'source-layer': 'waterway', minzoom: 9, paint: { 'line-color': k.waterlijn, 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 14, 2, 18, 6] } },
      { id: 'gebouw', type: 'fill', source: 'osm', 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': k.gebouw, 'fill-outline-color': k.rand } },
      { id: 'landingsbaan', type: 'line', source: 'osm', 'source-layer': 'aeroway', filter: ['==', ['get', 'class'], 'runway'], paint: { 'line-color': k.hoofdweg, 'line-width': ['interpolate', ['exponential', 1.7], ['zoom'], 9, 1, 13, 8, 17, 50] } },
      ...weg('weg-klein', ['minor', 'service', 'track'], k.weg, [0, 0.3, 2, 9], 12, false),
      ...weg('weg-secundair', ['secondary', 'tertiary'], k.weg, [0.2, 0.8, 3.5, 14], 8),
      ...weg('weg-hoofd', ['primary', 'trunk'], k.hoofdweg, [0.5, 1.4, 4.5, 18], 6),
      ...weg('weg-snel', ['motorway'], k.snelweg, [0.8, 1.8, 5, 20], 5),
      { id: 'grens', type: 'line', source: 'osm', 'source-layer': 'boundary', filter: ['==', ['get', 'admin_level'], 2], paint: { 'line-color': k.grens, 'line-width': 1.2, 'line-dasharray': [3, 2] } },
      { id: 'water-naam', type: 'symbol', source: 'osm', 'source-layer': 'water_name', minzoom: 8,
        layout: { 'text-field': naam, 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'symbol-placement': 'point' }, paint: { 'text-color': donker ? '#6aa8bd' : '#3f7f96', 'text-halo-color': k.halo, 'text-halo-width': 1 } },
      { id: 'plaats', type: 'symbol', source: 'osm', 'source-layer': 'place', filter: ['match', ['get', 'class'], ['city', 'town', 'village'], true, false],
        layout: { 'text-field': naam, 'text-font': ['Noto Sans Bold'], 'text-size': ['match', ['get', 'class'], 'city', 15, 'town', 12.5, 11], 'symbol-sort-key': ['get', 'rank'], 'text-padding': 4 },
        paint: { 'text-color': k.tekst, 'text-halo-color': k.halo, 'text-halo-width': 1.4, 'text-opacity': 0.75 } },
    ],
  };
}

// Kleuren voor het OV-netwerk bovenop de kaart
export function netKleuren(donker) {
  return donker
    ? { spoor: '#d7dfdb', zij: '#5d6b66', tram: '#ef7a62', metro: '#6aa8ff', snel: '#4fc3c9', oud: '#b68a5c', smal: '#a08a6a', veer: '#4fb3d9', halo: '#141b19' }
    : { spoor: '#2a3431', zij: '#9aa39e', tram: '#c2412d', metro: '#1f6fd1', snel: '#0f7c8a', oud: '#8a5a2b', smal: '#6b5b45', veer: '#1f8fb8', halo: '#ffffff' };
}
