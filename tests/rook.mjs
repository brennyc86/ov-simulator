// Rooktest: draait het hele spel in Node met linkedom en een nep-MapLibre.
// Gebruik (vanuit de repo-root, met data/ uitgepakt van de data-tak):
//   node tests/rook.mjs [jaar] [vervoerder-id]
//   bv. node tests/rook.mjs 2026 gtfs:IFF:NS   |   node tests/rook.mjs 1925
import fs from 'fs';
import { parseHTML } from 'linkedom';
const jaarIn = process.argv[2] || '2026', wilVervoerder = process.argv[3];
const { window, document } = parseHTML(fs.readFileSync('index.html', 'utf8'));
const fouten = [], noop = () => {};
const t0 = Date.now(), log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const ctxStub = new Proxy({}, { get: (t, k) => k in t ? t[k] : (k === 'measureText' ? () => ({ width: 10 }) : /create.*Gradient|createPattern/.test(k) ? () => ({ addColorStop: noop }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop), set: (t, k, v) => (t[k] = v, true) });
window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 1200, height: 800, left: 0, top: 0 });
window.HTMLElement.prototype.setPointerCapture = noop;
// linkedom: <select>.value werkt niet; nabootsen via het selected-attribuut
Object.defineProperty((window.HTMLSelectElement || window.HTMLElement).prototype, 'value', { configurable: true,
  get() { if (this.tagName !== 'SELECT') return this.getAttribute('value') ?? ''; const o = this.querySelector('option[selected]') || this.querySelector('option'); return o ? (o.getAttribute('value') ?? o.textContent) : ''; },
  set(v) { if (this.tagName !== 'SELECT') return this.setAttribute('value', v); for (const o of this.querySelectorAll('option')) o.toggleAttribute('selected', (o.getAttribute('value') ?? o.textContent) === String(v)); } });
Object.assign(window.HTMLElement.prototype, {
  showModal() { this.open = true; this.setAttribute('open', ''); }, close() { this.open = false; this.removeAttribute('open'); } });

// nep-MapLibre: web-mercator met 512-pixeltegels, 1200x800 beeld
const W = 1200, H = 800;
class FakeMap {
  constructor(o) { globalThis.__map = this; this.c = { lng: o.center[0], lat: o.center[1] }; this.z = o.zoom; this.h = {}; this.src = {}; this.lagen = [];
    this.touchZoomRotate = { disableRotation: noop }; setTimeout(() => this.vuur('load'), 20); }
  on(e, f) { (this.h[e] ||= []).push(f); } off() {} once(e, f) { this.on(e, f); }
  vuur(e, a = {}) { for (const f of this.h[e] || []) try { f(a); } catch (x) { fouten.push(`map.${e}: ${x.stack}`); } }
  wm(lng, lat) { const s = 512 * 2 ** this.z; const y = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)); return [(lng + 180) / 360 * s, (1 - y / Math.PI) / 2 * s]; }
  project(ll) { const [lng, lat] = Array.isArray(ll) ? ll : [ll.lng, ll.lat]; const [x, y] = this.wm(lng, lat), [cx, cy] = this.wm(this.c.lng, this.c.lat); return { x: x - cx + W / 2, y: y - cy + H / 2 }; }
  unproject([px, py]) { const s = 512 * 2 ** this.z, [cx, cy] = this.wm(this.c.lng, this.c.lat); const x = cx + px - W / 2, y = cy + py - H / 2;
    return { lng: x / s * 360 - 180, lat: (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * y / s))) - Math.PI / 2) * 180 / Math.PI }; }
  getCenter() { return this.c; } getZoom() { return this.z; } getBounds() { const a = this.unproject([0, H]), b = this.unproject([W, 0]); return { getWest: () => a.lng, getSouth: () => a.lat, getEast: () => b.lng, getNorth: () => b.lat }; }
  easeTo(o) { if (o.center) this.c = { lng: o.center[0], lat: o.center[1] }; if (o.zoom != null) this.z = o.zoom; setTimeout(() => this.vuur('moveend'), 1); }
  jumpTo(o) { this.easeTo(o); } flyTo(o) { this.easeTo(o); }
  getSource(id) { return this.src[id]; } addSource(id, s) { if (this.src[id]) throw new Error('bron bestaat al: ' + id); this.src[id] = { ...s, setData(d) { this.data = d; }, setCoordinates: noop }; }
  removeSource(id) { delete this.src[id]; }
  getLayer(id) { return this.lagen.find(l => l.id === id); }
  addLayer(l, voor) { if (this.getLayer(l.id)) throw new Error('laag bestaat al: ' + l.id); if (l.source && typeof l.source === 'string' && !this.src[l.source] && !/^(omt|openmaptiles|pdok|bag)/.test(l.source)) fouten.push('laag zonder bron: ' + l.id + ' -> ' + l.source); this.lagen.push(l); }
  removeLayer(id) { this.lagen = this.lagen.filter(l => l.id !== id); }
  getStyle() { return { layers: this.lagen }; } getFilter(id) { return this.getLayer(id)?.filter; } getLayoutProperty() {} getPaintProperty() {} setFilter() {} setLayoutProperty() {} setPaintProperty() {} setStyle() {} resize() {}
  queryRenderedFeatures() { return []; } triggerRepaint() {} getCanvas() { return document.createElement('canvas'); }
}
Object.assign(globalThis, { window, document, HTMLElement: window.HTMLElement, getComputedStyle: () => ({ getPropertyValue: () => '#eee' }),
  maplibregl: { Map: FakeMap, addProtocol: noop, NavigationControl: class {}, ScaleControl: class {} },
  Path2D: class { moveTo() {} lineTo() {} rect() {} arc() {} closePath() {} bezierCurveTo() {} quadraticCurveTo() {} arcTo() {} ellipse() {} addPath() {} }, Image: class { set src(v) { setTimeout(() => this.onerror?.(), 1); } },
  devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener: noop, removeEventListener: noop,
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); }, removeItem(k) { delete this._d[k]; }, key(i) { return Object.keys(this._d)[i]; }, get length() { return Object.keys(this._d).length; } },
 });
let frame = 0, rafAan = true;
globalThis.requestAnimationFrame = f => { if (rafAan) setTimeout(() => { try { f(performance.now()); } catch (e) { fouten.push('frame: ' + e.stack); } frame++; }, 15); };
globalThis.fetch = async (p) => { if (/^https?:/.test(p)) throw new Error('offline'); p = p.split('?')[0]; const ok = fs.existsSync(p);
  return { ok, status: ok ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')), text: async () => fs.readFileSync(p, 'utf8') }; };
const origWarn = console.warn; console.warn = (...a) => { if (!/offline|firebase/i.test(String(a[0]))) origWarn(...a); };
process.on('unhandledRejection', e => { const s = String(e?.stack || e); if (!/offline|gstatic|ERR_UNSUPPORTED/.test(s)) fouten.push('rejection: ' + s); });
const wacht = ms => new Promise(r => setTimeout(r, ms));
const tot = async (f, ms = 120000) => { const e = Date.now() + ms; while (Date.now() < e) { if (f()) return true; await wacht(100); } return false; };

await import('../js/main.js');
const j = document.getElementById('s-jaar');
// data laden kan op een drukke machine lang duren: blijf het jaar zetten tot er vervoerders verschijnen
const geladen = await tot(() => { j.value = jaarIn; j.oninput?.(); return document.querySelectorAll('input[name="vervoerder"]').length > 0; }, +(process.env.WACHT || 400000));
log(geladen ? 'data geladen' : 'FOUT: na het wachten nog geen vervoerders');
document.querySelector('#s-soort [data-v="bestaand"]').click();
await wacht(200);
const r = [...document.querySelectorAll('input[name="vervoerder"]')];
log('vervoerders', jaarIn, r.length, r.slice(0, 8).map(x => x.value).join(' '));
const kies = r.find(x => x.value === wilVervoerder) || r.find(x => /NS$|:NS|^SS|HSM/.test(x.value)) || r[0];
if (!kies) { console.log('FOUT: geen vervoerders\n' + fouten.slice(0, 5).join('\n---\n')); process.exit(1); }
r.forEach(x => { x.checked = false; x.removeAttribute('checked'); }); kies.checked = true; kies.setAttribute('checked', ''); // linkedom: :checked kijkt naar het attribuut
await document.getElementById('s-start').onclick();
await tot(() => !document.getElementById('start').open, 60000);
log('gestart als', kies.value, '→', document.getElementById('b-naam').textContent, document.getElementById('b-geld').textContent);
for (const p of ['lijnen', 'vloot', 'controle', 'geld', 'kaart', 'verzoeken']) {
  document.querySelector(`[data-paneel="${p}"]`).click();
  const h = document.getElementById('paneel-inhoud').innerHTML;
  log('paneel', p, h.length, 'tekens');
  document.querySelector(`[data-paneel="${p}"]`).click();
}
for (const t of ['lijn', 'halte', 'station', 'perron', 'spoor', 'kijk']) document.querySelector(`[data-tool="${t}"]`).click();
// inzoomen op Hilversum, AI-lijnen laten laden, tijd naar spits
globalThis.__map.easeTo({ center: [5.1815, 52.2257], zoom: +(process.env.ZOOM || 12.5) });
// klok een uur vooruit (spits), dan normaal tempo
const snel = [...document.querySelectorAll('.snelheid [data-s]')].sort((a, b) => b.dataset.s - a.dataset.s)[0];
snel?.click(); const k0 = document.getElementById('b-klok').textContent;
await tot(() => { const [h, m] = document.getElementById('b-klok').textContent.split(':').map(Number); return h * 60 + m >= 7 * 60 + 15; }, 120000);
document.querySelector('.snelheid [data-s="1"]')?.click();
log('klok', k0, '→', document.getElementById('b-klok').textContent);
await wacht(2500);
const f0 = frame; await tot(() => frame > f0 + 30, 120000);
const zl = globalThis.__ovTest?.zichtLijnen || [];
log('kaart', JSON.stringify(globalThis.__map.c), 'zoom', globalThis.__map.z.toFixed(1), zl.slice(0, 3).map(v => `${v.lijn?.naam} @${v.px|0},${v.py|0}`).join(' ; '));
log('status in beeld', JSON.stringify(zl.reduce((a, v) => (a[v.wacht || 'rijdt'] = (a[v.wacht || 'rijdt'] || 0) + 1, a), {})));
log('frames', frame, 'voertuigen in beeld:', zl.length, [...new Set(zl.map(v => v.lijn?.naam || v.lijn?.id))].slice(0, 6).join(' | '));
{ const sp = globalThis.__ovTest.spel, tm = sp.tijd; const S = await import('../js/spel.js'); const vt = [];
  for (const l of sp.lijnen) if (l.actief) S.voertuigenOp(l, tm, vt);
  log('eigen lijnen', sp.lijnen.length, 'actief', sp.lijnen.filter(l => l.actief).length, 'rijdend nu', vt.length, 'met rijbanen', sp.lijnen.filter(l => l._banen).length,
    'voorbeeld', vt.slice(0, 2).map(v => `${v.lijn.naam} ${Math.round(v.x)},${Math.round(v.y)}`).join(' ; ')); }
if (process.env.DETAIL) { const sp = globalThis.__ovTest.spel;
  const per = {}; for (const l of sp.lijnen) { const n = l.vertrek[0].length + l.vertrek[1].length; per[l.modus] = (per[l.modus] || 0) + n; }
  console.log('vertrekken per modus per dag', JSON.stringify(per), 'duur(min) voorbeeld', sp.lijnen.slice(0, 5).map(l => `${l.naam}: ${Math.round(l.duur / 60)}min ${l.vertrek[0].slice(0, 4).map(v => (v / 60 | 0) + ':' + String(Math.round(v % 60)).padStart(2, 0)).join(',')}`).join(' | '));
  console.log('soorten', JSON.stringify(sp.lijnen.reduce((a, l) => (a[l.modus] = (a[l.modus] || 0) + 1, a), {})), 'tijd', sp.tijd); }
if (process.env.VRAAG) { const S = await import('../js/spel.js'); const sp = globalThis.__ovTest.spel; let tot = 0; const r = [];
  for (const l of sp.lijnen) { const v = S.vraagLijn(l, globalThis.__ovTest.plaatsen, 0); tot += v.perDag; r.push([Math.round(v.perDag), l.naam, l.vertrek[0].length + l.vertrek[1].length]); }
  r.sort((a, b) => b[0] - a[0]); console.log('vraag per dag totaal eigen lijnen', Math.round(tot), 'lijnen', sp.lijnen.length, JSON.stringify(r.slice(0, 8))); }
// omlopen: elk voertuig bestaat op elk moment van de dag precies één keer
{ const O = await import('../js/omloop.js'); let groepen = 0, voertuigen = 0, fout = 0; const st = {};
  for (const [g, c] of globalThis.__ovTest.omlopen) { groepen++; voertuigen += c.om.voertuigen.length;
    for (let tm = 240; tm < 1740; tm += 23) { const uit = O.voertuigenOmloop(c.om, tm, [], null, () => 20);
      if (uit.length !== c.om.voertuigen.length) { if (fout++ < 3) fouten.push(`omloop ${g} om ${tm}: ${uit.length} van ${c.om.voertuigen.length} voertuigen`); }
      if (tm === 470) for (const u of uit) st[u.wacht || 'rijdt'] = (st[u.wacht || 'rijdt'] || 0) + 1; } }
  if (process.env.DETAIL) for (const [g, c] of [...globalThis.__ovTest.omlopen].slice(0, 12)) { const V = c.om.voertuigen;
    console.log(g, c.lijnen[0].naam, c.lijnen[0].modus, 'lijnen', c.lijnen.length, 'ritten', c.om.ritten, 'voertuigen', V.length, 'eerste ritten:', V.slice(0, 6).map(v => v.ritten.length + 'x@' + Math.round(v.ritten[0].dep) + ' ' + v.ritten[0].van.naam + '>' + v.ritten[0].naar.naam).join(' | '),
      'eindes:', [...new Set(c.lijnen.map(l => l.haltes[0].naam + '>' + l.haltes[l.haltes.length - 1].naam))].slice(0, 4).join(', ')); }
  if (process.env.DETAIL) for (const [g, c] of [...globalThis.__ovTest.omlopen].slice(0, 3)) { const h = {}; for (const v of c.om.voertuigen) { const u = Math.floor(v.ritten[0].dep / 60); h[u] = (h[u] || 0) + 1; }
    console.log('eerste rit per uur', g, JSON.stringify(h)); const laat = c.om.voertuigen.filter(v => v.ritten[0].dep > 600).slice(0, 4);
    for (const v of laat) console.log('  laat', v.ritten.map(x => `${Math.round(x.dep)}-${Math.round(x.arr)} ${x.van.naam}>${x.naar.naam}`).join(' ; ').slice(0, 300)); }
  log('omlopen', groepen, 'groepen,', voertuigen, 'voertuigen; om 07:50:', JSON.stringify(st), fout ? `; ${fout} keer een voertuig kwijt` : '; nooit een voertuig kwijt'); }
// eigen lijnpaneel: trajecten en geld
{ const sp = globalThis.__ovTest.spel; const l = sp.lijnen.find(x => x.actief && x.modus === "trein" && x.haltes.length > 6) || sp.lijnen.find(x => x.actief); if (l) {
  document.querySelector('[data-paneel="lijnen"]').click(); document.querySelector(`[data-actie="toon-lijn"][data-id="${l.id}"]`)?.click(); await wacht(200);
  const t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
  log('eigen lijnpaneel', l.naam, '|', t.slice(t.indexOf('Drukte en'), t.indexOf('Drukte en') + 260), '|', t.slice(t.indexOf('Deze maand'), t.indexOf('Deze maand') + 200)); } }
// nieuwe lijn bouwen: trein Amersfoort Centraal -> Amsterdam Centraal, met 'overal stoppen'
if (process.env.BOUW !== '0') { const G = await import('../js/geo.js'); const sp = globalThis.__ovTest.spel;
  const st = n => globalThis.__ovTest.stations.find(s => s.n === n);
  const a = st('Amersfoort Centraal') || st('Amersfoort'), b = st('Amsterdam Centraal');
  if (a && b) {
    globalThis.__map.easeTo({ center: [5.15, 52.3], zoom: 9.5 }); await wacht(200);
    document.querySelector('[data-tool="lijn"]').click(); [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Trein').click();
    for (const s2 of [a, b]) { const [la, lo] = G.rdNaarWgs(s2.x, s2.y); const p = globalThis.__map.project([lo, la]); globalThis.__map.vuur('click', { point: p }); await wacht(50); }
    await [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Klaar').onclick(); await wacht(300);
    let t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
    log('nieuwe lijn:', t.slice(0, 260));
    const vink = document.querySelector('[data-wijzig="nl-overal"]');
    if (vink) { vink.checked = !vink.checked; vink.dispatchEvent(new window.Event('change')); await wacht(100); t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' '); log('na vinkje:', t.slice(t.indexOf('Stoppen op'), t.indexOf('Stoppen op') + 400)); }
    const n0 = sp.lijnen.length; document.querySelector('[data-actie="lijn-maak"]')?.click(); await wacht(200);
    const nl = sp.lijnen[sp.lijnen.length - 1]; log('lijn gemaakt:', sp.lijnen.length > n0, nl?.naam, nl?.haltes.length, 'haltes', Math.round(nl?.duur / 60), 'min');
    if (nl) { const S = await import('../js/spel.js'); const voor = nl.tr[0].map(x => Math.round(x / 60));
      nl.aankomstWens = { '0:3': nl.trMin[0][3] + 300 }; nl.halteWacht = { '0:2': 2 }; S.herbereken(nl);
      log('rijtijden heen (min) voor:', voor.join(','), '| na +5 min aankomst halte 3 en 2 min wachten halte 2:', nl.tr[0].map(x => Math.round(x / 60)).join(','));
      log('vroegst per halte:', nl.trMin[0].map(x => Math.round(x / 60)).join(','), '| haltes', nl.haltes.map(h => h.naam).join(' > ')); }
  } else log('stations niet gevonden voor bouwtest'); }
// heen en terug op eigen spoor? (lijnen die twee richtingen rijden)
{ const gezien = new Set();
  for (const l of [...zl.map(v => v.lijn), ...globalThis.__ovTest.spel.lijnen]) { if (gezien.has(l) || !l._banen) continue; gezien.add(l);
    const [h, t] = l._banen, ds = [];
    let rechts = 0, n2 = 0; const H = h.route.pts, T = t.route.pts;
    for (let i = 2; i < H.length - 2; i += 40) { let bd = 1e9, bk = 0; for (let k = 0; k < T.length; k += 2) { const d = Math.hypot(T[k] - H[i], T[k + 1] - H[i + 1]); if (d < bd) { bd = d; bk = k; } } ds.push(bd);
      if (bd > 2 && bd < 15) { const ux = H[i + 2] - H[i - 2], uy = H[i + 3] - H[i - 1]; n2++; if ((T[bk] - H[i]) * -uy + (T[bk + 1] - H[i + 1]) * ux > 0) rechts++; } } // terug links van heen = beide rechts
    ds.sort((a, b) => a - b);
    log('rijbanen', l.naam, 'afstand heen-terug mediaan', ds[ds.length >> 1].toFixed(1), 'm; deel >2 m:', (ds.filter(d => d > 2).length / ds.length).toFixed(2), '; rechts rijden waar dubbelspoor:', (rechts / (n2 || 1)).toFixed(2));
  }
  log('lijnen met eigen rijbaan per richting:', gezien.size); }
if (zl.length) {
  if (process.env.DETAIL) for (const v of zl.slice(0, 2)) { const l = v.lijn; console.log(JSON.stringify({ naam: l.naam, modus: l.modus, spoor: l._spoor, n: l.route.pts.length / 2, lengte: Math.round(l.route.lengte), bbox: l.bbox, haltes: l.haltes.map(h => [h.naam, Math.round(h.x), Math.round(h.y)]), km: l.km?.map(Math.round), pos: [Math.round(v.x), Math.round(v.y)], vertrek: v.vertrek, r: v.r })); }
  const v = zl.find(v => v.px > 0 && v.px < W && v.py > 0 && v.py < H) || zl[0];
  globalThis.__map.vuur('click', { point: { x: v.px, y: v.py } });
  await wacht(200);
  const t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
  log('ritpaneel:', t.slice(0, 220));
  for (const b of document.querySelectorAll('#paneel-inhoud button')) { try { b.click(); } catch (e) { fouten.push('knop ' + b.textContent + ': ' + e.stack); } await wacht(20); }
  { const t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' '); log('reizigers:', t.slice(t.indexOf('Reizigers'), t.indexOf('Reizigers') + 330)); }
  // ook een trein bekijken (eigen of ander), als die in beeld is
  const trein = zl.find(x => x.lijn.modus === 'trein' && !x.wacht);
  if (trein) { globalThis.__map.vuur('click', { point: { x: trein.px, y: trein.py } }); await wacht(150);
    const t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' '); log('trein', trein.lijn.naam, '→', t.slice(t.indexOf('Halteaan'), t.indexOf('Halteaan') + 420), '…', t.slice(t.indexOf('Reizigers'), t.indexOf('Reizigers') + 330)); }
  globalThis.__map.vuur('click', { point: { x: v.px, y: v.py } }); await wacht(100);
  log('alle knoppen in ritpaneel geklikt');
  globalThis.__map.vuur('click', { point: { x: v.px, y: v.py } }); await wacht(100);
  document.querySelector('[data-actie="volg"]')?.click(); await wacht(1500);
  log('volgen: kaart op', JSON.stringify(globalThis.__map.c), 'voertuig', v.lijn.naam);
  document.querySelector('[data-actie="sel-lijn"]')?.click(); await wacht(300);
  log('lijnpaneel na Toon lijn:', document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ').slice(0, 160), '| selectie-lijnen op kaart:', globalThis.__map.src.selectie?.data?.features?.length, 'haltes:', globalThis.__map.src['selectie-haltes']?.data?.features?.length);
  const rij = document.querySelector('[data-actie="toon-voertuig"]'); log('voertuigen in lijnpaneel:', document.querySelectorAll('[data-actie="toon-voertuig"]').length);
  rij?.click(); await wacht(200); log('na klik op voertuig uit lijst:', document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ').slice(0, 140));
  globalThis.__map.vuur('dragstart'); await wacht(50);
}
document.querySelector('.snelheid [data-s="50"]')?.click();
await wacht(1500);
log('klok', document.getElementById('b-klok').textContent, 'geld', document.getElementById('b-geld').textContent);
rafAan = false;
console.log(fouten.length ? `FOUTEN (${fouten.length}):\n` + fouten.slice(0, 15).join('\n---\n') : 'GEEN FOUTEN');
process.exit(fouten.length ? 1 : 0);
