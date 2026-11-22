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
globalThis.__map.easeTo({ center: process.env.CENTER ? JSON.parse(process.env.CENTER) : [5.1815, 52.2257], zoom: +(process.env.ZOOM || 12.5) });
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
{ const AIm = await import('../js/ai.js'); const L = AIm.AI.lijnen; log('trolleylijnen:', L.filter(l => l._trolley).map(l => l.nr).filter((x, i, a) => a.indexOf(x) === i).join(','), '| lijnen met tunnelstukken:', [...L, ...globalThis.__ovTest.spel.lijnen].filter(l => l._tunnel).map(l => l.nr + ' ' + (l._tunnel.length / 2) + 'x').slice(0, 8).join(', '), '| voertuigen trolley in beeld:', zl.filter(v => v.lijn._typ === 'trolley').length); }
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
if (process.env.JAARCHECK) { const net = globalThis.__ovTest.net, j = +process.env.JAARCHECK; const tel = {};
  for (const t of net.takken) { const x = t.pts[0], y = t.pts[1]; if (x < 131000 || x > 160000 || y < 474000 || y > 500000 || t.soort !== 0) continue;
    const k = (net.namen[t.naam] || '(naamloos)') + (net.bestaat(t, j) ? ' BESTAAT' : ' nog niet'); tel[k] = (tel[k] || 0) + 1;
    if (!net.namen[t.naam] && net.bestaat(t, j)) (tel._plek ||= []).push(Math.round(x / 1000) + ',' + Math.round(y / 1000) + (t.start ? '@' + t.start : '')); }
  if (tel._plek) tel._plek = [...new Set(tel._plek)].join(' ');
  console.log('spoor rond Almere/Weesp in', j, JSON.stringify(tel)); }
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
if (process.env.BOUW !== '0') { const G = await import('../js/geo.js'); const S0 = await import('../js/spel.js'); const sp = globalThis.__ovTest.spel;
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
    // eerst als bijzondere rit (museumtrein kopen), daarna dezelfde route nog eens als gewone lijn
    { const mus = await import('../js/bijzonder.js'); const mt = mus.museumTypen(sp.jaar).find(t => t.modus === 'trein');
      if (mt) sp.voertuigen[mt.id] = 1;
      const vb = document.querySelector('[data-wijzig="nl-bijzonder"]'); vb.checked = true; vb.dispatchEvent(new window.Event('change')); await wacht(100);
      const sel = document.getElementById('nb-type'); if (mt && sel) sel.value = mt.id;
      document.querySelector('[data-actie="bijzonder-maak"]')?.click(); await wacht(150);
      const bl = sp.lijnen.find(l => l.bijzonder); log('bijzondere rit:', bl ? `${bl.naam} op dag ${bl.bijzonder.dag}, ${bl.typeId}, actief ${bl.actief}, vertrek ${JSON.stringify(bl.vertrek)}` : 'NIET GEMAAKT', '|', document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ').match(/Bijzondere ritten.{0,200}/)?.[0]);
      if (bl) { log('verwachte eindstand:', mus.belangstelling(sp, { ...bl.bijzonder, haltes: bl.haltes, typeId: bl.typeId, modus: bl.modus, lengteKm: bl.lengteKm }, globalThis.__ovTest.plaatsen), 'van', (await import('../js/spel.js')).capaciteit(bl), 'plaatsen');
        // charter: aanvraag maken en accepteren via het overlegpaneel
        const c = mus.bedenkCharter(sp, globalThis.__ovTest.stations); c.historisch = true; sp.verzoeken.unshift(c);
        document.querySelector('[data-paneel="verzoeken"]').click(); await wacht(50); document.querySelector(`[data-actie="vz-ja"][data-id="${c.id}"]`)?.click(); await wacht(100);
        log('charter:', c.status, c.reden, '| bijzondere lijnen:', sp.lijnen.filter(l => l.bijzonder).length);
        // dagen doorspoelen tot na de rit: afrekenen
        const geld0 = sp.geld, d0 = sp.dag; for (let k = d0; k <= bl.bijzonder.dag; k++) { sp.tijd = 29 * 60; globalThis.__ovTest.dagVoorbij(); }
        log('na', sp.dag - d0, 'dagen: archief', JSON.stringify((sp.bijzonderArchief || []).slice(0, 2)), 'geld', Math.round(sp.geld - geld0));
        document.querySelector('[data-paneel="verzoeken"]').click(); }
      document.querySelector('[data-tool="lijn"]').click(); [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Trein').click();
      for (const s2 of [a, b]) { const [la, lo] = G.rdNaarWgs(s2.x, s2.y); const p = globalThis.__map.project([lo, la]); globalThis.__map.vuur('click', { point: p }); await wacht(50); }
      await [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Klaar').onclick(); await wacht(300); }
    const n0 = sp.lijnen.length; document.querySelector('[data-actie="lijn-maak"]')?.click(); await wacht(200);
    const nl = sp.lijnen[sp.lijnen.length - 1]; log('lijn gemaakt:', sp.lijnen.length > n0, nl?.naam, nl?.haltes.length, 'haltes', Math.round(nl?.duur / 60), 'min');
    if (nl) { const S = await import('../js/spel.js'); const voor = nl.tr[0].map(x => Math.round(x / 60));
      nl.aankomstWens = { '0:3': nl.trMin[0][3] + 300 }; nl.halteWacht = { '0:2': 2 }; S.herbereken(nl);
      log('rijtijden heen (min) voor:', voor.join(','), '| na +5 min aankomst halte 3 en 2 min wachten halte 2:', nl.tr[0].map(x => Math.round(x / 60)).join(','));
      log('vroegst per halte:', nl.trMin[0].map(x => Math.round(x / 60)).join(','), '| haltes', nl.haltes.map(h => h.naam).join(' > ')); }
    // station toevoegen aan een bestaande eigen lijn (Amersfoort – Amsterdam): Hilversum komt op de goede plek
    { const lijn = sp.lijnen.filter(x => x.modus === 'trein' && x.haltes.length === 2).at(-1), hv = st('Hilversum');
      if (lijn && hv) { document.querySelector('[data-paneel="lijnen"]').click(); document.querySelector(`[data-actie="toon-lijn"][data-id="${lijn.id}"]`)?.click(); await wacht(80);
        document.querySelector('[data-actie="halte-erbij"]')?.click(); await wacht(30);
        const [la9, lo9] = G.rdNaarWgs(hv.x, hv.y); globalThis.__map.easeTo({ center: [lo9, la9], zoom: 13 }); await wacht(40);
        globalThis.__map.vuur('click', { point: globalThis.__map.project([lo9, la9]) }); await wacht(300);
        log('na toevoegen Hilversum:', lijn.haltes.map(h => h.naam).join(' > '), Math.round(lijn.duur / 60), 'min');
        document.querySelector('[data-tool="kijk"]')?.click(); } }
    // richtingen: eenrichting Amersfoort -> Amsterdam met terugweg via Utrecht, en een rondlijn
    const u = st('Utrecht Centraal'); const klikSt = async s2 => { const [la, lo] = G.rdNaarWgs(s2.x, s2.y); globalThis.__map.vuur('click', { point: globalThis.__map.project([lo, la]) }); await wacht(50); };
    if (u) {
      document.querySelector('[data-tool="lijn"]').click(); [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Trein').click();
      await klikSt(a); await klikSt(b); await [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Klaar').onclick(); await wacht(300);
      const r = document.querySelector('[data-wijzig="nl-richting"][value="heen"]'); r.checked = true; r.dispatchEvent(new window.Event('change')); await wacht(100);
      log('terug-vinkje aanwezig:', !!document.getElementById('nl-terug')); document.getElementById('nl-terug').checked = true;
      document.querySelector('[data-actie="lijn-maak"]')?.click(); await wacht(200);
      const heen = sp.lijnen[sp.lijnen.length - 1];
      log('hint terugweg:', document.getElementById('hint').textContent.slice(0, 120));
      await klikSt(u); await klikSt(a); await [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Klaar').onclick(); await wacht(300);
      log('paneel terugweg:', document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ').slice(0, 200));
      document.querySelector('[data-actie="lijn-maak"]')?.click(); await wacht(200);
      const terug = sp.lijnen[sp.lijnen.length - 1];
      log('heen', heen.nr, heen.richting, heen.vertrek.map(x => x.length), 'paar', heen.paar === terug.id, '| terug', terug.nr, terug.haltes.map(h => h.naam).join(' > '), terug.vertrek.map(x => x.length), Math.round(terug.lengteKm), 'km');
      // rondlijn
      document.querySelector('[data-tool="lijn"]').click(); [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Trein').click();
      await klikSt(a); await klikSt(u); await klikSt(b); await klikSt(a); await wacht(400);
      log('rondlijn paneel:', document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ').slice(0, 220));
      document.querySelector('[data-actie="lijn-maak"]')?.click(); await wacht(200);
      const ring = sp.lijnen[sp.lijnen.length - 1];
      log('ring', ring.naam, ring.richting, ring.haltes.length, 'haltes', ring.vertrek.map(x => x.length), Math.round(ring.lengteKm), 'km, nodig', ring.nodig);
      // eenrichting zonder terugweg: voertuigen rijden leeg terug
      heen.paar = null; heen.actief = true; ring.actief = true; S0.herbereken(heen);
      const O = await import('../js/omloop.js'); const om = O.maakOmloop([heen]);
      log('eenrichting zonder terugweg:', heen.vertrek[0].length, 'ritten,', om.voertuigen.length, 'voertuigen, lege ritten', om.voertuigen.reduce((n, v) => n + v.ritten.filter(x => x.leeg).length, 0), ', nodig', heen.nodig);
      const omr = O.maakOmloop([ring]); log('ring:', ring.vertrek[0].length, 'ritten,', omr.voertuigen.length, 'voertuigen');
      const omp = O.maakOmloop([heen, terug].map(x => (x.actief = true, x)), true); heen.paar = terug.id; S0.herbereken(heen); log('heen + aparte terugweg:', omp.voertuigen.length, 'voertuigen, lege ritten', omp.voertuigen.reduce((n, v) => n + v.ritten.filter(x => x.leeg).length, 0));
    }
  } else log('stations niet gevonden voor bouwtest'); }
// aangeboden subsidies: aanbod, lijn bouwen via de knop, koppelen en eisen toetsen
{ const sp = globalThis.__ovTest.spel, tekst = () => document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
  log('aanbiedingen:', (sp.aanbiedingen || []).length, (sp.aanbiedingen || []).map(a => `${a.modus} ${a.a.naam}–${a.b.naam}`).join(' | '));
  document.querySelector('[data-paneel="verzoeken"]').click(); await wacht(30); log('overleg:', tekst().slice(0, 420));
  const a = sp.aanbiedingen.find(x => x.modus === 'trein');
  if (a) { document.querySelector(`[data-actie="aanbod-bouw"][data-sub="${a.id}"]`).click(); await wacht(400);
    log('nieuwe subsidielijn:', tekst().match(/Aanmelden voor de subsidie.{0,160}/)?.[0] || 'GEEN AANMELDVINKJE', '|', tekst().match(/Ruimte op het spoor.{0,60}/)?.[0]);
    const v = document.getElementById('nl-aanbod'); if (v) v.checked = true;
    document.querySelector('[data-actie="lijn-maak"]')?.click(); await wacht(200);
    const l = sp.lijnen.at(-1); log('lijn', l.nr, 'actief', l.actief, 'wacht', l.wacht, '| aanbod', JSON.stringify(l.aanbod), 'ok', l.aanbodOk, '| melding:', document.getElementById('meldingen')?.textContent?.slice(-200)); } }
// nieuw station met sporen en perrons (Weesp-achtig: 2 doorgaand + aan weerszijden een eiland)
{ const sp = globalThis.__ovTest.spel, tekst = () => document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
  const t = globalThis.__ovTest.net.takken.find(x => x.soort === 0 && x.dienst === 0 && x.lengte > 3000 && x.sporen >= 2);
  if (t) { const m = t.pts.length >> 1 & ~1; const G4 = await import('../js/geo.js'), [la, lo] = G4.rdNaarWgs(t.pts[m], t.pts[m + 1]); globalThis.__map.easeTo({ center: [lo, la], zoom: 16 }); await wacht(50);
    document.querySelector('[data-tool="station"]').click(); globalThis.__map.vuur('click', { point: { x: 600, y: 400 } }); await wacht(60);
    log('nieuw station:', tekst().slice(0, 300));
    const zs = document.querySelector('[data-wijzig="ns-sporen"]'); if (!zs) { log('geen stationspaneel (spoor bestaat niet in dit jaar)'); } else { zs.value = '6'; zs.dispatchEvent(new window.Event('change')); await wacht(40);
    const dg = document.querySelector('[data-wijzig="ns-doorgaand"]'); dg.checked = true; dg.dispatchEvent(new window.Event('change')); await wacht(40);
    log('weesp-variant:', tekst().match(/Doorsnede.{0,160}/)?.[0]);
    const h0 = sp.haltes.length, s0 = sp.spoor.length; document.querySelector('[data-actie="station-zelf"]').click(); await wacht(50);
    log('gebouwd: station', sp.haltes.length - h0, 'sporen', sp.spoor.length - s0, 'perrons', (sp.perronVormen || []).filter(v => v.station === sp.haltes.at(-1)?.naam).length, '| projecten', document.getElementById('b-bouw')?.textContent);
    sp.tijd += 125; globalThis.__ovTest.bouwOpleveren(); log('na 2 uur: station klaar', !!sp.haltes.at(-1)?.opgeleverd, 'sporen klaar', sp.spoor.slice(s0).every(x => x.klaar)); } }
  document.querySelector('[data-tool="kijk"]')?.click(); }
// nieuw station op het traject van een sprinter: daarna stopt die er; intercity's niet
{ const sp = globalThis.__ovTest.spel, AIx = globalThis.__ovTest.ai;
  const cand = [...sp.lijnen, ...AIx.lijnen].filter(a => a.modus === 'trein' && a.actief !== false && a.haltes.length >= 4 && /SPR|Sprinter/i.test(`${a.nr} ${a.naam}`));
  let gedaan = false;
  for (const a of cand.slice(0, 30)) {
    // midden tussen halte 1 en 2, op de route
    const pts = a.route.pts, h1 = a.haltes[1], h2 = a.haltes[2]; let bi = 0, bd = 1e9;
    for (let k = 0; k < pts.length; k += 2) { const d = Math.abs(Math.hypot(pts[k] - h1.x, pts[k + 1] - h1.y) - Math.hypot(pts[k] - h2.x, pts[k + 1] - h2.y)) + Math.hypot(pts[k] - (h1.x + h2.x) / 2, pts[k + 1] - (h1.y + h2.y) / 2) * 0.2; if (d < bd) { bd = d; bi = k; } }
    if (Math.hypot(h1.x - h2.x, h1.y - h2.y) < 2500) continue;
    const G5 = await import('../js/geo.js'), [la, lo] = G5.rdNaarWgs(pts[bi], pts[bi + 1]); globalThis.__map.easeTo({ center: [lo, la], zoom: 16 }); await wacht(40);
    document.querySelector('[data-tool="station"]').click(); globalThis.__map.vuur('click', { point: { x: 600, y: 400 } }); await wacht(50);
    const naamIn = document.getElementById('ns-naam'); if (!naamIn) continue; naamIn.value = 'Teststation Midden'; naamIn.dispatchEvent(new window.Event('change'));
    document.querySelector('[data-actie="station-zelf"]').click(); await wacht(40);
    const voor = a.haltes.length, ic = [...sp.lijnen, ...AIx.lijnen].filter(x => x.modus === 'trein' && !/SPR|Sprinter/i.test(`${x.nr} ${x.naam}`) && x.route?.pts && x.haltes.length >= 2);
    sp.tijd += 125; globalThis.__ovTest.bouwOpleveren();
    log('station op traject', a.nr, a.naam, ':', voor, '→', a.haltes.length, 'haltes; nu:', a.haltes.slice(0, 4).map(h => h.naam).join(' > '), '| intercity\'s met Teststation:', ic.filter(x => x.haltes.some(h => h.naam === 'Teststation Midden')).length, '| melding:', [...document.querySelectorAll('#meldingen *')].map(e => e.textContent).filter(t => /Teststation/.test(t)).slice(-1)[0]?.slice(0, 200));
    gedaan = true; break; }
  if (!gedaan) log('geen sprinter gevonden voor stationstest; kandidaten', cand.length, 'treinlijnen', AIx.lijnen.filter(a => a.modus === 'trein').length, AIx.lijnen.filter(a => a.modus === 'trein').slice(0, 5).map(a => a.nr + '/' + a.haltes.length).join(' '));
  document.querySelector('[data-tool="kijk"]')?.click(); }
// stationsgebouw plaatsen
{ const sp = globalThis.__ovTest.spel, st = globalThis.__ovTest.stations.find(x => x.n === 'Naarden-Bussum') || globalThis.__ovTest.stations.find(x => x.s === 'trein');
  const tekst = () => document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
  const G6 = await import('../js/geo.js'), [la, lo] = G6.rdNaarWgs(st.x + 40, st.y + 40); globalThis.__map.easeTo({ center: [lo, la], zoom: 16 }); await wacht(40);
  globalThis.__map.vuur('click', { point: globalThis.__map.project(G6.rdNaarWgs(st.x, st.y).reverse()) }); await wacht(60);
  document.querySelector('[data-actie="gebouw-kies"]')?.click(); await wacht(40);
  log('gebouwpaneel:', tekst().slice(0, 400));
  const r = [...document.querySelectorAll('[data-wijzig="gb-stijl"]')].at(-1); if (r) { r.checked = true; r.dispatchEvent(new window.Event('change')); await wacht(30); }
  document.querySelector('[data-actie="gebouw-plaats"]')?.click(); await wacht(30);
  globalThis.__map.vuur('click', { point: { x: 600, y: 400 } }); await wacht(60);
  document.querySelector('[data-actie="gebouw-draai"]')?.click(); await wacht(30);
  document.querySelector('[data-actie="gebouw-bouw"]')?.click(); await wacht(40);
  sp.tijd += 125; globalThis.__ovTest.bouwOpleveren();
  log('gebouw:', JSON.stringify((sp.gebouwen || []).map(g => [g.station, g.stijl, g.grootte, g.pts.length, g.opgeleverd])));
  // busstation
  globalThis.__map.vuur('click', { point: globalThis.__map.project(G6.rdNaarWgs(st.x, st.y).reverse()) }); await wacht(60);
  document.querySelector('[data-actie="bus-kies"]')?.click(); await wacht(30);
  for (const op of ['rij', 'zaagtand', 'hoekjes', 'naast']) { const r2 = document.querySelector(`[data-wijzig="bs-op"][value="${op}"]`); r2.checked = true; r2.dispatchEvent(new window.Event('change')); await wacht(20); }
  document.querySelector('[data-actie="bus-plaats"]')?.click(); await wacht(20); globalThis.__map.vuur('click', { point: { x: 640, y: 420 } }); await wacht(40);
  document.querySelector('[data-actie="bus-draai"][data-g="15"]')?.click(); await wacht(20);
  const h0 = sp.haltes.length; document.querySelector('[data-actie="bus-bouw"]')?.click(); await wacht(30);
  sp.tijd += 125; globalThis.__ovTest.bouwOpleveren();
  log('busstation:', sp.haltes.slice(h0).map(h => h.naam).join(', '), '| perrons', (sp.perronVormen || []).filter(v => v.bus).length); }
// lening afsluiten en aflossen
{ const sp = globalThis.__ovTest.spel; const g0 = sp.geld; document.querySelector('[data-paneel="geld"]').click(); await wacht(30);
  document.querySelector('[data-actie="lenen"][data-b="10000000"]')?.click(); await wacht(20);
  log('lening:', sp.lening, 'geld +', Math.round(sp.geld - g0), '|', document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ').match(/Geleend.{0,120}/)?.[0]);
  document.querySelector('[data-actie="aflossen"][data-b="5000000"]')?.click(); await wacht(20); log('na aflossen:', sp.lening); }
// perrons: vormen, eilandperron bouwen, voortgang, versneld bouwen; enkelspoor verdubbelen
{ const sp = globalThis.__ovTest.spel, st = globalThis.__ovTest.stations.find(x => x.n === 'Naarden-Bussum') || globalThis.__ovTest.stations.find(x => x.s === 'trein');
  const tekst = () => document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
  const G3 = await import('../js/geo.js'), [la, lo] = G3.rdNaarWgs(st.x, st.y); globalThis.__map.easeTo({ center: [lo, la], zoom: 16 }); await wacht(50);
  document.querySelector('[data-tool="perron"]')?.click(); globalThis.__map.vuur('click', { point: { x: 600, y: 400 } }); await wacht(80);
  log('perronvoorstel:', tekst().slice(0, 300));
  for (const v of ['eiland', 'kop', 'kop2', 'langs', 'kopLangs']) { const r = document.querySelector(`[data-wijzig="perron-vorm"][value="${v}"]`); if (!r) { log('vorm niet aangeboden:', v); continue; } r.checked = true; r.dispatchEvent(new window.Event('change')); await wacht(40); log('vorm', v, '→', tekst().match(/Kosten.{0,60}/)?.[0]); }
  const r = document.querySelector('[data-wijzig="perron-vorm"][value="eiland"]'); r.checked = true; r.dispatchEvent(new window.Event('change')); await wacht(40);
  const n0 = sp.spoor.length; document.querySelector('[data-actie="perron-bouw"]')?.click(); await wacht(50);
  log('gebouwd: sporen erbij', sp.spoor.length - n0, '| bouw-teller', document.getElementById('b-bouw')?.textContent);
  document.querySelector('[data-paneel="bouw"]').click(); await wacht(30); log('bouwpaneel:', tekst().slice(0, 300));
  document.querySelector('[data-actie="spoed"]')?.click(); await wacht(30); log('na versnellen:', tekst().match(/Klaar om.{0,80}/)?.[0]);
  // verdubbelen: een stuk enkelspoor zoeken
  const t = globalThis.__ovTest.net.takken.find(x => x.sporen === 1 && x.dienst === 0 && x.soort === 0 && x.lengte > 2000 && x.lengte < 6000 && !x.eind);
  if (t) { const m = t.pts.length >> 1 & ~1; const [la2, lo2] = G3.rdNaarWgs(t.pts[m], t.pts[m + 1]); globalThis.__map.easeTo({ center: [lo2, la2], zoom: 15 }); await wacht(50);
    document.querySelector('[data-tool="spoor"]').click(); [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Enkelspoor verdubbelen').click();
    globalThis.__map.vuur('click', { point: { x: 600, y: 400 } }); await wacht(60); log('verdubbelvoorstel:', tekst().slice(0, 260));
    document.querySelector('[data-actie="perron-bouw"]')?.click(); await wacht(40);
    const t0 = sp.tijd; sp.tijd += 130; globalThis.__ovTest.bouwOpleveren(); globalThis.__ovTest.hud();
    log('na 130 spelminuten: tak sporen', t.sporen, '| open projecten', document.getElementById('b-bouw')?.hidden ? 0 : document.getElementById('b-bouw')?.textContent); }
  else log('geen enkelspoor gevonden');
  document.querySelector('[data-tool="kijk"]')?.click(); }
// nieuwe bushalte: echte naam (halte uit de dienstregeling in de buurt, of straat uit de kaart)
{ const sp = globalThis.__ovTest.spel; globalThis.__map.querySourceFeatures = (src, o) => o.sourceLayer === 'transportation_name' ? [{ properties: { name: 'Stationsplein', class: 'minor' }, geometry: { type: 'LineString', coordinates: [[globalThis.__map.c.lng - 0.001, globalThis.__map.c.lat], [globalThis.__map.c.lng + 0.001, globalThis.__map.c.lat]] } }] : [];
  const G2 = await import('../js/geo.js'), [bla, blo] = G2.rdNaarWgs(153760, 462290);
  for (const [lng, lat] of [[5.3880, 52.1550], [5.4012, 52.1601], [blo, bla]]) { globalThis.__map.easeTo({ center: [lng, lat], zoom: 16 }); await wacht(50);
    document.querySelector('[data-tool="halte"]').click(); [...document.querySelectorAll('#hint button')].find(x => x.textContent === 'Bushalte').click();
    globalThis.__map.vuur('click', { point: { x: 600, y: 400 } }); await wacht(50); log('nieuwe bushalte:', sp.haltes.at(-1)?.naam); }
  delete globalThis.__map.querySourceFeatures; document.querySelector('[data-tool="kijk"]')?.click(); }
// interieur: nieuwe serie met premium (massagestoelen) en restauratie kopen, lijn erop zetten, catering en restauratie per lijn, verbouwen
{ const sp = globalThis.__ovTest.spel, l = sp.lijnen.filter(x => !x.bijzonder && x.modus === 'trein').at(-1);
  if (l) { const tekst = () => document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' ');
    const basis = (await import('../js/comfort.js')).basisId(l.typeId); sp.voertuigen[basis] = Math.max(4, sp.voertuigen[basis] || 0);
    document.querySelector('[data-paneel="vloot"]').click(); await wacht(50);
    document.querySelector(`[data-actie="serie-open"][data-type="${basis}"]`).click(); await wacht(50);
    log('serie-paneel:', tekst().slice(0, 160));
    const zet = async (sel, v, chk) => { const e = document.querySelector(sel); if (!e) { log('NIET GEVONDEN', sel); return; } if (chk) e.checked = true; else e.value = v; e.dispatchEvent(new window.Event('change')); await wacht(30); };
    document.querySelector('[data-actie="sw-splits"][data-w="0"]').click(); await wacht(30);
    await zet('[data-wijzig="sw"][data-w="0"][data-d="1"][data-veld="soort"]', 'rest');
    await zet('[data-wijzig="sw"][data-w="1"][data-d="0"][data-veld="klasse"]', 'P');
    await zet('[data-wijzig="sw"][data-w="1"][data-d="0"][data-veld="stoel"]', 'massage');
    if (document.querySelector('[data-wijzig="sw"][data-w="2"][data-d="0"][data-veld="klasse"]')) await zet('[data-wijzig="sw"][data-w="2"][data-d="0"][data-veld="klasse"]', '4');
    await zet('[data-wijzig="sv"][data-v="koffie"]', 0, true);
    log('ontwerp:', tekst().match(/Per voertuig:.{0,200}/)?.[0], '| naam', document.getElementById('sn-naam')?.value);
    document.querySelector('[data-actie="serie-koop"]').click(); await wacht(50);
    const serie = sp.series.at(-1); log('gekocht:', serie?.naam, sp.voertuigen[serie?.id], '| vloot heeft rij:', (document.querySelector('[data-paneel="vloot"]').click(), await wacht(30), tekst().includes(serie?.naam)));
    // verbouwen: 2 standaard naar de nieuwe serie
    document.querySelector(`[data-actie="serie-open"][data-type="${serie.id}"]`).click(); await wacht(30);
    const vs = document.querySelector('[data-wijzig="sn-van"]'); vs.value = basis; vs.dispatchEvent(new window.Event('change')); await wacht(30);
    document.getElementById('sn-n').value = 2; document.querySelector('[data-actie="serie-verbouw"]')?.click(); await wacht(50);
    log('na verbouwen:', basis, sp.voertuigen[basis], serie.naam, sp.voertuigen[serie.id]);
    // samenstelling: loc + losse rijtuigen + stuurstand
    { const V = await import('../js/vloot.js'); const los = V.beschikbaarLos(sp.jaar); const loc = los.find(x => x.soort === 'loc'), rt = los.find(x => x.soort === 'rijtuig'), st = los.find(x => x.soort === 'stuurstand');
      if (loc && rt) { l._sam = [loc.id, rt.id, rt.id, rt.id, ...(st ? [st.id] : [])];
        document.querySelector('[data-paneel="lijnen"]').click(); document.querySelector(`[data-actie="toon-lijn"][data-id="${l.id}"]`)?.click(); await wacht(100);
        log('samenstelling ontwerp:', tekst().match(/Samenstelling.{0,400}/)?.[0]);
        document.querySelector('[data-actie="sam-toepassen"]')?.click(); await wacht(100);
        const T = V.TYPE[l.typeId]; log('lijn rijdt met', l.typeId, T?.vmax, 'km/u acc', T?.acc?.toFixed(2), 'keerExtra', T?.keerExtra, 'nodig', l.nodig, 'inzetbaar', (await import('../js/spel.js')).beschikbaarVoor(sp, l), 'duur', Math.round(l.duur / 60));
        document.querySelector('[data-actie="koop-nodig"]')?.click(); await wacht(50);
        log('na koop: inzetbaar', (await import('../js/spel.js')).beschikbaarVoor(sp, l), 'van', l.nodig, '| capaciteit', (await import('../js/spel.js')).capaciteit(l), '| uiterlijk bakken', (await import('../js/voertuig.js')).uiterlijk(l.typeId, 'trein').bakken.length);
        const O = await import('../js/omloop.js'); log('omloop samenstelling:', O.maakOmloop([l]).voertuigen.length, 'treinen'); } }
    // bezetting: hogere klasse mag lager zitten, niet andersom
    { const R = await import('../js/reizigers.js'); log('bezetting 2e vol:', JSON.stringify(R.bezettingKlassen(100, [{ klasse: '1', zit: 20, sta: 0, aandeel: 0.5 }, { klasse: '2', zit: 30, sta: 10, aandeel: 0.5 }]))); }
    // lijn op de serie zetten, catering en restauratie deels open
    l.typeId = serie.id; l._sam = null; (await import('../js/spel.js')).herbereken(l);
    document.querySelector('[data-paneel="lijnen"]').click(); document.querySelector(`[data-actie="toon-lijn"][data-id="${l.id}"]`)?.click(); await wacht(100);
    const c = document.querySelector('[data-wijzig="lcatering"][data-k="1"]'); if (c) { c.value = '2'; c.dispatchEvent(new window.Event('change')); await wacht(30); }
    const rs = document.querySelector('[data-wijzig="lrest"][data-veld="soort"]'); if (rs) { rs.value = 'deel'; rs.dispatchEvent(new window.Event('change')); await wacht(30); }
    const t = tekst(); log('prijzen en catering:', t.slice(t.indexOf('Prijzen en catering'), t.indexOf('Prijzen en catering') + 600));
    log('capaciteit', (await import('../js/spel.js')).capaciteit(l), 'catering', JSON.stringify(l.catering), 'restauratie', JSON.stringify(l.restauratie)); } }
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
  globalThis.__map.vuur('click', { point: { x: v.px, y: v.py } }); await wacht(150);
  { const t = document.getElementById('paneel-inhoud').textContent.replace(/\s+/g, ' '); log('reizigers:', t.indexOf('Reizigers') >= 0 ? t.slice(t.indexOf('Reizigers'), t.indexOf('Reizigers') + 330) : 'NIET GEVONDEN in: ' + t.slice(0, 900)); }
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
