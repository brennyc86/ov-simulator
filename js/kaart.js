// Kaartmotor op MapLibre (vectorkaart in eigen stijl). Het spel rekent intern in RD-meters;
// deze klasse vertaalt RD <-> scherm, zodat de rest van de code niets van de projectie merkt.
// Daarbovenop ligt één canvas voor bewegende voertuigen en bouwgereedschap.
import { rdNaarWgs, wgsNaarRd, ACHTERGRONDEN, kaartjaarVoor } from './geo.js';
import { kaartStijl } from './stijl.js';

const OMTREK = 40075016.686;

export class Kaart {
  constructor(houder, { donker = false } = {}) {
    this.houder = houder;
    const mapDiv = document.createElement('div');
    mapDiv.className = 'kaartlaag';
    houder.appendChild(mapDiv);
    this.boven = document.createElement('canvas');
    this.boven.className = 'kaartlaag bovenlaag';
    houder.appendChild(this.boven);
    this.cb = this.boven.getContext('2d');
    this.donker = donker;
    this.achtergrond = 'eigen'; this.jaar = 2026;
    this.lagenBoven = [];
    this.bijKlik = null; this.bijBeweeg = null; this.bijKlaar = null; this.bijBeweging = null;
    this.map = new maplibregl.Map({
      container: mapDiv, style: kaartStijl(donker), center: [5.17, 52.24], zoom: 10.3, minZoom: 5, maxZoom: 19,
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, touchPitch: false,
    });
    this.map.touchZoomRotate.disableRotation();
    this.map.on('load', () => { this.klaar = true; this.bijKlaar?.(); });
    this.map.on('click', e => this.bijKlik?.(e.point.x, e.point.y, e));
    this.map.on('mousemove', e => this.bijBeweeg?.(e.point.x, e.point.y));
    this.map.on('moveend', () => { this.bijBeweging?.(); if (this.achtergrond === 'historisch') this.historischeTegels(); });
    this.maat();
    addEventListener('resize', () => this.maat());
  }
  maat() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    const r = this.houder.getBoundingClientRect();
    this.W = r.width; this.H = r.height;
    this.boven.width = this.W * this.dpr; this.boven.height = this.H * this.dpr;
  }
  // meter per schermpixel (rond het midden)
  get res() {
    const c = this.map.getCenter();
    return OMTREK * Math.cos(c.lat * Math.PI / 180) / (512 * 2 ** this.map.getZoom());
  }
  get cx() { const c = this.map.getCenter(); return wgsNaarRd(c.lat, c.lng)[0]; }
  get cy() { const c = this.map.getCenter(); return wgsNaarRd(c.lat, c.lng)[1]; }
  punt(x, y) { const [la, lo] = rdNaarWgs(x, y); return this.map.project([lo, la]); }
  sx(x, y) { return this.punt(x, y ?? this._y ?? 463000).x; }
  sy(y, x) { return this.punt(x ?? this._x ?? 155000, y).y; }
  scherm(x, y) { const p = this.punt(x, y); return [p.x, p.y]; }
  wereld(px, py) { const l = this.map.unproject([px, py]); return wgsNaarRd(l.lat, l.lng); }
  wx(px, py = this.H / 2) { return this.wereld(px, py)[0]; }
  wy(py, px = this.W / 2) { return this.wereld(px, py)[1]; }
  zicht(marge = 0) {
    const h = [[-marge, -marge], [this.W + marge, -marge], [-marge, this.H + marge], [this.W + marge, this.H + marge]].map(([a, b]) => this.wereld(a, b));
    return [Math.min(...h.map(p => p[0])), Math.min(...h.map(p => p[1])), Math.max(...h.map(p => p[0])), Math.max(...h.map(p => p[1]))];
  }
  vliegNaar(x, y, res) {
    const [la, lo] = rdNaarWgs(x, y);
    const opties = { center: [lo, la], duration: 600 };
    if (res) opties.zoom = Math.log2(OMTREK * Math.cos(la * Math.PI / 180) / (512 * res));
    this.map.easeTo(opties);
  }
  schermTransform(ctx) { ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  // GeoJSON-bron toevoegen of bijwerken
  bron(id, data) {
    const s = this.map.getSource(id);
    if (s) s.setData(data); else this.map.addSource(id, { type: 'geojson', data });
  }
  laag(def, voor) { if (!this.map.getLayer(def.id)) this.map.addLayer(def, voor); }

  zetAchtergrond(soort) {
    this.achtergrond = soort;
    const m = this.map;
    for (const id of ['pdok-raster', 'pdok-raster-laag']) if (m.getLayer(id)) m.removeLayer(id);
    if (m.getSource('pdok-raster')) m.removeSource('pdok-raster');
    this.wisHistorisch();
    const eersteNet = m.getStyle().layers.find(l => l.id.startsWith('net-'))?.id;
    if (soort === 'luchtfoto' || soort === 'pdok') {
      const url = soort === 'luchtfoto'
        ? 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg'
        : 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png';
      m.addSource('pdok-raster', { type: 'raster', tiles: [url], tileSize: 256, maxzoom: 19, attribution: soort === 'luchtfoto' ? '© Beeldmateriaal Nederland / PDOK' : '© Kadaster / PDOK' });
      m.addLayer({ id: 'pdok-raster-laag', type: 'raster', source: 'pdok-raster' }, eersteNet);
    }
    if (soort === 'historisch') this.historischeTegels();
  }
  // De Kadaster-tijdreiskaart bestaat alleen in RD; elke RD-tegel wordt als losse afbeelding op zijn vier hoeken gelegd.
  wisHistorisch() {
    for (const id of this.histIds || []) { if (this.map.getLayer(id)) this.map.removeLayer(id); if (this.map.getSource(id)) this.map.removeSource(id); }
    this.histIds = [];
  }
  historischeTegels() {
    const s = ACHTERGRONDEN.historisch, jaar = kaartjaarVoor(this.jaar);
    const doel = this.res * 1.3;
    let z = 0;
    for (let i = 0; i < s.res.length; i++) if (s.res[i] >= doel) z = i;
    const tr = s.res[z] * 256;
    const [x0, y0, x1, y1] = this.zicht(50);
    const i0 = Math.floor((x0 - s.ox) / tr), i1 = Math.floor((x1 - s.ox) / tr);
    const j0 = Math.floor((s.oy - y1) / tr), j1 = Math.floor((s.oy - y0) / tr);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 64) return;
    const nodig = new Set();
    const eersteNet = this.map.getStyle().layers.find(l => l.id.startsWith('net-'))?.id;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const id = `hist-${jaar}-${z}-${i}-${j}`;
      nodig.add(id);
      if (this.map.getSource(id)) continue;
      const wx = s.ox + i * tr, wy = s.oy - j * tr;
      const hoek = (x, y) => { const [la, lo] = rdNaarWgs(x, y); return [lo, la]; };
      this.map.addSource(id, { type: 'image', url: s.url(z, i, j, jaar), coordinates: [hoek(wx, wy), hoek(wx + tr, wy), hoek(wx + tr, wy - tr), hoek(wx, wy - tr)] });
      this.map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-fade-duration': 0 } }, eersteNet);
      this.histIds.push(id);
    }
    for (const id of [...this.histIds]) if (!nodig.has(id)) { this.map.removeLayer(id); this.map.removeSource(id); this.histIds.splice(this.histIds.indexOf(id), 1); }
  }

  render() {
    const cb = this.cb;
    this.schermTransform(cb);
    cb.clearRect(0, 0, this.W, this.H);
    for (const laag of this.lagenBoven) { cb.save(); laag(cb, this); cb.restore(); }
  }
}
