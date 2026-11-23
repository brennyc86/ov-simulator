// Grenzen en territorium.
// Gemeente-, provincie- en landsgrenzen, steeds duidelijker. Hoe actiever je ergens bent, hoe kleurrijker de kaart.
//  Vier gradaties:
//  - levendig: de gemeenten waar je haltes hebt (al bij één halte), extra verzadigd
//  - kleur: de provincies waarin je haltes hebt (gewone kaartkleuren)
//  - licht: de rest van een land waarin je haltes hebt
//  - grijs: landen waar je nog niet bent (en heel Nederland zolang je nog geen haltes hebt)
//  Dit geldt per land; nu is er alleen Nederland (provincies zonder land-code horen bij NL).
import { rdNaarWgs } from './geo.js';

const merc = (x, y) => { const [la, lo] = rdNaarWgs(x, y), f = la * Math.PI / 180; return [(lo + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + f / 2)) / Math.PI) / 2]; };

function gebied(code, naam, rruwe) {
  const rd = [], mc = []; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rruwe) {
    const p = new Float64Array(r.length), m = new Float64Array(r.length);
    let x = 0, y = 0;
    for (let i = 0; i < r.length; i += 2) {
      x = i ? x + r[i] : r[0]; y = i ? y + r[i + 1] : r[1];
      p[i] = x; p[i + 1] = y; const q = merc(x, y); m[i] = q[0]; m[i + 1] = q[1];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    rd.push(p); mc.push(m);
  }
  return { code, naam, rd, mc, bbox: [x0, y0, x1, y1] };
}
function binnen(g, x, y) {
  const [x0, y0, x1, y1] = g.bbox; if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  let n = 0;
  for (const p of g.rd) for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) n++;
  }
  return n % 2 === 1;
}

export class Territorium {
  constructor(kaart) {
    this.kaart = kaart; this.prov = []; this.gem = []; this.kleur = []; this.licht = []; this.levendig = []; this.sleutel = null; this.actief = false; this.heeftHaltes = false;
    const m = kaart.map;
    if (!m?.getCanvasContainer) { this.cv = null; return; } // testkaart zonder canvas
    this.cv = document.createElement('canvas');
    this.cv.className = 'territorium';
    this.cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;display:none';
    m.getCanvasContainer().insertBefore(this.cv, m.getCanvas().nextSibling);
    this.ctx = this.cv.getContext('2d');
    m.on('render', () => this.teken());
  }
  async laad(url = 'data/grenzen.json') {
    try {
      const r = await fetch(url); if (!r.ok) return false;
      const d = await r.json();
      this.prov = d.p.map(([c, n, ...rr]) => ({ ...gebied(c, n, rr), land: d.land?.[c] || 'NL' }));
      this.gem = d.g.map(([c, n, p, ...rr]) => ({ ...gebied(c, n, rr), p }));
      this.lagen();
      return true;
    } catch (e) { console.warn('grenzen', e); return false; }
  }
  // grenslijnen: gemeente dun en gestippeld, provincie steviger; het land zelf zit in de kaartstijl ('grens')
  lagen() {
    const k = this.kaart, ll = g => g.rd.map(p => { const c = []; for (let i = 0; i < p.length; i += 2) { const [la, lo] = rdNaarWgs(p[i], p[i + 1]); c.push([+lo.toFixed(5), +la.toFixed(5)]); } return c; });
    const fs = [...this.gem.map(g => ({ type: 'Feature', properties: { n: 1 }, geometry: { type: 'MultiLineString', coordinates: ll(g) } })),
      ...this.prov.map(g => ({ type: 'Feature', properties: { n: 2 }, geometry: { type: 'MultiLineString', coordinates: ll(g) } }))];
    k.bron('grenzen', { type: 'FeatureCollection', features: fs });
    const voor = k.map.getLayer('grens') ? 'grens' : undefined;
    k.laag({ id: 'grens-gemeente', type: 'line', source: 'grenzen', minzoom: 8, filter: ['==', ['get', 'n'], 1], layout: { 'line-join': 'round' },
      paint: { 'line-color': '#7d7590', 'line-opacity': 0.7, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1, 15, 1.6], 'line-dasharray': [4, 3] } }, voor);
    k.laag({ id: 'grens-provincie', type: 'line', source: 'grenzen', filter: ['==', ['get', 'n'], 2], layout: { 'line-join': 'round' },
      paint: { 'line-color': '#5e4a7a', 'line-opacity': 0.85, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 10, 2, 14, 3.2] } }, voor);
  }
  provincieVan(x, y) { const g = this.gemeenteVan(x, y); return g < 0 ? -1 : this.gem[g].p; }
  gemeenteVan(x, y) { for (let i = 0; i < this.gem.length; i++) if (binnen(this.gem[i], x, y)) return i; return -1; }

  // haltes: [{x, y}, ...] (RD). Bepaalt welke gebieden in kleur, lichter of zwart-wit staan.
  zetHaltes(haltes) {
    if (!this.gem.length) return;
    const cel = new Set(); for (const h of haltes) if (h && isFinite(h.x)) cel.add(Math.round(h.x / 250) + ',' + Math.round(h.y / 250));
    const sleutel = [...cel].sort().join(';'); if (sleutel === this.sleutel) return; this.sleutel = sleutel;
    const actief = new Set(), cache = new Map();
    for (const c of cel) { const [i, j] = c.split(',').map(Number); if (!cache.has(c)) cache.set(c, this.gemeenteVan(i * 250, j * 250)); const g = cache.get(c); if (g >= 0) actief.add(g); }
    this.actief = true; this.heeftHaltes = actief.size > 0; // zonder haltes: heel Nederland zwart-wit
    const perProv = new Map(); for (const g of actief) { const p = this.gem[g].p; perProv.set(p, (perProv.get(p) || 0) + 1); }
    const kleur = [], licht = [], actiefLand = new Set([...perProv.keys()].map(pi => this.prov[pi]?.land));
    this.prov.forEach((p, pi) => { if (perProv.has(pi)) kleur.push(p); else if (actiefLand.has(p.land)) licht.push(p); });
    this.kleur = kleur; this.licht = licht; this.levendig = [...actief].map(i => this.gem[i]);
    this.kaart.map.triggerRepaint?.();
  }
  uitleg() {
    if (!this.heeftHaltes) return 'Nog geen territorium: plaats haltes of start een lijn.';
    return `Territorium: ${this.kleur.map(g => g.naam).join(', ')}`;
  }

  // na elke kaartteken-beurt: kopie van de kaart in grijs over de gebieden buiten je territorium
  teken() {
    if (!this.cv) return;
    const m = this.kaart.map, bron = m.getCanvas(), cv = this.cv, ctx = this.ctx;
    if (!this.actief || this.uit) { if (cv.style.display !== 'none') cv.style.display = 'none'; return; }
    if (cv.width !== bron.width || cv.height !== bron.height) { cv.width = bron.width; cv.height = bron.height; }
    cv.style.display = '';
    const W = bron.clientWidth || bron.width, s = bron.width / (W || 1), H = bron.height / s;
    const ws = 512 * 2 ** m.getZoom(), c = m.getCenter(), cm = (() => { const f = c.lat * Math.PI / 180; return [(c.lng + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + f / 2)) / Math.PI) / 2]; })();
    const pad = gebieden => { ctx.beginPath(); for (const g of gebieden) for (const r of g.mc) { for (let i = 0; i < r.length; i += 2) { const x = ((r[i] - cm[0]) * ws + W / 2) * s, y = ((r[i + 1] - cm[1]) * ws + H / 2) * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); } };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'copy'; ctx.filter = 'grayscale(1)';
    ctx.drawImage(bron, 0, 0);
    ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, cv.width, cv.height); // zwart-wit iets lichter, zodat het rustig blijft
    // territorium en de stap erbuiten uit het grijs knippen
    ctx.globalCompositeOperation = 'destination-out';
    pad([...this.kleur, ...this.licht]); ctx.fill('evenodd');
    ctx.globalCompositeOperation = 'source-over';
    // de stap erbuiten: kleur, maar lichter
    if (this.licht.length) { pad(this.licht); ctx.fillStyle = 'rgba(255,255,255,0.42)'; ctx.fill('evenodd'); }
    // gemeenten waar je echt haltes hebt: extra levendig (verzadigder en iets meer contrast)
    if (this.levendig?.length) {
      ctx.save(); pad(this.levendig); ctx.clip('evenodd');
      ctx.filter = 'saturate(1.8) contrast(1.08) brightness(1.03)'; ctx.drawImage(bron, 0, 0); ctx.filter = 'none';
      ctx.restore();
    }
  }
}
