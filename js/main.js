// OV-manager — opstarten, kaartlagen, gereedschap, spellus en panelen.
import { Kaart } from './kaart.js';
import { zetKaartjaren, kaartjaarVoor, rdNaarWgs, wgsNaarRd } from './geo.js';
import { netKleuren, spoorLagen, SPOOR_UIT, meters, THEMA } from './stijl.js';
import { Wegen } from './wegen.js';
import { bedenkAanbieding, bedient, toetsEisen, eisenTekst, vergoedingTekst, ramingTekst } from './subsidie.js';
import { STIJLEN, GROOTTE, stijlenVoor, gebouwPrijs, winkelHuur, plattegrond } from './gebouw.js';
import { busstationOntwerp } from './perron.js';
import { prestaties, vermogen, massa, doorloop, wiki } from './techniek.js';
import { perronVanaf } from './correcties.js';
import { SYSTEMEN, spanningVan, systemenVoorSoort, spanningenVan, kanOp, stroomCheck, baanvak, ombouwKostenStroom } from './stroom.js';
import { Perrons, ontwerpPerron, ontwerpVerdubbeling, ontwerpStation, doorsnedeTekst, binnen, perronLangs } from './perron.js';
import { lijnOpSpoor, rijBanen } from './spoorvolg.js';
import { maakOmloop, voertuigenOmloop, Opstel } from './omloop.js';
import { ritReizigers, bezettingKlassen } from './reizigers.js';
import { museumTypen, museumPrijs, isMuseum, gewonePrijs, belangstelling, inschrijvingen, vertrekOpDag, ritKosten, bedenkCharter } from './bijzonder.js';
import { interieurMeerprijs, inrichtingVan, klassenVan, vraagEffect, ombouwKosten, standaardInrichting, serieInrichting, BEEN, STOEL, CATERING, VOORZ, REST, KLASSEN, KLASSE_NAAM, kenmerk, registreerSeries, serieNaamVoorstel, zelfdeInterieur, basisId, uurKosten, wagonsVan, plaatsenPerWagon, voorzieningen, voorzMag, zetKlassePrijzen, klassePrijs, samenstelling, samenstellingVan, nodigPer, delenVan, restauratieOpen, zetJaar, STROOM, stroomMag, maxBreed } from './comfort.js';
import { uiterlijk, typeVoor, huiskleur, schemaLengte, tekenEcht, bakkenVan, vervoerderKleur, dof, tekenIcoon } from './voertuig.js';
import { Net, wegRoute, bboxVan } from './net.js';
import { MODI, VLOOT, TYPE, beschikbaar, beschikbaarLos, standaardType } from './vloot.js';
import * as S from './spel.js';
import { AI, laadVervoerderLijnen, nieuwVerzoek, beoordeelVerschuiving, beoordeelAanpassing, beoordeelPad, beoordeelBouw, beoordeelConcessie, beoordeelSubsidie,
  bedenkAIVerzoek, beoordeelTegenOpAI, gedeeldeHaltes, overstappen } from './ai.js';
import * as Cloud from './cloud.js';
import { muziekAan, muziekUit, muziekSpeelt } from './muziek.js';
import { Territorium } from './territorium.js';
import { vervoerdersIn, gebiedVan, stationsnaam, LIJNJAREN, LIJNJAREN_DEEL } from './historie.js';
import { genereerVervoerder } from './genereer.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const D = { stations: [], wissels: [], plaatsen: [], veren: [], haltes: [], vervoerders: [], vliegvelden: [], dag: '', ok: {} };
let net = new Net(null), kaart, spel = null, snelheid = 5, tijdLoopt = true, tool = 'kijk', slot = null, paneelSoort = null;
let bouw = null, selectie = null;

// ---------------------------------------------------------------- data laden
async function json(pad) {
  try { const r = await fetch(pad, { cache: 'no-cache' }); if (!r.ok) throw 0; D.ok[pad] = true; return await r.json(); }
  catch { D.ok[pad] = false; return null; }
}
// versie van het spel (versie.json wordt bij publiceren geschreven): rechtsonder en in het startscherm
fetch('versie.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(v => {
  const t = v ? `versie ${v.versie} · ${v.datum} · ${v.commit}` : 'lokale versie (niet gepubliceerd)';
  const el = document.getElementById('versie'); if (el) { el.textContent = t; if (v?.wijziging) el.title = 'Laatste wijziging: ' + v.wijziging; }
  const st = document.getElementById('s-versie'); if (st) st.textContent = 'Spel ' + t + (v?.wijziging ? ` — laatste wijziging: ${v.wijziging}` : '');
});
async function laadData() {
  const [spoor, st, w, pl, ve, ha, vv, hi, vl, pr] = await Promise.all(['data/spoor.json', 'data/stations.json', 'data/wissels.json',
    'data/plaatsen.json', 'data/veren.json', 'data/haltes.json', 'data/vervoerders.json', 'data/historie.json', 'data/vliegvelden.json', 'data/perrons.json'].map(json));
  const [po, hs, tr, sg, bb] = await Promise.all(['data/polders.json', 'data/historisch.json', 'data/trolley.json', 'data/stationsgebouwen.json', 'data/bebouwing.json'].map(json));
  D.bebouwing = bb; // bebouwing door de tijd (BAG): per cel van 100 m sinds wanneer bebouwd, met functie
  D.stationsgebouwen = (sg?.g || []).map(ontpakDelta); // bestaande stationsgebouwen en perrongebouwtjes (OSM)
  // bovenleiding voor trolleybussen: lijnen + raster (50 m) om bussen op die wegen te herkennen
  D.trolley = (tr?.w || []).map(w => ontpakDelta(w.d));
  D.trolleyNrs = new Set((tr?.w || []).flatMap(w => w.l || []));
  D.trolleyRaster = new Set();
  for (const p of D.trolley) for (let k = 0; k < p.length - 2; k += 2) { const n = Math.ceil(Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]) / 25); for (let q = 0; q <= n; q++) { const x = p[k] + (p[k + 2] - p[k]) * q / n, y = p[k + 1] + (p[k + 3] - p[k + 1]) * q / n; D.trolleyRaster.add(Math.floor(x / 50) + ',' + Math.floor(y / 50)); } }
  D.polders = (po?.p || []).map(p => ({ ...p, ringen: p.r.map(ontpak) }));
  D.historisch = hs || { l: [], s: [], n: [] };
  D.perrons = new Perrons(pr);
  for (const v of (spel?.perronVormen || []).filter(v => !v.weg)) D.perrons.voeg({ vlak: true, pts: v.pts, eigen: true });
  D.vliegvelden = (vl?.vliegvelden || []).filter(v => (v.g || 'NL') === 'NL').map(v => ({ ...v, b: Math.max(v.b || 0, landSinds(v.x, v.y)), landing: LANDING[v.s] ?? 60 }));
  net = new Net(spoor); S.zetNet(net);
  // spoor en stations in polders bestonden pas na de drooglegging
  for (const t of net.takken) {
    const m = t.pts.length >> 2 << 1, land = landSinds(t.pts[m], t.pts[m + 1]);
    if (!t.start) {
      // lijnen zonder startdatum in OSM: openingsjaar uit de lijst, metro en sneltram naar hun stad
      let nj = LIJNJAREN[net.namen[t.naam]];
      const x = t.pts[m], y = t.pts[m + 1];
      for (const [naam, test, jaar] of LIJNJAREN_DEEL) if (net.namen[t.naam] === naam && test(x, y)) nj = jaar;
      if (nj) t.start = nj;
      else if (t.soort === 2) t.start = x > 80000 && x < 105000 && y > 425000 && y < 450000 ? 1968 : 1977;
      else if (t.soort === 1) t.start = x > 125000 && x < 145000 && y > 440000 && y < 460000 ? 1983 : x > 70000 && x < 100000 ? 2006 : 1990;
    }
    if (land > (t.start || 0)) t.start = land;
    // in Flevoland (drooggevallen 1957/1968) kwam het eerste spoor pas met de Flevolijn
    if (land >= 1950 && t.soort === 0) t.start = Math.max(t.start || 0, 1987);
  }
  // naamloze stukjes (wissels, overloopjes, opstelsporen) zonder jaar die alleen aan jonger spoor vastzitten: zelfde jaar
  for (let ronde = 0; ronde < 4; ronde++) for (const t of net.takken) {
    if (t.start || t.soort > 4) continue;
    const buren = [...(net.buren.get(t.a) || []), ...(net.buren.get(t.b) || [])].filter(b => b.t !== t).map(b => b.t);
    if (buren.length && buren.every(b => b.start)) t.start = Math.min(...buren.map(b => b.start));
  }
  // verdwenen lijnen (OpenHistoricalMap) berijdbaar maken in hun eigen jaren
  net.voegHistorischToe((D.historisch.l || []).map(r => ({ soort: r[0], van: r[1] || 1800, tot: r[2], pts: ontpak(r.slice(4)) })));
  D.stations = st?.stations || [];
  for (const st of D.stations) {
    let b = landSinds(st.x, st.y);
    // stations aan een lijn die pas later kwam (alleen als er geen ouder spoor langs het station ligt)
    if (!st.b && (st.s === 'trein' || st.s === 'metro' || st.s === 'sneltram')) {
      let oudste = 9999;
      for (const t of net.tRaster.get(Math.floor(st.x / 1000) + ',' + Math.floor(st.y / 1000)) || []) {
        if (t.dienst || t.soort > 4) continue;
        const [x0, y0, x1, y1] = t.bbox; if (st.x < x0 - 60 || st.x > x1 + 60 || st.y < y0 - 60 || st.y > y1 + 60) continue;
        let d = Infinity;
        for (let k = 2; k < t.pts.length; k += 2) {
          const ax = t.pts[k - 2], ay = t.pts[k - 1], dx = t.pts[k] - ax, dy = t.pts[k + 1] - ay, l2 = dx * dx + dy * dy || 1e-9;
          const f = Math.max(0, Math.min(1, ((st.x - ax) * dx + (st.y - ay) * dy) / l2)); d = Math.min(d, Math.hypot(st.x - ax - dx * f, st.y - ay - dy * f));
        }
        if (d < 60) oudste = Math.min(oudste, t.start || 0);
      }
      if (oudste < 9999 && oudste > b) b = oudste;
    }
    if (b > (st.b || 0)) st.b = b;
  }
  D.wissels = w?.wissels || [];
  D.plaatsenAlle = (pl?.plaatsen || []).filter(p => (p[5] || 'NL') === 'NL'); // Caribisch Nederland volgt met de wereldkaart
  for (const p of D.plaatsenAlle) p.land = landSinds(p[1], p[2]);
  D.plaatsen = D.plaatsenAlle; S.zetPlaatsenVoorSnelheid(D.plaatsenAlle);
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
const ontpak = r => { const pts = []; let x = 0, y = 0; for (let i = 0; i < r.length; i += 2) { x += r[i]; y += r[i + 1]; pts.push(x, y); } return pts; };
// jaar waarin dit punt land werd (0 = altijd al land)
function landSinds(x, y) {
  for (const p of D.polders || []) for (const r of p.ringen) if (binnen(r, x, y)) return p.j;
  return 0;
}
const lijnGeo = pts => { const c = []; for (let k = 0; k < pts.length; k += 2) c.push(lonlat(pts[k], pts[k + 1])); return c; };
const NK = netKleuren();
const KD = false; // de kaart heeft één thema, ook in donkere modus
let wegen = null;
const ontpakDelta = d => { const u = [d[0], d[1]]; let x = d[0], y = d[1]; for (let k = 2; k < d.length; k += 2) { x += d[k]; y += d[k + 1]; u.push(x, y); } return u; };
// rijdt deze buslijn grotendeels onder de bovenleiding? Dan is het een trolleylijn
function isTrolley(l) {
  if (l._trolley !== undefined) return l._trolley;
  if (l.modus !== 'bus' || !D.trolleyRaster?.size) return (l._trolley = false);
  const p = l.route.pts; let n = 0, raak = 0;
  for (let k = 0; k < p.length; k += 2 * Math.max(1, Math.floor(p.length / 120))) { n++; if (D.trolleyRaster.has(Math.floor(p[k] / 50) + ',' + Math.floor(p[k + 1] / 50))) raak++; }
  // lijnnummer bekend als trolleylijn (OSM route=trolleybus): ruime overlap genoeg; anders bijna volledig onder de draad
  const bekend = D.trolleyNrs?.size ? D.trolleyNrs.has(String(l.nr)) : null;
  return (l._trolley = n > 4 && (bekend === true ? raak / n > 0.4 : bekend === false ? false : raak / n > 0.85));
}

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
  const sporen = { type: 'FeatureCollection', features: [...net.takken, ...net.eigen].filter(t => !t.weg).map(t => {
    const j = jaarVan(t), m = t.pts.length >> 2 << 1, land = landSinds(t.pts[m], t.pts[m + 1]);
    if (land > j.van) j.van = land; // in een polder: pas na de drooglegging
    return { type: 'Feature', properties: { k: klasseVan(t), ...j, n: t.sporen, h: t.hoogte || 0 }, geometry: { type: 'LineString', coordinates: lijnGeo(t.pts) } };
  }) };
  // (verdwenen lijnen uit OpenHistoricalMap zitten als takken in het net en worden hierboven al meegenomen)
  kaart.bron('spoor', sporen);
  kaart.bron('trolley', { type: 'FeatureCollection', features: (D.trolley || []).map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lijnGeo(p) } })) });
  kaart.bron('veren', { type: 'FeatureCollection', features: D.veren.map(v => ({ type: 'Feature', properties: { n: v.n }, geometry: { type: 'LineString', coordinates: lijnGeo(v.c) } })) });
  const w = [...D.wissels, ...net.eigen.flatMap(t => (t.wissels || []).flat())], wf = [];
  for (let i = 0; i < w.length; i += 2) wf.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lonlat(w[i], w[i + 1]) } });
  kaart.bron('wissels', { type: 'FeatureCollection', features: wf });
  // oude haltes (OpenHistoricalMap) op de plek van een huidig station: hun naam is de oude naam van dat station
  const hist = D.historisch.s.map(([ni, x, y, van, tot, soort]) => ({ n: D.historisch.n[ni] || '', x, y, van: van || 1800, tot, soort }));
  const SPOORSOORT = { trein: 'trein', metro: 'trein', sneltram: 'tram', tram: 'tram' };
  for (const st of D.stations) {
    if (!SPOORSOORT[st.s]) continue;
    st.oud = [];
    for (const h of hist) {
      if (Math.abs(h.x - st.x) > 200 || Math.abs(h.y - st.y) > 200 || Math.hypot(h.x - st.x, h.y - st.y) > 200) continue;
      if (SPOORSOORT[st.s] !== (h.soort === 'tram' ? 'tram' : 'trein')) continue;
      if (h.n && h.n !== st.n) st.oud.push([h.n, h.van, h.tot]);
      if (!st.b || st.b <= h.van) h.dubbel = true; // het huidige station toont die periode zelf (met de oude naam)
    }
  }
  const stf = D.stations.map(st => ({ type: 'Feature', properties: { n: stationsnaam(st.n, jaar, st.oud) + (st.e ? ' (opgeheven)' : ''), s: st.s, p: st.p || 0, van: Math.max(st.b || 0, landSinds(st.x, st.y)), tot: st.e === 1 ? 1990 : (st.e || 9999) }, geometry: { type: 'Point', coordinates: lonlat(st.x, st.y) } }));
  for (const h of hist) if (!h.dubbel) stf.push({ type: 'Feature', properties: { n: h.n, s: h.soort, p: 0, van: h.van, tot: h.tot }, geometry: { type: 'Point', coordinates: lonlat(h.x, h.y) } });
  // perrons: uit OpenStreetMap, en een eenvoudig perron voor (oude) stations waar er geen is ingetekend
  const pf = D.perrons.geojson(lonlat);
  // perrons bestaan pas sinds hun station (en hun polder)
  const stRaster = new Map();
  for (const st of D.stations) if (SPOORSOORT[st.s]) { const k = Math.floor(st.x / 300) + ',' + Math.floor(st.y / 300); if (!stRaster.has(k)) stRaster.set(k, []); stRaster.get(k).push(st); }
  const stationBij = (x, y) => { let b = null, bd = 250; for (let i = Math.floor(x / 300) - 1; i <= Math.floor(x / 300) + 1; i++) for (let j = Math.floor(y / 300) - 1; j <= Math.floor(y / 300) + 1; j++) for (const st of stRaster.get(i + ',' + j) || []) { const d = Math.hypot(st.x - x, st.y - y); if (d < bd) { bd = d; b = st; } } return b; };
  pf.features.forEach((f, i) => {
    const p = D.perrons.lijst[i], st = stationBij(p.pts[0], p.pts[1]);
    f.properties.van = Math.max(landSinds(p.pts[0], p.pts[1]), st?.b || 0, perronVanaf(D.stations, p.pts)); // historische correcties (bv. Hilversum 2007)
    f.properties.tot = st?.e && st.e > 1 ? st.e : 9999;
  });
  // stukjes van verdwenen lijnen in een raster van 250 m, om snel het dichtste spoor bij een oud station te vinden
  if (!D.histRaster) {
    D.histRaster = new Map();
    for (const r of D.historisch.l) {
      const l = { soort: r[0], van: r[1] || 1800, tot: r[2], pts: ontpak(r.slice(4)) };
      for (let k = 2; k < l.pts.length; k += 2) {
        const c = Math.floor((l.pts[k - 2] + l.pts[k]) / 500) + ',' + Math.floor((l.pts[k - 1] + l.pts[k + 1]) / 500);
        if (!D.histRaster.has(c)) D.histRaster.set(c, []);
        D.histRaster.get(c).push([l, k]);
      }
    }
  }
  const histRaster = D.histRaster;
  const maakPerron = (x, y, soort, van, tot) => {
    if (D.perrons.dichtbij(x, y, 60)) return;
    const tram = soort === 'tram';
    let pts = null;
    const raak = net.dichtsteTak(x, y, tram ? 'tram' : 'trein', Math.max(van, 1830), 70);
    if (raak) pts = raak.t.pts;
    else {
      let bd = 70;
      const ci = Math.floor(x / 250), cj = Math.floor(y / 250);
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++)
        for (const [l, k] of histRaster.get(i + ',' + j) || []) {
          if ((l.soort === 'tram') !== tram || l.tot <= van || l.van > tot) continue;
          const ax = l.pts[k - 2], ay = l.pts[k - 1], dx = l.pts[k] - ax, dy = l.pts[k + 1] - ay, l2 = dx * dx + dy * dy || 1e-9;
          const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), d = Math.hypot(x - ax - dx * f, y - ay - dy * f);
          if (d < bd) { bd = d; pts = l.pts; }
        }
    }
    if (!pts) return;
    const vlak = perronLangs(pts, x, y, tram ? 25 : (van < 1950 ? 110 : 160), tram ? 2.2 : 3.5);
    if (vlak) pf.features.push({ type: 'Feature', properties: { v: 1, van, tot, gemaakt: 1 }, geometry: { type: 'Polygon', coordinates: [lijnGeo(vlak)] } });
  };
  const gemaaktStart = pf.features.length;
  if (D.gemaakt) pf.features.push(...D.gemaakt);
  else {
  // kleinere stations: elk doorgaand spoor langs het station hoort een perron te hebben (OSM mist er soms één)
  const perronBijSporen = (st, van, tot) => {
    const gezien = new Set();
    for (let i = Math.floor(st.x / 1000) - 1; i <= Math.floor(st.x / 1000) + 1; i++) for (let j = Math.floor(st.y / 1000) - 1; j <= Math.floor(st.y / 1000) + 1; j++)
      for (const t of net.tRaster.get(i + ',' + j) || []) {
        if (gezien.has(t) || t.dienst || t.soort !== 0 || !net.bestaat(t, Math.max(van, 1900))) continue; gezien.add(t);
        // dichtste punt van dit spoor bij het station
        let bd = Infinity, bx = 0, by = 0, ux = 0, uy = 0;
        for (let k = 2; k < t.pts.length; k += 2) {
          const ax = t.pts[k - 2], ay = t.pts[k - 1], dx = t.pts[k] - ax, dy = t.pts[k + 1] - ay, l2 = dx * dx + dy * dy; if (l2 < 1e-6) continue;
          const f = Math.max(0, Math.min(1, ((st.x - ax) * dx + (st.y - ay) * dy) / l2)), px = ax + dx * f, py = ay + dy * f, d = Math.hypot(st.x - px, st.y - py);
          if (d < bd) { const l = Math.sqrt(l2); bd = d; bx = px; by = py; ux = dx / l; uy = dy / l; }
        }
        if (bd > 45) continue;
        const kant = z => { // wat ligt er naast dit spoor aan kant z (1 = links)?
          for (const off of [2.6, 3.5, 4.5]) { const px = bx - uy * off * z, py = by + ux * off * z; if (D.perrons.op(px, py)) return 'perron'; }
          for (const off of [3.5, 4.5, 5.5]) { const px = bx - uy * off * z, py = by + ux * off * z; const r = net.dichtsteTak(px, py, 'trein', Math.max(van, 1900), 1.2); if (r && r.t !== t) return 'spoor'; }
          return null;
        };
        const L = kant(1), R = kant(-1);
        if (L === 'perron' || R === 'perron') continue;
        const z = !L ? 1 : !R ? -1 : 0;
        if (!z) continue;
        const vlak = perronLangs(t.pts, bx - uy * 10 * z, by + ux * 10 * z, van < 1950 ? 110 : 160, 3.5);
        if (vlak) pf.features.push({ type: 'Feature', properties: { v: 1, van, tot, gemaakt: 1 }, geometry: { type: 'Polygon', coordinates: [lijnGeo(vlak)] } });
      }
  };
  for (const st of D.stations) if (st.s === 'trein' && (st.p || 2) <= 4 && D.perrons.dichtbij(st.x, st.y, 60)) perronBijSporen(st, Math.max(st.b || 0, landSinds(st.x, st.y)), st.e === 1 ? 1990 : (st.e || 9999));
  for (const st of D.stations) if (SPOORSOORT[st.s] && st.s !== 'busstation') maakPerron(st.x, st.y, SPOORSOORT[st.s], Math.max(st.b || 0, landSinds(st.x, st.y)), st.e === 1 ? 1990 : (st.e || 9999));
  for (const h of hist) if (!h.dubbel) maakPerron(h.x, h.y, h.soort === 'tram' ? 'tram' : 'trein', h.van, h.tot);
  D.gemaakt = pf.features.slice(gemaaktStart);
  }
  kaart.bron('perrons', pf);
  kaart.bron('stations', { type: 'FeatureCollection', features: stf });
  // polders die nog niet drooggelegd waren: water
  kaart.bron('polders', { type: 'FeatureCollection', features: (D.polders || []).map(p => ({ type: 'Feature', properties: { j: p.j, n: p.n }, geometry: { type: 'Polygon', coordinates: p.ringen.map(lijnGeo) } })) });
  kaart.bron('haltes', { type: 'FeatureCollection', features: D.haltes.filter(h => h[3] & (8 | 16 | 32)).map(h => ({ type: 'Feature', properties: { n: h[0], veer: h[3] & 16 ? 1 : 0 }, geometry: { type: 'Point', coordinates: lonlat(h[1], h[2]) } })) });
  kaart.bron('vliegvelden', { type: 'FeatureCollection', features: D.vliegvelden.map(v => ({ type: 'Feature', properties: { n: v.n, l: `${v.n}${v.baan ? ` · ${v.baan} m${v.verhard ? '' : ' gras'}` : ''}`, groot: v.baan >= 1800 ? 1 : 0, van: v.b || 0, tot: 9999, mil: v.s === 'militair' ? 1 : 0 }, geometry: { type: 'Point', coordinates: lonlat(v.x, v.y) } })) });
  eigenNetBijwerken();
  if (!lagenGemaakt) {
    lagenGemaakt = true;
    // perrons in lichtgrijs (stoeptegels), met een witte perronrand
    const PERRON = '#e2ded6', PERRONRAND = '#8f8a80';
    kaart.laag({ id: 'perron-vlak', type: 'fill', source: 'perrons', minzoom: 13, filter: ['all', ['==', ['get', 'v'], 1], jaarFilter(jaar)], paint: { 'fill-color': PERRON } });
    kaart.laag({ id: 'perron-rand', type: 'line', source: 'perrons', minzoom: 14, filter: ['all', ['==', ['get', 'v'], 1], jaarFilter(jaar)], paint: { 'line-color': PERRONRAND, 'line-width': meters(0.4, 0.6) } });
    kaart.laag({ id: 'perron-lijn', type: 'line', source: 'perrons', minzoom: 13, filter: ['==', ['get', 'v'], 0], layout: { 'line-cap': 'butt' }, paint: { 'line-color': PERRON, 'line-width': meters(4.5, 1.2) } });
    kaart.laag({ id: 'perron-eigen', type: 'fill', source: 'eigen-perrons', minzoom: 12, paint: { 'fill-color': ['case', ['==', ['get', 'weg'], 1], '#d9d6cf', ['==', ['get', 'klaar'], 1], PERRON, 'rgba(226,222,214,.55)'], 'fill-outline-color': ['case', ['==', ['get', 'weg'], 1], '#b9b4aa', spel?.kleur || '#c2412d'] } });
    // bebouwing door de tijd (BAG) in het eigen thema: één afbeelding (100 m per pixel) over heel Nederland
    if (D.bebouwing?.r && !kaart.map.getSource('bebouwing-hist') && typeof document !== 'undefined') {
      const c = D.bebouwing.cel || 100; let i0 = Infinity, i1 = -Infinity, j0 = Infinity, j1 = -Infinity;
      for (const r of D.bebouwing.r) { j0 = Math.min(j0, r[0]); j1 = Math.max(j1, r[0]); for (let q = 1; q < r.length; q += 4) { i0 = Math.min(i0, r[q]); i1 = Math.max(i1, r[q] + r[q + 1]); } }
      const cv = document.createElement('canvas'); cv.width = i1 - i0; cv.height = j1 - j0 + 1; cv.id = 'bebouwing-canvas';
      D.bebouwingVlak = { cv, i0, j0, j1, c };
      const x0 = i0 * c, x1 = i1 * c, y0 = j0 * c, y1 = (j1 + 1) * c;
      try {
        kaart.map.addSource('bebouwing-hist', { type: 'canvas', canvas: cv, animate: false, coordinates: [lonlat(x0, y1), lonlat(x1, y1), lonlat(x1, y0), lonlat(x0, y0)] });
        kaart.laag({ id: 'bebouwing-hist', type: 'raster', source: 'bebouwing-hist', layout: { visibility: 'none' }, paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } }, kaart.map.getLayer('zand-landuse') ? 'zand-landuse' : undefined);
      } catch (e) { console.warn('bebouwing', e); }
    }
    // stationsgebouwen en gebouwtjes op perrons (wachtkamers, winkels, horeca) in donkergrijs: herkenbaar als station
    const STATIONSGRIJS = '#55595e';
    if (!kaart.map.getSource('stationsgebouwen')) kaart.bron('stationsgebouwen', { type: 'FeatureCollection', features: (D.stationsgebouwen || []).map(v => { const c = []; for (let i = 0; i < v.length; i += 2) c.push(lonlat(v[i], v[i + 1])); return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c] } }; }) });
    kaart.laag({ id: 'stationsgebouw-osm', type: 'fill', source: 'stationsgebouwen', minzoom: 13, paint: { 'fill-color': STATIONSGRIJS, 'fill-outline-color': '#2f3134' } });
    if (!kaart.map.getSource('kruisingen')) kaart.bron('kruisingen', { type: 'FeatureCollection', features: [] });
    kaart.laag({ id: 'kruising-tekst', type: 'symbol', source: 'kruisingen', minzoom: 11, layout: { 'text-field': ['get', 't'], 'text-size': 11, 'text-offset': [0, -1.1], 'text-allow-overlap': false, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': ['case', ['==', ['get', 'e'], 1], spel?.kleur || '#c2412d', '#3c4147'], 'text-halo-color': '#fff', 'text-halo-width': 1.4, 'text-opacity': ['case', ['==', ['get', 'k'], 1], 1, 0.5] } });
    if (!kaart.map.getSource('gebouwen')) kaart.bron('gebouwen', { type: 'FeatureCollection', features: [] });
    kaart.laag({ id: 'gebouw-vlak', type: 'fill', source: 'gebouwen', minzoom: 12, paint: { 'fill-color': STATIONSGRIJS, 'fill-opacity': ['case', ['==', ['get', 'klaar'], 1], 0.95, 0.4] } });
    kaart.laag({ id: 'gebouw-rand', type: 'line', source: 'gebouwen', minzoom: 13, paint: { 'line-color': ['get', 'k'], 'line-width': 1.5 } });
    kaart.laag({ id: 'perron-voorstel', type: 'fill', source: 'perron-voorstel', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': 'rgba(255,255,255,.75)', 'fill-outline-color': '#111' } });
    kaart.laag({ id: 'perron-voorstel-spoor', type: 'line', source: 'perron-voorstel', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#111', 'line-width': 2.5, 'line-dasharray': [2, 1.5] } });
    kaart.laag({ id: 'hist-water', type: 'fill', source: 'polders', filter: ['>', ['get', 'j'], jaar], paint: { 'fill-color': THEMA.water } });
    kaart.laag({ id: 'hist-water-naam', type: 'symbol', source: 'polders', minzoom: 8, filter: ['>', ['get', 'j'], jaar], layout: { 'text-field': ['concat', ['get', 'n'], '\n(droog in ', ['to-string', ['get', 'j']], ')'], 'text-font': ['Noto Sans Italic'], 'text-size': 11 }, paint: { 'text-color': THEMA.waterTekst, 'text-halo-color': '#fff', 'text-halo-width': 1 } });
    // echte spoortjes (ver ingezoomd) onder alle netwerklagen
    for (const l of spoorLagen()) kaart.laag({ ...l, filter: ['all', l.filter, jaarFilter(jaar)] });
    const lijn = (id, bron, filter, kleur, breedte, extra = {}) => kaart.laag({ id, type: 'line', source: bron, ...(filter ? { filter } : {}), layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': kleur, 'line-width': breedte, ...(bron === 'spoor' ? { 'line-opacity': SPOOR_UIT } : {}), ...extra } });
    const zoomB = (a, b, c) => ['interpolate', ['linear'], ['zoom'], 6, a, 11, b, 16, c];
    const k = c => ['==', ['get', 'k'], c];
    lijn('net-veer', 'veren', null, NK.veer, zoomB(1, 1.6, 2.5), { 'line-dasharray': [3, 2.5] });
    // bovenleiding trolleybus: twee dunne draden boven de weg
    kaart.laag({ id: 'net-trolley', type: 'line', source: 'trolley', minzoom: 12, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#3c4147', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 17, 1.2], 'line-gap-width': ['interpolate', ['exponential', 2], ['zoom'], 12, 0.6, 17, 3, 20, 20], 'line-opacity': 0.75 } });
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
    // eigen spoor: uitgezoomd in de bedrijfskleur, ingezoomd zie je de rails (die zitten in de gewone spoorlaag)
    lijn('net-eigen-spoor', 'eigen-spoor', ['==', ['get', 'klaar'], 1], spel?.kleur || '#c2412d', zoomB(2, 3, 4), { 'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 13.5, 0] });
    lijn('net-eigen-bouw', 'eigen-spoor', ['==', ['get', 'klaar'], 0], spel?.kleur || '#c2412d', zoomB(2, 3, 4), { 'line-dasharray': [2, 2] });
    lijn('net-lijnen-halo', 'eigen-lijnen', null, '#ffffff', zoomB(4, 6, 9), { 'line-opacity': 0.75 });
    lijn('net-lijnen', 'eigen-lijnen', null, ['get', 'kl'], zoomB(2, 3.5, 6));
    kaart.laag({ id: 'net-wissels', type: 'circle', source: 'wissels', minzoom: 15, paint: { 'circle-radius': 2.4, 'circle-color': '#e0a516' } });
    kaart.laag({ id: 'net-haltes', type: 'circle', source: 'haltes', minzoom: 14, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.5, 18, 5], 'circle-color': ['case', ['==', ['get', 'veer'], 1], NK.veer, '#3d8b3d'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
    kaart.laag({ id: 'net-haltes-naam', type: 'symbol', source: 'haltes', minzoom: 16, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0.8, 0], 'text-anchor': 'left', 'text-optional': true }, paint: { 'text-color': KD ? '#c9d3cf' : '#2a3431', 'text-halo-color': NK.halo, 'text-halo-width': 1.2 } });
    const stFilter = ['all', jaarFilter(jaar)];
    kaart.laag({ id: 'net-stations', type: 'circle', source: 'stations', filter: ['all', jaarFilter(jaar), ['any', ['==', ['get', 's'], 'trein'], ['>=', ['zoom'], 12.5]]],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['case', ['==', ['get', 's'], 'trein'], ['case', ['>=', ['get', 'p'], 6], 3.5, 2], 1.5], 12, ['case', ['==', ['get', 's'], 'trein'], ['case', ['>=', ['get', 'p'], 6], 7, 5], 3.5], 16, ['case', ['==', ['get', 's'], 'trein'], 9, 5]],
        'circle-color': '#ffffff', 'circle-stroke-width': ['case', ['==', ['get', 's'], 'trein'], 2.2, 1.5],
        'circle-stroke-color': ['match', ['get', 's'], 'trein', KD ? '#9fd3c7' : '#173b3a', 'metro', NK.metro, 'sneltram', NK.snel, 'tram', NK.tram, 'veer', NK.veer, 'busstation', '#3d8b3d', '#555'] } });
    kaart.laag({ id: 'net-stations-naam', type: 'symbol', source: 'stations', filter: ['all', jaarFilter(jaar), ['any', ['all', ['==', ['get', 's'], 'trein'], ['any', ['>=', ['get', 'p'], 5], ['>=', ['zoom'], 9.5]]], ['>=', ['zoom'], 14]]],
      layout: { 'text-field': ['get', 'n'], 'text-font': ['case', ['==', ['get', 's'], 'trein'], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]], 'text-size': ['case', ['==', ['get', 's'], 'trein'], 12.5, 11], 'text-offset': [0.9, 0], 'text-anchor': 'left', 'symbol-sort-key': ['-', 0, ['get', 'p']], 'text-padding': 3 },
      paint: { 'text-color': KD ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    void stFilter;
    kaart.laag({ id: 'net-vlieg', type: 'symbol', source: 'vliegvelden', filter: ['any', ['==', ['get', 'groot'], 1], ['>=', ['zoom'], 8]],
      layout: { 'text-field': ['step', ['zoom'], '✈', 9, ['concat', '✈ ', ['get', 'l']]], 'text-font': ['Noto Sans Bold'], 'text-size': ['case', ['==', ['get', 'groot'], 1], 14, 12], 'text-allow-overlap': false, 'text-anchor': 'left', 'text-offset': [-0.4, 0] },
      paint: { 'text-color': ['case', ['==', ['get', 'mil'], 1], '#7d7a8c', '#5b4bb7'], 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    // geselecteerde lijn (eigen of van een ander): geel gemarkeerd met haltes
    kaart.bron('selectie', { type: 'FeatureCollection', features: [] }); kaart.bron('selectie-haltes', { type: 'FeatureCollection', features: [] });
    kaart.laag({ id: 'net-sel-halo', type: 'line', source: 'selectie', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1d2724', 'line-width': zoomB(7, 9, 12), 'line-opacity': 0.35 } });
    kaart.laag({ id: 'net-sel', type: 'line', source: 'selectie', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f2c14e', 'line-width': zoomB(4, 5.5, 8) } });
    kaart.laag({ id: 'net-sel-haltes', type: 'circle', source: 'selectie-haltes', paint: { 'circle-radius': 4.5, 'circle-color': '#fff', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#c48a12' } });
    kaart.laag({ id: 'net-sel-haltes-naam', type: 'symbol', source: 'selectie-haltes', minzoom: 9, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-optional': true },
      paint: { 'text-color': '#1d2724', 'text-halo-color': '#fff6d6', 'text-halo-width': 2 } });
    kaart.laag({ id: 'net-eigen-haltes', type: 'circle', source: 'eigen-haltes', paint: { 'circle-radius': ['case', ['==', ['get', 'm'], 'trein'], 7, 5], 'circle-color': '#fff', 'circle-stroke-width': 3, 'circle-stroke-color': spel?.kleur || '#c2412d', 'circle-opacity': ['case', ['==', ['get', 'klaar'], 1], 1, 0.6] } });
    kaart.laag({ id: 'net-eigen-haltes-naam', type: 'symbol', source: 'eigen-haltes', minzoom: 10, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [1, 0], 'text-anchor': 'left' }, paint: { 'text-color': KD ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
  }
  jaarBijwerken();
  if (!wegen) { wegen = new Wegen(kaart); wegen.start('grens'); }
  if (!territorium) { territorium = new Territorium(kaart); territorium.laad().then(territoriumBijwerken); }
}
// territorium: waar je haltes hebt (eigen haltes en de haltes van je lijnen)
let territorium = null;
function territoriumBijwerken() {
  if (!territorium) return;
  territorium.zetHaltes(spel ? [...spel.haltes.filter(h => h.eigen), ...spel.lijnen.flatMap(l => l.haltes || [])] : []);
}
// bebouwing van dat jaar op de afbeelding tekenen (kleur naar functie: wonen, winkels, bedrijven, voorzieningen)
function bebouwingTekenen(jaar) {
  const B = D.bebouwingVlak; if (!B || B.jaar === jaar) return; B.jaar = jaar;
  const k = B.cv.getContext('2d'), kl = [THEMA.bebouwd || '#d9705f', '#e0a04a', THEMA.industrie || '#c9655a', '#8e9ccc'];
  k.clearRect(0, 0, B.cv.width, B.cv.height);
  for (let f = 0; f < 4; f++) { k.fillStyle = kl[f]; for (const r of D.bebouwing.r) { const y = B.j1 - r[0]; for (let q = 1; q < r.length; q += 4) if (r[q + 3] === f && r[q + 2] <= jaar) k.fillRect(r[q] - B.i0, y, r[q + 1], 1); } }
  const src = kaart.map.getSource('bebouwing-hist'); if (src?.play) { src.play(); setTimeout(() => src.pause?.(), 50); }
}
function jaarBijwerken() {
  if (!lagenGemaakt) return;
  for (const l of spoorLagen()) kaart.map.setFilter(l.id, ['all', l.filter, jaarFilter(spel?.jaar ?? 2026)]);
  for (const id of ['hist-water', 'hist-water-naam']) kaart.map.setFilter(id, ['>', ['get', 'j'], spel?.jaar ?? 2026]);
  for (const id of ['perron-vlak', 'perron-rand']) kaart.map.setFilter(id, ['all', ['==', ['get', 'v'], 1], jaarFilter(spel?.jaar ?? 2026)]);
  const jaar = spel?.jaar ?? 2026, f = jaarFilter(jaar), m = kaart.map;
  const k = c => ['==', ['get', 'k'], c];
  for (const [id, c] of [['net-oud', 'oud'], ['net-zij', 'zij'], ['net-tram', 'tram'], ['net-smal', 'smal'], ['net-snel', 'snel'], ['net-metro', 'metro'], ['net-enkel', 'h1']]) m.setFilter(id, ['all', k(c), f]);
  const hoofd = ['all', ['match', ['get', 'k'], ['h1', 'h2', 'h3'], true, false], f];
  m.setFilter('net-hoofd', hoofd); m.setFilter('net-hoofd-halo', hoofd);
  m.setFilter('net-stations', ['all', f, ['any', ['==', ['get', 's'], 'trein'], ['>=', ['zoom'], 12.5]]]);
  m.setFilter('net-stations-naam', ['all', f, ['any', ['all', ['==', ['get', 's'], 'trein'], ['any', ['>=', ['get', 'p'], 5], ['>=', ['zoom'], 9.5]]], ['>=', ['zoom'], 14]]]);
  m.setLayoutProperty('net-oud', 'visibility', jaar < 2000 || kaart.achtergrond === 'historisch' ? 'visible' : 'none');
  // historische bebouwing (BAG) in plaats van de bebouwing en gebouwen van nu
  const hist = !!m.getLayer('bebouwing-hist') && jaar < 2020;
  if (m.getLayer('bebouwing-hist')) { m.setLayoutProperty('bebouwing-hist', 'visibility', hist ? 'visible' : 'none'); if (hist) bebouwingTekenen(jaar); }
  for (const id of ['bebouwd', 'industrie', 'gebouw', 'gebouw-schaduw']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', hist ? 'none' : 'visible');
  if (spel) for (const id of ['net-eigen-spoor', 'net-eigen-bouw']) m.setPaintProperty(id, 'line-color', spel.kleur);
  if (spel) m.setPaintProperty('net-eigen-haltes', 'circle-stroke-color', spel.kleur);
  kaart.jaar = jaar;
  historischUiterlijk(jaar);
}
// Oude jaren: gebouwen uit de BAG met bouwjaar (alleen ver ingezoomd), geen snelwegen vóór 1955, minder bebouwing
const origFilter = {};
function historischUiterlijk(jaar) {
  const m = kaart.map, oud = jaar < 2025;
  if (!m.getSource('bag')) {
    m.addSource('bag', { type: 'vector', tiles: ['https://api.pdok.nl/kadaster/bag/ogc/v2/tiles/WebMercatorQuad/{z}/{y}/{x}?f=mvt'], minzoom: 17, maxzoom: 17, tileSize: 512, // MapLibre accepteert alleen 512 voor vectortegels
      bounds: [3.2, 50.7, 7.3, 53.6], attribution: '© Kadaster (BAG)' });
    const voor = m.getLayer('gebouw') ? 'gebouw' : undefined;
    m.addLayer({ id: 'bag-schaduw', type: 'fill', source: 'bag', 'source-layer': 'pand', minzoom: 16, paint: { 'fill-color': 'rgba(60,25,20,0.35)', 'fill-translate': [3, 3], 'fill-antialias': false } }, voor);
    m.addLayer({ id: 'bag-pand', type: 'fill', source: 'bag', 'source-layer': 'pand', minzoom: 16, paint: { 'fill-color': THEMA.gebouw, 'fill-outline-color': THEMA.gebouwRand } }, voor);
  }
  const bouw = ['<=', ['to-number', ['get', 'bouwjaar'], 0], jaar];
  for (const id of ['bag-schaduw', 'bag-pand']) { m.setFilter(id, bouw); m.setLayoutProperty(id, 'visibility', oud ? 'visible' : 'none'); }
  for (const id of ['gebouw', 'gebouw-schaduw']) if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', oud ? 'none' : 'visible');
  if (m.getLayer('bebouwd')) m.setPaintProperty('bebouwd', 'fill-opacity', jaar >= 2000 ? 1 : 0.3 + 0.7 * Math.max(0, jaar - 1850) / 150);
  // snelwegen bestonden pas vanaf de jaren '30 en vooral na 1960
  const geenSnelweg = jaar < 1955;
  for (const id of ['tegelweg', 'tegelweg-rand']) {
    if (!m.getLayer(id)) continue;
    if (!(id in origFilter)) origFilter[id] = m.getFilter(id);
    m.setFilter(id, geenSnelweg ? ['all', origFilter[id], ['!=', ['get', 'class'], 'motorway']] : origFilter[id]);
  }
  for (const l of m.getStyle().layers.filter(l => l.source === 'wegen')) {
    if (!(l.id in origFilter)) origFilter[l.id] = m.getFilter(l.id) ?? null;
    const f = origFilter[l.id];
    m.setFilter(l.id, geenSnelweg ? (f ? ['all', f, ['!=', ['get', 's'], 'S']] : ['!=', ['get', 's'], 'S']) : f);
  }
}
// alle richtingen van een lijn: bij andere vervoerders zijn heen en terug losse lijnen met hetzelfde lijnnummer
const lijnGroep = l => !l ? [] : l.ai ? AI.lijnen.filter(x => x.vervoerder === l.vervoerder && x.lijnId === l.lijnId) : [l, ...(l.paar ? [lijnVan(l.paar)].filter(Boolean) : [])];
function selectieKaart() {
  if (!kaart?.map?.getSource?.('selectie')) return;
  const ls = lijnGroep(selectie?.lijn).filter(l => l.route?.pts?.length >= 4);
  kaart.bron('selectie', { type: 'FeatureCollection', features: ls.map(l => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lijnGeo(l.route.pts) } })) });
  const gezien = new Set(), hs = [];
  for (const l of ls) for (const h of l.haltes) if (!gezien.has(h.naam)) { gezien.add(h.naam); hs.push(h); }
  kaart.bron('selectie-haltes', { type: 'FeatureCollection', features: hs.map(h => ({ type: 'Feature', properties: { n: h.naam }, geometry: { type: 'Point', coordinates: lonlat(h.x, h.y) } })) });
}
function eigenNetBijwerken() {
  selectieKaart();
  if (!kaart?.klaar) return;
  const leeg = { type: 'FeatureCollection', features: [] };
  if (!kaart.map.getSource('perron-voorstel')) kaart.bron('perron-voorstel', leeg);
  try { territoriumBijwerken(); } catch (e) { console.warn('territorium', e); }
  if (!spel) { kaart.bron('eigen-spoor', leeg); kaart.bron('eigen-lijnen', leeg); kaart.bron('eigen-haltes', leeg); kaart.bron('eigen-perrons', leeg); return; }
  const vl = v => { const c = []; for (let i = 0; i < v.length; i += 2) c.push(lonlat(v[i], v[i + 1])); return c; };
  if (kaart.map.getSource('gebouwen')) kaart.bron('gebouwen', { type: 'FeatureCollection', features: (spel.gebouwen || []).flatMap(g => g.pts.map(v => ({ type: 'Feature', properties: { k: STIJLEN.find(x => x.id === g.stijl)?.kleur || '#999', klaar: isKlaar(g) ? 1 : 0 }, geometry: { type: 'Polygon', coordinates: [vl(v)] } }))) });
  kaart.bron('eigen-perrons', { type: 'FeatureCollection', features: (spel.perronVormen || []).map(v => {
    const c = []; for (let i = 0; i < v.pts.length; i += 2) c.push(lonlat(v.pts[i], v.pts[i + 1]));
    return { type: 'Feature', properties: { klaar: isKlaar(v) ? 1 : 0, weg: v.weg ? 1 : 0 }, geometry: { type: 'Polygon', coordinates: [c] } };
  }) });
  try { kruisingenTekenen(); } catch (e) { console.warn('kruisingen', e); }
  kaart.bron('eigen-spoor', { type: 'FeatureCollection', features: spel.spoor.map(sp => ({ type: 'Feature', properties: { klaar: sp.klaar ? 1 : 0 }, geometry: { type: 'LineString', coordinates: sp.punten.map(p => lonlat(p[0], p[1])) } })) });
  kaart.bron('eigen-lijnen', { type: 'FeatureCollection', features: spel.lijnen.filter(l => l.route?.pts?.length >= 4).map(l => ({ type: 'Feature', properties: { id: l.id, kl: !l.actief ? '#8a8f8c' : selectie?.lijn === l ? '#f2c14e' : spel.kleur }, geometry: { type: 'LineString', coordinates: lijnGeo(l.route.pts) } })) });
  kaart.bron('eigen-haltes', { type: 'FeatureCollection', features: spel.haltes.map(h => ({ type: 'Feature', properties: { n: h.naam + (!isKlaar(h) ? ' (in aanbouw)' : ''), m: h.modus, klaar: isKlaar(h) ? 1 : 0 }, geometry: { type: 'Point', coordinates: lonlat(h.x, h.y) } })) });
}

function stationZichtbaar(s, jaar) {
  if (s.b && s.b > jaar) return false;
  if (s.e === 1) return jaar < 1990;
  if (s.e && s.e <= jaar) return false;
  return true;
}

// bewegende laag: voertuigen en bouwgereedschap
const zichtLijnen = [];
globalThis.__ovTest = { zichtLijnen, get territorium() { return territorium; }, wegBij: (...a) => wegBij(...a), halteOpWeg: (...a) => halteOpWeg(...a), get spel() { return spel; }, get net() { return net; }, get omlopen() { return omlopen; }, get plaatsen() { return D.plaatsen; }, get stations() { return D.stations; }, get ai() { return AI; }, get paneel() { return paneelData; }, open: (a, b) => openPaneel(a, b), get bouw() { return bouw; }, get tool() { return tool; }, get kaart() { return kaart; }, dagVoorbij: () => dagVoorbij(), bouwOpleveren: () => bouwOpleveren(), hud: () => hud() }; // voor tests/rook.mjs
// ---------------------------------------------------------------- tunnels
// per route (lijn of rijbaan) eenmalig: waar ligt hij ondergronds? [s0, s1, ...] = stukken in meters langs de route
let tunnelBudget = 0;
function tunnelStukken(pad, modus) {
  if (pad._tunnelVan !== pad.route.pts) { pad._tunnel = undefined; pad._tunnelVan = pad.route.pts; }
  if (pad._tunnel !== undefined) return pad._tunnel;
  if (tunnelBudget-- <= 0) return null;
  const pts = pad.route.pts, cum = pad.cum, uit = [];
  let open = null, laatste = -1e9;
  for (let i = 0; i < cum.length; i++) {
    if (cum[i] - laatste < 40 && i < cum.length - 1) continue;
    laatste = cum[i];
    const d = net.dichtsteTak(pts[i * 2], pts[i * 2 + 1], modus, spel.jaar, 25);
    const onder = d?.t.hoogte === -1;
    if (onder && open === null) open = cum[i];
    if (!onder && open !== null) { uit.push(open, cum[i]); open = null; }
  }
  if (open !== null) uit.push(open, cum[cum.length - 1]);
  pad._tunnel = uit.length ? uit : 0;
  return pad._tunnel;
}
function ondergronds(v) {
  if (!['trein', 'metro', 'sneltram', 'tram'].includes(v.lijn.modus)) return false;
  const pad = v.baan || v.lijn;
  const st = tunnelStukken(pad, v.lijn.modus);
  if (!st) return false;
  for (let i = 0; i < st.length; i += 2) if (v.s >= st[i] && v.s <= st[i + 1]) return true;
  return false;
}

// ---------------------------------------------------------------- omlopen
let opstel = null, groepIdx = null, groepIdxSig = '';
const omlopen = new Map();
function groepIndex() {
  const sig = spel.lijnen.length + ':' + AI.lijnen.length;
  if (groepIdx && sig === groepIdxSig) return groepIdx;
  groepIdx = new Map(); groepIdxSig = sig;
  for (const l of [...spel.lijnen, ...AI.lijnen]) { if (isTrolley(l) && l._typ !== 'trolley') l._typ = undefined; const g = groepSleutel(l); if (!groepIdx.has(g)) groepIdx.set(g, []); groepIdx.get(g).push(l); }
  return groepIdx;
}
// omloop opnieuw als een dienstregeling, route of actief-status van een lijn in de groep veranderd is
function omloopVan(g, lijnen) {
  const c = omlopen.get(g);
  if (c && c.lijnen.length === lijnen.length && c.lijnen.every((l, i) => l === lijnen[i] && c.v[i] === l.vertrek && c.a[i] === l.actief && c.t[i] === (l.tr || l.t))) return c.om;
  const om = maakOmloop(lijnen); om.id = g;
  omlopen.set(g, { lijnen: [...lijnen], v: lijnen.map(l => l.vertrek), a: lijnen.map(l => l.actief), t: lijnen.map(l => l.tr || l.t), om });
  for (const l of lijnen) l._omloopN = om.voertuigen.length;
  return om;
}
// pool: vervoerder + soort vervoer + materieel
const groepSleutel = l => `${l.ai ? l.vervoerder : 'eigen'}:${l.modus}:${l.ai ? typeVoor(l, spel.jaar, standaardType) : l.typeId}`;
const lengteVan = l => uiterlijk(typeVoor(l, spel.jaar, standaardType), l.modus)._l || 20;
function tekenBoven(ctx, k) {
  if (!spel) return;
  const [x0, y0, x1, y1] = k.zicht(30);
  const r = k.res;
  const inZicht = l => !(l.bbox[0] > x1 || l.bbox[2] < x0 || l.bbox[1] > y1 || l.bbox[3] < y0);
  zichtLijnen.length = 0;
  const vt = [];
  const tm = spel.tijd;
  let snapBudget = 1; // per beeld hooguit één lijn op het spoor leggen (kost 0,1–0,3 s)
  // heen en terug elk op hun eigen spoor (opnieuw als de route is veranderd)
  const banenNodig = l => l._banenVan !== l.route?.pts && r < 40 && l.vertrek?.[1]?.length && ['trein', 'metro', 'sneltram', 'tram'].includes(l.modus);
  const opSpoorNodig = l => l._spoor === undefined && r < 40 && ['trein', 'metro', 'sneltram', 'tram'].includes(l.modus) && !l.route?.takken;
  // voertuigen per omloopgroep: ze rijden, keren, wachten of staan opgesteld, maar verdwijnen nooit
  if (!opstel || opstel.net !== net || opstel.jaar !== spel.jaar) opstel = new Opstel(net, spel.jaar);
  opstel.budget = 10; // nieuwe opstelroutes per beeld (elk ~2–10 ms)
  const idx = groepIndex();
  const gedaan = new Set();
  const doeGroep = (l, eigen) => {
    const g = groepSleutel(l);
    if (gedaan.has(g)) return; gedaan.add(g);
    const om = omloopVan(g, idx.get(g) || [l]);
    if (om) voertuigenOmloop(om, tm, vt, opstel, lengteVan, inZicht);
  };
  for (const l of spel.lijnen) {
    if (!l.actief || !inZicht(l)) continue;
    if (snapBudget > 0 && opSpoorNodig(l)) { snapBudget--; lijnOpSpoor(net, l, spel.jaar); if (l._spoor && l.echt) delete l.echt.km; }
    if (snapBudget > 0 && banenNodig(l)) { snapBudget--; rijBanen(net, l, spel.jaar); }
    doeGroep(l, true);
  }
  const eigenN = vt.length;
  for (const l of AI.lijnen) {
    if (!inZicht(l)) continue;
    // routes uit de dienstregeling op het echte spoor leggen (eenmalig per lijn, een paar per beeld)
    if (snapBudget > 0 && opSpoorNodig(l)) { snapBudget--; lijnOpSpoor(net, l, spel.jaar); }
    if (snapBudget > 0 && banenNodig(l)) { snapBudget--; rijBanen(net, l, spel.jaar); }
    if (r > 120 && l.modus !== 'trein') continue;
    if (r > 40 && (l.modus === 'bus' || l.modus === 'belbus')) continue;
    doeGroep(l, false);
  }
  // volgen: de kaart schuift mee met het gevolgde voertuig
  if (volg) { const e = vt.find(v => v.omloop === volg); if (e) { const [la, lo] = rdNaarWgs(e.x, e.y); if (zoomVolg) { zoomVolg = false; kaart.vliegNaar(e.x, e.y, Math.min(r, 3)); } else kaart.map.jumpTo({ center: [lo, la] }); } }
  tunnelBudget = 2;
  const selGroep = new Set(lijnGroep(selectie?.lijn));
  const maat = r < 3 ? 1.6 : r < 15 ? 1.25 : r < 60 ? 1 : 0.75;
  // hoek op het scherm: RD-noord valt vrijwel samen met kaart-noord in Nederland
  for (let i = vt.length - 1; i >= 0; i--) {
    const v = vt[i], eigen = i < eigenN;
    if (v.verborgen) continue; // in de remise of stalling
    ctx.globalAlpha = r < 60 && ondergronds(v) ? 0.38 : 1; // onder de grond: licht
    const [px, py] = k.scherm(v.x, v.y);
    if (px < -20 || py < -20 || px > k.W + 20 || py > k.H + 20) continue;
    const m = v.lijn.modus;
    let tid = typeVoor(v.lijn, spel.jaar, standaardType);
    if (eigen && v.lijn.altTypeId) { // een deel van de ritten met het alternatieve materieel
      const d = v.lijn._altD ?? (v.lijn._altD = S.altDeel(spel, v.lijn));
      if (d && Math.abs(Math.round(v.vertrek * 7 + v.r * 3)) % 100 < d * 100) tid = v.lijn.altTypeId;
    }
    let u = uiterlijk(tid, m);
    const dep = v.wacht && v.volgende ? v.volgende.dep : v.vertrek, eh = S.eenheden(v.lijn, spel.dag, dep);
    if (eh > 1) u = { ...u, bakken: [...u.bakken, ...u.bakken], _l: u._l * 2 + (u._tussen || 1) }; // gekoppeld in de spits
    const kleur = eigen ? spel.kleur : huiskleur(v.lijn, u);
    const lang = schemaLengte(u._l) * Math.min(maat, 1.25);
    if (u._l / r >= lang && m !== 'vlucht') {
      // ingezoomd: ware lengte en bovenaanzicht
      tekenEcht(ctx, k, v, u, kleur, eigen);
      if (tid === 'trolley') { // stroomafnemers: twee stangen schuin naar achteren naar de bovenleiding
        const pm = 1 / r; ctx.save(); ctx.translate(px, py); ctx.rotate(-v.hoek); ctx.strokeStyle = '#2b2f33'; ctx.lineWidth = Math.max(1, 0.12 * pm);
        ctx.beginPath(); for (const z of [-0.35, 0.35]) { ctx.moveTo(-1 * pm, z * pm); ctx.lineTo(-6.5 * pm, z * 1.6 * pm); } ctx.stroke(); ctx.restore();
      }
    } else {
      // ver uitgezoomd: pictogram in de kleur van de vervoerder; spelers fel met witte rand, computerbedrijven doffer
      const breed = (m === 'trein' ? 5.5 : m === 'bus' || m === 'hov' || m === 'belbus' ? 6 : 5) * maat;
      const ilang = Math.max(lang, ({ trein: 20, metro: 16, tram: 15, sneltram: 16 }[m] || 11) * maat);
      const vk = eigen ? spel.kleur : dof(vervoerderKleur(v.lijn.vervoerderNaam || ''));
      ctx.save(); ctx.translate(px, py); ctx.rotate(-v.hoek);
      const rand = eigen ? '#fff' : 'rgba(0,0,0,.45)', dik = eigen ? 1.4 : 0.7;
      if (m === 'vlucht' || m === 'veer' || m === 'watertaxi') {
        ctx.fillStyle = vk; ctx.strokeStyle = rand; ctx.lineWidth = dik;
        if (m === 'vlucht') { ctx.beginPath(); ctx.moveTo(9 * maat, 0); ctx.lineTo(-6 * maat, 7 * maat); ctx.lineTo(-3 * maat, 0); ctx.lineTo(-6 * maat, -7 * maat); ctx.closePath(); }
        else { ctx.beginPath(); ctx.moveTo(lang / 2, 0); ctx.lineTo(-lang / 2, breed); ctx.lineTo(-lang / 2, -breed); ctx.closePath(); }
        ctx.fill(); ctx.stroke();
      } else tekenIcoon(ctx, m, ilang, breed, vk, rand, dik);
      ctx.restore();
    }
    if (r < 2.5 && v.lijn.nr) {
      ctx.font = '600 10px "Barlow Semi Condensed", sans-serif'; ctx.fillStyle = KD ? '#e6ece9' : '#1d2724';
      ctx.fillText(v.lijn.nr, px + 8, py - 7);
    }
    if (v.omloop && (v.omloop === selectie?.voertuig || v.omloop === volg)) { ctx.beginPath(); ctx.arc(px, py, 13, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = '#f2c14e'; ctx.stroke(); }
    else if (selGroep.has(v.lijn) && !v.wacht) { ctx.beginPath(); ctx.arc(px, py, 9, 0, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = '#c48a12'; ctx.stroke(); }
    v.px = px; v.py = py;
    zichtLijnen.push(v);
  }
  ctx.globalAlpha = 1;
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
let hudN = 0, vorige = performance.now(), hudT = 0, laatsteOnline = 0;
function lus(nu) {
  const dt = Math.min(0.25, (nu - vorige) / 1000); vorige = nu;
  if (spel && snelheid && tijdLoopt) {
    const oud = spel.tijd;
    spel.tijd += dt * snelheid / 60;
    // elk vol uur afrekenen
    for (let u = Math.floor(oud / 60) + 1; u <= Math.floor(spel.tijd / 60); u++) uurVoorbij(u * 60 - 60);
    if (spel.tijd >= 29 * 60) dagVoorbij(); // speldag loopt van 05:00 tot 05:00 (nacht 00:30–05:00)
    if (Math.floor(oud) !== Math.floor(spel.tijd)) { bouwOpleveren(); verzoekenAfhandelen(); } // elke spelminuut
  }
  kaart.render();
  hudT += dt; if (hudT > 0.25) { hudT = 0; hud(); }
  requestAnimationFrame(lus);
}
function uurVoorbij(uurBegin) {
  for (const l of spel.lijnen) delete l._altD;
  S.verrekenUur(spel, ctx(), uurBegin);
  verzoekenAfhandelen();
  aanbiedingenToetsen();
  if (paneelSoort === 'geld' || paneelSoort === 'lijnen') ververs();
}
// ---------------------------------------------------------------- bouwen
// Alles wat je bouwt (station, perron, spoor, verdubbeling) is na 2 speluren klaar: bij 100× ruim een minuut.
const BOUWTIJD = 120;
const nuMin = () => spel.dag * 1440 + spel.tijd - 300;          // spelminuten sinds de start (dag begint om 05:00)
const gereedMin = x => x.gereedMin ?? x.gereedDag * 1440;       // oude opslag: hele dagen
const isKlaar = x => gereedMin(x) <= nuMin();
const bouwKlaar = () => ({ startMin: Math.round(nuMin()), gereedMin: Math.round(nuMin()) + BOUWTIJD, gereedDag: spel.dag });
function bouwOpleveren() {
  let iets = false;
  for (const s of spel.spoor) if (!s.klaar && isKlaar(s)) {
    s.klaar = true; iets = true;
    const t = net.voegEigenSpoorToe(s.punten.map(p => [p[0], p[1]]), s.eigenaar, s.sporen + (s.extraSporen || 0), spel.jaar, s.soort || 0, s.dienst || 0); s.takId = t.i;
    if (s.verdubbelt != null && net.takken[s.verdubbelt]) net.takken[s.verdubbelt].sporen = s.nieuwSporen || 2;
    if (!s.project || !spel.spoor.some(x => x !== s && x.project === s.project && !x.klaar)) melding(`Opgeleverd: ${s.projectNaam || `${komma(t.lengte / 1000)} km ${s.sporen === 2 ? 'dubbel' : 'enkel'}spoor`} (${s.eigenaar === 'speler' ? 'van jou' : 'ProRail'}).`);
  }
  for (const h of spel.haltes) if (!h.opgeleverd && ['trein', 'metro'].includes(h.modus) && (h.gereedMin != null || h.gereedDag > 0) && isKlaar(h)) {
    h.opgeleverd = true;
    if (h.startMin != null) { iets = true; const op = stationInStoptreinen(h); melding(`${h.naam} is klaar${op.length ? ` en wordt nu bediend door ${op.slice(0, 6).join(', ')}${op.length > 6 ? ' …' : ''}` : ''}.`, 9000); }
  }
  for (const b of spel.bovenleiding || []) if (!b.klaar && isKlaar(b)) { b.klaar = true; iets = true; bovenleidingToevoegen(b.punten); if (b.kosten) melding(`Opgeleverd: ${b.projectNaam}.`); }
  for (const g of spel.gebouwen || []) if (!g.opgeleverd && isKlaar(g)) { g.opgeleverd = true; iets = true; for (const l of [...spel.lijnen, ...AI.lijnen]) l._vangst = null; melding(`Het stationsgebouw van ${g.station} is klaar.`); }
  if (iets) { netwerkLagen(); eigenNetBijwerken(); if (paneelSoort === 'bouw' || paneelSoort === 'station') ververs(); }
}
// ---------------------------------------------------------------- stations in lijnen
// plek van (x,y) langs een route: afstand tot de route en positie s (m langs de punten)
function projecteer(pts, x, y) {
  let bd = Infinity, bs = 0, cum = 0;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], dx = pts[k] - ax, dy = pts[k + 1] - ay, l2 = dx * dx + dy * dy, l = Math.sqrt(l2);
    if (l2 < 1e-6) continue;
    const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), d = Math.hypot(x - ax - dx * f, y - ay - dy * f);
    if (d < bd) { bd = d; bs = cum + f * l; }
    cum += l;
  }
  return { d: bd, s: bs };
}
// alle stations van deze soort (bestaand en eigen, klaar)
function stationsVan(modus) {
  const soort = modus === 'metro' ? ['metro', 'sneltram'] : ['trein'];
  const uit = D.stations.filter(st => soort.includes(st.s) && stationZichtbaar(st, spel.jaar)).map(st => ({ naam: st.n, x: st.x, y: st.y }));
  for (const h of spel.haltes) if (h.modus === modus && isKlaar(h)) uit.push({ naam: h.naam, x: h.x, y: h.y });
  return uit;
}
// stopt deze lijn op alle stations langs zijn route (stoptrein)? 'zonder' = stations die niet meetellen
function isStoptrein(l, zonder = []) {
  const pts = l.route?.pts; if (!pts || pts.length < 4 || l.haltes.length < 2) return false;
  const s0 = projecteer(pts, l.haltes[0].x, l.haltes[0].y).s, s1 = projecteer(pts, l.haltes.at(-1).x, l.haltes.at(-1).y).s;
  const [lo, hi] = [Math.min(s0, s1) + 150, Math.max(s0, s1) - 150];
  const [x0, y0, x1, y1] = l.bbox || bboxVan(pts);
  let gezien = 0;
  for (const st of stationsVan(l.modus)) {
    if (zonder.includes(st.naam) || st.x < x0 - 200 || st.x > x1 + 200 || st.y < y0 - 200 || st.y > y1 + 200) continue;
    const p = projecteer(pts, st.x, st.y);
    if (p.d > 120 || p.s < lo || p.s > hi) continue;
    gezien++;
    if (!l.haltes.some(h => h.naam === st.naam || Math.hypot(h.x - st.x, h.y - st.y) < 250)) return false; // slaat een station over
  }
  return gezien > 0 || l.haltes.length >= 3;
}
// station invoegen op de juiste plek langs de route (alleen als het op de route ligt); geeft true als het lukte
function stationInvoegen(l, st) {
  const pts = l.route?.pts; if (!pts) return false;
  if (l.haltes.some(h => h.naam === st.naam && Math.hypot(h.x - st.x, h.y - st.y) < 300)) return false;
  const p = projecteer(pts, st.x, st.y); if (p.d > 150) return false;
  const sH = l.haltes.map(h => projecteer(pts, h.x, h.y).s);
  let i = sH.findIndex(v => v > p.s); if (i <= 0) return false; // niet voorbij de eindpunten
  const h = { naam: st.naam, x: st.x, y: st.y };
  if (l.ai) { // lijn van een andere vervoerder: km en rijtijd tussen de buren inschatten
    const f = (p.s - sH[i - 1]) / Math.max(1, sH[i] - sH[i - 1]);
    l.haltes.splice(i, 0, h);
    if (l.km) l.km.splice(i, 0, l.km[i - 1] + (l.km[i] - l.km[i - 1]) * f);
    if (l.t) { const t = l.t[i - 1] + (l.t[i] - l.t[i - 1]) * f; l.t.splice(i, 0, t); for (let j = i + 1; j < l.t.length; j++) l.t[j] += 45; l.duur = Math.max(60, l.t.at(-1)); }
  } else { l.haltes.splice(i, 0, h); if (l.echt) l.aangepast = true; S.herbereken(l); }
  l._vangst = null; l._banenVan = null; l._banen = null;
  return true;
}
// nieuw station: opnemen in alle stoptreinen (eigen en van anderen) die er al langs rijden
function stationInStoptreinen(h) {
  const op = [];
  for (const l of [...spel.lijnen.filter(x => !x.bijzonder), ...AI.lijnen]) {
    if (l.modus !== h.modus || !isStoptrein(l, [h.naam])) continue;
    if (stationInvoegen(l, h)) op.push(`${l.ai ? (l.vervoerderNaam || '') + ' ' : ''}${l.nr || l.naam}`.trim());
  }
  spel.nieuweStations = spel.nieuweStations || [];
  if (!spel.nieuweStations.some(x => x.naam === h.naam)) spel.nieuweStations.push({ naam: h.naam, x: h.x, y: h.y, modus: h.modus });
  return [...new Set(op)];
}
// lijnen van anderen worden opnieuw ingeladen: daar de nieuwe stations weer in opnemen
function nieuweStationsInAI(vervoerderId) {
  for (const h of spel.nieuweStations || []) for (const a of AI.lijnen) if (a.vervoerder === vervoerderId && a.modus === h.modus && isStoptrein(a, [h.naam])) stationInvoegen(a, h);
}
// een halte of station toevoegen aan een eigen lijn: op de route ingevoegd, anders op de plek met de kleinste omweg
async function halteToevoegen(l, c) {
  if (l.haltes.some(h => h.naam === c.naam)) { melding(`${c.naam} zit al in lijn ${l.nr}.`); return; }
  if (stationInvoegen(l, c)) { melding(`${c.naam} toegevoegd aan lijn ${l.nr}.`); ververs(); return; }
  let bi = 1, bk = Infinity;
  for (let i = 0; i <= l.haltes.length; i++) {
    const a = l.haltes[i - 1], b = l.haltes[i], d = (q, r) => q && r ? Math.hypot(q.x - r.x, q.y - r.y) : 0;
    const k = d(a, c) + d(c, b) - d(a, b) + (!a || !b ? d(a || b, c) * 0.6 : 0); // aan het eind verlengen is ook mogelijk
    if (k < bk) { bk = k; bi = i; }
  }
  l.haltes.splice(bi, 0, { naam: c.naam, x: c.x, y: c.y });
  hint('Route zoeken…');
  const { route, waarschuwing } = await routeVoor(l.modus, l.haltes);
  hint(null);
  l.route = route; if (l.echt) l.aangepast = true; S.herbereken(l); l._vangst = null; l._banenVan = null; l._banen = null;
  melding(`${c.naam} toegevoegd aan lijn ${l.nr} (tussen ${l.haltes[bi - 1]?.naam || 'begin'} en ${l.haltes[bi + 1]?.naam || 'eind'}).${waarschuwing ? ' ' + waarschuwing : ''}`, 7000);
  ververs(); eigenNetBijwerken();
}
async function halteWeghalen(l, i) {
  if (l.haltes.length <= 2) { melding('Een lijn heeft minstens twee haltes.'); return; }
  const [weg] = l.haltes.splice(i, 1);
  if (i === 0 || i === l.haltes.length) { const { route } = await routeVoor(l.modus, l.haltes); l.route = route; } // eindpunt weg: route inkorten
  if (l.echt) l.aangepast = true; S.herbereken(l); l._vangst = null; l._banenVan = null; l._banen = null;
  melding(`${weg.naam} gehaald uit lijn ${l.nr}.`); ververs(); eigenNetBijwerken();
}
// Te vol: blijven er structureel reizigers achter op een gesubsidieerde lijn, dan waarschuwt de provincie;
// na 7 dagen zonder verbetering vervalt de subsidie (concessie en aangeboden subsidie)
function drukteToetsen() {
  for (const l of spel.lijnen) {
    const d = l.dag; l.dag = { vraag: 0, achter: 0 };
    if (!d || d.vraag < 300 || (!l.concessie && !l.aanbod)) continue;
    const deel = d.achter / d.vraag;
    if (deel > 0.06) {
      if (!l.drukSinds) { l.drukSinds = spel.dag; nieuwVerzoek(spel, { aan: 'speler', van: 'provincie', vanNaam: 'Provincie', soort: 'bericht', status: 'gelezen', lijnId: l.id, tekst: `Waarschuwing: op lijn ${l.nr} bleef gisteren ${Math.round(deel * 100)}% van de reizigers achter (${Math.round(d.achter).toLocaleString('nl-NL')} mensen). Rijd vaker, met langere treinen of grotere voertuigen. Is het over 7 dagen niet beter, dan trekken we de subsidie in.` }); melding(`Provincie: te veel reizigers blijven achter op lijn ${l.nr} (${Math.round(deel * 100)}%). Binnen 7 dagen verbeteren, anders vervalt de subsidie.`, 12000); }
      else if (spel.dag - l.drukSinds >= 7) { l.concessie = false; if (l.aanbod) { const a = (spel.aanbiedingen || []).find(x => x.id === l.aanbod.id); if (a) aanbodLos(a); } l.drukSinds = null; melding(`De provincie heeft de subsidie van lijn ${l.nr} ingetrokken: er bleven te veel reizigers achter.`, 12000); }
    } else if (deel < 0.03 && l.drukSinds) { l.drukSinds = null; melding(`Provincie: lijn ${l.nr} is weer op orde, de waarschuwing vervalt.`); }
  }
}
function verzoekenAfhandelen() {
  const nu = spel.dag + spel.tijd / 1440;
  let iets = false;
  for (const vz of spel.verzoeken) {
    if (vz.status !== 'open' && vz.status !== 'tegen-van-speler') continue;
    if (vz.aan === 'speler' && vz.status === 'open') continue;
    if (nu < vz.antwoordDag) continue;
    behandelAntwoord(vz); iets = true;
  }
  if (iets && paneelSoort === 'verzoeken') ververs();
}
function dagVoorbij() {
  spel.tijd -= 24 * 60; // naar 05:00 volgende dag
  spel.dag++;
  dienstVoorDag();
  bouwOpleveren();
  aanbiedingenAanvullen(); aanbiedingenToetsen(); drukteToetsen();
  bijzonderAfrekenen();

  // groepen vragen soms een eigen rit aan (alleen als je treinen hebt)
  if (spel.lijnen.some(l => l.modus === 'trein') && spel.dag >= (spel.volgendeCharter ?? 3)) {
    spel.volgendeCharter = spel.dag + 12 + Math.floor(Math.random() * 15);
    const c = bedenkCharter(spel, D.stations);
    if (c) { spel.verzoeken.unshift(c); melding(`Nieuwe aanvraag voor een bijzondere rit van ${c.vanNaam}.`); }
  }
  // AI-vervoerders vragen soms iets
  if (spel.dag >= spel.volgendeAI / 1440) {
    spel.volgendeAI = (spel.dag + 2 + Math.random() * 3) * 1440;
    const v = bedenkAIVerzoek(spel);
    if (v) { nieuwVerzoek(spel, v); melding(`Nieuw verzoek van ${v.vanNaam}.`); }
  }
  // vergoedingen die je per jaar betaalt of ontvangt
  for (const a of spel.afspraken || []) { spel.geld += a.bedrag / 365; spel.maand.overig -= a.bedrag / 365; }
  if (spel.dag % 30 === 0) {
    spel.lening_rente = leningRente(); gebouwenMaand(); S.maandAfsluiten(spel);
    const m = spel.historie[spel.historie.length - 1];
    melding(`Maand afgesloten: resultaat ${S.euro(m.resultaat)}, ${Math.round(m.reizigers).toLocaleString('nl-NL')} reizigers.`, 6000);
    if (spel.dag % 360 === 0) { spel.jaar++; zetJaar(spel.jaar); zetKlassePrijzen(spel.klassePrijs); for (const l of spel.lijnen) l._eff = null; if (spel.jaar === 1956) melding('1956: de 3e klas is afgeschaft. De oude 2e klas heet nu 1e klas, de oude 3e klas is de nieuwe 2e klas.', 12000); jaarBijwerken(); melding(`Gelukkig nieuwjaar: het is nu ${spel.jaar}.`); }
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
// donker en licht volgens de zonnestand; schemering tussen +2° en −10°
function dagLicht() {
  const h = S.zonshoogte(spel.dag, spel.tijd % 1440);
  const donker = Math.max(0, Math.min(1, (2 - h) / 12));
  kaart.nacht = donker;
  kaart.nachtlaag.style.opacity = (donker * 0.62).toFixed(3);
  kaart.nachtlaag.style.background = donker > 0 && donker < 0.6 && h > -8 ? '#3a2a5a' : '#0b1a33';
}
// weekend: daldienst in plaats van spitsdienst (eigen lijnen zonder echte dienstregeling)
function dienstVoorDag() {
  const w = S.isWeekend(spel.dag);
  if (spel._weekend === w) return;
  spel._weekend = w; S.zetWeekend(w);
  for (const l of spel.lijnen) if (!l.echt?.v || l.aangepast) S.herbereken(l);
  if (w) melding('Weekend: geen spits, wel meer reizigers overdag en \'s avonds.');
}
function hud() {
  if (!spel) return;
  $('b-geld').textContent = S.euroKort(spel.geld);
  { const n = bouwProjecten().length, e = $('b-bouw'); if (e) { e.hidden = !n; e.textContent = n; } }
  $('b-geld').style.color = spel.geld < 0 ? 'var(--rood)' : '';
  $('b-dag').textContent = `${S.datumTekst(spel.dag, true)} ${spel.jaar}`;
  $('b-dag').title = `Dag ${spel.dag + 1} · ${S.datumTekst(spel.dag)} ${spel.jaar}`;
  $('b-klok').textContent = S.klok(spel.tijd);
  const m = spel.tijd % 1440, w = $('b-tijdknop').querySelector('.wijzer');
  w.style.setProperty('--uur', `${(m / 2) % 360}deg`); w.style.setProperty('--min', `${(m % 60) * 6}deg`);
  dagLicht();
  if ((paneelSoort === 'rit' || paneelSoort === 'aiLijn') && (hudN = (hudN || 0) + 1) % 8 === 0) { if (paneelSoort === 'rit') ritBijwerken(); else ververs(); }
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

// ---------------------------------------------------------------- voertuig en lijn
let volg = null, zoomVolg = false; // gevolgd voertuig (omloop-object)
// ritpaneel voor een voertuigpositie (uit het beeld of uit een lijst)
function ritData(e) {
  const nv = e.wacht && e.volgende, l = nv ? nv.l : e.lijn;
  return { lijn: l, vertrek: nv ? nv.dep : e.vertrek, r: nv ? nv.r : e.r, wacht: e.wacht, klaarVandaag: !!e.wacht && !nv, omloop: e.omloop, pool: e.pool, selectie: { lijn: l, voertuig: e.omloop } };
}
function openRit(e) { openPaneel('rit', ritData(e)); }
// ritpaneel bijwerken met de actuele toestand van hetzelfde voertuig
function ritBijwerken() {
  const om = paneelData?.omloop;
  if (!om) return ververs();
  const e = zichtLijnen.find(v => v.omloop === om);
  if (!e) return ververs();
  const d = ritData(e);
  if (selectie?.voertuig === om && selectie.lijn !== d.lijn) { selectie = d.selectie; selectieKaart(); }
  ververs(d);
}
// alle voertuigen die vandaag op deze lijn (alle richtingen) rijden, met hun huidige positie
function voertuigenVanLijn(l) {
  const groep = lijnGroep(l), c = omlopen.get(groepSleutel(l));
  if (!c) return [];
  const lijst = c.om.voertuigen.filter(v => v.ritten.some(x => groep.includes(x.l)));
  const pos = voertuigenOmloop({ voertuigen: lijst, id: c.om.id }, spel.tijd, [], opstel, lengteVan);
  return pos.map(e => Object.assign(e, { pool: c.om.id }));
}
let voertuigLijst = [];
function voertuigTabel(l) {
  voertuigLijst = voertuigenVanLijn(l);
  if (!voertuigLijst.length) return '<p class="klein">Nog geen voertuigen berekend; zoom in op de lijn.</p>';
  const tekst = e => e.wacht ? ({ keren: 'keert', wacht: 'wacht', opgesteld: 'opgesteld', rangeert: 'rangeert', leeg: 'rijdt leeg', remise: 'in remise/stalling', instappen: 'instappen', klaar: 'klaar' }[e.wacht] + (e.volgende ? `, volgende ${S.klok(e.volgende.dep)}` : ', klaar voor vandaag'))
    : `rijdt naar ${esc((e.r ? e.lijn.haltes[0] : e.lijn.haltes[e.lijn.haltes.length - 1]).naam)}`;
  const groep = lijnGroep(l);
  return `<table class="tabel">${voertuigLijst.map((e, i) => `<tr data-actie="toon-voertuig" data-i="${i}" style="cursor:pointer"><td>#${e.omloop.nr}</td><td>${tekst(e)}${groep.includes(e.wacht && e.volgende ? e.volgende.l : e.lijn) ? '' : ` <span class="klein">· nu op lijn ${esc((e.wacht && e.volgende ? e.volgende.l : e.lijn).nr || '')}</span>`}</td><td class="getal klein">${e.omloop.ritten.filter(x => !x.leeg).length} ritten</td></tr>`).join('')}</table>`;
}

// bezetting nu (per klasse, zit/sta), kaartjes, en de hele rit
function reizigersBlok(rr, nuAan, v) {
  const pct = x => rr.cap ? Math.round(x / rr.cap * 100) : 0;
  let html = '<h3>Reizigers</h3>';
  if (nuAan) {
    const kl = bezettingKlassen(nuAan.aanBoord, rr.klassen);
    const zwart = nuAan.aanBoord - nuAan.metKaartje;
    html += `<p>${rr.eenheden > 1 ? '<span class="chip">spits: 2 eenheden gekoppeld</span> ' : ''}Nu aan boord: <b>${nuAan.aanBoord}</b> van ${rr.cap} plaatsen (${pct(nuAan.aanBoord)}%) · met kaartje <b>${nuAan.metKaartje}</b>${zwart > 0 ? ` · <span style="color:var(--rood)">~${zwart} zonder</span>` : ''}</p>
      <table class="tabel"><tr><th>Klasse</th><th class="getal">zitten</th><th class="getal">staan</th></tr>${kl.map(k => `<tr><td>${k.klasse}e klas</td><td class="getal">${k.zit} / ${k.zitMax}</td><td class="getal">${k.staMax ? `${k.sta} / ${k.staMax}` : '—'}</td></tr>`).join('')}</table>`;
  } else html += `<p class="klein">${v.wacht ? 'Het voertuig rijdt nu geen rit; hieronder de verwachting voor de rit.' : 'De rit is nog niet vertrokken of al aangekomen.'}</p>`;
  const vol = Math.max(0, ...rr.segmenten.map(x => x.aanBoord));
  html += `<p class="klein">Deze rit: ${rr.totaal} reizigers, drukst ${vol} aan boord (${pct(vol)}%)${rr.achter ? ` · <b style="color:var(--rood)">${Math.round(rr.achter)} achtergebleven op het perron</b>` : ' · niemand achtergebleven'}.</p>`;
  return html;
}

// drukte en zwartrijden per traject over alle ritten van vandaag (beide richtingen), voor gerichte controle
function trajectTabel(l) {
  const typeId = typeVoor(l, spel.jaar, standaardType), c = ctx(), seg = new Map();
  for (let r = 0; r < 2; r++) for (const v of l.vertrek[r] || []) {
    const rr = ritReizigers(spel, l, r, v, typeId, c);
    rr.segmenten.forEach((sg, i) => {
      const a = rr.haltes[i].naam, b = rr.haltes[i + 1].naam, k = a < b ? `${a} – ${b}` : `${b} – ${a}`;
      const x = seg.get(k) || { reizigers: 0, zwart: 0, vol: 0 };
      x.reizigers += sg.aanBoord; x.zwart += sg.aanBoord - sg.metKaartje; x.vol = Math.max(x.vol, sg.aanBoord / rr.cap); seg.set(k, x);
    });
  }
  const rijen = [...seg].sort((a, b) => b[1].zwart - a[1].zwart).slice(0, 8);
  if (!rijen.length) return '';
  return `<table class="tabel"><tr><th>Traject</th><th class="getal">reizigers</th><th class="getal">zonder kaartje</th><th class="getal">drukst</th></tr>${rijen.map(([k, x]) => `<tr><td>${esc(k)}</td><td class="getal">${Math.round(x.reizigers).toLocaleString('nl-NL')}</td><td class="getal" style="color:${x.zwart / Math.max(1, x.reizigers) > 0.05 ? 'var(--rood)' : ''}">${Math.round(x.zwart)} (${(x.zwart / Math.max(1, x.reizigers) * 100).toFixed(1).replace('.', ',')}%)</td><td class="getal">${Math.round(x.vol * 100)}%</td></tr>`).join('')}</table>
    <p class="klein">Geschat voor vandaag, alle ritten samen (reizigers per traject, beide richtingen). Hoe meer zwartrijders, hoe meer een controleploeg hier oplevert.</p>`;
}

// richting: heen en terug, alleen heen (met of zonder aparte terugweg) of rondlijn
function richtingBlok(l) {
  if (l.richting === 'rond') return '<p class="chip">Rondlijn: steeds hetzelfde rondje, geen terugweg.</p>';
  const paar = l.paar ? lijnVan(l.paar) : null;
  if (paar) return `<p class="chip">Eén richting; de terugweg rijdt als <a href="#" data-actie="toon-lijn" data-id="${paar.id}">lijn ${esc(paar.nr)} ${esc(paar.naam || '')}</a> over een eigen route.</p>`;
  return `<div class="veld"><label>Richting</label><select data-wijzig="lijn-richting" data-id="${l.id}">
    <option value="beide" ${S.ritRichtingen(l) === 2 ? 'selected' : ''}>Heen en terug over dezelfde route</option>
    <option value="heen" ${l.richting === 'heen' ? 'selected' : ''}>Alleen heen (voertuigen rijden leeg terug)</option></select></div>
    ${l.richting === 'heen' ? `<button class="knop" data-actie="terugweg" data-id="${l.id}">Terugweg met een eigen route bouwen</button>` : ''}`;
}
// materieel dat je voor een lijn kunt kiezen: wat in dit jaar rijdt plus je eigen series (eigen interieur)
function typenVoor(modus) {
  const lijst = beschikbaar(spel.jaar, modus);
  for (const s2 of spel.series || []) { const t = TYPE[s2.id]; if (t && t.modus === modus && !TYPE[t.basis]?.soort && (spel.voertuigen[t.id] || lijst.some(b => b.id === t.basis))) lijst.push(t); }
  // samenstellingen die al op een lijn rijden
  for (const l of spel.lijnen) { const t = TYPE[l.typeId]; if (t?.samen && t.modus === modus && !lijst.includes(t)) lijst.push(t); }
  return lijst;
}
const plaatsenVan = id => klassenVan(serieInrichting(id), id, TYPE[id]?.modus).reduce((a, k) => a + k.zit + k.sta, 0);
const komma = (x, d = 1) => x.toFixed(d).replace('.', ',');
// prijzen, catering en restauratie van een eigen lijn (het interieur zelf hoort bij het materieel: zie Vloot)
function prijzenBlok(l) {
  const kl = klassenVan(inrichtingVan(l, l.typeId), l.typeId, l.modus), eff = vraagEffect(l, l.typeId);
  const km = kenmerk(l.typeId), t = TYPE[l.typeId], vz = voorzieningen(l.typeId);
  const rijen = kl.map(k => `<tr><td>${KLASSE_NAAM[k.klasse]}</td><td class="klein">${STOEL[k.stoel]?.naam || ''}<br>${k.zit} zit${k.sta ? ` + ${k.sta} sta` : ''}</td>
    <td class="getal">${Math.round(k.prijs * 100)}%</td>
    <td><select data-wijzig="lcatering" data-id="${l.id}" data-k="${k.klasse}">${CATERING.map((c, n) => `<option value="${n}" ${n === k.catering ? 'selected' : ''}>${c.naam}</option>`).join('')}</select></td>
    <td class="getal">${komma(k.comfort)}</td></tr>`).join('');
  const r = l.restauratie, halteSel = (veld, w) => `<select data-wijzig="lrest" data-id="${l.id}" data-veld="${veld}">${l.haltes.map((h, i) => `<option value="${i}" ${i === w ? 'selected' : ''}>${esc(h.naam)}</option>`).join('')}</select>`;
  const bemand = vz.filter(v => v.bemand), open = Math.round(restauratieOpen(l) * 100);
  const rest = bemand.length ? `<div class="veld"><label>${esc([...new Set(bemand.map(v => v.naam))].join(', '))}</label><select data-wijzig="lrest" data-id="${l.id}" data-veld="soort">
      <option value="heel" ${r === undefined || r === null ? 'selected' : ''}>de hele reis open</option><option value="deel" ${Array.isArray(r) ? 'selected' : ''}>een deel van de reis open</option><option value="dicht" ${r === 'dicht' ? 'selected' : ''}>dicht</option></select>
      ${Array.isArray(r) ? `<div class="raster2"><label class="veld">Open vanaf${halteSel('van', r[0])}</label><label class="veld">tot${halteSel('tot', r[1])}</label></div>` : ''}
      <p class="klein">Open ${open}% van de reis.</p></div>` : '';
  return `<p class="klein"><b>${esc(t?.naam || '')}</b>: basiscomfort ${komma(km.comfort)} · ${km.deuren > 1.1 ? 'veel deuren, snel in- en uitstappen' : km.deuren < 0.9 ? 'weinig deuren, trager instappen' : 'gewone deuren'}${vz.length ? ' · ' + esc([...new Set(vz.map(v => v.naam))].join(', ')) : ''}.
      Het interieur kies je bij het kopen of verbouwen van het materieel${t?.samen ? ' (Vloot)' : `: <a href="#" data-actie="serie-open" data-type="${l.typeId}">interieur van deze serie</a>`}. De klassetoeslagen gelden voor je hele bedrijf (<a href="#" data-actie="paneel" data-p="geld">Financiën</a>).</p>
    <div style="overflow-x:auto"><table class="tabel klein"><tr><th>Klasse</th><th>Stoelen</th><th class="getal">Prijs</th><th>Catering aan je plaats</th><th class="getal">Comfort</th></tr>${rijen}</table></div>${rest}
    <p class="klein">Verwachte reizigers ${eff.factor >= 1 ? '+' : ''}${Math.round((eff.factor - 1) * 100)}% t.o.v. standaard · gemiddelde prijs ${Math.round(eff.gemPrijs * 100)}% · gemiddeld comfort ${komma(eff.gemComfort)} · catering en voorzieningen € ${Math.round(uurKosten(l, l.typeId))} per voertuiguur.</p>`;
}
// samenstelling van een treinlijn: treinstellen koppelen, of een loc met losse rijtuigen en eventueel een stuurstandrijtuig
function samenstellingBlok(l) {
  if (l.modus !== 'trein') return '';
  const o = l._sam || (l._sam = [...delenVan(l.typeId)]);
  const nu = JSON.stringify(o) === JSON.stringify(delenVan(l.typeId));
  const t = !o.length ? null : o.length > 1 ? samenstelling(o) : TYPE[o[0]];
  const kiesbaar = [...beschikbaar(spel.jaar, 'trein'), ...beschikbaarLos(spel.jaar), ...(spel.series || []).map(x => TYPE[x.id]).filter(x => x && x.modus === 'trein')]
    .filter((x, i, a) => a.indexOf(x) === i);
  const groep = x => x.soort === 'loc' ? 'Locomotieven' : (x.soort || TYPE[x.basis]?.soort) ? 'Losse rijtuigen en stuurstandrijtuigen' : 'Treinstellen (koppelen)';
  const opties = ['Locomotieven', 'Losse rijtuigen en stuurstandrijtuigen', 'Treinstellen (koppelen)'].map(g => `<optgroup label="${g}">${kiesbaar.filter(x => groep(x) === g).map(x => `<option value="${x.id}">${esc(x.naam)}${spel.voertuigen[x.id] ? ` · ${spel.voertuigen[x.id]} in bezit` : ''}</option>`).join('')}</optgroup>`).join('');
  const kl = t ? klassenVan(inrichtingVan(l, t.id), t.id, 'trein') : [];
  const per = {}; for (const c of o) per[c] = (per[c] || 0) + 1;
  const tekort = Object.entries(per).map(([c, k]) => [c, Math.max(0, k * l.nodig - (spel.voertuigen[c] || 0))]).filter(x => x[1] > 0);
  const soortTekst = c => { const x = TYPE[c], so = x?.soort || TYPE[x?.basis]?.soort; return so === 'loc' ? 'loc' : so === 'stuurstand' ? 'stuurstand' : so ? `${plaatsenVan(c)} pl.` : 'treinstel'; };
  return `<div class="kaartje"><b>Samenstelling</b>
    <ol class="haltelijst">${o.map((c, i) => `<li>${esc(TYPE[c]?.naam || c)} <span class="klein">${soortTekst(c)}</span>
      ${i ? `<button class="knop klein" data-actie="sam-op" data-id="${l.id}" data-i="${i}" title="naar voren">↑</button>` : ''}${o.length > 1 ? `<button class="knop klein" data-actie="sam-weg" data-id="${l.id}" data-i="${i}" title="weghalen">✕</button>` : ''}</li>`).join('')}</ol>
    <div class="rij"><select id="sam-kies">${opties}</select><button class="knop klein" data-actie="sam-erbij" data-id="${l.id}">＋ toevoegen</button></div>
    ${t ? `<p class="klein">${t.zonderTrekkracht ? '<b style="color:var(--rood)">Geen loc of treinstel: deze trein kan niet rijden.</b> ' : ''}${kl.map(k => `${KLASSE_NAAM[k.klasse]} ${k.zit}${k.sta ? '+' + k.sta : ''}`).join(' · ')} · max ${t.vmax} km/u · optrekken ${komma(t.acc, 2)} m/s²${t.keerExtra ? ` · <b>geen stuurstandrijtuig: de loc moet bij elk keerpunt omlopen (+${t.keerExtra} min)</b>` : ''}</p>` : ''}
    ${!nu ? `<div class="rij"><button class="knop hoofd" data-actie="sam-toepassen" data-id="${l.id}" ${!t || t.zonderTrekkracht ? 'disabled' : ''}>Deze samenstelling gebruiken</button><button class="knop" data-actie="sam-terug" data-id="${l.id}">Terug</button></div>` : ''}
    ${nu && tekort.length ? `<p class="klein">Tekort: ${tekort.map(([c, n]) => `${n} × ${esc(TYPE[c].naam)}`).join(', ')}</p><button class="knop hoofd" data-actie="koop-nodig" data-id="${l.id}">Koop wat ontbreekt (${S.euroKort(tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0))})</button>` : ''}</div>`;
}
// een serie (eigen interieur) zoeken of aanmaken; het standaardinterieur is gewoon het basistype
function serieVoor(basis, ink, naam) {
  if (zelfdeInterieur(ink, standaardInrichting(basis, TYPE[basis].modus))) return basis;
  spel.series = spel.series || [];
  const al = spel.series.find(x => x.basis === basis && zelfdeInterieur(x.ink, ink));
  if (al) return al.id;
  let n = (naam || serieNaamVoorstel(basis, ink)).trim().slice(0, 30) || serieNaamVoorstel(basis, ink), k = 2;
  const basisNaam = n;
  while (spel.series.some(x => x.naam === n) || Object.values(TYPE).some(t => !t.serie && t.naam === n)) n = `${basisNaam}${k++}`;
  const nieuw = { id: S.nieuwId('m'), basis, naam: n, ink: JSON.parse(JSON.stringify({ wagons: ink.wagons, voorz: ink.voorz || [] })) };
  spel.series.push(nieuw); registreerSeries(spel.series);
  return nieuw.id;
}

// ---------------------------------------------------------------- bijzondere ritten
function maakBijzonder({ nr, naam, modus, typeId, haltes, route, dag, vertrek, prijs, charter = false, bod = 0, personen = 0, wie = '' }) {
  const l = S.maakLijn(spel, { nr, naam, modus, typeId, haltes, route, interval: { vroeg: 999, ochtendspits: 999, dal: 999, avondspits: 999, avond: 999 } });
  l.bijzonder = { dag, vertrek, prijs, charter, bod, personen, wie, gepland: spel.dag, ingeschreven: 0 };
  bijzonderBijwerken(l);
  return l;
}
function bijzonderBijwerken(l) {
  const b = l.bijzonder;
  l.echt = { v: vertrekOpDag(l, spel.dag) }; l.aangepast = false;
  S.herbereken(l);
  l.actief = spel.dag === b.dag;
  if (!b.charter && spel.dag <= b.dag) b.ingeschreven = inschrijvingen(spel, l, D.plaatsen, S.capaciteit(l));
}
// na de dag van de rit: afrekenen en opruimen
function bijzonderAfrekenen() {
  for (const l of [...spel.lijnen]) {
    if (!l.bijzonder) continue;
    if (spel.dag <= l.bijzonder.dag) { bijzonderBijwerken(l); continue; }
    const b = l.bijzonder, t = TYPE[l.typeId];
    const heeft = (spel.voertuigen[l.typeId] || 0) > 0;
    const opbrengst = !heeft ? 0 : b.charter ? b.bod : Math.min(b.ingeschreven, S.capaciteit(l)) * b.prijs;
    const kosten = heeft ? ritKosten(spel, l) : 0;
    spel.geld += opbrengst - kosten; spel.maand.kaartjes += opbrengst; spel.maand.overig += kosten;
    if (b.charter) spel.reputatie = Math.min(100, spel.reputatie + (heeft ? 1 : -4));
    (spel.bijzonderArchief ||= []).unshift({ naam: l.naam, dag: b.dag, reizigers: b.charter ? b.personen : b.ingeschreven, opbrengst, kosten, type: t?.naam });
    spel.bijzonderArchief.length = Math.min(spel.bijzonderArchief.length, 20);
    melding(heeft ? `Bijzondere rit ${l.naam} gereden: ${b.charter ? b.personen : b.ingeschreven} reizigers, resultaat ${S.euro(opbrengst - kosten)}.` : `Bijzondere rit ${l.naam} kon niet rijden: geen ${t?.naam || 'materieel'} meer in bezit.`, 7000);
    spel.lijnen.splice(spel.lijnen.indexOf(l), 1);
  }
}
function bijzonderTabel() {
  const lijst = spel.lijnen.filter(l => l.bijzonder);
  const rij = l => { const b = l.bijzonder, cap = S.capaciteit(l), n = b.charter ? b.personen : b.ingeschreven;
    return `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td>${esc(l.naam)}<br><span class="klein">${S.datumTekst(b.dag, true)} · ${S.klok(b.vertrek)} · ${esc(TYPE[l.typeId]?.naam || '')}${b.charter ? ` · charter ${esc(b.wie)}` : ''}</span></td>
      <td class="getal">${n} / ${cap}<br><span class="klein">${b.charter ? S.euroKort(b.bod) : S.euroKort(n * b.prijs)}</span></td></tr>`; };
  const arch = (spel.bijzonderArchief || []).slice(0, 5);
  return `${lijst.length ? `<table class="tabel"><tr><th>Rit</th><th class="getal">ingeschreven</th></tr>${lijst.map(rij).join('')}</table>` : '<p class="klein">Geen bijzondere ritten gepland.</p>'}
    ${arch.length ? `<p class="klein">Gereden: ${arch.map(a => `${esc(a.naam)} (${a.reizigers} reizigers, ${S.euroKort(a.opbrengst - a.kosten)})`).join(' · ')}</p>` : ''}
    <p class="klein">Een bijzondere rit plan je met <b>＋ Lijn</b>: klik de route aan en vink daarna <b>eenmalige bijzondere rit</b> aan. Museummaterieel koop je bij <b>Vloot</b>.</p>`;
}

// ---------------------------------------------------------------- panelen
function openPaneel(soort, data) {
  paneelSoort = soort; selectie = data?.selectie ?? (soort === 'lijn' ? selectie : null);
  setTimeout(eigenNetBijwerken, 0);
  $('paneel').hidden = false;
  document.querySelectorAll('[data-paneel]').forEach(b => b.classList.toggle('aan', b.dataset.paneel === soort));
  ververs(data);
}
function sluitPaneel() { if (perronOntwerp || paneelSoort === 'nieuwStation' || paneelSoort === 'nieuwSpoor') { perronVoorstelWissen(); handvattenWeg(); } $('paneel').hidden = true; paneelSoort = null; selectie = null; document.querySelectorAll('[data-paneel]').forEach(b => b.classList.remove('aan')); }
let paneelData = null;
function ververs(data) {
  if (data !== undefined) paneelData = data;
  if (!paneelSoort || !spel) return;
  const el = $('paneel-inhoud');
  const actief = document.activeElement;
  if (actief && el.contains(actief) && (actief.tagName === 'INPUT' || actief.tagName === 'SELECT')) return; // niet storen tijdens typen
  const f = PANELEN[paneelSoort];
  if (f) { el.innerHTML = f(paneelData); koppel(el); fotosLaden(el); }
}

const PANELEN = {
  // Eén rit (na klikken op een voertuig): welke trein/bus, van wie, tijden per halte, frequentie, en aanpassen of verzoeken
  rit(v) {
    const l = v.lijn, r = v.r || 0, eigen = !l.ai;
    const n = l.haltes.length;
    const volg = r ? [...l.haltes].reverse() : l.haltes;
    const t = l.tr?.[r] || l.t;
    const typeId = typeVoor(l, spel.jaar, standaardType), type = TYPE[typeId];
    const eigenaar = eigen ? spel.naam : l.vervoerderNaam;
    const kleur = eigen ? spel.kleur : l.kleur;
    const nu = spel.tijd;
    const wachtKey = i => eigen ? `${r}:${i}` : i;
    const extra = i => (eigen ? l.halteWacht?.[`${r}:${i}`] : l.dw?.[i]) || 0;
    // tijden: aankomst = vertrek + t[i]; vertrek bij de halte = aankomst + extra wachttijd
    const rr = ritReizigers(spel, l, r, v.vertrek, typeId, ctx());
    // huidig stuk: na vertrek bij halte i en voor aankomst bij i+1
    let seg = -1;
    for (let i = 0; i < n - 1; i++) if (v.vertrek + t[i] / 60 + extra(i) <= nu) seg = i;
    const klaar = nu > v.vertrek + t[n - 1] / 60;
    const nuAan = !v.wacht && seg >= 0 && !klaar ? rr.segmenten[seg] : null;
    const hT = MODI[l.modus].halteTijd;
    const oud = l._vorigeTr?.[r];
    const rijen = volg.map((h, i) => {
      const verblijf = i > 0 && i < n - 1 ? hT : 0;
      const aan = v.vertrek + (t[i] - verblijf) / 60, weg = v.vertrek + t[i] / 60 + extra(i);
      const voorbij = weg < nu, hier = aan <= nu && nu <= weg + 0.5;
      const hr = rr.haltes[i];
      const traag = eigen && i && l.trMin ? Math.round((t[i] - verblijf - l.trMin[r][i]) / 60) : 0;
      const delta = oud && oud[i] != null ? Math.round((t[i] - oud[i]) / 60) : 0;
      const aanVeld = !i ? '' : eigen ? `<input type="time" value="${S.klok(Math.round(aan))}" data-wijzig="aankomst" data-id="${l.id}" data-k="${r}:${i}" data-dep="${v.vertrek}" title="gewenste aankomst; later = rustiger rijden" style="width:5.6em">` : S.klok(Math.round(aan));
      return `<tr class="${voorbij ? 'voorbij' : ''}${hier ? ' hier' : ''}"><td>${esc(h.naam)}${traag > 0 ? ` <span class="chip" title="rijdt rustiger dan het maximum">+${traag}′ rustig</span>` : ''}${delta ? ` <span class="chip let" title="verschil door je laatste wijziging">${delta > 0 ? '+' : ''}${delta}′</span>` : ''}</td><td class="getal">${aanVeld}</td><td class="getal">${i < n - 1 ? S.klok(Math.round(weg)) : ''}</td>
        <td class="getal klein">${hr.in ? '+' + hr.in : ''}${hr.uit ? ' −' + hr.uit : ''}${hr.achter ? ` <b style="color:var(--rood)" title="achtergebleven: voertuig vol">⚠${hr.achter}</b>` : ''}</td>
        <td>${eigen ? `<input type="number" min="0" max="15" value="${extra(i)}" data-wijzig="halte-wacht" data-id="${l.id}" data-k="${wachtKey(i)}" title="extra minuten wachten" style="width:3.4em">` : (i < n - 1 ? `<button class="knop klein" data-actie="rit-wacht" data-i="${i}">langer wachten</button>` : '')}</td></tr>`;
    }).join('');
    // frequentie per periode in deze richting
    const vt = l.vertrek[r] || [];
    const freq = S.PERIODES.map(p => {
      const k = vt.filter(x => x >= p.van && x < p.tot).length, uren = (p.tot - p.van) / 60;
      return `<tr><td>${p.naam}</td><td class="getal">${k ? (k / uren >= 1 ? `${(k / uren).toFixed(k / uren >= 2 ? 0 : 1).replace('.', ',')}× per uur` : `elke ${Math.round(uren * 60 / k)} min`) : '—'}</td></tr>`;
    }).join('');
    const altD = eigen ? S.altDeel(spel, l) : 0;
    const typen = eigen ? typenVoor(l.modus) : [];
    return `<h2><span class="lijnnr" style="background:${esc(kleur)}">${esc(l.nr || '')}</span> ${esc(l.naam || '')}</h2>
      <p class="klein">${MODI[l.modus]?.naam || l.modus} van <b>${esc(eigenaar)}</b>${eigen ? ' (jij)' : ''} · ${esc(type?.naam || '')}${l.kop ? ` · richting ${esc(l.kop)}` : ''}</p>
      ${v.wacht ? `<p class="chip">${{ keren: 'Staat bij het eindpunt en keert voor de volgende rit', wacht: 'Wacht bij het eindpunt', opgesteld: 'Staat opgesteld tot de volgende rit', rangeert: 'Rangeert tussen station en opstelspoor', leeg: 'Rijdt leeg (zonder reizigers) naar het begin van de volgende rit', remise: 'Staat in de remise/stalling tot de volgende rit', instappen: 'Staat klaar: instappen', klaar: 'Staat klaar voor de eerste rit' }[v.wacht] || ''}${v.klaarVandaag ? ' · klaar voor vandaag, staat hier tot morgen' : ''}</p>` : ''}
      ${v.omloop ? `<p class="klein">Voertuig #${v.omloop.nr} (${l._omloopN || '?'} in de pool van ${esc(eigenaar)} met dit materieel) · vandaag ${v.omloop.ritten.filter(x => !x.leeg).length} ritten${v.omloop.ritten.some(x => x.leeg) ? ` (+ ${v.omloop.ritten.filter(x => x.leeg).length} leeg)` : ''}${new Set(v.omloop.ritten.map(x => x.l.lijnId || x.l.id)).size > 1 ? ` op ${new Set(v.omloop.ritten.map(x => x.l.lijnId || x.l.id)).size} lijnen` : ''}: ${v.omloop.ritten.slice(0, 8).map(x => `${x.leeg ? '<i>leeg</i> ' : ''}${S.klok(x.dep)}${x.l.nr && x.l.nr !== l.nr ? ` (${esc(x.l.nr)})` : ''}`).join(', ')}${v.omloop.ritten.length > 8 ? ' …' : ''}</p>` : ''}
      <div class="rij"><button class="knop" data-actie="sel-lijn">☰ Toon lijn</button>${v.omloop ? `<button class="knop ${volg === v.omloop ? 'hoofd' : ''}" data-actie="volg">${volg === v.omloop ? '◉ Stop volgen' : '◎ Volg'}</button>` : ''}</div>
      <p>${v.wacht ? (v.klaarVandaag ? 'Laatste rit' : 'Volgende rit') : 'Deze rit'}: vertrek <b>${S.klok(v.vertrek)}</b> uit ${esc(volg[0].naam)}, aankomst <b>${S.klok(Math.round(v.vertrek + t[n - 1] / 60))}</b> in ${esc(volg[n - 1].naam)}.</p>
      <table class="tabel rittabel"><tr><th>Halte</th><th class="getal">aan</th><th class="getal">vertrek</th><th class="getal" title="instappers + / uitstappers −">in/uit</th><th>${eigen ? 'extra wachten (min)' : ''}</th></tr>${rijen}</table>
      ${reizigersBlok(rr, nuAan, v)}
      <h3>Hoe vaak</h3>
      <p class="klein">Eerste rit ${vt.length ? S.klok(vt[0]) : '—'}, laatste rit ${vt.length ? S.klok(vt[vt.length - 1]) : '—'} · ${vt.length} ritten per dag in deze richting.</p>
      <table class="tabel">${freq}</table>
      ${eigen ? `<h3>Aanpassen</h3>
        <div class="raster2"><label class="veld">Hele lijn verschuiven (min)<input type="number" min="-30" max="30" value="${l.offset}" data-wijzig="offset" data-id="${l.id}"></label>
        <label class="veld">Eerste rit<input type="time" value="${S.klok(l.eerste)}" data-wijzig="eerste" data-id="${l.id}"></label>
        <label class="veld">Laatste rit<input type="time" value="${S.klok(l.laatste)}" data-wijzig="laatste" data-id="${l.id}"></label></div>
        <p class="klein">Frequentie per periode stel je in bij de <button class="knop klein" data-actie="toon-lijn" data-id="${l.id}">hele lijn</button>.</p>
        <h3>Materieel</h3>
        <div class="veld">Standaard<select data-wijzig="lijn-type" data-id="${l.id}">${typen.map(x => `<option value="${x.id}" ${x.id === l.typeId ? 'selected' : ''}>${esc(x.naam)} · ${spel.voertuigen[x.id] || 0} in bezit</option>`).join('')}</select></div>
        <div class="veld">Als dat op is, ook inzetten<select data-wijzig="lijn-alt" data-id="${l.id}"><option value="">— geen alternatief —</option>${typen.filter(x => x.id !== l.typeId).map(x => `<option value="${x.id}" ${x.id === l.altTypeId ? 'selected' : ''}>${esc(x.naam)} · ${spel.voertuigen[x.id] || 0} in bezit</option>`).join('')}</select></div>
        <p>Nodig: <b>${l.nodig}</b> · inzetbaar: <b>${S.beschikbaarVoor(spel, l)}</b>${altD ? ` (waarvan ${Math.round(altD * l.nodig)} ${esc(TYPE[l.altTypeId]?.naam || '')})` : ''}${S.beschikbaarVoor(spel, l) < l.nodig ? ' · <span class="chip fout">te weinig: er vallen ritten uit</span>' : ''}</p>`
      : `<h3>Verzoek aan ${esc(l.vervoerderNaam)}</h3>
        <p class="klein">Deze lijn is niet van jou. Je kunt vragen om iets aan te passen; ${esc(l.vervoerderNaam)} beslist (goodwill nu ${spel.goodwill[l.vervoerder] ?? 0}). Een vergoeding helpt.</p>
        <div class="raster2"><label class="veld">Wat<select id="rv-soort"><option value="schuif">Hele lijn eerder/later</option><option value="wacht">Langer wachten bij een halte</option></select></label>
        <label class="veld">Halte<select id="rv-halte">${volg.slice(0, -1).map((h, i) => `<option value="${i}">${esc(h.naam)}</option>`).join('')}</select></label>
        <label class="veld">Minuten (− = eerder)<input id="rv-min" type="number" min="-15" max="15" value="2"></label>
        <label class="veld">Vergoeding €/jaar<input id="rv-geld" type="number" min="0" step="5000" value="0"></label></div>
        <button class="knop hoofd" data-actie="rit-verzoek">Verzoek sturen</button>`}`;
  },
  lijnen() {
    const rijen = spel.lijnen.filter(l => !l.bijzonder).map(l => {
      const st = l.stat, res = st ? st.opbrengst - st.kosten : 0;
      const tekort = S.beschikbaarVoor(spel, l) < l.nodig;
      return `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td><span class="lijnnr" style="background:${l.actief ? spel.kleur : '#888'}">${esc(l.nr)}</span></td>
        <td>${esc(l.naam || l.haltes[0].naam + ' – ' + l.haltes[l.haltes.length - 1].naam)}<br><span class="klein">${MODI[l.modus].naam} · ${l.haltes.length} haltes${l.wacht ? ' · wacht op ProRail' : ''}${tekort ? ' · <b style="color:var(--rood)">materieel tekort</b>' : ''}</span></td>
        <td class="getal">${st ? Math.round(st.reizigers).toLocaleString('nl-NL') : '—'}<br><span class="klein" style="color:${res < 0 ? 'var(--rood)' : 'var(--groen)'}">${st ? S.euroKort(res) : ''}</span></td></tr>`;
    }).join('');
    return `<h2>Je lijnen</h2><p class="klein">Reizigers en resultaat deze maand. Klik op een lijn voor de dienstregeling.</p>
      ${spel.lijnen.length ? `<table class="tabel"><tr><th>Lijn</th><th>Route</th><th class="getal">Reizigers</th></tr>${rijen}</table>` : '<p>Nog geen lijnen. Kies <b>＋ Lijn</b> links en klik haltes of stations op volgorde aan.</p>'}
      <button class="knop hoofd" data-actie="tool" data-tool="lijn">＋ Nieuwe lijn</button>
      <h3>Bijzondere ritten</h3>${bijzonderTabel()}`;
  },
  lijn(l) {
    if (!l) return '';
    if (l.bijzonder) { const b = l.bijzonder, n = b.charter ? b.personen : b.ingeschreven;
      return `<h2><span class="lijnnr" style="background:${spel.kleur}">★</span> ${esc(l.naam)}</h2>
        <p>Bijzondere rit op <b>${S.datumTekst(b.dag)}</b>, vertrek ${S.klok(b.vertrek)} · ${esc(TYPE[l.typeId]?.naam || '')}${isMuseum(TYPE[l.typeId], spel.jaar) ? ' (museum)' : ''}</p>
        <p>${b.charter ? `Charter voor ${esc(b.wie)}: ${b.personen} personen, opbrengst ${S.euro(b.bod)}.` : `Ingeschreven: <b>${n}</b> van ${S.capaciteit(l)} plaatsen à ${S.euro(b.prijs)} = ${S.euro(n * b.prijs)}.`} Verwachte kosten ${S.euro(ritKosten(spel, l))}.</p>
        <ol class="haltelijst">${l.haltes.map((h, i) => `<li>${esc(h.naam)} <span class="klein">${S.klok(b.vertrek + Math.round(l.t[i] / 60))}</span></li>`).join('')}</ol>
        <button class="knop gevaar" data-actie="opheffen" data-id="${l.id}">Rit afblazen</button>`; }
    const t = TYPE[l.typeId];
    const typen = typenVoor(l.modus);
    const st = l.stat;
    const gedeeld = gedeeldeHaltes(l);
    const uniekeAI = [];
    for (const g of gedeeld) if (!uniekeAI.some(u => u.ai.sleutel === g.ai.sleutel && u.halte === g.halte)) uniekeAI.push(g);
    return `<h2><span class="lijnnr" style="background:${spel.kleur}">${esc(l.nr)}</span> ${esc(l.naam || '')}</h2>
      <p class="klein">${MODI[l.modus].naam} · ${l.lengteKm.toFixed(1).replace('.', ',')} km · rijtijd ${Math.round(l.duur / 60)} min · ${l.vertrek[0].length + l.vertrek[1].length} ritten per dag
      ${l.concessie ? ' · <span class="chip goed">concessie</span>' : ''} ${l.wacht ? `<span class="chip let">${l.wacht === 'stroom' ? 'rijdt niet: materieel past niet bij de bovenleiding' : 'wacht op ProRail'}</span>` : ''} ${!l.actief && !l.wacht ? '<span class="chip">gestopt</span>' : ''}</p>
      <ol class="haltelijst">${l.haltes.map((h, i) => `<li>${esc(h.naam)} <span class="klein">+${Math.round(l.t[i] / 60)}′</span>${l.bijzonder ? '' : ` <button class="knop klein" data-actie="halte-weg" data-id="${l.id}" data-i="${i}" title="halte uit de lijn halen">✕</button>`}</li>`).join('')}</ol>
      ${l.bijzonder ? '' : `<button class="knop klein" data-actie="halte-erbij" data-id="${l.id}">＋ Station/halte toevoegen</button>`}
      ${richtingBlok(l)}
      ${(() => { const c = (l.echt && !l.aangepast) ? null : stroomCheck(spel, net, l); if (!c || (c.ok && !l.sleeploc)) return ''; return c.ok ? `<p class="chip">Sleeploc: ${esc(TYPE[l.sleeploc]?.naam || '')} over de stukken waar het eigen materieel niet kan <button class="knop klein" data-actie="sleeploc-weg" data-id="${l.id}">weg</button></p>`
        : `<div class="kaartje"><b style="color:var(--rood)">Kan niet rijden:</b> ${esc(TYPE[l.typeId]?.naam || '')} kan niet op ${c.probleem.map(p => `${p.naam} (${komma(p.km)} km)`).join(', ')}.
          <div class="rij"><button class="knop klein" data-actie="stroom-toon" data-id="${l.id}">Toon op de kaart</button>${aanlegKnop(l, c)}</div>
          ${c.probleem.some(p => p.sys !== 'geen') ? '<p class="klein">Op een andere spanning omschakelen kan gevolgen hebben voor andere treinen: klik op het spoor om te zien welke.</p>' : ''}
          Of kies hieronder ander materieel (bv. een meersysteemtrein), of ${sleeplocKnoppen(l, c.probleem[0].sys === 'geen' ? null : c.probleem[0].sys) || 'een diesel-sleeploc'}</div>`; })()}
      ${l.aanbod ? (() => { const a = (spel.aanbiedingen || []).find(x => x.id === l.aanbod.id); const t = a ? toetsEisen(l, a) : { ok: false, redenen: ['aanbieding bestaat niet meer'] };
        return `<p class="chip ${t.ok ? 'goed' : 'fout'}">Subsidie ${a ? `${esc(a.a.naam)} – ${esc(a.b.naam)}: ${vergoedingTekst(a.vergoeding)}` : ''} · ${t.ok ? 'voldoet aan de eisen' : 'wordt niet uitbetaald: ' + esc(t.redenen.join('; '))}</p>`; })() : ''}
      <h3>Voertuigen op deze lijn</h3>${voertuigTabel(l)}
      <h3>Materieel</h3>
      ${l.modus === 'trein' ? `<label class="rij"><input type="checkbox" data-wijzig="spitsdubbel" data-id="${l.id}" ${l.spitsDubbel ? 'checked' : ''}> In de spits gekoppeld rijden (2 eenheden: dubbele capaciteit, meer materieel nodig)</label>` : ''}
      <div class="veld"><select data-wijzig="lijn-type" data-id="${l.id}">${typen.map(v => `<option value="${v.id}" ${v.id === l.typeId ? 'selected' : ''}>${esc(v.naam)} (${plaatsenVan(v.id)} pl.)</option>`).join('')}</select></div>
      <p>Nodig: <b>${l.nodig}</b> × ${esc(t?.naam || '')} · inzetbaar: <b>${S.beschikbaarVoor(spel, l)}</b></p>
      ${samenstellingBlok(l)}
      ${l.modus !== 'trein' && S.beschikbaarVoor(spel, l) < l.nodig ? `<button class="knop hoofd" data-actie="koop-nodig" data-id="${l.id}">Koop wat ontbreekt</button>` : ''}
      <h3>Prijzen en catering</h3>${prijzenBlok(l)}
      <h3>Dienstregeling (elke … minuten)</h3>
      ${l.echt && !l.aangepast ? '<p class="klein">Rijdt nu volgens de echte dienstregeling. Pas je iets aan, dan maakt het spel een eigen regelmatige dienstregeling.</p>' : ''}
      <div class="raster2">${S.PERIODES.map(p => `<label class="veld">${p.naam}<input type="number" min="0" max="240" step="1" value="${l.interval[p.id] ?? ''}" data-wijzig="interval" data-id="${l.id}" data-p="${p.id}"></label>`).join('')}</div>
      <div class="raster2"><label class="veld">Eerste rit<input type="time" value="${S.klok(l.eerste)}" data-wijzig="eerste" data-id="${l.id}"></label>
      <label class="veld">Laatste rit<input type="time" value="${S.klok(l.laatste)}" data-wijzig="laatste" data-id="${l.id}"></label>
      <label class="veld">Verschuiving (min)<input type="number" min="-30" max="30" value="${l.offset}" data-wijzig="offset" data-id="${l.id}"></label></div>
      <p class="klein">Vertrek ${esc(l.haltes[0].naam)}: ${l.vertrek[0].filter(v => v >= 12 * 60 && v < 14 * 60).map(S.klok).join(', ') || '—'} (12–14 uur)</p>
      ${st ? `<h3>Deze maand</h3><table class="tabel"><tr><td>Reizigers</td><td class="getal">${Math.round(st.reizigers).toLocaleString('nl-NL')}</td></tr>
        <tr><td>Kaartjes en boetes</td><td class="getal">${S.euro(st.kaartjes ?? st.opbrengst - (st.subsidie || 0))}</td></tr><tr><td>Subsidie${l.subsidiePerReiziger ? ` (incl. € ${l.subsidiePerReiziger.toFixed(2).replace('.', ',')}/reiziger)` : ''}</td><td class="getal">${S.euro(st.subsidie || 0)}</td></tr>
        <tr><td>Kosten</td><td class="getal">${S.euro(-st.kosten)}</td></tr>
        <tr><td><b>Resultaat</b></td><td class="getal"><b style="color:${st.opbrengst - st.kosten < 0 ? 'var(--rood)' : 'var(--groen)'}">${S.euro(st.opbrengst - st.kosten)}</b></td></tr>
        <tr><td>Bezetting</td><td class="getal">${Math.round((l.bezetting || 0) * 100)}%</td></tr>${st.vraag ? `<tr><td>Achtergebleven reizigers</td><td class="getal" style="color:${st.achter / st.vraag > 0.06 ? 'var(--rood)' : 'inherit'}">${Math.round(st.achter).toLocaleString('nl-NL')} (${Math.round(st.achter / st.vraag * 100)}%)</td></tr>` : ''}${l.drukSinds ? `<tr><td colspan="2" style="color:var(--rood)">Waarschuwing van de provincie: nog ${Math.max(0, 7 - (spel.dag - l.drukSinds))} dagen om de drukte op te lossen</td></tr>` : ''}${st.uitval > 0.5 ? `<tr><td>Uitgevallen ritten</td><td class="getal" style="color:var(--rood)">${Math.round(st.uitval)}</td></tr>` : ''}</table>` : ''}
      <h3>Drukte en zwartrijden per traject</h3>${trajectTabel(l)}
      <h3>Kaartcontrole op deze lijn</h3>
      <label class="rij"><input type="checkbox" data-wijzig="conducteur" data-id="${l.id}" ${l.conducteur ? 'checked' : ''}> Conducteur op elke rit (+${S.euro(S.LOON.conducteur)} per voertuiguur)</label>
      ${l.modus === 'bus' ? `<label class="rij"><input type="checkbox" data-wijzig="chauffeur" data-id="${l.id}" ${l.chauffeurControle ? 'checked' : ''}> Chauffeur controleert bij instappen (+5 s per halte)</label>` : ''}
      <h3>Overleg</h3>
      ${!l.concessie ? `<button class="knop" data-actie="concessie" data-id="${l.id}">Concessie (subsidie) aanvragen bij de provincie</button>` : ''}
      ${l.concessie && st && st.opbrengst < st.kosten ? `<div class="raster2"><label class="veld">Extra subsidie €/maand<input type="number" min="0" step="1000" id="sub-bedrag" value="${Math.ceil((st.kosten - st.opbrengst) / ((spel.dag % 30) + 1) * 30 / 1000) * 1000}"></label></div>
        <button class="knop" data-actie="subsidie" data-id="${l.id}">Meer subsidie aanvragen (lijn is verliesgevend)</button>` : ''}
      ${l.modus === 'trein' && l.wacht ? `<button class="knop" data-actie="pad" data-id="${l.id}">Opnieuw ruimte op het spoor aanvragen</button>` : ''}
      ${uniekeAI.length ? `<p class="klein">Overstappen met andere vervoerders (12–13 uur):</p><table class="tabel">${uniekeAI.slice(0, 12).map(g => `<tr><td>${esc(g.halte.naam)}</td><td><span class="lijnnr" style="background:${esc(g.ai.kleur)}">${esc(g.ai.nr)}</span> ${esc(g.ai.vervoerderNaam)}</td><td class="getal">${overstappen(l, g.ai, g.halte.x, g.halte.y)}</td><td><button class="knop" data-actie="verzoek-ai" data-id="${l.id}" data-ai="${esc(g.ai.sleutel)}" data-h="${l.haltes.indexOf(g.halte)}">Verzoek</button></td></tr>`).join('')}</table>` : '<p class="klein">Geen gedeelde haltes met andere vervoerders in beeld. Zoom in op je lijn zodat hun dienstregeling laadt.</p>'}
      <h3>Lijn</h3>
      <div class="rij"><button class="knop" data-actie="aanuit" data-id="${l.id}">${l.actief ? 'Tijdelijk stoppen' : 'Weer laten rijden'}</button>
      <button class="knop gevaar" data-actie="opheffen" data-id="${l.id}">Opheffen</button></div>`;
  },
  subsidies() {
    const f = subFilter, provs = territorium?.prov || [];
    const passend = subsidieLijst();
    const chip = (w, v, aan, tekst) => `<label class="chipkeuze"><input type="checkbox" data-wijzig="${w}" value="${v}" ${aan ? 'checked' : ''}> ${tekst}</label>`;
    return `<h2>Subsidies</h2>
      <p class="klein">De provincie wil verbindingen ontsluiten en rekent ze door: reizigers, kaartjes, kosten en investering. Minder reizigers = meer subsidie. Een nieuwe lijn die beide plaatsen bedient en aan de eisen voldoet, krijgt de startbijdrage (de investering, in 2 dagen) en daarna de doorlopende vergoeding zolang hij blijft voldoen.</p>
      <div class="kaartje"><b>Filter</b>
        <div class="rij" style="flex-wrap:wrap">${SUB_MODI.map(m => chip('sub-modus', m, f.modus.includes(m), MODI[m].naam)).join('')}</div>
        <div class="rij" style="flex-wrap:wrap"><label class="veld" style="margin:0">Land <select data-wijzig="sub-land"><option value="NL" selected>Nederland</option></select></label></div>
        ${provs.length ? `<div class="rij" style="flex-wrap:wrap">${provs.map((p, i) => chip('sub-prov', i, f.prov.includes(i), esc(p.naam))).join('')}</div>` : '<p class="klein">Provincies laden nog…</p>'}
        <div class="rij"><button class="knop klein" data-actie="sub-alles">Filter wissen</button><button class="knop klein hoofd" data-actie="sub-meer">Meer aanbiedingen zoeken${f.prov.length || f.modus.length ? ' in deze selectie' : ''}</button></div>
        <p class="klein">${passend.length} van ${(spel.aanbiedingen || []).filter(a => a.status !== 'verlopen').length} aanbiedingen passen bij het filter.</p></div>
      ${aanbodBlok(passend)}`;
  },
  verzoeken() {
    const kaartje = v => {
      const titel = v.aan === 'speler' ? `Van ${esc(v.vanNaam)}` : `Aan ${esc(v.aanNaam || v.aan)}`;
      const status = { open: '<span class="chip let">wacht op antwoord</span>', geaccepteerd: '<span class="chip goed">akkoord</span>', afgewezen: '<span class="chip fout">afgewezen</span>',
        tegenvoorstel: '<span class="chip let">tegenvoorstel</span>', 'tegen-van-speler': '<span class="chip let">jouw tegenvoorstel ligt er</span>', ingetrokken: '<span class="chip">ingetrokken</span>' }[v.status] || '';
      let acties = '';
      if (v.aan === 'speler' && v.status === 'open' && v.soort === 'charter') acties = `<div class="rij"><button class="knop hoofd" data-actie="vz-ja" data-id="${v.id}">Akkoord (${S.euroKort(v.bod)})</button><button class="knop" data-actie="vz-nee" data-id="${v.id}">Bedanken</button></div>
        <div class="raster2"><label class="veld">Tegenbod €<input type="number" min="0" step="500" value="${Math.round(v.bod * 1.2 / 500) * 500}" id="tv-geld-${v.id}"></label></div><button class="knop" data-actie="vz-tegen" data-id="${v.id}">Tegenbod sturen</button>`;
      else if (v.aan === 'speler' && v.status === 'open') acties = `<div class="rij"><button class="knop hoofd" data-actie="vz-ja" data-id="${v.id}">Akkoord</button><button class="knop" data-actie="vz-nee" data-id="${v.id}">Afwijzen</button></div>
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
    return `<h2>Overleg</h2><p class="klein">Aangeboden subsidies van de provincie staan onder <button class="knop klein" data-actie="open-subsidies">€ Subsidie</button>.</p><h3>Verzoeken</h3><p class="klein">Verzoeken aan en van andere vervoerders, ProRail en de provincie. ProRail en de provincie antwoorden binnen een uur speltijd, vervoerders binnen een paar uur.</p>
      ${spel.verzoeken.length ? spel.verzoeken.slice(0, 40).map(kaartje).join('') : '<p>Nog geen verzoeken. Open een lijn en kies <b>Verzoek</b> bij een gedeelde halte, of vraag een treinpad, station of spoor aan.</p>'}`;
  },
  vloot() {
    const nodig = {};
    for (const l of spel.lijnen) if (l.actief) for (const [c, k] of Object.entries(nodigPer(l.typeId))) nodig[c] = (nodig[c] || 0) + k * l.nodig;
    const typen = beschikbaar(spel.jaar), los = beschikbaarLos(spel.jaar), lt = S.leeftijden(spel);
    const groepen = Object.keys(MODI).map(m => {
      const lijst = typen.filter(v => v.modus === m);
      if (!lijst.length) return '';
      const rij = (v, serie) => { const kl = klassenVan(serieInrichting(v.id), v.id, v.modus), zit = kl.reduce((a, k) => a + k.zit, 0), sta = kl.reduce((a, k) => a + k.sta, 0);
        const vz = voorzieningen(v.id);
        return `<tr><td>${serie ? '↳ ' : ''}<b>${esc(v.naam)}</b><br><span class="klein">${serie ? `interieur: ${kl.map(k => `${KLASSE_NAAM[k.klasse]} ${STOEL[k.stoel]?.naam || ''}`).join(', ')}${vz.length ? ', ' + [...new Set(vz.map(x => x.naam))].join(', ') : ''} · ` : ''}${v.soort === 'loc' ? '' : `${zit} zit + ${sta} sta · `}${v.vmax} km/u · ${v.energie} · ${S.euroKort(v.prijs)}${serie ? '' : ' · ' + esc(v.wie)}</span>
          ${v.soort === 'loc' ? '' : `<br><a href="#" class="klein" data-actie="serie-open" data-type="${v.id}">${spel.voertuigen[v.id] ? 'interieur: nieuwe serie of verbouwen' : 'kopen met een eigen interieur'}</a>`}</td>
        <td class="getal">${spel.voertuigen[v.id] || 0}${lt[v.id] ? `<br><span class="klein" title="gemiddelde leeftijd / levensduur">${Math.round(lt[v.id].gem)}/${lt[v.id].leven} jr${S.ouderdomFactor(lt[v.id].gem, lt[v.id].leven) > 1.15 ? ' ⚠' : ''}</span>` : ''}${(spel.voertuigen[v.id] || 0) > (nodig[v.id] || 0) && spel.voertuigen[v.id] ? `<br><span class="klein">${spel.voertuigen[v.id] - (nodig[v.id] || 0)} staan stil</span>` : ''}${nodig[v.id] ? `<br><span class="klein" style="color:${(spel.voertuigen[v.id] || 0) < nodig[v.id] ? 'var(--rood)' : 'inherit'}">nodig ${nodig[v.id]}</span>` : ''}</td>
        <td><div class="rij" style="flex-wrap:nowrap"><button class="knop" data-actie="koop" data-type="${v.id}" data-n="1" title="Kopen">＋</button><button class="knop" data-actie="verkoop" data-type="${v.id}" title="Verkopen voor 45% van de nieuwprijs" ${spel.voertuigen[v.id] ? '' : 'disabled'}>−</button></div></td></tr>`; };
      const tabel = l2 => `<table class="tabel">${l2.map(v => rij(v) + (spel.series || []).filter(x => x.basis === v.id && TYPE[x.id]).map(x => rij(TYPE[x.id], true)).join('')).join('')}</table>`;
      const locs = m === 'trein' ? los.filter(v => v.soort === 'loc') : [], rijt = m === 'trein' ? los.filter(v => v.soort !== 'loc') : [];
      return `<h3>${MODI[m].naam}</h3>${tabel(lijst)}${locs.length ? `<h3>Locomotieven</h3><p class="klein">Een loc met losse rijtuigen stel je per lijn samen (lijnpaneel → Samenstelling).</p>${tabel(locs)}` : ''}${rijt.length ? `<h3>Losse rijtuigen en stuurstandrijtuigen</h3><p class="klein">Met een stuurstandrijtuig aan het eind kan de trein keren zonder dat de loc omloopt.</p>${tabel(rijt)}` : ''}`;
    }).join('');
    const museum = museumTypen(spel.jaar);
    const mus = museum.length ? `<h3>Museummaterieel (gerestaureerd)</h3><p class="klein">Rijdt niet meer in de dienstregeling, maar trekt veel belangstelling bij bijzondere ritten. Lage vaste kosten, wel duur per km.</p>
      <table class="tabel">${museum.map(v => `<tr><td><b>${esc(v.naam)}</b><br><span class="klein">${v.zit} zit · ${v.vmax} km/u · ${v.energie} · ${v.van}–${v.tot} · ${S.euroKort(museumPrijs(v))}</span></td><td class="getal">${spel.voertuigen[v.id] || 0}</td>
      <td><div class="rij" style="flex-wrap:nowrap"><button class="knop" data-actie="koop-museum" data-type="${v.id}" title="Kopen">＋</button><button class="knop" data-actie="verkoop" data-type="${v.id}" ${spel.voertuigen[v.id] ? '' : 'disabled'}>−</button></div></td></tr>`).join('')}</table>` : '';
    const sams = [...new Set([...(spel.samenstellingen || []), ...spel.lijnen.map(l => l.typeId).filter(id => TYPE[id]?.samen)])].filter(id => TYPE[id]);
    const samBlok = sams.length ? `<h3>Samengestelde treinen</h3><table class="tabel">${sams.map(id => { const t = TYPE[id], vrij = Math.min(...Object.entries(nodigPer(id)).map(([c, k]) => Math.floor((spel.voertuigen[c] || 0) / k)));
      return `<tr><td><b>${esc(t.naam)}</b><br><span class="klein">${t.vmax} km/u · ${komma(t.acc, 2)} m/s² · ${t.doorloop ? 'doorloop' : 'geen doorloop'} · ${S.euroKort(t.prijs)}</span></td><td class="getal">${vrij}</td><td><button class="knop klein" data-actie="bouwer-open" data-type="${id}">Kopiëren / meer</button></td></tr>`; }).join('')}</table>` : '';
    return `<h2>Vloot</h2><div class="rij">${['trein', 'metro', 'tram', 'bus'].filter(m => beschikbaar(spel.jaar, m).length).map(m => `<button class="knop hoofd" data-actie="bouwer-open" data-m="${m}">＋ ${MODI[m].naam} samenstellen</button>`).join('')}</div>
      <p class="klein">Materieel dat in ${spel.jaar} in Nederland reed. Prijzen zijn benaderingen in euro's van nu. Verkopen levert 45% op.</p>${samBlok}${groepen}${mus}`;
  },
  serie(d) {
    const b = TYPE[d.basis], modus = b.modus, ink = d.ink, wagons = wagonsVan(d.basis, modus);
    const per = plaatsenPerWagon(ink, d.basis), kl = klassenVan(ink, d.basis, modus);
    const doelId = zelfdeInterieur(ink, standaardInrichting(d.basis, modus)) ? d.basis : (spel.series || []).find(x => x.basis === d.basis && zelfdeInterieur(x.ink, ink))?.id;
    const voorstel = d.naam || serieNaamVoorstel(d.basis, ink);
    const prijs = doelId ? TYPE[doelId].prijs : Math.max(b.prijs * 0.8, b.prijs + interieurMeerprijs(ink, d.basis));
    const sel = (w, j, veld, waarden, x) => `<select data-wijzig="sw" data-w="${w}" data-d="${j}" data-veld="${veld}">${waarden.map(([v, n]) => `<option value="${v}" ${String(v) === String(x) ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
    const trein = modus === 'trein';
    const wagonRij = (w, i) => `<div class="kaartje"><div class="rij"><b>${wagons.length > 1 ? `Wagon ${i + 1}` : 'Indeling'}</b><span class="klein">${Math.round(wagons[i]?.lengte || 0)} m</span>
        <span style="margin-left:auto"></span>${w.delen.length < 3 ? `<button class="knop klein" data-actie="sw-splits" data-w="${i}" title="wagon in delen splitsen">½ splitsen</button>` : ''}${wagons.length > 1 ? `<button class="knop klein" data-actie="sw-kopie" data-w="${i}" title="alle wagons zo indelen">⇉ alle wagons zo</button>` : ''}</div>
      <table class="tabel klein">${w.delen.map((dl, j) => `<tr>
        <td>${sel(i, j, 'soort', trein ? [['zit', 'zitplaatsen'], ['rest', 'restauratie']] : [['zit', 'zitplaatsen']], dl.soort)}</td>
        ${w.delen.length > 1 ? `<td><input type="number" min="10" max="90" step="5" value="${Math.round(dl.len * 100)}" data-wijzig="sw" data-w="${i}" data-d="${j}" data-veld="len" style="width:3.6em">%</td>` : '<td></td>'}
        ${dl.soort === 'zit' ? `<td>${sel(i, j, 'klasse', KLASSEN.map(k => [k, KLASSE_NAAM[k]]), dl.klasse)}</td><td>${sel(i, j, 'stoel', Object.entries(STOEL).map(([v, st]) => [v, st.naam]), dl.stoel)}</td>
          <td>${sel(i, j, 'breed', Array.from({ length: maxBreed(d.basis) }, (_, k) => k + 1).map(x => [x, x + ' naast elkaar']), Math.min(dl.breed, maxBreed(d.basis)))}</td>
          <td>${sel(i, j, 'stroom', Object.entries(STROOM).filter(([v]) => stroomMag(v, modus, spel.jaar) || v === (dl.stroom || '')).map(([v, x]) => [v, x.naam]), dl.stroom || '')}</td><td>${sel(i, j, 'been', Object.entries(BEEN).map(([v, cm]) => [v, `${v} (${cm} cm)`]), dl.been)}</td>
          <td class="getal"><b>${per[i]?.[j]?.zit ?? 0}</b> zit${per[i]?.[j]?.sta ? ` + ${per[i][j].sta} sta` : ''}</td>`
        : `<td colspan="5">${dl.len >= 0.75 ? REST.vol.naam : REST.beperkt.naam}</td>`}
        <td>${w.delen.length > 1 ? `<button class="knop klein" data-actie="sw-weg" data-w="${i}" data-d="${j}" title="deel weghalen">✕</button>` : ''}</td></tr>`).join('')}</table></div>`;
    const eigen = Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && basisId(id) === d.basis);
    const ombouw = d.van && spel.voertuigen[d.van] && d.van !== doelId ? ombouwKosten(serieInrichting(d.van), ink, d.basis) : 0;
    const vzOpties = Object.entries(VOORZ).filter(([v]) => voorzMag(v, d.basis) || (ink.voorz || []).includes(v));
    if (d.kiezen) return `<p class="chip">Interieur voor het voertuig in je samenstelling. <button class="knop hoofd" data-actie="serie-kies">Dit interieur gebruiken</button> <button class="knop klein" data-actie="serie-kies-terug">Terug</button></p>` + PANELEN.serie({ ...d, kiezen: false, alleenOntwerp: true });
    return `${d.terug ? '<p class="chip">Voor je nieuwe lijn: ontwerp het interieur, koop het aantal dat je wilt en je gaat terug naar de lijn met deze serie gekozen. <button class="knop klein" data-actie="serie-terug">Terug zonder kopen</button></p>' : ''}<h2>Interieur: ${esc(b.naam)}</h2>
      <p class="klein">Het interieur hoort bij het voertuig en deel je per wagon in. Een wagon kan in delen (bv. half 1e en half 2e klas${trein ? ', of een halve wagon beperkte restauratie' : ''}). Klassen: Premium, 1e, 2e, 3e, 4e …; met een hoger kaartje mag je lager zitten, niet andersom. Een eigen interieur wordt een eigen serie. Catering aan je plaats en openingstijden regel je per lijn.</p>
      ${ink.wagons.map(wagonRij).join('')}
      <div class="rij"><button class="knop klein" data-actie="sn-standaard">Standaardinterieur</button></div>
      ${vzOpties.length ? `<h3>Voorzieningen</h3>${vzOpties.map(([v, x]) => `<label class="rij klein"><input type="checkbox" data-wijzig="sv" data-v="${v}" ${(ink.voorz || []).includes(v) ? 'checked' : ''}> ${x.naam} <span class="klein">(kost ${x.plekken} zitplaatsen, ${S.euroKort(x.prijs)}${x.bemand ? `, € ${x.uur}/uur open` : ''})</span></label>`).join('')}` : ''}
      <p>Per voertuig: ${kl.map(k => `<b>${KLASSE_NAAM[k.klasse]}</b> ${k.zit} zit${k.sta ? ` + ${k.sta} sta` : ''} (comfort ${komma(k.comfort)})`).join(' · ')}</p>
      ${doelId ? `<p class="chip">Dit interieur ${doelId === d.basis ? 'is het standaardinterieur' : `bestaat al: <b>${esc(TYPE[doelId].naam)}</b>`} (${spel.voertuigen[doelId] || 0} in bezit).</p>`
        : `<label class="veld">Naam van de nieuwe serie<input id="sn-naam" value="${esc(voorstel)}" maxlength="30"></label>`}
      ${d.alleenOntwerp ? '' : `<h3>Nieuw kopen</h3><div class="rij"><label class="veld">Aantal<input id="sn-n" type="number" min="1" max="200" value="${d.n || 1}" style="width:5em"></label>
        <span>${S.euroKort(prijs)} per stuk${prijs !== b.prijs ? ` <span class="klein">(standaard ${S.euroKort(b.prijs)})</span>` : ''}</span><button class="knop hoofd" data-actie="serie-koop">Kopen</button></div>
      ${eigen.length ? `<h3>Verbouwen</h3><div class="veld"><label>Bestaande voertuigen</label><select data-wijzig="sn-van"><option value="">— kies —</option>${eigen.map(id => `<option value="${id}" ${id === d.van ? 'selected' : ''}>${esc(TYPE[id].naam)} (${spel.voertuigen[id]} in bezit)</option>`).join('')}</select></div>
        ${d.van && d.van === doelId ? '<p class="klein">Pas het ontwerp hierboven aan om deze voertuigen te verbouwen.</p>' : d.van ? `<p>Verbouwen kost <b>${S.euroKort(ombouw)}</b> per voertuig. Het aantal hierboven geldt (hooguit ${spel.voertuigen[d.van]}).</p><button class="knop hoofd" data-actie="serie-verbouw">Verbouwen</button>` : ''}` : ''}`}`;
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
      ${rij('Personeel', m.personeel, true)}${rij('Energie en onderhoud', m.energie, true)}${rij('Spoorhuur (ProRail, baan en bovenleiding)', m.gebruik, true)}${m.overig ? rij('Overig / afspraken / onderhoud', m.overig, true) : ''}${spel.lening ? rij('Rente lening (aan het eind van de maand)', spel.lening * leningRente() / 12, true) : ''}
      <tr><th>Reizigers</th><th class="getal">${Math.round(m.reizigers).toLocaleString('nl-NL')}</th></tr></table>
      ${h.length ? `<h3>Resultaat per maand</h3><div style="display:flex;align-items:flex-end;gap:3px;height:90px;border-bottom:1px solid var(--lijn)">${h.map(x => `<div title="${S.euro(x.resultaat)}" style="flex:1;height:${Math.max(2, Math.abs(x.resultaat) / max * 88)}px;background:${x.resultaat < 0 ? 'var(--rood)' : 'var(--groen)'};border-radius:2px 2px 0 0"></div>`).join('')}</div>
      <p class="klein">Resultaat inclusief afschrijving van de vloot. Laatste maand: ${S.euro(h[h.length - 1].resultaat)}.</p>` : '<p class="klein">Na 30 speldagen verschijnt hier je eerste maandresultaat.</p>'}
      ${leningBlok()}
      <h3>Klassen en toeslagen</h3><p class="klein">Prijs per klasse in % van het standaardtarief; geldt voor al je lijnen. Reizigers kiezen op prijs én comfort: een dure klasse met slecht comfort blijft leeg. Met een kaartje voor een hogere klasse mag je lager zitten, niet andersom; bij drukte kopen sommigen een duurder kaartje om te kunnen zitten.</p>
      <label class="rij"><input type="checkbox" data-wijzig="beleid-op" ${spel.beleid?.opwaarderen ? 'checked' : ''}> Bij grote drukte mogen reizigers gratis een klasse hoger zitten (minder achterblijvers, maar klachten van wie wél betaalde)</label>
      ${spel.beleid?.opwaarderen ? `<label class="veld">Korting voor reizigers in de hogere klasse bij drukte (%)<input type="number" min="0" max="50" step="5" value="${Math.round((spel.beleid.korting || 0) * 100)}" data-wijzig="beleid-korting"></label><p class="klein">Met ongeveer 30% korting blijven de klachten uit; het kost wel kaartopbrengst.</p>` : ''}
      <div class="raster2">${KLASSEN.map(k => `<label class="veld">${KLASSE_NAAM[k]}<input type="number" min="10" max="600" step="5" value="${Math.round(klassePrijs(k) * 100)}" data-wijzig="kprijs" data-k="${k}"></label>`).join('')}</div>
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
      ${bouwProjecten().filter(p => p.station === s.naam).map(p => voortgang(p)).join('')}
      ${(spel.gebouwen || []).filter(g => g.station === s.naam).map(g => `<p class="chip">Stationsgebouw: ${esc(STIJLEN.find(x => x.id === g.stijl)?.naam || '')}, ${GROOTTE[g.grootte].naam}${isKlaar(g) ? '' : ' (in aanbouw)'}</p>`).join('')}
      ${stationGebouwNodig(s.naam) ? `<p class="klein" style="color:var(--rood)">Zonder stationsgebouw is er geen loket: in ${spel.jaar} kopen reizigers hun kaartje aan het loket, dus komen er hier minder.</p>` : ''}
      <div class="rij"><button class="knop hoofd" data-actie="perron-ontwerp" data-naam="${esc(s.naam)}" data-x="${s.x}" data-y="${s.y}">＋ Spoor met perron ontwerpen</button>
      <button class="knop" data-actie="gebouw-kies" data-naam="${esc(s.naam)}" data-x="${s.x}" data-y="${s.y}">＋ Stationsgebouw</button>
      <button class="knop" data-actie="bus-kies" data-naam="${esc(s.naam)}" data-x="${s.x}" data-y="${s.y}">＋ Busstation</button></div>`;
  },
  perronVoorstel(o) {
    const kosten = perronKosten(o);
    if (o.verdubbel) return `<h2>${(o.bestaand || 1) >= 2 ? `${(o.bestaand || 1) + 1}e spoor erbij` : 'Enkelspoor verdubbelen'}${o.naam && o.naam !== 'spoor' ? ' · ' + esc(o.naam) : ''}</h2>
      <p>${(o.bestaand || 1) >= 2 ? `Er liggen hier ${o.bestaand} sporen; een` : 'Een tweede'} spoor van ${komma(o.lengte / 1000)} km naast het bestaande, van wissel tot wissel, op 4,5 m hart-op-hart${o.vrij ? '' : ' <b>(let op: aan deze kant ligt iets in de weg)</b>'}.</p>
      <p>Kosten <b>${S.euroKort(kosten)}</b>, bouwtijd 2 speluren. Daarna telt dit stuk als ${(o.bestaand || 1) + 1 >= 3 ? `${(o.bestaand || 1) + 1} sporen: snelle en langzame treinen kunnen elkaar inhalen` : 'dubbelspoor: treinen hoeven niet meer op elkaar te wachten'}.</p>
      <div class="rij"><button class="knop hoofd" data-actie="perron-bouw">Bouwen</button><button class="knop" data-actie="perron-kant">Andere kant</button><button class="knop" data-actie="perron-stop">Annuleren</button></div>`;
    const vormen = [['zij', 'Spoor met zijperron'], ['eiland', 'Twee sporen met een eilandperron ertussen'], ...(o.naastPerron ? [['langs', 'Alleen een spoor langs het bestaande perron (wordt een eilandperron)']] : []),
      ['opstel', 'Opstelspoor (doodlopend, om een trein te parkeren tot zijn volgende rit)'], ['opstel2', 'Twee opstelsporen (klein rangeerterrein)'], ['kop', 'Kopspoor met perron'], ...(o.naastPerron ? [['kopLangs', 'Kopspoor langs het bestaande perron (gelijkvloers overstappen, zoals in Haarlem)']] : []), ['kop2', 'Twee kopsporen met een eilandperron ertussen']];
    const uitleg = { zij: 'een extra spoor met een perron van 250 × 5 m aan de buitenkant', eiland: 'twee extra sporen met een eilandperron van 250 × 8 m ertussen', langs: 'een extra spoor langs het bestaande perron, zodat aan beide kanten treinen stoppen',
      kop: 'een doodlopend spoor (stootjuk) met een perron: treinen keren hier zonder het doorgaande spoor te bezetten', kopLangs: 'een doodlopend spoor langs het bestaande perron: reizigers stappen gelijkvloers over naar de trein aan de overkant',
      kop2: 'twee doodlopende sporen met een eilandperron ertussen', opstel: 'een doodlopend opstelspoor zonder perron: treinen die lang moeten wachten maken hier het perron vrij', opstel2: 'twee opstelsporen naast elkaar' }[o.vorm];
    return `<h2>Nieuw perronspoor · ${esc(o.naam)}</h2>
      <div class="veld">${vormen.map(([v, n]) => `<label class="rij"><input type="radio" name="perron-vorm" data-wijzig="perron-vorm" value="${v}" ${o.vorm === v ? 'checked' : ''}> ${n}</label>`).join('')}</div>
      <p>${uitleg}; ${komma(o.lengte / 1000)} km spoor met wisselbogen, op ${o.afstand.toFixed(0)} m van het spoor waar je klikte${o.naast === 'perron' ? ', naast het bestaande perron' : ''}.</p>
      <p>Kosten <b>${S.euroKort(kosten)}</b>, bouwtijd 2 speluren. Daarna hoort het spoor bij het net (van jou).</p>
      <div class="rij"><button class="knop hoofd" data-actie="perron-bouw">Bouwen</button>
      <button class="knop" data-actie="perron-kant">Andere kant</button>${o.vorm.startsWith('kop') || o.vorm.startsWith('opstel') ? '<button class="knop" data-actie="perron-eind">Wissel aan het andere eind</button>' : ''}
      <button class="knop" data-actie="perron-stop">Annuleren</button></div>`;
  },
  gebouw(d) {
    const stijlen = stijlenVoor(spel.jaar), st = STIJLEN.find(x => x.id === d.stijl) || stijlen[0];
    const groottes = Object.keys(GROOTTE).filter(g => !st.min || Object.keys(GROOTTE).indexOf(g) >= Object.keys(GROOTTE).indexOf(st.min));
    const gr = groottes.includes(d.grootte) ? d.grootte : groottes[0], G = GROOTTE[gr];
    return `<h2>Stationsgebouw · ${esc(d.station)}</h2>
      <div class="veld"><label>Stijl (wat er in ${spel.jaar} gebouwd kan worden)</label>${stijlen.map(x => `<label class="rij"><input type="radio" name="gb-stijl" data-wijzig="gb-stijl" value="${x.id}" ${x.id === st.id ? 'checked' : ''}><span style="display:inline-block;width:12px;height:12px;background:${x.kleur};border:1px solid #444;margin-right:4px"></span> ${x.naam}</label>`).join('')}</div>
      <div class="veld"><label>Grootte</label><select data-wijzig="gb-grootte">${groottes.map(g => `<option value="${g}" ${g === gr ? 'selected' : ''}>${GROOTTE[g].naam} · ${G.l && GROOTTE[g].l}×${GROOTTE[g].b} m</option>`).join('')}</select></div>
      <p>Bouwsom <b>${S.euroKort(gebouwPrijs(st, gr))}</b>, 2 speluren · onderhoud ${S.euro(G.onderhoud)}/maand${winkelHuur(gr, spel.jaar) ? ` · winkelhuur ${S.euro(winkelHuur(gr, spel.jaar))}/maand` : ''} · ${Math.round((G.bonus + (st.extra || 0)) * 100)}% meer reizigers${spel.jaar < 1990 ? ' (en een loket: zonder gebouw verkoop je hier veel minder kaartjes)' : ''}.</p>
      ${d.plek ? `<div class="rij"><button class="knop hoofd" data-actie="gebouw-bouw">Bouwen</button><button class="knop" data-actie="gebouw-draai">↻ Draaien</button><button class="knop" data-actie="gebouw-plaats">Andere plek</button><button class="knop" data-actie="perron-stop">Annuleren</button></div>`
        : `<button class="knop hoofd" data-actie="gebouw-plaats">Plaats op de kaart</button>`}`;
  },
  busstation(d) {
    const kosten = busKosten(d);
    return `<h2>Busstation · ${esc(d.station)}</h2>
      <div class="raster2"><label class="veld">Aantal haltes (perrons)<input type="number" min="1" max="16" value="${d.n}" data-wijzig="bs-n"></label></div>
      <div class="veld">${[['rij', 'Op een rij langs één perron'], ['naast', 'Naast elkaar, elk een eigen perron (zoals Naarden-Bussum)'], ['zaagtand', 'Zaagtand: schuin insteken langs één perron'], ['hoekjes', 'Inrijhoekjes rond eilandjes (zoals P+R Muiden)']].map(([v, t]) => `<label class="rij"><input type="radio" name="bs-op" data-wijzig="bs-op" value="${v}" ${d.opstelling === v ? 'checked' : ''}> ${t}</label>`).join('')}</div>
      <p>Kosten <b>${S.euroKort(kosten)}</b>, 2 speluren. De haltes heten ${esc(d.station)}, perron A, B, … en tellen bij het station (overstappen).</p>
      ${d.plek ? `<div class="rij"><button class="knop hoofd" data-actie="bus-bouw">Bouwen</button><button class="knop" data-actie="bus-draai" data-g="-15">↺ 15°</button><button class="knop" data-actie="bus-draai" data-g="15">↻ 15°</button><button class="knop" data-actie="bus-draai" data-g="90">↻ 90°</button><button class="knop" data-actie="bus-plaats">Andere plek</button><button class="knop" data-actie="perron-stop">Annuleren</button></div>`
        : `<button class="knop hoofd" data-actie="bus-plaats">Plaats op de kaart</button>`}`;
  },
  kruising(d) {
    return `<h2>Ongelijkvloerse kruising</h2><p>Een splitsing of kruising met ${d.takken} sporen. Treinen die elkaar hier kruisen moeten nu op elkaar wachten.</p>
      <div class="rij"><button class="knop hoofd" data-actie="kruising-bouw" data-s="flyover">Flyover (€ 60 mln)</button><button class="knop hoofd" data-actie="kruising-bouw" data-s="diveunder">Dive-under (€ 90 mln)</button><button class="knop" data-actie="perron-stop">Annuleren</button></div>
      <p class="klein">Bouwtijd 2 speluren. Op de kaart zie je ▲ (flyover, over het andere spoor) of ▼ (dive-under, eronderdoor). Let op: het spel rekent nog niet met wachttijd bij gelijkvloerse kruisingen; dit is voorlopig vooral zichtbaar en voor later.</p>`;
  },
  spoorvak(d) {
    const t = takVan(d.ti); if (!t) return '<p>Spoor niet gevonden.</p>';
    const bv = baanvak(spel, net, t), km = bv.lengte / 1000, nu = bv.sys;
    const soortNaam = ['treinspoor', 'sneltramspoor', 'metrospoor', 'tramspoor', 'smalspoor'][t.soort] || 'spoor';
    const opties = [...systemenVoorSoort(t.soort), null];
    const conflict = sys => lijnenOpBaanvak(bv.takken).filter(x => kanOp(x.typeId, nu) && !kanOp(x.typeId, sys) && !(x.lijn.sleeploc && kanOp(x.lijn.sleeploc, sys)));
    const keuze = d.kies !== undefined ? d.kies : undefined, kc = keuze !== undefined ? conflict(keuze) : [];
    return `<h2>${soortNaam[0].toUpperCase() + soortNaam.slice(1)}${t.naam && typeof t.naam === 'string' ? ' · ' + esc(t.naam) : ''}</h2>
      <p class="klein">Baanvak ${komma(km)} km · ${t.sporen >= 2 ? t.sporen + ' sporen' : 'enkelspoor'} · max ${t.vmax || '?'} km/u · spoorwijdte ${t.soort === 4 ? 'smalspoor' : 'normaalspoor (1435 mm)'} · ${t.eigenaar === 'speler' ? 'van jou' : 'ProRail'}${t.hoogte > 0 ? ' · viaduct' : t.hoogte < 0 ? ' · tunnel' : ''}</p>
      <p>Elektrificatie: <b>${nu ? SYSTEMEN[nu].naam : 'geen bovenleiding'}</b></p>
      <div class="veld"><label>Andere spanning voor dit baanvak</label>${opties.map(sys => { const c = sys === nu ? [] : conflict(sys); return `<label class="rij" style="${c.length ? 'opacity:.45' : ''}"><input type="radio" name="sv" data-wijzig="sv-kies" value="${sys || ''}" ${sys === (keuze !== undefined ? keuze : nu) ? 'checked' : ''}> ${sys ? SYSTEMEN[sys].naam : 'geen bovenleiding (alleen diesel, stoom, accu)'}${sys === nu ? ' (nu)' : c.length ? ` <span class="klein">— ${c.length} lijn(en) kunnen dan niet rijden</span>` : sys ? ` <span class="klein">${S.euroKort(ombouwKostenStroom(nu, sys, km))}</span>` : ''}</label>`; }).join('')}</div>
      ${keuze !== undefined && keuze !== nu ? (kc.length ? `<div class="kaartje"><b>Deze lijnen kunnen dan niet meer rijden:</b>${kc.map(x => `<p class="klein">${x.lijn.ai ? esc(x.lijn.vervoerderNaam || '') : 'Jouw lijn'} <b>${esc(x.lijn.nr || x.lijn.naam || '')}</b> (${esc(TYPE[x.typeId]?.naam || x.typeId)})
          ${x.lijn.ai ? '— van een andere vervoerder: die rijdt dan niet meer. Kies een spanning waar hun materieel op kan.' : `<br><button class="knop klein" data-actie="toon-lijn" data-id="${x.lijn.id}">Ander materieel kiezen</button> ${sleeplocKnoppen(x.lijn, keuze)}`}</p>`).join('')}</div>` : '')
        + `<button class="knop hoofd" data-actie="sv-zet" data-ti="${d.ti}" ${kc.some(x => x.lijn.ai) ? 'disabled' : ''}>Ombouwen naar ${keuze ? SYSTEMEN[keuze].naam : 'geen bovenleiding'} (${S.euroKort(ombouwKostenStroom(nu, keuze, km))})</button>${kc.some(x => !x.lijn.ai) ? '<p class="klein">Jouw lijnen die niet kunnen, stoppen tot je ander materieel of een sleeploc kiest.</p>' : ''}` : ''}
      <p class="klein">Elektrisch materieel rijdt alleen op spanningen die het aankan (meersysteemtreinen en -locs kunnen er meer). Diesel, stoom en accutreinen rijden overal; een paardentram alleen op tramspoor.</p>`;
  },
  bouwer(d) {
    const rail = ['trein', 'metro', 'sneltram', 'tram'].includes(d.modus);
    const kaarten = d.delen.map((x, i) => bouwKaart(d, x, i)).join(d.modus === 'trein' ? '' : '');
    const lijst = bouwLijst(d), t = lijst.length > 1 ? samenstelling(lijst) : TYPE[lijst[0]];
    const p = prestaties(d.delen.filter(x => TYPE[x.id]).map(x => ({ id: x.id, n: x.n || 1 })), id => bakkenVan(id, d.modus));
    const kl = t ? klassenVan(serieInrichting(t.id), t.id, d.modus) : [];
    const prijs = d.delen.reduce((a, x) => a + (TYPE[x.id]?.prijs || 0) * (x.n || 1), 0), lengte = Math.round(lijst.reduce((a, id) => a + (uiterlijk(id, d.modus)._l || 0), 0));
    const doorloopOk = t?.samen ? t.doorloop : true, magAanvullen = rail && d.modus === 'trein';
    const vrijeVmax = p.vbouw === Infinity ? 0 : p.vbouw;
    const advies = p.kw && p.acc < 0.3 && magAanvullen ? '<p class="klein" style="color:var(--rood)">Traag optrekken met dit gewicht. Sluit af met een tweede loc in plaats van een stuurstandrijtuig, of neem minder rijtuigen.</p>' : '';
    return `<h2>Voertuig samenstellen · ${esc(MODI[d.modus].naam)}</h2>
      ${d.terug ? '<p class="chip">Voor je nieuwe lijn: stel het voertuig samen, koop het en je gaat terug naar de lijn. <button class="knop klein" data-actie="bouwer-terug">Terug zonder kopen</button></p>' : ''}
      <p class="klein">${magAanvullen ? 'Begin met een loc of een compleet treinstel, zet er rijtuigen of treinstellen achter (met aantal) en sluit af met een loc, stuurstandrijtuig of treinstel. Scroll naar rechts.' : 'Kies het voertuig en zijn interieur.'}</p>
      <div class="bouwrij">${kaarten}${magAanvullen ? `<button class="knop bouw-erbij" data-actie="bw-erbij" title="Rijtuig of treinstel toevoegen">＋</button>` : ''}</div>
      ${t ? `<div class="kaartje"><b>${esc(t.naam || '')}</b> · ${lengte} m · ${Math.round(p.ton)} ton · ${p.kw ? Math.round(p.kw).toLocaleString('nl-NL') + ' kW' : 'geen aandrijving'}
        <br>Topsnelheid <b>${Math.round(p.kw ? p.vmax : 0)} km/u</b> <span class="klein">(gebouwd voor ${Math.round(vrijeVmax)} km/u${p.kw && p.vmaxVermogen < vrijeVmax ? `, met dit gewicht haalt het vermogen ${p.vmaxVermogen} km/u` : ''}; nooit sneller dan het spoor of de weg toelaat)</span>
        · optrekken <b>${komma(p.acc, 2)} m/s²</b>${t.keerExtra ? ` · <span style="color:var(--rood)">geen stuurstand aan het eind: de loc loopt om bij het keren (+${t.keerExtra} min)</span>` : ''}
        <br>${kl.map(k => `${KLASSE_NAAM[k.klasse]} ${k.zit} zit${k.sta ? ` + ${k.sta} sta` : ''}`).join(' · ') || 'geen reizigersruimte'}
        ${t.samen ? `<br>${doorloopOk ? 'Je kunt door de hele trein lopen (restauratie bereikbaar, controle in één keer).' : 'Niet door de hele trein te lopen: tussen de treinstellen geen doorloop (restauratie alleen in het eigen deel, controleurs wisselen op een station).'}` : ''}
        ${p.kw ? '' : '<br><b style="color:var(--rood)">Zonder loc of aangedreven treinstel kan dit niet rijden.</b>'}</div>${advies}
      <div class="rij"><label class="veld">Aantal treinen<input id="bw-aantal" type="number" min="1" max="200" value="${d.aantal || 1}" data-wijzig="bw-aantal" style="width:5em"></label>
        <span>${S.euroKort(prijs)} per trein · totaal <b>${S.euroKort(prijs * (d.aantal || 1))}</b></span>
        <button class="knop hoofd" data-actie="bw-koop" ${p.kw ? '' : 'disabled'}>Kopen</button></div>` : '<p>Kies eerst een voertuig.</p>'}`;
  },
  bouw() {
    const pr = bouwProjecten();
    if (!pr.length) return '<h2>Bouwprojecten</h2><p>Er wordt nu niets gebouwd.</p>';
    return `<h2>Bouwprojecten</h2><p class="klein">Bouwen duurt 2 speluren; de echte tijd geldt bij de huidige snelheid (${snelheid}×). Versneld bouwen (extra ploegen, ook 's nachts) halveert de resterende tijd voor 40% van de bouwsom.</p>
      ${pr.map((p, i) => voortgang(p, i)).join('')}`;
  },
  nieuwStation(d) {
    const o = stationOntwerp(d), kosten = o ? stationKosten(o, d) : 6e6;
    const max = (o?.bestaand || 1) + 6;
    return `<h2>Nieuw${d.soort === 'halte' ? 'e halte' : ' station'}</h2><p class="klein">Op het ${d.modus === 'metro' ? 'metro' : ''}spoor bij ${esc(d.plaats || 'deze plek')}${o ? ` · hier ligt ${o.bestaand === 2 ? 'dubbelspoor' : 'enkelspoor'}` : ''}.</p>
      <div class="rij"><label class="rij"><input type="radio" name="ns-soort" data-wijzig="ns-soort" value="station" ${d.soort !== 'halte' ? 'checked' : ''}> Station</label><label class="rij"><input type="radio" name="ns-soort" data-wijzig="ns-soort" value="halte" ${d.soort === 'halte' ? 'checked' : ''}> Halte (eenvoudig: alleen perrons, goedkoper)</label></div>
      ${d.combiMogelijk ? `<label class="rij"><input type="checkbox" data-wijzig="ns-combi" ${d.combi ? 'checked' : ''}> Gecombineerd trein- en metrostation</label>` : ''}
      <div class="veld"><label for="ns-naam">Naam</label><input id="ns-naam" value="${esc(d.naam)}" maxlength="40" data-wijzig="ns-naam"></div>
      ${o ? `<div class="raster2"><label class="veld">Sporen bij het station<select data-wijzig="ns-sporen">${Array.from({ length: max - o.bestaand + 1 }, (_, k) => o.bestaand + k).map(n => `<option value="${n}" ${n === (d.sporen || o.bestaand) ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <label class="rij"><input type="checkbox" data-wijzig="ns-doorgaand" ${d.doorgaand ? 'checked' : ''}> Bestaande sporen blijven doorgaand (zonder perron); de perrons komen langs nieuwe sporen ernaast</label>
        <p>Doorsnede: <b style="font-family:monospace;letter-spacing:2px">${doorsnedeTekst(o.doorsnede)}</b> <span class="klein">(═ bestaand spoor, ─ nieuw spoor, ▭ perron)</span>
        <button class="knop klein" data-actie="ns-kant">⇄ Andere kant</button></p>
        <p class="klein">${o.sporen.length} nieuw(e) spoor/sporen, ${o.vlakken.length} perron(s)${o.eilanden ? ` waarvan ${o.eilanden} eilandperron(s)` : ''} van 220 m.</p>` : ''}
      <div class="rij"><button class="knop hoofd" data-actie="station-zelf">Zelf bouwen (${S.euroKort(kosten)}, 2 speluren)</button><button class="knop" data-actie="station-prorail">ProRail vragen (gratis, als het rendeert)</button></div>
      <p class="klein">Een eigen station is van jou: andere vervoerders moeten jou vragen om er te stoppen. ProRail bouwt alleen als de maatschappelijke kosten-batenanalyse (MKBA) positief is.</p>`;
  },
  nieuwSpoor(d) {
    const st = d._st || spoorStukken(d), S2 = SPOORSOORT[d.soort], kosten = spoorKosten(d, st);
    const ex = d.soort === 'trolley' ? 'bovenleiding' : 'spoor';
    return `<h2>Nieuw ${S2.naam}</h2>
      <p>Tracé ${komma(st.totaal / 1000)} km${d.hergebruik && st.bestaandM > 100 ? `, waarvan ${komma(st.bestaandM / 1000)} km over bestaand ${ex} (wordt niet opnieuw aangelegd)` : ''}: <b>${komma(st.nieuwM / 1000)} km nieuw</b> in ${st.nieuw.length} stuk(ken).</p>
      ${d.verbinding ? `<p class="chip">Er ligt al een ${d.soort === 'trolley' ? '' : 'spoor'}verbinding tussen begin en eind van ${komma(d.verbinding / 1000)} km. Een nieuw tracé is alleen nodig als het korter of sneller moet.</p>` : ''}
      <p class="klein">Versleep de bolletjes (punten) en vierkantjes (handvatten) op de kaart om het tracé te buigen, zoals in een tekenprogramma.</p>
      <div class="rij"><button class="knop klein" data-actie="spoor-auto">Automatisch tracé (om de bebouwing heen)</button><button class="knop klein" data-actie="spoor-recht">Handvatten terugzetten</button></div>
      <label class="rij"><input type="checkbox" data-wijzig="spoor-hergebruik" ${d.hergebruik ? 'checked' : ''}> Bestaand ${ex} gebruiken waar het tracé eroverheen loopt</label>
      ${d.soort === 'trolley' ? '' : `<div class="veld"><label>Aantal sporen</label><select data-wijzig="spoor-n">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === d.sporen ? 'selected' : ''}>${n === 1 ? 'enkelspoor' : n === 2 ? 'dubbelspoor' : n + ' sporen'}</option>`).join('')}</select></div>`}
      <p>Kosten <b>${S.euroKort(kosten)}</b>, bouwtijd 2 speluren.</p>
      <div class="rij"><button class="knop hoofd" data-actie="spoor-zelf" ${st.nieuwM < 60 ? 'disabled' : ''}>Zelf aanleggen</button>${d.soort === 'trein' ? '<button class="knop" data-actie="spoor-prorail">ProRail vragen</button>' : ''}<button class="knop" data-actie="spoor-stop">Annuleren</button></div>
      ${st.nieuwM < 60 ? `<p class="klein">Er hoeft niets nieuws te komen: het tracé ligt helemaal over bestaand ${ex}.</p>` : ''}
      <p class="klein">Eigen spoor is van jou: je betaalt geen spoorhuur, en anderen betalen jou als ze er willen rijden.</p>`;
  },
  nieuweLijn(d) {
    if (d.geklikt) d.haltes = d.stopOveral ? d.overal : d.geklikt;
    let typen = typenVoor(d.modus);
    if (d.modus !== 'vlucht') { // alleen wat je al hebt (of samengesteld hebt), plus 'nieuw samenstellen'
      const eigen = typen.filter(v => v.samen ? Object.entries(nodigPer(v.id)).every(([c]) => spel.voertuigen[c]) : spel.voertuigen[v.id]);
      for (const id of spel.samenstellingen || []) { const t = TYPE[id]; if (t && t.modus === d.modus && !eigen.includes(t)) eigen.push(t); }
      if (d.typeKeuze && TYPE[d.typeKeuze] && !eigen.includes(TYPE[d.typeKeuze])) eigen.push(TYPE[d.typeKeuze]);
      typen = eigen.length ? eigen : typen; d.geenEigen = !eigen.length;
    }
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
      ${d.overal && d.overal.length > d.geklikt.length ? `<label class="rij"><input type="checkbox" data-wijzig="nl-overal" ${d.stopOveral ? 'checked' : ''}> Stoppen op alle tussenliggende ${d.modus === 'trein' ? 'stations' : 'haltes'} (${d.overal.length - d.geklikt.length} extra)</label>` : ''}
      <ol class="haltelijst">${d.haltes.map(h => `<li>${esc(h.naam)}${d.stopOveral && !d.geklikt.some(g => g.naam === h.naam) ? ' <span class="klein">(tussenstop)</span>' : ''}</li>`).join('')}</ol>
      ${d.terugVan ? `<p class="chip">Terugweg van lijn ${esc(d.terugVan.nr)} (${esc(d.terugVan.naam || '')}): samen vormen ze één lijn met een eigen route per richting.</p>`
        : d.rond ? `<p class="chip">Rondlijn: de voertuigen rijden steeds hetzelfde rondje, er is geen terugweg.</p>`
        : `<div class="veld"><label>Richting</label>
          <label class="rij"><input type="radio" name="nl-richting" data-wijzig="nl-richting" value="beide" ${d.richting === 'beide' ? 'checked' : ''}> Heen en terug over dezelfde route</label>
          <label class="rij"><input type="radio" name="nl-richting" data-wijzig="nl-richting" value="heen" ${d.richting === 'heen' ? 'checked' : ''}> Alleen deze richting (de terugweg bouw je daarna apart, of de voertuigen rijden leeg terug)</label>
          <p class="klein">Een rondlijn maak je door als laatste weer op de eerste halte te klikken.</p></div>`}
      <div class="raster2"><label class="veld">Lijnnummer<input id="nl-nr" value="${esc(d.nrIn ?? (d.terugVan ? d.terugVan.nr : d.modus === 'trein' ? 'RE' + vrijNr : vrijNr))}" maxlength="8"></label>
      <label class="veld">Naam<input id="nl-naam" value="${esc(d.naamIn ?? (d.rond ? 'Ring ' + d.haltes[0].naam.split(',')[0] : d.haltes[0].naam.split(',')[0] + ' – ' + d.haltes[d.haltes.length - 1].naam.split(',')[0]))}" maxlength="60"></label></div>
      <div class="veld"><label for="nl-type">Materieel</label><select id="nl-type" data-wijzig="nl-type">${typen.map(v => `<option value="${v.id}" ${v.id === d.typeKeuze ? 'selected' : ''}>${esc(v.naam)} · ${plaatsenVan(v.id)} pl. · ${S.euroKort(v.prijs)}${spel.voertuigen[v.id] ? ` · ${spel.voertuigen[v.id]} in bezit` : ''}</option>`).join('')}</select>
        <button class="knop klein hoofd" data-actie="nl-bouwer">＋ Nieuwe voertuigen samenstellen…</button></div>
      ${d.geenEigen ? '<p class="klein">Je hebt nog geen voertuigen van deze soort: de lijst toont wat te koop is. Met "Nieuwe voertuigen samenstellen" kies je zelf (foto, interieur, aantal).</p>' : ''}
      ${nodigBlok(d, typen)}
      <div class="raster2"><label class="veld">Spits elke (min)<input id="nl-spits" type="number" value="${d.spitsIn ?? (d.modus === 'trein' ? 30 : 15)}" min="3"></label><label class="veld">Dal elke (min)<input id="nl-dal" type="number" value="${d.dalIn ?? 30}" min="3"></label><label class="veld">Avond elke (min)<input id="nl-avond" type="number" value="${d.avondIn ?? 60}" min="3"></label></div>
      <label class="rij"><input type="checkbox" data-wijzig="nl-bijzonder" ${d.bijzonder ? 'checked' : ''}> Eenmalige bijzondere rit (bv. stoomtrein of themarit)</label>
      ${d.bijzonder ? `<div class="raster2"><label class="veld">Over hoeveel dagen<input id="nb-dagen" type="number" min="3" max="90" value="14"></label><label class="veld">Vertrek<input id="nb-tijd" type="time" value="10:00"></label>
        <label class="veld">Prijs per persoon €<input id="nb-prijs" type="number" min="0" step="1" value="${Math.round(gewonePrijs(d.modus, d.route.lengte / 1000) * 1.8)}"></label></div>
        <div class="veld"><label for="nb-type">Materieel (in bezit)</label><select id="nb-type">${[...typenVoor(d.modus), ...museumTypen(spel.jaar).filter(t => t.modus === d.modus)].filter(t => spel.voertuigen[t.id]).map(t => `<option value="${t.id}">${esc(t.naam)}${isMuseum(t, spel.jaar) ? ' (museum)' : ''} · ${spel.voertuigen[t.id]} in bezit</option>`).join('') || '<option value="">— geen materieel in bezit: koop eerst bij Vloot —</option>'}</select></div>
        <p class="klein">Mensen schrijven zich in tot de dag van de rit. Museummaterieel en weekenddagen trekken veel meer belangstelling.</p>
        <div class="rij"><button class="knop hoofd" data-actie="bijzonder-maak">Rit uitschrijven</button><button class="knop" data-actie="lijn-annuleer">Annuleren</button></div>` : ''}
      <div ${d.bijzonder ? 'hidden' : ''}>
      ${d.richting === 'heen' && !d.terugVan && !d.rond ? '<label class="rij"><input type="checkbox" id="nl-terug" checked> Daarna meteen de terugweg bouwen (andere route of andere haltes)</label>' : ''}
      <label class="rij"><input type="checkbox" id="nl-koop" checked> Benodigd materieel meteen kopen</label>
      <label class="rij"><input type="checkbox" id="nl-concessie" checked> Concessie (subsidie) aanvragen bij de provincie</label>
      ${d.modus === 'trein' ? '<p class="klein">Ruimte op het spoor krijg je altijd van ProRail; je betaalt spoorhuur (€ 1,95 per treinkilometer en € 6 per stop; over je eigen spoor niets).</p>' : ['tram', 'metro', 'sneltram'].includes(d.modus) ? '<p class="klein">Je huurt de baan: € 0,90 per voertuigkilometer (over je eigen spoor niets).</p>' : ''}
      ${aanbodVoorNieuw(d)}
      <div class="rij"><button class="knop hoofd" data-actie="lijn-maak">Lijn openen</button><button class="knop" data-actie="lijn-annuleer">Annuleren</button></div></div>`;
  },
  aiLijn(a) {
    return `<h2><span class="lijnnr" style="background:${esc(a.kleur)}">${esc(a.nr)}</span> ${esc(a.vervoerderNaam)}</h2>
      <p>${esc(a.naam || '')}${a.kop ? ` · richting ${esc(a.kop)}` : ''}</p><p class="klein">${MODI[a.modus]?.naam || a.modus} · ${a.haltes.length} haltes · ${a.vertrek[0].length} ritten per dag in deze richting · goodwill ${spel.goodwill[a.vervoerder] ?? 0}</p>
      <ol class="haltelijst">${a.haltes.map((h, i) => `<li>${esc(h.naam)} <span class="klein">+${Math.round(a.t[i] / 60)}′</span></li>`).join('')}</ol>
      ${lijnGroep(a).length > 1 ? `<p class="klein">Andere richtingen: ${lijnGroep(a).filter(x => x !== a).map(x => esc(x.kop || x.haltes[x.haltes.length - 1].naam)).join(', ')}</p>` : ''}
      <h3>Voertuigen op deze lijn</h3>${voertuigTabel(a)}
      <p class="klein">Deze lijn is van ${esc(a.vervoerderNaam)}. Klik op een voertuig om een verzoek te doen (eerder of later rijden, langer wachten), of open je eigen lijn en kies <b>Verzoek</b> bij een gedeelde halte.</p>`;
  },
};

// ---------------------------------------------------------------- acties uit panelen
function koppel(el) {
  el.querySelectorAll('[data-actie]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); actie(b.dataset.actie, b.dataset); }));
  el.querySelectorAll('[data-wijzig]').forEach(i => i.addEventListener('change', () => wijzig(i.dataset.wijzig, i)));
}
const lijnVan = id => spel.lijnen.find(l => l.id === id);
function betaal(bedrag, wat) {
  if (spel.geld - bedrag < -20e6) { melding(`Te weinig geld voor ${wat}. Je kunt maximaal € 20 mln rood staan. Sluit een lening af bij Geld → Lening.`, 8000); return false; }
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
    case 'terugweg': sluitPaneel(); terugwegBouwen(l); break;
    case 'halte-weg': halteWeghalen(l, +d.i); break;
    case 'halte-erbij': zetTool('lijnhalte'); bouw = { lijnId: l.id, modus: l.modus }; hint(`Klik een ${l.modus === 'trein' ? 'station' : 'halte'} aan om toe te voegen aan lijn ${l.nr}. Het komt vanzelf op de goede plek in de route.`, [['Klaar', () => { const x = lijnVan(bouw?.lijnId); zetTool('kijk'); if (x) openPaneel('lijn', x); }]]); break;
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
    case 'opheffen': if (d.zeker) { spel.lijnen = spel.lijnen.filter(x => x !== l); const pr = l.paar && lijnVan(l.paar); if (pr) { pr.paar = null; S.herbereken(pr); } sluitPaneel(); melding(`Lijn ${l.nr} opgeheven.`); }
      else { const b = document.querySelector('[data-actie="opheffen"]'); b.textContent = 'Zeker weten? Klik nog eens'; b.dataset.zeker = '1'; } break;
    case 'serie-open': { const t = TYPE[d.type]; if (!t) break; openPaneel('serie', { basis: basisId(d.type), van: spel.voertuigen[d.type] ? d.type : null, ink: JSON.parse(JSON.stringify(serieInrichting(d.type))), n: 1 }); break; }
    case 'sw-splits': { const w = paneelData.ink.wagons[+d.w], laatst = w.delen[w.delen.length - 1]; laatst.len = laatst.len / 2; w.delen.push({ ...laatst }); paneelData.naam = null; ververs(); break; }
    case 'sw-weg': { const w = paneelData.ink.wagons[+d.w]; if (w.delen.length > 1) { const [weg] = w.delen.splice(+d.d, 1); w.delen[Math.max(0, +d.d - 1)].len += weg.len; } paneelData.naam = null; ververs(); break; }
    case 'sw-kopie': { const w = paneelData.ink.wagons[+d.w]; paneelData.ink.wagons = paneelData.ink.wagons.map(() => JSON.parse(JSON.stringify(w))); paneelData.naam = null; ververs(); break; }
    case 'sn-standaard': paneelData.ink = standaardInrichting(paneelData.basis, TYPE[paneelData.basis].modus); paneelData.naam = null; ververs(); break;
    case 'sam-erbij': { const v = $('sam-kies')?.value; if (v) { l._sam = l._sam || [...delenVan(l.typeId)]; l._sam.push(v); } ververs(); break; }
    case 'sam-weg': l._sam.splice(+d.i, 1); ververs(); break;
    case 'sam-op': { const k = +d.i; [l._sam[k - 1], l._sam[k]] = [l._sam[k], l._sam[k - 1]]; ververs(); break; }
    case 'sam-terug': l._sam = null; ververs(); break;
    case 'sam-toepassen': { const o = l._sam; if (!o?.length) break; l.typeId = o.length > 1 ? samenstelling(o).id : o[0]; l._sam = null; S.herbereken(l); padOpnieuwNodig(l);
      stroomBijwerken(l); melding(`Lijn ${l.nr} rijdt nu met ${TYPE[l.typeId].naam}.`); ververs(); break; }
    case 'koop-nodig': {
      const tekort = Object.entries(nodigPer(l.typeId)).map(([c, k]) => [c, Math.max(0, k * l.nodig - (spel.voertuigen[c] || 0))]).filter(x => x[1] > 0);
      const kosten = tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0);
      if (!tekort.length || !betaal(kosten, 'materieel')) break;
      for (const [c, n] of tekort) spel.voertuigen[c] = (spel.voertuigen[c] || 0) + n;
      melding(`Gekocht: ${tekort.map(([c, n]) => `${n} × ${TYPE[c].naam}`).join(', ')} (${S.euroKort(kosten)}).`); ververs(); break;
    }
    case 'paneel': openPaneel(d.p); break;
    case 'bouwer-open': openPaneel('bouwer', d.type ? bouwVan(d.type) : { modus: d.m || 'trein', delen: [{ id: '', n: 1 }], aantal: 1 }); break;
    case 'bw-erbij': { const dd = paneelData, laatste = dd.delen.length >= 3 ? dd.delen.length - 1 : dd.delen.length; dd.delen.splice(laatste, 0, { id: '', n: 1 }); if (dd.delen.length === 2) dd.delen.push({ id: '', n: 1 }); ververs(); break; }
    case 'bw-weg': paneelData.delen.splice(+d.i, 1); ververs(); break;
    case 'bw-ink': { const dd = paneelData, x = dd.delen[+d.i]; if (!TYPE[x.id]) break; terugNaarBouwer = { d: dd, i: +d.i };
      openPaneel('serie', { basis: basisId(x.id), van: null, ink: JSON.parse(JSON.stringify(serieInrichting(x.id))), n: 1, kiezen: true }); break; }
    case 'serie-kies': { const g = paneelData; if (!terugNaarBouwer) break; const id = serieVoor(g.basis, g.ink, $('sn-naam')?.value); const { d: dd, i } = terugNaarBouwer; terugNaarBouwer = null; dd.delen[i].id = id; openPaneel('bouwer', dd); break; }
    case 'serie-kies-terug': if (terugNaarBouwer) { const { d: dd } = terugNaarBouwer; terugNaarBouwer = null; openPaneel('bouwer', dd); } break;
    case 'bouwer-terug': if (terugNaarLijn) { const t2 = terugNaarLijn; terugNaarLijn = null; openPaneel('nieuweLijn', t2); } break;
    case 'bw-koop': {
      const dd = paneelData, lijst = bouwLijst(dd), n = Math.max(1, Math.round(+$('bw-aantal')?.value || dd.aantal || 1)); if (!lijst.length) break;
      const id = lijst.length > 1 ? samenstelling(lijst).id : lijst[0], per = {}; for (const c of lijst) per[c] = (per[c] || 0) + 1;
      const kosten = Object.entries(per).reduce((a, [c, k]) => a + TYPE[c].prijs * k * n, 0);
      if (!betaal(kosten, `${n} × ${TYPE[id].naam}`)) break;
      for (const [c, k] of Object.entries(per)) spel.voertuigen[c] = (spel.voertuigen[c] || 0) + k * n;
      spel.samenstellingen = [...new Set([...(spel.samenstellingen || []), ...(TYPE[id].samen ? [id] : [])])];
      spel.aankopen = spel.aankopen || []; for (const [c, k] of Object.entries(per)) spel.aankopen.push({ id: c, n: k * n, dag: spel.dag, jaar: spel.jaar });
      melding(`${n} × ${TYPE[id].naam} gekocht (${S.euroKort(kosten)}).`, 6000);
      if (dd.terug && terugNaarLijn) { const t2 = { ...terugNaarLijn, typeKeuze: id }; terugNaarLijn = null; openPaneel('nieuweLijn', t2); break; }
      openPaneel('vloot'); break;
    }
    case 'nl-bouwer': { const dd = paneelData; dd.typeKeuze = $('nl-type')?.value; dd.nrIn = $('nl-nr')?.value; dd.naamIn = $('nl-naam')?.value; dd.spitsIn = $('nl-spits')?.value; dd.dalIn = $('nl-dal')?.value; dd.avondIn = $('nl-avond')?.value;
      terugNaarLijn = dd; openPaneel('bouwer', { modus: dd.modus, delen: [{ id: '', n: 1 }], aantal: 1, terug: true }); break; }
    case 'nl-interieur': { const dd = paneelData, tid = $('nl-type')?.value; if (!tid) break;
      dd.typeKeuze = tid; dd.nrIn = $('nl-nr')?.value; dd.naamIn = $('nl-naam')?.value; dd.spitsIn = $('nl-spits')?.value; dd.dalIn = $('nl-dal')?.value; dd.avondIn = $('nl-avond')?.value;
      terugNaarLijn = dd; openPaneel('serie', { basis: basisId(tid), van: null, ink: JSON.parse(JSON.stringify(serieInrichting(tid))), n: 2, terug: true }); break; }
    case 'serie-terug': if (terugNaarLijn) { const t2 = terugNaarLijn; terugNaarLijn = null; openPaneel('nieuweLijn', t2); } break;
    case 'sv-zet': {
      const t = takVan(+d.ti), bv = baanvak(spel, net, t), naar = paneelData.kies ?? null, kosten = ombouwKostenStroom(bv.sys, naar, bv.lengte / 1000);
      if (!betaal(kosten, 'de ombouw van de bovenleiding')) break;
      spel.spanning = spel.spanning || {}; for (const x of bv.takken) spel.spanning[x.i] = naar || 0;
      for (const x of spel.lijnen) stroomBijwerken(x);
      melding(`Baanvak (${komma(bv.lengte / 1000)} km) omgebouwd naar ${naar ? SYSTEMEN[naar].naam : 'geen bovenleiding'}.`); paneelData.kies = undefined; ververs(); break;
    }
    case 'sleeploc': {
      const id = $(`sleep-${l.id}`)?.value; if (!id) break; const tekort = Math.max(0, l.nodig - (spel.voertuigen[id] || 0));
      if (tekort && !betaal(tekort * TYPE[id].prijs, `${tekort} × ${TYPE[id].naam}`)) break;
      spel.voertuigen[id] = (spel.voertuigen[id] || 0) + tekort; l.sleeploc = id; stroomBijwerken(l);
      melding(`Lijn ${l.nr} krijgt een ${TYPE[id].naam} als sleeploc over de stukken waar het eigen materieel niet kan${tekort ? ` (${tekort} gekocht)` : ''}.`, 8000); ververs(); break;
    }
    case 'stroom-toon': { const c = stroomCheck(spel, net, l); const ts = [...new Set(c.probleem.flatMap(p => p.takken))].map(takVan).filter(Boolean); if (!ts.length) break;
      kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: ts.map(t => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lijnGeo(t.pts) } })) });
      const bb = ts.reduce((b, t) => [Math.min(b[0], t.bbox[0]), Math.min(b[1], t.bbox[1]), Math.max(b[2], t.bbox[2]), Math.max(b[3], t.bbox[3])], [1e9, 1e9, -1e9, -1e9]);
      kaart.vliegNaar((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, Math.max(1.5, Math.max(bb[2] - bb[0], bb[3] - bb[1]) / Math.min(kaart.W, kaart.H) * 1.6)); melding('De stukken waar de trein niet kan rijden zijn gestippeld. Klik op het spoor voor de spanning en om om te bouwen.', 7000); break; }
    case 'stroom-aanleg': { const c = stroomCheck(spel, net, l), p = aanlegPlan(l, c); if (!p.takken.length || !betaal(p.kosten, 'de bovenleiding')) break;
      spel.spanning = spel.spanning || {}; for (const t of p.takken) spel.spanning[t.i] = p.sys;
      for (const x of spel.lijnen) stroomBijwerken(x); perronVoorstelWissen();
      melding(`Bovenleiding aangelegd: ${komma(p.km)} km ${SYSTEMEN[p.sys].naam} (${S.euroKort(p.kosten)}).`, 7000); ververs(); break; }
    case 'sleeploc-weg': l.sleeploc = null; stroomBijwerken(l); ververs(); break;
    case 'kruising-bouw': { const g = paneelData, kosten = d.s === 'flyover' ? 60e6 : 90e6; if (!betaal(kosten, d.s === 'flyover' ? 'de flyover' : 'de dive-under')) break;
      spel.kruisingen = spel.kruisingen || []; spel.kruisingen.push({ x: g.x, y: g.y, soort: d.s, ...bouwKlaar(), kosten, projectNaam: d.s === 'flyover' ? 'Flyover' : 'Dive-under' });
      melding(`Bouw van de ${d.s === 'flyover' ? 'flyover' : 'dive-under'} gestart, klaar over 2 speluren.`); sluitPaneel(); eigenNetBijwerken(); hud(); break; }
    case 'bus-kies': openPaneel('busstation', { station: d.naam, x: +d.x, y: +d.y, n: 4, opstelling: 'naast' }); break;
    case 'bus-plaats': { const g = paneelData; tool = 'busstation'; bouw = { bus: g }; perronVoorstelWissen(); kaart.vliegNaar(g.x, g.y, 0.8);
      hint(`Klik waar het busstation van ${g.station} moet komen.`, [['Stoppen', () => { zetTool('kijk'); openPaneel('busstation', g); }]]); break; }
    case 'bus-draai': { const g = paneelData; if (!g.plek) break; g.plek.hoek += (+d.g) * Math.PI / 180; busVoorstel(g); break; }
    case 'bus-bouw': {
      const g = paneelData, o = busstationOntwerp(g.n, g.opstelling, g.plek.x, g.plek.y, g.plek.hoek), kosten = busKosten(g);
      if (!betaal(kosten, 'het busstation')) break;
      const tijd = bouwKlaar(), project = S.nieuwId('b'), al = spel.haltes.filter(h => h.naam.startsWith(`${g.station}, perron `)).length;
      o.haltes.forEach((p, i) => spel.haltes.push({ id: S.nieuwId('h'), naam: `${g.station}, perron ${String.fromCharCode(65 + al + i)}`, modus: 'bus', x: p.x, y: p.y, eigen: true, ...tijd, project, busstation: g.station }));
      spel.perronVormen = spel.perronVormen || [];
      for (const v of o.vlakken) spel.perronVormen.push({ station: g.station, pts: v, ...tijd, project, bus: true });
      const toegang = busToegang(g); if (toegang) spel.perronVormen.push({ station: g.station, pts: toegang, ...tijd, project, bus: true, weg: true });
      spel.busProjecten = spel.busProjecten || {}; spel.busProjecten[project] = `Busstation ${g.station}`;
      melding(`Bouw van busstation ${g.station} (${g.n} haltes) gestart, klaar over 2 speluren.`);
      perronVoorstelWissen(); sluitPaneel(); eigenNetBijwerken(); hud(); break;
    }
    case 'gebouw-kies': openPaneel('gebouw', { station: d.naam, x: +d.x, y: +d.y, stijl: stijlenVoor(spel.jaar)[spel.jaar < 1940 ? 0 : stijlenVoor(spel.jaar).length - 1]?.id, grootte: 'middel' }); break;
    case 'gebouw-plaats': { const g = paneelData; tool = 'gebouw'; bouw = { gebouw: g }; perronVoorstelWissen(); kaart.vliegNaar(g.x, g.y, 0.8);
      hint(`Klik waar het stationsgebouw van ${g.station} moet komen (aan de straatkant van het spoor).`, [['Stoppen', () => { zetTool('kijk'); openPaneel('gebouw', g); }]]); break; }
    case 'gebouw-draai': { const g = paneelData; if (!g.plek) break; g.plek.hoek = (g.plek.hoek || 0) + Math.PI / 2; gebouwVoorstel(g); break; }
    case 'gebouw-bouw': {
      const g = paneelData, st = STIJLEN.find(x => x.id === g.stijl) || stijlenVoor(spel.jaar)[0], gr = g.grootte, kosten = gebouwPrijs(st, gr);
      if (!g.plek || !betaal(kosten, 'het stationsgebouw')) break;
      spel.gebouwen = spel.gebouwen || [];
      const tijdG = bouwKlaar(), toegang = gebouwToegang(g);
      spel.gebouwen.push({ id: S.nieuwId('g'), station: g.station, stijl: st.id, grootte: gr, pts: gebouwVorm(g), x: g.plek.x, y: g.plek.y, ...tijdG, kosten, projectNaam: `Stationsgebouw ${g.station}` });
      if (toegang) { spel.perronVormen = spel.perronVormen || []; spel.perronVormen.push({ station: g.station, pts: toegang, ...tijdG, weg: true }); }
      for (const l of [...spel.lijnen, ...AI.lijnen]) l._vangst = null;
      melding(`Bouw van het stationsgebouw van ${g.station} gestart (${S.euroKort(kosten)}), klaar over 2 speluren.`);
      perronVoorstelWissen(); sluitPaneel(); eigenNetBijwerken(); hud(); break;
    }
    case 'lenen': { const b = Math.min(+d.b, leningMax() - (spel.lening || 0)); if (b <= 0) break; spel.lening = (spel.lening || 0) + b; spel.geld += b; melding(`${S.euroKort(b)} geleend. Rente ${komma(leningRente() * 100)}% per jaar.`); ververs(); hud(); break; }
    case 'aflossen': { const b = Math.min(+d.b, spel.lening || 0); if (b <= 0 || spel.geld - b < -20e6) { melding('Niet genoeg geld om af te lossen.'); break; } spel.lening -= b; spel.geld -= b; melding(`${S.euroKort(b)} afgelost.`); ververs(); hud(); break; }
    case 'serie-koop': case 'serie-verbouw': {
      const dd = paneelData, n = Math.max(1, Math.round(+$('sn-n')?.value || 1)), naam = $('sn-naam')?.value;
      if (a === 'serie-koop') {
        const id = serieVoor(dd.basis, dd.ink, naam), t = TYPE[id];
        if (!betaal(t.prijs * n, `${n} × ${t.naam}`)) break;
        spel.voertuigen[id] = (spel.voertuigen[id] || 0) + n;
        melding(`${n} × ${t.naam} gekocht voor ${S.euroKort(t.prijs * n)}.`);
        if (dd.terug && terugNaarLijn) { const t2 = { ...terugNaarLijn, typeKeuze: id }; terugNaarLijn = null; openPaneel('nieuweLijn', t2); break; }
        openPaneel('serie', { ...dd, van: id }); break;
      }
      const van = dd.van; if (!van) break;
      const max = spel.voertuigen[van] || 0, m = Math.min(n, max); if (!m) { melding('Je hebt geen voertuigen van deze serie om te verbouwen.'); break; }
      const id = serieVoor(dd.basis, dd.ink, naam); if (id === van) { melding('Het ontwerp is gelijk aan het huidige interieur.'); break; }
      const kosten = ombouwKosten(serieInrichting(van), dd.ink, dd.basis) * m;
      if (!betaal(kosten, 'de verbouwing')) break;
      spel.maand.overig += kosten;
      spel.voertuigen[van] -= m; spel.voertuigen[id] = (spel.voertuigen[id] || 0) + m;
      // lijnen die alleen deze serie gebruikten en nu niets meer hebben: overzetten op de nieuwe serie
      for (const l2 of spel.lijnen) if (l2.typeId === van && !spel.voertuigen[van]) { l2.typeId = id; S.herbereken(l2); }
      melding(`${m} × ${TYPE[van].naam} verbouwd tot ${TYPE[id].naam} (${S.euroKort(kosten)}).`);
      openPaneel('serie', { ...dd, van: id }); break;
    }
    case 'subsidie': {
      const bedrag = Math.max(0, Math.round(+$('sub-bedrag')?.value || 0));
      if (!bedrag) { melding('Vul een bedrag in.'); break; }
      nieuwVerzoek(spel, { aan: 'provincie', aanNaam: 'Provincie', soort: 'subsidie', lijnId: l.id, bedrag, tekst: `Extra subsidie gevraagd voor lijn ${l.nr}: ${S.euro(bedrag)} per maand om het verlies te dekken.` });
      melding('Aanvraag naar de provincie gestuurd.'); break;
    }
    case 'concessie': {
      const vz = nieuwVerzoek(spel, { aan: 'provincie', aanNaam: 'Provincie', soort: 'concessie', lijnId: l.id, tekst: `Concessie en subsidie gevraagd voor lijn ${l.nr}.` });
      melding('Aanvraag naar de provincie gestuurd. Antwoord binnen ongeveer 8 speldagen.'); void vz; openPaneel('verzoeken'); break;
    }
    case 'pad': l.actief = true; l.wacht = null; padOpnieuwNodig(l); ververs(); break;
    case 'aanbod-koppel': aanbodKoppelen(d.sub, lijnVan(d.lijn)); ververs(); break;
    case 'aanbod-los': { const a = (spel.aanbiedingen || []).find(x => x.id === d.sub); if (a) aanbodLos(a); ververs(); break; }
    case 'open-subsidies': openPaneel('subsidies'); break;
    case 'sub-alles': subFilter = { modus: [], prov: [] }; ververs(); break;
    case 'sub-meer': { const n = subsidiesZoeken(subsidieLijst().filter(a => a.status === 'open').length + 3); melding(n ? `${n} nieuwe aanbieding${n > 1 ? 'en' : ''} gevonden.` : 'Hier vond de provincie geen nieuwe verbindingen die het ondersteunen waard zijn.'); ververs(); break; }
    case 'aanbod-toon': { const a = (spel.aanbiedingen || []).find(x => x.id === d.sub); if (!a) break;
      kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [lonlat(a.a.x, a.a.y), lonlat(a.b.x, a.b.y)] } }] });
      kaart.vliegNaar((a.a.x + a.b.x) / 2, (a.a.y + a.b.y) / 2, Math.max(2, Math.hypot(a.a.x - a.b.x, a.a.y - a.b.y) / Math.min(kaart.W, kaart.H) * 1.6)); break; }
    case 'aanbod-bouw': { const a = (spel.aanbiedingen || []).find(x => x.id === d.sub); if (!a) break; sluitPaneel(); zetTool('lijn');
      bouw = { modus: a.modus, punten: a.modus === 'trein' ? [{ ...a.a }, { ...a.b }] : [] , aanbod: a.id };
      if (a.modus === 'trein') lijnKlaar();
      else { kaart.vliegNaar(a.a.x, a.a.y, 4); hint(`Subsidielijn ${a.a.naam} – ${a.b.naam}: klik haltes aan, van ${a.a.naam} naar ${a.b.naam}.`, [['Klaar', lijnKlaar], ['Laatste weg', () => bouw.punten.pop()], ['Stoppen', () => zetTool('kijk')]]); }
      break; }
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
    case 'sel-lijn': { const sl = paneelData?.lijn; if (!sl) break; const sel = { lijn: sl };
      if (sl.ai) openPaneel('aiLijn', sl); else openPaneel('lijn', sl); selectie = sel; selectieKaart(); break; }
    case 'volg': { const om = paneelData?.omloop; volg = volg === om ? null : om; if (volg) zoomVolg = true; ververs(); break; }
    case 'toon-voertuig': { const e = voertuigLijst[+d.i]; if (!e) break; openRit(e); kaart.vliegNaar(e.x, e.y, Math.min(kaart.res, 4)); break; }
    case 'rit-wacht': { const sel = $('rv-soort'); if (sel) { sel.value = 'wacht'; $('rv-halte').value = d.i; $('rv-min').value = 2; $('rv-min').focus(); } break; }
    case 'rit-verzoek': {
      const v = paneelData, a = v?.lijn; if (!a?.ai) break;
      const soort = $('rv-soort').value, i = +$('rv-halte').value, min = Math.max(-15, Math.min(15, Math.round(+$('rv-min').value || 0))), geld = Math.max(0, +$('rv-geld').value || 0);
      if (!min || (soort === 'wacht' && min < 0)) { melding('Kies een aantal minuten (bij wachten: meer dan 0).'); break; }
      const h = a.haltes[i];
      if (!h) { melding('Kies een halte.'); break; }
      nieuwVerzoek(spel, { aan: a.vervoerder, aanNaam: a.vervoerderNaam, soort: 'aanpassing', wijze: soort, aiSleutel: a.sleutel, halteIdx: i, halte: { naam: h.naam, x: h.x, y: h.y }, minuten: min, vergoeding: geld,
        tekst: `Verzoek aan ${a.vervoerderNaam}: lijn ${a.nr} ${soort === 'wacht' ? `${min} min langer laten wachten bij ${h.naam}` : (min > 0 ? `${min} min later` : `${-min} min eerder`) + ' laten rijden'}${geld ? `, tegen ${S.euro(geld)} per jaar` : ''}.` });
      melding(`Verzoek gestuurd naar ${a.vervoerderNaam}. Antwoord volgt binnen een paar dagen.`); openPaneel('verzoeken'); break;
    }
    case 'vz-ja': case 'vz-nee': case 'vz-tegen': case 'vz-tegen-ja': case 'vz-tegen-nee': case 'vz-opnieuw': reageerOpVerzoek(a, spel.verzoeken.find(v => v.id === d.id)); break;
    case 'ploeg-erbij': spel.controle.ploegen.push({ mensen: 4, van: 7 * 60, tot: 19 * 60, lijnen: spel.lijnen.map(x => x.id) }); ververs(); break;
    case 'ploeg-weg': spel.controle.ploegen.splice(+d.i, 1); ververs(); break;
    case 'bewaar': bewaar(true); break;
    case 'nieuw': toonStart(); break;
    case 'perron-ontwerp': perronOntwerpen(d.naam, +d.x, +d.y); break;
    case 'perron-kant': if (perronOntwerp?.verdubbel) verdubbelOntwerpen(perronOntwerp.x, perronOntwerp.y, -perronOntwerp.kant); else if (perronOntwerp) perronOntwerpen(perronOntwerp.naam, perronOntwerp.x, perronOntwerp.y, -perronOntwerp.kant); break;
    case 'perron-eind': if (perronOntwerp) perronOntwerpen(perronOntwerp.naam, perronOntwerp.x, perronOntwerp.y, perronOntwerp.kant, perronOntwerp.vorm, -perronOntwerp.eind); break;
    case 'spoed': {
      const p = bouwProjecten()[+d.i]; if (!p || p.spoed) break;
      const kosten = Math.round((p.kosten || 2e6) * 0.4 / 1e5) * 1e5;
      if (!betaal(kosten, 'versneld bouwen')) break;
      const nieuw = Math.round(nuMin() + Math.max(1, (p.gereed - nuMin()) / 2));
      for (const x of p.delen) { x.gereedMin = nieuw; x.spoed = true; }
      melding(`${p.naam}: versneld bouwen, klaar om ${S.klok((nieuw + 300) % 1440)} (${S.euroKort(kosten)}).`); ververs(); hud(); break;
    }
    case 'perron-stop': perronVoorstelWissen(); sluitPaneel(); break;
    case 'ns-kant': paneelData.kant = -(paneelData.kant || 1); ververs(); break;
    case 'perron-bouw': {
      const o = perronOntwerp; if (!o) break;
      const kosten = perronKosten(o);
      if (!betaal(kosten, o.verdubbel ? 'de verdubbeling' : 'het perronspoor')) break;
      const tijd = bouwKlaar(), project = S.nieuwId('b');
      const naam = o.verdubbel ? `${(o.bestaand || 1) >= 2 ? `${(o.bestaand || 1) + 1}e spoor` : 'Verdubbeling'} ${o.naam !== 'spoor' ? o.naam : ''} (${komma(o.lengte / 1000)} km)`.replace('  ', ' ') : `${{ zij: 'Spoor met perron', eiland: 'Eilandperron met 2 sporen', langs: 'Spoor langs perron', kop: 'Kopspoor met perron', kopLangs: 'Kopspoor langs perron', kop2: '2 kopsporen met eilandperron', opstel: 'Opstelspoor', opstel2: '2 opstelsporen' }[o.vorm]} · ${o.naam}`;
      o.sporen.forEach((pts, k) => spel.spoor.push({ punten: pts, sporen: 1, eigenaar: 'speler', ...tijd, klaar: false, perron: o.verdubbel ? undefined : o.naam,
        verdubbelt: o.verdubbel && !k ? o.tak : undefined, nieuwSporen: o.verdubbel ? (o.bestaand || 1) + 1 : undefined, dienst: o.vorm?.startsWith('opstel') ? 1 : 0, project, projectNaam: naam, kosten: k ? 0 : kosten }));
      spel.perronVormen = spel.perronVormen || [];
      for (const v of o.vlakken) { spel.perronVormen.push({ station: o.naam, pts: v, ...tijd, project }); D.perrons.voeg({ vlak: true, pts: v, eigen: true }); }
      if (!o.verdubbel && !o.vorm?.startsWith('opstel')) { spel.perrons = spel.perrons || {}; spel.perrons[o.naam] = (spel.perrons[o.naam] || 0) + o.sporen.length; }
      melding(`${naam}: bouw gestart, klaar over 2 speluren (om ${S.klok((tijd.gereedMin + 300) % 1440)}). Voortgang bij ▤ Bouw.`);
      perronVoorstelWissen(); eigenNetBijwerken(); sluitPaneel(); hud();
      break;
    }
    case 'station-zelf': case 'station-prorail': {
      const p = paneelData; const naam = $('ns-naam').value.trim() || p.naam;
      if (a === 'station-zelf') {
        const o = stationOntwerp(p), kosten = o ? stationKosten(o, p) : 6e6;
        if (!betaal(kosten, p.soort === 'halte' ? 'een halte' : 'een station')) break;
        const tijd = bouwKlaar(), project = S.nieuwId('b');
        spel.haltes.push({ id: S.nieuwId('h'), naam, modus: p.modus || 'trein', x: p.x, y: p.y, eigen: true, ...tijd, kosten, project, doorsnede: o?.doorsnede, soort: p.soort || 'station' });
        if (p.combi) spel.haltes.push({ id: S.nieuwId('h'), naam, modus: p.modus === 'metro' ? 'trein' : 'metro', x: p.x, y: p.y, eigen: true, ...tijd, project, soort: p.soort || 'station' });
        if (o) {
          o.sporen.forEach(pts => spel.spoor.push({ punten: pts, sporen: 1, eigenaar: 'speler', ...tijd, klaar: false, perron: naam, project, projectNaam: `Station ${naam}` }));
          spel.perronVormen = spel.perronVormen || [];
          for (const v of o.vlakken) { spel.perronVormen.push({ station: naam, pts: v, ...tijd, project }); D.perrons.voeg({ vlak: true, pts: v, eigen: true }); }
        }
        perronVoorstelWissen();
        melding(`Bouw van station ${naam} gestart. Klaar over 2 speluren.`); eigenNetBijwerken(); sluitPaneel();
      } else {
        nieuwVerzoek(spel, { aan: 'prorail', aanNaam: 'ProRail', soort: 'station', x: p.x, y: p.y, naam, tekst: `Verzoek aan ProRail om station ${naam} te bouwen.` });
        melding('Verzoek naar ProRail gestuurd.'); openPaneel('verzoeken');
      }
      zetTool('kijk'); break;
    }
    case 'spoor-auto': { const p = paneelData; p.ankers = autoTrace(p.ankers[0], p.ankers.at(-1)); p.handvat = []; spoorVoorstel(p); ververs(); break; }
    case 'spoor-recht': { const p = paneelData; p.handvat = []; spoorVoorstel(p); ververs(); break; }
    case 'spoor-stop': handvattenWeg(); perronVoorstelWissen(); sluitPaneel(); bouw = null; zetTool('kijk'); break;
    case 'spoor-zelf': case 'spoor-prorail': {
      const p = paneelData, st = p._st || spoorStukken(p), S2 = SPOORSOORT[p.soort], km = st.nieuwM / 1000;
      if (a === 'spoor-zelf') {
        const kosten = spoorKosten(p, st);
        if (!betaal(kosten, 'het ' + S2.naam)) break;
        const tijd = bouwKlaar(), project = S.nieuwId('b'), naam = `${S2.naam[0].toUpperCase() + S2.naam.slice(1)} (${komma(km)} km${p.sporen > 1 && p.soort !== 'trolley' ? `, ${p.sporen} sporen` : ''})`;
        st.nieuw.forEach((pts, k) => {
          if (p.soort === 'trolley') { spel.bovenleiding = spel.bovenleiding || []; spel.bovenleiding.push({ punten: pts, ...tijd, project, kosten: k ? 0 : kosten, projectNaam: naam }); }
          else spel.spoor.push({ punten: pts, sporen: Math.min(2, p.sporen), soort: S2.code, eigenaar: 'speler', ...tijd, klaar: false, project, projectNaam: naam, kosten: k ? 0 : kosten, extraSporen: Math.max(0, p.sporen - 2) });
        });
        melding(`Aanleg gestart (${S.euroKort(kosten)}), klaar over 2 speluren.`); handvattenWeg(); perronVoorstelWissen(); eigenNetBijwerken(); sluitPaneel();
      } else {
        for (const pts of st.nieuw) nieuwVerzoek(spel, { aan: 'prorail', aanNaam: 'ProRail', soort: 'spoor', punten: pts, sporen: Math.min(2, p.sporen), tekst: `Verzoek aan ProRail om ${komma(km)} km ${p.sporen >= 2 ? 'dubbel' : 'enkel'}spoor aan te leggen.` });
        handvattenWeg(); perronVoorstelWissen(); melding('Verzoek naar ProRail gestuurd.'); openPaneel('verzoeken');
      }
      bouw = null; zetTool('kijk'); break;
    }
    case 'lijn-maak': maakNieuweLijn(); break;
    case 'bijzonder-maak': {
      const dd = paneelData, typeId = $('nb-type').value;
      if (!typeId) { melding('Koop eerst materieel (Vloot), bijvoorbeeld museummaterieel.'); break; }
      const [hh, mm] = $('nb-tijd').value.split(':').map(Number);
      const nl = maakBijzonder({ nr: '★', naam: `${dd.haltes[0].naam.split(',')[0]} – ${dd.haltes[dd.haltes.length - 1].naam.split(',')[0]}`, modus: dd.modus, typeId, haltes: dd.haltes, route: dd.route,
        dag: spel.dag + Math.max(3, Math.min(90, +$('nb-dagen').value || 14)), vertrek: hh * 60 + mm, prijs: Math.max(0, +$('nb-prijs').value || 0) });
      melding(`Bijzondere rit uitgeschreven voor ${S.datumTekst(nl.bijzonder.dag)}. Verwachting: ${Math.min(S.capaciteit(nl), belangstelling(spel, { ...nl.bijzonder, haltes: nl.haltes, typeId, modus: nl.modus, lengteKm: nl.lengteKm }, D.plaatsen))} inschrijvingen.`, 7000);
      bouw = null; zetTool('kijk'); openPaneel('lijnen'); break;
    }
    case 'koop-museum': { const t = TYPE[d.type]; if (!betaal(museumPrijs(t), t.naam)) break; spel.voertuigen[d.type] = (spel.voertuigen[d.type] || 0) + 1; melding(`${t.naam} gekocht en gerestaureerd (${S.euroKort(museumPrijs(t))}).`); ververs(); break; }
    case 'lijn-annuleer': bouw = null; sluitPaneel(); zetTool('kijk'); break;
  }
}
function wijzig(w, i) {
  const l = i.dataset.id ? lijnVan(i.dataset.id) : null;
  const tijd = v => { const [h, m] = v.split(':').map(Number); let t = h * 60 + m; if (t < 4 * 60) t += 1440; return t; };
  switch (w) {
    case 'spitsdubbel': l.spitsDubbel = i.checked; S.herbereken(l); break;
    case 'sub-modus': case 'sub-prov': { const lijst = w === 'sub-modus' ? subFilter.modus : subFilter.prov, v = w === 'sub-modus' ? i.value : +i.value;
      const k = lijst.indexOf(v); if (i.checked && k < 0) lijst.push(v); else if (!i.checked && k >= 0) lijst.splice(k, 1);
      if (lijst.length) subsidiesZoeken(3); ververs(); return; }
    case 'sub-land': ververs(); return;
    case 'nl-overal': paneelData.stopOveral = i.checked; i.blur(); ververs(); return;
    case 'nl-richting': paneelData.richting = i.value; ververs(); return;
    case 'nl-type': paneelData.typeKeuze = i.value; paneelData.spitsIn = $('nl-spits')?.value; paneelData.dalIn = $('nl-dal')?.value; paneelData.avondIn = $('nl-avond')?.value; paneelData.nrIn = $('nl-nr')?.value; paneelData.naamIn = $('nl-naam')?.value; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'ns-naam': paneelData.naam = i.value; return;
    case 'bw-type': { const dd = paneelData; dd.delen[+i.dataset.i].id = i.value; i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'bw-n': paneelData.delen[+i.dataset.i].n = Math.max(1, Math.min(20, Math.round(+i.value || 1))); i.blur(); setTimeout(() => ververs(), 0); return;
    case 'bw-aantal': paneelData.aantal = Math.max(1, Math.round(+i.value || 1)); return;
    case 'sv-kies': paneelData.kies = i.value || null; ververs(); return;
    case 'spoor-hergebruik': paneelData.hergebruik = i.checked; spoorVoorstel(paneelData); i.blur(); setTimeout(() => ververs(), 0); return;
    case 'spoor-n': paneelData.sporen = +i.value; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'bs-n': paneelData.n = Math.max(1, Math.min(16, Math.round(+i.value || 1))); if (paneelData.plek) busVoorstel(paneelData); i.blur(); setTimeout(() => ververs(), 0); return;
    case 'bs-op': paneelData.opstelling = i.value; if (paneelData.plek) busVoorstel(paneelData); ververs(); return;
    case 'gb-stijl': paneelData.stijl = i.value; if (paneelData.plek) gebouwVoorstel(paneelData); ververs(); return;
    case 'gb-grootte': paneelData.grootte = i.value; if (paneelData.plek) gebouwVoorstel(paneelData); i.blur(); setTimeout(() => ververs(), 0); return;
    case 'ns-soort': paneelData.soort = i.value; ververs(); return;
    case 'ns-combi': paneelData.combi = i.checked; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'ns-sporen': paneelData.sporen = +i.value; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'ns-doorgaand': paneelData.doorgaand = i.checked; if (i.checked && (paneelData.sporen || 0) <= (stationOntwerp({ ...paneelData, doorgaand: false })?.bestaand || 1)) paneelData.sporen = (stationOntwerp({ ...paneelData, doorgaand: false })?.bestaand || 1) + 2; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'perron-vorm': if (perronOntwerp) perronOntwerpen(perronOntwerp.naam, perronOntwerp.x, perronOntwerp.y, perronOntwerp.kant, i.value, perronOntwerp.eind); return;
    case 'lijn-richting': l.richting = i.value; l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); ververs(); return;
    case 'nl-bijzonder': paneelData.bijzonder = i.checked; i.blur(); ververs(); return;
    case 'lijn-type': l.typeId = i.value; S.herbereken(l); stroomBijwerken(l); break;
    case 'lijn-alt': l.altTypeId = i.value || null; break;
    case 'lcatering': l.catering = { ...(l.catering || {}), [i.dataset.k]: +i.value }; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'lrest': {
      const v = i.dataset.veld, n = l.haltes.length - 1;
      if (v === 'soort') l.restauratie = i.value === 'dicht' ? 'dicht' : i.value === 'deel' ? [0, Math.max(1, Math.round(n / 2))] : undefined;
      else if (Array.isArray(l.restauratie)) { const r = [...l.restauratie]; r[v === 'van' ? 0 : 1] = +i.value; if (r[0] >= r[1]) { if (v === 'van') r[1] = Math.min(n, r[0] + 1); else r[0] = Math.max(0, r[1] - 1); } l.restauratie = r; }
      i.blur(); setTimeout(() => ververs(), 0); return;
    }
    case 'sw': {
      const w = paneelData.ink.wagons[+i.dataset.w], dl = w.delen[+i.dataset.d], v = i.dataset.veld;
      if (v === 'len') { const x = Math.max(0.1, Math.min(0.9, (+i.value || 0) / 100)); const andere = w.delen.filter(o => o !== dl), som = andere.reduce((a, o) => a + o.len, 0) || 1; andere.forEach(o => o.len = Math.round(o.len / som * (1 - x) * 100) / 100); dl.len = x; }
      else if (v === 'breed') dl.breed = +i.value;
      else if (v === 'soort') { if (i.value === 'rest') { for (const k of ['klasse', 'stoel', 'breed', 'been']) delete dl[k]; dl.soort = 'rest'; } else Object.assign(dl, { soort: 'zit', klasse: '2', stoel: 'bekleed', breed: 4, been: 'normaal' }); }
      else dl[v] = i.value;
      paneelData.naam = null; i.blur(); setTimeout(() => ververs(), 0); return;
    }
    case 'sv': { const vz = new Set(paneelData.ink.voorz || []); i.checked ? vz.add(i.dataset.v) : vz.delete(i.dataset.v); paneelData.ink.voorz = [...vz]; paneelData.naam = null; i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'beleid-op': spel.beleid = { ...(spel.beleid || {}), opwaarderen: i.checked }; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'beleid-korting': spel.beleid = { ...(spel.beleid || {}), korting: Math.max(0, Math.min(0.5, (+i.value || 0) / 100)) }; return;
    case 'kprijs': spel.klassePrijs = { ...(spel.klassePrijs || {}), [i.dataset.k]: Math.max(0.1, Math.min(6, (+i.value || 0) / 100)) }; zetKlassePrijzen(spel.klassePrijs); for (const l2 of spel.lijnen) l2._eff = null; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'sn-van': paneelData.van = i.value || null; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'aankomst': {
      const [rr, ii] = i.dataset.k.split(':').map(Number);
      const gewenst = (tijd(i.value) - +i.dataset.dep) * 60, vroegst = l.trMin?.[rr]?.[ii] ?? 0;
      l._vorigeTr = l.tr.map(x => [...x]);
      l.aankomstWens = l.aankomstWens || {};
      if (gewenst <= vroegst + 20) { delete l.aankomstWens[i.dataset.k]; if (gewenst < vroegst - 30) melding('Sneller kan niet: het voertuig rijdt dan al op de maximale snelheid van baanvak en materieel.'); }
      else { if (gewenst > vroegst + 30 * 60) melding('Hooguit 30 minuten rustiger rijden per stuk.'); l.aankomstWens[i.dataset.k] = Math.round(gewenst); }
      l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); i.blur(); setTimeout(() => ververs(), 0); break;
    }
    case 'halte-wacht': {
      l._vorigeTr = l.tr.map(x => [...x]); l.halteWacht = l.halteWacht || {}; const m = Math.max(0, Math.min(15, Math.round(+i.value || 0))); if (m) l.halteWacht[i.dataset.k] = m; else delete l.halteWacht[i.dataset.k]; l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); setTimeout(() => ververs(), 0); break; }
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
    case 'achtergrond': spel.achtergrond = i.value; kaart.zetAchtergrond(i.value); jaarBijwerken(); $('bron').textContent = ACHTERGROND_KEUZE[i.value]?.bron || ''; break;
  }
  i.blur(); ververs(); eigenNetBijwerken();
}
function padOpnieuwNodig(l) {
  if (l.modus !== 'trein' || l.eigenSpoor) return;
  const gevraagd = Math.ceil(60 / Math.min(...Object.values(l.interval)));
  if (gevraagd > (l.paden || 0)) { l.paden = gevraagd; melding(`ProRail kent ${gevraagd} trein(en) per uur per richting toe. Je betaalt spoorhuur per treinkilometer.`); }
}
function padAanvragen(l) {
  nieuwVerzoek(spel, { aan: 'prorail', aanNaam: 'ProRail', soort: 'pad', lijnId: l.id, tekst: `Capaciteitsaanvraag voor lijn ${l.nr}: ${Math.ceil(60 / Math.min(...Object.values(l.interval)))} trein(en) per uur per richting.` });
}

// extra wachttijd bij halte i van een lijn van een andere vervoerder
function aiWachtToepassen(a, i, min) {
  a.dw = a.dw || {}; a.dw[i] = (a.dw[i] || 0) + min;
  a.t = a.t.map((x, j) => j > i ? x + min * 60 : x);
  a.duur = Math.max(60, a.t[a.t.length - 1]);
}
function behandelAntwoord(vz) {
  const c = ctx();
  let r;
  if (vz.status === 'tegen-van-speler') r = beoordeelTegenOpAI(spel, vz);
  else if (vz.soort === 'verschuif') r = beoordeelVerschuiving(spel, vz, c);
  else if (vz.soort === 'aanpassing') r = beoordeelAanpassing(spel, vz, c);
  else if (vz.soort === 'pad') r = beoordeelPad(spel, vz, c);
  else if (vz.soort === 'spoor' || vz.soort === 'station') r = beoordeelBouw(spel, vz, c);
  else if (vz.soort === 'concessie') r = beoordeelConcessie(spel, vz, c);
  else if (vz.soort === 'subsidie') r = beoordeelSubsidie(spel, vz, c);
  else r = { status: 'afgewezen', reden: 'Onbekend verzoek.' };
  vz.status = r.status; vz.reden = r.reden; vz.tegen = r.tegen; vz.gezien = false;
  if (r.status === 'geaccepteerd') voerUit(vz, vz.tegen || vz);
  melding(`Antwoord van ${vz.aan === 'speler' ? vz.vanNaam : (vz.aanNaam || vz.aan)}: ${r.status === 'geaccepteerd' ? 'akkoord' : r.status}${r.status !== 'geaccepteerd' && r.reden ? ' — ' + r.reden : ''}.`, r.status === 'afgewezen' ? 10000 : undefined);
  if (paneelSoort === 'verzoeken') ververs();
}
function voerUit(vz, waarde) {
  if (vz.soort === 'aanpassing') {
    const a = AI.lijnen.find(x => x.sleutel === vz.aiSleutel); if (!a) return;
    if (vz.wijze === 'wacht') {
      spel.aiWacht = spel.aiWacht || {};
      const sl = a.sleutel; spel.aiWacht[sl] = spel.aiWacht[sl] || {};
      spel.aiWacht[sl][vz.halteIdx] = (spel.aiWacht[sl][vz.halteIdx] || 0) + waarde.minuten;
      aiWachtToepassen(a, vz.halteIdx, waarde.minuten);
    } else {
      const sl = `${a.vervoerder}:${a.lijnId}`;
      spel.aiVerschuiving = spel.aiVerschuiving || {};
      spel.aiVerschuiving[sl] = (spel.aiVerschuiving[sl] || 0) + waarde.minuten;
      for (const x of AI.lijnen) if (x.vervoerder === a.vervoerder && x.lijnId === a.lijnId) x.vertrek[0] = x.vertrek[0].map(v => v + waarde.minuten);
    }
    if (waarde.vergoeding) { spel.afspraken = spel.afspraken || []; spel.afspraken.push({ met: a.vervoerderNaam, bedrag: -waarde.vergoeding, omschrijving: vz.tekst }); }
    return;
  }
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
  if (vz.soort === 'spoor') spel.spoor.push({ punten: vz.punten, sporen: vz.sporen, eigenaar: 'prorail', ...bouwKlaar(), klaar: false, projectNaam: 'Spoor door ProRail' });
  if (vz.soort === 'station') spel.haltes.push({ id: S.nieuwId('h'), naam: vz.naam, modus: 'trein', x: vz.x, y: vz.y, eigen: false, ...bouwKlaar() });
  if (vz.soort === 'subsidie') {
    const l = lijnVan(vz.lijnId); if (!l) return;
    if (waarde.perReiziger) { l.subsidiePerReiziger = (l.subsidiePerReiziger || 0) + waarde.perReiziger; melding(`Extra subsidie voor lijn ${l.nr}: € ${waarde.perReiziger.toFixed(2).replace('.', ',')} per reiziger.`); }
    else if (waarde.bedrag) { const vuMaand = (l.stat?.vu || 1) / ((spel.dag % 30) + 1) * 30; l.subsidieUurExtra = (l.subsidieUurExtra || 0) + waarde.bedrag / Math.max(1, vuMaand); melding(`Extra subsidie voor lijn ${l.nr}: ${S.euro(waarde.bedrag)} per maand.`); }
  }
  if (vz.soort === 'concessie') {
    const l = lijnVan(vz.lijnId); if (!l) return;
    if (waarde.modus === 'belbus') { l.modus = 'belbus'; l.typeId = 'taxibus'; S.herbereken(l); }
    l.concessie = true;
  }
  eigenNetBijwerken();
}
// charter: akkoord = rit inplannen met passend materieel; tegenbod: de groep beslist meteen
function charterAntwoord(a, vz, val) {
  const plan = bod => {
    const typen = Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && TYPE[id]?.modus === 'trein');
    const typeId = (vz.historisch ? typen.find(id => isMuseum(TYPE[id], spel.jaar)) : null) || (!vz.historisch ? typen.sort((x, y) => spel.voertuigen[y] - spel.voertuigen[x])[0] : null);
    if (!typeId) { melding(vz.historisch ? 'Je hebt geen museummaterieel. Koop een historische trein bij Vloot.' : 'Je hebt geen treinen in bezit.'); return false; }
    const r = net.route([vz.van_.x, vz.van_.y], [vz.naar.x, vz.naar.y], 'trein', spel.jaar);
    if (!r) { melding('Er is geen spoorverbinding tussen deze stations.'); return false; }
    maakBijzonder({ nr: '★', naam: `${vz.vanNaam}: ${vz.van_.naam} – ${vz.naar.naam}`, modus: 'trein', typeId, haltes: [vz.van_, vz.naar], route: r, dag: vz.ritDag, vertrek: vz.vertrek, prijs: 0, charter: true, bod, personen: vz.personen, wie: vz.vanNaam });
    return true;
  };
  if (a === 'vz-ja') { if (plan(vz.bod)) { vz.status = 'geaccepteerd'; vz.reden = `Ingepland voor ${S.datumTekst(vz.ritDag)}.`; melding('Rit ingepland.'); } }
  else if (a === 'vz-nee') { vz.status = 'afgewezen'; vz.reden = 'Je hebt bedankt.'; }
  else if (a === 'vz-tegen') {
    const tegen = val(`tv-geld-${vz.id}`);
    if (tegen <= vz.bod * (1.05 + Math.random() * 0.3)) { if (plan(tegen)) { vz.status = 'geaccepteerd'; vz.reden = `${vz.vanNaam} gaat akkoord met € ${tegen.toLocaleString('nl-NL')}. Ingepland voor ${S.datumTekst(vz.ritDag)}.`; } }
    else { vz.status = 'afgewezen'; vz.reden = `${vz.vanNaam} vindt € ${tegen.toLocaleString('nl-NL')} te duur en zoekt een andere vervoerder.`; }
  }
  vz.gezien = false; ververs();
}
function reageerOpVerzoek(a, vz) {
  if (!vz) return;
  const val = id => +($(id)?.value || 0);
  if (vz.soort === 'charter') return charterAntwoord(a, vz, val);
  if (a === 'vz-ja') { vz.status = 'geaccepteerd'; vz.reden = 'Je hebt ingestemd.'; voerUit(vz, vz); spel.goodwill[vz.van] = (spel.goodwill[vz.van] || 0) + 5; melding('Akkoord gegeven; je lijn is verschoven.'); }
  if (a === 'vz-nee') { vz.status = 'afgewezen'; vz.reden = 'Je hebt het verzoek afgewezen.'; spel.goodwill[vz.van] = (spel.goodwill[vz.van] || 0) - 3; }
  if (a === 'vz-tegen') { vz.tegen = { minuten: val(`tv-min-${vz.id}`), vergoeding: val(`tv-geld-${vz.id}`) }; vz.status = 'tegen-van-speler'; vz.antwoordDag = spel.dag + spel.tijd / 1440 + 1; vz.reden = `Jouw tegenvoorstel: ${vz.tegen.minuten > 0 ? '+' : ''}${vz.tegen.minuten} min${vz.tegen.vergoeding ? `, ${S.euro(vz.tegen.vergoeding)} per jaar` : ''}.`; }
  if (a === 'vz-tegen-ja') { vz.status = 'geaccepteerd'; voerUit(vz, vz.tegen); vz.reden = (vz.reden || '') + ' — Je nam het tegenvoorstel aan.'; }
  if (a === 'vz-tegen-nee') { vz.status = 'afgewezen'; vz.reden = (vz.reden || '') + ' — Je liet het zitten.'; }
  if (a === 'vz-opnieuw') { vz.minuten = val(`tv-min-${vz.id}`); vz.vergoeding = val(`tv-geld-${vz.id}`); vz.status = 'open'; vz.antwoordDag = spel.dag + spel.tijd / 1440 + 1.5; vz.reden = ''; vz.tekst += ` Nieuw bod: ${vz.minuten > 0 ? '+' : ''}${vz.minuten} min, ${S.euro(vz.vergoeding)} per jaar.`; }
  ververs(); hud();
}

// ---------------------------------------------------------------- gereedschap
// onder de muis laten zien waar een nieuwe bushalte komt (op de weg gesnapt)
let snapTijd = 0;
function snapTonen(px, py) {
  if (!spel || !kaart?.map) return;
  const bus = (tool === 'halte' && BUSMODI.includes(halteSoort)) || (tool === 'lijn' && BUSMODI.includes(bouw?.modus));
  if (!bus) { if (kaart.map.getSource('snap-punt') && snapTijd) { snapTijd = 0; kaart.bron('snap-punt', { type: 'FeatureCollection', features: [] }); } return; }
  const nu = performance.now(); if (nu - snapTijd < 60) return; snapTijd = nu;
  const p = halteOpWeg(kaart.wx(px), kaart.wy(py), Math.max(40, 12 * (kaart.res || 1)));
  kaart.bron('snap-punt', { type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lonlat(p.x, p.y) } }] : [] });
  kaart.laag({ id: 'snap-punt', type: 'circle', source: 'snap-punt', paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': spel.kleur || '#c2412d', 'circle-stroke-width': 3, 'circle-opacity': 0.9 } });
}
function zetTool(t) {
  tool = t; bouw = null; snapTonen(0, 0);
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('aan', b.dataset.tool === t));
  if (t === 'kijk') hint(null);
  if (t === 'lijn') kiesModus();
  if (t === 'halte') hint('Wat voor halte?', [['Bushalte', () => halteModus('bus')], ['Tramhalte', () => halteModus('tram')], ['Steiger (veer)', () => halteModus('veer')], ['Watertaxi', () => halteModus('watertaxi')], ['Stoppen', () => zetTool('kijk')]]);
  if (t === 'station') hint('Klik op het spoor waar het station moet komen.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'perron') hint('Klik bij een treinstation: er komt een voorstel voor een extra spoor met perron.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'spoor') hint('Wat wil je aanleggen?', [['Treinspoor', () => spoorBegin('trein')], ['Metrospoor', () => spoorBegin('metro')], ['Tramspoor', () => spoorBegin('tram')], ['Trolleybus-bovenleiding', () => spoorBegin('trolley')],
    ['Spoor erbij (2e, 3e, 4e spoor)', () => zetTool('verdubbel')], ['Opstelspoor bij station', () => zetTool('perron')], ['Kruising ongelijkvloers maken', () => zetTool('kruising')], ['Stoppen', () => zetTool('kijk')]]);
  if (t === 'kruising') hint('Klik op een gelijkvloerse kruising of splitsing van sporen: die wordt een flyover (over het andere spoor heen) of een dive-under (eronderdoor).', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'verdubbel') hint('Klik op het spoor waar een extra spoor naast moet komen (van wissel tot wissel): van enkel- naar dubbelspoor, of een 3e of 4e spoor.', [['Stoppen', () => zetTool('kijk')]]);
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
  if (BUSMODI.includes(modus)) { const p = halteOpWeg(x, y, Math.max(40, 12 * (kaart.res || 1))); if (p) { x = p.x; y = p.y; } }
  else if (modus === 'tram' || modus === 'metro') { const k = net.dichtsteKnoop(x, y, modus, spel.jaar, 60); if (k) { x = Math.round(k.x); y = Math.round(k.y); } }
  const kosten = HALTEKOSTEN[modus] ?? 15000;
  if (!betaal(kosten, 'een halte')) return null;
  const h = { id: S.nieuwId('h'), naam: halteNaam(x, y, modus), modus, x, y, eigen: true, gereedDag: spel.dag };
  spel.haltes.push(h);
  if (!stil) melding(`${h.naam} geplaatst (${S.euro(kosten)}).`);
  eigenNetBijwerken();
  return h;
}

// ---------------------------------------------------------------- snappen naar wegen
// Dichtstbijzijnde punt op een weg waar een bus kan komen (kaarttegels en eigen wegendata), binnen max meter.
// Geeft {x, y, ux, uy, d} (RD, eenheidsrichting van de weg) of null.
const GEEN_BUSWEG = new Set(['path', 'track', 'rail', 'transit', 'ferry', 'motorway', 'raceway', 'bridleway', 'pier', 'aerialway']);
function wegBij(x, y, max = 60) {
  const m = kaart?.map; if (!m?.querySourceFeatures) return null;
  const [lo, la] = lonlat(x, y), mx = 111320 * Math.cos(la * Math.PI / 180), my = 111320;
  let beste = null, bd = max;
  const lijn = c => { for (let k = 1; k < c.length; k++) {
    const ax = (c[k - 1][0] - lo) * mx, ay = (c[k - 1][1] - la) * my, dx = (c[k][0] - lo) * mx - ax, dy = (c[k][1] - la) * my - ay, l2 = dx * dx + dy * dy;
    if (l2 < 0.01) continue;
    const f = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)), px = ax + dx * f, py = ay + dy * f, d = Math.hypot(px, py);
    if (d < bd) { bd = d; const l = Math.sqrt(l2); beste = { lon: lo + px / mx, lat: la + py / my, ux: dx / l, uy: dy / l, d }; } } };
  const geo = g => g.type === 'LineString' ? lijn(g.coordinates) : g.type === 'MultiLineString' ? g.coordinates.forEach(lijn) : null;
  try { for (const f of m.querySourceFeatures('osm', { sourceLayer: 'transportation' }) || []) if (!GEEN_BUSWEG.has(f.properties?.class) && f.properties?.subclass !== 'pedestrian') geo(f.geometry); } catch { /* bron nog niet geladen */ }
  try { if (m.getSource('wegen')) for (const f of m.querySourceFeatures('wegen') || []) if (!'SFO'.includes(f.properties?.s)) geo(f.geometry); } catch { /* geen eigen wegen */ }
  if (!beste) return null;
  const [rx, ry] = wgsNaarRd(beste.lat, beste.lon);
  // richting in RD (noord blijft noord binnen een paar graden; goed genoeg voor een halte)
  return { x: rx, y: ry, ux: beste.ux, uy: beste.uy, d: beste.d };
}
// halte aan de stoeprand: op de weg, een paar meter opzij naar de kant waar geklikt is
function halteOpWeg(x, y, max) {
  const w = wegBij(x, y, max); if (!w) return null;
  const nx = -w.uy, ny = w.ux, kant = Math.sign((x - w.x) * nx + (y - w.y) * ny) || 1;
  return { x: Math.round(w.x + nx * kant * 3.5), y: Math.round(w.y + ny * kant * 3.5), weg: w };
}
// toegangsweg (6 m) van een punt naar de dichtstbijzijnde weg, als vlak; null als het al aan de weg ligt of er geen weg is
function toegangNaarWeg(x, y, max = 200, breed = 6) {
  const w = wegBij(x, y, max); if (!w || w.d < 8) return null;
  const dx = w.x - x, dy = w.y - y, l = Math.hypot(dx, dy) || 1, nx = -dy / l * breed / 2, ny = dx / l * breed / 2;
  return [x + nx, y + ny, w.x + nx, w.y + ny, w.x - nx, w.y - ny, x - nx, y - ny, x + nx, y + ny].map(q => Math.round(q * 10) / 10);
}
const BUSMODI = ['bus', 'hov', 'belbus', 'trolley'];

// naam voor een nieuwe halte: de echte halte op die plek (dienstregeling of kaart), anders de straat, anders een nummer
function halteNaam(x, y, modus) {
  const pl = plaatsNaam(x, y), steiger = modus === 'veer' || modus === 'watertaxi';
  let naam = null, bd = 200;
  for (const h of D.haltes) { const d = Math.abs(h[1] - x) + Math.abs(h[2] - y); if (d < bd * 1.5) { const e = Math.hypot(h[1] - x, h[2] - y); if (e < bd) { bd = e; naam = h[0]; } } }
  if (!naam && kaart?.map?.querySourceFeatures) {
    const [lo, la] = lonlat(x, y), mx = 111320 * Math.cos(la * Math.PI / 180), afst = c => Math.hypot((c[0] - lo) * mx, (c[1] - la) * 111320);
    const dichtst = (laag, filter, max) => { let beste = null, b2 = max;
      let fs = []; try { fs = kaart.map.querySourceFeatures('osm', { sourceLayer: laag }) || []; } catch { fs = []; }
      for (const f of fs) { const nm = f.properties?.['name:nl'] || f.properties?.name; if (!nm || !filter(f.properties)) continue;
        const g = f.geometry, lijnen = g.type === 'Point' ? [[g.coordinates]] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
        for (const l of lijnen) for (const c of l) { const d = afst(c); if (d < b2) { b2 = d; beste = nm; } } }
      return beste; };
    // haltepunt uit de kaart (OpenStreetMap), anders de dichtstbijzijnde straat met een naam
    naam = dichtst('poi', p => steiger ? /ferry/.test(p.subclass || p.class) : /bus|tram/.test(p.class) || /stop|platform/.test(p.subclass || ''), 120);
    if (!naam) { const straat = dichtst('transportation_name', p => p.class !== 'motorway' && p.class !== 'rail', 150); if (straat) naam = straat; }
    if (naam && !naam.includes(',')) naam = `${pl}, ${naam}`;
  }
  if (!naam) return `${pl}, ${steiger ? 'Steiger' : 'Halte'} ${spel.haltes.filter(h => h.naam.startsWith(pl)).length + 1}`;
  if (!naam.includes(',') && !naam.startsWith(pl)) naam = `${pl}, ${naam}`;
  // dezelfde naam aan de overkant van de straat is prima (één knooppunt); verder weg krijgt een volgnummer
  let n = naam, k = 2;
  while (spel.haltes.some(h => h.naam === n && Math.hypot(h.x - x, h.y - y) > 250)) n = `${naam} (${k++})`;
  return n;
}
// welke bestaande haltes en stations passen bij een modus
function kandidaten(modus) {
  const uit = [];
  if (modus === 'vlucht') return D.vliegvelden.filter(v => v.s !== 'militair' && !(v.b && v.b > spel.jaar)).map(v => ({ naam: v.n, x: v.x, y: v.y, baan: v.baan, verhard: v.verhard, landing: v.landing, heli: v.s === 'heliport' }));
  const st = { trein: ['trein'], metro: ['metro', 'sneltram'], sneltram: ['sneltram', 'tram', 'metro'], tram: ['tram', 'sneltram'], bus: ['busstation'], hov: ['busstation'], belbus: ['busstation'], veer: ['veer'], watertaxi: ['veer'] }[modus];
  for (const s of D.stations) if (st.includes(s.s) && stationZichtbaar(s, spel.jaar)) uit.push({ naam: s.n, x: s.x, y: s.y, p: s.p });
  const bit = { trein: 1, metro: 2, sneltram: 6, tram: 4, bus: 8 | 32, hov: 8, belbus: 8 | 32, veer: 16, watertaxi: 16 }[modus];
  if (spel.jaar >= 2015) for (const h of D.haltes) if (h[3] & bit) uit.push({ naam: h[0], x: h[1], y: h[2] });
  for (const h of spel.haltes) if (isKlaar(h) && (h.modus === modus || (['bus', 'hov', 'belbus'].includes(modus) && ['bus', 'hov', 'belbus'].includes(h.modus)) || (modus === 'watertaxi' && h.modus === 'veer'))) uit.push({ naam: h.naam, x: h.x, y: h.y, eigen: h.id });
  return uit;
}
let perronOntwerp = null, terugNaarLijn = null;
// kosten en bouwtijd van een ontwerp: spoor per meter, perrons per stuk (eilandperron breder)
function perronKosten(o) { return Math.round((o.lengte * 2500 + (o.vlakken || []).length * (o.vorm === 'eiland' || o.vorm === 'kop2' ? 3.5e6 : 2.5e6) + (o.vorm?.startsWith('kop') ? 150000 * o.sporen.length : 0)) / 1e5) * 1e5; }

function voorstelTekenen(o) {
  const vl = v => { const c = []; for (let i = 0; i < v.length; i += 2) c.push(lonlat(v[i], v[i + 1])); return c; };
  kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: [
    ...o.sporen.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: p.map(q => lonlat(q[0], q[1])) } })),
    ...o.vlakken.map(v => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [vl(v)] } })),
  ] });
}
function perronOntwerpen(naam, x, y, kant = 0, vorm = perronOntwerp?.vorm || 'zij', eind = perronOntwerp?.eind || 1) {
  const o = ontwerpPerron(net, D.perrons, x, y, spel.jaar, { kant, vorm, eind });
  if (!o) { melding(`Bij ${naam} ligt geen spoor in de buurt.`); return; }
  perronOntwerp = { ...o, naam, x, y };
  voorstelTekenen(o);
  const m = o.punten[Math.floor(o.punten.length / 2)];
  if (kaart.res > 3) kaart.vliegNaar(m[0], m[1], 1.6);
  openPaneel('perronVoorstel', perronOntwerp);
}
function verdubbelOntwerpen(x, y, kant = 0) {
  const o = ontwerpVerdubbeling(net, D.perrons, x, y, spel.jaar, kant);
  if (o.fout) { melding(o.fout); return; }
  perronOntwerp = { ...o, naam: net.takken[o.tak]?.naam || 'spoor', x, y, verdubbel: true };
  voorstelTekenen(o);
  openPaneel('perronVoorstel', perronOntwerp);
}
// ---------------------------------------------------------------- aangeboden subsidies
function aanbiedingenAanvullen() {
  spel.aanbiedingen = spel.aanbiedingen || [];
  for (const a of spel.aanbiedingen) if (a.status === 'open' && spel.dag > a.tot) a.status = 'verlopen';
  spel.aanbiedingen = spel.aanbiedingen.filter(a => a.status !== 'verlopen' || spel.dag - a.tot < 30);
  for (let k = 0; k < 20 && spel.aanbiedingen.filter(a => a.status === 'open').length < 8; k++) { const a = bedenkAanbieding(spel, D.stations, D.plaatsen); if (a) spel.aanbiedingen.push(a); }
}
function aanbodKoppelen(id, l) {
  const a = (spel.aanbiedingen || []).find(x => x.id === id); if (!a || !l) return;
  if (!bedient(l, a)) { melding(`Lijn ${l.nr} bedient ${a.a.naam} en ${a.b.naam} niet allebei.`); return; }
  if (a.lijnId && a.lijnId !== l.id) { const oud = lijnVan(a.lijnId); if (oud) oud.aanbod = null; }
  a.lijnId = l.id; a.status = 'lopend';
  l.aanbod = { id: a.id, ...a.vergoeding };
  const t = toetsEisen(l, a); l.aanbodOk = t.ok;
  melding(t.ok ? `Lijn ${l.nr} krijgt de subsidie ${a.a.naam} – ${a.b.naam}: ${vergoedingTekst(a.vergoeding)}.` : `Gekoppeld, maar lijn ${l.nr} voldoet nog niet: ${t.redenen.join('; ')}. Pas het aan, dan wordt het uitbetaald.`, 8000);
}
function aanbodLos(a) { const l = lijnVan(a.lijnId); if (l) { l.aanbod = null; l.aanbodOk = false; } a.lijnId = null; a.status = a.tot >= spel.dag ? 'open' : 'verlopen'; }
// eisen controleren (dagelijks en bij wijzigingen); melding als het omslaat
function aanbiedingenToetsen() {
  for (const l of spel.lijnen) {
    if (!l.aanbod) continue;
    const a = (spel.aanbiedingen || []).find(x => x.id === l.aanbod.id);
    const t = a ? toetsEisen(l, a) : { ok: false, redenen: ['vervallen'] };
    if (t.ok !== l.aanbodOk) melding(t.ok ? `Lijn ${l.nr} voldoet weer aan de subsidie-eisen.` : `Lijn ${l.nr} voldoet niet meer aan de subsidie-eisen: ${t.redenen.join('; ')}. Geen uitbetaling tot het weer klopt.`, 8000);
    l.aanbodOk = t.ok;
  }
}
// filter voor het subsidiescherm: vervoerssoorten en provincies (leeg = alles)
const SUB_MODI = ['trein', 'bus', 'hov'];
let subFilter = { modus: [], prov: [] };
function provinciesVan(a) {
  if (!a.provincies && territorium?.gem.length) a.provincies = [...new Set([territorium.provincieVan(a.a.x, a.a.y), territorium.provincieVan(a.b.x, a.b.y)])].filter(p => p >= 0);
  return a.provincies || [];
}
const pastBijFilter = a => (!subFilter.modus.length || subFilter.modus.includes(a.modus)) && (!subFilter.prov.length || provinciesVan(a).some(p => subFilter.prov.includes(p)));
const subsidieLijst = () => (spel.aanbiedingen || []).filter(a => a.status !== 'verlopen' && pastBijFilter(a)).sort((p, q) => (q.lijnId ? 1 : 0) - (p.lijnId ? 1 : 0));
// aanbiedingen bij het filter erbij zoeken (tot er minstens n open passen)
function subsidiesZoeken(n = 4) {
  spel.aanbiedingen = spel.aanbiedingen || [];
  const binnen = subFilter.prov.length && territorium ? (x, y) => subFilter.prov.includes(territorium.provincieVan(x, y)) : undefined;
  let gevonden = 0;
  for (let k = 0; k < 40 && subsidieLijst().filter(a => a.status === 'open').length < n; k++) {
    const modus = subFilter.modus.length ? subFilter.modus[k % subFilter.modus.length] : undefined;
    const a = bedenkAanbieding(spel, D.stations, D.plaatsen, { modus, binnen });
    if (a && pastBijFilter(a)) { spel.aanbiedingen.push(a); gevonden++; }
  }
  return gevonden;
}
function aanbodBlok(lijst = (spel.aanbiedingen || []).filter(a => a.status !== 'verlopen')) {
  if (!lijst.length) return '<p>Geen aanbiedingen bij dit filter. Klik op <b>Meer aanbiedingen zoeken</b>.</p>';
  return `${lijst.map(a => {
      const eigen = spel.lijnen.filter(l => !l.bijzonder && bedient(l, a));
      const gekoppeld = a.lijnId ? lijnVan(a.lijnId) : null;
      return `<div class="kaartje"><div class="rij"><b>${MODI[a.modus].naam}: ${esc(a.a.naam)} – ${esc(a.b.naam)}</b>${gekoppeld ? '<span class="chip goed">loopt</span>' : ''}<span class="klein" style="margin-left:auto">${komma(Math.hypot(a.a.x - a.b.x, a.a.y - a.b.y) / 1000)} km</span></div>
        <p class="klein"><b>${vergoedingTekst(a.vergoeding)}</b> · eisen: ${eisenTekst(a.eisen)}${gekoppeld ? '' : ` · aanmelden kan tot dag ${a.tot + 1}`}</p>
        ${a.raming ? `<p class="klein">Raming provincie: ${esc(ramingTekst(a.raming))}. Goed neergezet verdien je de aanschaf in ${a.vergoeding.aanloopDagen || 2} dagen terug; de startbijdrage geldt alleen voor een nieuw aangelegde lijn.</p>` : ''}
        ${a.vergoeding?.start && a.startBetaald ? `<p class="klein">Startbijdrage uitbetaald: ${S.euroKort(a.startBetaald)} van ${S.euroKort(a.vergoeding.start)}</p>` : ''}
        ${eigen.map(l => { const t = toetsEisen(l, a); return `<p class="klein">Lijn <b>${esc(l.nr)}</b>: ${t.ok ? '✓ voldoet' : '✗ ' + esc(t.redenen.join('; '))} ${gekoppeld === l ? `<button class="knop klein" data-actie="aanbod-los" data-sub="${a.id}">Loskoppelen</button>` : `<button class="knop klein" data-actie="aanbod-koppel" data-sub="${a.id}" data-lijn="${l.id}">Koppelen</button>`}</p>`; }).join('')}
        <div class="rij"><button class="knop klein" data-actie="aanbod-toon" data-sub="${a.id}">Toon op kaart</button>${gekoppeld ? '' : `<button class="knop klein hoofd" data-actie="aanbod-bouw" data-sub="${a.id}">Lijn bouwen</button>`}</div></div>`;
    }).join('')}`;
}
// bij een nieuwe lijn: past hij bij een aangeboden subsidie?
function aanbodVoorNieuw(d) {
  const nep = { modus: d.modus, haltes: d.haltes };
  const a = (spel.aanbiedingen || []).find(x => !x.lijnId && x.status === 'open' && (x.id === bouw?.aanbod || bedient(nep, x))) ;
  if (!a || !bedient(nep, a)) return '';
  return `<label class="rij"><input type="checkbox" id="nl-aanbod" value="${a.id}" checked> Aanmelden voor de subsidie ${esc(a.a.naam)} – ${esc(a.b.naam)}: ${vergoedingTekst(a.vergoeding)} (eisen: ${eisenTekst(a.eisen)})</label>${a.raming ? `<p class="klein">Raming: ${esc(ramingTekst(a.raming))}</p>` : ''}`;
}
// lopende bouwprojecten: spoor (per project samengevoegd), perrons en stations
function bouwProjecten() {
  const uit = new Map();
  const voeg = (sleutel, naam, x, station) => { if (!uit.has(sleutel)) uit.set(sleutel, { naam, start: x.startMin ?? (x.startDag ?? x.gereedDag - 30) * 1440, gereed: gereedMin(x), kosten: 0, delen: [], station, spoed: false }); const p = uit.get(sleutel); p.delen.push(x); p.kosten += x.kosten || 0; p.spoed = p.spoed || !!x.spoed; p.gereed = Math.max(p.gereed, gereedMin(x)); };
  for (const k of spel.kruisingen || []) if (!isKlaar(k)) voeg(k, k.projectNaam, k);
  for (const b of spel.bovenleiding || []) if (!b.klaar && !isKlaar(b)) voeg(b.project || b, b.projectNaam || 'Bovenleiding', b);
  for (const sp of spel.spoor) if (!sp.klaar && !isKlaar(sp)) voeg(sp.project || sp, sp.projectNaam || (sp.perron ? `Spoor met perron · ${sp.perron}` : 'Nieuw spoor'), sp, sp.perron);
  for (const v of spel.perronVormen || []) if (!isKlaar(v) && v.project && uit.has(v.project)) uit.get(v.project).delen.push(v);
  for (const g of spel.gebouwen || []) if (!isKlaar(g)) voeg(g, g.projectNaam, g, g.station);
  for (const h of spel.haltes) if (!isKlaar(h)) voeg(h.project || h, h.busstation ? `Busstation ${h.busstation}` : `Station ${h.naam}${h.eigen ? '' : ' (ProRail)'}`, h, h.busstation || h.naam);
  return [...uit.values()].sort((a, b) => a.gereed - b.gereed);
}
function voortgang(p, i) {
  const nu = nuMin(), f = Math.max(0, Math.min(1, (nu - p.start) / Math.max(1, p.gereed - p.start)));
  const rest = Math.max(0, p.gereed - nu), echtS = rest * 60 / Math.max(1, snelheid);
  const echt = echtS < 90 ? `${Math.max(1, Math.round(echtS))} s` : echtS < 5400 ? `${Math.round(echtS / 60)} min` : `${komma(echtS / 3600)} uur`;
  return `<div class="kaartje"><div class="rij"><b>${esc(p.naam)}</b><span class="klein" style="margin-left:auto">${Math.round(f * 100)}%</span></div>
    <div style="height:8px;background:var(--lijn);border-radius:4px;overflow:hidden"><div style="height:100%;width:${(f * 100).toFixed(1)}%;background:var(--groen)"></div></div>
    <p class="klein">Klaar om ${S.klok((Math.round(p.gereed) + 300) % 1440)}${Math.floor((p.gereed + 300) / 1440) - 0 > spel.dag + (spel.tijd >= 1440 ? 1 : 0) ? ' (later)' : ''}: nog ${rest >= 90 ? `${komma(rest / 60)} speluur` : `${Math.ceil(rest)} spelminuten`} (≈ ${echt} bij ${snelheid}×)${p.spoed ? ' · versneld' : ''}</p>
    ${i != null && !p.spoed && p.delen.some(x => x.eigen !== false && x.eigenaar !== 'prorail') ? `<button class="knop klein" data-actie="spoed" data-i="${i}">Versneld bouwen (${S.euroKort(Math.round((p.kosten || 2e6) * 0.4 / 1e5) * 1e5)})</button>` : ''}</div>`;
}
// ontwerp van een nieuw station (sporen en perrons) voor het paneel; tekent het voorstel op de kaart
function stationOntwerp(d) {
  const o = ontwerpStation(net, D.perrons, d.x, d.y, spel.jaar, { sporen: d.sporen || 0, doorgaand: !!d.doorgaand, kant: d.kant || 1, modus: d.modus || 'trein' });
  if (o) voorstelTekenen({ ...o, vlakken: o.vlakken });
  return o;
}
const stationKosten = (o, d) => Math.round(((d?.soort === 'halte' ? 0.5e6 : 2e6) + (d?.combi ? 3e6 : 0) + o.lengte * 2500 + o.vlakken.reduce((a, v, i) => a + 2e6, 0) + o.eilanden * 1e6) / 1e5) * 1e5;
// ---------------------------------------------------------------- lening
// Lenen bij de bank om te investeren. Rente per maand; hoe meer je leent t.o.v. je bezit, hoe hoger de rente.
function bezitWaarde() { let w = 0; for (const [id, n] of Object.entries(spel.voertuigen)) w += n * (TYPE[id]?.prijs || 0) * 0.5; return w + spel.spoor.filter(x => x.eigenaar === 'speler').reduce((a, x) => a + (x.kosten || 0) * 0.5, 0); }
const leningMax = () => Math.round((20e6 + bezitWaarde() * 0.8) / 1e6) * 1e6;
const leningRente = () => (spel.jaar < 1950 ? 0.05 : spel.jaar < 1980 ? 0.07 : spel.jaar < 2010 ? 0.055 : 0.04) + 0.04 * Math.min(1, (spel.lening || 0) / Math.max(1, leningMax()));
function leningBlok() {
  const l = spel.lening || 0, max = leningMax(), ruimte = Math.max(0, max - l);
  return `<h3>Lening</h3><p>Geleend: <b>${S.euro(l)}</b> · rente ${komma(leningRente() * 100)}% per jaar (${S.euro(l * leningRente() / 12)} per maand) · je kunt nog ${S.euroKort(ruimte)} lenen.</p>
    <p class="klein">De bank leent tot € 20 mln plus 80% van de waarde van je materieel en eigen spoor. Hoe meer je leent, hoe hoger de rente.</p>
    <div class="rij">${[1e6, 5e6, 10e6, 25e6, 100e6].filter(b => b <= ruimte).map(b => `<button class="knop klein" data-actie="lenen" data-b="${b}">＋ ${S.euroKort(b)} lenen</button>`).join('')}</div>
    ${l ? `<div class="rij">${[1e6, 5e6, 10e6].filter(b => b <= l).map(b => `<button class="knop klein" data-actie="aflossen" data-b="${b}">− ${S.euroKort(b)} aflossen</button>`).join('')}<button class="knop klein" data-actie="aflossen" data-b="${l}">Alles aflossen</button></div>` : ''}`;
}
// ---------------------------------------------------------------- ongelijkvloerse kruisingen
// bestaande flyovers (spoor op een brug over ander spoor) en dive-unders (spoor in een tunnel onder ander spoor)
function zoekOngelijkvloers() {
  const uit = [], seg = (p, k) => [p[k], p[k + 1], p[k + 2], p[k + 3]];
  const snijpunt = (a, b) => { const [x1, y1, x2, y2] = a, [x3, y3, x4, y4] = b, d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4); if (Math.abs(d) < 1e-9) return null;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d, u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d; return t > 0 && t < 1 && u > 0 && u < 1 ? [x1 + t * (x2 - x1), y1 + t * (y2 - y1)] : null; };
  for (const t of net.takken) {
    if (!t.hoogte || t.dienst || t.soort !== 0) continue;
    const gezien = new Set();
    for (let k = 0; k < t.pts.length - 2; k += 2) {
      const s1 = seg(t.pts, k), cel = Math.floor(s1[0] / 1000) + ',' + Math.floor(s1[1] / 1000);
      for (const o of net.tRaster.get(cel) || []) {
        if (o === t || o.hoogte === t.hoogte || o.soort !== 0 || o.dienst || o.a === t.a || o.a === t.b || o.b === t.a || o.b === t.b) continue;
        for (let m = 0; m < o.pts.length - 2; m += 2) { const p = snijpunt(s1, seg(o.pts, m)); if (p) { const sl = Math.round(p[0] / 80) + ',' + Math.round(p[1] / 80); if (!gezien.has(sl)) { gezien.add(sl); uit.push({ x: p[0], y: p[1], soort: t.hoogte > 0 ? 'flyover' : 'diveunder', van: Math.max(t.start || 0, o.start || 0) }); } } }
      }
    }
  }
  // dubbel getekende sporen geven meerdere snijpunten vlak bij elkaar: samenvoegen binnen 150 m
  const samen = [];
  for (const k of uit) if (!samen.some(q => q.soort === k.soort && Math.hypot(q.x - k.x, q.y - k.y) < 150)) samen.push(k);
  return samen;
}
function kruisingenTekenen() {
  if (!kaart?.map?.getSource) return;
  D.ongelijk = D.ongelijk || zoekOngelijkvloers();
  const alle = [...D.ongelijk.filter(k => !k.van || k.van <= spel.jaar), ...(spel.kruisingen || []).map(k => ({ ...k, eigen: true, klaar: isKlaar(k) }))];
  kaart.bron('kruisingen', { type: 'FeatureCollection', features: alle.map(k => ({ type: 'Feature', properties: { t: k.soort === 'flyover' ? '▲ flyover' : '▼ dive-under', e: k.eigen ? 1 : 0, k: k.klaar === false ? 0 : 1 }, geometry: { type: 'Point', coordinates: lonlat(k.x, k.y) } })) });
}
// eigen bovenleiding voor trolleybussen: in het raster (herkenning) en op de kaart
function bovenleidingToevoegen(punten) {
  const p = punten.flat(); D.trolley = D.trolley || []; D.trolley.push(p); D.trolleyRaster = D.trolleyRaster || new Set();
  for (let k = 0; k < p.length - 2; k += 2) { const n = Math.ceil(Math.hypot(p[k + 2] - p[k], p[k + 3] - p[k + 1]) / 25); for (let q = 0; q <= n; q++) D.trolleyRaster.add(Math.floor((p[k] + (p[k + 2] - p[k]) * q / n) / 50) + ',' + Math.floor((p[k + 1] + (p[k + 3] - p[k + 1]) * q / n) / 50)); }
  if (kaart?.map?.getSource?.('trolley')) kaart.bron('trolley', { type: 'FeatureCollection', features: D.trolley.map(q => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lijnGeo(q) } })) });
  for (const l of [...spel.lijnen, ...AI.lijnen]) l._trolley = undefined;
}
// ---------------------------------------------------------------- elektrificatie
const takVan = i => i >= 1e6 ? net.eigen[i - 1e6] : net.takken[i];
// welke lijnen (eigen en van anderen) rijden over deze takken, met hun materieel
function lijnenOpBaanvak(takken) {
  const ids = new Set(takken.map(t => t.i)), uit = [];
  const midden = takken.map(t => [t.pts[(t.pts.length >> 2) * 2], t.pts[(t.pts.length >> 2) * 2 + 1]]);
  for (const l of [...spel.lijnen, ...AI.lijnen]) {
    if (!['trein', 'metro', 'sneltram', 'tram'].includes(l.modus) || l.bijzonder) continue;
    let erop = l.route?.takken ? l.route.takken.some(i => ids.has(i)) : false;
    if (!erop && !l.route?.takken && l.route?.pts) { const [x0, y0, x1, y1] = l.bbox || bboxVan(l.route.pts); erop = midden.some(([mx, my]) => mx > x0 - 50 && mx < x1 + 50 && my > y0 - 50 && my < y1 + 50 && projecteer(l.route.pts, mx, my).d < 25); }
    if (erop) uit.push({ lijn: l, typeId: l.ai ? typeVoor(l, spel.jaar, standaardType) : l.typeId });
  }
  return uit;
}
// bovenleiding aanleggen waar die ontbreekt (geen spanning = niemand heeft er last van; diesel rijdt ook onder draad)
function aanlegPlan(l, c) {
  const sys = (spanningenVan(l.typeId) || []).find(x => systemenVoorSoort(0).includes(x) === (l.modus === 'trein')) || (l.modus === 'trein' ? '1500DC' : l.modus === 'metro' ? '750DC3' : '600DC');
  const takken = [...new Set(c.probleem.filter(p => p.sys === 'geen').flatMap(p => p.takken))].map(takVan).filter(Boolean);
  const km = takken.reduce((a, t) => a + t.lengte, 0) / 1000;
  return { sys, takken, km, kosten: ombouwKostenStroom(null, sys, km) };
}
function aanlegKnop(l, c) {
  if (!c.probleem.some(p => p.sys === 'geen')) return '';
  const p = aanlegPlan(l, c); return `<button class="knop klein hoofd" data-actie="stroom-aanleg" data-id="${l.id}">Overal bovenleiding aanleggen: ${komma(p.km)} km ${SYSTEMEN[p.sys]?.naam || p.sys} (${S.euroKort(p.kosten)})</button>`;
}
// sleeplocs die dit systeem aankunnen (diesel kan altijd), om ongeschikt materieel over het stuk te slepen
function sleeplocKnoppen(l, sys) {
  const locs = [...beschikbaarLos(spel.jaar), ...VLOOT.filter(v => v.soort === 'loc' && spel.voertuigen[v.id])].filter((v, i, a) => v.soort === 'loc' && a.indexOf(v) === i && kanOp(v.id, sys));
  return locs.length ? `<select id="sleep-${l.id}">${locs.map(v => `<option value="${v.id}">${esc(v.naam)}${spel.voertuigen[v.id] ? ` (${spel.voertuigen[v.id]} in bezit)` : ` · ${S.euroKort(v.prijs)}`}</option>`).join('')}</select><button class="knop klein" data-actie="sleeploc" data-id="${l.id}">Sleeploc inzetten (${l.nodig} nodig)</button>` : '';
}
// mag deze eigen lijn met dit materieel rijden? anders stilzetten tot het is opgelost
function stroomBijwerken(l) {
  if (!l || l.ai || l.bijzonder || (l.echt && !l.aangepast)) return;
  const c = stroomCheck(spel, net, l); l._stroom = c;
  if (!c.ok && l.actief) { l.actief = false; l.wacht = 'stroom'; melding(`Lijn ${l.nr} kan niet rijden: ${TYPE[l.typeId]?.naam || ''} kan niet op ${c.probleem.map(p => `${p.naam} (${komma(p.km)} km)`).join(', ')}. Open de lijn om de stukken te tonen of er bovenleiding aan te leggen.`, 10000); }
  if (c.ok && l.wacht === 'stroom') { l.actief = true; l.wacht = null; melding(`Lijn ${l.nr} rijdt weer.`); }
}
// bij een nieuwe lijn: hoeveel voertuigen zijn nodig met het gekozen materieel, en wat kost het om aan te vullen
function nodigBlok(d, typen) {
  const id = d.typeKeuze && typen.some(v => v.id === d.typeKeuze) ? d.typeKeuze : typen[0]?.id; if (!id || !d.route) return '';
  const iv = { vroeg: +(d.dalIn || 30), ochtendspits: +(d.spitsIn || (d.modus === 'trein' ? 30 : 15)), dal: +(d.dalIn || 30), avondspits: +(d.spitsIn || (d.modus === 'trein' ? 30 : 15)), avond: +(d.avondIn || 60) };
  const tmp = { modus: d.modus, typeId: id, haltes: d.haltes, route: d.route, interval: iv, eerste: 6 * 60, laatste: 23 * 60, offset: 0, richting: d.rond ? 'rond' : d.richting || 'beide' };
  try { S.herbereken(tmp); } catch { return ''; }
  const per = nodigPer(id), gebruikt = c => spel.lijnen.filter(l => l.actief).reduce((a, l) => a + (nodigPer(l.typeId)[c] || 0) * l.nodig, 0);
  const tekort = Object.entries(per).map(([c, k]) => [c, Math.max(0, k * tmp.nodig - Math.max(0, (spel.voertuigen[c] || 0) - gebruikt(c)))]).filter(x => x[1] > 0);
  const kosten = tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0);
  return `<p class="klein">Rijtijd ${Math.round(tmp.duur / 60)} min · nodig <b>${tmp.nodig}</b> × ${esc(TYPE[id].naam)}${tekort.length ? ` · nog te kopen: ${tekort.map(([c, n]) => `${n} × ${esc(TYPE[c].naam)}`).join(', ')} (${S.euroKort(kosten)})` : ' · genoeg vrij in je vloot'}</p>`;
}
// ---------------------------------------------------------------- voertuig samenstellen
// rol van een kaart in de rij: eerste = aandrijving, laatste (vanaf 3 kaarten) = afsluiting, daartussen rijtuigen/treinstellen
const rolVan = (d, i) => i === 0 ? 'begin' : d.modus === 'trein' && i === d.delen.length - 1 && d.delen.length >= 3 ? 'eind' : 'midden';
function bouwKeuzes(d, rol) {
  const typen = [...beschikbaar(spel.jaar, d.modus), ...(d.modus === 'trein' ? beschikbaarLos(spel.jaar) : []), ...(spel.series || []).map(x => TYPE[x.id]).filter(x => x && x.modus === d.modus),
    ...Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && TYPE[id]?.modus === d.modus && !TYPE[id]?.samen).map(id => TYPE[id])]
    .filter((x, i, a) => x && a.indexOf(x) === i && !['ddr', 'stoom3700'].includes(x.id)); // samengestelde oude sets bouw je nu zelf
  const soort = x => x.soort || TYPE[x.basis]?.soort;
  return typen.filter(x => rol === 'begin' ? soort(x) === 'loc' || !soort(x) : rol === 'eind' ? soort(x) === 'loc' || soort(x) === 'stuurstand' || !soort(x) : soort(x) !== 'loc');
}
function bouwKaart(d, x, i) {
  const rol = rolVan(d, i), t = TYPE[x.id], keuzes = bouwKeuzes(d, rol);
  const titel = { begin: d.modus === 'trein' ? 'Aandrijving (loc of treinstel)' : 'Voertuig', midden: 'Rijtuigen of treinstellen', eind: 'Afsluiting (loc, stuurstand of treinstel)' }[rol];
  const kl = t && t.soort !== 'loc' ? klassenVan(serieInrichting(x.id), x.id, d.modus) : [];
  return `<div class="bouwkaart"><div class="rij"><b class="klein">${titel}</b>${i > 0 ? `<button class="knop klein" style="margin-left:auto" data-actie="bw-weg" data-i="${i}" title="weghalen">✕</button>` : ''}</div>
    <div class="foto" data-foto="${esc(x.id || '')}"></div>
    <select data-wijzig="bw-type" data-i="${i}"><option value="">— kies —</option>${keuzes.map(v => `<option value="${v.id}" ${v.id === x.id ? 'selected' : ''}>${esc(v.naam)}${spel.voertuigen[v.id] ? ` (${spel.voertuigen[v.id]} in bezit)` : ''}</option>`).join('')}</select>
    ${t ? `<p class="klein">${t.van}–${t.tot < 2100 ? t.tot : 'nu'} · ${t.vmax} km/u · ${vermogen(x.id) ? Math.round(vermogen(x.id)).toLocaleString('nl-NL') + ' kW · ' : ''}${Math.round(massa(x.id))} t${t.soort !== 'loc' ? ` · ${doorloop(x.id) ? 'doorloop' : 'geen doorloop'}` : ''} · ${S.euroKort(t.prijs)}</p>
      ${kl.length ? `<p class="klein">${kl.map(k => `${KLASSE_NAAM[k.klasse]} ${k.zit}${k.sta ? '+' + k.sta : ''} (${STOEL[k.stoel]?.naam || ''})`).join('<br>')}${voorzieningen(x.id).length ? '<br>' + [...new Set(voorzieningen(x.id).map(v => v.naam))].join(', ') : ''}</p>
        <button class="knop klein" data-actie="bw-ink" data-i="${i}">Interieur…</button>` : ''}
      ${rol === 'midden' ? `<label class="veld klein">Aantal<input type="number" min="1" max="20" value="${x.n || 1}" data-wijzig="bw-n" data-i="${i}" style="width:4em"></label>` : ''}` : ''}</div>`;
}
const bouwLijst = d => d.delen.filter(x => TYPE[x.id]).flatMap(x => Array(Math.max(1, x.n || 1)).fill(x.id));
// van een bestaand voertuig (samenstelling of type) weer kaarten maken, om te kopiëren
function bouwVan(typeId) {
  const t = TYPE[typeId], ids = t?.samen || [typeId], delen = [];
  for (const id of ids) { const l = delen[delen.length - 1]; if (l && l.id === id && delen.length > 0 && TYPE[id]?.soort !== 'loc') l.n++; else delen.push({ id, n: 1 }); }
  return { modus: t?.modus || 'trein', delen, aantal: 1 };
}
// foto's: samenvatting van het Wikipedia-artikel (nl, anders en); zonder foto een tekening van de bakken
const fotoCache = new Map();
async function fotoVan(id) {
  if (fotoCache.has(id)) return fotoCache.get(id);
  const opgeslagen = localStorage.getItem('ovfoto:' + id); if (opgeslagen !== null) { fotoCache.set(id, opgeslagen); return opgeslagen; }
  let url = '';
  const [nl, en] = wiki(id);
  for (const [taal, titel] of [['nl', nl], ['en', en]]) { if (!titel || url) continue;
    try { const r = await fetch(`https://${taal}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titel.replace(/ /g, '_'))}`); if (r.ok) { const j = await r.json(); url = j.thumbnail?.source || ''; } } catch { /* offline */ } }
  fotoCache.set(id, url); try { localStorage.setItem('ovfoto:' + id, url); } catch { /* vol */ }
  return url;
}
function tekeningVan(id, modus) {
  const u = uiterlijk(id, modus), L = u._l || 20, sch = 220 / Math.max(L, 30); let x = 4, svg = '';
  u.bakken.forEach((b, k) => { const w = b * sch, loc = u.loc && k < u.loc; svg += `<rect x="${x}" y="${u.dd ? 8 : 16}" width="${w - 2}" height="${u.dd ? 34 : 24}" rx="3" fill="${loc ? '#5f6366' : u.kleur}" stroke="#333"/>`;
    if (!loc) for (let r = x + 6; r < x + w - 10; r += 9) svg += `<rect x="${r}" y="${u.dd ? 12 : 20}" width="6" height="7" fill="#1d2a33"/>` + (u.dd ? `<rect x="${r}" y="28" width="6" height="7" fill="#1d2a33"/>` : '');
    x += w; });
  return `<svg viewBox="0 0 230 50" width="100%" height="60"><line x1="0" y1="45" x2="230" y2="45" stroke="#777"/>${svg}</svg>`;
}
function fotosLaden(el) {
  for (const f of el.querySelectorAll('[data-foto]')) {
    const id = f.dataset.foto; if (!id || !TYPE[id]) continue;
    f.innerHTML = tekeningVan(id, TYPE[id].modus);
    fotoVan(id).then(url => { if (url && f.isConnected) f.innerHTML = `<img src="${url}" alt="${esc(TYPE[id].naam)}" loading="lazy" referrerpolicy="no-referrer">`; });
  }
}
let terugNaarBouwer = null;
// ---------------------------------------------------------------- busstation
const busKosten = g => Math.round((g.n * 60000 + 150000 + (g.opstelling === 'naast' ? g.n * 30000 : 0)) / 1e4) * 1e4;
function busVoorstel(g) {
  const o = busstationOntwerp(g.n, g.opstelling, g.plek.x, g.plek.y, g.plek.hoek), t = busToegang(g);
  kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: [
    ...[...o.vlakken, ...(t ? [t] : [])].map(v => { const c = []; for (let i = 0; i < v.length; i += 2) c.push(lonlat(v[i], v[i + 1])); return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c] } }; }),
    ...o.haltes.map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [lonlat(p.x - 6 * Math.cos(g.plek.hoek), p.y - 6 * Math.sin(g.plek.hoek)), lonlat(p.x + 6 * Math.cos(g.plek.hoek), p.y + 6 * Math.sin(g.plek.hoek))] } })),
  ] });
  openPaneel('busstation', g);
}
// ---------------------------------------------------------------- stationsgebouwen
// toegangsweg van het busstation of van de straatkant van het stationsgebouw naar de dichtstbijzijnde weg
const busToegang = g => toegangNaarWeg(g.plek.x, g.plek.y, 250);
const gebouwToegang = g => { const b = GROOTTE[g.grootte]?.b || 16, h = g.plek.hoek, sx = g.plek.x + Math.sin(h) * b / 2, sy = g.plek.y - Math.cos(h) * b / 2; return toegangNaarWeg(sx, sy, 250, 5); };
const gebouwVorm = g => { const st = STIJLEN.find(x => x.id === g.stijl) || STIJLEN[0], gr = (st.min === 'middel' && g.grootte === 'klein') ? 'middel' : g.grootte; return plattegrond(st, gr, g.plek.x, g.plek.y, Math.cos(g.plek.hoek), Math.sin(g.plek.hoek)); };
function gebouwVoorstel(g) { const t = gebouwToegang(g); voorstelTekenen({ sporen: [], vlakken: [...gebouwVorm(g), ...(t ? [t] : [])] }); openPaneel('gebouw', g); }
// heeft een eigen station (nog) geen gebouw terwijl dat in dit jaar nodig is voor het loket?
function stationGebouwNodig(naam) {
  if (spel.jaar >= 1990) return false;
  const h = spel.haltes.find(x => x.naam === naam && x.modus === 'trein' && x.eigen);
  return !!h && h.soort !== 'halte' ? !(spel.gebouwen || []).some(g => g.station === naam && isKlaar(g)) : false;
}
// effect op het aantal reizigers per halte: gebouw = bonus, eigen station zonder loket (vóór 1990) = minder
S.zetHalteFactor(h => {
  if (!spel) return 1;
  const g = (spel.gebouwen || []).find(x => isKlaar(x) && Math.hypot(x.x - h.x, x.y - h.y) < 600 && x.station === h.naam) || (spel.gebouwen || []).find(x => isKlaar(x) && Math.hypot(x.x - h.x, x.y - h.y) < 300);
  if (g) return 1 + GROOTTE[g.grootte].bonus + (STIJLEN.find(x => x.id === g.stijl)?.extra || 0);
  return stationGebouwNodig(h.naam) ? 0.7 : 1;
});
// maandelijks: onderhoud en winkelhuur
function gebouwenMaand() {
  let saldo = 0;
  for (const g of spel.gebouwen || []) if (isKlaar(g)) saldo += winkelHuur(g.grootte, spel.jaar) - GROOTTE[g.grootte].onderhoud;
  if (saldo) { spel.geld += saldo; spel.maand.overig -= saldo; }
}
function perronVoorstelWissen() { perronOntwerp = null; kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: [] }); }
function dichtsteKandidaat(modus, px, py, maxPx = 18) {
  let beste = null, bd = maxPx;
  const [wx, wy] = kaart.wereld(px, py), bereik = maxPx * kaart.res * 1.6;
  const lijst = kandidaten(modus);
  for (const c of lijst) {
    if (Math.abs(c.x - wx) > bereik || Math.abs(c.y - wy) > bereik) continue;
    const [sx, sy] = kaart.scherm(c.x, c.y); const d = Math.hypot(sx - px, sy - py); if (d < bd) { bd = d; beste = c; }
  }
  if (beste || modus === 'vlucht') return beste;
  // op een station van een andere soort geklikt (bv. treinstation in busmodus): de halte van deze soort die bij
  // dat station hoort (binnen 400 m), zodat een station en zijn bus-/tramhaltes als één knooppunt tellen
  let st = null; bd = maxPx;
  for (const s of D.stations) {
    if (!stationZichtbaar(s, spel.jaar) || Math.abs(s.x - wx) > bereik || Math.abs(s.y - wy) > bereik) continue;
    const [sx, sy] = kaart.scherm(s.x, s.y); const d = Math.hypot(sx - px, sy - py); if (d < bd) { bd = d; st = s; }
  }
  if (!st) return null;
  let bij = null, bm = 400;
  for (const c of lijst) { const d = Math.hypot(c.x - st.x, c.y - st.y); if (d < bm) { bm = d; bij = c; } }
  return bij ? { ...bij, station: st.n } : null;
}
// haltes van deze soort die op de route liggen, in volgorde langs de route (voor 'overal stoppen')
function haltesLangs(modus, pts, geklikt) {
  const max = ['trein', 'metro', 'sneltram'].includes(modus) ? 120 : 45;
  const cum = [0]; for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  const [x0, y0, x1, y1] = bboxVan(pts);
  const plek = (x, y) => { let bd = Infinity, bs = 0; for (let k = 2; k < pts.length; k += 2) { const ax = pts[k - 2], ay = pts[k - 1], dx = pts[k] - ax, dy = pts[k + 1] - ay, l2 = dx * dx + dy * dy || 1e-9; const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)); const d = Math.hypot(x - ax - dx * f, y - ay - dy * f); if (d < bd) { bd = d; bs = cum[k / 2 - 1] + f * Math.sqrt(l2); } } return [bd, bs]; };
  const uit = [], namen = new Set(geklikt.map(h => h.naam));
  for (const h of geklikt) uit.push({ ...h, s: plek(h.x, h.y)[1], geklikt: true });
  for (const c of kandidaten(modus)) {
    if (namen.has(c.naam) || c.x < x0 - max || c.x > x1 + max || c.y < y0 - max || c.y > y1 + max) continue;
    const [d, sp] = plek(c.x, c.y);
    if (d <= max) { namen.add(c.naam); uit.push({ naam: c.naam, x: c.x, y: c.y, s: sp }); }
  }
  uit.sort((a, b) => a.s - b.s);
  // alleen tussen de eerste en de laatste aangeklikte halte
  const i0 = uit.findIndex(h => h.geklikt), i1 = uit.length - 1 - [...uit].reverse().findIndex(h => h.geklikt);
  return uit.slice(i0, i1 + 1).map(({ s, ...h }) => h);
}

// route langs haltes p voor soort m: over het spoornet, over water/lucht recht, anders over de weg
async function routeVoor(m, p) {
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
  return { route, waarschuwing };
}
async function lijnKlaar() {
  if (!bouw || bouw.punten.length < 2) { melding('Kies minstens twee haltes.'); return; }
  const m = bouw.modus, p = bouw.punten;
  hint('Route zoeken…');
  const { route, waarschuwing } = await routeVoor(m, p);
  bouw.route = route;
  hint(null);
  const geklikt = p.map(h => ({ naam: h.naam, x: h.x, y: h.y, ...(m === 'vlucht' ? { baan: h.baan, verhard: h.verhard, landing: h.landing, heli: h.heli } : {}) }));
  // rondlijn: de laatste halte is de eerste; tussenstops zoeken zonder die dubbele halte
  const rond = !!bouw.rond, basis = rond ? geklikt.slice(0, -1) : geklikt;
  let overal = !['vlucht', 'veer', 'watertaxi'].includes(m) && route.pts?.length >= 4 ? haltesLangs(m, route.pts, basis) : basis;
  if (rond) overal = [...overal, geklikt[0]];
  const terugVan = bouw.terugVan ? lijnVan(bouw.terugVan) : null;
  openPaneel('nieuweLijn', { modus: m, geklikt, overal, stopOveral: overal.length > geklikt.length && m !== 'trein', haltes: geklikt, route, waarschuwing,
    richting: rond ? 'rond' : terugVan ? 'heen' : 'beide', rond, terugVan });
}
function maakNieuweLijn() {
  const d = paneelData;
  const spits = +$('nl-spits').value || 15, dal = +$('nl-dal').value || 30, avond = +$('nl-avond').value || 60;
  const eigenSpoor = d.route.takken?.length && d.route.takken.every(i => i >= 1e6);
  const l = S.maakLijn(spel, { nr: $('nl-nr').value.trim() || String(spel.lijnen.length + 1), naam: $('nl-naam').value.trim(), modus: d.modus, typeId: $('nl-type').value,
    haltes: d.haltes, route: d.route, interval: { vroeg: dal, ochtendspits: spits, dal, avondspits: spits, avond }, richting: d.rond ? 'rond' : d.richting || 'beide' });
  l.eigenSpoor = eigenSpoor;
  if (d.terugVan) { l.paar = d.terugVan.id; d.terugVan.paar = l.id; S.herbereken(d.terugVan); S.herbereken(l); }
  const terugBouwen = d.richting === 'heen' && !d.terugVan && !d.rond && $('nl-terug')?.checked;
  if ($('nl-koop').checked) { // aanvullen per onderdeel (ook bij samengestelde treinen), rekening houdend met andere lijnen
    const tekort = Object.entries(nodigPer(l.typeId)).map(([c, k]) => [c, Math.max(0, spel.lijnen.filter(x => x.actief).reduce((s2, x) => s2 + (nodigPer(x.typeId)[c] || 0) * x.nodig, 0) - (spel.voertuigen[c] || 0))]).filter(x => x[1] > 0);
    const kosten = tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0);
    if (tekort.length && betaal(kosten, 'materieel')) for (const [c, n] of tekort) { spel.voertuigen[c] = (spel.voertuigen[c] || 0) + n; (spel.aankopen = spel.aankopen || []).push({ id: c, n, dag: spel.dag, jaar: spel.jaar }); }
  }
  if (d.modus === 'trein' && !eigenSpoor) l.paden = Math.ceil(60 / Math.min(...Object.values(l.interval))); // ruimte op het spoor krijg je altijd; je betaalt spoorhuur
  const aanbodId = $('nl-aanbod')?.checked ? $('nl-aanbod').value : null;
  if ($('nl-concessie').checked) nieuwVerzoek(spel, { aan: 'provincie', aanNaam: 'Provincie', soort: 'concessie', lijnId: l.id, tekst: `Concessie en subsidie gevraagd voor lijn ${l.nr}.` });
  melding(`Lijn ${l.nr} ${l.actief ? 'rijdt vanaf nu' : 'wacht op ruimte op het spoor'}. Benodigd: ${l.nodig} voertuig(en).`);
  stroomBijwerken(l);
  if (aanbodId) aanbodKoppelen(aanbodId, l);
  bouw = null; zetTool('kijk'); selectie = { lijn: l }; openPaneel('lijn', l);
  if (terugBouwen) terugwegBouwen(l);
}
// de terugweg van een eenrichtingslijn: begint bij de laatste halte, eindigt bij de eerste
function terugwegBouwen(l) {
  const eind = l.haltes[l.haltes.length - 1];
  zetTool('lijn');
  bouw = { modus: l.modus, punten: [{ naam: eind.naam, x: eind.x, y: eind.y }], terugVan: l.id };
  hint(`Terugweg van lijn ${l.nr}: begint bij ${eind.naam}. Klik de haltes op volgorde aan en eindig bij ${l.haltes[0].naam}.`,
    [['Klaar', lijnKlaar], ['Laatste weg', () => { if (bouw.punten.length > 1) bouw.punten.pop(); }], ['Stoppen', () => zetTool('kijk')]]);
}
const SPOORSOORT = { trein: { naam: 'treinspoor', code: 0, km: [8e6, 15e6], extra: 6e6 }, metro: { naam: 'metrospoor', code: 2, km: [14e6, 25e6], extra: 10e6 }, tram: { naam: 'tramspoor', code: 3, km: [4e6, 7e6], extra: 3e6 }, trolley: { naam: 'trolleybus-bovenleiding', code: -1, km: [1.2e6, 1.8e6], extra: 0 } };
function spoorBegin(soort) {
  tool = 'spoor'; bouw = { punten: [], soort };
  hint(`Klik punten voor het nieuwe ${SPOORSOORT[soort].naam}: alleen begin en eind is genoeg (het spel legt dan zelf een tracé om de bebouwing heen). Begin en eind sluiten aan op bestaand ${soort === 'trolley' ? 'net' : 'spoor'}.`,
    [['Klaar', spoorKlaar], ['Laatste punt weg', () => { bouw.punten.pop(); }], ['Stoppen', () => zetTool('kijk')]]);
}
function spoorKlaar() {
  if (!bouw || bouw.punten.length < 2) { melding('Klik minstens twee punten.'); return; }
  const d = { soort: bouw.soort || 'trein', ankers: bouw.punten.map(p => [Math.round(p.x), Math.round(p.y)]), handvat: [], sporen: bouw.soort === 'trolley' ? 2 : 1, hergebruik: true };
  if (d.soort !== 'trolley') { const r = net.route(d.ankers[0], d.ankers.at(-1), d.soort === 'metro' ? 'metro' : d.soort === 'tram' ? 'tram' : 'trein', spel.jaar); const recht = Math.hypot(d.ankers.at(-1)[0] - d.ankers[0][0], d.ankers.at(-1)[1] - d.ankers[0][1]); if (r && r.lengte < recht * 1.5) d.verbinding = r.lengte; }
  if (d.ankers.length === 2) d.ankers = autoTrace(d.ankers[0], d.ankers[1]);
  hint(null); openPaneel('nieuwSpoor', d); spoorVoorstel(d);
}
// automatisch tracé: om de bebouwde kom heen (plaatsen als cirkels naar inwonertal), begin en eind mogen erin liggen
function autoTrace(A, B) {
  const steden = D.plaatsen.filter(p => p[3] >= 2000).map(p => ({ x: p[1], y: p[2], r: 250 + 9 * Math.sqrt(p[3]) }))
    .filter(c => Math.hypot(c.x - A[0], c.y - A[1]) > c.r && Math.hypot(c.x - B[0], c.y - B[1]) > c.r);
  let pad = [A, B];
  for (let it = 0; it < 8; it++) {
    let beste = null;
    for (let i = 0; i < pad.length - 1; i++) {
      const [ax, ay] = pad[i], [bx, by] = pad[i + 1], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
      for (const c of steden) {
        const f = Math.max(0, Math.min(1, ((c.x - ax) * dx + (c.y - ay) * dy) / l2)), px = ax + dx * f, py = ay + dy * f, d = Math.hypot(c.x - px, c.y - py);
        const diep = c.r - d; if (diep > 50 && f > 0.02 && f < 0.98 && (!beste || diep > beste.diep)) beste = { i, c, px, py, d, diep, dx, dy };
      }
    }
    if (!beste) break;
    const { c, px, py, d, dx, dy } = beste, l = Math.hypot(dx, dy) || 1;
    let nx = -dy / l, ny = dx / l; if ((px - c.x) * nx + (py - c.y) * ny < 0) { nx = -nx; ny = -ny; } // weg van het centrum
    if (d < 1) { /* recht door het centrum: kies een kant */ }
    pad.splice(beste.i + 1, 0, [Math.round(c.x + nx * c.r * 1.15), Math.round(c.y + ny * c.r * 1.15)]);
  }
  return pad;
}
// bezier door de ankers; handvat[i] = [hx, hy] (null = automatisch, vloeiend)
function handvatVan(d, i) {
  const A = d.ankers, h = d.handvat[i];
  if (h) return h;
  const v = A[Math.min(A.length - 1, i + 1)], w = A[Math.max(0, i - 1)];
  return [(v[0] - w[0]) / (i === 0 || i === A.length - 1 ? 3 : 6), (v[1] - w[1]) / (i === 0 || i === A.length - 1 ? 3 : 6)];
}
function spoorCurve(d) {
  const A = d.ankers, uit = [];
  for (let i = 0; i < A.length - 1; i++) {
    const h0 = handvatVan(d, i), h1 = handvatVan(d, i + 1), P0 = A[i], P3 = A[i + 1], P1 = [P0[0] + h0[0], P0[1] + h0[1]], P2 = [P3[0] - h1[0], P3[1] - h1[1]];
    const n = Math.max(4, Math.ceil(Math.hypot(P3[0] - P0[0], P3[1] - P0[1]) / 20));
    for (let k = i ? 1 : 0; k <= n; k++) { const t = k / n, u = 1 - t; uit.push([Math.round((u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0]) * 10) / 10, Math.round((u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]) * 10) / 10]); }
  }
  return uit;
}
// welke delen liggen al op bestaand spoor (evenwijdig, binnen 30 m)? alleen de rest wordt aangelegd
function spoorStukken(d) {
  const c = spoorCurve(d), modus = d.soort === 'metro' ? 'metro' : d.soort === 'tram' ? 'tram' : 'trein';
  const bestaand = c.map((p, i) => {
    if (!d.hergebruik) return false;
    if (d.soort === 'trolley') return D.trolleyRaster?.has(Math.floor(p[0] / 50) + ',' + Math.floor(p[1] / 50));
    const r = net.dichtsteTak(p[0], p[1], modus, spel.jaar, 120); if (!r || r.t.dienst) return false; // getekend 'ongeveer langs' bestaand spoor telt ook
    const q = c[Math.min(c.length - 1, i + 2)], o = c[Math.max(0, i - 2)], a = net.stuk(r.t, Math.max(0, r.s - 40), Math.min(r.t.lengte, r.s + 40));
    const ux = q[0] - o[0], uy = q[1] - o[1], vx = a[a.length - 2] - a[0], vy = a[a.length - 1] - a[1];
    return Math.abs(ux * vx + uy * vy) / ((Math.hypot(ux, uy) * Math.hypot(vx, vy)) || 1) > 0.85;
  });
  const stukken = []; let cur = null;
  c.forEach((p, i) => { if (!bestaand[i]) { if (!cur) { cur = []; if (i) cur.push(c[i - 1]); } cur.push(p); } else if (cur) { cur.push(p); stukken.push(cur); cur = null; } });
  if (cur) stukken.push(cur);
  const len = pts => pts.reduce((a, q, i) => i ? a + Math.hypot(q[0] - pts[i - 1][0], q[1] - pts[i - 1][1]) : 0, 0);
  const nieuw = stukken.filter(x => len(x) > 60), totaal = len(c), nieuwM = nieuw.reduce((a, x) => a + len(x), 0);
  return { curve: c, nieuw, totaal, nieuwM, bestaandM: totaal - nieuwM };
}
const spoorKosten = (d, st) => Math.round(st.nieuwM / 1000 * (d.sporen >= 2 ? SPOORSOORT[d.soort].km[1] + (d.sporen - 2) * SPOORSOORT[d.soort].extra : SPOORSOORT[d.soort].km[0]) / 1e5) * 1e5;
let handvatMarkers = [];
function handvattenWeg() { for (const m of handvatMarkers) m.remove(); handvatMarkers = []; }
function spoorVoorstel(d) {
  const st = spoorStukken(d); d._st = st;
  const ll = pts => pts.map(p => lonlat(p[0], p[1]));
  const f = [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ll(st.curve) } }];
  for (let i = 0; i < d.ankers.length; i++) { const A = d.ankers[i], h = handvatVan(d, i); f.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ll([[A[0] - h[0], A[1] - h[1]], [A[0] + h[0], A[1] + h[1]]]) } }); }
  for (const x of st.nieuw) { const c = ll(x); f.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...c, ...[...c].reverse()]] } }); }
  kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: f });
  // versleepbare punten en handvatten (zoals in een tekenprogramma)
  handvattenWeg();
  const ML = globalThis.maplibregl; if (!ML?.Marker) return;
  const maak = (x, y, klasse, slepen) => { const el = document.createElement('div'); el.className = klasse; const m = new ML.Marker({ element: el, draggable: true }).setLngLat(lonlat(x, y)).addTo(kaart.map);
    m.on('drag', () => { const { lng, lat } = m.getLngLat(); const [px, py] = kaart.wereldVanLonLat ? kaart.wereldVanLonLat(lng, lat) : wgsNaarRd(lat, lng); slepen(px, py, false); });
    m.on('dragend', () => { const { lng, lat } = m.getLngLat(); const [px, py] = kaart.wereldVanLonLat ? kaart.wereldVanLonLat(lng, lat) : wgsNaarRd(lat, lng); slepen(px, py, true); });
    handvatMarkers.push(m); };
  d.ankers.forEach((A, i) => {
    maak(A[0], A[1], 'spoor-anker', (x, y, eind) => { d.ankers[i] = [Math.round(x), Math.round(y)]; herteken(eind); });
    const h = handvatVan(d, i);
    maak(A[0] + h[0], A[1] + h[1], 'spoor-handvat', (x, y, eind) => { d.handvat[i] = [x - d.ankers[i][0], y - d.ankers[i][1]]; herteken(eind); });
  });
  let wacht = 0;
  function herteken(eind) { const nu = performance.now(); if (!eind && nu - wacht < 120) return; wacht = nu; if (eind) { spoorVoorstel(d); ververs(); } else { const c = spoorCurve(d); kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ll(c) } }] }); } }
}

function klik(px, py) {
  if (!spel) return;
  let x = kaart.wx(px), y = kaart.wy(py);
  if (tool === 'lijn' && bouw?.modus) {
    let c = dichtsteKandidaat(bouw.modus, px, py);
    if (!c && ['bus', 'hov', 'belbus', 'veer', 'watertaxi'].includes(bouw.modus)) {
      const h = nieuweHalte(x, y, bouw.modus === 'hov' || bouw.modus === 'belbus' ? 'bus' : bouw.modus, true);
      if (h) { c = { naam: h.naam, x: h.x, y: h.y, eigen: h.id }; melding(`Nieuwe halte ${h.naam} (${S.euro(HALTEKOSTEN[h.modus])}).`); }
    }
    if (!c) { melding(bouw.modus === 'trein' ? 'Hier is geen station. Bouw er een met ▣ Station, of klik dichter bij een station.' : 'Hier is geen halte voor deze modus. Klik dichter bij een halte.'); return; }
    if (bouw.punten.length && bouw.punten[bouw.punten.length - 1].naam === c.naam) return;
    // terug bij de eerste halte: rondlijn gesloten
    if (bouw.punten.length >= 3 && bouw.punten[0].naam === c.naam && !bouw.terugVan) { bouw.punten.push(bouw.punten[0]); bouw.rond = true; melding('Rondlijn gesloten.'); lijnKlaar(); return; }
    bouw.punten.push(c);
    return;
  }
  if (tool === 'halte') { nieuweHalte(x, y, halteSoort); return; }
  if (tool === 'station') {
    const max = 40 * kaart.res + 60, kt = net.dichtsteKnoop(x, y, 'trein', spel.jaar, max), km = net.dichtsteKnoop(x, y, 'metro', spel.jaar, max);
    const metro = km && km.t?.soort === 2 && (!kt || km.d < kt.d - 2) ? km : null, k = metro || kt;
    if (k == null) { melding('Klik op of vlak bij het spoor (trein of metro).'); return; }
    const pl = plaatsNaam(k.x, k.y);
    const combi = !!(kt && km && km.t?.soort === 2 && kt.t !== km.t && Math.hypot(kt.x - km.x, kt.y - km.y) < 80);
    openPaneel('nieuwStation', { x: Math.round(k.x), y: Math.round(k.y), naam: pl + (D.stations.some(s => s.n === pl) ? ' Zuid' : ''), plaats: pl, modus: metro ? 'metro' : 'trein', combiMogelijk: combi, soort: 'station' });
    return;
  }
  if (tool === 'perron') {
    // het dichtstbijzijnde treinstation binnen 600 m (of 40 pixels als je ver uitgezoomd bent)
    let c = null, bd = Math.max(600, 40 * kaart.res);
    for (const k of kandidaten('trein')) { const d = Math.hypot(k.x - x, k.y - y); if (d < bd) { bd = d; c = k; } }
    if (!c) { melding('Klik bij een treinstation.'); return; }
    perronOntwerpen(c.naam, c.x, c.y);
    return;
  }
  if (tool === 'spoor' && bouw) { bouw.punten.push({ x, y }); return; }
  if (tool === 'verdubbel') { verdubbelOntwerpen(x, y); return; }
  if (tool === 'kruising') { const r = net.dichtsteTak(x, y, 'trein', spel.jaar, 80); if (!r) { melding('Klik op het spoor bij een kruising of splitsing.'); return; }
    // dichtstbijzijnde knoop met 3 of meer takken (splitsing of kruising)
    let best = null; const gez = new Set();
    for (let i = Math.floor(x / 1000) - 1; i <= Math.floor(x / 1000) + 1; i++) for (let j = Math.floor(y / 1000) - 1; j <= Math.floor(y / 1000) + 1; j++) for (const t of net.tRaster.get(i + ',' + j) || []) for (const k of [t.a, t.b]) {
      if (gez.has(k) || t.dienst || t.soort !== 0) continue; gez.add(k);
      const n = (net.buren.get(k) || []).filter(b => !b.t.dienst).length, kx = net.knoopX(k), ky = net.knoopY(k), dd = Math.hypot(kx - x, ky - y);
      if (n >= 3 && (!best || dd < best.d)) best = { k, x: kx, y: ky, d: dd, n }; }
    if (!best || best.d > 400) { melding('Hier is geen kruising of splitsing in de buurt (binnen 400 m).'); return; }
    if ((spel.kruisingen || []).some(q => Math.hypot(q.x - best.x, q.y - best.y) < 150)) { melding('Deze kruising is al ongelijkvloers (of in aanbouw).'); return; }
    zetTool('kijk'); openPaneel('kruising', { x: best.x, y: best.y, takken: best.n }); return; }
  if (tool === 'busstation' && bouw?.bus) { const g = bouw.bus; const r = net.dichtsteTak(x, y, 'trein', spel.jaar, 400); let h = 0;
    if (r) { const a = net.stuk(r.t, Math.max(0, r.s - 30), Math.min(r.t.lengte, r.s + 30)); h = Math.atan2(a[a.length - 1] - a[1], a[a.length - 2] - a[0]); }
    // vlak aan een weg geklikt: busstation langs die weg, aan de kant waar geklikt is
    const w = wegBij(x, y, 35);
    if (w) { const nx = -w.uy, ny = w.ux, kant = Math.sign((x - w.x) * nx + (y - w.y) * ny) || 1; h = Math.atan2(w.uy, w.ux); x = Math.round(w.x + nx * kant * 9); y = Math.round(w.y + ny * kant * 9); }
    g.plek = { x, y, hoek: h }; zetTool('kijk'); busVoorstel(g); return; }
  if (tool === 'gebouw' && bouw?.gebouw) { const g = bouw.gebouw; const r = net.dichtsteTak(x, y, 'trein', spel.jaar, 300);
    let ux = 1, uy = 0; if (r) { const a = net.stuk(r.t, Math.max(0, r.s - 30), Math.min(r.t.lengte, r.s + 30)); ux = a[a.length - 2] - a[0]; uy = a[a.length - 1] - a[1]; const l2 = Math.hypot(ux, uy) || 1; ux /= l2; uy /= l2; }
    // langs het spoor zetten, met de lange kant evenwijdig, aan de kant waar geklikt is (ruimte voor een zijperron)
    if (r) { const st = STIJLEN.find(q => q.id === g.stijl) || STIJLEN[0], b = GROOTTE[g.grootte]?.b || 16, nx = -uy, ny = ux, kant = Math.sign((x - r.x) * nx + (y - r.y) * ny) || 1, af = b / 2 + 9 + (st.vorm === 'hal' ? b * 1.05 : 0);
      if (r.d < af + 40) { x = Math.round(r.x + nx * kant * af); y = Math.round(r.y + ny * kant * af); }
      if (kant > 0) { ux = -ux; uy = -uy; } } // voorkant (hal/perronkant) naar het spoor
    g.plek = { x, y, hoek: Math.atan2(uy, ux) }; zetTool('kijk'); gebouwVoorstel(g); return; }
  if (tool === 'lijnhalte' && bouw?.lijnId) { const l = lijnVan(bouw.lijnId), c = l && dichtsteKandidaat(l.modus, px, py); if (!c) { melding('Hier is geen station of halte van deze soort.'); return; } halteToevoegen(l, c); return; }
  // kijken: voertuig, eigen lijn of station selecteren
  let beste = null, bd = 12;
  for (const v of zichtLijnen) { const d = Math.hypot(v.px - px, v.py - py); if (d < bd) { bd = d; beste = v; } }
  if (beste) { openRit(beste); return; }
  for (const l of spel.lijnen) {
    const pts = l.route.pts;
    for (let i = 2; i < pts.length; i += 2) {
      if (Math.abs(pts[i] - x) > 3000 && Math.abs(pts[i - 2] - x) > 3000) continue;
      const [ax, ay] = kaart.scherm(pts[i - 2], pts[i - 1]), [bx, by] = kaart.scherm(pts[i], pts[i + 1]);
      if (afstandTotLijnstuk(px, py, ax, ay, bx, by) < 6) { selectie = { lijn: l }; openPaneel('lijn', l); return; }
    }
  }
  const st = dichtsteKandidaat('trein', px, py, 10);
  if (st) { openPaneel('station', { naam: st.naam, p: st.p, eigen: !!st.eigen, x: st.x, y: st.y }); return; }
  // op het spoor geklikt: baanvak met spanning en eigenschappen
  const r = ['trein', 'metro', 'tram'].map(m => net.dichtsteTak(x, y, m, spel.jaar, 8 * kaart.res + 4)).filter(Boolean).sort((a, b) => a.d - b.d)[0];
  if (r) openPaneel('spoorvak', { ti: r.t.i });
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
    zetPlaatsen(jaar);
    const lijnen = await genereerVervoerder(v, jaar, D, net, D.plaatsen);
    noemOud(lijnen, jaar);
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
      if (!AI.geladen.has(v.id)) { await laadVervoerderLijnen(v, spel.aiVerschuiving); nieuweStationsInAI(v.id); for (const a of AI.lijnen) if (a.vervoerder === v.id && spel.aiWacht?.[a.sleutel] && !a.dw) for (const [i, m] of Object.entries(spel.aiWacht[a.sleutel])) aiWachtToepassen(a, +i, m); }
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
    const { cum, km, t, tr, vertrek, _vangst, _spoor, _altD, _typ, _banen, _banenVan, _tunnel, _tunnelVan, _trolley, _ontwerp, _sam, _eff, _halteTijd, _vorigeTr, trMin, _vraag, _vraagDag, _omloopN, bbox, nodig, duur, lengteKm, stat, bezetting, ...rest } = l;
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
    catch (e) { if (hand) melding('Online opslaan mislukte: ' + (e.code === 'permission-denied' ? 'de database-regels voor OV-manager staan nog niet in Firebase.' : e.message)); }
  } else if (hand) melding(lokaal ? 'Opgeslagen in deze browser. Log in om op elk apparaat verder te spelen.' : 'Opslaan in de browser lukte niet.');
}
async function laadSpel(data, nieuwSlot) {
  spel = data; slot = nieuwSlot;
  zetJaar(spel.jaar); spel.series = spel.series || []; registreerSeries(spel.series); zetKlassePrijzen(spel.klassePrijs);
  for (const l of spel.lijnen) samenstellingVan(l.typeId); // samengestelde treinen opnieuw aanmaken
  for (const id of spel.samenstellingen || []) samenstellingVan(id);
  // oude genummerde haltes ("Plaats, Halte 3") krijgen hun echte naam, ook in de lijnen die er stoppen
  for (const h of spel.haltes || []) {
    if (!/, (Halte|Steiger) \d+$/.test(h.naam)) continue;
    const oud = h.naam; h.naam = '~'; const nieuw = halteNaam(h.x, h.y, h.modus); h.naam = /, (Halte|Steiger) \d+$/.test(nieuw) ? oud : nieuw;
    if (h.naam !== oud) for (const l of spel.lijnen) for (const lh of l.haltes) if (lh.naam === oud && Math.hypot(lh.x - h.x, lh.y - h.y) < 30) lh.naam = h.naam;
  }
  for (const l of spel.lijnen) {
    if (l.inrichting) { // oude opslag: interieur stond bij de lijn; prijzen en catering blijven daar, het interieur hoort nu bij het materieel
      l.prijzen = Object.fromEntries(l.inrichting.map(k => [k.klasse, k.prijs ?? 1]));
      l.catering = Object.fromEntries(l.inrichting.map(k => [k.klasse, k.extra === 'massage' ? 3 : k.extra === 'catering' ? 2 : 0]));
      delete l.inrichting;
    }
    if (l.route?.d) l.route = { pts: pakUit(l.route.d), lengte: l.route.lengte, minSporen: l.route.minSporen, weg: l.route.weg, rechtLijnig: l.route.rechtLijnig };
    if (l.bron && !l.route) {
      const v = D.vervoerders.find(x => x.id === l.bron.vervoerder);
      if (v) { const ai = await laadVervoerderLijnen(v); const a = ai.find(x => x.lijnId === l.bron.lijnId && x.sleutel.endsWith(':0')); if (a) vulVanAI(l, a, ai); }
    }
    if (l.route) S.herbereken(l);
  }
  spel.lijnen = spel.lijnen.filter(l => l.route);
  if (spel.vervoerder) AI.lijnen = AI.lijnen.filter(x => x.vervoerder !== spel.vervoerder.id);
  for (const s of spel.spoor) if (s.klaar) { net.voegEigenSpoorToe(s.punten, s.eigenaar, s.sporen + (s.extraSporen || 0), spel.jaar, s.soort || 0, s.dienst || 0); if (s.verdubbelt != null && net.takken[s.verdubbelt]) net.takken[s.verdubbelt].sporen = s.nieuwSporen || 2; }
  for (const b of spel.bovenleiding || []) if (b.klaar) bovenleidingToevoegen(b.punten);
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
  const naam = $('s-naam').value.trim() || 'Mijn OV-bedrijf';
  let vervoerder = null, hist = null;
  if (soort === 'bestaand') {
    const keuze = document.querySelector('input[name="vervoerder"]:checked')?.value || '';
    const i = keuze.indexOf(':'), bron = keuze.slice(0, i), id = keuze.slice(i + 1); // id kan zelf ':' bevatten (IFF:NS)
    if (bron === 'gtfs') vervoerder = D.vervoerders.find(v => v.id === id);
    if (bron === 'hist') hist = vervoerdersIn(jaar).find(v => v.id === id);
    if (!vervoerder && !hist) { melding('Kies eerst een vervoerder.'); return; }
  }
  $('s-start').disabled = true; $('s-start').textContent = 'Bezig…';
  zetJaar(jaar); registreerSeries([]); zetKlassePrijzen(null);
  spel = S.nieuwSpel({ naam: vervoerder?.naam || hist?.naam || naam, kleur: $('s-kleur').value || hist?.kleur, jaar, start: soort, vervoerder: vervoerder ? { id: vervoerder.id, naam: vervoerder.naam } : hist ? { id: hist.id, naam: hist.naam, hist: true } : null, kapitaal: +($('s-kapitaal')?.value || 200e6) });
  if (hist) {
    zetPlaatsen(jaar);
    const lijnen = await genereerVervoerder(hist, jaar, D, net, D.plaatsen, t => { $('s-start').textContent = t; });
    noemOud(lijnen, jaar);
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
      const lijn = S.maakLijn(spel, { nr: a.nr, naam: a.naam, modus, typeId: typeVoor({ ...a, typeId: null, _typ: null }, spel.jaar, standaardType) || S.standaardTypeVoor(spel, modus), haltes: l.haltes, route: l.route, concessie: true });
      if (modus === 'trein') { lijn.spitsDubbel = true; S.herbereken(lijn); } // zoals in het echt: in de spits gekoppeld
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
// haltenamen van nagebouwde lijnen: de naam die het station in dat jaar had
function noemOud(lijnen, jaar) {
  const per = new Map(D.stations.map(st => [st.n, st]));
  for (const l of lijnen) for (const h of l.haltes) { const st = per.get(h.naam); h.naam = stationsnaam(h.naam, jaar, st?.oud || []); }
}
// plaatsen in een polder ontstonden een paar jaar na de drooglegging (Emmeloord 1943, Lelystad 1967, Almere 1976)
function zetPlaatsen(jaar) { D.plaatsen = (D.plaatsenAlle || []).filter(p => !p.land || p.land + 6 <= jaar); }
function begin() {
  $('start').close();
  kaart.jaar = spel.jaar;
  zetPlaatsen(spel.jaar);
  $('b-bedrijf').hidden = false; $('b-naam').textContent = spel.naam; $('b-kleur').style.background = spel.kleur;
  spel._weekend = undefined; dienstVoorDag();
  // historische jaren: standaard de echte kaart van dat jaar (Kadaster-tijdreiskaart) als ondergrond, zodat
  // bebouwing, wegen, heide en water kloppen met de tijd; de moderne bebouwing valt eronder weg
  const ag = spel.achtergrond || (spel.jaar < 2015 && !D.bebouwing ? 'historisch' : 'eigen'); // met BAG-bebouwing: eigen thema per jaar
  if (kaart.achtergrond !== ag) { kaart.zetAchtergrond(ag); $('bron').textContent = ACHTERGROND_KEUZE[ag]?.bron || ''; }
  for (const l of spel.lijnen) stroomBijwerken(l);
  for (const l of spel.lijnen) if (l.wacht === 'pad') { l.wacht = null; l.actief = true; l.paden = Math.ceil(60 / Math.min(...Object.values(l.interval))); } // spoorruimte krijg je nu altijd
  aanbiedingenAanvullen(); aanbiedingenToetsen();
  for (const l of spel.lijnen) if (l.bijzonder) bijzonderBijwerken(l); // vertrektijden worden niet opgeslagen
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
  kaart = new Kaart($('kaart'));
  kaart.bijKlaar = () => netwerkLagen();
  kaart.lagenBoven.push(tekenBoven);
  kaart.bijKlik = klik;
  kaart.map.on('dragstart', () => { if (volg) { volg = null; melding('Volgen gestopt.'); if (paneelSoort === 'rit') ververs(); } });
  kaart.bijBeweeg = (px, py) => { if (bouw?.punten?.length) bouw.muis = [px, py]; snapTonen(px, py); };
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
    if (e.key === ' ') { e.preventDefault(); zetTijd(!tijdLoopt); }
    if (e.key === 'Escape') { zetTool('kijk'); sluitPaneel(); }
  });
  $('b-account').onclick = () => toonStart();
  $('b-muziek').onclick = e => { const b = e.currentTarget; if (muziekSpeelt()) muziekUit(); else muziekAan();
    const aan = muziekSpeelt(); b.setAttribute('aria-pressed', aan); b.title = aan ? 'Muziek uitzetten' : 'Muziek aanzetten'; };
  $('start').addEventListener('cancel', e => { if (!spel) e.preventDefault(); });
  addEventListener('visibilitychange', () => { if (document.hidden) bewaar(); });
  zetSnelheid(5);
  $('b-tijdknop').onclick = () => zetTijd(!tijdLoopt);
  Cloud.bijInlog(u => { $('b-account').textContent = u ? (u.displayName || u.email || 'Account').split(' ')[0] : 'Inloggen'; if ($('start').open) toonAccount(); });
  Cloud.start().catch(() => {});
  toonStart();
  laadData().then(() => { if ($('start').open) toonStart(); });
  requestAnimationFrame(lus);
}
function zetTijd(aan) { tijdLoopt = aan; $('b-tijdknop').setAttribute('aria-pressed', String(aan)); $('b-tijdstand').textContent = aan ? '▶' : '❚❚'; }
function zetSnelheid(s) { if (!s) return zetTijd(false); snelheid = s; zetTijd(true); document.querySelectorAll('.snelheid button').forEach(b => b.classList.toggle('aan', +b.dataset.s === s)); }

init();
