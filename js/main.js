// Knooppunt — opstarten, kaartlagen, gereedschap, spellus en panelen.
import { Kaart } from './kaart.js';
import { zetKaartjaren, kaartjaarVoor, rdNaarWgs } from './geo.js';
import { netKleuren } from './stijl.js';
import { Net, wegRoute } from './net.js';
import { MODI, VLOOT, TYPE, beschikbaar } from './vloot.js';
import * as S from './spel.js';
import { AI, laadVervoerderLijnen, nieuwVerzoek, beoordeelVerschuiving, beoordeelPad, beoordeelBouw, beoordeelConcessie,
  bedenkAIVerzoek, beoordeelTegenOpAI, gedeeldeHaltes, overstappen } from './ai.js';
import * as Cloud from './cloud.js';
import { vervoerdersIn, gebiedVan } from './historie.js';
import { genereerVervoerder } from './genereer.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const D = { stations: [], wissels: [], plaatsen: [], veren: [], haltes: [], vervoerders: [], vliegvelden: [], dag: '', ok: {} };
let net = new Net(null), kaart, spel = null, snelheid = 1, tool = 'kijk', slot = null, paneelSoort = null;
let bouw = null, selectie = null;

// ---------------------------------------------------------------- data laden
async function json(pad) {
  try { const r = await fetch(pad, { cache: 'no-cache' }); if (!r.ok) throw 0; D.ok[pad] = true; return await r.json(); }
  catch { D.ok[pad] = false; return null; }
}
async function laadData() {
  const [spoor, st, w, pl, ve, ha, vv, hi, vl] = await Promise.all(['data/spoor.json', 'data/stations.json', 'data/wissels.json',
    'data/plaatsen.json', 'data/veren.json', 'data/haltes.json', 'data/vervoerders.json', 'data/historie.json', 'data/vliegvelden.json'].map(json));
  D.vliegvelden = (vl?.vliegvelden || []).filter(v => (v.g || 'NL') === 'NL').map(v => ({ ...v, landing: LANDING[v.s] ?? 60 }));
  net = new Net(spoor);
  D.stations = st?.stations || [];
  D.wissels = w?.wissels || [];
  D.plaatsen = (pl?.plaatsen || []).filter(p => (p[5] || 'NL') === 'NL'); // Caribisch Nederland volgt met de wereldkaart
  D.veren = ve?.veren || [];
  D.haltes = ha?.haltes || [];
  AI.haltes = D.haltes;
  D.vervoerders = vv?.vervoerders || [];
  D.dag = vv?.dag || '';
  AI.vervoerders = D.vervoerders;
  if (hi?.jaren) zetKaartjaren(hi.jaren);
  if (!spoor) melding('De kaartdata wordt nog voor het eerst gegenereerd (GitHub Actions). Je kunt al rondkijken; spoor en stations verschijnen zodra die klaar is.', 9000);
  netwerkLagen();
}

const ACHTERGROND_KEUZE = {
  eigen: { naam: 'Eigen kaartstijl (OpenStreetMap)', bron: '' },
  pdok: { naam: 'Topografische kaart (PDOK)', bron: '© Kadaster / PDOK' },
  luchtfoto: { naam: 'Luchtfoto (PDOK)', bron: '© Beeldmateriaal Nederland / PDOK' },
  historisch: { naam: 'Historische kaart (Kadaster)', bron: '© Kadaster / Esri Nederland, Topotijdreis' },
};

// landingsgeld per landing (benadering) per soort vliegveld
const LANDING = { international: 1500, regionaal: 500, public: 60, veld: 60, airstrip: 30, heliport: 150, private: 40, militair: 0 };

// ---------------------------------------------------------------- kaartlagen (MapLibre)
const lonlat = (x, y) => { const [la, lo] = rdNaarWgs(x, y); return [Math.round(lo * 1e6) / 1e6, Math.round(la * 1e6) / 1e6]; };
const lijnGeo = pts => { const c = []; for (let k = 0; k < pts.length; k += 2) c.push(lonlat(pts[k], pts[k + 1])); return c; };
const DONKER = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light';
const NK = netKleuren(DONKER);

function klasseVan(t) {
  if (t.soort === 5 || t.soort === 6) return 'oud';
  if (t.soort === 3) return 'tram';
  if (t.soort === 2) return 'metro';
  if (t.soort === 1) return 'snel';
  if (t.soort === 4 || t.soort === 8) return 'smal';
  if (t.dienst) return 'zij';
  return t.sporen >= 3 ? 'h3' : t.sporen === 2 ? 'h2' : 'h1';
}
function jaarVan(t) {
  // van/tot zodat de kaart per jaar kan filteren
  const van = t.start || 0;
  let tot = t.eind || 9999;
  if ((t.soort === 5 || t.soort === 6) && !t.eind) tot = 1990;
  if (t.soort === 7) tot = 0;
  return { van, tot };
}
function jaarFilter(jaar) { return ['all', ['<=', ['get', 'van'], jaar], ['>', ['get', 'tot'], jaar]]; }

let lagenGemaakt = false;
function netwerkLagen() {
  if (!kaart?.klaar) return;
  const jaar = spel?.jaar ?? 2026;
  const sporen = { type: 'FeatureCollection', features: net.takken.filter(t => !t.weg).map(t => ({ type: 'Feature', properties: { k: klasseVan(t), ...jaarVan(t), n: t.sporen }, geometry: { type: 'LineString', coordinates: lijnGeo(t.pts) } })) };
  kaart.bron('spoor', sporen);
  kaart.bron('veren', { type: 'FeatureCollection', features: D.veren.map(v => ({ type: 'Feature', properties: { n: v.n }, geometry: { type: 'LineString', coordinates: lijnGeo(v.c) } })) });
  const w = D.wissels, wf = [];
  for (let i = 0; i < w.length; i += 2) wf.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lonlat(w[i], w[i + 1]) } });
  kaart.bron('wissels', { type: 'FeatureCollection', features: wf });
  kaart.bron('stations', { type: 'FeatureCollection', features: D.stations.map(st => ({ type: 'Feature', properties: { n: st.n + (st.e ? ' (opgeheven)' : ''), s: st.s, p: st.p || 0, van: st.b || 0, tot: st.e === 1 ? 1990 : (st.e || 9999) }, geometry: { type: 'Point', coordinates: lonlat(st.x, st.y) } })) });
  kaart.bron('haltes', { type: 'FeatureCollection', features: D.haltes.filter(h => h[3] & (8 | 16 | 32)).map(h => ({ type: 'Feature', properties: { n: h[0], veer: h[3] & 16 ? 1 : 0 }, geometry: { type: 'Point', coordinates: lonlat(h[1], h[2]) } })) });
  kaart.bron('vliegvelden', { type: 'FeatureCollection', features: D.vliegvelden.map(v => ({ type: 'Feature', properties: { n: v.n, l: `${v.n}${v.baan ? ` · ${v.baan} m${v.verhard ? '' : ' gras'}` : ''}`, groot: v.baan >= 1800 ? 1 : 0, van: v.b || 0, tot: 9999, mil: v.s === 'militair' ? 1 : 0 }, geometry: { type: 'Point', coordinates: lonlat(v.x, v.y) } })) });
  eigenNetBijwerken();
  if (!lagenGemaakt) {
    lagenGemaakt = true;
    const lijn = (id, bron, filter, kleur, breedte, extra = {}) => kaart.laag({ id, type: 'line', source: bron, filter, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': kleur, 'line-width': breedte, ...extra } });
    const zoomB = (a, b, c) => ['interpolate', ['linear'], ['zoom'], 6, a, 11, b, 16, c];
    const k = c => ['==', ['get', 'k'], c];
    lijn('net-veer', 'veren', null, NK.veer, zoomB(1, 1.6, 2.5), { 'line-dasharray': [3, 2.5] });
    lijn('net-oud', 'spoor', ['all', k('oud'), jaarFilter(jaar)], NK.oud, zoomB(0.8, 1.4, 2), { 'line-dasharray': [3, 2] });
    lijn('net-zij', 'spoor', ['all', k('zij'), jaarFilter(jaar)], NK.zij, zoomB(0, 0.6, 1.4), {});
    lijn('net-tram', 'spoor', ['all', k('tram'), jaarFilter(jaar)], NK.tram, zoomB(0.4, 1.2, 2.2));
    lijn('net-smal', 'spoor', ['all', k('smal'), jaarFilter(jaar)], NK.smal, zoomB(0.8, 1.2, 2));
    lijn('net-snel', 'spoor', ['all', k('snel'), jaarFilter(jaar)], NK.snel, zoomB(1, 2, 3));
    lijn('net-metro', 'spoor', ['all', k('metro'), jaarFilter(jaar)], NK.metro, zoomB(1, 2.2, 3.2));
    // hoofdspoor: dikte naar aantal sporen; ver ingezoomd is elk spoor apart getekend in OSM, dan dun
    const hoofd = ['all', ['match', ['get', 'k'], ['h1', 'h2', 'h3'], true, false], jaarFilter(jaar)];
    lijn('net-hoofd-halo', 'spoor', hoofd, NK.halo, ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'k'], 'h3', 4.5, 'h2', 3.5, 2.6], 13, ['match', ['get', 'k'], 'h3', 6, 'h2', 5, 3.6], 16, 3]);
    lijn('net-hoofd', 'spoor', hoofd, NK.spoor, ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'k'], 'h3', 2.6, 'h2', 1.8, 1.1], 13, ['match', ['get', 'k'], 'h3', 3.6, 'h2', 2.8, 1.6], 16, 1.4]);
    lijn('net-enkel', 'spoor', ['all', k('h1'), jaarFilter(jaar)], NK.halo, ['interpolate', ['linear'], ['zoom'], 6, 0.5, 13, 0.8, 16, 0], { 'line-dasharray': [1, 3] });
    lijn('net-eigen-spoor', 'eigen-spoor', ['==', ['get', 'klaar'], 1], spel?.kleur || '#c2412d', zoomB(2, 3, 4));
    lijn('net-eigen-bouw', 'eigen-spoor', ['==', ['get', 'klaar'], 0], spel?.kleur || '#c2412d', zoomB(2, 3, 4), { 'line-dasharray': [2, 2] });
    lijn('net-lijnen-halo', 'eigen-lijnen', null, '#ffffff', zoomB(4, 6, 9), { 'line-opacity': 0.75 });
    lijn('net-lijnen', 'eigen-lijnen', null, ['get', 'kl'], zoomB(2, 3.5, 6));
    kaart.laag({ id: 'net-wissels', type: 'circle', source: 'wissels', minzoom: 15, paint: { 'circle-radius': 2.4, 'circle-color': '#e0a516' } });
    kaart.laag({ id: 'net-haltes', type: 'circle', source: 'haltes', minzoom: 14, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.5, 18, 5], 'circle-color': ['case', ['==', ['get', 'veer'], 1], NK.veer, '#3d8b3d'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
    kaart.laag({ id: 'net-haltes-naam', type: 'symbol', source: 'haltes', minzoom: 16, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0.8, 0], 'text-anchor': 'left', 'text-optional': true }, paint: { 'text-color': DONKER ? '#c9d3cf' : '#2a3431', 'text-halo-color': NK.halo, 'text-halo-width': 1.2 } });
    const stFilter = ['all', jaarFilter(jaar)];
    kaart.laag({ id: 'net-stations', type: 'circle', source: 'stations', filter: ['all', jaarFilter(jaar), ['any', ['==', ['get', 's'], 'trein'], ['>=', ['zoom'], 12.5]]],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['case', ['==', ['get', 's'], 'trein'], ['case', ['>=', ['get', 'p'], 6], 3.5, 2], 1.5], 12, ['case', ['==', ['get', 's'], 'trein'], ['case', ['>=', ['get', 'p'], 6], 7, 5], 3.5], 16, ['case', ['==', ['get', 's'], 'trein'], 9, 5]],
        'circle-color': '#ffffff', 'circle-stroke-width': ['case', ['==', ['get', 's'], 'trein'], 2.2, 1.5],
        'circle-stroke-color': ['match', ['get', 's'], 'trein', DONKER ? '#9fd3c7' : '#173b3a', 'metro', NK.metro, 'sneltram', NK.snel, 'tram', NK.tram, 'veer', NK.veer, 'busstation', '#3d8b3d', '#555'] } });
    kaart.laag({ id: 'net-stations-naam', type: 'symbol', source: 'stations', filter: ['all', jaarFilter(jaar), ['any', ['all', ['==', ['get', 's'], 'trein'], ['any', ['>=', ['get', 'p'], 5], ['>=', ['zoom'], 9.5]]], ['>=', ['zoom'], 14]]],
      layout: { 'text-field': ['get', 'n'], 'text-font': ['case', ['==', ['get', 's'], 'trein'], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]], 'text-size': ['case', ['==', ['get', 's'], 'trein'], 12.5, 11], 'text-offset': [0.9, 0], 'text-anchor': 'left', 'symbol-sort-key': ['-', 0, ['get', 'p']], 'text-padding': 3 },
      paint: { 'text-color': DONKER ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    void stFilter;
    kaart.laag({ id: 'net-vlieg', type: 'symbol', source: 'vliegvelden', filter: ['any', ['==', ['get', 'groot'], 1], ['>=', ['zoom'], 8]],
      layout: { 'text-field': ['case', ['>=', ['zoom'], 9], ['concat', '✈ ', ['get', 'l']], '✈'], 'text-font': ['Noto Sans Bold'], 'text-size': ['case', ['==', ['get', 'groot'], 1], 14, 12], 'text-allow-overlap': false, 'text-anchor': 'left', 'text-offset': [-0.4, 0] },
      paint: { 'text-color': ['case', ['==', ['get', 'mil'], 1], '#7d7a8c', '#5b4bb7'], 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    kaart.laag({ id: 'net-eigen-haltes', type: 'circle', source: 'eigen-haltes', paint: { 'circle-radius': ['case', ['==', ['get', 'm'], 'trein'], 7, 5], 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': spel?.kleur || '#c2412d', 'circle-opacity': ['case', ['==', ['get', 'klaar'], 1], 1, 0.6] } });
    kaart.laag({ id: 'net-eigen-haltes-naam', type: 'symbol', source: 'eigen-haltes', minzoom: 10, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [1, 0], 'text-anchor': 'left' }, paint: { 'text-color': DONKER ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
  }
  jaarBijwerken();
}
function jaarBijwerken() {
  if (!lagenGemaakt) return;
  const jaar = spel?.jaar ?? 2026, f = jaarFilter(jaar), m = kaart.map;
  const k = c => ['==', ['get', 'k'], c];
  for (const [id, c] of [['net-oud', 'oud'], ['net-zij', 'zij'], ['net-tram', 'tram'], ['net-smal', 'smal'], ['net-snel', 'snel'], ['net-metro', 'metro'], ['net-enkel', 'h1']]) m.setFilter(id, ['all', k(c), f]);
  const hoofd = ['all', ['match', ['get', 'k'], ['h1', 'h2', 'h3'], true, false], f];
  m.setFilter('net-hoofd', hoofd); m.setFilter('net-hoofd-halo', hoofd);
  m.setFilter('net-stations', ['all', f, ['any', ['==', ['get', 's'], 'trein'], ['>=', ['zoom'], 12.5]]]);
  m.setFilter('net-stations-naam', ['all', f, ['any', ['all', ['==', ['get', 's'], 'trein'], ['any', ['>=', ['get', 'p'], 5], ['>=', ['zoom'], 9.5]]], ['>=', ['zoom'], 14]]]);
  m.setLayoutProperty('net-oud', 'visibility', jaar < 2000 || kaart.achtergrond === 'historisch' ? 'visible' : 'none');
  if (spel) for (const id of ['net-eigen-spoor', 'net-eigen-bouw']) m.setPaintProperty(id, 'line-color', spel.kleur);
  if (spel) m.setPaintProperty('net-eigen-haltes', 'circle-stroke-color', spel.kleur);
  kaart.jaar = jaar;
}
function eigenNetBijwerken() {
  if (!kaart?.klaar) return;
  const leeg = { type: 'FeatureCollection', features: [] };
  if (!spel) { kaart.bron('eigen-spoor', leeg); kaart.bron('eigen-lijnen', leeg); kaart.bron('eigen-haltes', leeg); return; }
  kaart.bron('eigen-spoor', { type: 'FeatureCollection', features: spel.spoor.map(sp => ({ type: 'Feature', properties: { klaar: sp.klaar ? 1 : 0 }, geometry: { type: 'LineString', coordinates: sp.punten.map(p => lonlat(p[0], p[1])) } })) });
  kaart.bron('eigen-lijnen', { type: 'FeatureCollection', features: spel.lijnen.filter(l => l.route?.pts?.length >= 4).map(l => ({ type: 'Feature', properties: { id: l.id, kl: !l.actief ? '#8a8f8c' : selectie?.lijn === l ? '#f2c14e' : spel.kleur }, geometry: { type: 'LineString', coordinates: lijnGeo(l.route.pts) } })) });
  kaart.bron('eigen-haltes', { type: 'FeatureCollection', features: spel.haltes.map(h => ({ type: 'Feature', properties: { n: h.naam + (h.gereedDag > spel.dag ? ' (in aanbouw)' : ''), m: h.modus, klaar: h.gereedDag > spel.dag ? 0 : 1 }, geometry: { type: 'Point', coordinates: lonlat(h.x, h.y) } })) });
}

function stationZichtbaar(s, jaar) {
  if (s.b && s.b > jaar) return false;
  if (s.e === 1) return jaar < 1990;
  if (s.e && s.e <= jaar) return false;
  return true;
}

// bewegende laag: voertuigen en bouwgereedschap
const zichtLijnen = [];
function tekenBoven(ctx, k) {
  if (!spel) return;
  const [x0, y0, x1, y1] = k.zicht(30);
  const r = k.res;
  const inZicht = l => !(l.bbox[0] > x1 || l.bbox[2] < x0 || l.bbox[1] > y1 || l.bbox[3] < y0);
  zichtLijnen.length = 0;
  const vt = [];
  const tm = spel.tijd;
  for (const l of spel.lijnen) if (l.actief && inZicht(l)) S.voertuigenOp(l, tm, vt);
  const eigenN = vt.length;
  for (const l of AI.lijnen) {
    if (!inZicht(l)) continue;
    if (r > 120 && l.modus !== 'trein') continue;
    if (r > 40 && (l.modus === 'bus' || l.modus === 'belbus')) continue;
    S.voertuigenOp(l, tm, vt);
  }
  const maat = r < 3 ? 1.6 : r < 15 ? 1.25 : r < 60 ? 1 : 0.75;
  // hoek op het scherm: RD-noord valt vrijwel samen met kaart-noord in Nederland
  for (let i = vt.length - 1; i >= 0; i--) {
    const v = vt[i], eigen = i < eigenN;
    const [px, py] = k.scherm(v.x, v.y);
    if (px < -20 || py < -20 || px > k.W + 20 || py > k.H + 20) continue;
    const m = v.lijn.modus, lang = (m === 'trein' ? 14 : m === 'metro' || m === 'tram' || m === 'sneltram' ? 11 : m === 'veer' ? 10 : 8) * maat;
    const breed = (m === 'trein' ? 4.5 : 4) * maat;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-v.hoek);
    ctx.fillStyle = eigen ? spel.kleur : (v.lijn.kleur && v.lijn.kleur.length === 7 ? v.lijn.kleur : MODI[m]?.kleur || '#555');
    ctx.strokeStyle = eigen ? '#fff' : 'rgba(0,0,0,.55)'; ctx.lineWidth = eigen ? 1.5 : 0.8;
    if (m === 'vlucht') { ctx.beginPath(); ctx.moveTo(9 * maat, 0); ctx.lineTo(-6 * maat, 7 * maat); ctx.lineTo(-3 * maat, 0); ctx.lineTo(-6 * maat, -7 * maat); ctx.closePath(); }
    else if (m === 'veer' || m === 'watertaxi') { ctx.beginPath(); ctx.moveTo(lang / 2, 0); ctx.lineTo(-lang / 2, breed); ctx.lineTo(-lang / 2, -breed); ctx.closePath(); }
    else { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-lang / 2, -breed / 2, lang, breed, 1.5) : ctx.rect(-lang / 2, -breed / 2, lang, breed); }
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (r < 2.5 && v.lijn.nr) {
      ctx.font = '600 10px "Barlow Semi Condensed", sans-serif'; ctx.fillStyle = DONKER ? '#e6ece9' : '#1d2724';
      ctx.fillText(v.lijn.nr, px + 8, py - 7);
    }
    v.px = px; v.py = py;
    zichtLijnen.push(v);
  }
  // bouwgereedschap: lijn of spoor in wording
  if (bouw?.punten?.length) {
    const sp = bouw.punten.map(p => k.scherm(p.x, p.y));
    ctx.strokeStyle = spel.kleur; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    ctx.beginPath(); sp.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (bouw.muis) ctx.lineTo(bouw.muis[0], bouw.muis[1]);
    ctx.stroke(); ctx.setLineDash([]);
    sp.forEach(([x, y], i) => {
      ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = spel.kleur; ctx.stroke();
      ctx.fillStyle = '#1d2724'; ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, y - 13); ctx.textAlign = 'left';
    });
  }
}

// ---------------------------------------------------------------- spellus
let vorige = performance.now(), hudT = 0, laatsteOnline = 0;
function lus(nu) {
  const dt = Math.min(0.25, (nu - vorige) / 1000); vorige = nu;
  if (spel && snelheid) {
    const oud = spel.tijd;
    spel.tijd += dt * snelheid;
    // elk vol uur afrekenen
    for (let u = Math.floor(oud / 60) + 1; u <= Math.floor(spel.tijd / 60); u++) uurVoorbij(u * 60 - 60);
    if (spel.tijd >= 26 * 60) dagVoorbij(); // dienstdag loopt van 05:00 tot 02:00
  }
  kaart.render();
  hudT += dt; if (hudT > 0.25) { hudT = 0; hud(); }
  requestAnimationFrame(lus);
}
function uurVoorbij(uurBegin) {
  S.verrekenUur(spel, ctx(), uurBegin);
  // verzoeken afhandelen
  const nu = spel.dag + spel.tijd / 1440;
  for (const vz of spel.verzoeken) {
    if (vz.status !== 'open' && vz.status !== 'tegen-van-speler') continue;
    if (vz.aan === 'speler' && vz.status === 'open') continue;
    if (nu < vz.antwoordDag) continue;
    behandelAntwoord(vz);
  }
  if (paneelSoort === 'geld' || paneelSoort === 'lijnen') ververs();
}
function dagVoorbij() {
  spel.tijd -= 21 * 60; // naar 05:00 volgende dag
  spel.dag++;
  // bouwprojecten opleveren
  for (const s of spel.spoor) if (!s.klaar && s.gereedDag <= spel.dag) { s.klaar = true; const t = net.voegEigenSpoorToe(s.punten.map(p => [p[0], p[1]]), s.eigenaar, s.sporen, spel.jaar); s.takId = t.i; melding(`Spoor opgeleverd: ${(t.lengte / 1000).toFixed(1).replace('.', ',')} km ${s.sporen === 2 ? 'dubbel' : 'enkel'}spoor (${s.eigenaar === 'speler' ? 'van jou' : 'ProRail'}).`); netwerkLagen(); }
  for (const h of spel.haltes) if (h.gereedDag === spel.dag) melding(`${h.naam} is klaar en kan gebruikt worden.`);
  // AI-vervoerders vragen soms iets
  if (spel.dag >= spel.volgendeAI / 1440) {
    spel.volgendeAI = (spel.dag + 2 + Math.random() * 3) * 1440;
    const v = bedenkAIVerzoek(spel);
    if (v) { nieuwVerzoek(spel, v); melding(`Nieuw verzoek van ${v.vanNaam}.`); }
  }
  // vergoedingen die je per jaar betaalt of ontvangt
  for (const a of spel.afspraken || []) { spel.geld += a.bedrag / 365; spel.maand.overig -= a.bedrag / 365; }
  if (spel.dag % 30 === 0) {
    S.maandAfsluiten(spel);
    const m = spel.historie[spel.historie.length - 1];
    melding(`Maand afgesloten: resultaat ${S.euro(m.resultaat)}, ${Math.round(m.reizigers).toLocaleString('nl-NL')} reizigers.`, 6000);
    if (spel.dag % 360 === 0) { spel.jaar++; jaarBijwerken(); melding(`Gelukkig nieuwjaar: het is nu ${spel.jaar}.`); }
  }
  // reputatie volgt uitval en bezetting
  const uitval = spel.lijnen.filter(l => l.actief && S.beschikbaarVoor(spel, l) < l.nodig).length;
  const vol = spel.lijnen.filter(l => l.actief && l.bezetting > 0.95).length;
  spel.reputatie = Math.max(10, Math.min(100, spel.reputatie + 0.5 - uitval * 1.5 - vol * 0.7));
  bewaar();
}

function ctx() {
  return {
    plaatsen: D.plaatsen, net,
    concurrentie: (lijn) => {
      // aandeel haltes dat ook door AI-lijnen van dezelfde modus wordt bediend
      let n = 0;
      for (const h of lijn.haltes) if (AI.lijnen.some(a => (a.modus === lijn.modus || (a.modus === 'bus' && lijn.modus === 'hov')) && a.haltes.some(ah => Math.hypot(ah.x - h.x, ah.y - h.y) < 200))) n++;
      return lijn.haltes.length ? n / lijn.haltes.length : 0;
    },
    enkelspoorBij: () => false,
  };
}

// ---------------------------------------------------------------- HUD
function hud() {
  if (!spel) return;
  $('b-geld').textContent = S.euroKort(spel.geld);
  $('b-geld').style.color = spel.geld < 0 ? 'var(--rood)' : '';
  $('b-dag').textContent = `Dag ${spel.dag + 1} · ${spel.jaar}`;
  $('b-klok').textContent = S.klok(spel.tijd);
  const open = spel.verzoeken.filter(v => (v.aan === 'speler' && v.status === 'open') || (v.status === 'tegenvoorstel' && !v.gezien) || (!v.gezien && v.status !== 'open' && v.status !== 'tegen-van-speler')).length;
  $('b-inbox').hidden = !open; $('b-inbox').textContent = open;
}
function melding(t, duur = 4200) {
  const d = document.createElement('div'); d.textContent = t; $('melding').appendChild(d);
  setTimeout(() => d.remove(), duur);
  while ($('melding').children.length > 4) $('melding').firstChild.remove();
}
function hint(html, knoppen = []) {
  const h = $('hint');
  if (!html) { h.hidden = true; return; }
  h.innerHTML = `<span>${html}</span>`;
  for (const [tekst, f] of knoppen) { const b = document.createElement('button'); b.className = 'knop'; b.type = 'button'; b.textContent = tekst; b.onclick = f; h.appendChild(b); }
  h.hidden = false;
}

// ---------------------------------------------------------------- panelen
function openPaneel(soort, data) {
  paneelSoort = soort; selectie = data?.selectie ?? (soort === 'lijn' ? selectie : null);
  setTimeout(eigenNetBijwerken, 0);
  $('paneel').hidden = false;
  document.querySelectorAll('[data-paneel]').forEach(b => b.classList.toggle('aan', b.dataset.paneel === soort));
  ververs(data);
}
function sluitPaneel() { $('paneel').hidden = true; paneelSoort = null; selectie = null; document.querySelectorAll('[data-paneel]').forEach(b => b.classList.remove('aan')); }
let paneelData = null;
function ververs(data) {
  if (data !== undefined) paneelData = data;
  if (!paneelSoort || !spel) return;
  const el = $('paneel-inhoud');
  const actief = document.activeElement;
  if (actief && el.contains(actief) && (actief.tagName === 'INPUT' || actief.tagName === 'SELECT')) return; // niet storen tijdens typen
  const f = PANELEN[paneelSoort];
  if (f) { el.innerHTML = f(paneelData); koppel(el); }
}

const PANELEN = {
  lijnen() {
    const rijen = spel.lijnen.map(l => {
      const st = l.stat, res = st ? st.opbrengst - st.kosten : 0;
      const tekort = S.beschikbaarVoor(spel, l) < l.nodig;
      return `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td><span class="lijnnr" style="background:${l.actief ? spel.kleur : '#888'}">${esc(l.nr)}</span></td>
        <td>${esc(l.naam || l.haltes[0].naam + ' – ' + l.haltes[l.haltes.length - 1].naam)}<br><span class="klein">${MODI[l.modus].naam} · ${l.haltes.length} haltes${l.wacht ? ' · wacht op ProRail' : ''}${tekort ? ' · <b style="color:var(--rood)">materieel tekort</b>' : ''}</span></td>
        <td class="getal">${st ? Math.round(st.reizigers).toLocaleString('nl-NL') : '—'}<br><span class="klein" style="color:${res < 0 ? 'var(--rood)' : 'var(--groen)'}">${st ? S.euroKort(res) : ''}</span></td></tr>`;
    }).join('');
    return `<h2>Je lijnen</h2><p class="klein">Reizigers en resultaat deze maand. Klik op een lijn voor de dienstregeling.</p>
      ${spel.lijnen.length ? `<table class="tabel"><tr><th>Lijn</th><th>Route</th><th class="getal">Reizigers</th></tr>${rijen}</table>` : '<p>Nog geen lijnen. Kies <b>＋ Lijn</b> links en klik haltes of stations op volgorde aan.</p>'}
      <button class="knop hoofd" data-actie="tool" data-tool="lijn">＋ Nieuwe lijn</button>`;
  },
  lijn(l) {
    if (!l) return '';
    const t = TYPE[l.typeId];
    const typen = beschikbaar(spel.jaar, l.modus);
    const st = l.stat;
    const gedeeld = gedeeldeHaltes(l);
    const uniekeAI = [];
    for (const g of gedeeld) if (!uniekeAI.some(u => u.ai.sleutel === g.ai.sleutel && u.halte === g.halte)) uniekeAI.push(g);
    return `<h2><span class="lijnnr" style="background:${spel.kleur}">${esc(l.nr)}</span> ${esc(l.naam || '')}</h2>
      <p class="klein">${MODI[l.modus].naam} · ${l.lengteKm.toFixed(1).replace('.', ',')} km · rijtijd ${Math.round(l.duur / 60)} min · ${l.vertrek[0].length + l.vertrek[1].length} ritten per dag
      ${l.concessie ? ' · <span class="chip goed">concessie</span>' : ''} ${l.wacht ? '<span class="chip let">wacht op ProRail</span>' : ''} ${!l.actief && !l.wacht ? '<span class="chip">gestopt</span>' : ''}</p>
      <ol class="haltelijst">${l.haltes.map((h, i) => `<li>${esc(h.naam)} <span class="klein">+${Math.round(l.t[i] / 60)}′</span></li>`).join('')}</ol>
      <h3>Materieel</h3>
      <div class="veld"><select data-wijzig="lijn-type" data-id="${l.id}">${typen.map(v => `<option value="${v.id}" ${v.id === l.typeId ? 'selected' : ''}>${esc(v.naam)} (${v.zit + v.sta} pl.)</option>`).join('')}</select></div>
      <p>Nodig: <b>${l.nodig}</b> × ${esc(t?.naam || '')} · in bezit: <b>${spel.voertuigen[l.typeId] || 0}</b>
      ${S.beschikbaarVoor(spel, l) < l.nodig ? `<br><button class="knop hoofd" data-actie="koop" data-type="${l.typeId}" data-n="${l.nodig - S.beschikbaarVoor(spel, l)}">Koop ${l.nodig - S.beschikbaarVoor(spel, l)} erbij (${S.euroKort((l.nodig - S.beschikbaarVoor(spel, l)) * (t?.prijs || 0))})</button>` : ''}</p>
      <h3>Dienstregeling (elke … minuten)</h3>
      ${l.echt && !l.aangepast ? '<p class="klein">Rijdt nu volgens de echte dienstregeling. Pas je iets aan, dan maakt het spel een eigen regelmatige dienstregeling.</p>' : ''}
      <div class="raster2">${S.PERIODES.map(p => `<label class="veld">${p.naam}<input type="number" min="0" max="240" step="1" value="${l.interval[p.id] ?? ''}" data-wijzig="interval" data-id="${l.id}" data-p="${p.id}"></label>`).join('')}</div>
      <div class="raster2"><label class="veld">Eerste rit<input type="time" value="${S.klok(l.eerste)}" data-wijzig="eerste" data-id="${l.id}"></label>
      <label class="veld">Laatste rit<input type="time" value="${S.klok(l.laatste)}" data-wijzig="laatste" data-id="${l.id}"></label>
      <label class="veld">Verschuiving (min)<input type="number" min="-30" max="30" value="${l.offset}" data-wijzig="offset" data-id="${l.id}"></label></div>
      <p class="klein">Vertrek ${esc(l.haltes[0].naam)}: ${l.vertrek[0].filter(v => v >= 12 * 60 && v < 14 * 60).map(S.klok).join(', ') || '—'} (12–14 uur)</p>
      ${st ? `<h3>Deze maand</h3><table class="tabel"><tr><td>Reizigers</td><td class="getal">${Math.round(st.reizigers).toLocaleString('nl-NL')}</td></tr>
        <tr><td>Opbrengst (kaartjes, boetes, subsidie)</td><td class="getal">${S.euro(st.opbrengst)}</td></tr><tr><td>Kosten</td><td class="getal">${S.euro(-st.kosten)}</td></tr>
        <tr><td>Bezetting</td><td class="getal">${Math.round((l.bezetting || 0) * 100)}%</td></tr>${st.uitval > 0.5 ? `<tr><td>Uitgevallen ritten</td><td class="getal" style="color:var(--rood)">${Math.round(st.uitval)}</td></tr>` : ''}</table>` : ''}
      <h3>Kaartcontrole op deze lijn</h3>
      <label class="rij"><input type="checkbox" data-wijzig="conducteur" data-id="${l.id}" ${l.conducteur ? 'checked' : ''}> Conducteur op elke rit (+${S.euro(S.LOON.conducteur)} per voertuiguur)</label>
      ${l.modus === 'bus' ? `<label class="rij"><input type="checkbox" data-wijzig="chauffeur" data-id="${l.id}" ${l.chauffeurControle ? 'checked' : ''}> Chauffeur controleert bij instappen (+5 s per halte)</label>` : ''}
      <h3>Overleg</h3>
      ${!l.concessie ? `<button class="knop" data-actie="concessie" data-id="${l.id}">Concessie (subsidie) aanvragen bij de provincie</button>` : ''}
      ${l.modus === 'trein' && l.wacht ? `<button class="knop" data-actie="pad" data-id="${l.id}">Opnieuw ruimte op het spoor aanvragen</button>` : ''}
      ${uniekeAI.length ? `<p class="klein">Overstappen met andere vervoerders (12–13 uur):</p><table class="tabel">${uniekeAI.slice(0, 12).map(g => `<tr><td>${esc(g.halte.naam)}</td><td><span class="lijnnr" style="background:${esc(g.ai.kleur)}">${esc(g.ai.nr)}</span> ${esc(g.ai.vervoerderNaam)}</td><td class="getal">${overstappen(l, g.ai, g.halte.x, g.halte.y)}</td><td><button class="knop" data-actie="verzoek-ai" data-id="${l.id}" data-ai="${esc(g.ai.sleutel)}" data-h="${l.haltes.indexOf(g.halte)}">Verzoek</button></td></tr>`).join('')}</table>` : '<p class="klein">Geen gedeelde haltes met andere vervoerders in beeld. Zoom in op je lijn zodat hun dienstregeling laadt.</p>'}
      <h3>Lijn</h3>
      <div class="rij"><button class="knop" data-actie="aanuit" data-id="${l.id}">${l.actief ? 'Tijdelijk stoppen' : 'Weer laten rijden'}</button>
      <button class="knop gevaar" data-actie="opheffen" data-id="${l.id}">Opheffen</button></div>`;
  },
  verzoeken() {
    const kaartje = v => {
      const titel = v.aan === 'speler' ? `Van ${esc(v.vanNaam)}` : `Aan ${esc(v.aanNaam || v.aan)}`;
      const status = { open: '<span class="chip let">wacht op antwoord</span>', geaccepteerd: '<span class="chip goed">akkoord</span>', afgewezen: '<span class="chip fout">afgewezen</span>',
        tegenvoorstel: '<span class="chip let">tegenvoorstel</span>', 'tegen-van-speler': '<span class="chip let">jouw tegenvoorstel ligt er</span>', ingetrokken: '<span class="chip">ingetrokken</span>' }[v.status] || '';
      let acties = '';
      if (v.aan === 'speler' && v.status === 'open') acties = `<div class="rij"><button class="knop hoofd" data-actie="vz-ja" data-id="${v.id}">Akkoord</button><button class="knop" data-actie="vz-nee" data-id="${v.id}">Afwijzen</button></div>
        <div class="raster2"><label class="veld">Tegenvoorstel (min)<input type="number" min="-15" max="15" value="${v.minuten}" id="tv-min-${v.id}"></label><label class="veld">Vergoeding €/jaar<input type="number" min="0" step="5000" value="0" id="tv-geld-${v.id}"></label></div>
        <button class="knop" data-actie="vz-tegen" data-id="${v.id}">Tegenvoorstel sturen</button>`;
      if (v.status === 'tegenvoorstel' && v.aan !== 'speler') acties = `<div class="rij"><button class="knop hoofd" data-actie="vz-tegen-ja" data-id="${v.id}">Tegenvoorstel aannemen</button><button class="knop" data-actie="vz-tegen-nee" data-id="${v.id}">Laten zitten</button></div>
        ${v.soort === 'verschuif' ? `<div class="raster2"><label class="veld">Nieuw bod (min)<input type="number" min="-15" max="15" value="${v.tegen.minuten}" id="tv-min-${v.id}"></label><label class="veld">Jouw vergoeding €/jaar<input type="number" min="0" step="5000" value="${v.tegen.vergoeding || 0}" id="tv-geld-${v.id}"></label></div><button class="knop" data-actie="vz-opnieuw" data-id="${v.id}">Nieuw bod doen</button>` : ''}`;
      if (v.status === 'tegenvoorstel' && v.aan === 'speler') acties = `<div class="rij"><button class="knop hoofd" data-actie="vz-tegen-ja" data-id="${v.id}">Aannemen</button><button class="knop" data-actie="vz-tegen-nee" data-id="${v.id}">Afwijzen</button></div>`;
      return `<div class="kaartje ${!v.gezien && v.status !== 'open' ? 'nieuw' : ''}"><div class="rij"><b>${titel}</b>${status}<span class="klein" style="margin-left:auto">dag ${Math.floor(v.dag) + 1}</span></div>
        <p>${esc(v.tekst)}</p>${v.reden ? `<p class="klein"><b>Antwoord:</b> ${esc(v.reden)}</p>` : ''}${acties}</div>`;
    };
    for (const v of spel.verzoeken) if (v.status !== 'open' && v.status !== 'tegen-van-speler') v.gezien = true;
    setTimeout(hud, 0);
    return `<h2>Overleg</h2><p class="klein">Verzoeken aan en van andere vervoerders, ProRail en de provincie. Antwoorden komen na een paar speldagen.</p>
      ${spel.verzoeken.length ? spel.verzoeken.slice(0, 40).map(kaartje).join('') : '<p>Nog geen verzoeken. Open een lijn en kies <b>Verzoek</b> bij een gedeelde halte, of vraag een treinpad, station of spoor aan.</p>'}`;
  },
  vloot() {
    const nodig = {};
    for (const l of spel.lijnen) if (l.actief) nodig[l.typeId] = (nodig[l.typeId] || 0) + l.nodig;
    const typen = beschikbaar(spel.jaar);
    const groepen = Object.keys(MODI).map(m => {
      const lijst = typen.filter(v => v.modus === m);
      if (!lijst.length) return '';
      return `<h3>${MODI[m].naam}</h3><table class="tabel">${lijst.map(v => `<tr><td><b>${esc(v.naam)}</b><br><span class="klein">${v.zit} zit + ${v.sta} sta · ${v.vmax} km/u · ${v.energie} · ${S.euroKort(v.prijs)} · ${esc(v.wie)}</span></td>
        <td class="getal">${spel.voertuigen[v.id] || 0}${nodig[v.id] ? `<br><span class="klein" style="color:${(spel.voertuigen[v.id] || 0) < nodig[v.id] ? 'var(--rood)' : 'inherit'}">nodig ${nodig[v.id]}</span>` : ''}</td>
        <td><div class="rij" style="flex-wrap:nowrap"><button class="knop" data-actie="koop" data-type="${v.id}" data-n="1" title="Kopen">＋</button><button class="knop" data-actie="verkoop" data-type="${v.id}" title="Verkopen voor 45% van de nieuwprijs" ${spel.voertuigen[v.id] ? '' : 'disabled'}>−</button></div></td></tr>`).join('')}</table>`;
    }).join('');
    return `<h2>Vloot</h2><p class="klein">Materieel dat in ${spel.jaar} in Nederland reed. Prijzen zijn benaderingen in euro's van nu. Verkopen levert 45% op.</p>${groepen}`;
  },
  controle() {
    const c = spel.controle, m = spel.maand;
    const zwartPct = m.reizigers ? (m.zwart / m.reizigers * 100) : 0;
    return `<h2>Kaartcontrole</h2>
      <p>Deze maand: <b>${zwartPct.toFixed(1).replace('.', ',')}%</b> zwartrijders, ${Math.round(m.betrapt).toLocaleString('nl-NL')} betrapt, ${S.euro(m.boetes)} aan boetes (€ ${S.BOETE} + ritprijs).</p>
      <h3>Steekproef</h3><label class="veld">Deel van de ritten met controleurs: <output>${c.steekproef}%</output><input type="range" min="0" max="100" step="5" value="${c.steekproef}" data-wijzig="steekproef"></label>
      <p class="klein">Kost ${S.euro(S.LOON.controleur)} per controleur-uur. Op lijnen met een conducteur is de pakkans altijd hoog.</p>
      <h3>Poortjes</h3><label class="rij"><input type="checkbox" data-wijzig="poortjes" ${c.poortjes ? 'checked' : ''}> Poortjes op je trein- en metrostations (eenmalig € 250.000 per station, € 4.000 onderhoud per maand)</label>
      <h3>Bus</h3><label class="rij"><input type="checkbox" data-wijzig="chauffeur-alles" ${c.chauffeur ? 'checked' : ''}> Instappen voorin bij de chauffeur (halveert zwartrijden op de bus)</label>
      <h3>Controleploegen</h3><p class="klein">Een ploeg rijdt mee op de lijnen die je kiest, binnen een tijdvak.</p>
      ${c.ploegen.map((p, i) => `<div class="kaartje"><div class="rij"><b>Ploeg ${i + 1}</b><span class="klein">${p.mensen} controleurs · ${S.klok(p.van)}–${S.klok(p.tot)}</span><button class="knop gevaar" style="margin-left:auto" data-actie="ploeg-weg" data-i="${i}">×</button></div>
        <div class="raster2"><label class="veld">Mensen<input type="number" min="1" max="40" value="${p.mensen}" data-wijzig="ploeg-mensen" data-i="${i}"></label><label class="veld">Van<input type="time" value="${S.klok(p.van)}" data-wijzig="ploeg-van" data-i="${i}"></label><label class="veld">Tot<input type="time" value="${S.klok(p.tot)}" data-wijzig="ploeg-tot" data-i="${i}"></label></div>
        <div>${spel.lijnen.map(l => `<label class="rij klein"><input type="checkbox" data-wijzig="ploeg-lijn" data-i="${i}" data-id="${l.id}" ${p.lijnen.includes(l.id) ? 'checked' : ''}> ${esc(l.nr)} ${esc(l.naam || '')}</label>`).join('')}</div></div>`).join('')}
      <button class="knop" data-actie="ploeg-erbij">＋ Ploeg toevoegen</button>`;
  },
  geld() {
    const m = spel.maand, h = spel.historie;
    const rij = (n, v, neg) => `<tr><td>${n}</td><td class="getal" style="color:${neg && v ? 'var(--rood)' : ''}">${S.euro(neg ? -v : v)}</td></tr>`;
    const max = Math.max(1, ...h.map(x => Math.abs(x.resultaat)));
    return `<h2>Financiën</h2><p>Kas: <b>${S.euro(spel.geld)}</b> · reputatie <b>${Math.round(spel.reputatie)}</b>/100</p>
      <h3>Lopende maand (dag ${spel.dag % 30 + 1} van 30)</h3><table class="tabel">
      ${rij('Kaartjes', m.kaartjes)}${rij('Boetes zwartrijders', m.boetes)}${rij('Subsidie (concessies)', m.subsidie)}
      ${rij('Personeel', m.personeel, true)}${rij('Energie en onderhoud', m.energie, true)}${rij('Gebruiksvergoeding spoor', m.gebruik, true)}${m.overig ? rij('Overig / afspraken', m.overig, true) : ''}
      <tr><th>Reizigers</th><th class="getal">${Math.round(m.reizigers).toLocaleString('nl-NL')}</th></tr></table>
      ${h.length ? `<h3>Resultaat per maand</h3><div style="display:flex;align-items:flex-end;gap:3px;height:90px;border-bottom:1px solid var(--lijn)">${h.map(x => `<div title="${S.euro(x.resultaat)}" style="flex:1;height:${Math.max(2, Math.abs(x.resultaat) / max * 88)}px;background:${x.resultaat < 0 ? 'var(--rood)' : 'var(--groen)'};border-radius:2px 2px 0 0"></div>`).join('')}</div>
      <p class="klein">Resultaat inclusief afschrijving van de vloot. Laatste maand: ${S.euro(h[h.length - 1].resultaat)}.</p>` : '<p class="klein">Na 30 speldagen verschijnt hier je eerste maandresultaat.</p>'}
      <h3>Spel</h3><div class="rij"><button class="knop" data-actie="bewaar">Nu opslaan</button><button class="knop" data-actie="nieuw">Nieuw spel / laden</button></div>`;
  },
  kaart() {
    return `<h2>Kaart</h2><h3>Achtergrond</h3>
      ${Object.entries(ACHTERGROND_KEUZE).map(([id, a]) => `<label class="rij"><input type="radio" name="achtergrond" value="${id}" data-wijzig="achtergrond" ${kaart.achtergrond === id ? 'checked' : ''}> ${a.naam}${id === 'historisch' ? ` (${kaartjaarVoor(spel.jaar)})` : ''}</label>`).join('')}
      <p class="klein">De historische kaart is de Kadaster-tijdreiskaart van het jaar dat het dichtst vóór je speljaar ligt.</p>
      <h3>Legenda</h3><table class="tabel">
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#2a3431" stroke-width="1.6"/><line x1="0" y1="5" x2="40" y2="5" stroke="#fff" stroke-width=".7" stroke-dasharray="2 6"/></svg></td><td>Enkelspoor</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#2a3431" stroke-width="2.4"/></svg></td><td>Dubbelspoor</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#2a3431" stroke-width="3.4"/></svg></td><td>Drie of meer sporen</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#9aa39e" stroke-width="1"/></svg></td><td>Opstel- en rangeersporen</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#1f6fd1" stroke-width="2.2"/></svg></td><td>Metro</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#0f7c8a" stroke-width="2"/></svg></td><td>Sneltram</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#c2412d" stroke-width="1.5"/></svg></td><td>Tram</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#1f8fb8" stroke-width="1.6" stroke-dasharray="6 5"/></svg></td><td>Veerverbinding</td></tr>
      <tr><td><svg width="40" height="10"><line x1="0" y1="5" x2="40" y2="5" stroke="#8a5a2b" stroke-width="1.4" stroke-dasharray="5 3"/></svg></td><td>Opgeheven spoor (historisch)</td></tr>
      <tr><td><svg width="40" height="10"><rect x="17" y="2" width="6" height="6" fill="#e0a516"/></svg></td><td>Wissel (ver ingezoomd)</td></tr></table>
      <h3>Gegevens</h3><p class="klein">Spoornet en stations: OpenStreetMap (${net.takken.length.toLocaleString('nl-NL')} spoortakken, ${D.stations.length.toLocaleString('nl-NL')} stations en haltes, ${(D.wissels.length / 2).toLocaleString('nl-NL')} wissels). Dienstregeling: OVapi${D.dag ? ', ' + D.dag.slice(6) + '-' + D.dag.slice(4, 6) + '-' + D.dag.slice(0, 4) : ''}. Het aantal sporen is geschat uit evenwijdig getekende sporen.</p>`;
  },
  station(s) {
    return `<h2>${esc(s.naam)}</h2><p class="klein">${s.eigen ? 'Jouw station' : 'Bestaand station'}${s.p ? ` · ongeveer ${s.p} sporen` : ''}${spel.perrons?.[s.naam] ? ` · ${spel.perrons[s.naam]} extra perron(s) van jou` : ''}</p>
      <button class="knop hoofd" data-actie="perron-bouw" data-naam="${esc(s.naam)}">＋ Perron bouwen (€ 2,5 mln)</button>`;
  },
  nieuwStation(d) {
    return `<h2>Nieuw station</h2><p class="klein">Op het spoor bij ${esc(d.plaats || 'deze plek')}.</p>
      <div class="veld"><label for="ns-naam">Naam</label><input id="ns-naam" value="${esc(d.naam)}" maxlength="40"></div>
      <div class="rij"><button class="knop hoofd" data-actie="station-zelf">Zelf bouwen (€ 6 mln, 30 dagen)</button><button class="knop" data-actie="station-prorail">ProRail vragen (gratis, als het rendeert)</button></div>
      <p class="klein">Een eigen station is van jou: andere vervoerders moeten jou vragen om er te stoppen. ProRail bouwt alleen als de maatschappelijke kosten-batenanalyse (MKBA) positief is.</p>`;
  },
  nieuwSpoor(d) {
    const km = d.punten.reduce((s, p, i) => i ? s + Math.hypot(p[0] - d.punten[i - 1][0], p[1] - d.punten[i - 1][1]) / 1000 : 0, 0);
    return `<h2>Nieuw spoor</h2><p>${km.toFixed(1).replace('.', ',')} km over ${d.punten.length} punten. Begin en eind sluiten aan op bestaand spoor als dat binnen 250 m ligt.</p>
      <label class="rij"><input type="radio" name="sporen" value="1" checked> Enkelspoor (€ 8 mln/km)</label><label class="rij"><input type="radio" name="sporen" value="2"> Dubbelspoor (€ 15 mln/km)</label>
      <div class="rij"><button class="knop hoofd" data-actie="spoor-zelf" data-km="${km}">Zelf aanleggen</button><button class="knop" data-actie="spoor-prorail">ProRail vragen</button></div>
      <p class="klein">Eigen spoor is van jou: je betaalt geen gebruiksvergoeding, en anderen betalen jou als ze er willen rijden. Bouwtijd ongeveer ${Math.round(60 + km * 8)} speldagen.</p>`;
  },
  nieuweLijn(d) {
    let typen = beschikbaar(spel.jaar, d.modus);
    if (d.modus === 'vlucht') {
      const minBaan = Math.min(...d.haltes.map(h => h.heli ? 0 : (h.baan || 600)));
      const gras = d.haltes.some(h => !h.verhard && !h.heli);
      const heli = d.haltes.some(h => h.heli);
      typen = typen.filter(v => v.baan <= minBaan && (!gras || v.gras) && (!heli || v.baan === 0));
      if (!typen.length) return `<h2>Geen toestel past</h2><p>De kortste baan op deze route is ${minBaan} m${gras ? ' en er is een grasbaan' : ''}. Er is in ${spel.jaar} geen toestel dat daar kan landen.</p><button class="knop" data-actie="lijn-annuleer">Terug</button>`;
      d.waarschuwing = (d.waarschuwing || '') + `Kortste baan ${minBaan} m${gras ? ' (gras)' : ''}: alleen toestellen die daar kunnen landen staan in de lijst.`;
    }
    const vrijNr = String(spel.lijnen.length + 1);
    return `<h2>Nieuwe ${MODI[d.modus].naam.toLowerCase()}lijn</h2>
      <p class="klein">${d.haltes.length} haltes · ${(d.route.lengte / 1000).toFixed(1).replace('.', ',')} km${d.route.weg === false ? ' · <b>geen wegroute gevonden, rechte lijnen</b>' : ''}${d.waarschuwing ? '<br><b style="color:var(--rood)">' + esc(d.waarschuwing) + '</b>' : ''}</p>
      <ol class="haltelijst">${d.haltes.map(h => `<li>${esc(h.naam)}</li>`).join('')}</ol>
      <div class="raster2"><label class="veld">Lijnnummer<input id="nl-nr" value="${esc(d.modus === 'trein' ? 'RE' + vrijNr : vrijNr)}" maxlength="8"></label>
      <label class="veld">Naam<input id="nl-naam" value="${esc(d.haltes[0].naam.split(',')[0] + ' – ' + d.haltes[d.haltes.length - 1].naam.split(',')[0])}" maxlength="60"></label></div>
      <div class="veld"><label for="nl-type">Materieel</label><select id="nl-type">${typen.map(v => `<option value="${v.id}">${esc(v.naam)} · ${v.zit + v.sta} pl. · ${S.euroKort(v.prijs)}</option>`).join('')}</select></div>
      <div class="raster2"><label class="veld">Spits elke (min)<input id="nl-spits" type="number" value="${d.modus === 'trein' ? 30 : 15}" min="3"></label><label class="veld">Dal elke (min)<input id="nl-dal" type="number" value="30" min="3"></label><label class="veld">Avond elke (min)<input id="nl-avond" type="number" value="60" min="3"></label></div>
      <label class="rij"><input type="checkbox" id="nl-koop" checked> Benodigd materieel meteen kopen</label>
      <label class="rij"><input type="checkbox" id="nl-concessie" checked> Concessie (subsidie) aanvragen bij de provincie</label>
      ${d.modus === 'trein' ? '<p class="klein">Voor een treinlijn vraag je ruimte op het spoor aan bij ProRail. De lijn rijdt pas als die is toegekend (behalve over je eigen spoor).</p>' : ''}
      <div class="rij"><button class="knop hoofd" data-actie="lijn-maak">Lijn openen</button><button class="knop" data-actie="lijn-annuleer">Annuleren</button></div>`;
  },
  aiLijn(a) {
    return `<h2><span class="lijnnr" style="background:${esc(a.kleur)}">${esc(a.nr)}</span> ${esc(a.vervoerderNaam)}</h2>
      <p>${esc(a.naam || '')}${a.kop ? ` · richting ${esc(a.kop)}` : ''}</p><p class="klein">${MODI[a.modus]?.naam || a.modus} · ${a.haltes.length} haltes · ${a.vertrek[0].length} ritten per dag in deze richting · goodwill ${spel.goodwill[a.vervoerder] ?? 0}</p>
      <ol class="haltelijst">${a.haltes.map((h, i) => `<li>${esc(h.naam)} <span class="klein">+${Math.round(a.t[i] / 60)}′</span></li>`).join('')}</ol>
      <p class="klein">Wil je dat deze lijn aansluit op een eigen lijn? Open je eigen lijn en kies <b>Verzoek</b> bij de gedeelde halte.</p>`;
  },
};

// ---------------------------------------------------------------- acties uit panelen
function koppel(el) {
  el.querySelectorAll('[data-actie]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); actie(b.dataset.actie, b.dataset); }));
  el.querySelectorAll('[data-wijzig]').forEach(i => i.addEventListener('change', () => wijzig(i.dataset.wijzig, i)));
}
const lijnVan = id => spel.lijnen.find(l => l.id === id);
function betaal(bedrag, wat) {
  if (spel.geld - bedrag < -20e6) { melding(`Te weinig geld voor ${wat}. Je kunt maximaal € 20 mln rood staan.`); return false; }
  spel.geld -= bedrag; spel.maand.overig += 0; return true;
}
function actie(a, d) {
  actieUit(a, d);
  eigenNetBijwerken();
}
function actieUit(a, d) {
  const l = d.id ? lijnVan(d.id) : null;
  switch (a) {
    case 'toon-lijn': selectie = { lijn: l }; openPaneel('lijn', l); kaart.vliegNaar((l.bbox[0] + l.bbox[2]) / 2, (l.bbox[1] + l.bbox[3]) / 2, Math.max(2, Math.max(l.bbox[2] - l.bbox[0], l.bbox[3] - l.bbox[1]) / Math.min(kaart.W, kaart.H) * 1.4)); break;
    case 'tool': zetTool(d.tool); break;
    case 'koop': {
      const t = TYPE[d.type], n = +d.n || 1;
      if (!betaal(t.prijs * n, `${n} × ${t.naam}`)) break;
      spel.voertuigen[d.type] = (spel.voertuigen[d.type] || 0) + n;
      melding(`${n} × ${t.naam} gekocht voor ${S.euroKort(t.prijs * n)}.`); ververs(); break;
    }
    case 'verkoop': {
      const t = TYPE[d.type];
      if (!spel.voertuigen[d.type]) break;
      spel.voertuigen[d.type]--; spel.geld += t.prijs * 0.45; ververs(); break;
    }
    case 'aanuit': l.actief = !l.actief; ververs(); break;
    case 'opheffen': if (d.zeker) { spel.lijnen = spel.lijnen.filter(x => x !== l); sluitPaneel(); melding(`Lijn ${l.nr} opgeheven.`); }
      else { const b = document.querySelector('[data-actie="opheffen"]'); b.textContent = 'Zeker weten? Klik nog eens'; b.dataset.zeker = '1'; } break;
    case 'concessie': {
      const vz = nieuwVerzoek(spel, { aan: 'provincie', aanNaam: 'Provincie', soort: 'concessie', lijnId: l.id, tekst: `Concessie en subsidie gevraagd voor lijn ${l.nr}.` });
      melding('Aanvraag naar de provincie gestuurd. Antwoord binnen ongeveer 8 speldagen.'); void vz; openPaneel('verzoeken'); break;
    }
    case 'pad': padAanvragen(l); openPaneel('verzoeken'); break;
    case 'verzoek-ai': {
      const ai = AI.lijnen.find(x => x.sleutel === d.ai); const h = l.haltes[+d.h];
      // beste verschuiving voor jou voorstellen
      let beste = 0, bw = 0;
      for (let k = -8; k <= 8; k++) { const w = overstappen(l, ai, h.x, h.y, 0, k) - overstappen(l, ai, h.x, h.y); if (w > bw) { bw = w; beste = k; } }
      if (!beste) { melding('Geen verschuiving van hun lijn levert jou betere overstappen op. Verschuif eventueel je eigen lijn.'); break; }
      nieuwVerzoek(spel, { aan: ai.vervoerder, aanNaam: ai.vervoerderNaam, soort: 'verschuif', lijnId: l.id, aiSleutel: ai.sleutel, halte: { naam: h.naam, x: h.x, y: h.y }, minuten: beste, vergoeding: 0,
        tekst: `Verzoek aan ${ai.vervoerderNaam}: lijn ${ai.nr} ${beste > 0 ? beste + ' min later' : -beste + ' min eerder'} bij ${h.naam}, zodat er ${bw} overstap(pen) per uur bij komen op jouw lijn ${l.nr}.` });
      melding(`Verzoek gestuurd naar ${ai.vervoerderNaam}.`); openPaneel('verzoeken'); break;
    }
    case 'vz-ja': case 'vz-nee': case 'vz-tegen': case 'vz-tegen-ja': case 'vz-tegen-nee': case 'vz-opnieuw': reageerOpVerzoek(a, spel.verzoeken.find(v => v.id === d.id)); break;
    case 'ploeg-erbij': spel.controle.ploegen.push({ mensen: 4, van: 7 * 60, tot: 19 * 60, lijnen: spel.lijnen.map(x => x.id) }); ververs(); break;
    case 'ploeg-weg': spel.controle.ploegen.splice(+d.i, 1); ververs(); break;
    case 'bewaar': bewaar(true); break;
    case 'nieuw': toonStart(); break;
    case 'perron-bouw': if (betaal(2.5e6, 'een perron')) { spel.perrons = spel.perrons || {}; spel.perrons[d.naam] = (spel.perrons[d.naam] || 0) + 1; melding(`Extra perron bij ${d.naam} gebouwd.`); ververs(); } break;
    case 'station-zelf': case 'station-prorail': {
      const p = paneelData; const naam = $('ns-naam').value.trim() || p.naam;
      if (a === 'station-zelf') {
        if (!betaal(6e6, 'een station')) break;
        spel.haltes.push({ id: S.nieuwId('h'), naam, modus: 'trein', x: p.x, y: p.y, eigen: true, gereedDag: spel.dag + 30 });
        melding(`Bouw van station ${naam} gestart. Klaar over 30 speldagen.`); eigenNetBijwerken(); sluitPaneel();
      } else {
        nieuwVerzoek(spel, { aan: 'prorail', aanNaam: 'ProRail', soort: 'station', x: p.x, y: p.y, naam, tekst: `Verzoek aan ProRail om station ${naam} te bouwen.` });
        melding('Verzoek naar ProRail gestuurd.'); openPaneel('verzoeken');
      }
      zetTool('kijk'); break;
    }
    case 'spoor-zelf': case 'spoor-prorail': {
      const p = paneelData; const sporen = +(document.querySelector('input[name="sporen"]:checked')?.value || 1);
      if (a === 'spoor-zelf') {
        const km = +d.km, kosten = km * (sporen === 2 ? 15e6 : 8e6);
        if (!betaal(kosten, 'het spoor')) break;
        spel.spoor.push({ punten: p.punten, sporen, eigenaar: 'speler', gereedDag: spel.dag + Math.round(60 + km * 8), klaar: false });
        melding(`Aanleg gestart (${S.euroKort(kosten)}).`); eigenNetBijwerken(); sluitPaneel();
      } else {
        nieuwVerzoek(spel, { aan: 'prorail', aanNaam: 'ProRail', soort: 'spoor', punten: p.punten, sporen, tekst: `Verzoek aan ProRail om ${sporen === 2 ? 'dubbel' : 'enkel'}spoor aan te leggen.` });
        melding('Verzoek naar ProRail gestuurd.'); openPaneel('verzoeken');
      }
      bouw = null; zetTool('kijk'); break;
    }
    case 'lijn-maak': maakNieuweLijn(); break;
    case 'lijn-annuleer': bouw = null; sluitPaneel(); zetTool('kijk'); break;
  }
}
function wijzig(w, i) {
  const l = i.dataset.id ? lijnVan(i.dataset.id) : null;
  const tijd = v => { const [h, m] = v.split(':').map(Number); let t = h * 60 + m; if (t < 4 * 60) t += 1440; return t; };
  switch (w) {
    case 'lijn-type': l.typeId = i.value; S.herbereken(l); break;
    case 'interval': l.interval[i.dataset.p] = Math.max(0, +i.value || 0) || 999; l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); break;
    case 'eerste': l.eerste = tijd(i.value); l.aangepast = true; S.herbereken(l); break;
    case 'laatste': l.laatste = tijd(i.value); l.aangepast = true; S.herbereken(l); break;
    case 'offset': l.offset = Math.max(-30, Math.min(30, +i.value || 0)); l.aangepast = true; S.herbereken(l); break;
    case 'conducteur': l.conducteur = i.checked; break;
    case 'chauffeur': l.chauffeurControle = i.checked; S.herbereken(l); break;
    case 'steekproef': spel.controle.steekproef = +i.value; break;
    case 'poortjes': {
      const n = spel.haltes.filter(h => h.modus === 'trein' || h.modus === 'metro').length + new Set(spel.lijnen.filter(x => x.modus === 'trein' || x.modus === 'metro').flatMap(x => x.haltes.map(h => h.naam))).size;
      if (i.checked && !spel.controle.poortjesBetaald) { if (!betaal(n * 250000, 'poortjes')) { i.checked = false; break; } spel.controle.poortjesBetaald = true; melding(`Poortjes geplaatst op ${n} stations (${S.euroKort(n * 250000)}).`); }
      spel.controle.poortjes = i.checked; break;
    }
    case 'chauffeur-alles': spel.controle.chauffeur = i.checked; break;
    case 'ploeg-mensen': spel.controle.ploegen[+i.dataset.i].mensen = Math.max(1, +i.value); break;
    case 'ploeg-van': spel.controle.ploegen[+i.dataset.i].van = tijd(i.value); break;
    case 'ploeg-tot': spel.controle.ploegen[+i.dataset.i].tot = tijd(i.value); break;
    case 'ploeg-lijn': { const p = spel.controle.ploegen[+i.dataset.i]; p.lijnen = i.checked ? [...new Set([...p.lijnen, i.dataset.id])] : p.lijnen.filter(x => x !== i.dataset.id); break; }
    case 'achtergrond': kaart.zetAchtergrond(i.value); jaarBijwerken(); $('bron').textContent = ACHTERGROND_KEUZE[i.value]?.bron || ''; break;
  }
  i.blur(); ververs(); eigenNetBijwerken();
}
function padOpnieuwNodig(l) {
  if (l.modus !== 'trein' || l.eigenSpoor) return;
  const gevraagd = Math.ceil(60 / Math.min(...Object.values(l.interval)));
  if (gevraagd > (l.paden || 0)) { l.actief = false; l.wacht = 'pad'; padAanvragen(l); melding('Meer treinen per uur vraagt nieuwe ruimte op het spoor. Aanvraag naar ProRail gestuurd.'); }
}
function padAanvragen(l) {
  nieuwVerzoek(spel, { aan: 'prorail', aanNaam: 'ProRail', soort: 'pad', lijnId: l.id, tekst: `Capaciteitsaanvraag voor lijn ${l.nr}: ${Math.ceil(60 / Math.min(...Object.values(l.interval)))} trein(en) per uur per richting.` });
}

function behandelAntwoord(vz) {
  const c = ctx();
  let r;
  if (vz.status === 'tegen-van-speler') r = beoordeelTegenOpAI(spel, vz);
  else if (vz.soort === 'verschuif') r = beoordeelVerschuiving(spel, vz, c);
  else if (vz.soort === 'pad') r = beoordeelPad(spel, vz, c);
  else if (vz.soort === 'spoor' || vz.soort === 'station') r = beoordeelBouw(spel, vz, c);
  else if (vz.soort === 'concessie') r = beoordeelConcessie(spel, vz, c);
  else r = { status: 'afgewezen', reden: 'Onbekend verzoek.' };
  vz.status = r.status; vz.reden = r.reden; vz.tegen = r.tegen; vz.gezien = false;
  if (r.status === 'geaccepteerd') voerUit(vz, vz.tegen || vz);
  melding(`Antwoord van ${vz.aan === 'speler' ? vz.vanNaam : (vz.aanNaam || vz.aan)}: ${r.status === 'geaccepteerd' ? 'akkoord' : r.status}.`);
  if (paneelSoort === 'verzoeken') ververs();
}
function voerUit(vz, waarde) {
  if (vz.soort === 'verschuif' || vz.soort === 'verschuif-jij') {
    if (vz.soort === 'verschuif-jij' || vz.status === 'tegen-van-speler') {
      const l = lijnVan(vz.lijnId); if (l) { l.offset += waarde.minuten; l.aangepast = true; S.herbereken(l); }
    } else {
      const a = AI.lijnen.find(x => x.sleutel === vz.aiSleutel);
      if (a) {
        const sl = `${a.vervoerder}:${a.lijnId}`;
        spel.aiVerschuiving = spel.aiVerschuiving || {};
        spel.aiVerschuiving[sl] = (spel.aiVerschuiving[sl] || 0) + waarde.minuten;
        for (const x of AI.lijnen) if (x.vervoerder === a.vervoerder && x.lijnId === a.lijnId) x.vertrek[0] = x.vertrek[0].map(v => v + waarde.minuten);
      }
    }
    const geld = waarde.vergoeding || 0;
    if (geld) { spel.afspraken = spel.afspraken || []; spel.afspraken.push({ met: vz.aanNaam || vz.vanNaam, bedrag: vz.aan === 'speler' ? geld : -geld, omschrijving: vz.tekst }); }
    const wie = vz.aan === 'speler' ? vz.van : vz.aan; spel.goodwill[wie] = (spel.goodwill[wie] || 0) + 2;
  }
  if (vz.soort === 'pad') {
    const l = lijnVan(vz.lijnId); if (!l) return;
    if (waarde.interval) { for (const p of Object.keys(l.interval)) l.interval[p] = Math.max(l.interval[p], waarde.interval); l.aangepast = true; S.herbereken(l); }
    l.paden = Math.ceil(60 / Math.min(...Object.values(l.interval))); l.actief = true; l.wacht = null;
  }
  if (vz.soort === 'spoor') spel.spoor.push({ punten: vz.punten, sporen: vz.sporen, eigenaar: 'prorail', gereedDag: spel.dag + (vz.bouwDagen || 120), klaar: false });
  if (vz.soort === 'station') spel.haltes.push({ id: S.nieuwId('h'), naam: vz.naam, modus: 'trein', x: vz.x, y: vz.y, eigen: false, gereedDag: spel.dag + 45 });
  if (vz.soort === 'concessie') {
    const l = lijnVan(vz.lijnId); if (!l) return;
    if (waarde.modus === 'belbus') { l.modus = 'belbus'; l.typeId = 'taxibus'; S.herbereken(l); }
    l.concessie = true;
  }
  eigenNetBijwerken();
}
function reageerOpVerzoek(a, vz) {
  if (!vz) return;
  const val = id => +($(id)?.value || 0);
  if (a === 'vz-ja') { vz.status = 'geaccepteerd'; vz.reden = 'Je hebt ingestemd.'; voerUit(vz, vz); spel.goodwill[vz.van] = (spel.goodwill[vz.van] || 0) + 5; melding('Akkoord gegeven; je lijn is verschoven.'); }
  if (a === 'vz-nee') { vz.status = 'afgewezen'; vz.reden = 'Je hebt het verzoek afgewezen.'; spel.goodwill[vz.van] = (spel.goodwill[vz.van] || 0) - 3; }
  if (a === 'vz-tegen') { vz.tegen = { minuten: val(`tv-min-${vz.id}`), vergoeding: val(`tv-geld-${vz.id}`) }; vz.status = 'tegen-van-speler'; vz.antwoordDag = spel.dag + spel.tijd / 1440 + 1; vz.reden = `Jouw tegenvoorstel: ${vz.tegen.minuten > 0 ? '+' : ''}${vz.tegen.minuten} min${vz.tegen.vergoeding ? `, ${S.euro(vz.tegen.vergoeding)} per jaar` : ''}.`; }
  if (a === 'vz-tegen-ja') { vz.status = 'geaccepteerd'; voerUit(vz, vz.tegen); vz.reden = (vz.reden || '') + ' — Je nam het tegenvoorstel aan.'; }
  if (a === 'vz-tegen-nee') { vz.status = 'afgewezen'; vz.reden = (vz.reden || '') + ' — Je liet het zitten.'; }
  if (a === 'vz-opnieuw') { vz.minuten = val(`tv-min-${vz.id}`); vz.vergoeding = val(`tv-geld-${vz.id}`); vz.status = 'open'; vz.antwoordDag = spel.dag + spel.tijd / 1440 + 1.5; vz.reden = ''; vz.tekst += ` Nieuw bod: ${vz.minuten > 0 ? '+' : ''}${vz.minuten} min, ${S.euro(vz.vergoeding)} per jaar.`; }
  ververs(); hud();
}

// ---------------------------------------------------------------- gereedschap
function zetTool(t) {
  tool = t; bouw = null;
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('aan', b.dataset.tool === t));
  if (t === 'kijk') hint(null);
  if (t === 'lijn') kiesModus();
  if (t === 'halte') hint('Wat voor halte?', [['Bushalte', () => halteModus('bus')], ['Tramhalte', () => halteModus('tram')], ['Steiger (veer)', () => halteModus('veer')], ['Watertaxi', () => halteModus('watertaxi')], ['Stoppen', () => zetTool('kijk')]]);
  if (t === 'station') hint('Klik op het spoor waar het station moet komen.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'perron') hint('Klik op een station om een perron toe te voegen.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'spoor') { bouw = { punten: [] }; hint('Klik punten voor het nieuwe spoor. Begin en eind sluiten aan op bestaand spoor.', [['Klaar', spoorKlaar], ['Laatste punt weg', () => { bouw.punten.pop(); }], ['Stoppen', () => zetTool('kijk')]]); }
}
function kiesModus() {
  const modi = [['trein', 'Trein'], ['metro', 'Metro'], ['sneltram', 'Sneltram'], ['tram', 'Tram'], ['bus', 'Bus'], ['hov', 'Snelbus'], ['belbus', 'Belbus'], ['veer', 'Veer'], ['watertaxi', 'Watertaxi'], ['vlucht', 'Vliegtuig']];
  hint('Wat voor lijn?', modi.map(([m, n]) => [n, () => {
    bouw = { modus: m, punten: [] };
    hint(`Klik de haltes van je ${MODI[m].naam.toLowerCase()}lijn op volgorde aan.${['bus', 'hov', 'belbus', 'veer', 'watertaxi'].includes(m) ? ' Klik je naast een halte, dan komt er automatisch een nieuwe.' : ''}`,
      [['Klaar', lijnKlaar], ['Laatste weg', () => bouw.punten.pop()], ['Stoppen', () => zetTool('kijk')]]);
  }]).concat([['Stoppen', () => zetTool('kijk')]]));
}
let halteSoort = 'bus';
function halteModus(m) { halteSoort = m; hint(`Klik op de kaart om een ${m === 'veer' ? 'steiger' : m === 'watertaxi' ? 'watertaxi-steiger' : m + 'halte'} te plaatsen.`, [['Stoppen', () => zetTool('kijk')]]); }

const HALTEKOSTEN = { bus: 15000, hov: 60000, belbus: 5000, tram: 400000, veer: 1.5e6, watertaxi: 100000 };
function plaatsNaam(x, y) {
  let beste = null, bd = 1e12;
  for (const p of D.plaatsen) { const d = Math.hypot(p[1] - x, p[2] - y) / Math.sqrt(Math.max(500, p[3])); if (d < bd) { bd = d; beste = p; } }
  return beste ? beste[0] : 'Halte';
}
function nieuweHalte(x, y, modus, stil) {
  if (modus === 'tram' && net.dichtsteKnoop(x, y, 'tram', spel.jaar, 60) == null) { melding('Een tramhalte moet aan tramspoor liggen. Klik dichter bij een tramlijn.'); return null; }
  const kosten = HALTEKOSTEN[modus] ?? 15000;
  if (!betaal(kosten, 'een halte')) return null;
  const pl = plaatsNaam(x, y);
  const n = spel.haltes.filter(h => h.naam.startsWith(pl)).length + 1;
  const h = { id: S.nieuwId('h'), naam: `${pl}, ${modus === 'veer' || modus === 'watertaxi' ? 'Steiger' : 'Halte'} ${n}`, modus, x, y, eigen: true, gereedDag: spel.dag };
  spel.haltes.push(h);
  if (!stil) melding(`${h.naam} geplaatst (${S.euro(kosten)}).`);
  eigenNetBijwerken();
  return h;
}

// welke bestaande haltes en stations passen bij een modus
function kandidaten(modus) {
  const uit = [];
  if (modus === 'vlucht') return D.vliegvelden.filter(v => v.s !== 'militair' && !(v.b && v.b > spel.jaar)).map(v => ({ naam: v.n, x: v.x, y: v.y, baan: v.baan, verhard: v.verhard, landing: v.landing, heli: v.s === 'heliport' }));
  const st = { trein: ['trein'], metro: ['metro', 'sneltram'], sneltram: ['sneltram', 'tram', 'metro'], tram: ['tram', 'sneltram'], bus: ['busstation'], hov: ['busstation'], belbus: ['busstation'], veer: ['veer'], watertaxi: ['veer'] }[modus];
  for (const s of D.stations) if (st.includes(s.s) && stationZichtbaar(s, spel.jaar)) uit.push({ naam: s.n, x: s.x, y: s.y, p: s.p });
  const bit = { trein: 1, metro: 2, sneltram: 6, tram: 4, bus: 8 | 32, hov: 8, belbus: 8 | 32, veer: 16, watertaxi: 16 }[modus];
  if (spel.jaar >= 2015) for (const h of D.haltes) if (h[3] & bit) uit.push({ naam: h[0], x: h[1], y: h[2] });
  for (const h of spel.haltes) if (h.gereedDag <= spel.dag && (h.modus === modus || (['bus', 'hov', 'belbus'].includes(modus) && ['bus', 'hov', 'belbus'].includes(h.modus)) || (modus === 'watertaxi' && h.modus === 'veer'))) uit.push({ naam: h.naam, x: h.x, y: h.y, eigen: h.id });
  return uit;
}
function dichtsteKandidaat(modus, px, py, maxPx = 18) {
  let beste = null, bd = maxPx;
  const [wx, wy] = kaart.wereld(px, py), bereik = maxPx * kaart.res * 1.6;
  for (const c of kandidaten(modus)) {
    if (Math.abs(c.x - wx) > bereik || Math.abs(c.y - wy) > bereik) continue;
    const [sx, sy] = kaart.scherm(c.x, c.y); const d = Math.hypot(sx - px, sy - py); if (d < bd) { bd = d; beste = c; }
  }
  return beste;
}

async function lijnKlaar() {
  if (!bouw || bouw.punten.length < 2) { melding('Kies minstens twee haltes.'); return; }
  const m = bouw.modus, p = bouw.punten;
  hint('Route zoeken…');
  let route, waarschuwing = '';
  if (['trein', 'metro', 'sneltram', 'tram'].includes(m)) {
    const pts = [], takken = []; let lengte = 0;
    for (let i = 1; i < p.length; i++) {
      const r = net.route([p[i - 1].x, p[i - 1].y], [p[i].x, p[i].y], m, spel.jaar);
      if (!r) { waarschuwing = `Geen ${m === 'trein' ? 'spoor' : 'rails'}verbinding tussen ${p[i - 1].naam} en ${p[i].naam}; daar tekent het spel een rechte lijn. Leg dat stuk spoor aan.`; pts.push(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y); lengte += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); continue; }
      pts.push(...r.pts); lengte += r.lengte; takken.push(...r.takken);
    }
    route = { pts, lengte, takken };
  } else if (m === 'veer' || m === 'watertaxi' || m === 'vlucht') {
    const pts = p.flatMap(h => [h.x, h.y]); let lengte = 0;
    for (let i = 1; i < p.length; i++) lengte += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    route = { pts, lengte };
  } else route = await wegRoute(p.map(h => [h.x, h.y]));
  bouw.route = route;
  hint(null);
  openPaneel('nieuweLijn', { modus: m, haltes: p.map(h => ({ naam: h.naam, x: h.x, y: h.y, ...(m === 'vlucht' ? { baan: h.baan, verhard: h.verhard, landing: h.landing, heli: h.heli } : {}) })), route, waarschuwing });
}
function maakNieuweLijn() {
  const d = paneelData;
  const spits = +$('nl-spits').value || 15, dal = +$('nl-dal').value || 30, avond = +$('nl-avond').value || 60;
  const eigenSpoor = d.route.takken?.length && d.route.takken.every(i => i >= 1e6);
  const l = S.maakLijn(spel, { nr: $('nl-nr').value.trim() || String(spel.lijnen.length + 1), naam: $('nl-naam').value.trim(), modus: d.modus, typeId: $('nl-type').value,
    haltes: d.haltes, route: d.route, interval: { vroeg: dal, ochtendspits: spits, dal, avondspits: spits, avond } });
  l.eigenSpoor = eigenSpoor;
  if ($('nl-koop').checked) {
    const t = TYPE[l.typeId], n = Math.max(0, l.nodig - (spel.voertuigen[l.typeId] || 0) + spel.lijnen.filter(x => x !== l && x.typeId === l.typeId && x.actief).reduce((s, x) => s + x.nodig, 0));
    if (n && betaal(n * t.prijs, 'materieel')) spel.voertuigen[l.typeId] = (spel.voertuigen[l.typeId] || 0) + n;
  }
  if (d.modus === 'trein' && !eigenSpoor) { l.actief = false; l.wacht = 'pad'; padAanvragen(l); }
  if ($('nl-concessie').checked) nieuwVerzoek(spel, { aan: 'provincie', aanNaam: 'Provincie', soort: 'concessie', lijnId: l.id, tekst: `Concessie en subsidie gevraagd voor lijn ${l.nr}.` });
  melding(`Lijn ${l.nr} ${l.actief ? 'rijdt vanaf nu' : 'wacht op ruimte op het spoor'}. Benodigd: ${l.nodig} voertuig(en).`);
  bouw = null; zetTool('kijk'); selectie = { lijn: l }; openPaneel('lijn', l);
}
function spoorKlaar() {
  if (!bouw || bouw.punten.length < 2) { melding('Klik minstens twee punten.'); return; }
  openPaneel('nieuwSpoor', { punten: bouw.punten.map(p => [Math.round(p.x), Math.round(p.y)]) });
  hint('Kies hoe je het spoor wilt laten aanleggen.', [['Stoppen', () => zetTool('kijk')]]);
}

function klik(px, py) {
  if (!spel) return;
  const x = kaart.wx(px), y = kaart.wy(py);
  if (tool === 'lijn' && bouw?.modus) {
    let c = dichtsteKandidaat(bouw.modus, px, py);
    if (!c && ['bus', 'hov', 'belbus', 'veer', 'watertaxi'].includes(bouw.modus)) {
      const h = nieuweHalte(x, y, bouw.modus === 'hov' || bouw.modus === 'belbus' ? 'bus' : bouw.modus, true);
      if (h) { c = { naam: h.naam, x, y, eigen: h.id }; melding(`Nieuwe halte ${h.naam} (${S.euro(HALTEKOSTEN[h.modus])}).`); }
    }
    if (!c) { melding(bouw.modus === 'trein' ? 'Hier is geen station. Bouw er een met ▣ Station, of klik dichter bij een station.' : 'Hier is geen halte voor deze modus. Klik dichter bij een halte.'); return; }
    if (bouw.punten.length && bouw.punten[bouw.punten.length - 1].naam === c.naam) return;
    bouw.punten.push(c);
    return;
  }
  if (tool === 'halte') { nieuweHalte(x, y, halteSoort); return; }
  if (tool === 'station') {
    const k = net.dichtsteKnoop(x, y, 'trein', spel.jaar, 40 * kaart.res + 60);
    if (k == null) { melding('Klik op of vlak bij het spoor.'); return; }
    const pl = plaatsNaam(k.x, k.y);
    openPaneel('nieuwStation', { x: Math.round(k.x), y: Math.round(k.y), naam: pl + (D.stations.some(s => s.n === pl) ? ' Zuid' : ''), plaats: pl });
    return;
  }
  if (tool === 'perron') {
    const c = dichtsteKandidaat('trein', px, py, 20);
    if (!c) { melding('Klik op een treinstation.'); return; }
    openPaneel('station', { naam: c.naam, p: c.p, eigen: !!c.eigen });
    return;
  }
  if (tool === 'spoor' && bouw) { bouw.punten.push({ x, y }); return; }
  // kijken: voertuig, eigen lijn of station selecteren
  let beste = null, bd = 12;
  for (const v of zichtLijnen) { const d = Math.hypot(v.px - px, v.py - py); if (d < bd) { bd = d; beste = v; } }
  if (beste) { if (beste.lijn.ai) openPaneel('aiLijn', beste.lijn); else { selectie = { lijn: beste.lijn }; openPaneel('lijn', beste.lijn); } return; }
  for (const l of spel.lijnen) {
    const pts = l.route.pts;
    for (let i = 2; i < pts.length; i += 2) {
      if (Math.abs(pts[i] - x) > 3000 && Math.abs(pts[i - 2] - x) > 3000) continue;
      const [ax, ay] = kaart.scherm(pts[i - 2], pts[i - 1]), [bx, by] = kaart.scherm(pts[i], pts[i + 1]);
      if (afstandTotLijnstuk(px, py, ax, ay, bx, by) < 6) { selectie = { lijn: l }; openPaneel('lijn', l); return; }
    }
  }
  const st = dichtsteKandidaat('trein', px, py, 10);
  if (st) openPaneel('station', { naam: st.naam, p: st.p, eigen: !!st.eigen });
}
function afstandTotLijnstuk(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const f = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - ax - dx * f, py - ay - dy * f);
}

// andere vervoerders uit hetzelfde jaar op de achtergrond opbouwen (alleen als er geen echte dienstregeling is)
let aiBezig = false;
async function historischeAI() {
  if (aiBezig) return; aiBezig = true;
  AI.lijnen = [];
  const jaar = spel.jaar;
  for (const v of vervoerdersIn(jaar)) {
    if (v.id === spel.vervoerder?.id || !spel || spel.jaar !== jaar) continue;
    const lijnen = await genereerVervoerder(v, jaar, D, net, D.plaatsen);
    for (const l of lijnen) AI.lijnen.push(Object.assign(l, { ai: true, vervoerder: v.id, vervoerderNaam: v.naam, sleutel: `${v.id}:${l.id}:0`, lijnId: l.id, kleur: v.kleur }));
  }
  aiBezig = false;
}
// rechte busroutes vervangen door echte wegroutes (rustig, één per seconde)
async function busroutesVerfijnen() {
  for (const l of spel.lijnen) {
    if (!l.route?.rechtLijnig) continue;
    const r = await wegRoute(l.haltes.map(h => [h.x, h.y]));
    if (r.weg) { l.route = r; S.herbereken(l); eigenNetBijwerken(); }
    await new Promise(res => setTimeout(res, 1100));
  }
}

// AI-dienstregelingen laden voor wat in beeld is
let laadTimer = 0;
function laadAIinBeeld() {
  clearTimeout(laadTimer);
  laadTimer = setTimeout(async () => {
    if (!spel || spel.jaar < 2020) return;
    const [x0, y0, x1, y1] = kaart.zicht(200);
    const eigen = spel.vervoerder?.id;
    const lijst = D.vervoerders.filter(v => v.id !== eigen && v.bbox && !(v.bbox[0] > x1 || v.bbox[2] < x0 || v.bbox[1] > y1 || v.bbox[3] < y0));
    for (const v of lijst) {
      const treinen = (v.modi.trein || 0) > 0;
      if (!treinen && kaart.res > 60) continue;
      if (!AI.geladen.has(v.id)) await laadVervoerderLijnen(v, spel.aiVerschuiving);
    }
  }, 400);
}

// ---------------------------------------------------------------- opslaan en laden
function vereenvoudig(pts, tol) {
  const n = pts.length / 2; if (n < 3) return pts;
  const houd = new Uint8Array(n); houd[0] = houd[n - 1] = 1;
  const stapel = [[0, n - 1]];
  while (stapel.length) {
    const [a, b] = stapel.pop(); const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1e-9; let ver = 0, idx = -1;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i * 2] - dx * pts[i * 2 + 1] + bx * ay - by * ax) / l; if (d > ver) { ver = d; idx = i; } }
    if (ver > tol && idx > 0) { houd[idx] = 1; stapel.push([a, idx], [idx, b]); }
  }
  const uit = []; for (let i = 0; i < n; i++) if (houd[i]) uit.push(pts[i * 2], pts[i * 2 + 1]); return uit;
}
const pakPts = pts => { const v = vereenvoudig(pts, 6), u = []; let px = 0, py = 0; for (let i = 0; i < v.length; i += 2) { const x = Math.round(v[i]), y = Math.round(v[i + 1]); u.push(x - px, y - py); px = x; py = y; } return u; };
const pakUit = d => { const u = []; let x = 0, y = 0; for (let i = 0; i < d.length; i += 2) { x += d[i]; y += d[i + 1]; u.push(x, y); } return u; };
function opslagVorm() {
  const kopie = { ...spel, lijnen: spel.lijnen.map(l => {
    const { cum, km, t, vertrek, _vangst, bbox, nodig, duur, lengteKm, stat, bezetting, ...rest } = l;
    if (l.bron && !l.aangepast) { delete rest.route; delete rest.echt; }
    else {
      if (rest.echt) rest.echt = { ...rest.echt, v: undefined };
      if (rest.route) rest.route = { d: pakPts(rest.route.pts), lengte: Math.round(rest.route.lengte), minSporen: l.route.takken ? net.minSporen(l.route.takken) : undefined, weg: rest.route.weg, rechtLijnig: rest.route.rechtLijnig };
    }
    rest.haltes = rest.haltes.map(h => ({ ...h, x: Math.round(h.x), y: Math.round(h.y) }));
    return rest;
  }) };
  return kopie;
}
async function bewaar(hand) {
  if (!spel) return;
  const vorm = opslagVorm();
  const samenvatting = `${spel.naam} · dag ${spel.dag + 1} · ${spel.jaar} · ${spel.lijnen.length} lijnen · ${S.euroKort(spel.geld)}`;
  slot = slot || S.nieuwId('s');
  const lokaal = Cloud.bewaarLokaal(slot, spel.naam, vorm, samenvatting);
  if (Cloud.gebruiker && (hand || performance.now() - laatsteOnline > 60000)) {
    laatsteOnline = performance.now();
    try { await Cloud.bewaarOnline(slot, spel.naam, vorm, samenvatting); if (hand) melding('Opgeslagen in je account.'); }
    catch (e) { if (hand) melding('Online opslaan mislukte: ' + (e.code === 'permission-denied' ? 'de database-regels voor Knooppunt staan nog niet in Firebase.' : e.message)); }
  } else if (hand) melding(lokaal ? 'Opgeslagen in deze browser. Log in om op elk apparaat verder te spelen.' : 'Opslaan in de browser lukte niet.');
}
async function laadSpel(data, nieuwSlot) {
  spel = data; slot = nieuwSlot;
  for (const l of spel.lijnen) {
    if (l.route?.d) l.route = { pts: pakUit(l.route.d), lengte: l.route.lengte, minSporen: l.route.minSporen, weg: l.route.weg, rechtLijnig: l.route.rechtLijnig };
    if (l.bron && !l.route) {
      const v = D.vervoerders.find(x => x.id === l.bron.vervoerder);
      if (v) { const ai = await laadVervoerderLijnen(v); const a = ai.find(x => x.lijnId === l.bron.lijnId && x.sleutel.endsWith(':0')); if (a) vulVanAI(l, a, ai); }
    }
    if (l.route) S.herbereken(l);
  }
  spel.lijnen = spel.lijnen.filter(l => l.route);
  if (spel.vervoerder) AI.lijnen = AI.lijnen.filter(x => x.vervoerder !== spel.vervoerder.id);
  for (const s of spel.spoor) if (s.klaar) net.voegEigenSpoorToe(s.punten, s.eigenaar, s.sporen, spel.jaar);
  begin();
}
function vulVanAI(l, a, alle) {
  const terug = alle.find(x => x.lijnId === a.lijnId && x !== a);
  l.haltes = a.haltes.map(h => ({ naam: h.naam, x: h.x, y: h.y }));
  l.route = { pts: a.route.pts, lengte: a.route.lengte };
  l.echt = { t: a.t, km: a.km, v: [a.vertrek[0], terug ? terug.vertrek[0] : a.vertrek[0].map(v => v + 3)] };
}

// ---------------------------------------------------------------- start
async function nieuwSpelStarten() {
  const soort = document.querySelector('#s-soort [aria-pressed="true"]').dataset.v;
  const jaar = +$('s-jaar').value;
  const naam = $('s-naam').value.trim() || 'Knooppunt Vervoer';
  let vervoerder = null, hist = null;
  if (soort === 'bestaand') {
    const keuze = document.querySelector('input[name="vervoerder"]:checked')?.value || '';
    const [bron, id] = keuze.split(':');
    if (bron === 'gtfs') vervoerder = D.vervoerders.find(v => v.id === id);
    if (bron === 'hist') hist = vervoerdersIn(jaar).find(v => v.id === id);
    if (!vervoerder && !hist) { melding('Kies eerst een vervoerder.'); return; }
  }
  $('s-start').disabled = true; $('s-start').textContent = 'Bezig…';
  spel = S.nieuwSpel({ naam: vervoerder?.naam || hist?.naam || naam, kleur: hist?.kleur || $('s-kleur').value, jaar, start: soort, vervoerder: vervoerder ? { id: vervoerder.id, naam: vervoerder.naam } : hist ? { id: hist.id, naam: hist.naam, hist: true } : null, kapitaal: 25e6 });
  if (hist) {
    const lijnen = await genereerVervoerder(hist, jaar, D, net, D.plaatsen, t => { $('s-start').textContent = t; });
    for (const l of lijnen) { l.gen = true; spel.lijnen.push(l); spel.voertuigen[l.typeId] = (spel.voertuigen[l.typeId] || 0) + Math.ceil(l.nodig * 1.1); }
    spel.geld = 25e6 + lijnen.length * 0.3e6;
    melding(`${hist.naam} in ${jaar}: ${lijnen.length} lijnen en ${Object.values(spel.voertuigen).reduce((s, n) => s + n, 0)} voertuigen uit die tijd.`, 7000);
    busroutesVerfijnen();
  }
  slot = S.nieuwId('s');
  if (vervoerder) {
    AI.lijnen = AI.lijnen.filter(a => a.vervoerder !== vervoerder.id); AI.geladen.delete(vervoerder.id);
    const lijnen = await laadVervoerderLijnen(vervoerder);
    AI.lijnen = AI.lijnen.filter(a => a.vervoerder !== vervoerder.id);
    const gedaan = new Set();
    for (const a of lijnen) {
      if (gedaan.has(a.lijnId) || !a.sleutel.endsWith(':0')) continue;
      gedaan.add(a.lijnId);
      const modus = MODI[a.modus] ? a.modus : 'bus';
      const l = { haltes: [], route: null };
      vulVanAI(l, a, lijnen);
      const lijn = S.maakLijn(spel, { nr: a.nr, naam: a.naam, modus, typeId: S.standaardTypeVoor(spel, modus), haltes: l.haltes, route: l.route, concessie: true });
      lijn.echt = l.echt; lijn.bron = { vervoerder: vervoerder.id, lijnId: a.lijnId }; lijn.paden = 99; S.herbereken(lijn);
    }
    for (const l of spel.lijnen) spel.voertuigen[l.typeId] = (spel.voertuigen[l.typeId] || 0) + Math.ceil(l.nodig * 1.08);
    spel.geld = 25e6 + spel.lijnen.length * 0.4e6;
    melding(`Je neemt ${spel.lijnen.length} lijnen van ${vervoerder.naam} over, met ${Object.values(spel.voertuigen).reduce((s, n) => s + n, 0)} voertuigen.`, 7000);
  }
  begin();
  const bb = vervoerder?.bbox || (hist && gebiedVan(hist));
  if (bb) { const b = bb; kaart.vliegNaar((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(b[2] - b[0], b[3] - b[1]) / Math.min(kaart.W, kaart.H) * 1.1); }
  else kaart.vliegNaar(140700, 470500, 18); // 't Gooi
  $('s-start').disabled = false; $('s-start').textContent = 'Spel starten';
}
function begin() {
  $('start').close();
  kaart.jaar = spel.jaar;
  if (spel.jaar < 1995 && kaart.achtergrond !== 'historisch' && kaart.klaar) { kaart.zetAchtergrond('historisch'); $('bron').textContent = ACHTERGROND_KEUZE.historisch.bron; }
  $('b-bedrijf').hidden = false; $('b-naam').textContent = spel.naam; $('b-kleur').style.background = spel.kleur;
  netwerkLagen(); hud(); laadAIinBeeld();
  if (spel.jaar < 2020) historischeAI();
  if (!spel.lijnen.length) setTimeout(() => melding('Tip: kies ＋ Lijn, dan Bus, en klik een paar plekken in een stad aan. Haltes komen er vanzelf bij.', 8000), 1200);
}

function vulVervoerders(jaar) {
  const modern = jaar >= 2020 && D.vervoerders.length;
  const MODNAAM = { trein: 'trein', bus: 'bus', tram: 'tram', metro: 'metro', veer: 'veer', belbus: 'belbus', vlucht: 'vliegtuig', sneltram: 'sneltram', hov: 'snelbus' };
  const lijst = modern
    ? D.vervoerders.map(v => ({ waarde: 'gtfs:' + v.id, naam: v.naam, info: `${v.lijnen} lijnen · ${Object.keys(v.modi).map(m => MODNAAM[m] || m).join(', ')} · echte dienstregeling` }))
    : vervoerdersIn(jaar).map(v => ({ waarde: 'hist:' + v.id, naam: v.naam, info: `${v.van}–${v.tot > 2050 ? 'nu' : v.tot} · ${v.modi.map(m => MODNAAM[m] || m).join(', ')}` }));
  $('s-vervoerders').innerHTML = lijst.length ? lijst.map((v, i) => `<label><input type="radio" name="vervoerder" value="${esc(v.waarde)}" ${i ? '' : 'checked'}> ${esc(v.naam)}<span>${esc(v.info)}</span></label>`).join('')
    + (modern ? '' : '<p class="klein" style="padding:6px 10px">Van dit jaar is geen echte dienstregeling bewaard. Het spel bouwt een lijnennet dat past bij het spoor, de plaatsen en het materieel van toen.</p>')
    : '<p class="klein" style="padding:8px 10px">De dienstregeling wordt nog verwerkt. Probeer het later of begin blanco.</p>';
}
function jaarUitleg(j) {
  if (j >= 2020) return 'Huidige situatie: echte dienstregeling van alle vervoerders rijdt mee.';
  if (j >= 1990) return 'Recent verleden: vervoerders en materieel van toen, met een nagebouwde dienstregeling.';
  return `Historisch: kaart uit ${kaartjaarVoor(j)}, opgeheven spoorlijnen zichtbaar, vervoerders en materieel van toen.`;
}
async function toonStart() {
  const dlg = $('start');
  if (!dlg.open) dlg.showModal();
  const jaar = $('s-jaar');
  jaar.oninput = () => { $('s-jaar-uit').textContent = jaar.value; $('s-jaar-uitleg').textContent = jaarUitleg(+jaar.value); vulVervoerders(+jaar.value); };
  const kiesSoort = v => { document.querySelectorAll('#s-soort button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('s-vervoerders').hidden = v !== 'bestaand'; };
  document.querySelectorAll('#s-soort button').forEach(b => b.onclick = () => kiesSoort(b.dataset.v));
  vulVervoerders(+jaar.value);
  $('s-start').onclick = nieuwSpelStarten;
  await toonAccount();
}
async function toonAccount() {
  const el = $('start-account');
  const u = Cloud.gebruiker;
  el.innerHTML = u ? `<p class="klein">Ingelogd als <b>${esc(u.displayName || u.email)}</b>. Je spellen worden in je account bewaard. <button class="knop" type="button" id="uitlog">Uitloggen</button></p>`
    : `<div class="inlogknoppen"><button class="knop" type="button" data-inlog="google">Inloggen met Google</button><button class="knop" type="button" data-inlog="microsoft">Inloggen met Microsoft</button></div><p class="klein">Inloggen bewaart je voortgang op elk apparaat. Zonder inlog bewaart het spel alleen in deze browser.</p>`;
  el.querySelectorAll('[data-inlog]').forEach(b => b.onclick = async () => { try { await Cloud.inloggen(b.dataset.inlog); } catch (e) { melding(e.message, 7000); } });
  $('uitlog')?.addEventListener('click', () => Cloud.uitloggen());
  // opgeslagen spellen
  const lokaal = Cloud.lijstLokaal().map(s => ({ ...s, waar: 'lokaal' }));
  let online = [];
  if (u) try { online = (await Cloud.lijstOnline()).map(s => ({ ...s, waar: 'online' })); } catch (e) { console.warn(e); }
  const alle = [...online, ...lokaal.filter(l => !online.some(o => o.slot === l.slot))].slice(0, 6);
  $('start-opgeslagen').innerHTML = alle.length ? `<div class="opgeslagen"><b>Verder spelen</b>${alle.map(s => `<button type="button" data-slot="${esc(s.slot)}" data-waar="${s.waar}">${esc(s.naam)}<small>${esc(s.samenvatting || '')} · ${s.waar === 'online' ? 'in je account' : 'in deze browser'}</small></button>`).join('')}</div>` : '';
  $('start-opgeslagen').querySelectorAll('[data-slot]').forEach(b => b.onclick = async () => {
    const data = b.dataset.waar === 'online' ? await Cloud.laadOnline(b.dataset.slot) : Cloud.laadLokaal(b.dataset.slot);
    if (data) laadSpel(data, b.dataset.slot); else melding('Dit spel kon niet worden geladen.');
  });
}

// ---------------------------------------------------------------- opstarten
function init() {
  kaart = new Kaart($('kaart'), { donker: DONKER });
  kaart.bijKlaar = () => netwerkLagen();
  kaart.lagenBoven.push(tekenBoven);
  kaart.bijKlik = klik;
  kaart.bijBeweeg = (px, py) => { if (bouw?.punten?.length) bouw.muis = [px, py]; };
  const oudVuil = Object.getOwnPropertyDescriptor(Kaart.prototype, 'vuil');
  void oudVuil;
  let vorigeZicht = '';
  setInterval(() => { const z = kaart.zicht().map(v => Math.round(v / 2000)).join(',') + kaart.res.toFixed(0); if (z !== vorigeZicht) { vorigeZicht = z; laadAIinBeeld(); } }, 700);
  $('bron').textContent = '';
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => zetTool(b.dataset.tool)));
  document.querySelectorAll('[data-paneel]').forEach(b => b.addEventListener('click', () => paneelSoort === b.dataset.paneel ? sluitPaneel() : openPaneel(b.dataset.paneel)));
  $('paneel-sluit').onclick = sluitPaneel;
  document.querySelectorAll('.snelheid button').forEach(b => b.addEventListener('click', () => zetSnelheid(+b.dataset.s)));
  addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); zetSnelheid(snelheid ? 0 : 1); }
    if (e.key === 'Escape') { zetTool('kijk'); sluitPaneel(); }
  });
  $('b-account').onclick = () => toonStart();
  $('start').addEventListener('cancel', e => { if (!spel) e.preventDefault(); });
  addEventListener('visibilitychange', () => { if (document.hidden) bewaar(); });
  zetSnelheid(1);
  Cloud.bijInlog(u => { $('b-account').textContent = u ? (u.displayName || u.email || 'Account').split(' ')[0] : 'Inloggen'; if ($('start').open) toonAccount(); });
  Cloud.start().catch(() => {});
  toonStart();
  laadData().then(() => { if ($('start').open) toonStart(); });
  requestAnimationFrame(lus);
}
function zetSnelheid(s) { snelheid = s; document.querySelectorAll('.snelheid button').forEach(b => b.classList.toggle('aan', +b.dataset.s === s)); }

init();
