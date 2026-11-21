// Eigen wegendata (rijstroken, stoepen, verhard/onverhard) in vakken van 10 x 10 km, die pas
// geladen worden als je ver genoeg inzoomt. Daarbuiten tekent de kaart de wegen uit de vectortegels.
import { rdNaarWgs } from './geo.js';
import { wegLagen, TEGELWEGLAGEN } from './stijl.js';

const MINZOOM = 12.5;

export class Wegen {
  constructor(kaart, basis = 'data/wegen/') {
    this.kaart = kaart; this.basis = basis;
    this.vakken = new Map();   // "i_j" -> aantal wegen
    this.cache = new Map();    // "i_j" -> features
    this.bezig = new Set();
    this.toon = '';
    this.cel = 10000;
  }
  async start(voor) {
    const k = this.kaart;
    k.bron('wegen', { type: 'FeatureCollection', features: [] });
    k.map.on('moveend', () => this.bijwerken());
    for (const l of wegLagen()) k.laag({ ...l, minzoom: Math.max(l.minzoom || 0, MINZOOM - 0.5) }, voor);
    try {
      const r = await fetch(this.basis + 'index.json');
      if (r.ok) {
        const d = await r.json();
        this.cel = d.cel;
        for (const [i, j, n] of d.vakken) this.vakken.set(`${i}_${j}`, n);
      }
    } catch { /* geen eigen wegendata: alleen de tegelwegen */ }
    this.bijwerken();
  }
  zichtbareVakken() {
    const [x0, y0, x1, y1] = this.kaart.zicht(100), c = this.cel, uit = [];
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++)
      for (let j = Math.floor(y0 / c); j <= Math.floor(y1 / c); j++) uit.push(`${i}_${j}`);
    return uit;
  }
  bijwerken() {
    const k = this.kaart;
    if (!k.klaar) return;
    const zoom = k.map.getZoom();
    const vakken = zoom >= MINZOOM - 0.5 ? this.zichtbareVakken() : [];
    const gedekt = vakken.length > 0 && vakken.length <= 30 && vakken.every(v => this.vakken.has(v));
    // tegelwegen verbergen waar de eigen wegen het overnemen
    for (const id of TEGELWEGLAGEN) if (k.map.getLayer(id)) k.map.setLayoutProperty(id, 'visibility', gedekt && zoom >= MINZOOM ? 'none' : 'visible');
    if (vakken.length > 30) return;
    for (const v of vakken) if (this.vakken.get(v) && !this.cache.has(v) && !this.bezig.has(v)) this.laad(v);
    const klaar = vakken.filter(v => this.cache.has(v)).sort().join(',');
    if (klaar === this.toon) return;
    this.toon = klaar;
    const features = [];
    for (const v of vakken) if (this.cache.has(v)) features.push(...this.cache.get(v));
    k.bron('wegen', { type: 'FeatureCollection', features });
    // cache klein houden
    if (this.cache.size > 40) for (const v of [...this.cache.keys()]) { if (!vakken.includes(v)) this.cache.delete(v); if (this.cache.size <= 30) break; }
  }
  async laad(v) {
    this.bezig.add(v);
    try {
      const r = await fetch(`${this.basis}${v}.json`);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      this.cache.set(v, d.w.map(naarFeature));
    } catch { this.vakken.delete(v); }
    this.bezig.delete(v);
    this.bijwerken();
  }
}

function naarFeature(r) {
  const [s, b, lb, st, vlag] = r;
  const coords = [];
  let x = 0, y = 0;
  for (let i = 5; i < r.length; i += 2) {
    x += r[i]; y += r[i + 1];
    const [la, lo] = rdNaarWgs(x, y);
    coords.push([+lo.toFixed(7), +la.toFixed(7)]);
  }
  const brug = vlag & 2 ? 1 : 0, tun = vlag & 4 ? 1 : 0;
  return { type: 'Feature', properties: { s, b, lb, st, brug, tun, laag: brug ? 2 : tun ? -1 : ({ S: 1, H: 0.8, R: 0.6, B: 0.5, L: 0.4, D: 0.2, O: 0.1, F: 0.3 }[s] || 0) },
    geometry: { type: 'LineString', coordinates: coords } };
}
