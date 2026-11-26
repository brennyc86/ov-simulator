// OV-manager — opstarten, kaartlagen, gereedschap, spellus en panelen.
import { Kaart } from './kaart.js';
import { zetKaartjaren, kaartjaarVoor, rdNaarWgs, wgsNaarRd } from './geo.js';
import { netKleuren, spoorLagen, SPOOR_UIT, meters, THEMA } from './stijl.js';
import { Wegen } from './wegen.js';
import { bedenkAanbieding, zetTreinGebied, treinMogelijk, bedient, toetsEisen, eisenTekst, vergoedingTekst, ramingTekst, subsidieNiveau, opheffingAanbieding, redenTekst } from './subsidie.js';
import { STIJLEN, GROOTTE, stijlenVoor, gebouwPrijs, winkelHuur, plattegrond } from './gebouw.js';
import { busstationOntwerp } from './perron.js';
import { prestaties, vermogen, massa, doorloop } from './techniek.js';
import { schets, aandrijving } from './schets.js';
import { tonTerug, vrachtTypeIdMix, vergoedingRetour, vrachtRijtijd, vensterVan, PLEKKEN, vrachtNiveau, VENSTER, FREQ, nodigKw, refLocs, vergoeding, bedenkAanvraag, vrachtTypeId, locsNodig, isVrachtLoc } from './vracht.js';
import { marktStart, STAAT, marktPrijs, marktBijwerken, koopVanMarkt, renovatieKosten, renovatieDagen, inzetbaar, buitenDienst, wachtOpRevisie, startRevisie, renovatiesAfronden } from './markt.js';
import { perronVanaf } from './correcties.js';
import { SYSTEMEN, spanningVan, systemenVoorSoort, spanningenVan, kanOp, stroomCheck, baanvak, ombouwKostenStroom, landVerdeling, wisselsPerRit, WISSEL_MIN, wisselTakken, bovenleidingKlasse, BOVENLEIDING_NAAM } from './stroom.js';
import { LANDEN } from './schets.js';
import { Perrons, ontwerpPerron, ontwerpVerdubbeling, ontwerpStation, doorsnedeTekst, binnen, perronLangs } from './perron.js';
import { lijnOpSpoor, rijBanen } from './spoorvolg.js';
import { maakOmloop, voertuigenOmloop, Opstel } from './omloop.js';
import { planAlles, stationZoeker, stationVinder, zoekAfstemming } from './spoorplan.js';
import { vluchtRoute } from './vlucht.js';
import { laad } from './laadscherm.js';
import { ritReizigers, bezettingKlassen } from './reizigers.js';
import { museumTypen, museumPrijs, isMuseum, gewonePrijs, belangstelling, inschrijvingen, vertrekOpDag, ritKosten, bedenkCharter, rittenVan, rijdtOp, aantalRitten, pendel } from './bijzonder.js';
import { kortNaam, stoelNaam, SLAAP, nieuwSlaapDeel, interieurMeerprijs, inrichtingVan, klassenVan, vraagEffect, ombouwKosten, standaardInrichting, serieInrichting, BEEN, STOEL, CATERING, VOORZ, REST, KLASSEN, KLASSE_NAAM, kenmerk, registreerSeries, serieNaamVoorstel, zelfdeInterieur, basisId, uurKosten, wagonsVan, plaatsenPerWagon, voorzieningen, voorzMag, zetKlassePrijzen, klassePrijs, samenstelling, samenstellingVan, nodigPer, nodigLijn, delenVan, restauratieOpen, zetJaar, STROOM, stroomMag, maxBreed } from './comfort.js';
import { uiterlijk, typeVoor, huiskleur, schemaLengte, tekenEcht, bakkenVan, vervoerderKleur, dof, tekenIcoon } from './voertuig.js';
import { Net, wegRoute, bboxVan, BEHEERDER } from './net.js';
import { MODI, VLOOT, TYPE, beschikbaar, beschikbaarLos, standaardType } from './vloot.js';
import * as S from './spel.js';
import { heeftMix, vrijVoor, verdeling, nodigOp, hoofdType, typeBijRit, mixUitOud, ROLLEN, toegewezen } from './mix.js';
import { AI, laadVervoerderLijnen, nieuwVerzoek, beoordeelVerschuiving, beoordeelAanpassing, beoordeelPad, beoordeelBouw, beoordeelConcessie, beoordeelSubsidie,
  bedenkAIVerzoek, beoordeelTegenOpAI, gedeeldeHaltes, overstappen } from './ai.js';
import * as Cloud from './cloud.js';
import { muziekAan, muziekUit, muziekSpeelt, zetLiedje, LIEDJES } from './muziek.js';
import { Territorium, gebied as gebiedVlak, binnen as gebiedBinnen } from './territorium.js';
import { vervoerdersIn, gebiedVan, stationsnaam, LIJNJAREN, LIJNJAREN_DEEL } from './historie.js';
import { genereerVervoerder } from './genereer.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const D = { stations: [], wissels: [], plaatsen: [], veren: [], haltes: [], vervoerders: [], vliegvelden: [], dag: '', ok: {} };
let net = new Net(null), kaart, spel = null, snelheid = 5, tijdLoopt = true, tool = 'kijk', slot = null, paneelSoort = null;
let bouw = null, selectie = null;

// ---------------------------------------------------------------- data laden
const laadTel = { klaar: 0, totaal: 18 };
async function json(pad) {
  try { const r = await fetch(pad, { cache: 'no-cache' }); if (!r.ok) throw 0; D.ok[pad] = true; return await r.json(); }
  catch { D.ok[pad] = false; return null; }
  finally { laadTel.klaar++; laad.zet(laadTel.klaar / laadTel.totaal * 0.85, `Kaartgegevens laden (${laadTel.klaar} van ${laadTel.totaal})`); }
}
// versie van het spel (versie.json wordt bij publiceren geschreven): rechtsonder en in het startscherm
fetch('versie.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null).then(v => {
  const t = v ? `versie ${v.versie} · ${v.datum} · ${v.commit}` : 'lokale versie (niet gepubliceerd)';
  const el = document.getElementById('versie'); if (el) { el.textContent = t; if (v?.wijziging) el.title = 'Laatste wijziging: ' + v.wijziging; }
  const st = document.getElementById('s-versie'); if (st) st.textContent = 'Spel ' + t + (v?.wijziging ? ` — laatste wijziging: ${v.wijziging}` : '');
});
// openingsjaren en dergelijke voor (nieuw geladen) spoortakken: polders, lijnen zonder startdatum, naamloze stukjes
function takkenBijwerken(takken) {
  // spoor en stations in polders bestonden pas na de drooglegging
  for (const t of takken) {
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
  for (let ronde = 0; ronde < 4; ronde++) for (const t of takken) {
    if (t.start || t.soort > 4) continue;
    const buren = [...(net.buren.get(t.a) || []), ...(net.buren.get(t.b) || [])].filter(b => b.t !== t).map(b => b.t);
    if (buren.length && buren.every(b => b.start)) t.start = Math.min(...buren.map(b => b.start));
  }
}
// openingsjaar van stations: niet eerder dan het land (polders) en het oudste spoor ernaast (opnieuw na het laden van een deel)
function stationsJaren(lijst) {
  for (const st of lijst) {
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
}
async function laadData() {
  // spoornet per provincie (data/spoor/index.json): pas bij de start van een spel laden wat nodig is; anders het hele net
  D.spoorIndex = (await json('data/spoor/index.json'))?.delen || null;
  const [spoor, st, w, pl, ve, ha, vv, hi, vl, pr] = await Promise.all([D.spoorIndex ? null : 'data/spoor.json', 'data/stations.json', 'data/wissels.json',
    'data/plaatsen.json', 'data/veren.json', 'data/haltes.json', 'data/vervoerders.json', 'data/historie.json', 'data/vliegvelden.json', 'data/perrons.json'].map(p => p ? json(p) : Promise.resolve(null)));
  const [po, hs, tr, sg, bb, vz, gz] = await Promise.all(['data/polders.json', 'data/historisch.json', 'data/trolley.json', 'data/stationsgebouwen.json', 'data/bebouwing.json', 'data/voorzieningen.json', 'data/grenzen.json'].map(json));
  D.grenzen = gz; // land, provincie, regio en gemeente (voor het territorium en het kiezen van een lege regio)
  // bestemmingen (musea, zwembaden, winkelcentra ...) voor de kaart en voor opdrachten
  D.voorz = (vz?.v || []).map(([n, x, y, k]) => ({ n, x, y, s: vz.soorten[k] })).filter(v => v.s !== 'bedrijventerrein');
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
  laad.zet(0.88, 'Spoornet opbouwen'); await new Promise(r => setTimeout(r, 0));
  net = new Net(spoor); S.zetNet(net); S.zetStopZoeker(stopPlekken);
  takkenBijwerken(net.takken);
  // verdwenen lijnen (OpenHistoricalMap) berijdbaar maken in hun eigen jaren
  net.voegHistorischToe((D.historisch.l || []).map(r => ({ soort: r[0], van: r[1] || 1800, tot: r[2], pts: ontpak(r.slice(4)) })));
  D.stations = perronsSamen(st?.stations || []);
  stationsJaren(D.stations);
  D.wissels = w?.wissels || [];
  D.plaatsenAlle = (pl?.plaatsen || []).filter(p => (p[5] || 'NL') === 'NL'); // Caribisch Nederland volgt met de wereldkaart
  for (const p of D.plaatsenAlle) p.land = landSinds(p[1], p[2]);
  D.plaatsen = D.plaatsenAlle; S.zetPlaatsenVoorSnelheid(D.plaatsenAlle);
  D.veren = ve?.veren || [];
  D.haltes = ha?.haltes || [];
  AI.haltes = D.haltes;
  D.halteGroepen = groepeerHaltes(D.haltes);
  vliegveldKnopen();
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
  if (t.gebruik === 2 && (t.soort === 0 || t.soort === 4)) return 'goed'; // industrie- en havenspoor
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

let lagenGemaakt = false, wisselCache = null;
const PASSAGIER = '#2f9e44', VRACHT = '#f2c200';
// bestemmingen op de kaart: kleur en naam per soort (scholen pas ver ingezoomd)
const VOORZ_SOORT = { museum: ['#8e44ad', 'Museum'], zwembad: ['#1e88e5', 'Zwembad'], winkelcentrum: ['#ef6c00', 'Winkelcentrum of winkelgebied'], dierentuin: ['#2e7d32', 'Dierentuin'],
  pretpark: ['#00a884', 'Pretpark'], attractie: ['#00897b', 'Bezienswaardigheid'], stadion: ['#c62828', 'Stadion'], theater: ['#d81b60', 'Theater of bioscoop'], ziekenhuis: ['#e53935', 'Ziekenhuis'],
  hogeschool: ['#5e35b1', 'Hogeschool of universiteit'], gemeentehuis: ['#6d4c41', 'Gemeentehuis'], school: ['#8d8d8d', 'School'] };
// ---------------------------------------------------------------- legenda (zelfde kleuren en patronen als op de kaart)
function legendaHTML() {
  const S = NK.spoor, w = '#ffffff';
  const lijnSvg = (...l) => `<svg width="46" height="12" aria-hidden="true">${l.map(([kl, br, extra = '']) => `<line x1="2" y1="6" x2="44" y2="6" stroke="${kl}" stroke-width="${br}" stroke-linecap="round" ${extra}/>`).join('')}</svg>`;
  const stip = (kl, r, rand = '#fff') => `<svg width="46" height="16" aria-hidden="true"><circle cx="23" cy="8" r="${r}" fill="${kl}" stroke="${rand}" stroke-width="1.5"/></svg>`;
  const rij = (svg, t) => `<tr><td>${svg}</td><td>${t}</td></tr>`;
  return `<table class="tabel legenda">
    <tr><th colspan="2">Spoor (dikte = aantal sporen)</th></tr>
    ${rij(lijnSvg([S, 1.6], [w, 0.8, 'stroke-dasharray="1 4"']), 'Enkelspoor')}
    ${rij(lijnSvg([S, 2.6]), 'Dubbelspoor')}
    ${rij(lijnSvg([S, 3.6]), 'Drie of meer sporen')}
    ${rij(lijnSvg([NK.zij, 1]), 'Opstel- en rangeersporen')}
    ${rij(lijnSvg(['#c79a00', 1.6]), 'Goederen-, haven- en industriespoor')}
    <tr><th colspan="2">Stroom en snelheid</th></tr>
    ${rij(lijnSvg([S, 2.6]), 'Bovenleiding (gewone spanning van het land)')}
    ${rij(lijnSvg([S, 2.6, 'stroke-dasharray="5 3.5" stroke-linecap="butt"']), 'Geen bovenleiding (diesel, stoom, accu)')}
    ${rij(lijnSvg([S, 5.2], [w, 1.6]), '<b>Hogesnelheidslijn</b> — breedste lijn, witte middenlijn')}
    ${rij(lijnSvg([S, 2.6], [w, 1, 'stroke-dasharray="6 3 0 3"']), 'Loc-wisselspoor: twee spanningen (grensstation)')}
    ${rij(lijnSvg([S, 2.6], [w, 1.4, 'stroke-dasharray="0 4"']), 'Vreemde spanning (bv. 3 kV naar België, 25 kV Betuweroute)')}
    ${rij(lijnSvg([S, 2.6], ['#f4f1ea', 1.4, 'stroke-dasharray="3 3" stroke-linecap="butt"']), 'Tunnel (onderbroken door lichte streepjes)')}
    <tr><th colspan="2">Ander railvervoer en veren</th></tr>
    ${rij(lijnSvg([NK.metro, 2.4]), 'Metro')}
    ${rij(lijnSvg([NK.snel, 2.2]), 'Sneltram')}
    ${rij(lijnSvg([NK.tram, 1.6]), 'Tram')}
    ${rij(lijnSvg([NK.smal, 1.4]), 'Smalspoor')}
    ${rij(lijnSvg(['#3c4147', 0.7, 'transform="translate(0 -1.5)"'], ['#3c4147', 0.7, 'transform="translate(0 1.5)"']), 'Trolleybus-bovenleiding')}
    ${rij(lijnSvg([NK.veer, 1.8, 'stroke-dasharray="6 5"']), 'Veerverbinding')}
    ${rij(lijnSvg([NK.oud, 1.6, 'stroke-dasharray="6 4"']), 'Opgeheven spoor (historisch)')}
    <tr><th colspan="2">Jouw bedrijf</th></tr>
    ${rij(lijnSvg([spel?.kleur || '#c2412d', 3.4]), 'Eigen spoor')}
    ${rij(lijnSvg([spel?.kleur || '#c2412d', 3.4, 'stroke-dasharray="5 5" stroke-linecap="butt"']), 'Eigen spoor in aanbouw')}
    ${rij(lijnSvg([w, 6], [spel?.kleur || '#c2412d', 3.5]), 'Eigen lijn (in de lijnkleur)')}
    <tr><th colspan="2">Stippen</th></tr>
    ${rij(stip(PASSAGIER, 6), 'Treinstation (groen = reizigers; groter = groter station)')}
    ${rij(stip(PASSAGIER, 3.2), 'Metro-, tram- en bushalte (kleiner)')}
    ${rij(stip(VRACHT, 5, '#5a4300'), 'Overslagpunt voor goederen (haven, terminal)')}
    <tr><th colspan="2">Bestemmingen (opdrachten om ze bereikbaar te maken)</th></tr>
    ${Object.values(VOORZ_SOORT).map(([kl, n]) => rij(stip(kl, 4.5, '#fff'), n)).join('')}
    ${rij(`<svg width="46" height="12" aria-hidden="true"><rect x="20" y="3" width="6" height="6" fill="#e0a516"/></svg>`, 'Wissel (ver ingezoomd)')}
  </table>`;
}
function legendaKaart(open) {
  const el = document.getElementById('legenda'), kn = document.getElementById('b-legenda'); if (!el || !kn) return;
  if (open === undefined) open = el.hidden;
  el.hidden = !open; kn.setAttribute('aria-pressed', String(open));
  if (open) el.innerHTML = `<div class="legenda-kop"><b>Legenda</b><button type="button" class="sluit" aria-label="Legenda sluiten" data-legenda-dicht>×</button></div>${legendaHTML()}`;
  try { localStorage.setItem('ov_legenda', open ? '1' : '0'); } catch {}
}
// vaste kaartlagen hoeven maar één keer omgerekend te worden (niet bij elke geladen provincie opnieuw)
const lagenCache = new Map();
const eenmalig = (k, maak) => { if (!lagenCache.has(k)) lagenCache.set(k, maak()); return lagenCache.get(k); };
function netwerkLagen() {
  if (!kaart?.klaar) return;
  const jaar = spel?.jaar ?? 2026;
  const wissel = wisselCache = wisselTakken(spel, net);
  const sporen = { type: 'FeatureCollection', features: [...net.takken, ...net.eigen].filter(t => !t.weg).map(t => {
    const j = jaarVan(t), m = t.pts.length >> 2 << 1, land = landSinds(t.pts[m], t.pts[m + 1]);
    if (land > j.van) j.van = land; // in een polder: pas na de drooglegging
    return { type: 'Feature', properties: { k: klasseVan(t), ...j, n: t.sporen, h: t.hoogte || 0, e: bovenleidingKlasse(spel, t, wissel) ?? -1 }, geometry: { type: 'LineString', coordinates: t._llVan === t.pts ? t._ll : (t._llVan = t.pts, t._ll = lijnGeo(t.pts)) } }; // omrekenen eenmalig per tak
  }) };
  // (verdwenen lijnen uit OpenHistoricalMap zitten als takken in het net en worden hierboven al meegenomen)
  kaart.bron('spoor', sporen);
  kaart.bron('trolley', eenmalig('trolley', () => ({ type: 'FeatureCollection', features: (D.trolley || []).map(p => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: lijnGeo(p) } })) })));
  kaart.bron('veren', eenmalig('veren', () => ({ type: 'FeatureCollection', features: D.veren.map(v => ({ type: 'Feature', properties: { n: v.n }, geometry: { type: 'LineString', coordinates: lijnGeo(v.c) } })) })));
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
  const pfBasis = eenmalig('perrons:' + D.perrons.lijst.length, () => D.perrons.geojson(lonlat)), pf = { ...pfBasis, features: [...pfBasis.features] }; // OSM-perrons eenmalig omrekenen
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
  kaart.bron('polders', eenmalig('polders', () => ({ type: 'FeatureCollection', features: (D.polders || []).map(p => ({ type: 'Feature', properties: { j: p.j, n: p.n }, geometry: { type: 'Polygon', coordinates: p.ringen.map(lijnGeo) } })) })));
  // één stip per halte (alle perrons samen); een halte met een tramperron is een tramhalte (iets groter)
  kaart.bron('haltes', eenmalig('haltes', () => ({ type: 'FeatureCollection', features: (D.halteGroepen || []).filter(g => g.modi & (8 | 16 | 32) && !g.vliegveld).map(g => ({ type: 'Feature', properties: { n: g.naam, veer: g.modi & 16 ? 1 : 0, tram: g.modi & 4 ? 1 : 0, p: g.perrons.length }, geometry: { type: 'Point', coordinates: lonlat(g.x, g.y) } })) })));
  kaart.bron('vliegvelden', eenmalig('vliegvelden', () => ({ type: 'FeatureCollection', features: D.vliegvelden.map(v => ({ type: 'Feature', properties: { n: v.n, l: `${v.n}${v.baan ? ` · ${v.baan} m${v.verhard ? '' : ' gras'}` : ''}`, groot: v.baan >= 1800 ? 1 : 0, van: v.b || 0, tot: 9999, mil: v.s === 'militair' ? 1 : 0 }, geometry: { type: 'Point', coordinates: lonlat(v.kx ?? v.x, v.ky ?? v.y) } })) })));
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
    lijn('net-goed', 'spoor', ['all', k('goed'), jaarFilter(jaar)], '#c79a00', zoomB(0.3, 1.1, 1.8), {}); // goederen-, haven- en industriespoor: geel
    lijn('net-tram', 'spoor', ['all', k('tram'), jaarFilter(jaar)], NK.tram, zoomB(0.4, 1.2, 2.2));
    lijn('net-smal', 'spoor', ['all', k('smal'), jaarFilter(jaar)], NK.smal, zoomB(0.8, 1.2, 2));
    lijn('net-snel', 'spoor', ['all', k('snel'), jaarFilter(jaar)], NK.snel, zoomB(1, 2, 3));
    lijn('net-metro', 'spoor', ['all', k('metro'), jaarFilter(jaar)], NK.metro, zoomB(1, 2.2, 3.2));
    // hoofdspoor: dikte naar aantal sporen; vanaf zoom 15 is elk spoor apart getekend (OSM) en schaalt de lijn mee met
    // de echte spoorbreedte (~2,6 m met dwarsliggers), zodat sporen op 4,5 m van elkaar niet over elkaar vallen
    const hoofd = ['all', ['match', ['get', 'k'], ['h1', 'h2', 'h3'], true, false], jaarFilter(jaar)];
    lijn('net-hoofd-halo', 'spoor', hoofd, NK.halo, ['interpolate', ['exponential', 2], ['zoom'], 6, ['match', ['get', 'k'], 'h3', 4.5, 'h2', 3.5, 2.6], 13, ['match', ['get', 'k'], 'h3', 6, 'h2', 5, 3.6], 15, 2.6, 16, 3, 19, 20]);
    lijn('net-hoofd', 'spoor', ['all', hoofd, ['!=', ['get', 'e'], 0]], NK.spoor, ['interpolate', ['exponential', 2], ['zoom'], 6, ['match', ['get', 'k'], 'h3', 2.6, 'h2', 1.8, 1.1], 13, ['match', ['get', 'k'], 'h3', 3.6, 'h2', 2.8, 1.6], 15, 1.2, 16, 1.8, 19, 14]);
    // bovenleiding als patroon (dikte = aantal sporen, kleur = eigenaar): zonder bovenleiding gestreept,
    // hogesnelheidslijn met een witte middenlijn, loc-wisselspoor met wit streep-punt, vreemde spanning met witte stippen
    const hoofdBreed = ['interpolate', ['exponential', 2], ['zoom'], 6, ['match', ['get', 'k'], 'h3', 2.6, 'h2', 1.8, 1.1], 13, ['match', ['get', 'k'], 'h3', 3.6, 'h2', 2.8, 1.6], 15, 1.2, 16, 1.8, 19, 14];
    lijn('net-hoofd-geen', 'spoor', ['all', hoofd, ['==', ['get', 'e'], 0]], NK.spoor, hoofdBreed, { 'line-dasharray': [2.2, 1.4] });
    // hogesnelheidslijn: breder dan gewoon spoor (zwaarste lijn op de kaart) met een duidelijke witte middenlijn
    lijn('net-hsl-basis', 'spoor', ['all', hoofd, ['==', ['get', 'e'], 2]], NK.spoor, ['interpolate', ['linear'], ['zoom'], 6, ['match', ['get', 'k'], 'h3', 5, 'h2', 4.2, 3.2], 13, ['match', ['get', 'k'], 'h3', 7, 'h2', 6.2, 5], 16, 2.6], {});
    lijn('net-hsl', 'spoor', ['all', hoofd, ['==', ['get', 'e'], 2]], '#ffffff', ['interpolate', ['linear'], ['zoom'], 6, 1.2, 13, 2, 16, 0.9], {});
    kaart.laag({ id: 'net-locwissel', type: 'line', source: 'spoor', filter: ['all', hoofd, ['==', ['get', 'e'], 3]], layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.6, 13, 1, 16, 0.8], 'line-dasharray': [2.5, 1.5, 0, 1.5], 'line-opacity': SPOOR_UIT } });
    lijn('net-vreemd', 'spoor', ['all', hoofd, ['==', ['get', 'e'], 4]], '#ffffff', ['interpolate', ['linear'], ['zoom'], 6, 0.9, 13, 1.5, 16, 1.1], { 'line-dasharray': [0, 1.6] });
    lijn('net-enkel', 'spoor', ['all', k('h1'), jaarFilter(jaar)], NK.halo, ['interpolate', ['linear'], ['zoom'], 6, 0.5, 13, 0.8, 16, 0], { 'line-dasharray': [1, 3] });
    // ondergronds (tunnel): de lijn wordt onderbroken door lichte streepjes, zodat zichtbaar is dat het spoor onder de grond ligt
    lijn('net-tunnel', 'spoor', ['all', ['==', ['coalesce', ['get', 'h'], 0], -1], ['!=', ['get', 'k'], 'oud'], ['!=', ['get', 'k'], 'zij'], jaarFilter(jaar)], '#f4f1ea',
      ['interpolate', ['linear'], ['zoom'], 9, 0.8, 13, 1.6, 15, 2], { 'line-dasharray': [1.2, 1.2], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0, 10, 0.9, 14.6, 0.9, 15.6, 0] });
    // eigen spoor: uitgezoomd in de bedrijfskleur, ingezoomd zie je de rails (die zitten in de gewone spoorlaag)
    lijn('net-eigen-spoor', 'eigen-spoor', ['==', ['get', 'klaar'], 1], spel?.kleur || '#c2412d', zoomB(2, 3, 4), { 'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 13.5, 0] });
    lijn('net-eigen-bouw', 'eigen-spoor', ['==', ['get', 'klaar'], 0], spel?.kleur || '#c2412d', zoomB(2, 3, 4), { 'line-dasharray': [2, 2] });
    lijn('net-lijnen-halo', 'eigen-lijnen', null, '#ffffff', zoomB(4, 6, 9), { 'line-opacity': 0.75 });
    lijn('net-lijnen', 'eigen-lijnen', null, ['get', 'kl'], zoomB(2, 3.5, 6));
    kaart.laag({ id: 'net-wissels', type: 'circle', source: 'wissels', minzoom: 15, paint: { 'circle-radius': 2.4, 'circle-color': '#e0a516' } });
    kaart.laag({ id: 'net-haltes', type: 'circle', source: 'haltes', minzoom: 13.5, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, ['case', ['any', ['==', ['get', 'veer'], 1], ['==', ['get', 'tram'], 1]], 3.2, 2.2], 18, ['case', ['any', ['==', ['get', 'veer'], 1], ['==', ['get', 'tram'], 1]], 6, 4.5]], 'circle-color': PASSAGIER, 'circle-stroke-color': '#fff', 'circle-stroke-width': 1 } });
    // overslagpunten voor goederen (havens, terminals, rangeerterreinen): geel
    kaart.bron('overslag', { type: 'FeatureCollection', features: PLEKKEN.map(p => ({ type: 'Feature', properties: { n: p[0], l: p[3] }, geometry: { type: 'Point', coordinates: [p[2], p[1]] } })) });
    // bestemmingen: musea, zwembaden, winkelcentra ... (scholen pas ver ingezoomd)
    kaart.bron('voorz', { type: 'FeatureCollection', features: (D.voorz || []).map(v => ({ type: 'Feature', properties: { n: v.n, s: v.s, k: VOORZ_SOORT[v.s]?.[0] || '#777', z: v.s === 'school' ? 15 : ['museum', 'zwembad', 'winkelcentrum', 'stadion', 'dierentuin', 'pretpark', 'ziekenhuis', 'hogeschool'].includes(v.s) ? 11 : 13 }, geometry: { type: 'Point', coordinates: lonlat(v.x, v.y) } })) });
    for (const z of [11, 13, 15]) {
      kaart.laag({ id: 'net-voorz' + z, type: 'circle', source: 'voorz', minzoom: z, filter: ['==', ['get', 'z'], z], paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3, 15, 6], 'circle-color': ['get', 'k'], 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.2 } });
      kaart.laag({ id: 'net-voorz-naam' + z, type: 'symbol', source: 'voorz', minzoom: z + 1.5, filter: ['==', ['get', 'z'], z], layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Italic'], 'text-size': 10.5, 'text-offset': [0.7, 0], 'text-anchor': 'left', 'text-optional': true, 'text-max-width': 9 }, paint: { 'text-color': ['get', 'k'], 'text-halo-color': NK.halo, 'text-halo-width': 1.4 } });
    }
    kaart.laag({ id: 'net-overslag', type: 'circle', source: 'overslag', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3.5, 12, 7, 16, 10], 'circle-color': VRACHT, 'circle-stroke-color': '#5a4300', 'circle-stroke-width': 1.5 } });
    kaart.laag({ id: 'net-overslag-naam', type: 'symbol', source: 'overslag', minzoom: 8, layout: { 'text-field': ['concat', ['get', 'n'], '\n', ['get', 'l']], 'text-font': ['Noto Sans Bold'], 'text-size': 11, 'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-optional': true }, paint: { 'text-color': '#6b5200', 'text-halo-color': NK.halo, 'text-halo-width': 1.5 } });
    kaart.laag({ id: 'net-haltes-naam', type: 'symbol', source: 'haltes', minzoom: 16, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Regular'], 'text-size': 11, 'text-offset': [0.8, 0], 'text-anchor': 'left', 'text-optional': true }, paint: { 'text-color': KD ? '#c9d3cf' : '#2a3431', 'text-halo-color': NK.halo, 'text-halo-width': 1.2 } });
    const stFilter = ['all', jaarFilter(jaar)];
    // stippen: groen = reizigers, geel = goederen; de grootte zegt wat het is (trein > metro > tram/sneltram/veer > bus)
    const R = (trein, groot, metro, tram, bus) => ['match', ['get', 's'], 'trein', ['case', ['>=', ['get', 'p'], 6], groot, trein], 'metro', metro, ['sneltram', 'tram', 'veer'], tram, bus];
    kaart.laag({ id: 'net-stations', type: 'circle', source: 'stations', filter: ['all', jaarFilter(jaar), ['any', ['==', ['get', 's'], 'trein'], ['>=', ['zoom'], 12.5]]],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, R(2, 3.5, 1.6, 1.4, 1.2), 12, R(5, 7, 4.2, 3.4, 2.8), 16, R(9, 10, 7, 5.5, 4.5)],
        'circle-color': PASSAGIER, 'circle-stroke-width': ['case', ['==', ['get', 's'], 'trein'], 1.8, 1.2], 'circle-stroke-color': '#ffffff' } });
    kaart.laag({ id: 'net-stations-naam', type: 'symbol', source: 'stations', filter: ['all', jaarFilter(jaar), ['any', ['all', ['==', ['get', 's'], 'trein'], ['any', ['>=', ['get', 'p'], 5], ['>=', ['zoom'], 9.5]]], ['>=', ['zoom'], 14]]],
      layout: { 'text-field': ['get', 'n'], 'text-font': ['case', ['==', ['get', 's'], 'trein'], ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]], 'text-size': ['case', ['==', ['get', 's'], 'trein'], 12.5, 11], 'text-offset': [0.9, 0], 'text-anchor': 'left', 'symbol-sort-key': ['-', 0, ['get', 'p']], 'text-padding': 3 },
      paint: { 'text-color': KD ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    void stFilter;
    // vliegveld = station: een groene stip (zoals een treinstation) op de plek waar ook trein of bus stopt
    kaart.laag({ id: 'net-vlieg-stip', type: 'circle', source: 'vliegvelden', filter: ['all', ['==', ['get', 'mil'], 0], ['any', ['==', ['get', 'groot'], 1], ['>=', ['zoom'], 8]]],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, ['case', ['==', ['get', 'groot'], 1], 3.5, 2], 12, ['case', ['==', ['get', 'groot'], 1], 7, 5], 16, 9], 'circle-color': PASSAGIER, 'circle-stroke-width': 1.8, 'circle-stroke-color': '#ffffff' } });
    kaart.laag({ id: 'net-vlieg', type: 'symbol', source: 'vliegvelden', filter: ['any', ['==', ['get', 'groot'], 1], ['>=', ['zoom'], 8]],
      layout: { 'text-field': ['step', ['zoom'], '✈', 9, ['concat', '✈ ', ['get', 'l']]], 'text-font': ['Noto Sans Bold'], 'text-size': ['case', ['==', ['get', 'groot'], 1], 14, 12], 'text-allow-overlap': false, 'text-anchor': 'left', 'text-offset': [0.8, 0] },
      paint: { 'text-color': ['case', ['==', ['get', 'mil'], 1], '#7d7a8c', '#5b4bb7'], 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    // provincies waarvan het spoor nog niet geladen is: knop om het te laden
    kaart.bron('deelknoppen', { type: 'FeatureCollection', features: [] });
    kaart.laag({ id: 'deel-knop', type: 'symbol', source: 'deelknoppen', minzoom: 5.5, layout: { 'text-field': ['get', 't'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-allow-overlap': false, 'text-padding': 6 },
      paint: { 'text-color': '#1f3a7a', 'text-halo-color': '#ffffff', 'text-halo-width': 2.4 } });
    setTimeout(deelKnoppen, 0);
    // tijdens het aanleggen van een lijn: de plekken waar deze soort vervoer kan stoppen (zie kandidatenTonen)
    kaart.bron('kandidaten', { type: 'FeatureCollection', features: [] });
    kaart.laag({ id: 'net-kand', type: 'circle', source: 'kandidaten', paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2.6, 12, 6, 16, 9], 'circle-color': PASSAGIER, 'circle-stroke-width': 2.2, 'circle-stroke-color': '#ffffff' } });
    kaart.laag({ id: 'net-kand-naam', type: 'symbol', source: 'kandidaten', minzoom: 10.5, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-optional': true, 'text-padding': 2 },
      paint: { 'text-color': KD ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
    // geselecteerde lijn (eigen of van een ander): geel gemarkeerd met haltes
    kaart.bron('selectie', { type: 'FeatureCollection', features: [] }); kaart.bron('selectie-haltes', { type: 'FeatureCollection', features: [] });
    kaart.laag({ id: 'net-sel-halo', type: 'line', source: 'selectie', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#1d2724', 'line-width': zoomB(7, 9, 12), 'line-opacity': 0.35 } });
    kaart.laag({ id: 'net-sel', type: 'line', source: 'selectie', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#f2c14e', 'line-width': zoomB(4, 5.5, 8) } });
    kaart.laag({ id: 'net-sel-haltes', type: 'circle', source: 'selectie-haltes', paint: { 'circle-radius': 4.5, 'circle-color': '#fff', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#c48a12' } });
    kaart.laag({ id: 'net-sel-haltes-naam', type: 'symbol', source: 'selectie-haltes', minzoom: 9, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [0.9, 0], 'text-anchor': 'left', 'text-optional': true },
      paint: { 'text-color': '#1d2724', 'text-halo-color': '#fff6d6', 'text-halo-width': 2 } });
    kaart.laag({ id: 'net-eigen-haltes', type: 'circle', source: 'eigen-haltes', paint: { 'circle-radius': ['match', ['get', 'm'], 'trein', 8, 'metro', 7, ['tram', 'sneltram', 'veer'], 6, 5], 'circle-color': PASSAGIER, 'circle-stroke-width': 3, 'circle-stroke-color': spel?.kleur || '#c2412d', 'circle-opacity': ['case', ['==', ['get', 'klaar'], 1], 1, 0.6] } });
    kaart.laag({ id: 'net-eigen-haltes-naam', type: 'symbol', source: 'eigen-haltes', minzoom: 10, layout: { 'text-field': ['get', 'n'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-offset': [1, 0], 'text-anchor': 'left' }, paint: { 'text-color': KD ? '#e6ece9' : '#1d2724', 'text-halo-color': NK.halo, 'text-halo-width': 1.6 } });
  }
  jaarBijwerken();
  if (!wegen) { wegen = new Wegen(kaart); wegen.start('grens'); }
  if (!territorium) { territorium = new Territorium(kaart); territorium.laad('data/grenzen.json', D.grenzen).then(territoriumBijwerken); }
}
// territorium: waar je haltes hebt (eigen haltes en de haltes van je lijnen)
let territorium = null;
let startVlakken = null, startVoor = null;
function territoriumBijwerken() {
  if (!territorium) return;
  // lege regio: het gekozen gebied is meteen je (gekleurde) startgebied
  if (spel?.leeg !== startVoor) { startVoor = spel?.leeg; startVlakken = spel?.leeg ? leegVlakken(spel.leeg) : null; }
  territorium.zetStart(startVlakken, spel?.leeg?.land);
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
  for (const [id, c] of [['net-oud', 'oud'], ['net-zij', 'zij'], ['net-goed', 'goed'], ['net-tram', 'tram'], ['net-smal', 'smal'], ['net-snel', 'snel'], ['net-metro', 'metro'], ['net-enkel', 'h1']]) if (m.getLayer(id)) m.setFilter(id, ['all', k(c), f]);
  const hoofd = ['all', ['match', ['get', 'k'], ['h1', 'h2', 'h3'], true, false], f], e = n => ['==', ['get', 'e'], n];
  m.setFilter('net-hoofd', ['all', hoofd, ['!=', ['get', 'e'], 0]]); m.setFilter('net-hoofd-halo', hoofd);
  for (const [id, n] of [['net-hoofd-geen', 0], ['net-hsl-basis', 2], ['net-hsl', 2], ['net-locwissel', 3], ['net-vreemd', 4]]) if (m.getLayer(id)) m.setFilter(id, ['all', hoofd, e(n)]);
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
  kaart.bron('eigen-lijnen', { type: 'FeatureCollection', features: spel.lijnen.filter(l => l.route?.pts?.length >= 4).map(l => ({ type: 'Feature', properties: { id: l.id, kl: !l.actief ? '#8a8f8c' : selectie?.lijn === l ? '#f2c14e' : lijnKleur(l) }, geometry: { type: 'LineString', coordinates: lijnGeo(l.route.pts) } })) });
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
globalThis.__ovTest = { zichtLijnen, get bouwData() { return bouw; }, get territorium() { return territorium; }, wegBij: (...a) => wegBij(...a), halteOpWeg: (...a) => halteOpWeg(...a), get spel() { return spel; }, get net() { return net; }, get omlopen() { return omlopen; }, get plaatsen() { return D.plaatsen; }, get stations() { return D.stations; }, get halteGroepen() { return D.halteGroepen; }, kandidatenTest: m => kandidaten(m), routeVoor: (m, p) => routeVoor(m, p), aansluiten: (p, m) => aansluiten(p, m), get voorz() { return D.voorz; }, get ai() { return AI; }, get paneel() { return paneelData; }, open: (a, b) => openPaneel(a, b), get bouw() { return bouw; }, get tool() { return tool; }, get kaart() { return kaart; }, dagVoorbij: () => dagVoorbij(), bouwOpleveren: () => bouwOpleveren(), hud: () => hud() }; // voor tests/rook.mjs
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

// voertuigcategorie (voor de filters in Vloot en op de tweedehandsmarkt)
const VCAT = [['loc', 'Locs'], ['treinstel', 'Treinstellen'], ['rijtuig', 'Rijtuigen'], ['metro', 'Metro'], ['tram', 'Tram'], ['bus', 'Bussen'], ['boot', 'Boten'], ['vliegtuig', 'Vliegtuigen'], ['vracht', 'Vrachtwagens']];
function vCat(id) {
  const t = TYPE[id]; if (!t) return null; const sr = t.soort || TYPE[t.basis]?.soort;
  if (sr === 'loc') return 'loc'; if (sr === 'rijtuig' || sr === 'stuurstand') return 'rijtuig'; if (sr === 'wagon') return null;
  return { trein: 'treinstel', metro: 'metro', sneltram: 'tram', tram: 'tram', bus: 'bus', hov: 'bus', belbus: 'bus', veer: 'boot', watertaxi: 'boot', vlucht: 'vliegtuig', vracht: 'vracht' }[t.modus] || null;
}
const vlootFilter = new Set(), marktFilter = new Set();
const filterKnoppen = (set, actie, aanwezig) => `<div class="rij">${VCAT.filter(([k]) => aanwezig.has(k)).map(([k, n]) => `<button class="knop klein ${set.has(k) ? 'hoofd' : ''}" data-actie="${actie}" data-w="${k}">${n}</button>`).join('')}${set.size ? `<button class="knop klein" data-actie="${actie}" data-w="">alles</button>` : ''}</div>`;
// Kleur per eigen lijn: tot 12 lijnen elk een duidelijk andere kleur; daarboven per soort vervoer een kleurfamilie
// (trein blauw, metro paars, tram groen, bus oranje, boot cyaan, vliegen roze) met kleine accentverschillen.
const LIJN_PALET = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#9a6324', '#469990', '#800000', '#808000', '#000075'];
const FAMILIE = { trein: 215, metro: 275, sneltram: 150, tram: 125, bus: 25, hov: 10, belbus: 40, veer: 190, watertaxi: 175, vlucht: 320 };
let kleurIdx = null, kleurSig = '';
function lijnKleur(l) {
  if (!spel || l.ai) return l.kleur || '#777';
  const sig = spel.lijnen.map(x => x.id).join(',');
  if (sig !== kleurSig) {
    kleurSig = sig; kleurIdx = new Map(); const veel = spel.lijnen.length > 12, perModus = {};
    spel.lijnen.forEach((x, i) => {
      if (!veel) { kleurIdx.set(x.id, LIJN_PALET[i % LIJN_PALET.length]); return; }
      const k = perModus[x.modus] = (perModus[x.modus] ?? -1) + 1, h = FAMILIE[x.modus] ?? 0;
      const dh = [0, 14, -14, 28, -28, 7, -7, 21, -21][k % 9], licht = [42, 34, 50, 28, 56][Math.floor(k / 9) % 5];
      kleurIdx.set(x.id, `hsl(${(h + dh + 360) % 360}, 72%, ${licht}%)`);
    });
  }
  return kleurIdx.get(l.id) || spel.kleur;
}

// ---------------------------------------------------------------- balk onderin: aanleggen per soort vervoer
const KOMT_NOG = wat => () => melding(`${wat} aanleggen komt nog. Voorlopig gebruik je de bestaande.`, 6000);
let catNu = null;
function categorie(c) {
  if (catNu === c && tool === 'kijk') { catNu = null; hint(null); document.querySelectorAll('[data-cat]').forEach(b => b.classList.remove('aan')); return; }
  zetTool('kijk'); catNu = c;
  document.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('aan', b.dataset.cat === c));
  const halte = m => () => { zetTool('halte'); halteModus(m); }, spoor = m => () => { zetTool('spoor'); spoorBegin(m); };
  const menu = {
    wegen: ['Wegen', [['Nieuwe buslijn', () => lijnBegin('bus')], ['Snelbuslijn (HOV)', () => lijnBegin('hov')], ['Belbus', () => lijnBegin('belbus')], ['Halte aan de weg', halte('weg')], ['Bushalte', halte('bus')], ['Tramhalte', halte('tram')],
      ['Trambaan in de weg', spoor('trambaan')], ['Los tramspoor', spoor('tram')], ['Busstation', () => zetTool('busstation')], ['Trolleybus-bovenleiding', spoor('trolley')], ['Weg aanleggen', KOMT_NOG('Wegen')]]],
    lightrail: ['Lightrail', [['Nieuwe tramlijn', () => lijnBegin('tram')], ['Nieuwe sneltramlijn', () => lijnBegin('sneltram')], ['Nieuwe metrolijn', () => lijnBegin('metro')], ['Tramspoor', spoor('tram')], ['Trambaan in de weg', spoor('trambaan')], ['Metrospoor', spoor('metro')],
      ['Tramhalte', halte('tram')], ['Metro- of tramstation', () => zetTool('station')]]],
    trein: ['Trein', [['Nieuwe treinlijn', () => lijnBegin('trein')], ['Treinspoor', spoor('trein')], ['Station bouwen', () => zetTool('station')], ['Perron of opstelspoor', () => zetTool('perron')], ['Spoor erbij (2e, 3e, 4e)', () => zetTool('verdubbel')],
      ['Passeerspoor op enkelspoor', () => zetTool('passeer')], ['Kruising ongelijkvloers', () => zetTool('kruising')]]],
    boot: ['Boot', [['Nieuwe veerlijn', () => lijnBegin('veer')], ['Nieuwe watertaxilijn', () => lijnBegin('watertaxi')], ['Steiger (veer)', halte('veer')], ['Steiger (watertaxi)', halte('watertaxi')], ['Haven aanleggen', KOMT_NOG('Havens')]]],
    vliegen: ['Vliegen', [['Nieuwe vliegroute', () => lijnBegin('vlucht')], ['Vliegveld aanleggen', KOMT_NOG('Vliegvelden')], ['Helikopterplatform aanleggen', KOMT_NOG('Helikopterplatforms')]]],
  }[c];
  if (menu) hint(menu[0] + ':', [...menu[1], ['Sluiten', () => { catNu = null; zetTool('kijk'); }]]);
}

// ---------------------------------------------------------------- spoornet per provincie
// Het spoornet staat per provincie (NL, BE), kanton (LU), regierungsbezirk (DE) ... in data/spoor/<code>.json.
// Bij de start laadt het spel het beginland (en eventueel de grensprovincies van de buurlanden); de rest komt erbij
// met de knop op de kaart, of vanzelf als je een lijn aanlegt die erdoorheen moet.
const LANDNAAM = { NL: 'Nederland', BE: 'België', LU: 'Luxemburg', DE: 'Duitsland', FR: 'Frankrijk' };
const deelInfo = c => D.spoorIndex?.find(d => d.c === c);
const deelNaam = c => { const d = deelInfo(c); return d ? `${LANDNAAM[d.l] || d.l}: ${d.n.startsWith('Overig') ? 'overig' : d.n}` : c; };
const bboxRaakt = (a, b, m = 0) => !(a[0] > b[2] + m || a[2] < b[0] - m || a[1] > b[3] + m || a[3] < b[1] - m);
// welke delen bij de start: het hele beginland, met de grensprovincies van de buurlanden, en wat het overgenomen bedrijf rijdt
function startDelen(land, grens, bbox = null) {
  const idx = D.spoorIndex || [], eigen = idx.filter(d => d.l === land);
  const U = eigen.reduce((a, d) => a ? [Math.min(a[0], d.b[0]), Math.min(a[1], d.b[1]), Math.max(a[2], d.b[2]), Math.max(a[3], d.b[3])] : [...d.b], null);
  const uit = new Set(eigen.map(d => d.c));
  // grensprovincies: de delen van buurlanden die aan een deel van het beginland grenzen (n2 = buren, zie spoordelen.py)
  if (grens) for (const d of eigen) for (const c of d.n2 || []) if (deelInfo(c)?.l !== land) uit.add(c);
  void U;
  if (bbox) for (const d of idx) if (bboxRaakt(d.b, bbox, 5000)) uit.add(d.c);
  return [...uit];
}
let deelRij = Promise.resolve();
async function laadDelen(codes, { groot = false, reden = '' } = {}) {
  if (!D.spoorIndex || !net) return;
  const vorige = deelRij; let klaar; deelRij = new Promise(r => { klaar = r; }); await vorige; // één laadbeurt tegelijk
  const el = $('deellaad');
  try {
    const nog = [...new Set(codes)].filter(c => !net.delen.has(c) && deelInfo(c));
    if (!nog.length) return;
    const totaal = nog.reduce((a, c) => a + (deelInfo(c).kb || 100), 0); let kb = 0, t0 = performance.now();
    const zet = (f, tekst) => {
      if (groot) { laad.zet(f, tekst); return; }
      el.style.display = 'block'; $('deellaad-titel').textContent = reden || 'Extra provincies laden: het spel reageert zo weer';
      $('deellaad-lijst').textContent = nog.map(deelNaam).join(' · ');
      $('deellaad-vol').style.width = (f * 100).toFixed(1) + '%';
      const rest = f > 0.05 ? (performance.now() - t0) / f * (1 - f) / 1000 : null;
      $('deellaad-tekst').textContent = tekst + (rest != null && f < 0.99 ? ` · nog ongeveer ${Math.max(1, Math.round(rest))} s` : '');
    };
    const nieuw = [];
    for (const c of nog) {
      zet(kb / totaal, `${deelNaam(c)} laden`);
      let data = null; try { const r = await fetch(`data/spoor/${encodeURIComponent(c)}.json`); if (r.ok) data = await r.json(); } catch {}
      if (data) { const voor = net.takken.length; net.voegDeelToe(data); nieuw.push(...net.takken.slice(voor)); }
      kb += deelInfo(c).kb || 100; zet(kb / totaal, `${deelNaam(c)} geladen`);
      await new Promise(r => setTimeout(r, 0));
    }
    zet(1, 'Openingsjaren en stations bijwerken'); await new Promise(r => setTimeout(r, 0));
    takkenBijwerken(nieuw);
    const vakken = nog.map(c => deelInfo(c).b);
    stationsJaren(D.stations.filter(st => vakken.some(b => st.x >= b[0] - 500 && st.x <= b[2] + 500 && st.y >= b[1] - 500 && st.y <= b[3] + 500)));
    D.gemaakt = null; wisselCache = null; if (spel) spel.delen = [...net.delen];
    if (lagenGemaakt) { zet(1, 'Kaart bijwerken'); await new Promise(r => setTimeout(r, 0)); netwerkLagen(); }
    deelKnoppen();
  } finally { if (!groot) el.style.display = 'none'; klaar(); }
}
// knoppen op de kaart voor provincies waarvan het spoor nog niet geladen is
function deelKnoppen() {
  if (!kaart?.map?.getSource('deelknoppen')) return;
  const fs = (D.spoorIndex || []).filter(d => !net.delen.has(d.c) && !d.c.startsWith('X-')).map(d => {
    const p = territorium?.prov?.find(q => q.code === d.c), b = p ? p.bbox : d.b;
    return { type: 'Feature', properties: { c: d.c, t: `⬇ Sporen laden\n${deelNaam(d.c)}` }, geometry: { type: 'Point', coordinates: lonlat((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) } };
  });
  kaart.bron('deelknoppen', { type: 'FeatureCollection', features: fs });
}
// voor een lijn over het spoor: de provincies langs de route (in een strook van ~8 km breed) erbij laden
async function delenVoorRoute(p) {
  if (!D.spoorIndex || !territorium?.prov?.length) return;
  const codes = new Set();
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.ceil(d / 2000)), nx = -(b.y - a.y) / (d || 1), ny = (b.x - a.x) / (d || 1);
    for (let k = 0; k <= n; k++) for (const z of [0, -8000, 8000]) {
      const x = a.x + (b.x - a.x) * k / n + nx * z, y = a.y + (b.y - a.y) * k / n + ny * z, c = territorium.provincieCode(x, y);
      if (c) codes.add(c);
    }
  }
  const nog = [...codes].filter(c => !net.delen.has(c) && deelInfo(c));
  if (nog.length) await laadDelen(nog, { reden: 'Sporen langs je nieuwe lijn laden' });
}

// ---------------------------------------------------------------- vliegtuigen
// lengte (m) uit het aantal stoelen: Cessna ~8 m, Fokker 50 ~25 m, Boeing 737 ~40 m
const vliegLengte = id => { const t = TYPE[id]; if (!t) return 30; if (t.baan === 0) return 16; return Math.max(8, Math.min(70, 7 + (t.zit || 20) * 0.18)); };
// bovenaanzicht van een vliegtuig (neus naar +x), wit met de huiskleur op staart en romplijn; helikopter met rotor
function tekenVliegtuig(ctx, px, py, hoek, L, id, kleur) {
  const t = TYPE[id] || {}, heli = t.baan === 0, straal = !heli && (t.vmax || 0) >= 600, prop = !heli && !straal;
  ctx.save(); ctx.translate(px, py); ctx.rotate(-hoek);
  ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = Math.max(0.8, L * 0.012);
  const romp = L * 0.055 + 1, span = heli ? 0 : L * (straal ? 0.95 : 1.15);
  if (heli) {
    ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.ellipse(L * 0.08, 0, L * 0.28, L * 0.13, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = kleur; ctx.fillRect(-L * 0.5, -L * 0.03, L * 0.4, L * 0.06); ctx.fillRect(-L * 0.52, -L * 0.1, L * 0.06, L * 0.2);
    ctx.strokeStyle = 'rgba(30,30,30,.45)'; ctx.lineWidth = Math.max(1, L * 0.025);
    const a = (performance.now() / 60) % 7; ctx.beginPath(); for (let k = 0; k < 4; k++) { const b = a + k * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * L * 0.55, Math.sin(b) * L * 0.55); } ctx.stroke();
    ctx.restore(); return;
  }
  ctx.fillStyle = '#f7f7f5';
  // vleugels (bij straalvliegtuigen gepijld)
  const wx = straal ? -L * 0.02 : L * 0.05, pijl = straal ? L * 0.22 : L * 0.04, koorde = L * (straal ? 0.16 : 0.12);
  ctx.beginPath(); ctx.moveTo(wx, -romp * 0.8); ctx.lineTo(wx - pijl, -span / 2); ctx.lineTo(wx - pijl - koorde * 0.55, -span / 2); ctx.lineTo(wx - koorde, -romp * 0.8);
  ctx.lineTo(wx - koorde, romp * 0.8); ctx.lineTo(wx - pijl - koorde * 0.55, span / 2); ctx.lineTo(wx - pijl, span / 2); ctx.lineTo(wx, romp * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  // staartvlakken
  const sx = -L * 0.42, ss = span * 0.34;
  ctx.beginPath(); ctx.moveTo(sx + L * 0.05, -romp * 0.6); ctx.lineTo(sx - L * 0.03, -ss / 2); ctx.lineTo(sx - L * 0.08, -ss / 2); ctx.lineTo(sx - L * 0.06, 0); ctx.lineTo(sx - L * 0.08, ss / 2); ctx.lineTo(sx - L * 0.03, ss / 2); ctx.lineTo(sx + L * 0.05, romp * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
  // romp
  ctx.beginPath(); ctx.moveTo(L * 0.5, 0); ctx.quadraticCurveTo(L * 0.46, -romp, L * 0.36, -romp); ctx.lineTo(-L * 0.4, -romp * 0.75); ctx.lineTo(-L * 0.5, 0); ctx.lineTo(-L * 0.4, romp * 0.75); ctx.lineTo(L * 0.36, romp); ctx.quadraticCurveTo(L * 0.46, romp, L * 0.5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  // huiskleur: streep over de romp en de staart
  ctx.fillStyle = kleur; ctx.fillRect(-L * 0.4, -romp * 0.3, L * 0.78, romp * 0.6); ctx.beginPath(); ctx.moveTo(sx + L * 0.04, -romp * 0.35); ctx.lineTo(-L * 0.5, -romp * 0.2); ctx.lineTo(-L * 0.5, romp * 0.2); ctx.lineTo(sx + L * 0.04, romp * 0.35); ctx.fill();
  // motoren: propellers aan de vleugel, of straalmotoren onder de vleugel
  ctx.fillStyle = '#9aa0a6';
  const mot = (t.zit || 0) > 120 || straal ? 1 : 1, my = span * (straal ? 0.17 : 0.2);
  void mot;
  for (const z of [-1, 1]) { if (prop && (t.zit || 0) <= 4) break; ctx.beginPath(); ctx.ellipse(wx + L * 0.02, z * my, L * 0.05, romp * 0.45, 0, 0, 7); ctx.fill(); }
  if (prop && (t.zit || 0) <= 4) { ctx.fillStyle = '#555'; ctx.fillRect(L * 0.5, -L * 0.08, Math.max(1, L * 0.01), L * 0.16); }
  ctx.restore();
}

// ---------------------------------------------------------------- omlopen
let opstel = null, groepIdx = null, groepIdxSig = '', snapVolgende = 0;
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
  if (c && c.lijnen.length === lijnen.length && c.lijnen.every((l, i) => l === lijnen[i] && c.v[i] === l.vertrek && c.a[i] === l.actief && c.t[i] === (l.tr || l.t) && c.w[i] === l._ritWacht && c.k[i] === l._kruis)) return c.om;
  const om = maakOmloop(lijnen); om.id = g;
  omlopen.set(g, { lijnen: [...lijnen], v: lijnen.map(l => l.vertrek), a: lijnen.map(l => l.actief), t: lijnen.map(l => l.tr || l.t), w: lijnen.map(l => l._ritWacht), k: lijnen.map(l => l._kruis), om });
  for (const l of lijnen) l._omloopN = om.voertuigen.length;
  return om;
}
// pool: vervoerder + soort vervoer + materieel
// instellingen per apparaat (niet in het spel): muziek en hoeveel voertuigen er op de kaart getekend worden
const INST = (() => { try { return { max: 100, liedje: 0, ...JSON.parse(localStorage.getItem('ov_instellingen') || '{}') }; } catch { return { max: 100, liedje: 0 }; } })();
const instBewaar = () => { try { localStorage.setItem('ov_instellingen', JSON.stringify(INST)); } catch {} };
const lijnKm = l => l._lk ?? (l._lk = (l.route?.lengte || l.cum?.at(-1) || 0) / 1000);
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
  void 0; // (snappen: zie onder, na het kiezen van de voertuigen)
  // heen en terug elk op hun eigen spoor (opnieuw als de route is veranderd)
  const banenNodig = l => l._banenVan !== l.route?.pts && r < 40 && l.vertrek?.[1]?.length && ['trein', 'metro', 'sneltram', 'tram'].includes(l.modus);
  const opSpoorNodig = l => l._spoor === undefined && r < 40 && ['trein', 'metro', 'sneltram', 'tram'].includes(l.modus) && !l.route?.takken;
  // voertuigen per omloopgroep: ze rijden, keren, wachten of staan opgesteld, maar verdwijnen nooit
  if (!opstel || opstel.net !== net || opstel.jaar !== spel.jaar) opstel = new Opstel(net, spel.jaar);
  opstel.budget = 3; opstel.tot = performance.now() + 6; // nieuwe opstelroutes per beeld: hooguit een paar, ~6 ms
  const opstelNu = r < 40 ? opstel : null; // uitgezoomd: geen rangeerritten uitrekenen (je ziet ze toch niet)
  const idx = groepIndex();
  const gedaan = new Set();
  const doeGroep = (l, eigen) => {
    const g = groepSleutel(l);
    if (gedaan.has(g)) return; gedaan.add(g);
    const om = omloopVan(g, idx.get(g) || [l]);
    // uitgezoomd: van andere vervoerders alleen de lange lijnen (internationaal en intercity eerst, lokaal pas ingezoomd)
    if (om) voertuigenOmloop(om, tm, vt, eigen || volg ? opstel : opstelNu, lengteVan, eigen ? inZicht : (l2 => inZicht(l2) && lijnKm(l2) >= minKm));
  };
  const minKm = r > 400 ? 80 : r > 150 ? 25 : r > 60 ? 8 : r > 25 ? 3 : 0;
  for (const l of spel.lijnen) {
    if (!l.actief || !inZicht(l)) continue;
    doeGroep(l, true);
  }
  let eigenN = vt.length;
  for (const l of AI.lijnen) {
    if (!inZicht(l)) continue;
    if (r > 120 && l.modus !== 'trein') continue;
    if (r > 40 && (l.modus === 'bus' || l.modus === 'belbus')) continue;
    if (lijnKm(l) < minKm) continue;
    doeGroep(l, false);
  }
  // hooguit INST.max voertuigen tekenen: 25% voor de langste routes (van wie ook), de rest eerst je eigen en dan die
  // van anderen, steeds de langste routes eerst; het gevolgde voertuig altijd
  if (vt.length > INST.max) {
    const alle = vt.map((v, i) => ({ v, eigen: i < eigenN, km: lijnKm(v.lijn) + (v.omloop === volg ? 1e9 : 0) })).sort((a, b) => b.km - a.km);
    const vrij = Math.ceil(INST.max * 0.25), kies = new Set(alle.slice(0, vrij));
    for (const x of alle) { if (kies.size >= INST.max) break; if (x.eigen) kies.add(x); }
    for (const x of alle) { if (kies.size >= INST.max) break; kies.add(x); }
    const eigen = alle.filter(x => x.eigen && kies.has(x)).map(x => x.v), ander = alle.filter(x => !x.eigen && kies.has(x)).map(x => x.v);
    vt.length = 0; vt.push(...eigen, ...ander); eigenN = eigen.length;
  }
  // routes op het echte spoor leggen (en heen/terug op hun eigen spoor): alleen voor lijnen waarvan nu voertuigen
  // getekend worden, eigen lijnen eerst, hooguit één lijn per 250 ms (elk kost 0,1–0,3 s)
  if (performance.now() > snapVolgende) {
    const lijnen = [...new Set(vt.map(v => v.lijn))];
    for (const l of lijnen) {
      if (opSpoorNodig(l)) { lijnOpSpoor(net, l, spel.jaar); if (l._spoor && l.echt && !l.ai) delete l.echt.km; snapVolgende = performance.now() + 600; break; }
      if (banenNodig(l)) { rijBanen(net, l, spel.jaar); snapVolgende = performance.now() + 600; break; }
    }
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
    if (eigen && heeftMix(v.lijn)) tid = typeBijRit(spel, v.lijn, spel.dag, v.vertrek, v.r); // materieelmix: soort naar het aandeel in dat uur
    else if (eigen && v.lijn.altTypeId) { // een deel van de ritten met het alternatieve materieel
      const d = v.lijn._altD ?? (v.lijn._altD = S.altDeel(spel, v.lijn));
      if (d && Math.abs(Math.round(v.vertrek * 7 + v.r * 3)) % 100 < d * 100) tid = v.lijn.altTypeId;
    }
    let u = uiterlijk(tid, m);
    const dep = v.wacht && v.volgende ? v.volgende.dep : v.vertrek, eh = S.eenheden(v.lijn, spel.dag, dep);
    void eh; // gekoppeld in de spits: de tweede eenheid is een eigen voertuig in de omloop (rijdt van en naar het opstelspoor)
    const kleur = eigen ? spel.kleur : huiskleur(v.lijn, u);
    const lang = schemaLengte(u._l) * Math.min(maat, 1.25);
    // vliegtuig ver genoeg ingezoomd: het toestel zelf op ware grootte (bovenaanzicht)
    const vlL = m === 'vlucht' ? vliegLengte(tid) : 0;
    if (m === 'vlucht' && vlL / r >= 16) { tekenVliegtuig(ctx, px, py, v.hoek, vlL / r, tid, eigen ? spel.kleur : vervoerderKleur(v.lijn.vervoerderNaam || '')); }
    else if (u._l / r >= lang && m !== 'vlucht') {
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
// De spellus plant de volgende beurt altijd eerst in: een fout in de afrekening of het tekenen mag het spel niet
// laten bevriezen (eerder stond dan de tijd stil terwijl de kaart nog bewoog). Fouten komen één keer in beeld.
const gemeldeFouten = new Set();
function lusFout(waar, e) {
  console.error(waar, e);
  const k = waar + ':' + (e?.message || e);
  if (gemeldeFouten.has(k)) return; gemeldeFouten.add(k);
  melding(`Er ging iets mis (${waar}: ${e?.message || e}). Het spel loopt door; geef deze melding gerust door.`, 12000);
}
function lus(nu) {
  requestAnimationFrame(lus);
  const dt = Math.min(0.25, Math.max(0, (nu - vorige) / 1000)); vorige = nu;
  if (spel && snelheid && tijdLoopt) {
    const oud = spel.tijd;
    spel.tijd += dt * snelheid / 60;
    // elk vol uur afrekenen
    for (let u = Math.floor(oud / 60) + 1; u <= Math.floor(spel.tijd / 60); u++) { try { uurVoorbij(u * 60 - 60); } catch (e) { lusFout('afrekenen', e); } }
    if (spel.tijd >= 29 * 60) { try { dagVoorbij(); } catch (e) { lusFout('nieuwe dag', e); if (spel.tijd >= 29 * 60) { spel.tijd -= 24 * 60; spel.dag++; } } } // speldag loopt van 05:00 tot 05:00
    if (Math.floor(oud) !== Math.floor(spel.tijd)) { try { bouwOpleveren(); verzoekenAfhandelen(); } catch (e) { lusFout('bouwen en verzoeken', e); } } // elke spelminuut
  }
  try { kaart.render(); } catch (e) { lusFout('tekenen', e); }
  hudT += dt; if (hudT > 0.25) { hudT = 0; try { hud(); } catch (e) { lusFout('kas en klok', e); } }
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
    if ((s.soort || 0) === 3) { let n = 0; for (const h of spel.haltes) if (BUSMODI.includes(h.modus) && projecteer(t.pts, h.x, h.y).d < 25) { h.modus = 'tram'; h.bus = true; n++; }
      if (n) melding(`${n} bushalte(s) langs de nieuwe trambaan zijn nu tramhaltes (bussen stoppen er nog steeds).`, 7000); }
    const vt = s.verdubbeltSleutel ? net.takMetSleutel(s.verdubbeltSleutel) : net.takken[s.verdubbelt]; if (s.verdubbelt != null && vt) vt.sporen = s.nieuwSporen || 2;
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
// ---------------------------------------------------------------- haltes van een lijn wijzigen (eerst als concept)
// Toevoegen en weghalen gebeurt eerst in een concept (l._concept). Pas met "Rit updaten" gaat het echt in; dan
// verandert ook je gebied (gemeenten waar je haltes hebt). "Annuleren" laat alles zoals het was.
function conceptVan(l) { return (l._concept ||= { haltes: l.haltes.map(h => ({ ...h })), route: l.route, nieuw: [], weg: [] }); }
function conceptKloon(l) { const c = l._concept, k = { ...l, haltes: c.haltes, route: c.route, echt: null, aangepast: true }; try { S.herbereken(k); } catch {} return k; }
async function conceptToevoegen(l, st) {
  const c = conceptVan(l);
  if (c.haltes.some(h => h.naam === st.naam)) { melding(`${st.naam} zit al in lijn ${l.nr}.`); return; }
  const k = { ...l, haltes: c.haltes, route: c.route, echt: null, ai: false };
  if (!stationInvoegen(k, st)) {   // niet langs de bestaande route: op de beste plek invoegen en een nieuwe route zoeken
    let bi = 1, bk = Infinity;
    for (let i = 0; i <= c.haltes.length; i++) {
      const a = c.haltes[i - 1], b = c.haltes[i], dd = (q, r) => q && r ? Math.hypot(q.x - r.x, q.y - r.y) : 0;
      const kk = dd(a, st) + dd(st, b) - dd(a, b) + (!a || !b ? dd(a || b, st) * 0.6 : 0);
      if (kk < bk) { bk = kk; bi = i; }
    }
    c.haltes.splice(bi, 0, { naam: st.naam, x: st.x, y: st.y, ...(st.perrons ? { perrons: st.perrons } : {}) });
    hint('Route zoeken…'); const r = await routeVoor(l.modus, c.haltes); hint(null); c.route = r.route; if (r.waarschuwing) melding(r.waarschuwing, 6000);
  }
  if (c.weg.includes(st.naam)) c.weg = c.weg.filter(n => n !== st.naam); else c.nieuw.push(st.naam);
  melding(`${st.naam} staat in het concept van lijn ${l.nr}. Klik op „Rit updaten” om het toe te passen.`);
  ververs();
}
async function conceptWeg(l, i) {
  const c = conceptVan(l);
  if (c.haltes.length <= 2) { melding('Een lijn heeft minstens twee haltes.'); return; }
  const [weg] = c.haltes.splice(i, 1);
  if (i === 0 || i === c.haltes.length) { const r = await routeVoor(l.modus, c.haltes); c.route = r.route; }
  if (c.nieuw.includes(weg.naam)) c.nieuw = c.nieuw.filter(n => n !== weg.naam); else c.weg.push(weg.naam);
  ververs();
}
// gemeenten van al je haltes, met de haltes van lijn l vervangen door `haltesL`
function gemeentenMet(l, haltesL) {
  const T = territorium; if (!T?.gem?.length) return null;
  const alle = [...(spel.haltes || []).filter(h => h.eigen), ...spel.lijnen.filter(x => x !== l).flatMap(x => x.haltes || []), ...haltesL];
  const uit = new Set(); for (const h of alle) { if (!h || !isFinite(h.x)) continue; const g = T.gemeenteVan(h.x, h.y); if (g >= 0) uit.add(T.gem[g].naam || T.gem[g].code); }
  return uit;
}
function conceptBlok(l) {
  const c = l._concept; if (!c) return '';
  const k = conceptKloon(l), voor = gemeentenMet(l, l.haltes), na = gemeentenMet(l, c.haltes);
  const erbij = voor && na ? [...na].filter(g => !voor.has(g)) : [], af = voor && na ? [...voor].filter(g => !na.has(g)) : [];
  const verschil = (a, b, eenheid) => a === b ? `${b}${eenheid}` : `${a}${eenheid} → <b>${b}${eenheid}</b>`;
  return `<div class="kaartje concept"><b>✎ Wijziging nog niet toegepast</b>
    <ol class="haltelijst">${c.haltes.map((h, i) => `<li class="${c.nieuw.includes(h.naam) ? 'nieuw' : ''}">${esc(h.naam)}${c.nieuw.includes(h.naam) ? ' <span class="chip goed">nieuw</span>' : ''} <button class="knop klein" data-actie="halte-weg" data-id="${l.id}" data-i="${i}" title="uit het concept halen">✕</button></li>`).join('')}</ol>
    ${c.weg.length ? `<p class="klein">Eruit: ${c.weg.map(n => `<s>${esc(n)}</s>`).join(', ')}</p>` : ''}
    <p class="klein">Rijtijd ${verschil(Math.round(l.duur / 60), Math.round(k.duur / 60), ' min')} · nodig materieel ${verschil(l.nodig, k.nodig, '')} · ${verschil(l.haltes.length, c.haltes.length, ' haltes')}</p>
    ${erbij.length ? `<p class="klein">Nieuw in je gebied: <b>${erbij.map(esc).join(', ')}</b></p>` : ''}
    ${af.length ? `<p class="klein" style="color:var(--rood)">Valt af uit je gebied (geen haltes meer): <b>${af.map(esc).join(', ')}</b></p>` : ''}
    <div class="rij"><button class="knop hoofd" data-actie="concept-toepassen" data-id="${l.id}">✔ Rit updaten</button><button class="knop" data-actie="concept-annuleer" data-id="${l.id}">Annuleren</button>
      <button class="knop klein" data-actie="halte-erbij" data-id="${l.id}">＋ Nog een station/halte</button></div></div>`;
}
function conceptToepassen(l) {
  const c = l._concept; if (!c) return;
  const voor = gemeentenMet(l, l.haltes), na = gemeentenMet(l, c.haltes);
  l.haltes = c.haltes; l.route = c.route; if (l.echt) l.aangepast = true;
  delete l._concept; S.herbereken(l); l._vangst = null; l._banenVan = null; l._banen = null; stroomBijwerken(l);
  const erbij = voor && na ? [...na].filter(g => !voor.has(g)) : [], af = voor && na ? [...voor].filter(g => !na.has(g)) : [];
  melding(`Lijn ${l.nr} bijgewerkt (${c.nieuw.length ? `+${c.nieuw.length}` : ''}${c.nieuw.length && c.weg.length ? ', ' : ''}${c.weg.length ? `−${c.weg.length}` : ''} haltes).${erbij.length ? ` Nieuw in je gebied: ${erbij.join(', ')}.` : ''}${af.length ? ` Uit je gebied: ${af.join(', ')}.` : ''}`, 8000);
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
  // goederenvervoer: af en toe een nieuwe aanvraag; geslaagde subsidieopdrachten tellen
  succesTellen();
  { const voor = (spel.vrachtAanvragen || []).length;
    if (voor < 6 && (voor < 2 || Math.random() < 0.3) && vrachtAanvullen(1)) { const a = spel.vrachtAanvragen.at(-1); melding(`Goederenvervoer gevraagd: ${a.klant}, ${a.van.naam} → ${a.naar.naam} (${a.ton} t, ${FREQ[a.freq].naam}). Zie Goederen.`, 7000); } }
  // tweedehandsmarkt en revisies
  for (const a of marktBijwerken(spel)) if (a.soort === 'klassieker' || Math.random() < 0.5)
    melding(a.soort === 'klassieker' ? `Klassieker te koop: ${a.n} × ${TYPE[a.typeId].naam} (${a.leeftijd} jaar, ${STAAT[a.staat].naam}) bij ${a.van}. Zie Vloot → Tweedehandsmarkt.` : `${a.van} doet ${a.n} × ${TYPE[a.typeId].naam} van de hand (tweedehandsmarkt).`, 8000);
  for (const r of renovatiesAfronden(spel, S.leeftijden)) melding(`Revisie klaar: ${r.n} × ${TYPE[r.typeId].naam} weer in dienst, technisch flink jonger.`, 7000);

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
let dagLaag = -1;
function dienstVoorDag() {
  // laagfrequente lijnen: elke dag opnieuw welke ritten vandaag rijden
  S.zetDag(spel.dag);
  if (dagLaag !== spel.dag) {
    dagLaag = spel.dag;
    // eenmalige lijnen waarvan de dag voorbij is: vervallen
    const weg = spel.lijnen.filter(l => l.dienst === 'eenmalig' && (l.ritten || []).every(x => x.dag < spel.dag));
    if (weg.length) { spel.lijnen = spel.lijnen.filter(l => !weg.includes(l)); melding(`Eenmalige rit${weg.length > 1 ? 'ten' : ''} gereden: lijn ${weg.map(l => l.nr).join(', ')} vervalt.`); }
    for (const l of spel.lijnen) if (l.dienst === 'laag' || l.dienst === 'eenmalig') S.herbereken(l);
  }
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
  return `<table class="tabel">${voertuigLijst.map((e, i) => `<tr data-actie="toon-voertuig" data-i="${i}" data-nr="${e.omloop.nr}" data-id="${l.id}" style="cursor:pointer"><td>#${e.omloop.nr}</td><td>${tekst(e)}${groep.includes(e.wacht && e.volgende ? e.volgende.l : e.lijn) ? '' : ` <span class="klein">· nu op lijn ${esc((e.wacht && e.volgende ? e.volgende.l : e.lijn).nr || '')}</span>`}</td><td class="getal klein">${e.omloop.ritten.filter(x => !x.leeg).length} ritten</td></tr>`).join('')}</table>`;
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
  const rijen = kl.map(k => `<tr><td>${KLASSE_NAAM[k.klasse]}</td><td class="klein">${stoelNaam(k.stoel)}<br>${k.zit} ${String(k.stoel).startsWith('slaap:') ? 'bedden' : 'zit'}${k.sta ? ` + ${k.sta} sta` : ''}</td>
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
// ---------------------------------------------------------------- goederenvervoer
const vrachtLijnen = () => spel.lijnen.filter(l => l.vracht);
const vrachtKortLopend = () => { const lopend = vrachtLijnen(); return lopend.length ? `<h3>Lopende goederentreinen</h3><table class="tabel">${lopend.map(l => `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td>${esc(l.naam)}<br><span class="klein">${wanneerTekst(l.bijzonder)} · ${rittenVan(l.bijzonder)[0].map(S.klok).join(', ')}</span></td><td class="getal">${S.euroKort(l.bijzonder.bod)}</td></tr>`).join('')}</table><h3>Aanvragen</h3>` : ''; };
function vrachtKort() {
  const n = (spel.vrachtAanvragen || []).length, lopend = vrachtLijnen();
  return `${lopend.length ? `<table class="tabel">${lopend.map(l => `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td>${esc(l.naam)}<br><span class="klein">${wanneerTekst(l.bijzonder)} · ${rittenVan(l.bijzonder)[0].map(S.klok).join(', ')} · ${l.vracht.n} × ${esc(TYPE[l.vracht.loc]?.naam || '')}</span></td><td class="getal">${S.euroKort(l.bijzonder.bod)}</td></tr>`).join('')}</table>` : ''}
    <button class="knop" data-actie="open-vracht">Aanvragen voor goederenvervoer (${n})</button>`;
}
// hoeveel locs van dit type zijn in dit tijdvak al bezet (reizigerslijnen en andere goederentreinen)
function locsBezet(loc, venster, behalve) {
  let n = 0;
  for (const l of spel.lijnen) { if (!l.actief && !l.bijzonder || l === behalve) continue;
    if (l.vracht) {
      if (l.vracht.legs) { n += Math.max(0, ...l.vracht.legs.filter(g => g.venster === venster).map(g => g.locs.filter(q => q.id === loc).reduce((s2, q) => s2 + q.n, 0))); continue; }
      if (l.vracht.loc === loc && (l.vracht.vensters || [l.vracht.venster]).includes(venster)) n += l.vracht.n; continue; }
    if (l.bijzonder) continue;
    const k = nodigPer(l.typeId)[loc] || 0; if (!k) continue;
    const spits = k * l.nodig; n += venster === 'spits' ? spits : venster === 'dal' ? Math.ceil(spits * Math.min(1, (l.interval?.ochtendspits || 30) / (l.interval?.dal || 30))) : 0;
  }
  return n;
}
function vrachtTypen(a) {
  // locs die je nu kunt kopen of al hebt, en die over de hele route kunnen (spanning)
  const kand = [...beschikbaarLos(spel.jaar), ...Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0).map(id => TYPE[id])].filter((v, i, x) => isVrachtLoc(v) && x.indexOf(v) === i);
  return kand.filter(v => { const id = vrachtTypeId(v.id, 1, a.wagons); samenstellingVan(id); return stroomCheck(spel, net, { route: a.route, modus: 'trein', haltes: [a.van, a.naar] }, id).ok; });
}
const PANEEL_VRACHT = d => {
  if (!d) d = paneelData = {};
  const lijst = (spel.vrachtAanvragen || []).filter(a => a.route);
  const kaart_ = a => {
    a.retour ||= 'leeg'; a.losUren ||= 4;
    const typen = vrachtTypen(a);
    const beste = typen.slice().sort((x, y) => (spel.voertuigen[y.id] || 0) - (spel.voertuigen[x.id] || 0) || vermogen(y.id) - vermogen(x.id))[0]?.id;
    const kz = ((d.keuze ||= {})[a.id] ||= {});
    // heen: standaard 's nachts; terug: vroegst na aankomst en lossen
    kz.heen ||= { tijd: VENSTER.nacht.tijden[1], locs: beste ? [{ id: beste, n: Math.max(1, locsNodig(beste, a.ton, 'nacht')) }] : [] };
    const rij = vrachtRijtijd(a.km), vroegst = kz.heen.tijd + rij + a.losUren * 60;
    kz.terug ||= { tijd: vroegst, locs: beste ? [{ id: beste, n: Math.max(1, locsNodig(beste, tonTerug(a), vensterVan(vroegst))) }] : [] };
    const leg = (k, naam, ton, van, naar) => {
      const x = kz[k], venster = vensterVan(x.tijd), nodig = nodigKw(ton, venster), kw = x.locs.reduce((s2, q) => s2 + vermogen(q.id) * q.n, 0), genoeg = kw >= nodig;
      const teVroeg = k === 'terug' && x.tijd < vroegst;
      return `<div class="kaartje"><div class="rij"><b>${naam}</b><span class="klein">${esc(van)} → ${esc(naar)} · ${ton.toLocaleString('nl-NL')} t ${k === 'terug' ? (a.retour === 'vol' ? '(andere lading)' : '(lege wagons)') : ''}</span></div>
        <div class="raster2"><label class="veld">Vertrek${k === 'terug' ? ` <span class="klein">(vroegst ${S.klok(vroegst % 1440)}${vroegst >= 1440 + 300 ? ' volgende dag' : ''})</span>` : ''}<input type="time" value="${S.klok(x.tijd % 1440)}" data-wijzig="vr-tijd" data-id="${a.id}" data-k="${k}"></label>
        <div class="veld"><label>Tijdvak</label><span>${VENSTER[venster].naam}</span></div></div>
        <table class="tabel klein">${x.locs.map((q, j) => `<tr><td><select data-wijzig="vr-loc" data-id="${a.id}" data-k="${k}" data-j="${j}">${typen.map(v => `<option value="${v.id}" ${v.id === q.id ? 'selected' : ''}>${esc(v.naam)} · ${Math.round(vermogen(v.id)).toLocaleString('nl-NL')} kW${spel.voertuigen[v.id] ? ` · ${spel.voertuigen[v.id]} in bezit` : ` · ${S.euroKort(v.prijs)}`}</option>`).join('')}</select></td>
          <td><input type="number" min="0" max="6" value="${q.n}" data-wijzig="vr-n" data-id="${a.id}" data-k="${k}" data-j="${j}" style="width:4em"> ×</td></tr>`).join('')}</table>
        <div class="rij"><button class="knop klein" data-actie="vr-loc-erbij" data-id="${a.id}" data-k="${k}">＋ loc erbij</button>
          <span class="chip ${genoeg ? 'goed' : 'fout'}">${Math.round(kw).toLocaleString('nl-NL')} van ${nodig.toLocaleString('nl-NL')} kW nodig</span>${teVroeg ? '<span class="chip fout">vertrekt voordat de wagons gelost zijn</span>' : ''}</div>
        ${x.locs.length ? `<div class="foto">${schets([...x.locs.flatMap(q => Array(q.n).fill(q.id)), ...Array(Math.min(a.wagons, 8)).fill('goederenwagen')], 'trein', { breed: 460 })}</div>` : ''}</div>`;
    };
    const ok = ['heen', 'terug'].every(k => kz[k].locs.reduce((s2, q) => s2 + vermogen(q.id) * q.n, 0) >= nodigKw(k === 'heen' ? a.ton : tonTerug(a), vensterVan(kz[k].tijd))) && kz.terug.tijd >= vroegst;
    const tekort = locTekort(kz);
    return `<div class="kaartje"><div class="rij"><b>${esc(a.klant)}</b><span class="chip">${esc(a.lading)}</span><span class="chip">${FREQ[a.freq].naam}</span></div>
      <p>${esc(a.van.naam)} → ${esc(a.naar.naam)} · ${a.km} km · ${a.wagons} wagons (${a.lengte} m) · aanvraag geldig nog ${Math.max(0, a.tot - spel.dag)} dag(en)</p>
      <p class="klein">De wagons zijn van de klant. Lossen duurt <b>${a.losUren} uur</b>; daarna gaan de wagons ${a.retour === 'vol' ? '<b>vol met andere lading</b> terug (betaalt 60% extra)' : '<b>leeg</b> (lichter) terug'} naar ${esc(a.van.naam)}. Tussendoor kunnen je locs iets anders doen. Per rit kies je zelf de locs, ook verschillende typen.</p>
      ${leg('heen', 'Heen', a.ton, a.van.naam, a.naar.naam)}${leg('terug', 'Terug', tonTerug(a), a.naar.naam, a.van.naam)}
      ${tekort.length ? `<p class="klein">Nog te kopen: ${tekort.map(([id, n]) => `${n} × ${esc(TYPE[id].naam)}`).join(', ')} (${S.euroKort(tekort.reduce((s2, [id, n]) => s2 + n * TYPE[id].prijs, 0))})</p>` : ''}
      <button class="knop hoofd" data-actie="vracht-aan" data-id="${a.id}" ${ok ? '' : 'disabled'}>Aannemen: ${S.euroKort(vergoedingRetour(a, vensterVan(kz.heen.tijd)))} per keer heen en terug</button></div>`;
  };
  return `<h2>Goederenvervoer</h2><p class="chip">Vertrouwen van klanten: niveau ${vrachtNiveau(spel) + 1} van 5 · ${spel.vrachtRitten || 0} rit(ten) gereden</p>${vrachtKortLopend()}
    ${lijst.length ? lijst.map(kaart_).join('') : '<p>Er zijn nu geen aanvragen. Er komen er regelmatig nieuwe bij.</p>'}`;
};
// welke locs moet je nog kopen voor deze keuze (per type: het meeste dat in één tijdvak tegelijk nodig is, min wat vrij is)
function locTekort(kz) {
  const per = new Map();
  for (const k of ['heen', 'terug']) { const v = vensterVan(kz[k].tijd); for (const q of kz[k].locs) { const sl = q.id + '|' + v; per.set(sl, (per.get(sl) || 0) + q.n); } }
  const tekort = new Map();
  for (const [sl, n] of per) { const [id, v] = sl.split('|'); const vrij = Math.max(0, inzetbaar(spel, id) - locsBezet(id, v)); tekort.set(id, Math.max(tekort.get(id) || 0, n - vrij)); }
  return [...tekort].filter(([, n]) => n > 0);
}
// formulier voor een eenmalige of terugkerende bijzondere dienst: datum/dagen, vertrek, pendelen, langere stops, prijs
// nieuwe lijn, laagfrequent: per richting een aantal vertrektijden, per tijd (optioneel) de dagen
function nieuwLaagBlok(d) {
  const twee = (d.richting || 'beide') === 'beide';
  d.laag = d.laag || { 0: [{ t: 540, dagen: null }, { t: 900, dagen: null }], 1: [{ t: 600, dagen: null }, { t: 960, dagen: null }] };
  const rij = r => `<h4>${r ? 'Terug' : 'Heen'} vanaf ${esc(r ? d.haltes[d.haltes.length - 1].naam : d.haltes[0].naam)}</h4>
    <label class="veld">Aantal tijdstippen per dag<input type="number" min="1" max="30" value="${d.laag[r].length}" data-wijzig="nlb-n" data-r="${r}" style="width:5em"></label>
    <table class="tabel klein">${d.laag[r].map((x, k) => `<tr><td><input type="time" value="${S.klok(x.t)}" data-wijzig="nlb-t" data-r="${r}" data-k="${k}"></td>
      <td>${DAG_KORT.map((dn, i) => `<button class="knop klein ${!x.dagen || x.dagen.includes(i) ? 'hoofd' : ''}" data-actie="nlb-dag" data-r="${r}" data-k="${k}" data-d="${i}">${dn}</button>`).join('')}</td>
      <td>${!x.dagen ? 'elke dag' : x.dagen.length + '× per week'}</td></tr>`).join('')}</table>`;
  return `<div class="kaartje">${rij(0)}${twee ? rij(1) : ''}</div>`;
}
// nieuwe lijn, eenmalig: dag en tijd van vertrek (en eventueel een terugrit dezelfde dag)
function nieuwEenmaligBlok(d) {
  d.een = d.een || { dag: spel.dag + 7, t: 600, terug: (d.richting || 'beide') === 'beide' ? 960 : null };
  return `<div class="kaartje raster2"><label class="veld">Dag<select data-wijzig="nle-dag">${Array.from({ length: 120 }, (_, i) => spel.dag + 1 + i).map(dg => `<option value="${dg}" ${dg === d.een.dag ? 'selected' : ''}>${S.datumTekst(dg)}</option>`).join('')}</select></label>
    <label class="veld">Vertrek ${esc(d.haltes[0].naam)}<input type="time" value="${S.klok(d.een.t)}" data-wijzig="nle-t"></label>
    ${(d.richting || 'beide') === 'beide' ? `<label class="veld">Terugrit (leeg = geen)<input type="time" value="${d.een.terug != null ? S.klok(d.een.terug) : ''}" data-wijzig="nle-terug"></label>` : ''}</div>`;
}
function bijzonderFormulier(d) {
  const nb = d.nb || (d.nb = { over: 14, tijd: '10:00', keer: 0, keertijd: 20, dagen: [5, 6], wacht: {}, prijs: Math.round(gewonePrijs(d.modus, d.route.lengte / 1000) * 1.8) });
  const typen = [...typenVoor(d.modus), ...museumTypen(spel.jaar).filter(t => t.modus === d.modus), ...Object.keys(spel.voertuigen).map(id => TYPE[id]).filter(t => t?.modus === d.modus)]
    .filter((t, i, a) => t && a.indexOf(t) === i && inzetbaar(spel, t.id) > 0);
  if (!typen.some(t => t.id === nb.type)) nb.type = typen[0]?.id;
  const [hh, mm] = nb.tijd.split(':').map(Number), eerste = hh * 60 + mm, n = d.haltes.length;
  let tijden = null, ritten = { heen: [eerste], terug: [] };
  if (nb.type) { const tmp = { modus: d.modus, typeId: nb.type, haltes: d.haltes, route: d.route, interval: { vroeg: 999, ochtendspits: 999, dal: 999, avondspits: 999, avond: 999 }, eerste: 0, laatste: 0, offset: 0, richting: 'beide',
      halteWacht: Object.fromEntries(Object.entries(nb.wacht).flatMap(([i, m]) => +m > 0 ? [[`0:${i}`, +m], [`1:${n - 1 - i}`, +m]] : [])) };
    try { S.herbereken(tmp); tijden = tmp.tr; ritten = pendel(eerste, +nb.keer || 0, +nb.keertijd || 15, tmp.duur); } catch { /* geen route */ } }
  const dag = d.dienst === 'eenmalig' ? spel.dag + Math.max(1, Math.min(120, +nb.over || 14)) : null;
  const verwacht = nb.type && tijden ? belangstelling(spel, { prijs: +nb.prijs, dag: dag ?? (spel.dag + ((5 - S.weekdag(spel.dag) + 7) % 7)), haltes: d.haltes, typeId: nb.type, modus: d.modus, lengteKm: d.route.lengte / 1000,
    ritten: ritten.heen.length + ritten.terug.length, terugkerend: d.dienst === 'bijzonder' }, D.plaatsen) : 0;
  const veld = (k, label, attr) => `<label class="veld">${label}<input data-wijzig="nb-veld" data-k="${k}" value="${esc(String(nb[k]))}" ${attr}></label>`;
  return `<div class="kaartje">
    <div class="raster2">${d.dienst === 'eenmalig' ? veld('over', `Over hoeveel dagen <span class="klein">(${S.datumTekst(dag)})</span>`, 'type="number" min="1" max="120"') : `<div class="veld"><label>Rijdt op</label><div class="rij">${DAGNAAM.map((n, i) => `<label class="rij klein"><input type="checkbox" data-wijzig="nb-dag" data-w="${i}" ${nb.dagen.includes(i) ? 'checked' : ''}>${n}</label>`).join('')}</div></div>`}
      ${veld('tijd', 'Eerste vertrek', 'type="time"')}${veld('keer', 'Keer heen en terug <span class="klein">(0 = alleen heen)</span>', 'type="number" min="0" max="12"')}${veld('keertijd', 'Keertijd (min)', 'type="number" min="5" max="180"')}
      ${veld('prijs', 'Prijs per persoon €', 'type="number" min="0" step="1"')}</div>
    <div class="veld"><label>Materieel (in bezit en inzetbaar)</label><select data-wijzig="nb-veld" data-k="type">${typen.map(t => `<option value="${t.id}" ${t.id === nb.type ? 'selected' : ''}>${esc(t.naam)}${isMuseum(t, spel.jaar) ? ' (museum/klassieker)' : ''} · ${inzetbaar(spel, t.id)} inzetbaar</option>`).join('') || '<option value="">— geen materieel: koop eerst bij Vloot (ook tweedehands) —</option>'}</select></div>
    ${tijden ? `<table class="tabel"><tr><th>Halte</th><th class="getal">heen</th>${ritten.terug.length ? '<th class="getal">terug</th>' : ''}<th class="getal">extra stop (min)</th></tr>${d.haltes.map((h, i) => `<tr><td>${esc(h.naam)}</td>
      <td class="getal">${S.klok(eerste + Math.round(tijden[0][i] / 60))}</td>${ritten.terug.length ? `<td class="getal">${S.klok(ritten.terug[0] + Math.round(tijden[1][n - 1 - i] / 60))}</td>` : ''}
      <td class="getal">${i > 0 && i < n - 1 ? `<input type="number" min="0" max="120" style="width:4em" data-wijzig="nb-wacht" data-i="${i}" value="${nb.wacht[i] || 0}">` : ''}</td></tr>`).join('')}</table>
      <p class="klein">${ritten.heen.length + ritten.terug.length} rit(ten): heen ${ritten.heen.map(S.klok).join(', ')}${ritten.terug.length ? ` · terug ${ritten.terug.map(S.klok).join(', ')}` : ''}. Verwacht ongeveer <b>${verwacht}</b> reizigers per rit${d.dienst === 'bijzonder' ? ' op een weekenddag' : ''}. Klassiekers en museummaterieel trekken veel meer mensen, die er ook meer voor over hebben.</p>` : ''}
    <div class="rij"><button class="knop hoofd" data-actie="bijzonder-maak" ${nb.type && (d.dienst === 'eenmalig' || nb.dagen.length) ? '' : 'disabled'}>${d.dienst === 'eenmalig' ? 'Rit uitschrijven' : 'Dienst starten'}</button><button class="knop" data-actie="lijn-annuleer">Annuleren</button></div></div>`;
}
// naam in de vloot: het standaardinterieur heet '...1' zodra er genummerde varianten zijn
function vlootNaam(id) {
  const t = TYPE[id]; if (!t) return id;
  const b = basisId(id), auto = (spel.series || []).some(x => x.basis === b && x.auto);
  return id === b && auto ? `${kortNaam(b)}1 <span class="klein">(${esc(t.naam)})</span>` : esc(t.naam) + (t.serie && b !== id ? ` <span class="klein">(${esc(TYPE[b]?.naam || '')})</span>` : '');
}
// nog te koop als kopie: tot 10 jaar na de laatste levering (zodat een samengestelde trein nog uit te breiden is)
const kopieMag = t => !!t && spel.jaar <= (TYPE[basisId(t.id)]?.tot ?? t.tot) + 10 && spel.jaar >= (TYPE[basisId(t.id)]?.van ?? t.van);
const verkoopWaarde = id => { const t = TYPE[id], lt = S.leeftijden(spel)[id]; return Math.min(t.prijs * 0.45, marktPrijs(t, lt?.gem || 0, 'matig')); };
function vlootKaart(id) {
  const t = TYPE[id], n = spel.voertuigen[id] || 0, lt = S.leeftijden(spel)[id], kl = t.soort === 'loc' || t.soort === 'wagon' ? [] : klassenVan(serieInrichting(id), id, t.modus);
  const vz = t.soort === 'loc' ? [] : voorzieningen(id), bd = buitenDienst(spel, id);
  return `<div class="kaartje vlootkaart"><div class="rij"><b>${vlootNaam(id)}</b><span class="chip">${n} in bezit${bd ? ` · ${bd} in revisie` : ''}</span></div>
    <div class="foto">${schets([id], t.modus, { breed: 460 })}</div>${aandrijving(id, t.modus)}
    <p class="klein">${kl.length ? kl.map(k => `${KLASSE_NAAM[k.klasse]}: <b>${k.zit}</b> ${String(k.stoel).startsWith('slaap:') ? 'bedden' : 'zit'}${k.sta ? ` + ${k.sta} sta` : ''} (${stoelNaam(k.stoel)})`).join(' · ') + '<br>' : ''}${vz.length ? [...new Set(vz.map(v => v.naam))].join(', ') + '<br>' : ''}
      ${t.vmax} km/u · ${vermogen(id) ? Math.round(vermogen(id)).toLocaleString('nl-NL') + ' kW · ' : ''}${Math.round(massa(id))} t · ${lt ? `gem. ${Math.round(lt.gem)} van ${lt.leven} jaar${S.ouderdomFactor(lt.gem, lt.leven) > 1.15 ? ' ⚠ duurder onderhoud' : ''}` : ''}</p>
    <div class="rij"><input id="vk-${id}" type="number" min="1" max="200" value="1" style="width:4em">
      ${kopieMag(t) ? `<button class="knop klein hoofd" data-actie="vloot-kopie" data-type="${id}" title="Nieuw, met precies dit interieur">Kopie kopen (${S.euroKort(t.prijs)}/st)</button>` : '<span class="klein">niet meer nieuw te koop</span>'}
      <button class="knop klein" data-actie="vloot-verkoop" data-type="${id}" ${n - bd > 0 ? '' : 'disabled'}>Verkopen (${S.euroKort(verkoopWaarde(id))}/st)</button>
      ${t.soort === 'loc' || t.soort === 'wagon' ? '' : `<button class="knop klein" data-actie="serie-open" data-type="${id}">Interieur…</button>`}</div></div>`;
}
// eigen materieel dat niet meer nieuw te koop is (tweedehands klassiekers, oude locs en rijtuigen)
function eigenOudBlok() {
  const getoond = new Set([...beschikbaar(spel.jaar), ...beschikbaarLos(spel.jaar), ...museumTypen(spel.jaar)].map(v => v.id));
  const ids = Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && TYPE[id] && !TYPE[id].samen && !TYPE[id].basis && !getoond.has(id));
  if (!ids.length) return '';
  return `<h3>Eigen oud materieel</h3><table class="tabel">${ids.map(id => `<tr><td><b>${esc(TYPE[id].naam)}</b><br><span class="klein">${TYPE[id].van}–${TYPE[id].tot} · ${TYPE[id].vmax} km/u${buitenDienst(spel, id) ? ` · ${buitenDienst(spel, id)} buiten dienst (revisie)` : ''}</span></td><td class="getal">${spel.voertuigen[id]}</td>
    <td><button class="knop" data-actie="verkoop" data-type="${id}">−</button></td></tr>`).join('')}</table>`;
}
// loc-wissel aan de grens: per land op de route een eigen loc (alleen bij een loc-getrokken trein)
const landNaam = c => LANDEN[c]?.naam || ['Nederland', 'België', 'Luxemburg', 'Duitsland', 'Frankrijk'][c] || '?';
function locWisselBlok(l) {
  if (l.modus !== 'trein' || l.ai) return '';
  const locs = delenVan(l.typeId).filter(c => TYPE[c]?.soort === 'loc'); if (!locs.length) return '';
  const frac = l._landFrac || landVerdeling(net, l); if (frac.length < 2 && !Object.keys(l.locWissel || {}).length) return '';
  const w = l.locWissel || {}, eigen = TYPE[locs[0]]?.naam || '';
  // systemen per land op deze route, om te tonen welke locs er kunnen
  const sysIn = land => [...new Set((l.route?.takken || []).map(i => i >= 1e6 ? net.eigen[i - 1e6] : net.takken[i]).filter(t => t && !t.dienst && (t.land || 0) === land).map(t => spanningVan(spel, t)))];
  const kandidaten = [...beschikbaarLos(spel.jaar).filter(v => v.modus === 'trein'), ...Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0).map(id => TYPE[id])].filter((v, i, a) => v?.soort === 'loc' && a.indexOf(v) === i);
  const nodig = nodigLijn(l);
  return `<div class="kaartje"><b>Loc per land (loc-wissel aan de grens)</b>
    <p class="klein">Aan elke grens waar de loc verandert, wordt de loc afgekoppeld en een andere aangekoppeld (+${WISSEL_MIN} min). De afgekoppelde loc wacht daar op de trein terug, dus per land heb je alleen locs nodig voor dat deel van de rit (plus één die wacht).</p>
    ${frac.map(({ land, km }) => { const sys = sysIn(land), past = kandidaten.filter(v => sys.every(x => kanOp(v.id, x)));
      return `<label class="veld klein">${landNaam(land)} · ${komma(km)} km <select data-wijzig="lw-kies" data-id="${l.id}" data-land="${land}">
        <option value="">eigen loc (${esc(eigen)})${sys.every(x => kanOp(locs[0], x)) ? '' : ' — kan hier niet'}</option>
        ${past.map(v => `<option value="${v.id}" ${w[land] === v.id ? 'selected' : ''}>${esc(v.naam)}${spel.voertuigen[v.id] ? ` (${spel.voertuigen[v.id]} in bezit)` : ` · ${S.euroKort(v.prijs)}`}</option>`).join('')}</select></label>`; }).join('')}
    ${Object.keys(w).length ? `<p class="klein">${l._wissels || 0} loc-wissel(s) per rit. Nodig: ${Object.entries(nodig).filter(([c]) => TYPE[c]?.soort === 'loc').map(([c, n]) => `${n} × ${esc(TYPE[c].naam)}`).join(', ')}.</p>` : ''}</div>`;
}
// samenstelling van een treinlijn: treinstellen koppelen, of een loc met losse rijtuigen en eventueel een stuurstandrijtuig
function samenstellingBlok(l) {
  if (!RAILMODI.includes(l.modus)) return '';
  const o = l._sam || (l._sam = [...delenVan(l.typeId)]);
  const nu = JSON.stringify(o) === JSON.stringify(delenVan(l.typeId));
  const t = !o.length ? null : o.length > 1 ? samenstelling(o) : TYPE[o[0]];
  const kiesbaar = [...beschikbaar(spel.jaar, l.modus), ...beschikbaarLos(spel.jaar).filter(x => x.modus === l.modus), ...(spel.series || []).map(x => TYPE[x.id]).filter(x => x && x.modus === 'trein')]
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
  const auto = !(naam || '').trim();
  if (auto) { // geen eigen naam: nummeren (het standaardinterieur is nummer 1)
    let k = 2; const kort = kortNaam(basis); while ((spel.series || []).some(x => x.naam === kort + k)) k++;
    const nieuw = { id: S.nieuwId('m'), basis, naam: kort + k, auto: true, ink: JSON.parse(JSON.stringify({ wagons: ink.wagons, voorz: ink.voorz || [] })) };
    spel.series.push(nieuw); registreerSeries(spel.series); return nieuw.id;
  }
  let n = naam.trim().slice(0, 30), k = 2;
  const basisNaam = n;
  while (spel.series.some(x => x.naam === n) || Object.values(TYPE).some(t => !t.serie && t.naam === n)) n = `${basisNaam}${k++}`;
  const nieuw = { id: S.nieuwId('m'), basis, naam: n, ink: JSON.parse(JSON.stringify({ wagons: ink.wagons, voorz: ink.voorz || [] })) };
  spel.series.push(nieuw); registreerSeries(spel.series);
  return nieuw.id;
}

// ---------------------------------------------------------------- bijzondere ritten
function maakBijzonder({ nr, naam, modus, typeId, haltes, route, dag, vertrek, prijs, charter = false, bod = 0, personen = 0, wie = '', soort = 'eenmalig', heen, terug, dagen, vanaf, tot, wacht }) {
  const l = S.maakLijn(spel, { nr, naam, modus, typeId, haltes, route, interval: { vroeg: 999, ochtendspits: 999, dal: 999, avondspits: 999, avond: 999 } });
  if (wacht) { const n = haltes.length; l.halteWacht = {}; for (const [i, m] of Object.entries(wacht)) if (+m > 0) { l.halteWacht[`0:${i}`] = +m; l.halteWacht[`1:${n - 1 - i}`] = +m; } }
  l.bijzonder = { soort, dag, vertrek, heen: heen || [vertrek], terug: terug || [], dagen, vanaf, tot, prijs, charter, bod, personen, wie, gepland: spel.dag, ingeschreven: 0 };
  bijzonderBijwerken(l);
  return l;
}
// verwachte reizigers per rit (eenmalig groeit naar de dag toe, terugkerend is gewoon de vraag van die dag)
const ritInfo = (l, dag) => ({ ...l.bijzonder, dag, haltes: l.haltes, typeId: l.typeId, modus: l.modus, lengteKm: l.lengteKm, ritten: aantalRitten(l.bijzonder), terugkerend: l.bijzonder.soort === 'bijzonder' });
function bijzonderBijwerken(l) {
  const b = l.bijzonder;
  l.echt = { v: vertrekOpDag(l, spel.dag) }; l.aangepast = false;
  S.herbereken(l);
  l.actief = rijdtOp(b, spel.dag);
  if (b.charter) return;
  if (b.soort === 'bijzonder') b.ingeschreven = Math.min(S.capaciteit(l), belangstelling(spel, ritInfo(l, spel.dag), D.plaatsen));
  else if (spel.dag <= b.dag) b.ingeschreven = inschrijvingen(spel, { ...l, bijzonder: ritInfo(l, b.dag) }, D.plaatsen, S.capaciteit(l));
}
// na een rijdag: afrekenen; eenmalige ritten daarna opruimen, terugkerende blijven staan
function bijzonderAfrekenen() {
  for (const l of [...spel.lijnen]) {
    if (!l.bijzonder) continue;
    const b = l.bijzonder, gisteren = spel.dag - 1, eenmalig = b.soort !== 'bijzonder';
    if (eenmalig && spel.dag <= b.dag) { bijzonderBijwerken(l); continue; }
    if (!eenmalig && !rijdtOp(b, gisteren)) { if (b.tot != null && spel.dag > b.tot) spel.lijnen.splice(spel.lijnen.indexOf(l), 1); else bijzonderBijwerken(l); continue; }
    const t = TYPE[l.typeId], ritten = aantalRitten(b);
    const heeft = Object.entries(nodigPer(l.typeId)).every(([c, k]) => inzetbaar(spel, c) >= k);
    const reizigers = b.charter ? b.personen : Math.min(b.ingeschreven, S.capaciteit(l)) * ritten;
    const opbrengst = !heeft ? 0 : b.charter ? b.bod : reizigers * b.prijs;
    const kosten = heeft ? ritKosten(spel, l) * (1 + 0.7 * (ritten - 1)) : 0; // opstoken/voorbereiden één keer per dag
    spel.geld += opbrengst - kosten; spel.maand.kaartjes += opbrengst; spel.maand.overig += kosten;
    if (b.charter) spel.reputatie = Math.min(100, spel.reputatie + (heeft ? 1 : -4));
    if (l.vracht && heeft) { const voor = vrachtNiveau(spel); spel.vrachtRitten = (spel.vrachtRitten || 0) + 1; if (vrachtNiveau(spel) > voor) melding(`Klanten zijn tevreden over je goederentreinen: er komen grotere opdrachten (niveau ${vrachtNiveau(spel) + 1}).`, 8000); }
    (spel.bijzonderArchief ||= []).unshift({ naam: l.naam, dag: eenmalig ? b.dag : gisteren, reizigers, opbrengst, kosten, type: t?.naam });
    spel.bijzonderArchief.length = Math.min(spel.bijzonderArchief.length, 20);
    if (eenmalig || Math.random() < 0.3) melding(heeft ? `${eenmalig ? 'Bijzondere rit' : 'Museumlijn'} ${l.naam} gereden: ${reizigers} reizigers${ritten > 1 ? ` in ${ritten} ritten` : ''}, resultaat ${S.euro(opbrengst - kosten)}.` : `${l.naam} kon niet rijden: geen ${t?.naam || 'materieel'} meer in bezit.`, 7000);
    if (eenmalig || (b.tot != null && spel.dag > b.tot)) spel.lijnen.splice(spel.lijnen.indexOf(l), 1); else bijzonderBijwerken(l);
  }
}
const DAGNAAM = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const wanneerTekst = b => b.soort === 'bijzonder' ? `elke ${(b.dagen || []).map(d => DAGNAAM[d]).join(', ')}` : S.datumTekst(b.dag, true);
function bijzonderTabel() {
  const lijst = spel.lijnen.filter(l => l.bijzonder);
  const rij = l => { const b = l.bijzonder, cap = S.capaciteit(l), n = b.charter ? b.personen : b.ingeschreven;
    return `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td>${esc(l.naam)}<br><span class="klein">${wanneerTekst(b)} · ${rittenVan(b)[0].map(S.klok).join(', ')}${b.terug?.length ? ` (terug ${b.terug.map(S.klok).join(', ')})` : ''} · ${esc(TYPE[l.typeId]?.naam || '')}${b.charter ? ` · charter ${esc(b.wie)}` : ''}</span></td>
      <td class="getal">${n} / ${cap}<br><span class="klein">${b.charter ? S.euroKort(b.bod) : S.euroKort(n * b.prijs)}</span></td></tr>`; };
  const arch = (spel.bijzonderArchief || []).slice(0, 5);
  return `${lijst.length ? `<table class="tabel"><tr><th>Rit</th><th class="getal">per rit</th></tr>${lijst.map(rij).join('')}</table>` : '<p class="klein">Geen bijzondere ritten gepland.</p>'}
    ${arch.length ? `<p class="klein">Gereden: ${arch.map(a => `${esc(a.naam)} (${a.reizigers} reizigers, ${S.euroKort(a.opbrengst - a.kosten)})`).join(' · ')}</p>` : ''}
    <p class="klein">Een eenmalige rit of een terugkerende bijzondere dienst (bv. museumlijn in het weekend) plan je met <b>＋ Lijn</b>: klik de route aan en kies bij <b>Soort dienst</b>. Museummaterieel en klassiekers koop je bij <b>Vloot</b> (ook op de tweedehandsmarkt).</p>`;
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
  if (f) { el.innerHTML = f(paneelData); koppel(el); }
}

const PANELEN = {
  // Eén rit (na klikken op een voertuig): welke trein/bus, van wie, tijden per halte, frequentie, en aanpassen of verzoeken
  rit(v) {
    const l = v.lijn, r = v.r || 0, eigen = !l.ai;
    const n = l.haltes.length;
    const volgorde = r ? [...l.haltes].reverse() : l.haltes;
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
    // vaste wachttijden uit de spoorplanner (minuten opgeteld tot dienstregelingstijd s, in seconden)
    const pw = l._ritWacht?.get(`${r}:${v.vertrek}`) || [], vóór = sec => pw.reduce((a, q) => a + (q.t < sec - 0.5 ? q.w : 0), 0) / 60;
    let seg = -1;
    for (let i = 0; i < n - 1; i++) if (v.vertrek + t[i] / 60 + extra(i) + vóór(t[i] + extra(i) * 60 + 1) <= nu) seg = i;
    const klaar = nu > v.vertrek + t[n - 1] / 60 + vóór(Infinity);
    const nuAan = !v.wacht && seg >= 0 && !klaar ? rr.segmenten[seg] : null;
    const hT = MODI[l.modus].halteTijd;
    const oud = l._vorigeTr?.[r];
    const rijen = volgorde.map((h, i) => {
      const verblijf = i > 0 && i < n - 1 ? hT : 0;
      const aan = v.vertrek + (t[i] - verblijf) / 60 + vóór(t[i] - verblijf), weg = v.vertrek + t[i] / 60 + extra(i) + vóór(t[i] + extra(i) * 60 + 1);
      const voorbij = weg < nu, hier = aan <= nu && nu <= weg + 0.5;
      const kruisW = Math.round(vóór(t[i] + extra(i) * 60 + 1) - vóór(t[i] - verblijf)), planVoor = vóór(t[i] - verblijf);
      const hr = rr.haltes[i];
      const traag = eigen && i && l.trMin ? Math.round((t[i] - verblijf - l.trMin[r][i]) / 60) : 0;
      const delta = oud && oud[i] != null ? Math.round((t[i] - oud[i]) / 60) : 0;
      const aanVeld = !i ? '' : eigen ? `<input type="time" value="${S.klok(Math.round(aan - planVoor))}" data-wijzig="aankomst" data-id="${l.id}" data-k="${r}:${i}" data-dep="${v.vertrek}" title="gewenste aankomst; later = rustiger rijden" style="width:5.6em">` : S.klok(Math.round(aan));
      return `<tr class="${voorbij ? 'voorbij' : ''}${hier ? ' hier' : ''}"><td>${esc(h.naam)}${traag > 0 ? ` <span class="chip" title="rijdt rustiger dan het maximum">+${traag}′ rustig</span>` : ''}${kruisW > 0 ? ` <span class="chip" title="vaste wachttijd uit het spoorplan: een tegentrein op enkelspoor of een voorganger">+${kruisW}′ kruisen</span>` : ''}${delta ? ` <span class="chip let" title="verschil door je laatste wijziging">${delta > 0 ? '+' : ''}${delta}′</span>` : ''}</td><td class="getal">${aanVeld}</td><td class="getal">${i < n - 1 ? S.klok(Math.round(weg)) : ''}</td>
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
      <p>${v.wacht ? (v.klaarVandaag ? 'Laatste rit' : 'Volgende rit') : 'Deze rit'}: vertrek <b>${S.klok(v.vertrek)}</b> uit ${esc(volgorde[0].naam)}, aankomst <b>${S.klok(Math.round(v.vertrek + t[n - 1] / 60))}</b> in ${esc(volgorde[n - 1].naam)}.</p>
      <table class="tabel rittabel"><tr><th>Halte</th><th class="getal">aan</th><th class="getal">vertrek</th><th class="getal" title="instappers + / uitstappers −">in/uit</th><th>${eigen ? 'extra wachten (min)' : ''}</th></tr>${rijen}</table>
      ${reizigersBlok(rr, nuAan, v)}
      <h3>Hoe vaak</h3>
      <p class="klein">Eerste rit ${vt.length ? S.klok(vt[0]) : '—'}, laatste rit ${vt.length ? S.klok(vt[vt.length - 1]) : '—'} · ${vt.length} ritten per dag in deze richting.</p>
      <table class="tabel">${freq}</table>
      ${eigen ? `<h3>Aanpassen</h3>
        <div class="raster2"><label class="veld">Hele lijn verschuiven (min)<input type="number" min="-30" max="30" value="${l.offset}" data-wijzig="offset" data-id="${l.id}"></label>
        ${twee ? `<button class="knop klein" data-actie="terug-direct" data-id="${l.id}" title="de terugrit vertrekt zodra het voertuig is aangekomen en gekeerd: zo min mogelijk voertuigen">Terugrit direct na aankomst</button>` : ''}
      <label class="veld">Eerste rit<input type="time" value="${S.klok(l.eerste)}" data-wijzig="eerste" data-id="${l.id}"></label>
        <label class="veld">Laatste rit<input type="time" value="${S.klok(l.laatste)}" data-wijzig="laatste" data-id="${l.id}"></label></div>
        <p class="klein">Frequentie per periode stel je in bij de <button class="knop klein" data-actie="toon-lijn" data-id="${l.id}">hele lijn</button>.</p>
        <h3>Materieel</h3>
        ${mixSamenvatting(l)}<p><button class="knop klein" data-actie="toon-lijn" data-id="${l.id}">Materieel van de lijn beheren</button></p>`
      : `<h3>Verzoek aan ${esc(l.vervoerderNaam)}</h3>
        <p class="klein">Deze lijn is niet van jou. Je kunt vragen om iets aan te passen; ${esc(l.vervoerderNaam)} beslist (goodwill nu ${spel.goodwill[l.vervoerder] ?? 0}). Een vergoeding helpt.</p>
        <div class="raster2"><label class="veld">Wat<select id="rv-soort"><option value="schuif">Hele lijn eerder/later</option><option value="wacht">Langer wachten bij een halte</option></select></label>
        <label class="veld">Halte<select id="rv-halte">${volgorde.slice(0, -1).map((h, i) => `<option value="${i}">${esc(h.naam)}</option>`).join('')}</select></label>
        <label class="veld">Minuten (− = eerder)<input id="rv-min" type="number" min="-15" max="15" value="2"></label>
        <label class="veld">Vergoeding €/jaar<input id="rv-geld" type="number" min="0" step="5000" value="0"></label></div>
        <button class="knop hoofd" data-actie="rit-verzoek">Verzoek sturen</button>`}`;
  },
  lijnen() {
    const rijen = spel.lijnen.filter(l => !l.bijzonder).map(l => {
      const st = l.stat, res = st ? st.opbrengst - st.kosten : 0;
      const tekort = S.beschikbaarVoor(spel, l) < l.nodig;
      return `<tr data-actie="toon-lijn" data-id="${l.id}" style="cursor:pointer"><td><span class="lijnnr" style="background:${l.actief ? lijnKleur(l) : '#888'}">${esc(l.nr)}</span></td>
        <td>${esc(l.naam || l.haltes[0].naam + ' – ' + l.haltes[l.haltes.length - 1].naam)}<br><span class="klein">${MODI[l.modus].naam} · ${lijnModellen(l)} · ${l.haltes.length} haltes${l.wacht ? ' · wacht op ProRail' : ''}${tekort ? ' · <b style="color:var(--rood)">materieel tekort</b>' : ''}</span></td>
        <td class="getal">${st ? Math.round(st.reizigers).toLocaleString('nl-NL') : '—'}<br><span class="klein" style="color:${res < 0 ? 'var(--rood)' : 'var(--groen)'}">${st ? S.euroKort(res) : ''}</span></td></tr>`;
    }).join('');
    return `<h2>Je lijnen</h2><p class="klein">Reizigers en resultaat deze maand. Klik op een lijn voor de dienstregeling.</p>
      ${spel.lijnen.length ? `<table class="tabel"><tr><th>Lijn</th><th>Route</th><th class="getal">Reizigers</th></tr>${rijen}</table>` : '<p>Nog geen lijnen. Kies in de balk onderin een soort vervoer (bijv. <b>Trein → Nieuwe treinlijn</b>) en klik haltes of stations op volgorde aan.</p>'}
      <button class="knop hoofd" data-actie="tool" data-tool="lijn">＋ Nieuwe lijn</button>
      <h3>Goederenvervoer</h3>${vrachtKort()}
      <h3>Bijzondere ritten</h3>${bijzonderTabel()}`;
  },
  lijn(l) {
    if (!l) return '';
    if (l.bijzonder) { const b = l.bijzonder, n = b.charter ? b.personen : b.ingeschreven, [heen, terug] = rittenVan(b), ritten = heen.length + terug.length;
      const tr = r => l.tr?.[r] || l.t, wacht = (r, i) => (l.halteWacht?.[`${r}:${i}`] || 0);
      const tabel = (r, v) => { const volg = r ? [...l.haltes].reverse() : l.haltes;
        return `<table class="tabel"><tr><th>${r ? 'Terug' : 'Heen'}</th>${v.map(x => `<th class="getal">${S.klok(x)}</th>`).join('')}</tr>${volg.map((h, i) => `<tr><td>${esc(h.naam)}${wacht(r, i) ? ` <span class="klein">(+${wacht(r, i)} min stop)</span>` : ''}</td>${v.map(x => `<td class="getal">${S.klok(x + Math.round(tr(r)[i] / 60))}</td>`).join('')}</tr>`).join('')}</table>`; };
      return `<h2><span class="lijnnr" style="background:${spel.kleur}">★</span> ${esc(l.naam)}</h2>
        <p>${b.soort === 'bijzonder' ? `Bijzondere dienst <b>${wanneerTekst(b)}</b>${b.tot != null ? ` tot ${S.datumTekst(b.tot)}` : ''}` : `Eenmalig op <b>${S.datumTekst(b.dag)}</b>`} · ${ritten} rit(ten) · ${esc(TYPE[l.typeId]?.naam || '')}${isMuseum(TYPE[l.typeId], spel.jaar) ? ' (museum)' : ''}</p>
        <p>${l.vracht ? `Goederentrein voor <b>${esc(b.wie)}</b>: ${l.vracht.wagons} wagons, ${l.vracht.ton} t, ${l.vracht.n} × ${esc(TYPE[l.vracht.loc]?.naam || '')} (${VENSTER[l.vracht.venster].naam}) · vergoeding ${S.euro(b.bod)} per rijdag (heen beladen, terug leeg of met lege wagons).` : b.charter ? `Charter voor ${esc(b.wie)}: ${b.personen} personen, opbrengst ${S.euro(b.bod)}.` : `${b.soort === 'bijzonder' ? 'Verwacht vandaag' : 'Ingeschreven'}: <b>${n}</b> per rit van ${S.capaciteit(l)} plaatsen à ${S.euro(b.prijs)} = ${S.euro(n * b.prijs * ritten)}${ritten > 1 ? ' voor alle ritten' : ''}.`} Verwachte kosten ${S.euro(ritKosten(spel, l) * (1 + 0.7 * (ritten - 1)))} per rijdag.</p>
        ${tabel(0, heen)}${terug.length ? tabel(1, terug) : ''}
        <button class="knop gevaar" data-actie="opheffen" data-id="${l.id}">${b.soort === 'bijzonder' ? 'Dienst stoppen' : 'Rit afblazen'}</button>`; }
    const t = TYPE[l.typeId];
    const typen = typenVoor(l.modus);
    const st = l.stat;
    const gedeeld = gedeeldeHaltes(l);
    const uniekeAI = [];
    for (const g of gedeeld) if (!uniekeAI.some(u => u.ai.sleutel === g.ai.sleutel && u.halte === g.halte)) uniekeAI.push(g);
    return `<h2><span class="lijnnr" style="background:${spel.kleur}">${esc(l.nr)}</span> ${esc(l.naam || '')}</h2>
      <p class="klein">${MODI[l.modus].naam} · ${l.lengteKm.toFixed(1).replace('.', ',')} km · rijtijd ${Math.round(l.duur / 60)} min · ${l.vertrek[0].length + l.vertrek[1].length} ritten per dag
      ${l.concessie ? ' · <span class="chip goed">concessie</span>' : ''} ${l.wacht ? `<span class="chip let">${l.wacht === 'stroom' ? 'rijdt niet: materieel past niet bij de bovenleiding' : 'wacht op ProRail'}</span>` : ''} ${!l.actief && !l.wacht ? '<span class="chip">gestopt</span>' : ''}</p>
      ${spoorplanTekst(l)}
      ${l._concept ? conceptBlok(l) : `<ol class="haltelijst">${l.haltes.map((h, i) => `<li>${esc(h.naam)} <span class="klein">+${Math.round(l.t[i] / 60)}′</span>${l.bijzonder ? '' : ` <button class="knop klein" data-actie="halte-weg" data-id="${l.id}" data-i="${i}" title="halte uit de lijn halen (eerst als concept)">✕</button>`}</li>`).join('')}</ol>
      ${l.bijzonder ? '' : `<button class="knop klein" data-actie="halte-erbij" data-id="${l.id}">＋ Station/halte toevoegen</button>`}`}
      ${richtingBlok(l)}
      ${(() => { const c = (l.echt && !l.aangepast) ? null : stroomCheck(spel, net, l); if (!c || (c.ok && !l.sleeploc)) return ''; return c.ok ? `<p class="chip">Sleeploc: ${esc(TYPE[l.sleeploc]?.naam || '')} over de stukken waar het eigen materieel niet kan <button class="knop klein" data-actie="sleeploc-weg" data-id="${l.id}">weg</button></p>`
        : `<div class="kaartje"><b style="color:var(--rood)">Kan niet rijden:</b> ${esc(TYPE[l.typeId]?.naam || '')} kan niet op ${c.probleem.map(p => `${p.naam} (${komma(p.km)} km)`).join(', ')}.
          <div class="rij"><button class="knop klein" data-actie="stroom-toon" data-id="${l.id}">Toon op de kaart</button>${aanlegKnop(l, c)}</div>
          ${c.probleem.some(p => p.sys !== 'geen') ? '<p class="klein">Op een andere spanning omschakelen kan gevolgen hebben voor andere treinen: klik op het spoor om te zien welke.</p>' : ''}
          Of kies hieronder ander materieel (bv. een meersysteemtrein)${delenVan(l.typeId).some(c => TYPE[c]?.soort === 'loc') && (l._landFrac || []).length > 1 ? ', wissel aan de grens van loc (zie Loc per land)' : ''}, of ${sleeplocKnoppen(l, c.probleem[0].sys === 'geen' ? null : c.probleem[0].sys) || 'een diesel-sleeploc'}</div>`; })()}
      ${l.aanbod ? (() => { const a = (spel.aanbiedingen || []).find(x => x.id === l.aanbod.id); const t = a ? toetsEisen(l, a) : { ok: false, redenen: ['aanbieding bestaat niet meer'] };
        return `<p class="chip ${t.ok ? 'goed' : 'fout'}">Subsidie ${a ? `${esc(a.a.naam)} – ${esc(a.b.naam)}: ${vergoedingTekst(a.vergoeding)}` : ''} · ${t.ok ? 'voldoet aan de eisen' : 'wordt niet uitbetaald: ' + esc(t.redenen.join('; '))}</p>`; })() : ''}
      <h3>Voertuigen op deze lijn</h3>${voertuigTabel(l)}
      <h3>Materieel</h3>
      ${l.modus === 'trein' ? `<label class="rij"><input type="checkbox" data-wijzig="spitsdubbel" data-id="${l.id}" ${l.spitsDubbel ? 'checked' : ''}> In de spits gekoppeld rijden (2 eenheden: dubbele capaciteit, meer materieel nodig)</label>` : ''}
      ${mixBlok(l)}
      ${samenstellingBlok(l)}${locWisselBlok(l)}
      <h3>Prijzen en catering</h3>${prijzenBlok(l)}
      <h3>Dienstregeling</h3>${dienstBlok(l)}
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
    treinGebiedBijwerken();
    const f = subFilter, provs = territorium?.prov || [];
    const passend = subsidieLijst();
    const chip = (w, v, aan, tekst) => `<label class="chipkeuze"><input type="checkbox" data-wijzig="${w}" value="${v}" ${aan ? 'checked' : ''}> ${tekst}</label>`;
    return `<h2>Subsidies</h2><p class="chip">Vertrouwen van de provincie: niveau ${subsidieNiveau(spel) + 1} van 5${spel.groot ? ' (grote vervoerder: grotere opdrachten, maar minder)' : ''} · ${spel.subsidieSucces || 0} opdracht(en) goed uitgevoerd</p>
      <p class="klein">De provincie wil verbindingen ontsluiten en rekent ze door: reizigers, kaartjes, kosten en investering. Minder reizigers = meer subsidie. Een nieuwe lijn die beide plaatsen bedient en aan de eisen voldoet, krijgt de startbijdrage (de investering, in 2 dagen) en daarna de doorlopende vergoeding zolang hij blijft voldoen.</p>
      <div class="kaartje"><b>Filter</b>
        <div class="rij" style="flex-wrap:wrap">${SUB_MODI.map(m => chip('sub-modus', m, f.modus.includes(m), MODI[m].naam)).join('')}</div>
        <div class="rij" style="flex-wrap:wrap"><label class="veld" style="margin:0">Land <select data-wijzig="sub-land"><option value="" ${!f.land ? 'selected' : ''}>Alle landen</option>${Object.entries(territorium?.landen || { NL: 'Nederland' }).map(([c, n]) => `<option value="${c}" ${c === f.land ? 'selected' : ''}>${esc(n)}${spoorLanden && !spoorLanden.has(c) ? ' (nog geen spoor: geen treinsubsidies)' : ''}</option>`).join('')}</select></label></div>
        ${!f.land ? '' : provs.length ? `<p class="klein" style="margin:4px 0 2px">${REGIO_NAAM[f.land] || 'Regio\'s'} in ${esc(territorium.landen[f.land] || f.land)} (niets gekozen = het hele land):</p><div class="rij" style="flex-wrap:wrap">${provs.map((p, i) => p.land === f.land ? chip('sub-prov', i, f.prov.includes(i), esc(p.naam)) : '').join('')}</div>` : '<p class="klein">Provincies laden nog…</p>'}
        <div class="rij"><button class="knop klein" data-actie="sub-alles">Filter wissen</button><button class="knop klein hoofd" data-actie="sub-meer">Meer aanbiedingen zoeken${f.prov.length || f.modus.length || f.land ? ' in deze selectie' : ''}</button></div>
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
  vracht: PANEEL_VRACHT,
  markt() {
    const lt = S.leeftijden(spel), alleAanbod = (spel.markt || []).filter(a => TYPE[a.typeId] && a.n > 0), aanbod = alleAanbod.filter(a => !marktFilter.size || marktFilter.has(vCat(a.typeId))).sort((a, b) => (b.soort === 'klassieker') - (a.soort === 'klassieker') || a.tot - b.tot);
    const rij = a => { const t = TYPE[a.typeId], f = S.ouderdomFactor(a.leeftijd, t.leven || 30), nieuw = t.prijs;
      return `<div class="kaartje"><div class="rij"><b>${a.soort === 'klassieker' ? '★ ' : ''}${esc(t.naam)}</b><span class="chip">${a.soort === 'klassieker' ? 'klassieker' : 'partij uit vlootvernieuwing'}</span></div>
        <div class="foto">${schets([a.typeId], t.modus, { breed: 460 })}</div>${aandrijving(a.typeId, t.modus)}
        <p class="klein">${a.n} stuks bij ${esc(a.van)} · ${a.leeftijd} jaar oud (levensduur ${t.leven || 30}) · <b>${STAAT[a.staat].naam}</b> · in dienst ${t.van}–${t.tot < 2100 ? t.tot : 'nu'}<br>
          <b>${S.euroKort(a.prijs)}</b> per stuk (nieuw ${S.euroKort(nieuw)}) · onderhoud en verbruik ongeveer <b>×${komma(f, 2)}</b> door ouderdom${a.staat === 'slecht' ? ' · <span style="color:var(--rood)">moet eerst een revisie krijgen voor het kan rijden</span>' : ''}
          · aanbieding verloopt over ${Math.max(0, a.tot - spel.dag)} dag(en)</p>
        <div class="rij"><label class="veld klein">Aantal<input id="mk-${a.id}" type="number" min="1" max="${a.n}" value="${a.n}" style="width:4.5em"></label><button class="knop hoofd" data-actie="markt-koop" data-id="${a.id}">Kopen</button></div></div>`; };
    const eigen = Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && TYPE[id] && !TYPE[id].samen).sort((a, b) => (lt[b]?.gem / lt[b]?.leven || 0) - (lt[a]?.gem / lt[a]?.leven || 0));
    const lopend = (spel.renovaties || []).filter(r => TYPE[r.typeId]);
    const revRij = id => { const t = TYPE[id], l = lt[id], f = l ? S.ouderdomFactor(l.gem, l.leven) : 1, wacht = wachtOpRevisie(spel, id), vrij = inzetbaar(spel, id) + wacht;
      return `<tr><td><b>${esc(t.naam)}</b><br><span class="klein">${spel.voertuigen[id]} stuks · gem. ${l ? Math.round(l.gem) : '?'}/${l?.leven || t.leven || 30} jaar · kosten ×${komma(f, 2)}${wacht ? ` · <b style="color:var(--rood)">${wacht} niet rijvaardig</b>` : ''}${buitenDienst(spel, id) - wacht ? ` · ${buitenDienst(spel, id) - wacht} in revisie` : ''}</span></td>
        <td>${vrij ? `<div class="rij" style="flex-wrap:nowrap"><input id="rv-${id}" type="number" min="1" max="${vrij}" value="${wacht || vrij}" style="width:4em"><button class="knop klein" data-actie="revisie" data-type="${id}" title="${renovatieDagen(t)} dagen buiten dienst">Revisie (${S.euroKort(renovatieKosten(t))}/st)</button></div>` : ''}</td></tr>`; };
    return `<h2>Tweedehandsmarkt en revisie</h2>
      <p class="klein">Als grote vervoerders hun vloot vernieuwen, komt hun oude materieel in partijen op de markt. Af en toe duikt er een klassieker op. Oud materieel is goedkoop in aanschaf, maar duurder in onderhoud en per km (slijtage, minder kennis van het materieel, minder zuinig). Een revisie maakt het technisch ruim de helft jonger, maar het staat dan een tijd buiten dienst. Het interieur vernieuw je los daarvan via Vloot (of juist niet, voor de nostalgie). Oud materieel trekt bij bijzondere ritten extra reizigers die er meer voor betalen.</p>
      <h3>Te koop</h3>${filterKnoppen(marktFilter, 'markt-filter', new Set(alleAanbod.map(a => vCat(a.typeId)).filter(Boolean)))}${aanbod.length ? aanbod.map(rij).join('') : '<p>Er is nu niets te koop' + (marktFilter.size ? ' in deze categorie' : '') + '. Kijk over een paar dagen weer.</p>'}
      ${lopend.length ? `<h3>Lopende revisies</h3><table class="tabel">${lopend.map(r => `<tr><td>${r.n} × ${esc(TYPE[r.typeId].naam)}</td><td>${r.soort === 'wacht' ? '<b style="color:var(--rood)">wacht op revisie (niet rijvaardig)</b>' : `klaar over ${Math.max(0, r.klaar - spel.dag)} dag(en)`}</td></tr>`).join('')}</table>` : ''}
      <h3>Revisie van je eigen materieel</h3>${eigen.length ? `<table class="tabel">${eigen.map(revRij).join('')}</table>` : '<p>Je hebt nog geen voertuigen.</p>'}`;
  },
  instellingen() {
    const aan = muziekSpeelt();
    return `<h2>Instellingen</h2><p class="klein">Deze instellingen gelden voor dit apparaat (ook voor je andere spellen).</p>
      <h3>Muziek</h3><label class="rij"><input type="checkbox" data-wijzig="inst-muziek" ${aan ? 'checked' : ''}> Muziek aan</label>
      ${LIEDJES.map((l, i) => `<label class="rij"><input type="radio" name="inst-lied" data-wijzig="inst-lied" value="${i}" ${(INST.liedje || 0) === i ? 'checked' : ''}> ${esc(l.naam)} <span class="klein">(${l.bpm} slagen per minuut${l.wielen ? ', met wielgeluid' : ''}${l.fluit ? ' en stoomfluit' : ''})</span></label>`).join('')}
      <h3>Voertuigen op de kaart</h3>
      <label class="veld">Hooguit zoveel voertuigen tekenen<select data-wijzig="inst-max">${[50, 100, 200, 400, 800, 2000, 100000].map(n => `<option value="${n}" ${INST.max === n ? 'selected' : ''}>${n >= 100000 ? 'alle (kan traag worden)' : n}</option>`).join('')}</select></label>
      <p class="klein">Minder voertuigen = vloeiender. Een kwart gaat naar de voertuigen met de langste routes (van iedereen), de rest eerst naar je eigen voertuigen en dan naar die van anderen, langste routes eerst. Uitgezoomd zie je daardoor vooral internationale treinen en intercity's; hoe verder je inzoomt, hoe meer lokaal verkeer.</p>`;
  },
  stations() {
    const lijst = mijnStations().map(st => ({ ...st, w: [...st.lijnen].reduce((a, l) => a + wachtendBij(st, l), 0) })).sort((a, b) => b.w - a.w);
    if (!lijst.length) return '<h2>Stations</h2><p>Je lijnen doen nog geen stations aan. Losse haltes staan hier niet; trein-, metro-, tram- en busstations wel.</p>';
    const SOORT = { trein: 'treinstation', metro: 'metrostation', sneltram: 'sneltramhalte', tram: 'tramhalte', busstation: 'busstation' };
    return `<h2>Stations die je aandoet</h2><p class="klein">Wachtend = reizigers voor de eerstvolgende rit van elk van je lijnen hier. Klik voor het vertrekbord en de overstappen.</p>
      <table class="tabel"><tr><th>Station</th><th>Soort</th><th>Jouw lijnen</th><th class="getal">Wachtend</th></tr>
      ${lijst.map(st => `<tr data-actie="station-open" data-naam="${esc(st.naam)}" data-x="${st.x}" data-y="${st.y}" style="cursor:pointer"><td><b>${esc(st.naam)}</b></td><td class="klein">${SOORT[st.s] || st.s}</td>
        <td>${[...st.lijnen].map(l => `<span class="lijnnr" style="background:${lijnKleur(l)}">${esc(l.nr)}</span>`).join(' ')}</td><td class="getal">${st.w}</td></tr>`).join('')}</table>`;
  },
  vloot() {
    const eigen = Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && TYPE[id] && !TYPE[id].samen).sort((x, y) => MODI_VOLG.indexOf(TYPE[x].modus) - MODI_VOLG.indexOf(TYPE[y].modus) || (TYPE[x].soort || '').localeCompare(TYPE[y].soort || '') || TYPE[x].naam.localeCompare(TYPE[y].naam));
    const sams = [...new Set([...(spel.samenstellingen || []), ...spel.lijnen.map(l => l.typeId).filter(id => TYPE[id]?.samen && !spel.lijnen.find(l => l.typeId === id)?.vracht)])].filter(id => TYPE[id]);
    const samBlok = sams.length ? `<h3>Samengestelde treinen</h3>${sams.map(id => { const t = TYPE[id], vrij = Math.min(...Object.entries(nodigPer(id)).map(([c, k]) => Math.floor((spel.voertuigen[c] || 0) / k)));
      return `<div class="kaartje"><div class="rij"><b>${esc(t.naam)}</b><span class="chip">${vrij} compleet</span></div><div class="foto">${schets(t.samen, t.modus, { breed: 460 })}</div>
        <p class="klein">${t.vmax} km/u · ${komma(t.acc, 2)} m/s² · ${t.doorloop ? 'doorloop' : 'geen doorloop'} · ${S.euroKort(t.prijs)}</p><button class="knop klein" data-actie="bouwer-open" data-type="${id}">Kopie kopen of aanpassen</button></div>`; }).join('')}` : '';
    const zicht = eigen.filter(id => !vlootFilter.size || vlootFilter.has(vCat(id)));
    const groepen = MODI_VOLG.map(m => { const ids = zicht.filter(id => TYPE[id].modus === m); return ids.length ? `<h3>${MODI[m].naam}</h3>${ids.map(vlootKaart).join('')}` : ''; }).join('');
    const filter = eigen.length ? `<h3>Wat je hebt</h3>${filterKnoppen(vlootFilter, 'vloot-filter', new Set(eigen.map(vCat).filter(Boolean)))}` : '';
    const koop = ['trein', 'tram', 'metro', 'sneltram', 'bus', 'hov', 'belbus', 'veer', 'watertaxi'].filter(m => beschikbaar(spel.jaar, m).length || beschikbaarLos(spel.jaar).some(v => v.modus === m));
    return `<h2>Vloot</h2>
      <div class="rij">${koop.map(m => `<button class="knop hoofd" data-actie="bouwer-open" data-m="${m}">＋ ${MODI[m].naam}</button>`).join('')}</div>
      <div class="rij">${['trein', 'tram', 'metro'].filter(m => beschikbaarLos(spel.jaar).some(v => v.modus === m && v.soort === 'rijtuig')).map(m => `<button class="knop" data-actie="bouwer-open" data-m="${m}" data-opbouw="rijtuigen">＋ ${m === 'tram' ? 'Bijwagens' : 'Rijtuigen'} (${MODI[m].naam.toLowerCase()}, zonder loc)</button>`).join('')}</div>
      <div class="rij"><button class="knop" data-actie="open-markt">Tweedehandsmarkt en revisie${(spel.markt || []).length ? ` (${spel.markt.length} aanbiedingen)` : ''}</button>${(spel.renovaties || []).length ? `<span class="chip">${(spel.renovaties || []).reduce((a, r) => a + r.n, 0)} voertuig(en) in of wachtend op revisie</span>` : ''}</div>
      <p class="klein">Hieronder alleen wat je hebt. Een kopie is nieuw (volle levensduur, geen slijtage) met precies hetzelfde interieur; dat kan tot 10 jaar na de laatste levering van het type. Verkopen gaat via de tweedehandsmarkt: hooguit 45% van nieuw, minder naarmate het ouder is. Museummaterieel en klassiekers koop je op de tweedehandsmarkt.</p>
      ${filter}${vlootFilter.size ? '' : samBlok}${groepen || '<p>Je hebt nog geen voertuigen.</p>'}`;
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
        <td>${sel(i, j, 'soort', trein ? [['zit', 'zitplaatsen'], ['rest', 'restauratie'], ['slaap', 'slaapplaatsen']] : [['zit', 'zitplaatsen']], dl.soort)}</td>
        ${w.delen.length > 1 ? `<td><input type="number" min="10" max="90" step="5" value="${Math.round(dl.len * 100)}" data-wijzig="sw" data-w="${i}" data-d="${j}" data-veld="len" style="width:3.6em">%</td>` : '<td></td>'}
        ${dl.soort === 'zit' ? `<td>${sel(i, j, 'klasse', KLASSEN.map(k => [k, KLASSE_NAAM[k]]), dl.klasse)}</td><td>${sel(i, j, 'stoel', Object.entries(STOEL).map(([v, st]) => [v, st.naam]), dl.stoel)}</td>
          <td>${sel(i, j, 'breed', Array.from({ length: maxBreed(d.basis) }, (_, k) => k + 1).map(x => [x, x + ' naast elkaar']), Math.min(dl.breed, maxBreed(d.basis)))}</td>
          <td>${sel(i, j, 'stroom', Object.entries(STROOM).filter(([v]) => stroomMag(v, modus, spel.jaar) || v === (dl.stroom || '')).map(([v, x]) => [v, x.naam]), dl.stroom || '')}</td><td>${sel(i, j, 'been', Object.entries(BEEN).map(([v, cm]) => [v, `${v} (${cm} cm)`]), dl.been)}</td>
          <td class="getal"><b>${per[i]?.[j]?.zit ?? 0}</b> zit${per[i]?.[j]?.sta ? ` + ${per[i][j].sta} sta` : ''}</td>`
        : dl.soort === 'slaap' ? `<td>${sel(i, j, 'klasse', KLASSEN.map(k => [k, KLASSE_NAAM[k]]), dl.klasse)}</td><td colspan="4">${sel(i, j, 'cabine', Object.entries(SLAAP).map(([v, x]) => [v, x.naam]), dl.cabine)}</td>
          <td class="getal"><b>${per[i]?.[j]?.zit ?? 0}</b> bed${(per[i]?.[j]?.zit ?? 0) === 1 ? '' : 'den'}</td>`
        : `<td colspan="5">${dl.len >= 0.75 ? REST.vol.naam : REST.beperkt.naam}</td>`}
        <td>${w.delen.length > 1 ? `<button class="knop klein" data-actie="sw-weg" data-w="${i}" data-d="${j}" title="deel weghalen">✕</button>` : ''}</td></tr>`).join('')}</table></div>`;
    const eigen = Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && basisId(id) === d.basis);
    const ombouw = d.van && spel.voertuigen[d.van] && d.van !== doelId ? ombouwKosten(serieInrichting(d.van), ink, d.basis) : 0;
    const vzOpties = Object.entries(VOORZ).filter(([v]) => voorzMag(v, d.basis) || (ink.voorz || []).includes(v));
    if (d.kiezen) return `<p class="chip">Interieur voor het voertuig in je samenstelling. <button class="knop hoofd" data-actie="serie-kies">Dit interieur gebruiken</button> <button class="knop klein" data-actie="serie-kies-terug">Terug</button></p>` + PANELEN.serie({ ...d, kiezen: false, alleenOntwerp: true });
    return `${d.terug ? '<p class="chip">Voor je nieuwe lijn: ontwerp het interieur, koop het aantal dat je wilt en je gaat terug naar de lijn met deze serie gekozen. <button class="knop klein" data-actie="serie-terug">Terug zonder kopen</button></p>' : ''}<h2>Interieur: ${esc(b.naam)}</h2>
      <p class="klein">Het interieur hoort bij het voertuig en deel je per wagon in. Een wagon kan in delen (bv. half 1e en half 2e klas${trein ? ', een halve wagon beperkte restauratie, of slaapplaatsen: van couchettes en capsules tot een suite die een half rijtuig beslaat' : ''}). Klassen: Premium, 1e, 2e, 3e, 4e …; met een hoger kaartje mag je lager zitten, niet andersom. Een eigen interieur wordt een eigen serie. Catering aan je plaats en openingstijden regel je per lijn.</p>
      ${ink.wagons.map(wagonRij).join('')}
      <div class="rij"><button class="knop klein" data-actie="sn-standaard">Standaardinterieur</button></div>
      ${vzOpties.length ? `<h3>Voorzieningen</h3>${vzOpties.map(([v, x]) => `<label class="rij klein"><input type="checkbox" data-wijzig="sv" data-v="${v}" ${(ink.voorz || []).includes(v) ? 'checked' : ''}> ${x.naam} <span class="klein">(kost ${x.plekken} zitplaatsen, ${S.euroKort(x.prijs)}${x.bemand ? `, € ${x.uur}/uur open` : ''})</span></label>`).join('')}` : ''}
      <p>Per voertuig: ${kl.map(k => `<b>${KLASSE_NAAM[k.klasse]}</b> ${k.zit} ${String(k.stoel).startsWith('slaap:') ? 'bedden' : 'zit'}${k.sta ? ` + ${k.sta} sta` : ''} (comfort ${komma(k.comfort)})`).join(' · ')}</p>
      ${doelId ? `<p class="chip">Dit interieur ${doelId === d.basis ? 'is het standaardinterieur' : `bestaat al: <b>${esc(TYPE[doelId].naam)}</b>`} (${spel.voertuigen[doelId] || 0} in bezit).</p>`
        : `<label class="veld">Naam van de nieuwe serie <span class="klein">(leeg laten: genummerd, bv. ${esc(kortNaam(d.basis))}2)</span><input id="sn-naam" value="${esc(d.naam || '')}" placeholder="${esc(voorstel)}" maxlength="30"></label>`}
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
      <h3>Controleploegen</h3><p class="klein">Neem een ploeg aan en laat ze op vaste lijnen controleren binnen een tijdvak, of geef ze een route over de dag: na elkaar een lijn met een tijdvak (bv. 's ochtends lijn 5, 's middags lijn 12). Je betaalt alleen de uren dat ze werken.</p>
      ${c.ploegen.map((p, i) => `<div class="kaartje"><div class="rij"><b>Ploeg ${i + 1}</b><span class="klein">${p.mensen} controleurs · ${S.klok(p.van)}–${S.klok(p.tot)}</span><button class="knop gevaar" style="margin-left:auto" data-actie="ploeg-weg" data-i="${i}">×</button></div>
        <div class="raster2"><label class="veld">Mensen<input type="number" min="1" max="40" value="${p.mensen}" data-wijzig="ploeg-mensen" data-i="${i}"></label><label class="veld">Van<input type="time" value="${S.klok(p.van)}" data-wijzig="ploeg-van" data-i="${i}"></label><label class="veld">Tot<input type="time" value="${S.klok(p.tot)}" data-wijzig="ploeg-tot" data-i="${i}"></label></div>
        <div class="segment">${[['lijnen', 'Vaste lijnen'], ['route', 'Route over de dag']].map(([k, n]) => `<button class="knop klein ${(p.route ? 'route' : 'lijnen') === k ? 'hoofd' : ''}" data-actie="ploeg-soort" data-i="${i}" data-w="${k}">${n}</button>`).join('')}</div>
        ${p.route ? `<p class="klein">De ploeg rijdt deze stappen na elkaar en controleert in dat tijdvak op die lijn.</p><table class="tabel klein">${p.route.map((st, k) => `<tr><td><select data-wijzig="ploeg-stap" data-i="${i}" data-k="${k}" data-veld="lijnId">${spel.lijnen.map(l => `<option value="${l.id}" ${l.id === st.lijnId ? 'selected' : ''}>${esc(l.nr)} ${esc(l.naam || '')}</option>`).join('')}</select></td>
            <td><input type="time" value="${S.klok(st.van)}" data-wijzig="ploeg-stap" data-i="${i}" data-k="${k}" data-veld="van"></td><td><input type="time" value="${S.klok(st.tot)}" data-wijzig="ploeg-stap" data-i="${i}" data-k="${k}" data-veld="tot"></td>
            <td><button class="knop klein" data-actie="ploeg-stap-weg" data-i="${i}" data-k="${k}">×</button></td></tr>`).join('')}</table>
          <div class="rij"><button class="knop klein" data-actie="ploeg-stap-erbij" data-i="${i}">＋ Stap</button><button class="knop klein" data-actie="ploeg-toon" data-i="${i}">Route op de kaart</button></div>`
        : `<div>${spel.lijnen.map(l => `<label class="rij klein"><input type="checkbox" data-wijzig="ploeg-lijn" data-i="${i}" data-id="${l.id}" ${p.lijnen.includes(l.id) ? 'checked' : ''}> ${esc(l.nr)} ${esc(l.naam || '')}</label>`).join('')}</div>`}</div>`).join('')}
      <button class="knop" data-actie="ploeg-erbij">＋ Ploeg toevoegen</button>`;
  },
  geld(d) {
    const tab = d?.tab || 'overzicht';
    const tabs = `<div class="segment">${[['overzicht', 'Inkomsten en uitgaven'], ['subsidies', 'Subsidieaanvragen']].map(([k, n]) => `<button class="knop klein ${tab === k ? 'hoofd' : ''}" data-actie="geld-tab" data-w="${k}">${n}</button>`).join('')}</div>`;
    if (tab === 'subsidies') return tabs + PANELEN.subsidies();
    return tabs + PANELEN.geldOverzicht();
  },
  geldOverzicht() {
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
      <h3>Legenda</h3>${legendaHTML()}
      <h3>Gegevens</h3><p class="klein">Spoornet en stations: OpenStreetMap (${net.takken.length.toLocaleString('nl-NL')} spoortakken, ${D.stations.length.toLocaleString('nl-NL')} stations en haltes, ${(D.wissels.length / 2).toLocaleString('nl-NL')} wissels). Dienstregeling: OVapi${D.dag ? ', ' + D.dag.slice(6) + '-' + D.dag.slice(4, 6) + '-' + D.dag.slice(0, 4) : ''}. Het aantal sporen is geschat uit evenwijdig getekende sporen.</p>`;
  },
  station(s) {
    if (!s.verbouw) return stationOverzicht(s);
    return `<div class="rij"><button class="knop klein" data-actie="station-overzicht">← Vertrekken</button></div><h2>${esc(s.naam)} · verbouwen</h2><p class="klein">${s.eigen ? 'Jouw station' : 'Bestaand station'}${s.p ? ` · ongeveer ${s.p} sporen` : ''}${spel.perrons?.[s.naam] ? ` · ${spel.perrons[s.naam]} extra perron(s) van jou` : ''}</p>
      ${bouwProjecten().filter(p => p.station === s.naam).map(p => voortgang(p)).join('')}
      ${(spel.gebouwen || []).filter(g => g.station === s.naam).map(g => `<p class="chip">Stationsgebouw: ${esc(STIJLEN.find(x => x.id === g.stijl)?.naam || '')}, ${GROOTTE[g.grootte].naam}${isKlaar(g) ? '' : ' (in aanbouw)'}</p>`).join('')}
      ${stationGebouwNodig(s.naam) ? `<p class="klein" style="color:var(--rood)">Zonder stationsgebouw is er geen loket: in ${spel.jaar} kopen reizigers hun kaartje aan het loket, dus komen er hier minder.</p>` : ''}
      <div class="rij"><button class="knop hoofd" data-actie="perron-ontwerp" data-naam="${esc(s.naam)}" data-x="${s.x}" data-y="${s.y}">＋ Spoor met perron ontwerpen</button>
      <button class="knop" data-actie="gebouw-kies" data-naam="${esc(s.naam)}" data-x="${s.x}" data-y="${s.y}">＋ Stationsgebouw</button>
      <button class="knop" data-actie="bus-kies" data-naam="${esc(s.naam)}" data-x="${s.x}" data-y="${s.y}">＋ Busstation</button></div>`;
  },
  perronVoorstel(o) {
    const kosten = perronKosten(o);
    if (o.verdubbel && o.passeer) return `<h2>Passeerspoor${o.naam && o.naam !== 'spoor' ? ' · ' + esc(o.naam) : ''}</h2>
      <p>Een tweede spoor van ${komma(o.lengte / 1000)} km naast het enkelspoor, met wissels aan beide kanten${o.vrij ? '' : ' <b>(let op: aan deze kant ligt iets in de weg)</b>'}. Treinen kunnen elkaar hier kruisen in plaats van op het volgende station te wachten; de spoorplanner gebruikt het meteen.</p>
      <p>Kosten <b>${S.euroKort(kosten)}</b>, bouwtijd 2 speluren.</p>
      <div class="rij"><button class="knop hoofd" data-actie="perron-bouw">Bouwen</button><button class="knop" data-actie="perron-kant">Andere kant</button><button class="knop" data-actie="perron-stop">Annuleren</button></div>`;
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
      <p class="klein">Baanvak ${komma(km)} km · ${t.sporen >= 2 ? t.sporen + ' sporen' : 'enkelspoor'} · max ${t.vmax || '?'} km/u · spoorwijdte ${t.soort === 4 ? 'smalspoor' : 'normaalspoor (1435 mm)'} · ${t.eigenaar === 'speler' ? 'van jou' : BEHEERDER[t.land || 0]}${t.hoogte > 0 ? ' · viaduct' : t.hoogte < 0 ? ' · tunnel' : ''}</p>
      <p>Elektrificatie: <b>${nu ? SYSTEMEN[nu].naam : 'geen bovenleiding'}</b>${(() => { const kl = bovenleidingKlasse(spel, t, wisselCache); return kl > 1 ? ` · ${BOVENLEIDING_NAAM[kl]}` : ''; })()}</p>
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
    const doorloopOk = t?.samen ? t.doorloop : true, magAanvullen = rail;
    const vrijeVmax = p.vbouw === Infinity ? 0 : p.vbouw;
    const advies = p.kw && p.acc < 0.3 && magAanvullen ? '<p class="klein" style="color:var(--rood)">Traag optrekken met dit gewicht. Sluit af met een tweede loc in plaats van een stuurstandrijtuig, of neem minder rijtuigen.</p>' : '';
    return `<h2>Voertuig samenstellen · ${esc(MODI[d.modus].naam)}</h2>
      ${d.terug ? '<p class="chip">Voor je nieuwe lijn: stel het voertuig samen, koop het en je gaat terug naar de lijn. <button class="knop klein" data-actie="bouwer-terug">Terug zonder kopen</button></p>' : ''}
      <p class="klein">${magAanvullen ? (opbouwVan(d) === 'treinstel' ? 'Kies een treinstel en koppel er eventueel meer treinstellen aan met ＋.' : 'Kies een loc en zet er met ＋ rijtuigen (met aantal) achter; sluit af met een stuurstandrijtuig of een tweede loc, anders loopt de loc om bij het keren.') + ' Kies bovenaan treinstel of loc.' : 'Kies het voertuig en zijn interieur.'}</p>
      <div class="bouwrij">${kaarten}${magAanvullen ? `<button class="knop bouw-erbij" data-actie="bw-erbij" title="Rijtuig of treinstel toevoegen">＋</button>` : ''}</div>
      ${t ? `<div class="kaartje"><div class="foto">${schets(lijst, d.modus, { breed: 460 })}</div>${aandrijving(t.id, d.modus)}<b>${esc(t.naam || '')}</b> · ${lengte} m · ${Math.round(p.ton)} ton · ${p.kw ? Math.round(p.kw).toLocaleString('nl-NL') + ' kW' : 'geen aandrijving'}
        <br>Topsnelheid <b>${Math.round(p.kw ? p.vmax : 0)} km/u</b> <span class="klein">(gebouwd voor ${Math.round(vrijeVmax)} km/u${p.kw && p.vmaxVermogen < vrijeVmax ? `, met dit gewicht haalt het vermogen ${p.vmaxVermogen} km/u` : ''}; nooit sneller dan het spoor of de weg toelaat)</span>
        · optrekken <b>${komma(p.acc, 2)} m/s²</b>${t.keerExtra ? ` · <span style="color:var(--rood)">geen stuurstand aan het eind: de loc loopt om bij het keren (+${t.keerExtra} min)</span>` : ''}
        <br>${kl.map(k => `${KLASSE_NAAM[k.klasse]} ${k.zit} ${String(k.stoel).startsWith('slaap:') ? 'bedden' : 'zit'}${k.sta ? ` + ${k.sta} sta` : ''}`).join(' · ') || 'geen reizigersruimte'}
        ${t.samen ? `<br>${doorloopOk ? 'Je kunt door de hele trein lopen (restauratie bereikbaar, controle in één keer).' : 'Niet door de hele trein te lopen: tussen de treinstellen geen doorloop (restauratie alleen in het eigen deel, controleurs wisselen op een station).'}` : ''}
        ${p.kw ? '' : opbouwVan(d) === 'rijtuigen' ? '<br>Losse rijtuigen: koppel er per lijn een loc aan (lijnpaneel → Samenstelling).' : '<br><b style="color:var(--rood)">Zonder loc of aangedreven treinstel kan dit niet rijden.</b>'}</div>${advies}
      <div class="rij"><label class="veld">Aantal treinen<input id="bw-aantal" type="number" min="1" max="200" value="${d.aantal || 1}" data-wijzig="bw-aantal" style="width:5em"></label>
        <span>${S.euroKort(prijs)} per trein · totaal <b>${S.euroKort(prijs * (d.aantal || 1))}</b></span>
        <button class="knop hoofd" data-actie="bw-koop" ${p.kw || opbouwVan(d) === 'rijtuigen' ? '' : 'disabled'}>Kopen</button></div>` : '<p>Kies eerst een voertuig.</p>'}`;
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
      <h3>Materieel</h3>${d.modus === 'vlucht' ? `<div class="veld"><select id="nl-type" data-wijzig="nl-type">${typen.map(v => `<option value="${v.id}" ${v.id === d.typeKeuze ? 'selected' : ''}>${esc(v.naam)} · ${plaatsenVan(v.id)} pl. · ${S.euroKort(v.prijs)}${spel.voertuigen[v.id] ? ` · ${spel.voertuigen[v.id]} in bezit` : ''}</option>`).join('')}</select></div>${nodigBlok(d, typen)}` : mixBlok('nl', d, typen)}
      <h3>Dienstregeling</h3>
      <div class="segment">${[['hoog', 'Hoogfrequent'], ['laag', 'Laagfrequent'], ['eenmalig', 'Eenmalig']].map(([k, n]) => `<button class="knop klein ${(d.freqSoort || 'hoog') === k ? 'hoofd' : ''}" data-actie="nl-freq" data-w="${k}">${n}</button>`).join('')}</div>
      <p class="klein">${{ hoog: 'Een vast patroon dat elk uur terugkomt: kies per deel van de dag hoe vaak.', laag: 'Een paar ritten per dag op vaste tijden; per tijd kun je de dagen kiezen (bv. alleen in het weekend, of één keer per week).', eenmalig: 'Eén rit op een gekozen dag en tijd (eventueel met een terugrit). Daarna vervalt de lijn.' }[d.freqSoort || 'hoog']}</p>
      <div class="raster2" ${(d.freqSoort || 'hoog') === 'hoog' ? '' : 'style="display:none"'}>${[['nl-spits', 'Spits', d.spitsIn ?? (d.modus === 'trein' ? 30 : 15)], ['nl-dal', 'Overdag', d.dalIn ?? 30], ['nl-avond', '\'s Avonds', d.avondIn ?? 60]].map(([id, n, w]) => `<label class="veld">${n}<select id="${id}">${S.FREQS.map(f => `<option value="${f}" ${+w === f ? 'selected' : ''}>${freqNaam(f)}</option>`).join('')}</select></label>`).join('')}</div>
      ${d.freqSoort === 'laag' ? nieuwLaagBlok(d) : d.freqSoort === 'eenmalig' ? nieuwEenmaligBlok(d) : ''}
      <div>
      ${d.richting === 'heen' && !d.terugVan && !d.rond ? '<label class="rij"><input type="checkbox" id="nl-terug" checked> Daarna meteen de terugweg bouwen (andere route of andere haltes)</label>' : ''}
      <label class="rij"><input type="checkbox" id="nl-koop" checked> Wat nog ontbreekt meteen (nieuw) bijkopen van het bovenste materieel</label>
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
    case 'halte-weg': conceptWeg(l, +d.i); break;
    case 'concept-toepassen': conceptToepassen(l); break;
    case 'concept-annuleer': delete l._concept; zetTool('kijk'); melding('Wijziging geannuleerd: de lijn is niet veranderd.'); ververs(); break;
    case 'halte-erbij': conceptVan(l); zetTool('lijnhalte'); bouw = { lijnId: l.id, modus: l.modus }; hint(`Klik een ${l.modus === 'trein' ? 'station' : 'halte'} aan om toe te voegen aan lijn ${l.nr}. Het komt in het concept; daarna kies je „Rit updaten” of „Annuleren”.`, [['Klaar met kiezen', () => { const x = lijnVan(bouw?.lijnId); zetTool('kijk'); if (x) openPaneel('lijn', x); }]]); ververs(); break;
    case 'koop': {
      const t = TYPE[d.type], n = +d.n || 1;
      if (!betaal(t.prijs * n, `${n} × ${t.naam}`)) break;
      spel.voertuigen[d.type] = (spel.voertuigen[d.type] || 0) + n; (spel.aankopen ||= []).push({ id: d.type, n, dag: spel.dag, jaar: spel.jaar });
      melding(`${n} × ${t.naam} gekocht voor ${S.euroKort(t.prijs * n)}.`); ververs(); break;
    }
    case 'verkoop': {
      const t = TYPE[d.type];
      if (!spel.voertuigen[d.type]) break;
      if (inzetbaar(spel, d.type) <= 0) { melding('Deze voertuigen staan allemaal in (of wachten op) revisie.'); break; }
      // opbrengst: hooguit 45% van nieuw, en minder naarmate het ouder is (zoals op de tweedehandsmarkt)
      const lt = S.leeftijden(spel)[d.type], opbr = Math.min(t.prijs * 0.45, marktPrijs(t, lt?.gem || 0, 'matig'));
      spel.voertuigen[d.type]--; spel.geld += opbr; melding(`${t.naam} verkocht voor ${S.euroKort(opbr)}.`); ververs(); break;
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
      if (heeftMix(l)) { const h = hoofdType(l), n = Math.max(0, l.nodig - S.beschikbaarVoor(spel, l)); if (!n) break; mixActie('mix-koop', { doel: l.id, type: h, _n: n }); break; }
      const tekort = Object.entries(nodigLijn(l)).map(([c, k]) => [c, Math.max(0, k - (spel.voertuigen[c] || 0))]).filter(x => x[1] > 0);
      const kosten = tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0);
      if (!tekort.length || !betaal(kosten, 'materieel')) break;
      for (const [c, n] of tekort) spel.voertuigen[c] = (spel.voertuigen[c] || 0) + n;
      melding(`Gekocht: ${tekort.map(([c, n]) => `${n} × ${TYPE[c].naam}`).join(', ')} (${S.euroKort(kosten)}).`); ververs(); break;
    }
    case 'paneel': openPaneel(d.p); break;
    case 'bouwer-open': openPaneel('bouwer', d.type ? bouwVan(d.type) : { modus: d.m || 'trein', delen: [{ id: '', n: 1, ...(d.opbouw === 'rijtuigen' ? { cat: 'rijtuig' } : {}) }], aantal: 1, ...(d.opbouw ? { opbouw: d.opbouw } : {}) }); break;
    case 'bw-erbij': { const dd = paneelData, ts = opbouwVan(dd) === 'treinstel', n = dd.delen.length, laatste = dd.delen[n - 1];
      // bij een loc-trein komen nieuwe rijtuigen vóór een afsluitend stuurstandrijtuig of tweede loc
      const voor = !ts && n >= 2 && ['stuurstand', 'loc'].includes(catVan(dd, laatste, n - 1));
      dd.delen.splice(voor ? n - 1 : n, 0, { id: '', n: 1, cat: ts ? 'treinstel' : 'rijtuig' }); ververs(); break; }
    case 'bw-opbouw': { const dd = paneelData; if (opbouwVan(dd) !== d.w) { dd.opbouw = d.w; dd.delen = [{ id: '', n: 1 }]; } ververs(); break; }
    case 'bw-cat': { const x = paneelData.delen[+d.i]; if (catVan(paneelData, x, +d.i) !== d.w) { x.cat = d.w; x.id = ''; x.n = 1; } ververs(); break; }
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
      spel.samenstellingen = [...new Set([...(spel.samenstellingen || []), ...(TYPE[id].samen && !TYPE[id].zonderTrekkracht ? [id] : [])])];
      spel.aankopen = spel.aankopen || []; for (const [c, k] of Object.entries(per)) spel.aankopen.push({ id: c, n: k * n, dag: spel.dag, jaar: spel.jaar });
      melding(`${n} × ${TYPE[id].naam} gekocht (${S.euroKort(kosten)}).`, 6000);
      if (dd.terug && terugNaarLijn) { const t2 = { ...terugNaarLijn, typeKeuze: id }; terugNaarLijn = null; openPaneel('nieuweLijn', t2); break; }
      if (dd.terugLijn && lijnVan(dd.terugLijn)) { const lj = lijnVan(dd.terugLijn); mixErbij(lj, id, n); openPaneel('lijn', lj); break; }
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
      for (const x of spel.lijnen) stroomBijwerken(x); netwerkLagen();
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
      for (const x of spel.lijnen) stroomBijwerken(x); perronVoorstelWissen(); netwerkLagen();
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
        spel.voertuigen[id] = (spel.voertuigen[id] || 0) + n; (spel.aankopen ||= []).push({ id, n, dag: spel.dag, jaar: spel.jaar });
        melding(`${n} × ${t.naam} gekocht voor ${S.euroKort(t.prijs * n)}.`);
        if (dd.terug && terugNaarLijn) { const t2 = { ...terugNaarLijn, typeKeuze: id }; terugNaarLijn = null; openPaneel('nieuweLijn', t2); break; }
        if (dd.terugLijn && lijnVan(dd.terugLijn)) { const lj = lijnVan(dd.terugLijn); mixErbij(lj, id, n); openPaneel('lijn', lj); break; }
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
    case 'sub-alles': subFilter = { modus: [], prov: [], land: '' }; ververs(); break;
    case 'sub-meer': { const n = subsidiesZoeken(subsidieLijst().filter(a => a.status === 'open').length + 3); melding(n ? `${n} nieuwe aanbieding${n > 1 ? 'en' : ''} gevonden.` : subFilter.land && subFilter.land !== 'NL' && !subsidieLijst().length ? `In ${territorium?.landen?.[subFilter.land] || subFilter.land} zijn nog geen aanbiedingen mogelijk: daar zitten nog geen plaatsen${spoorLanden && !spoorLanden.has(subFilter.land) ? ' en geen spoor' : ''} in de kaartgegevens.` : 'Hier vond de provincie geen nieuwe verbindingen die het ondersteunen waard zijn.', 8000); ververs(); break; }
    case 'aanbod-toon': { const a = (spel.aanbiedingen || []).find(x => x.id === d.sub); if (!a) break;
      kaart.bron('perron-voorstel', { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [lonlat(a.a.x, a.a.y), lonlat(a.b.x, a.b.y)] } }] });
      kaart.vliegNaar((a.a.x + a.b.x) / 2, (a.a.y + a.b.y) / 2, Math.max(2, Math.hypot(a.a.x - a.b.x, a.a.y - a.b.y) / Math.min(kaart.W, kaart.H) * 1.6)); break; }
    case 'aanbod-bouw': { const a = (spel.aanbiedingen || []).find(x => x.id === d.sub); if (!a) break; sluitPaneel(); zetTool('lijn');
      bouw = { modus: a.modus, punten: a.modus === 'trein' ? [{ ...a.a }, { ...a.b }] : [], aanbod: a.id, erbij: [] };
      kaart.vliegNaar((a.a.x + a.b.x) / 2, (a.a.y + a.b.y) / 2, Math.max(3, Math.hypot(a.a.x - a.b.x, a.a.y - a.b.y) / Math.min(kaart.W, kaart.H) * 1.5));
      hint(`Subsidielijn ${a.a.naam} – ${a.b.naam}${a.eisen?.stops ? ` (${eisenTekst({ stops: a.eisen.stops })})` : ''}: klik de ${a.modus === 'trein' ? 'stations' : 'haltes'} aan waar de lijn moet stoppen; ze komen vanzelf op de goede plek.`, [['Klaar', lijnKlaar], ['Laatste weg', laatsteWeg], ['Stoppen', () => zetTool('kijk')]]);
      if (a.modus === 'trein') lijnVoorbeeld();
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
    case 'toon-voertuig': { // op voertuignummer opzoeken (de lijst kan intussen ververst zijn), met de positie van nu
      const lijst = l ? voertuigenVanLijn(l) : voertuigLijst, e = lijst.find(x => x.omloop.nr === +d.nr) || voertuigLijst[+d.i]; if (!e) break; openRit(e); kaart.vliegNaar(e.x, e.y, Math.min(kaart.res, 4)); break; }
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
    case 'ploeg-soort': { const pl = spel.controle.ploegen[+d.i]; if (d.w === 'route') pl.route = pl.route || [{ lijnId: pl.lijnen[0] || spel.lijnen[0]?.id, van: pl.van, tot: pl.tot }]; else delete pl.route; ververs(); break; }
    case 'ploeg-stap-erbij': { const pl = spel.controle.ploegen[+d.i], laatst = pl.route.at(-1); pl.route.push({ lijnId: laatst?.lijnId || spel.lijnen[0]?.id, van: laatst?.tot ?? 7 * 60, tot: Math.min(24 * 60, (laatst?.tot ?? 7 * 60) + 120) }); ververs(); break; }
    case 'ploeg-stap-weg': spel.controle.ploegen[+d.i].route.splice(+d.k, 1); ververs(); break;
    case 'ploeg-toon': { const pl = spel.controle.ploegen[+d.i], ls = [...new Set(pl.route.map(st => st.lijnId))].map(lijnVan).filter(Boolean); if (!ls.length) break;
      selectie = { lijn: ls[0] }; const b = ls.reduce((a, l) => [Math.min(a[0], l.bbox[0]), Math.min(a[1], l.bbox[1]), Math.max(a[2], l.bbox[2]), Math.max(a[3], l.bbox[3])], [...ls[0].bbox]);
      kaart.vliegNaar((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(b[2] - b[0], b[3] - b[1]) / Math.min(kaart.W, kaart.H) * 1.3); melding(`Ploeg ${+d.i + 1}: ${pl.route.map(st => `${S.klok(st.van)} lijn ${lijnVan(st.lijnId)?.nr || '?'}`).join(' → ')}`, 9000); break; }
    case 'bewaar': bewaar(true); break;
    case 'nieuw': toonStart(); break;
    case 'perron-ontwerp': perronOntwerpen(d.naam, +d.x, +d.y); break;
    case 'perron-kant': if (perronOntwerp?.verdubbel) verdubbelOntwerpen(perronOntwerp.x, perronOntwerp.y, -perronOntwerp.kant, !!perronOntwerp.passeer); else if (perronOntwerp) perronOntwerpen(perronOntwerp.naam, perronOntwerp.x, perronOntwerp.y, -perronOntwerp.kant); break;
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
    case 'spoor-afstem': if (l) spoorAfstemmen(l); break;
    case 'station-open': { const st = D.stations.find(x => x.n === d.naam && Math.hypot(x.x - +d.x, x.y - +d.y) < 50); kaart.vliegNaar(+d.x, +d.y, Math.min(kaart.res, 3)); openPaneel('station', { naam: d.naam, p: st?.p, x: +d.x, y: +d.y }); break; }
    case 'vloot-filter': case 'markt-filter': { const set = a === 'vloot-filter' ? vlootFilter : marktFilter; if (!d.w) set.clear(); else set.has(d.w) ? set.delete(d.w) : set.add(d.w); ververs(); break; }
    case 'geld-tab': openPaneel('geld', { tab: d.w }); break;
    case 'station-verbouw': openPaneel('station', { ...paneelData, verbouw: true }); break;
    case 'station-overzicht': openPaneel('station', { ...paneelData, verbouw: false }); break;
    case 'terug-direct': { if (!l) break; // terug vertrekken zodra het voertuig heeft gekeerd (uitgaande van de heenrit)
      const voor = l.nodig, aankomst = S.cyclusAnker(l, 0) + Math.ceil((l.tr?.[0]?.at(-1) || 0) / 60) + (MODI[l.modus].keer || 5) + (TYPE[l.typeId]?.keerExtra || 0);
      l.offsetTerug = (l.offsetTerug || 0) + aankomst - S.cyclusAnker(l, 1); l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l);
      melding(`Lijn ${l.nr}: terug vertrekt nu om :${String(S.cyclusMinuut(l, 1)).padStart(2, '0')}, direct na aankomst. Benodigd: ${voor} → ${l.nodig} voertuig(en).`, 7000); ververs(); break; }
    case 'laag-dag': { const x = l?.ritten?.[+d.k]; if (!x) break; const dg = new Set(x.dagen || [0, 1, 2, 3, 4, 5, 6]); const i2 = +d.d; dg.has(i2) ? dg.delete(i2) : dg.add(i2);
      x.dagen = dg.size === 7 ? null : [...dg].sort(); l.aangepast = true; S.herbereken(l); ververs(); break; }
    case 'ns-kant': paneelData.kant = -(paneelData.kant || 1); ververs(); break;
    case 'perron-bouw': {
      const o = perronOntwerp; if (!o) break;
      const kosten = perronKosten(o);
      if (!betaal(kosten, o.verdubbel ? 'de verdubbeling' : 'het perronspoor')) break;
      const tijd = bouwKlaar(), project = S.nieuwId('b');
      const naam = o.passeer ? `Passeerspoor ${o.naam !== 'spoor' ? o.naam : ''} (${komma(o.lengte / 1000)} km)`.replace('  ', ' ') : o.verdubbel ? `${(o.bestaand || 1) >= 2 ? `${(o.bestaand || 1) + 1}e spoor` : 'Verdubbeling'} ${o.naam !== 'spoor' ? o.naam : ''} (${komma(o.lengte / 1000)} km)`.replace('  ', ' ') : `${{ zij: 'Spoor met perron', eiland: 'Eilandperron met 2 sporen', langs: 'Spoor langs perron', kop: 'Kopspoor met perron', kopLangs: 'Kopspoor langs perron', kop2: '2 kopsporen met eilandperron', opstel: 'Opstelspoor', opstel2: '2 opstelsporen' }[o.vorm]} · ${o.naam}`;
      o.sporen.forEach((pts, k) => spel.spoor.push({ punten: pts, sporen: 1, eigenaar: 'speler', ...tijd, klaar: false, perron: o.verdubbel ? undefined : o.naam,
        verdubbelt: o.verdubbel && !o.passeer && !k ? o.tak : undefined, verdubbeltSleutel: o.verdubbel && !o.passeer && !k ? net.takken[o.tak]?.sleutel : undefined, passeer: o.passeer || undefined, nieuwSporen: o.verdubbel ? (o.bestaand || 1) + 1 : undefined, dienst: o.vorm?.startsWith('opstel') ? 1 : 0, project, projectNaam: naam, kosten: k ? 0 : kosten }));
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
    case 'mix-n': case 'mix-op': case 'mix-weg': case 'mix-erbij': case 'mix-koopnieuw': case 'mix-tweedehands': case 'mix-koop': case 'mix-markt': case 'mix-bouwer': mixActie(a, d); break;
    case 'nl-dienst': { const dd = paneelData; dd.dienst = d.w; dd.bijzonder = d.w !== 'regulier'; ververs(); break; }
    case 'nl-freq': { const dd = paneelData; nlBewaar(dd); dd.freqSoort = d.w; ververs(); break; }
    case 'nlb-dag': { const dd = paneelData, x = dd.laag?.[+d.r]?.[+d.k]; if (!x) break; nlBewaar(dd); const g = new Set(x.dagen || [0, 1, 2, 3, 4, 5, 6]); g.has(+d.d) ? g.delete(+d.d) : g.add(+d.d); x.dagen = g.size === 7 ? null : [...g].sort(); ververs(); break; }
    case 'bijzonder-maak': {
      const dd = paneelData, nb = dd.nb, typeId = nb?.type;
      if (!typeId) { melding('Koop eerst materieel (Vloot), bijvoorbeeld museummaterieel of een klassieker van de tweedehandsmarkt.'); break; }
      const [hh, mm] = nb.tijd.split(':').map(Number), eerste = hh * 60 + mm;
      const tmp = maakBijzonder({ nr: '★', naam: `${dd.haltes[0].naam.split(',')[0]} – ${dd.haltes[dd.haltes.length - 1].naam.split(',')[0]}`, modus: dd.modus, typeId, haltes: dd.haltes, route: dd.route,
        soort: dd.dienst, dag: dd.dienst === 'eenmalig' ? spel.dag + Math.max(1, Math.min(120, +nb.over || 14)) : undefined, dagen: dd.dienst === 'bijzonder' ? [...nb.dagen].sort() : undefined, vanaf: spel.dag + 1,
        vertrek: eerste, prijs: Math.max(0, +nb.prijs || 0), wacht: nb.wacht });
      const r = pendel(eerste, +nb.keer || 0, +nb.keertijd || 15, tmp.duur); tmp.bijzonder.heen = r.heen; tmp.bijzonder.terug = r.terug; bijzonderBijwerken(tmp);
      melding(dd.dienst === 'eenmalig' ? `Bijzondere rit uitgeschreven voor ${S.datumTekst(tmp.bijzonder.dag)} (${aantalRitten(tmp.bijzonder)} rit(ten)).` : `Bijzondere dienst ${wanneerTekst(tmp.bijzonder)} gestart (${aantalRitten(tmp.bijzonder)} ritten per dag).`, 7000);
      bouw = null; zetTool('kijk'); openPaneel('lijnen'); break;
    }
    case 'open-markt': openPaneel('markt'); break;
    case 'vloot-kopie': { const t = TYPE[d.type], n = Math.max(1, Math.round(+$('vk-' + d.type)?.value || 1)); if (!t || !kopieMag(t)) break;
      if (!betaal(t.prijs * n, `${n} × ${t.naam}`)) break; spel.voertuigen[d.type] = (spel.voertuigen[d.type] || 0) + n;
      (spel.aankopen ||= []).push({ id: d.type, n, dag: spel.dag, jaar: spel.jaar }); melding(`${n} × ${t.naam} nieuw gekocht (${S.euroKort(t.prijs * n)}).`); ververs(); break; }
    case 'vloot-verkoop': { const t = TYPE[d.type], n = Math.max(1, Math.min(inzetbaar(spel, d.type), Math.round(+$('vk-' + d.type)?.value || 1))); if (!t || n < 1) break;
      const w = verkoopWaarde(d.type) * n; spel.voertuigen[d.type] -= n; spel.geld += w;
      // de oudste gaan het eerst weg
      let rest = n; for (const a of (spel.aankopen || []).filter(a => a.id === d.type).sort((x, y) => (x.jaar - (x.oud || 0)) - (y.jaar - (y.oud || 0)))) { const k = Math.min(a.n, rest); a.n -= k; rest -= k; if (!rest) break; }
      spel.aankopen = (spel.aankopen || []).filter(a => a.n > 0);
      melding(`${n} × ${t.naam} verkocht op de tweedehandsmarkt voor ${S.euroKort(w)}.`); ververs(); break; }
    case 'open-vracht': openPaneel('vracht', paneelSoort === 'vracht' ? paneelData : {}); break;
    case 'vracht-aan': { const a = (spel.vrachtAanvragen || []).find(x => x.id === d.id), kz = paneelData?.keuze?.[d.id]; if (!a || !kz?.heen) break;
      const tekort = locTekort(kz), kosten = tekort.reduce((s2, [id, n]) => s2 + n * TYPE[id].prijs, 0);
      if (tekort.length && !betaal(kosten, 'locs voor goederen')) break;
      for (const [id, n] of tekort) { spel.voertuigen[id] = (spel.voertuigen[id] || 0) + n; (spel.aankopen ||= []).push({ id, n, dag: spel.dag, jaar: spel.jaar }); }
      const heenLocs = kz.heen.locs.filter(q => q.n > 0), terugLocs = kz.terug.locs.filter(q => q.n > 0);
      const typeId = vrachtTypeIdMix(heenLocs, a.wagons); samenstellingVan(typeId);
      const eenmalig = a.freq === 'eenmalig', dagen = FREQ[a.freq].dagen || [Math.floor(Math.random() * 5)];
      const l = maakBijzonder({ nr: 'G', naam: `${a.klant}: ${a.van.naam.split(' (')[0]} – ${a.naar.naam.split(' (')[0]}`, modus: 'trein', typeId, haltes: [{ naam: a.van.naam, x: a.van.x, y: a.van.y }, { naam: a.naar.naam, x: a.naar.x, y: a.naar.y }], route: a.route,
        soort: eenmalig ? 'eenmalig' : 'bijzonder', dag: eenmalig ? spel.dag + 2 : undefined, dagen: eenmalig ? undefined : dagen, vanaf: spel.dag + 1, vertrek: kz.heen.tijd, charter: true, bod: vergoedingRetour(a, vensterVan(kz.heen.tijd)), personen: 0, wie: a.klant });
      const vH = vensterVan(kz.heen.tijd), vT = vensterVan(kz.terug.tijd);
      // locs per rit (verschillende typen mogen); voor de telling per tijdvak
      l.vracht = { legs: [{ venster: vH, locs: heenLocs, ton: a.ton }, { venster: vT, locs: terugLocs, ton: tonTerug(a) }], loc: heenLocs[0]?.id, n: heenLocs.reduce((s2, q) => s2 + q.n, 0), venster: vH, vensters: [vH, vT],
        wagons: a.wagons, ton: a.ton, klant: a.klant, retour: a.retour, losUren: a.losUren };
      l.bijzonder.heen = [kz.heen.tijd]; l.bijzonder.terug = [kz.terug.tijd]; bijzonderBijwerken(l); stroomBijwerken(l);
      spel.vrachtAanvragen = spel.vrachtAanvragen.filter(x => x !== a);
      melding(`Goederentrein aangenomen: ${l.naam}, heen ${S.klok(kz.heen.tijd)}, terug ${S.klok(kz.terug.tijd % 1440)}${tekort.length ? ` (${tekort.map(([id, n]) => n + ' × ' + TYPE[id].naam).join(', ')} gekocht)` : ''}.`, 8000); ververs(); break; }
    case 'vr-loc-erbij': { const kz = paneelData.keuze[d.id][d.k], a = spel.vrachtAanvragen.find(x => x.id === d.id), lichtste = vrachtTypen(a).sort((x, y) => vermogen(x.id) - vermogen(y.id))[0]; kz.locs.push({ id: lichtste?.id || kz.locs[0]?.id, n: 1 }); ververs(); break; }
    case 'markt-koop': { const a = (spel.markt || []).find(x => x.id === d.id); if (!a) break; const n = Math.max(1, Math.min(a.n, Math.round(+$('mk-' + a.id)?.value || a.n))), t = TYPE[a.typeId];
      if (!betaal(a.prijs * n, `${n} × ${t.naam} (tweedehands)`)) break; koopVanMarkt(spel, a, n);
      melding(`${n} × ${t.naam} gekocht van ${a.van} voor ${S.euroKort(a.prijs * n)}${a.staat === 'slecht' ? '. Ze rijden pas na een revisie' : ''}.`, 7000); ververs(); break; }
    case 'revisie': { const t = TYPE[d.type], n = Math.max(1, Math.round(+$('rv-' + d.type)?.value || 1)); const kosten = n * renovatieKosten(t);
      if (!betaal(kosten, `revisie van ${n} × ${t.naam}`)) break; const k = startRevisie(spel, d.type, n);
      if (k < n) spel.geld += (n - k) * renovatieKosten(t);
      melding(`Revisie gestart: ${k} × ${t.naam}, klaar over ${renovatieDagen(t)} dagen. Zolang rijden ze niet.`, 7000); ververs(); break; }
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
    case 'sub-land': subFilter.land = i.value; subFilter.prov = []; ververs(); return;
    case 'nl-overal': paneelData.stopOveral = i.checked; i.blur(); ververs(); return;
    case 'nl-richting': paneelData.richting = i.value; ververs(); return;
    case 'mix-rol': { const nl = i.dataset.doel === 'nl', lj = nl ? null : lijnVan(i.dataset.doel); if (!nl && !lj) return; if (nl) nlBewaar(paneelData);
      const mix = mixVan(nl ? 'nl' : lj), m = mix[+i.dataset.i]; if (m) m.rol = i.value; mixGewijzigd(nl ? 'nl' : lj); i.blur(); setTimeout(() => ververs(), 0); return; }
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
    case 'vr-tijd': { const kz = paneelData.keuze[i.dataset.id], [h, m] = (i.value || '0:0').split(':').map(Number); let t = h * 60 + m;
      if (i.dataset.k === 'terug') { while (t < kz.heen.tijd) t += 1440; } kz[i.dataset.k].tijd = t; i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'vr-loc': { paneelData.keuze[i.dataset.id][i.dataset.k].locs[+i.dataset.j].id = i.value; i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'vr-n': { const lj = paneelData.keuze[i.dataset.id][i.dataset.k].locs; lj[+i.dataset.j].n = Math.max(0, Math.min(6, Math.round(+i.value || 0))); if (!lj[+i.dataset.j].n && lj.length > 1) lj.splice(+i.dataset.j, 1); i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'vr-keuze': { const kz = paneelData.keuze[i.dataset.id]; kz[i.dataset.k] = i.value; if (i.dataset.k === 'venster') { kz.tijd = VENSTER[i.value].tijden[1] ?? VENSTER[i.value].tijden[0]; delete kz.vensterT; } if (i.dataset.k === 'vensterT') kz.tijdT = VENSTER[i.value].tijden[0]; if (i.dataset.k === 'tijd') delete kz.vensterT; i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'nb-veld': paneelData.nb[i.dataset.k] = i.value; i.blur(); setTimeout(() => ververs(), 0); return;
    case 'nb-wacht': paneelData.nb.wacht[i.dataset.i] = Math.max(0, Math.min(120, Math.round(+i.value || 0))); i.blur(); setTimeout(() => ververs(), 0); return;
    case 'nb-dag': { const l2 = paneelData.nb.dagen, w2 = +i.dataset.w, k = l2.indexOf(w2); if (i.checked && k < 0) l2.push(w2); else if (!i.checked && k >= 0) l2.splice(k, 1); ververs(); return; }
    case 'lijn-type': l.typeId = i.value; S.herbereken(l); stroomBijwerken(l); break;
    case 'lw-kies': { const land = +i.dataset.land; l.locWissel = { ...(l.locWissel || {}) }; if (i.value) l.locWissel[land] = i.value; else delete l.locWissel[land];
      if (!Object.keys(l.locWissel).length) delete l.locWissel;
      l._landFrac = landVerdeling(net, l); l._wissels = wisselsPerRit(net, l); S.herbereken(l);
      const tekort = Object.entries(nodigLijn(l)).filter(([c]) => TYPE[c]?.soort === 'loc').map(([c, k]) => [c, Math.max(0, k - (spel.voertuigen[c] || 0))]).filter(x => x[1] > 0);
      const kosten = tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0);
      if (tekort.length && betaal(kosten, tekort.map(([c, n]) => `${n} × ${TYPE[c].naam}`).join(', '))) { for (const [c, n] of tekort) spel.voertuigen[c] = (spel.voertuigen[c] || 0) + n; melding(`Gekocht voor de loc-wissel: ${tekort.map(([c, n]) => `${n} × ${TYPE[c].naam}`).join(', ')} (${S.euroKort(kosten)}).`, 7000); }
      stroomBijwerken(l); ververs(); return; }
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
      else if (v === 'soort') { for (const k of ['klasse', 'stoel', 'breed', 'been', 'stroom', 'cabine']) delete dl[k];
        if (i.value === 'rest') dl.soort = 'rest'; else if (i.value === 'slaap') Object.assign(dl, nieuwSlaapDeel('stapel2', dl.len)); else Object.assign(dl, { soort: 'zit', klasse: '2', stoel: 'bekleed', breed: 4, been: 'normaal' }); }
      else if (v === 'cabine') { dl.cabine = i.value; if (i.value === 'suite' && w.delen.length === 1) { dl.len = 0.5; w.delen.push({ ...dl }); } }
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
    case 'inst-max': INST.max = +i.value || 100; instBewaar(); return;
    case 'inst-lied': INST.liedje = +i.value || 0; instBewaar(); zetLiedje(INST.liedje); return;
    case 'inst-muziek': { if (i.checked) muziekAan(); else muziekUit(); const b = $('b-muziek'); b.setAttribute('aria-pressed', String(muziekSpeelt())); return; }
    case 'nlb-n': { const dd = paneelData, r = +i.dataset.r, n = Math.max(1, Math.min(30, Math.round(+i.value || 1))), lijst = dd.laag[r];
      while (lijst.length < n) lijst.push({ t: Math.min(23 * 60, (lijst.at(-1)?.t ?? 480) + 120), dagen: null }); lijst.length = n; nlBewaar(dd); i.blur(); setTimeout(() => ververs(), 0); return; }
    case 'nlb-t': { const x = paneelData.laag?.[+i.dataset.r]?.[+i.dataset.k]; if (x && i.value) { const [h, m] = i.value.split(':').map(Number); x.t = h * 60 + m; } return; }
    case 'nle-dag': paneelData.een.dag = +i.value; return;
    case 'nle-t': if (i.value) { const [h, m] = i.value.split(':').map(Number); paneelData.een.t = h * 60 + m; } return;
    case 'nle-terug': if (i.value) { const [h, m] = i.value.split(':').map(Number); paneelData.een.terug = h * 60 + m; } else paneelData.een.terug = null; return;
    case 'freq': { for (const p of i.dataset.p.split(',')) l.interval[p] = +i.value || 999; l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); break; }
    case 'minuut': { const m = Math.max(0, Math.min(59, Math.round(+i.value || 0)));
      if (+i.dataset.r) l.offsetTerug = (l.offsetTerug || 0) + m - S.cyclusMinuut(l, 1); else { const terug = S.ritRichtingen(l) > 1 ? S.cyclusAnker(l, 1) : null; l.offset = m; if (terug != null) l.offsetTerug = (l.offsetTerug || 0) + terug - S.cyclusAnker(l, 1); }
      l.aangepast = true; S.herbereken(l); break; }
    case 'dienst': {
      if (i.value === 'laag' && l.dienst !== 'laag') { // beginnen met de ritten die er nu zijn (hooguit 6 per richting)
        l.ritten = [0, 1].flatMap(r => { const v = l.vertrek[r] || []; const kies = v.length <= 6 ? v : [v[0], v[Math.floor(v.length / 2)], v[v.length - 1]]; return kies.map(t => ({ r, t: Math.round(t), dagen: null })); });
      }
      l.dienst = i.value === 'laag' ? 'laag' : undefined; l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); break; }
    case 'laag-n': { const r = +i.dataset.r, n = Math.max(0, Math.min(40, Math.round(+i.value || 0)));
      l.ritten = l.ritten || []; const eigen = l.ritten.filter(x => x.r === r).sort((a, b) => a.t - b.t);
      if (n < eigen.length) { const weg = new Set(eigen.slice(n)); l.ritten = l.ritten.filter(x => !weg.has(x)); }
      for (let k = eigen.length; k < n; k++) l.ritten.push({ r, t: Math.min(23 * 60, (eigen.at(-1)?.t ?? (r ? 9.5 * 60 : 9 * 60)) + (k - eigen.length + 1) * 120), dagen: null });
      l.aangepast = true; S.herbereken(l); padOpnieuwNodig(l); break; }
    case 'laag-tijd': { const x = l.ritten?.[+i.dataset.k]; if (x && i.value) { const [h, m] = i.value.split(':').map(Number); x.t = h * 60 + m; l.aangepast = true; S.herbereken(l); } break; }
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
    case 'ploeg-stap': { const st = spel.controle.ploegen[+i.dataset.i].route[+i.dataset.k]; const v = i.dataset.veld; st[v] = v === 'lijnId' ? i.value : tijd(i.value); break; }
    case 'ploeg-lijn': { const p = spel.controle.ploegen[+i.dataset.i]; p.lijnen = i.checked ? [...new Set([...p.lijnen, i.dataset.id])] : p.lijnen.filter(x => x !== i.dataset.id); break; }
    case 'achtergrond': spel.achtergrond = i.value; kaart.zetAchtergrond(i.value); jaarBijwerken(); $('bron').textContent = ACHTERGROND_KEUZE[i.value]?.bron || ''; break;
  }
  i.blur(); ververs(); eigenNetBijwerken();
}
function padOpnieuwNodig(l) {
  if (l.modus !== 'trein' || l.eigenSpoor) return;
  const gevraagd = Math.ceil(60 / (Math.min(...Object.values(l.interval).filter(x => x > 0)) || 60));
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
  const bus = (tool === 'halte' && (BUSMODI.includes(halteSoort) || halteSoort === 'weg')) || (tool === 'lijn' && BUSMODI.includes(bouw?.modus));
  if (!bus) { if (kaart.map.getSource('snap-punt') && snapTijd) { snapTijd = 0; kaart.bron('snap-punt', { type: 'FeatureCollection', features: [] }); } return; }
  const nu = performance.now(); if (nu - snapTijd < 60) return; snapTijd = nu;
  const p = halteOpWeg(kaart.wx(px), kaart.wy(py), Math.max(40, 12 * (kaart.res || 1)));
  kaart.bron('snap-punt', { type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: lonlat(p.x, p.y) } }] : [] });
  kaart.laag({ id: 'snap-punt', type: 'circle', source: 'snap-punt', paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': spel.kleur || '#c2412d', 'circle-stroke-width': 3, 'circle-opacity': 0.9 } });
}
function zetTool(t) {
  if (tool === 'lijn' && t !== 'lijn' && kaart?.map?.getSource('lijn-voorbeeld')) { voorbeeldNr++; kaart.bron('lijn-voorbeeld', { type: 'FeatureCollection', features: [] }); }
  tool = t; bouw = null; snapTonen(0, 0);
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('aan', b.dataset.tool === t));
  if (t === 'kijk') hint(null);
  if (t === 'lijn') kiesModus();
  if (t === 'halte') hint('Wat voor halte?', [['Halte aan de weg (tram als er tramspoor ligt, anders bus)', () => halteModus('weg')], ['Bushalte', () => halteModus('bus')], ['Tramhalte', () => halteModus('tram')], ['Steiger (veer)', () => halteModus('veer')], ['Watertaxi', () => halteModus('watertaxi')], ['Stoppen', () => zetTool('kijk')]]);
  if (t === 'station') hint('Klik op het spoor waar het station moet komen.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'perron') hint('Klik bij een treinstation: er komt een voorstel voor een extra spoor met perron.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'spoor') hint('Wat wil je aanleggen?', [['Treinspoor', () => spoorBegin('trein')], ['Metrospoor', () => spoorBegin('metro')], ['Tramspoor', () => spoorBegin('tram')], ['Trambaan in de weg (volgt de straat)', () => spoorBegin('trambaan')], ['Trolleybus-bovenleiding', () => spoorBegin('trolley')],
    ['Spoor erbij (2e, 3e, 4e spoor)', () => zetTool('verdubbel')], ['Passeerspoor op enkelspoor (1 km)', () => zetTool('passeer')], ['Opstelspoor bij station', () => zetTool('perron')], ['Kruising ongelijkvloers maken', () => zetTool('kruising')], ['Stoppen', () => zetTool('kijk')]]);
  if (t === 'kruising') hint('Klik op een gelijkvloerse kruising of splitsing van sporen: die wordt een flyover (over het andere spoor heen) of een dive-under (eronderdoor).', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'busstation') hint('Klik bij een station of halte waar het busstation moet komen.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'kijk') document.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('aan', false));
  if (t === 'passeer') hint('Klik op enkelspoor waar treinen elkaar moeten kunnen kruisen: er komt ongeveer 1 km tweede spoor met wissels aan beide kanten.', [['Stoppen', () => zetTool('kijk')]]);
  if (t === 'verdubbel') hint('Klik op het spoor waar een extra spoor naast moet komen (van wissel tot wissel): van enkel- naar dubbelspoor, of een 3e of 4e spoor.', [['Stoppen', () => zetTool('kijk')]]);
}
function kiesModus() {
  const modi = [['trein', 'Trein'], ['metro', 'Metro'], ['sneltram', 'Sneltram'], ['tram', 'Tram'], ['bus', 'Bus'], ['hov', 'Snelbus'], ['belbus', 'Belbus'], ['veer', 'Veer'], ['watertaxi', 'Watertaxi'], ['vlucht', 'Vliegtuig']];
  hint('Wat voor lijn?', modi.map(([m, n]) => [n, () => lijnModus(m)]).concat([['Stoppen', () => zetTool('kijk')]]));
}
function lijnModus(m) {
  bouw = { modus: m, punten: [] };
  hint(`Klik de haltes van je ${MODI[m].naam.toLowerCase()}lijn op volgorde aan.${['bus', 'hov', 'belbus', 'veer', 'watertaxi'].includes(m) ? ' Klik je naast een halte, dan komt er automatisch een nieuwe.' : ''}`,
    [['Klaar', lijnKlaar], ['Laatste weg', laatsteWeg], ['Stoppen', () => zetTool('kijk')]]);
}
// nieuwe lijn van deze soort beginnen (vanuit de balk onderin)
function lijnBegin(m) { zetTool('lijn'); lijnModus(m); }
let halteSoort = 'bus';
function halteModus(m) { halteSoort = m; hint(`Klik op de kaart om een ${m === 'weg' ? 'halte aan de weg' : m === 'veer' ? 'steiger' : m === 'watertaxi' ? 'watertaxi-steiger' : m + 'halte'} te plaatsen.`, [['Stoppen', () => zetTool('kijk')]]); }

const HALTEKOSTEN = { bus: 15000, hov: 60000, belbus: 5000, tram: 400000, veer: 1.5e6, watertaxi: 100000 };
function plaatsNaam(x, y) {
  let beste = null, bd = 1e12;
  for (const p of D.plaatsen) { const d = Math.hypot(p[1] - x, p[2] - y) / Math.sqrt(Math.max(500, p[3])); if (d < bd) { bd = d; beste = p; } }
  return beste ? beste[0] : 'Halte';
}
function nieuweHalte(x, y, modus, stil) {
  if (modus === 'weg') { const k = net.dichtsteKnoop(x, y, 'tram', spel.jaar, 25); modus = k ? 'tram' : 'bus'; } // ligt er tramspoor in de weg: tramhalte (bussen stoppen er ook)
  if (modus === 'tram' && net.dichtsteKnoop(x, y, 'tram', spel.jaar, 60) == null) { melding('Een tramhalte moet aan tramspoor liggen. Klik dichter bij een tramlijn.'); return null; }
  if (BUSMODI.includes(modus)) { const p = halteOpWeg(x, y, Math.max(40, 12 * (kaart.res || 1))); if (p) { x = p.x; y = p.y; } }
  else if (modus === 'tram' || modus === 'metro') { const k = net.dichtsteKnoop(x, y, modus, spel.jaar, 60); if (k) { x = Math.round(k.x); y = Math.round(k.y); } }
  const kosten = HALTEKOSTEN[modus] ?? 15000;
  if (!betaal(kosten, 'een halte')) return null;
  const h = { id: S.nieuwId('h'), naam: halteNaam(x, y, modus), modus, x, y, eigen: true, gereedDag: spel.dag, ...(modus === 'tram' ? { bus: true } : {}) };
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
// Haltes met meerdere perrons (per richting, of apart voor bus en tram) zijn één halte: zelfde naam (zonder
// plaatsnaam ervoor) binnen 300 m. Zit er een tramperron bij, dan is het een tramhalte (bussen stoppen er ook).
const halteSleutel = n => String(n).replace(/^[^,]+,\s*/, '').toLowerCase().replace(/\s+/g, ' ').trim();
function groepeerHaltes(haltes) {
  const sleutel = halteSleutel;
  const raster = new Map(), groepen = [];
  for (const h of haltes) {
    const k = sleutel(h[0]), cx = Math.floor(h[1] / 500), cy = Math.floor(h[2] / 500);
    let g = null;
    for (let i = cx - 1; i <= cx + 1 && !g; i++) for (let j = cy - 1; j <= cy + 1 && !g; j++) g = (raster.get(i + ',' + j) || []).find(q => q.k === k && Math.hypot(q.perrons[0].x - h[1], q.perrons[0].y - h[2]) < 300) || null;
    if (!g) { g = { k, naam: h[0], perrons: [], modi: 0 }; groepen.push(g); const key = cx + ',' + cy; if (!raster.has(key)) raster.set(key, []); raster.get(key).push(g); }
    g.perrons.push({ x: h[1], y: h[2], modi: h[3] }); g.modi |= h[3];
    if (h[0].length > g.naam.length) g.naam = h[0]; // de naam met plaats ervoor
  }
  for (const g of groepen) { g.x = g.perrons.reduce((a, p) => a + p.x, 0) / g.perrons.length; g.y = g.perrons.reduce((a, p) => a + p.y, 0) / g.perrons.length; }
  return groepen;
}
// tram- en bushaltes uit de kaart: perrons per richting met dezelfde naam (binnen 300 m) worden één halte
function perronsSamen(stations) {
  const uit = [], raster = new Map();
  for (const st of stations) {
    if (!['tram', 'sneltram', 'busstation'].includes(st.s)) { uit.push(st); continue; }
    const cx = Math.floor(st.x / 500), cy = Math.floor(st.y / 500);
    let g = null;
    for (let i = cx - 1; i <= cx + 1 && !g; i++) for (let j = cy - 1; j <= cy + 1 && !g; j++) g = (raster.get(i + ',' + j) || []).find(q => q.s === st.s && q.n === st.n && Math.hypot(q.perrons[0].x - st.x, q.perrons[0].y - st.y) < 300) || null;
    if (g) { g.perrons.push({ x: st.x, y: st.y }); g.x = g.perrons.reduce((a, q) => a + q.x, 0) / g.perrons.length; g.y = g.perrons.reduce((a, q) => a + q.y, 0) / g.perrons.length; continue; }
    const n = { ...st, perrons: [{ x: st.x, y: st.y }] }; uit.push(n);
    const key = cx + ',' + cy; if (!raster.has(key)) raster.set(key, []); raster.get(key).push(n);
  }
  for (const st of uit) if (st.perrons?.length === 1) delete st.perrons;
  return uit;
}
// Een vliegveld is ook een station: één plek waar vliegtuigen landen en treinen of bussen stoppen. Ligt er een
// treinstation bij (Schiphol), dan is dat de plek; anders een bushalte bij het vliegveld; anders een eigen stip.
function vliegveldKnopen() {
  for (const v of D.vliegvelden) {
    v.kx = v.x; v.ky = v.y; v.knoop = null;
    if (v.s === 'militair') continue;
    let b = null, bd = 2500;
    for (const st of D.stations) if (st.s === 'trein') { const d = Math.hypot(st.x - v.x, st.y - v.y); if (d < bd) { bd = d; b = st; } }
    if (b) { v.knoop = { naam: b.n, soort: 'trein' }; v.kx = b.x; v.ky = b.y; }
    else {
      let g = null; bd = 1200;
      for (const q of D.halteGroepen || []) if (q.modi & (8 | 32) && !q.vliegveld) { const d = Math.hypot(q.x - v.x, q.y - v.y); if (d < bd) { bd = d; g = q; } }
      if (g) { v.knoop = { naam: g.naam, soort: 'bus' }; v.kx = g.x; v.ky = g.y; }
    }
    // bushaltes bij het vliegveld (of bij het station ervan) horen bij dit ene station
    for (const q of D.halteGroepen || []) if (q.modi & (8 | 32) && !q.vliegveld && (Math.hypot(q.x - v.kx, q.y - v.ky) < 800 || (/airport|luchthaven|vliegveld/i.test(q.naam) && Math.hypot(q.x - v.x, q.y - v.y) < 2000))) q.vliegveld = v.n;
  }
}
// Stopplek van een trein, metro of tram: langs het perron, op het spoor (niet bij de stationsstip, die ligt vaak bij het
// gebouw). Per halte het perron dat tegen het spoor van de route ligt en het dichtst bij het station; anders het
// punt op het spoor het dichtst bij het station. Zet h.sx/h.sy (de halte zelf blijft waar hij is).
function stopPlekken(haltes, pts) {
  const n = pts.length / 2; if (n < 2) return;
  const proj = (x, y, i0, i1) => { let bd = Infinity, b = null;
    for (let k = Math.max(1, i0); k < Math.min(n, i1); k++) { const ax = pts[k * 2 - 2], ay = pts[k * 2 - 1], dx = pts[k * 2] - ax, dy = pts[k * 2 + 1] - ay, l2 = dx * dx + dy * dy || 1e-9;
      const f = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)), px = ax + dx * f, py = ay + dy * f, d = Math.hypot(x - px, y - py); if (d < bd) { bd = d; b = { x: px, y: py, d, k }; } }
    return b; };
  let k0 = 1;
  for (const h of haltes) {
    const basis = proj(h.x, h.y, k0, n); if (!basis) continue;
    // perrons in de buurt die tegen dit stuk spoor aan liggen
    let beste = null, bs = Infinity;
    const lijst = new Set(); for (let i = Math.floor((basis.x - 350) / 250); i <= Math.floor((basis.x + 350) / 250); i++) for (let j = Math.floor((basis.y - 350) / 250); j <= Math.floor((basis.y + 350) / 250); j++) for (const q of D.perrons.raster.get(i + ',' + j) || []) lijst.add(q);
    for (const q of lijst) {
      const [x0, y0, x1, y1] = q.bbox, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (Math.hypot(cx - basis.x, cy - basis.y) > 350) continue;
      const c = proj(cx, cy, Math.max(1, basis.k - 60), basis.k + 60); if (!c) continue;
      // langs het spoor: een hoek of rand van het perron ligt binnen ~6 m van de route
      let raak = Infinity; for (let i = 0; i + 1 < q.pts.length; i += 2) { const e = proj(q.pts[i], q.pts[i + 1], Math.max(1, c.k - 8), c.k + 8); if (e) raak = Math.min(raak, e.d); }
      if (raak > 7) continue;
      const score = Math.hypot(cx - h.x, cy - h.y);
      if (score < bs) { bs = score; beste = c; }
    }
    const stop = beste || basis;
    h.sx = Math.round(stop.x * 10) / 10; h.sy = Math.round(stop.y * 10) / 10; k0 = Math.max(1, stop.k - 1);
  }
}
// per halte met meerdere perrons het perron kiezen dat het best op de route ligt (kleinste omweg tussen vorige en volgende)
function perronsKiezen(p) {
  for (let i = 0; i < p.length; i++) {
    const h = p[i]; if (!h.perrons || h.perrons.length < 2) continue;
    const a = p[i - 1], b = p[i + 1];
    const kost = q => (a ? Math.hypot(q.x - a.x, q.y - a.y) : 0) + (b ? Math.hypot(q.x - b.x, q.y - b.y) : 0);
    const beste = h.perrons.reduce((x, q) => kost(q) < kost(x) ? q : x);
    h.x = beste.x; h.y = beste.y;
  }
}

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
  if (modus === 'vlucht') return D.vliegvelden.filter(v => v.s !== 'militair' && !(v.b && v.b > spel.jaar)).map(v => ({ naam: v.n, veld: v.n, x: v.kx ?? v.x, y: v.ky ?? v.y, baan: v.baan, verhard: v.verhard, landing: v.landing, heli: v.s === 'heliport' }));
  const st = { trein: ['trein'], metro: ['metro', 'sneltram'], sneltram: ['sneltram', 'tram', 'metro'], tram: ['tram', 'sneltram'], bus: ['busstation'], hov: ['busstation'], belbus: ['busstation'], veer: ['veer'], watertaxi: ['veer'] }[modus];
  for (const s of D.stations) if (st.includes(s.s) && stationZichtbaar(s, spel.jaar)) uit.push({ naam: s.n, x: s.x, y: s.y, p: s.p, ...(s.perrons ? { perrons: s.perrons } : {}) });
  const bit = { trein: 1, metro: 2, sneltram: 6, tram: 4, bus: 8 | 32, hov: 8, belbus: 8 | 32, veer: 16, watertaxi: 16 }[modus];
  const opNaam = new Map(); for (const c of uit) { const k = halteSleutel(c.naam); if (!opNaam.has(k)) opNaam.set(k, []); opNaam.get(k).push(c); }
  if (spel.jaar >= 2015) for (const g of D.halteGroepen || []) {
    if (!(g.modi & bit)) continue;
    // bus: alle bus-perrons; tram: alleen perrons met tramspoor
    const pr = g.perrons.filter(q => q.modi & bit), x = pr.reduce((a, q) => a + q.x, 0) / pr.length, y = pr.reduce((a, q) => a + q.y, 0) / pr.length;
    // dezelfde halte staat soms ook als tramhalte op de kaart (OpenStreetMap): dan samen één halte
    // hoort bij een vliegveld: één halte op de plek van het vliegveld-station, met alle perrons
    if (g.vliegveld) { const v = D.vliegvelden.find(q => q.n === g.vliegveld); let c = uit.find(q => q.vliegveld === g.vliegveld);
      if (!c) { c = { naam: g.vliegveld, x: v?.kx ?? x, y: v?.ky ?? y, vliegveld: g.vliegveld, perrons: [] }; uit.push(c); }
      c.perrons.push(...pr.map(q => ({ x: q.x, y: q.y }))); continue; }
    const al = (opNaam.get(g.k) || []).find(c => Math.hypot(c.x - x, c.y - y) < 300);
    if (al) { al.perrons = [...(al.perrons || [{ x: al.x, y: al.y }]), ...pr.map(q => ({ x: q.x, y: q.y }))]; continue; }
    uit.push({ naam: g.naam, x, y, ...(pr.length > 1 ? { perrons: pr.map(q => ({ x: q.x, y: q.y })) } : {}), ...(g.modi & 4 ? { tramhalte: true } : {}) });
  }
  for (const h of spel.haltes) if (isKlaar(h) && (h.modus === modus || (['bus', 'hov', 'belbus'].includes(modus) && (['bus', 'hov', 'belbus'].includes(h.modus) || h.bus)) || (modus === 'watertaxi' && h.modus === 'veer'))) uit.push({ naam: h.naam, x: h.x, y: h.y, eigen: h.id });
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
function verdubbelOntwerpen(x, y, kant = 0, passeer = false) {
  const o = ontwerpVerdubbeling(net, D.perrons, x, y, spel.jaar, kant, passeer);
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
  const max = spel.groot ? 3 : 8;
  treinGebiedBijwerken();
  // lege regio: opdrachten in jouw regio, en soms van jouw regio naar een belangrijk punt erbuiten
  const regio = spel.leeg ? leegGebiedTest(spel.leeg) : null;
  for (let k = 0; k < 20 && spel.aanbiedingen.filter(a => a.status === 'open').length < max; k++) {
    const a = bedenkAanbieding(spel, D.stations, D.plaatsen, { voorz: D.voorz, ...(regio ? { binnen: regio, doelBinnen: Math.random() < 0.7 ? regio : null } : {}) }); if (a) spel.aanbiedingen.push(a); }
  opheffingenZoeken();
}
// een andere vervoerder stopt met een korte lijn (alleen echte dienstregeling, nooit je eigen bedrijf)
let opheffingBezig = false;
async function opheffingenZoeken() {
  if (opheffingBezig || !spel || spel.jaar < 2020 || spel.leeg) return; // lege regio: daar is al alles opgeheven
  const open = (spel.aanbiedingen || []).filter(a => a.opheffing && a.status === 'open').length;
  if (open >= (subsidieNiveau(spel) <= 1 ? 2 : 1) || (open && Math.random() > 0.15)) return;
  opheffingBezig = true;
  try {
    const kand = D.vervoerders.filter(v => !vanSpeler(v.id) && ((v.modi.trein || 0) > 0 || (v.modi.bus || 0) > 0));
    for (let poging = 0; poging < 4; poging++) {
      const v = kand[Math.floor(Math.random() * kand.length)]; if (!v) break;
      const lijnen = (await laadVervoerderLijnen(v, spel.aiVerschuiving)).filter(l => l.sleutel.endsWith(':0') && ['trein', 'bus'].includes(l.modus) && !AI.opgeheven.has(`${l.vervoerder}:${l.lijnId}`));
      const kort = lijnen.filter(l => { const km = (l.route?.lengte || 0) / 1000; return l.modus === 'trein' ? km > 8 && km < 35 && l.haltes.length >= 3 : km > 4 && km < 18 && l.haltes.length >= 4; });
      if (!kort.length) continue;
      const ai = kort[Math.floor(Math.random() * kort.length)], a = opheffingAanbieding(spel, ai, D.plaatsen); if (!a) continue;
      // de lijn verdwijnt bij de oude vervoerder (beide richtingen)
      const sl = a.opheffing.sleutel; AI.opgeheven.add(sl); (spel.opgeheven ||= []).push(sl);
      AI.lijnen = AI.lijnen.filter(x => `${x.vervoerder}:${x.lijnId}` !== sl);
      spel.aanbiedingen.push(a);
      melding(`${a.opheffing.vervoerder} stopt met lijn ${a.opheffing.nr} (${a.a.naam} – ${a.b.naam}). De provincie zoekt een nieuwe vervoerder: zie Subsidie.`, 9000);
      break;
    }
  } finally { opheffingBezig = false; }
}
// opdrachten die een paar dagen goed lopen, tellen als geslaagd: de provincie geeft dan grotere opdrachten
function succesTellen() {
  for (const l of spel.lijnen) { if (!l.aanbod) continue; const a = (spel.aanbiedingen || []).find(x => x.id === l.aanbod.id); if (!a) continue;
    a.okDagen = l.aanbodOk && l.actief ? (a.okDagen || 0) + 1 : 0;
    if (a.okDagen >= 3 && !a.volbracht) { const voor = subsidieNiveau(spel); a.volbracht = true; spel.subsidieSucces = (spel.subsidieSucces || 0) + 1;
      melding(subsidieNiveau(spel) > voor ? `De provincie is tevreden over ${a.a.naam} – ${a.b.naam}: je krijgt voortaan grotere opdrachten (niveau ${subsidieNiveau(spel) + 1}).` : `Subsidieopdracht ${a.a.naam} – ${a.b.naam} goed uitgevoerd.`, 8000); } }
}
// goederenaanvragen aanvullen (bij de start meteen een paar eenvoudige)
function vrachtAanvullen(n = 1) {
  spel.vrachtAanvragen = (spel.vrachtAanvragen || []).filter(a => a.tot >= spel.dag);
  let nieuw = 0;
  for (let k = 0; k < n * 3 && nieuw < n; k++) {
    const a = bedenkAanvraag(spel, p => { const [x, y] = wgsNaarRd(p[1], p[2]); return { x, y }; }, (pa, pb) => net.route([pa.x, pa.y], [pb.x, pb.y], 'trein', spel.jaar));
    if (a) { spel.vrachtAanvragen.push(a); nieuw++; }
  }
  const b = $('b-vracht'); if (b) { b.hidden = !spel.vrachtAanvragen.length; b.textContent = spel.vrachtAanvragen.length; }
  return nieuw;
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
let subFilter = { modus: [], prov: [], land: '' };   // land '' = alle landen
// hoe de onderdelen van een land heten
const REGIO_NAAM = { NL: 'Provincies', BE: 'Provincies', DE: 'Deelstaten', AT: 'Deelstaten', LU: 'Kantons', CH: 'Kantons', FR: 'Regio\'s' };
function provinciesVan(a) {
  if (!a.provincies && territorium?.gem.length) a.provincies = [...new Set([territorium.provincieVan(a.a.x, a.a.y), territorium.provincieVan(a.b.x, a.b.y)])].filter(p => p >= 0);
  return a.provincies || [];
}
const landenVan = a => new Set(provinciesVan(a).map(p => territorium?.prov[p]?.land).filter(Boolean));
const pastBijFilter = a => (!subFilter.modus.length || subFilter.modus.includes(a.modus))
  && (!subFilter.land || landenVan(a).has(subFilter.land))
  && (!subFilter.prov.length || provinciesVan(a).some(p => subFilter.prov.includes(p)))
  && treinMogelijk(a);
const subsidieLijst = () => (spel.aanbiedingen || []).filter(a => a.status !== 'verlopen' && pastBijFilter(a)).sort((p, q) => (q.lijnId ? 1 : 0) - (p.lijnId ? 1 : 0));
// landen waar spoor in de gegevens zit: steekproef langs de spoortakken (één keer, zodra grenzen en net geladen zijn)
let spoorLanden = null;
function treinGebiedBijwerken() {
  if (spoorLanden || !territorium?.gem?.length || !net?.takken?.length) return;
  spoorLanden = new Set();
  const treinTakken = net.takken.filter(t => t.soort === 0 && t.pts?.length >= 2);
  const stap = Math.max(1, Math.floor(treinTakken.length / 1500));
  for (let k = 0; k < treinTakken.length; k += stap) { const t = treinTakken[k], m = (t.pts.length >> 2) << 1, p = territorium.provincieVan(t.pts[m], t.pts[m + 1]); if (p >= 0) spoorLanden.add(territorium.prov[p].land); }
  if (!spoorLanden.size) { spoorLanden = null; return; }
  zetTreinGebied((x, y) => { const p = territorium.provincieVan(x, y); return p < 0 ? false : spoorLanden.has(territorium.prov[p].land); });
  for (const a of spel?.aanbiedingen || []) if (a.status === 'open' && !a.lijnId && !treinMogelijk(a)) a.status = 'verlopen';   // eerder uitgegeven treinsubsidies in landen zonder spoor
}
// aanbiedingen bij het filter erbij zoeken (tot er minstens n open passen)
function subsidiesZoeken(n = 4) {
  spel.aanbiedingen = spel.aanbiedingen || [];
  treinGebiedBijwerken();
  const binnen = !territorium ? undefined : subFilter.prov.length ? (x, y) => subFilter.prov.includes(territorium.provincieVan(x, y))
    : subFilter.land ? (x, y) => territorium.prov[territorium.provincieVan(x, y)]?.land === subFilter.land : undefined;
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
        ${redenTekst(a) ? `<p class="klein"><i>${esc(redenTekst(a))}</i></p>` : ''}
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
  const locs = [...beschikbaarLos(spel.jaar), ...VLOOT.filter(v => v.soort === 'loc' && spel.voertuigen[v.id])].filter(v => v.modus === l.modus).filter((v, i, a) => v.soort === 'loc' && a.indexOf(v) === i && kanOp(v.id, sys));
  return locs.length ? `<select id="sleep-${l.id}">${locs.map(v => `<option value="${v.id}">${esc(v.naam)}${spel.voertuigen[v.id] ? ` (${spel.voertuigen[v.id]} in bezit)` : ` · ${S.euroKort(v.prijs)}`}</option>`).join('')}</select><button class="knop klein" data-actie="sleeploc" data-id="${l.id}">Sleeploc inzetten (${l.nodig} nodig)</button>` : '';
}
// mag deze eigen lijn met dit materieel rijden? anders stilzetten tot het is opgelost
function stroomBijwerken(l) {
  if (!l || l.ai || l.bijzonder || (l.echt && !l.aangepast)) return;
  if (l.modus === 'trein') { const w = wisselsPerRit(net, l); l._landFrac = landVerdeling(net, l); if (w !== (l._wissels || 0)) { l._wissels = w; S.herbereken(l); } }
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
  const per = nodigPer(id), gebruikt = c => spel.lijnen.filter(l => l.actief).reduce((a, l) => a + (nodigLijn(l)[c] || 0), 0);
  const tekort = Object.entries(per).map(([c, k]) => [c, Math.max(0, k * tmp.nodig - Math.max(0, (spel.voertuigen[c] || 0) - gebruikt(c)))]).filter(x => x[1] > 0);
  const kosten = tekort.reduce((a, [c, n]) => a + n * TYPE[c].prijs, 0);
  return `<p class="klein">Rijtijd ${Math.round(tmp.duur / 60)} min · nodig <b>${tmp.nodig}</b> × ${esc(TYPE[id].naam)}${tekort.length ? ` · nog te kopen: ${tekort.map(([c, n]) => `${n} × ${esc(TYPE[c].naam)}`).join(', ')} (${S.euroKort(kosten)})` : ' · genoeg vrij in je vloot'}</p>`;
}
// ---------------------------------------------------------------- materieel per lijn (mix)
// Welke van je voertuigen op een lijn rijden, hoeveel, in welke volgorde (voorrang) en wanneer (hele dag of alleen spits).
// doel: 'nl' (nieuwe lijn, de mix staat in paneelData) of een bestaande lijn.
const isRijdbaar = t => t && !['rijtuig', 'stuurstand', 'loc', 'wagon'].includes(t.soort);
function eigenSoorten(modus, mix = []) {
  const ids = [];
  const voeg = id => { if (id && TYPE[id] && TYPE[id].modus === modus && !ids.includes(id)) ids.push(id); };
  for (const m of mix) voeg(m.id);
  for (const [id, n] of Object.entries(spel.voertuigen)) if (n > 0 && isRijdbaar(TYPE[id]) && !TYPE[id].samen) voeg(id);
  for (const id of spel.samenstellingen || []) if (TYPE[id] && Object.keys(nodigPer(id)).every(c => spel.voertuigen[c])) voeg(id);
  return ids;
}
const werkdagVan = dag => { let x = dag; while (S.isWeekend(x)) x++; return x; };
// tijdelijke lijn om te rekenen hoeveel er nodig is (nieuwe lijn)
function nlRekenLijn(d) {
  const id = hoofdType({ mix: d.mix }) || d.typeKeuze || typenVoor(d.modus)[0]?.id; if (!id || !d.route) return null;
  const sp = +(d.spitsIn || (d.modus === 'trein' ? 30 : 15)), dal = +(d.dalIn || 30), av = +(d.avondIn || 60);
  const tmp = { modus: d.modus, typeId: id, haltes: d.haltes, route: d.route, interval: { vroeg: dal, ochtendspits: sp, dal, avondspits: sp, avond: av }, eerste: 6 * 60, laatste: 23 * 60, offset: 0, richting: d.rond ? 'rond' : d.richting || 'beide' };
  try { S.herbereken(tmp); return tmp; } catch { return null; }
}
const mixVan = doel => doel === 'nl' ? (paneelData.mix ||= []) : zorgMix(doel);
function zorgMix(l) {   // oude lijnen (standaard + alternatief): omzetten naar een mix met wat ze nu inzetten
  if (!heeftMix(l)) {
    const hoofd = S.eigenDeel(spel, l, l.typeId).deel, alt = l.altTypeId ? Math.round(S.altDeel(spel, l) * l.nodig) : 0;
    l.mix = mixUitOud(spel, l, id => id === l.typeId ? hoofd : alt); delete l.altTypeId; l._altD = undefined;
  }
  return l.mix;
}
function mixGewijzigd(doel) {
  if (doel === 'nl') return;
  const h = hoofdType(doel); doel._altD = undefined;
  if (h && h !== doel.typeId) { doel.typeId = h; S.herbereken(doel); stroomBijwerken(doel); }
}
// gekochte of samengestelde voertuigen meteen op een lijn zetten (tot wat de lijn nodig heeft)
function mixErbij(l, id, n) {
  const mix = zorgMix(l), m = mix.find(x => x.id === id), op = mix.reduce((a, x) => a + (x.n || 0), 0);
  const k = Math.max(0, Math.min(n, vrijVoor(spel, id, l) - (m?.n || 0), Math.max(n, l.nodig - op)));
  if (m) m.n = (m.n || 0) + k; else mix.push({ id, n: k, rol: 'hoofd' });
  mixGewijzigd(l);
}
function mixKoopLijst(doel, modus, tekort) {
  const open = doel === 'nl' ? paneelData._mixKoop : mixKoopOpen?.id === doel.id ? mixKoopOpen.soort : null; if (!open) return '';
  const did = doel === 'nl' ? 'nl' : doel.id;
  if (open === 'nieuw') {
    const lijst = typenVoor(modus).filter(isRijdbaar);
    return `<div class="kaartje"><b>Nieuw kopen voor deze lijn</b><table class="tabel">${lijst.map(t => `<tr><td>${esc(t.naam)}<br><span class="klein">${plaatsenVan(t.id)} pl. · ${t.vmax} km/u · ${S.euroKort(t.prijs)} per stuk</span></td>
      <td><input type="number" min="1" max="99" value="${Math.max(1, tekort)}" id="mixn-${did}-${t.id}" style="width:4em"></td><td><button class="knop klein hoofd" data-actie="mix-koop" data-doel="${did}" data-type="${t.id}">Kopen</button></td></tr>`).join('')}</table>
      <p class="klein">Wat je koopt, komt meteen op deze lijn.</p></div>`;
  }
  const aanbod = (spel.markt || []).filter(a => a.n > 0 && TYPE[a.typeId]?.modus === modus && isRijdbaar(TYPE[a.typeId]));
  return `<div class="kaartje"><b>Tweedehands voor deze lijn</b>${aanbod.length ? `<table class="tabel">${aanbod.map(a => { const t = TYPE[a.typeId]; return `<tr><td>${a.soort === 'klassieker' ? '★ ' : ''}${esc(t.naam)}<br><span class="klein">${a.n} stuks bij ${esc(a.van)} · ${a.leeftijd} jaar · ${STAAT[a.staat].naam}${a.staat === 'slecht' ? ' (eerst revisie)' : ''} · ${S.euroKort(a.prijs)} per stuk (nieuw ${S.euroKort(t.prijs)})</span></td>
      <td><input type="number" min="1" max="${a.n}" value="${Math.max(1, Math.min(a.n, tekort))}" id="mixm-${did}-${a.id}" style="width:4em"></td><td><button class="knop klein hoofd" data-actie="mix-markt" data-doel="${did}" data-id="${a.id}">Kopen</button></td></tr>`; }).join('')}</table>`
    : `<p class="klein">Er staat nu niets van deze soort op de tweedehandsmarkt.</p>`}</div>`;
}
let mixKoopOpen = null;
function mixBlok(doel, d = null, typen = null) {
  const nl = doel === 'nl', modus = nl ? d.modus : doel.modus, l = nl ? null : doel;
  if (nl && d.typeKeuze && d.typeKeuze !== d._mixVerwerkt && TYPE[d.typeKeuze]) {   // net samengesteld of gekozen: erbij zetten
    d._mixVerwerkt = d.typeKeuze; const mix = (d.mix ||= []);
    if (!mix.some(m => m.id === d.typeKeuze)) { const r = nlRekenLijn(d); mix.push({ id: d.typeKeuze, n: Math.min(vrijVoor(spel, d.typeKeuze), Math.max(0, (r?.nodig || 1) - mix.reduce((a, m) => a + m.n, 0))), rol: 'hoofd' }); }
  }
  if (nl && !d.mix) {   // eerste keer: wat je vrij hebt van deze soort, anders niets (dan kopen)
    d.mix = []; const r = nlRekenLijn({ ...d, mix: [] });
    for (const id of eigenSoorten(modus)) { const v = vrijVoor(spel, id); if (v > 0 && r) { d.mix.push({ id, n: Math.min(v, r.nodig), rol: 'hoofd' }); break; } }
  }
  const mix = nl ? d.mix : (heeftMix(l) ? l.mix : mixUitOud(spel, l, id => id === l.typeId ? S.eigenDeel(spel, l, l.typeId).deel : Math.round(S.altDeel(spel, l) * l.nodig)));
  const reken = nl ? nlRekenLijn(d) : l;
  const nodigSpits = reken?.nodig || 0, nodigDag = reken ? nodigOp(reken, werkdagVan(spel.dag), 12 * 60) : 0;
  const did = nl ? 'nl' : l.id;
  const tel = rol => mix.filter(m => TYPE[m.id] && (!rol || m.rol === rol || (rol === 'hoofd' && m.rol !== 'spits'))).reduce((a, m) => a + (m.n || 0), 0);
  const dag = tel('hoofd'), totaal = tel(), tekort = Math.max(0, nodigSpits - totaal);
  const andere = eigenSoorten(modus, mix).filter(id => !mix.some(m => m.id === id));
  const rij = (m, i) => { const t = TYPE[m.id]; if (!t) return ''; const vrij = vrijVoor(spel, m.id, l) - (nl ? m.n : 0) - (nl ? 0 : m.n);
    return `<tr><td><b>${esc(t.naam)}</b><br><span class="klein">${plaatsenVan(m.id)} pl. · ${t.vmax} km/u${kenmerk(m.id)?.comfort ? ` · comfort ${komma(kenmerk(m.id).comfort)}` : ''} · nog ${Math.max(0, vrij)} vrij</span></td>
      <td class="mixaantal"><button class="knop klein" data-actie="mix-n" data-doel="${did}" data-i="${i}" data-w="-1" ${m.n > 0 ? '' : 'disabled'}>−</button><b>${m.n || 0}</b><button class="knop klein" data-actie="mix-n" data-doel="${did}" data-i="${i}" data-w="1" ${vrij > 0 ? '' : 'disabled title="Geen vrije voertuigen meer: koop er bij"'}>＋</button></td>
      <td><select data-wijzig="mix-rol" data-doel="${did}" data-i="${i}">${Object.entries(ROLLEN).map(([k, n]) => `<option value="${k}" ${(m.rol || 'hoofd') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td class="mixvolg"><button class="knop klein" data-actie="mix-op" data-doel="${did}" data-i="${i}" ${i ? '' : 'disabled'} title="Meer voorrang">▲</button><button class="knop klein" data-actie="mix-weg" data-doel="${did}" data-i="${i}" title="Van deze lijn halen">✕</button></td></tr>`; };
  const status = !nodigSpits ? '' : totaal < nodigSpits ? `<span class="chip fout">${nodigSpits - totaal} te weinig in de spits</span>` : dag < nodigDag ? `<span class="chip fout">overdag ${nodigDag - dag} te weinig (alleen-spits telt overdag niet)</span>` : `<span class="chip goed">genoeg</span>`;
  return `<div class="mixblok">
    <p>Nodig: <b>${nodigSpits}</b> in de spits · <b>${nodigDag}</b> overdag · op deze lijn: <b>${totaal}</b>${tel('spits') ? ` (waarvan ${tel('spits')} alleen in de spits)` : ''} ${status}</p>
    ${mix.length ? `<table class="tabel mixtabel"><tr><th>Materieel (bovenaan = eerst ingezet)</th><th>Op deze lijn</th><th>Wanneer</th><th></th></tr>${mix.map(rij).join('')}</table>` : `<p class="klein">Nog geen materieel op deze lijn: kies hieronder wat je hebt, of koop iets.</p>`}
    ${andere.length ? `<p class="klein">Ook in je vloot:</p><div class="rij">${andere.map(id => `<button class="knop klein" data-actie="mix-erbij" data-doel="${did}" data-type="${id}" title="${vrijVoor(spel, id, l)} vrij">＋ ${esc(TYPE[id].naam)} <span class="klein">(${vrijVoor(spel, id, l)} vrij)</span></button>`).join('')}</div>` : ''}
    <div class="rij"><button class="knop klein" data-actie="mix-bouwer" data-doel="${did}">＋ Nieuw voertuig samenstellen…</button>
      <button class="knop klein" data-actie="mix-koopnieuw" data-doel="${did}">🛒 Nieuw kopen…</button>
      <button class="knop klein" data-actie="mix-tweedehands" data-doel="${did}">♻ Tweedehands…</button></div>
    ${mixKoopLijst(doel, modus, tekort)}
    <p class="klein">Volgorde = voorrang: bovenaan rijdt het meest, zo veel als nodig. <b>Alleen spits</b> rijdt alleen op werkdagen van 7–9 en 16–18:30 als extra, bijvoorbeeld ouder materieel, zodat er de rest van de dag met het comfortabelere wordt gereden.</p></div>`;
}
const mixSamenvatting = l => { const mix = heeftMix(l) ? l.mix : null;
  return `<p>Nodig: <b>${l.nodig}</b> · inzetbaar: <b>${S.beschikbaarVoor(spel, l)}</b>${mix ? ` · ${mix.filter(m => TYPE[m.id]).map(m => `${m.n} × ${esc(TYPE[m.id].naam)}${m.rol === 'spits' ? ' (spits)' : ''}`).join(', ')}` : ''}${S.beschikbaarVoor(spel, l) < l.nodig ? ' · <span class="chip fout">te weinig: er vallen ritten uit</span>' : ''}</p>`; };
// invoer van een nieuwe lijn bewaren voordat het paneel opnieuw getekend wordt
const nlBewaar = dd => { dd.nrIn = $('nl-nr')?.value ?? dd.nrIn; dd.naamIn = $('nl-naam')?.value ?? dd.naamIn; dd.spitsIn = $('nl-spits')?.value ?? dd.spitsIn; dd.dalIn = $('nl-dal')?.value ?? dd.dalIn; dd.avondIn = $('nl-avond')?.value ?? dd.avondIn; };
function mixActie(a, d) {
  const nl = d.doel === 'nl', l = nl ? null : lijnVan(d.doel); if (!nl && !l) return;
  const doel = nl ? 'nl' : l, mix = mixVan(doel), i = +d.i;
  if (nl) nlBewaar(paneelData);
  const koop = (typeId, n) => { const per = nodigPer(typeId), kosten = Object.entries(per).reduce((s2, [c, k]) => s2 + TYPE[c].prijs * k * n, 0);
    if (!betaal(kosten, `${n} × ${TYPE[typeId].naam}`)) return false;
    for (const [c, k] of Object.entries(per)) { spel.voertuigen[c] = (spel.voertuigen[c] || 0) + k * n; (spel.aankopen ||= []).push({ id: c, n: k * n, dag: spel.dag, jaar: spel.jaar }); }
    melding(`${n} × ${TYPE[typeId].naam} gekocht (${S.euroKort(kosten)}) en op deze lijn gezet.`); return true; };
  const zet = (typeId, n) => { if (nl) { const m = mix.find(x => x.id === typeId); if (m) m.n += n; else mix.push({ id: typeId, n, rol: 'hoofd' }); } else mixErbij(l, typeId, n); };
  if (a === 'mix-n') { const m = mix[i]; if (!m) return; const w = +d.w; m.n = Math.max(0, (m.n || 0) + (w > 0 ? Math.min(1, vrijVoor(spel, m.id, l) - (nl ? m.n : m.n)) : -1)); }
  else if (a === 'mix-op' && i > 0) [mix[i - 1], mix[i]] = [mix[i], mix[i - 1]];
  else if (a === 'mix-weg') mix.splice(i, 1);
  else if (a === 'mix-erbij') { const r = nl ? nlRekenLijn(paneelData) : l, op = mix.reduce((s2, m) => s2 + (m.n || 0), 0);
    mix.push({ id: d.type, n: Math.max(0, Math.min(vrijVoor(spel, d.type, l), Math.max(1, (r?.nodig || 1) - op))), rol: 'hoofd' }); }
  else if (a === 'mix-koopnieuw' || a === 'mix-tweedehands') { const s2 = a === 'mix-koopnieuw' ? 'nieuw' : 'markt';
    if (nl) paneelData._mixKoop = paneelData._mixKoop === s2 ? null : s2; else mixKoopOpen = mixKoopOpen?.id === l.id && mixKoopOpen.soort === s2 ? null : { id: l.id, soort: s2 }; }
  else if (a === 'mix-koop') { const n = d._n || Math.max(1, Math.round(+$(`mixn-${d.doel}-${d.type}`)?.value || 1)); if (!koop(d.type, n)) return; zet(d.type, n); }
  else if (a === 'mix-markt') { const aa = (spel.markt || []).find(x => x.id === d.id); if (!aa) return; const n = Math.max(1, Math.min(aa.n, Math.round(+$(`mixm-${d.doel}-${aa.id}`)?.value || 1))), t = TYPE[aa.typeId];
    if (!betaal(aa.prijs * n, `${n} × ${t.naam} (tweedehands)`)) return; koopVanMarkt(spel, aa, n); zet(aa.typeId, n);
    melding(`${n} × ${t.naam} tweedehands gekocht van ${aa.van} (${S.euroKort(aa.prijs * n)}) en op deze lijn gezet${aa.staat === 'slecht' ? '; ze rijden pas na de revisie' : ''}.`, 7000); }
  else if (a === 'mix-bouwer') {
    if (nl) { terugNaarLijn = paneelData; openPaneel('bouwer', { modus: paneelData.modus, delen: [{ id: '', n: 1 }], aantal: 1, terug: true }); return; }
    openPaneel('bouwer', { modus: l.modus, delen: [{ id: '', n: 1 }], aantal: 1, terugLijn: l.id }); return;
  }
  mixGewijzigd(doel); ververs();
}

// ---------------------------------------------------------------- voertuig samenstellen
// Opbouw van een trein: met een treinstel (daarna alleen nog treinstellen erbij koppelen) of met een loc
// (daarna locs, rijtuigen en een stuurstandrijtuig). Andere modi: één voertuig.
const RAILMODI = ['trein', 'tram', 'metro', 'sneltram'];
const MODI_VOLG = ['trein', 'metro', 'sneltram', 'tram', 'bus', 'hov', 'belbus', 'veer', 'watertaxi', 'vlucht'];
const soortVan = x => x?.soort || TYPE[x?.basis]?.soort || '';
const opbouwVan = d => d.opbouw || (soortVan(TYPE[d.delen[0]?.id]) === 'loc' ? 'loc' : 'treinstel');
const catVan = (d, x, i) => { if (!RAILMODI.includes(d.modus)) return 'voertuig'; if (opbouwVan(d) === 'treinstel') return 'treinstel'; if (opbouwVan(d) === 'rijtuigen') return x.cat || soortVan(TYPE[x.id]) || 'rijtuig'; if (i === 0) return 'loc';
  return x.cat || soortVan(TYPE[x.id]) || 'rijtuig'; };
const CAT_NAAM = { rijtuigen: 'Alleen rijtuigen', treinstel: 'Treinstel', loc: 'Loc', rijtuig: 'Rijtuig', stuurstand: 'Stuurstandrijtuig', voertuig: 'Voertuig' };
const catNaam = (c, modus) => modus === 'trein' || !['treinstel', 'rijtuig', 'stuurstand'].includes(c) ? CAT_NAAM[c] : { treinstel: modus === 'tram' ? 'Tram (motorwagen)' : 'Metrostel', rijtuig: modus === 'tram' ? 'Bijwagen' : 'Rijtuig', stuurstand: 'Stuurstand' }[c];
function bouwKeuzes(d, cat) {
  const typen = [...beschikbaar(spel.jaar, d.modus), ...(RAILMODI.includes(d.modus) ? beschikbaarLos(spel.jaar).filter(v => v.modus === d.modus) : []), ...(spel.series || []).map(x => TYPE[x.id]).filter(x => x && x.modus === d.modus),
    ...Object.keys(spel.voertuigen).filter(id => spel.voertuigen[id] > 0 && TYPE[id]?.modus === d.modus && !TYPE[id]?.samen).map(id => TYPE[id])]
    .filter((x, i, a) => x && a.indexOf(x) === i && !['ddr', 'stoom3700'].includes(x.id)); // samengestelde oude sets bouw je nu zelf
  if (cat === 'voertuig') return typen;
  return typen.filter(x => (soortVan(x) || 'treinstel') === cat);
}
function bouwKaart(d, x, i) {
  const cat = catVan(d, x, i), t = TYPE[x.id], keuzes = bouwKeuzes(d, cat), trein = RAILMODI.includes(d.modus), ts = opbouwVan(d) === 'treinstel';
  const titel = !trein ? 'Voertuig' : i === 0 ? null : ts ? (d.modus === 'trein' ? 'Gekoppeld treinstel' : 'Gekoppeld') : null;
  // eerste kaart: treinstel of loc; daarna bij een loc-trein: loc, rijtuig of stuurstandrijtuig
  const knoppen = (opties, actie, huidig) => `<div class="segment">${opties.map(o => `<button class="knop klein ${o === huidig ? 'hoofd' : ''}" data-actie="${actie}" data-w="${o}" data-i="${i}">${catNaam(o, d.modus)}</button>`).join('')}</div>`;
  const rt = opbouwVan(d) === 'rijtuigen';
  const kop = !trein ? '' : (i === 0 ? knoppen(['treinstel', 'loc', 'rijtuigen'], 'bw-opbouw', opbouwVan(d)) : '') + (ts || (i === 0 && !rt) ? '' : knoppen(rt ? ['rijtuig', 'stuurstand'] : ['loc', 'rijtuig', 'stuurstand'], 'bw-cat', cat));
  const kl = t && t.soort !== 'loc' ? klassenVan(serieInrichting(x.id), x.id, d.modus) : [];
  return `<div class="bouwkaart"><div class="rij">${titel ? `<b class="klein">${titel}</b>` : ''}${kop}${i > 0 ? `<button class="knop klein" style="margin-left:auto" data-actie="bw-weg" data-i="${i}" title="weghalen">✕</button>` : ''}</div>
    <div class="foto">${schets(x.id ? [x.id] : [], d.modus)}</div>
    <select data-wijzig="bw-type" data-i="${i}"><option value="">— kies ${catNaam(cat, d.modus).toLowerCase()} —</option>${keuzes.map(v => `<option value="${v.id}" ${v.id === x.id ? 'selected' : ''}>${esc(v.naam)}${spel.voertuigen[v.id] ? ` (${spel.voertuigen[v.id]} in bezit)` : ''}</option>`).join('')}</select>
    ${t ? `${aandrijving(x.id, d.modus)}<p class="klein">${t.van}–${t.tot < 2100 ? t.tot : 'nu'} · ${t.vmax} km/u · ${vermogen(x.id) ? Math.round(vermogen(x.id)).toLocaleString('nl-NL') + ' kW · ' : ''}${Math.round(massa(x.id))} t${t.soort !== 'loc' ? ` · ${doorloop(x.id) ? 'doorloop' : 'geen doorloop'}` : ''} · ${S.euroKort(t.prijs)}</p>
      ${kl.length ? `<p class="klein">${kl.map(k => `${KLASSE_NAAM[k.klasse]} ${k.zit}${k.sta ? '+' + k.sta : ''} (${stoelNaam(k.stoel)})`).join('<br>')}${voorzieningen(x.id).length ? '<br>' + [...new Set(voorzieningen(x.id).map(v => v.naam))].join(', ') : ''}</p>
        <button class="knop klein" data-actie="bw-ink" data-i="${i}">Interieur…</button>` : ''}
      ${trein && (i > 0 || rt) && cat === 'rijtuig' ? `<label class="veld klein">Aantal<input type="number" min="1" max="20" value="${x.n || 1}" data-wijzig="bw-n" data-i="${i}" style="width:4em"></label>` : ''}` : ''}</div>`;
}
const bouwLijst = d => d.delen.filter(x => TYPE[x.id]).flatMap(x => Array(Math.max(1, x.n || 1)).fill(x.id));
// van een bestaand voertuig (samenstelling of type) weer kaarten maken, om te kopiëren
function bouwVan(typeId) {
  const t = TYPE[typeId], ids = t?.samen || [typeId], delen = [];
  for (const id of ids) { const l = delen[delen.length - 1]; if (l && l.id === id && delen.length > 0 && TYPE[id]?.soort !== 'loc') l.n++; else delen.push({ id, n: 1 }); }
  return { modus: t?.modus || 'trein', delen, aantal: 1 };
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
  perronsKiezen(p);
  if (['trein', 'metro', 'sneltram', 'tram'].includes(m)) {
    await delenVoorRoute(p);
    const pts = [], takken = []; let lengte = 0;
    for (let i = 1; i < p.length; i++) {
      let r = net.route([p[i - 1].x, p[i - 1].y], [p[i].x, p[i].y], m, spel.jaar);
      // geen verbinding: misschien loopt het spoor om door een provincie die nog niet geladen is
      if (!r && D.spoorIndex) { const a = p[i - 1], b = p[i], vak = [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
        const extra = D.spoorIndex.filter(d => !net.delen.has(d.c) && bboxRaakt(d.b, vak, 30000)).map(d => d.c);
        if (extra.length) { await laadDelen(extra, { reden: 'Omweg zoeken: meer sporen laden' }); r = net.route([a.x, a.y], [b.x, b.y], m, spel.jaar); } }
      if (!r) { waarschuwing = `Geen ${m === 'trein' ? 'spoor' : 'rails'}verbinding tussen ${p[i - 1].naam} en ${p[i].naam}; daar tekent het spel een rechte lijn. Leg dat stuk spoor aan.`; pts.push(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y); lengte += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); continue; }
      // het eerste en laatste punt van net.route zijn de stations zelf (bij het gebouw): niet heen rijden, op het spoor blijven
      const op = r.pts.length >= 8 ? r.pts.slice(2, -2) : r.pts;
      pts.push(...op); lengte += r.lengte; takken.push(...r.takken);
    }
    route = { pts, lengte, takken };
  } else if (m === 'vlucht') {
    // over de echte banen: taxiën, opstijgen, vliegen, nadering, landen, taxiën (zie vlucht.js)
    route = vluchtRoute(p.map(h => ({ x: h.x, y: h.y, veld: D.vliegvelden.find(v => v.n === (h.veld || h.naam)) })));
  } else if (m === 'veer' || m === 'watertaxi') {
    const pts = p.flatMap(h => [h.x, h.y]); let lengte = 0;
    for (let i = 1; i < p.length; i++) lengte += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    route = { pts, lengte };
  } else route = await wegRoute(p.map(h => [h.x, h.y]));
  return { route, waarschuwing };
}
// waar past een nieuwe stop het best? minimale extra afstand; vóór het begin of na het eind wordt hij het nieuwe begin/eind
function invoegPlek(p, c, beginVast) {
  if (p.length < 2) return p.length;
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let beste = p.length, kost = d(p[p.length - 1], c);
  if (!beginVast && d(p[0], c) < kost) { beste = 0; kost = d(p[0], c); }
  for (let i = 1; i < p.length; i++) { const k = d(p[i - 1], c) + d(c, p[i]) - d(p[i - 1], p[i]); if (k < kost) { kost = k; beste = i; } }
  return beste;
}
// de laatst toegevoegde stop weer weghalen
function laatsteWeg() {
  if (!bouw?.punten?.length) return;
  const naam = bouw.erbij?.pop(), i = naam ? bouw.punten.findIndex(q => q.naam === naam) : bouw.punten.length - 1;
  if (i >= 0 && bouw.punten.length > (bouw.terugVan ? 1 : 0)) bouw.punten.splice(i, 1);
  lijnVoorbeeld();
}
// de route vervormt mee met elke aangeklikte stop (over het echte spoor of de weg)
let voorbeeldNr = 0, voorbeeldTimer = null;
function lijnVoorbeeld() {
  clearTimeout(voorbeeldTimer);
  const leeg = { type: 'FeatureCollection', features: [] };
  if (!bouw?.punten || bouw.punten.length < 2) { if (kaart.map.getSource('lijn-voorbeeld')) kaart.bron('lijn-voorbeeld', leeg); return; }
  const nr = ++voorbeeldNr, m = bouw.modus, p = bouw.punten.slice();
  voorbeeldTimer = setTimeout(async () => {
    let r; try { r = await routeVoor(m, p); } catch { return; }
    if (nr !== voorbeeldNr || !bouw || tool !== 'lijn') return;
    const pts = r.route?.pts || [], c = []; for (let i = 0; i < pts.length; i += 2) c.push(lonlat(pts[i], pts[i + 1]));
    kaart.bron('lijn-voorbeeld', c.length >= 2 ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } }] } : leeg);
    kaart.laag({ id: 'lijn-voorbeeld', type: 'line', source: 'lijn-voorbeeld', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': spel.kleur || '#c2412d', 'line-width': 5, 'line-opacity': 0.75 } });
    const km = (r.route?.lengte || 0) / 1000;
    const ab = bouw.aanbod && (spel.aanbiedingen || []).find(x => x.id === bouw.aanbod), eis = ab?.eisen?.stops ? ` · eis: ${eisenTekst({ stops: ab.eisen.stops })}, nu ${Math.max(0, p.length - 2)} tussenstop${p.length === 3 ? '' : 's'}` : '';
    hint(`${p.map(q => esc(q.naam)).join(' → ')} · ${komma(km)} km${eis}${r.waarschuwing ? ' · ' + r.waarschuwing : ''}. Klik een station om het toe te voegen (komt vanzelf op de goede plek) of nog eens om het eruit te halen.`,
      [['Klaar', lijnKlaar], ['Laatste weg', laatsteWeg], ['Stoppen', () => zetTool('kijk')]]);
  }, m === 'trein' || m === 'metro' || m === 'tram' || m === 'sneltram' ? 30 : 350);
}
async function lijnKlaar() {
  voorbeeldNr++; if (kaart.map.getSource('lijn-voorbeeld')) kaart.bron('lijn-voorbeeld', { type: 'FeatureCollection', features: [] });
  if (!bouw || bouw.punten.length < 2) { melding('Kies minstens twee haltes.'); return; }
  const m = bouw.modus, p = bouw.punten;
  hint('Route zoeken…');
  const { route, waarschuwing } = await routeVoor(m, p);
  bouw.route = route;
  hint(null);
  const geklikt = p.map(h => ({ naam: h.naam, x: h.x, y: h.y, ...(m === 'vlucht' ? { baan: h.baan, verhard: h.verhard, landing: h.landing, heli: h.heli, veld: h.veld } : {}) }));
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
  const mix = d.modus === 'vlucht' ? null : (d.mix || []).filter(m => TYPE[m.id]);
  const typeId = mix ? (hoofdType({ mix }) || d.typeKeuze || typenVoor(d.modus).find(isRijdbaar)?.id) : $('nl-type').value;
  if (!typeId) { melding('Kies eerst materieel voor deze lijn (of koop het).'); return; }
  if (mix && !mix.length) mix.push({ id: typeId, n: 0, rol: 'hoofd' });
  const l = S.maakLijn(spel, { nr: $('nl-nr').value.trim() || String(spel.lijnen.length + 1), naam: $('nl-naam').value.trim(), modus: d.modus, typeId,
    haltes: d.haltes, route: d.route, interval: { vroeg: dal, ochtendspits: spits, dal, avondspits: spits, avond }, richting: d.rond ? 'rond' : d.richting || 'beide' });
  l.eigenSpoor = eigenSpoor;
  // laagfrequent of eenmalig: losse ritten in plaats van het uurpatroon
  if (d.freqSoort === 'laag' && d.laag) { l.dienst = 'laag'; l.ritten = [0, 1].flatMap(r => (S.ritRichtingen(l) > r ? d.laag[r] : []).map(x => ({ r, t: x.t, dagen: x.dagen }))); S.herbereken(l); }
  if (d.freqSoort === 'eenmalig' && d.een) { l.dienst = 'eenmalig'; l.ritten = [{ r: 0, t: d.een.t, dag: d.een.dag }, ...(d.een.terug != null && S.ritRichtingen(l) > 1 ? [{ r: 1, t: d.een.terug, dag: d.een.dag }] : [])]; S.herbereken(l); }
  if (d.terugVan) { l.paar = d.terugVan.id; d.terugVan.paar = l.id; S.herbereken(d.terugVan); S.herbereken(l); }
  const terugBouwen = d.richting === 'heen' && !d.terugVan && !d.rond && $('nl-terug')?.checked;
  if (mix) { l.mix = mix.map(m => ({ id: m.id, n: Math.max(0, Math.min(m.n || 0, vrijVoor(spel, m.id, l))), rol: m.rol || 'hoofd' })); S.herbereken(l); }
  if (mix && $('nl-koop').checked) { // wat nog ontbreekt: bijkopen van het hoofdmaterieel en op de lijn zetten
    const tekort = Math.max(0, l.nodig - l.mix.reduce((a, m) => a + m.n, 0)), h = l.mix.find(m => m.id === hoofdType(l)) || l.mix[0];
    if (tekort && h) {
      const per = nodigPer(h.id), kosten = Object.entries(per).reduce((a, [c, k]) => a + TYPE[c].prijs * k * tekort, 0);
      if (betaal(kosten, `${tekort} × ${TYPE[h.id].naam}`)) { for (const [c, k] of Object.entries(per)) { spel.voertuigen[c] = (spel.voertuigen[c] || 0) + k * tekort; (spel.aankopen ||= []).push({ id: c, n: k * tekort, dag: spel.dag, jaar: spel.jaar }); } h.n += tekort; }
    }
  } else if ($('nl-koop').checked) { // aanvullen per onderdeel (ook bij samengestelde treinen), rekening houdend met andere lijnen
    const tekort = Object.entries(nodigPer(l.typeId)).map(([c, k]) => [c, Math.max(0, spel.lijnen.filter(x => x.actief).reduce((s2, x) => s2 + (nodigLijn(x)[c] || 0), 0) - (spel.voertuigen[c] || 0))]).filter(x => x[1] > 0);
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
  hint(`Terugweg van lijn ${l.nr}: begint bij ${eind.naam}. Klik de haltes aan (ze komen vanzelf op een logische plek) en eindig bij ${l.haltes[0].naam}.`,
    [['Klaar', lijnKlaar], ['Laatste weg', laatsteWeg], ['Stoppen', () => zetTool('kijk')]]);
}
const SPOORSOORT = { trein: { naam: 'treinspoor', code: 0, km: [8e6, 15e6], extra: 6e6 }, metro: { naam: 'metrospoor', code: 2, km: [14e6, 25e6], extra: 10e6 }, tram: { naam: 'tramspoor', code: 3, km: [4e6, 7e6], extra: 3e6 }, trolley: { naam: 'trolleybus-bovenleiding', code: -1, km: [1.2e6, 1.8e6], extra: 0 } };
function spoorBegin(soort) {
  if (soort === 'trambaan') { tool = 'spoor'; bouw = { punten: [], soort, langsWeg: true }; hint('Klik begin en eind (en eventueel tussenpunten) van de trambaan: de rails komen in de weg te liggen. Bushaltes langs die weg worden tramhaltes (bussen blijven er stoppen).', [['Klaar', spoorKlaar], ['Laatste punt weg', () => { bouw.punten.pop(); }], ['Stoppen', () => zetTool('kijk')]]); return; }
  tool = 'spoor'; bouw = { punten: [], soort };
  hint(`Klik punten voor het nieuwe ${SPOORSOORT[soort].naam}: alleen begin en eind is genoeg (het spel legt dan zelf een tracé om de bebouwing heen). Begin en eind sluiten aan op bestaand ${soort === 'trolley' ? 'net' : 'spoor'}.`,
    [['Klaar', spoorKlaar], ['Laatste punt weg', () => { bouw.punten.pop(); }], ['Stoppen', () => zetTool('kijk')]]);
}
async function spoorKlaar() {
  if (!bouw || bouw.punten.length < 2) { melding('Klik minstens twee punten.'); return; }
  if (bouw.langsWeg) { // trambaan: over de weg (route van de wegenkaart), vereenvoudigd tot ankers om de ~120 m
    const r = await wegRoute(bouw.punten.map(p => [p.x, p.y])); const ank = [];
    for (let k = 0; k < r.pts.length; k += 2) { const q = [r.pts[k], r.pts[k + 1]], v = ank.at(-1); if (!v || Math.hypot(q[0] - v[0], q[1] - v[1]) > 120 || k === r.pts.length - 2) ank.push(q); }
    const d = { soort: 'tram', ankers: ank, handvat: [], sporen: 2, hergebruik: true, langsWeg: true };
    hint(null); openPaneel('nieuwSpoor', d); spoorVoorstel(d); return;
  }
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
// Het einde van een nieuw stuk spoor vloeiend op bestaand spoor laten aansluiten: een boog die raakt aan je nieuwe
// lijn (een eind terug) en aan het bestaande spoor (een eind verderop, in de richting waarin je erop rijdt), zodat er
// geen knik in zit. Zoals een wissel. pts = [[x, y], ...]; het laatste punt is het einde dat aansluit.
function aansluiten(pts, modus) {
  if (pts.length < 2) return pts;
  const E = pts[pts.length - 1], r = net.dichtsteTak(E[0], E[1], modus, spel.jaar, 250);
  if (!r || r.t.dienst || r.t.lengte < 40) return pts;
  const len = []; let tot = 0; for (let i = pts.length - 1; i >= 0; i--) { if (i < pts.length - 1) tot += Math.hypot(pts[i][0] - pts[i + 1][0], pts[i][1] - pts[i + 1][1]); len[i] = tot; } // afstand tot het einde
  const R = modus === 'tram' ? 60 : modus === 'metro' ? 150 : 300; // boogstraal-ish: hoe lang de overgang wordt
  const Lb = Math.max(Math.min(R * 0.6, tot * 0.45), Math.min(tot * 0.45, Math.max(r.d * 2.5, R * 0.4)));
  let iA = pts.length - 1; while (iA > 0 && len[iA] < Lb) iA--;
  const A = pts[iA], B = pts[Math.min(pts.length - 1, iA + 1)], P0 = pts[Math.max(0, iA - 1)];
  let hx = B[0] - P0[0], hy = B[1] - P0[1]; const hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;               // richting van je lijn bij A
  const raak = s0 => { const q = net.stuk(r.t, Math.max(0, s0 - 10), Math.min(r.t.lengte, s0 + 10)); const ux = q[q.length - 2] - q[0], uy = q[q.length - 1] - q[1], ul = Math.hypot(ux, uy) || 1; return [ux / ul, uy / ul]; };
  const [tx0, ty0] = raak(r.s), teken = (tx0 * (E[0] - A[0]) + ty0 * (E[1] - A[1])) >= 0 ? 1 : -1;           // rijrichting op het bestaande spoor
  const sJ = Math.max(2, Math.min(r.t.lengte - 2, r.s + teken * Math.max(30, Lb * 0.7)));
  const J = net.stuk(r.t, sJ, sJ).slice(0, 2), [tx, ty] = raak(sJ).map(v => v * teken);
  const k = Math.hypot(J[0] - A[0], J[1] - A[1]) * 0.42;
  const P1 = [A[0] + hx * k, A[1] + hy * k], P2 = [J[0] - tx * k, J[1] - ty * k];
  const n = Math.max(4, Math.ceil(Math.hypot(J[0] - A[0], J[1] - A[1]) / 10)), boog = [];
  for (let q = 1; q <= n; q++) { const t = q / n, u = 1 - t; boog.push([Math.round((u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * J[0]) * 10) / 10, Math.round((u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * J[1]) * 10) / 10]); }
  return [...pts.slice(0, iA + 1), ...boog];
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
  // uiteinden vloeiend op het bestaande spoor laten aansluiten (als een wissel: raakvlak, in de rijrichting van dat spoor)
  const nieuw = stukken.filter(x => len(x) > 60).map(x => d.soort === 'trolley' ? x : aansluiten(aansluiten(x, modus).reverse(), modus).reverse()), totaal = len(c), nieuwM = nieuw.reduce((a, x) => a + len(x), 0);
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
  // knop 'Sporen laden' van een provincie
  if (kaart.map.getLayer('deel-knop')) { const f = kaart.map.queryRenderedFeatures([px, py], { layers: ['deel-knop'] }); if (f.length) { laadDelen([f[0].properties.c]); return; } }
  let x = kaart.wx(px), y = kaart.wy(py);
  if (tool === 'lijn' && bouw?.modus) {
    let c = dichtsteKandidaat(bouw.modus, px, py);
    if (!c && ['bus', 'hov', 'belbus', 'veer', 'watertaxi'].includes(bouw.modus)) {
      const h = nieuweHalte(x, y, bouw.modus === 'hov' || bouw.modus === 'belbus' ? 'bus' : bouw.modus, true);
      if (h) { c = { naam: h.naam, x: h.x, y: h.y, eigen: h.id }; melding(`Nieuwe halte ${h.naam} (${S.euro(HALTEKOSTEN[h.modus])}).`); }
    }
    if (!c) { melding(bouw.modus === 'trein' ? 'Hier is geen station. Bouw er een met ▣ Station, of klik dichter bij een station.' : 'Hier is geen halte voor deze modus. Klik dichter bij een halte.'); return; }
    // terug bij de eerste halte: rondlijn gesloten
    if (bouw.punten.length >= 3 && bouw.punten[0].naam === c.naam && !bouw.terugVan) { bouw.punten.push(bouw.punten[0]); bouw.rond = true; melding('Rondlijn gesloten.'); lijnKlaar(); return; }
    // al in de lijn: nog eens klikken haalt hem eruit
    const al = bouw.punten.findIndex(q => q.naam === c.naam);
    if (al >= 0) { if (bouw.punten.length > 1 && !(al === 0 && bouw.terugVan)) { bouw.punten.splice(al, 1); melding(`${c.naam} uit de lijn gehaald.`); lijnVoorbeeld(); } return; }
    // op de logische plek: tussen twee stops waar de omweg het kleinst is, of als nieuw begin- of eindpunt
    const pos = invoegPlek(bouw.punten, c, !!bouw.terugVan);
    bouw.punten.splice(pos, 0, c); (bouw.erbij = bouw.erbij || []).push(c.naam);
    lijnVoorbeeld();
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
  if (tool === 'passeer') { verdubbelOntwerpen(x, y, 0, true); return; }
  if (tool === 'busstation') { // dichtstbijzijnde station of halte (binnen 400 m)
    let b = null, bd = 400; for (const st of D.stations) { const d = Math.hypot(st.x - x, st.y - y); if (d < bd) { bd = d; b = { naam: st.n, x: st.x, y: st.y }; } }
    for (const h of spel.haltes) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; b = { naam: h.naam, x: h.x, y: h.y }; } }
    if (!b) { melding('Klik dichter bij een station of halte.'); return; }
    zetTool('kijk'); openPaneel('busstation', { station: b.naam, x: b.x, y: b.y, n: 4, opstelling: 'naast' }); return; }
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
  if (tool === 'lijnhalte' && bouw?.lijnId) { const l = lijnVan(bouw.lijnId), c = l && dichtsteKandidaat(l.modus, px, py); if (!c) { melding('Hier is geen station of halte van deze soort.'); return; } conceptToevoegen(l, c); return; }
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
    if (!spel || vanSpeler(v.id) || spel.jaar !== jaar) continue;
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
  laadTimer = setTimeout(aiLaden, 400);
}
async function aiLaden() {
  {
    if (!spel || spel.jaar < 2020) return;
    const [x0, y0, x1, y1] = kaart.zicht(200);
    const lijst = D.vervoerders.filter(v => !vanSpeler(v.id) && v.bbox && !(v.bbox[0] > x1 || v.bbox[2] < x0 || v.bbox[1] > y1 || v.bbox[3] < y0));
    for (const v of lijst) {
      const treinen = (v.modi.trein || 0) > 0;
      if (!treinen && kaart.res > 60) continue;
      if (!AI.geladen.has(v.id)) { await laadVervoerderLijnen(v, spel.aiVerschuiving); nieuweStationsInAI(v.id); for (const a of AI.lijnen) if (a.vervoerder === v.id && spel.aiWacht?.[a.sleutel] && !a.dw) for (const [i, m] of Object.entries(spel.aiWacht[a.sleutel])) aiWachtToepassen(a, +i, m); }
    }
  }
}
// eenmalig rekenwerk aan het begin van een spel (met laadscherm): de routes van lijnen in beeld op het echte spoor leggen,
// zodat dat tijdens het spelen niet meer hoeft
async function voorrekenen(gebied = null) {
  laad.toon('Het spel wordt klaargezet'); laad.nieuweFase(); laad.zet(0.02, 'Dienstregelingen in de buurt laden');
  await aiLaden();
  const RAIL = ['trein', 'metro', 'sneltram', 'tram'], [x0, y0, x1, y1] = gebied ? [gebied[0] - 3000, gebied[1] - 3000, gebied[2] + 3000, gebied[3] + 3000] : kaart.zicht(3000);
  const inBuurt = l => l.bbox && !(l.bbox[0] > x1 || l.bbox[2] < x0 || l.bbox[1] > y1 || l.bbox[3] < y0);
  const nodig = l => RAIL.includes(l.modus) && l.route?.pts && ((l._spoor === undefined && !l.route.takken) || (!l.ai && l._banenVan !== l.route.pts && l.vertrek?.[1]?.length));
  // je eigen lijnen allemaal; van anderen alleen de 60 langste in de buurt (de rest gebeurt later vanzelf)
  const werk = [...spel.lijnen.filter(nodig), ...AI.lijnen.filter(l => inBuurt(l) && nodig(l)).sort((a, b) => lijnKm(b) - lijnKm(a)).slice(0, 60)];
  let t0 = performance.now();
  for (let i = 0; i < werk.length; i++) {
    const l = werk[i];
    if (l._spoor === undefined && !l.route.takken) { lijnOpSpoor(net, l, spel.jaar); if (l._spoor && l.echt && !l.ai) delete l.echt.km; }
    if (!l.ai && l._banenVan !== l.route.pts && l.vertrek?.[1]?.length) rijBanen(net, l, spel.jaar);
    if (performance.now() - t0 > 40) { laad.zet(0.05 + 0.95 * (i + 1) / werk.length, `Routes op het spoor leggen (${i + 1} van ${werk.length})`); await new Promise(r => setTimeout(r, 0)); t0 = performance.now(); }
  }
  laad.zet(1, 'Klaar'); laad.verberg();
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
    const { cum, km, t, tr, vertrek, _vangst, _spoor, _altD, _typ, _banen, _banenVan, _tunnel, _tunnelVan, _trolley, _ontwerp, _sam, _eff, _halteTijd, _vorigeTr, trMin, _vraag, _vraagDag, _omloopN, _concept, bbox, nodig, duur, lengteKm, stat, bezetting, ...rest } = l;
    for (const k of ['_lk', '_st', '_stVan', '_stopVan', '_ritWacht', '_kruis', '_blok', '_blokVan', '_blokJaar', '_blokVersie', '_vf']) delete rest[k]; // afgeleid, wordt opnieuw berekend
    if (l.bron && !l.aangepast) { delete rest.route; delete rest.echt; }
    else {
      if (rest.echt) rest.echt = { ...rest.echt, v: undefined };
      if (rest.route) rest.route = { d: pakPts(rest.route.pts), lengte: Math.round(rest.route.lengte), minSporen: l.route.takken ? net.minSporen(l.route.takken) : undefined, weg: rest.route.weg, rechtLijnig: rest.route.rechtLijnig, fasen: rest.route.fasen };
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
    catch (e) { if (hand) melding('Online opslaan mislukte: ' + (e.code === 'permission-denied' ? 'de database-regels voor het spel staan nog niet in Firebase.' : e.message)); }
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
    if (l.route?.d) l.route = { pts: pakUit(l.route.d), lengte: l.route.lengte, minSporen: l.route.minSporen, weg: l.route.weg, rechtLijnig: l.route.rechtLijnig, fasen: l.route.fasen };
    // vluchten van vóór de banen: opnieuw over de echte banen (taxiën, opstijgen, landen)
    if (l.modus === 'vlucht' && l.route && !l.route.fasen) l.route = vluchtRoute(l.haltes.map(h => ({ x: h.x, y: h.y, veld: D.vliegvelden.find(v => v.n === (h.veld || h.naam)) })));
    if (l.bron && !l.route) {
      const v = D.vervoerders.find(x => x.id === l.bron.vervoerder);
      if (v) { const ai = await laadVervoerderLijnen(v); const a = ai.find(x => x.lijnId === l.bron.lijnId && x.sleutel.endsWith(':0')); if (a) vulVanAI(l, a, ai); }
    }
    if (l.route) S.herbereken(l);
  }
  spel.lijnen = spel.lijnen.filter(l => l.route);
  if (spel.vervoerder) AI.lijnen = AI.lijnen.filter(x => !vanSpeler(x.vervoerder));
  if (D.spoorIndex) { // de provincies die in dit spel geladen waren (oude spellen: Nederland met de grensprovincies)
    if ($('start').open) $('start').close(); laad.toon('Spoornet laden'); laad.nieuweFase();
    const bb = spel.lijnen.reduce((a, l) => l.route?.pts ? (() => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const q = l.route.pts; for (let i = 0; i < q.length; i += 2) { x0 = Math.min(x0, q[i]); x1 = Math.max(x1, q[i]); y0 = Math.min(y0, q[i + 1]); y1 = Math.max(y1, q[i + 1]); } return a ? [Math.min(a[0], x0), Math.min(a[1], y0), Math.max(a[2], x1), Math.max(a[3], y1)] : [x0, y0, x1, y1]; })() : a, null);
    await laadDelen(spel.delen?.length ? spel.delen : startDelen('NL', true, bb), { groot: true });
  }
  for (const s of spel.spoor) if (s.klaar) { net.voegEigenSpoorToe(s.punten, s.eigenaar, s.sporen + (s.extraSporen || 0), spel.jaar, s.soort || 0, s.dienst || 0); const vt = s.verdubbeltSleutel ? net.takMetSleutel(s.verdubbeltSleutel) : net.takken[s.verdubbelt]; if (s.verdubbelt != null && vt) { vt.sporen = s.nieuwSporen || 2; s.verdubbelt = vt.i; } }
  for (const b of spel.bovenleiding || []) if (b.klaar) bovenleidingToevoegen(b.punten);
  leegToepassen();
  begin();
  // het gebied van je eigen lijnen (of wat je nu ziet)
  const bb = spel.lijnen.reduce((a, l) => l.bbox ? (a ? [Math.min(a[0], l.bbox[0]), Math.min(a[1], l.bbox[1]), Math.max(a[2], l.bbox[2]), Math.max(a[3], l.bbox[3])] : [...l.bbox]) : a, null);
  voorrekenen(bb);
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
    if (bron === 'gtfs') { const b = bedrijven().find(x => x.id === id); const leden = b?.leden.filter(m => !startUit.has(m.id)) || [];
      if (b && !leden.length) { melding('Kies minstens één onderdeel van het bedrijf.'); return; }
      if (b) vervoerder = { ...b, leden, id: leden.length === 1 ? leden[0].id : b.id, naam: leden.length === 1 && b.leden.length > 1 ? leden[0].naam : b.naam }; }
    if (bron === 'hist') hist = vervoerdersIn(jaar).find(v => v.id === id);
    if (!vervoerder && !hist) { melding('Kies eerst een vervoerder.'); return; }
  }
  $('s-start').disabled = true; $('s-start').textContent = 'Bezig…';
  // spoornet van het beginland (en de grensprovincies) laden, met laadscherm
  if (D.spoorIndex) {
    $('start').close(); laad.toon('Spoornet laden'); laad.nieuweFase();
    await laadDelen(startDelen(soort === 'leeg' ? leegKeuze().land : $('s-land')?.value || 'NL', !!$('s-grens')?.checked, vervoerder?.bbox || null), { groot: true });
  }
  zetJaar(jaar); registreerSeries([]); zetKlassePrijzen(null);
  spel = S.nieuwSpel({ naam: vervoerder?.naam || hist?.naam || naam, kleur: vervoerder ? vervoerderKleur(vervoerder.naam) : hist?.kleur || $('s-kleur').value, jaar, start: soort, vervoerder: vervoerder ? { id: vervoerder.id, naam: vervoerder.naam, leden: vervoerder.leden.map(v => v.id) } : hist ? { id: hist.id, naam: hist.naam, hist: true } : null, kapitaal: +($('s-kapitaal')?.value || 200e6) });
  // lege regio: de lijnen die in het gekozen gebied stoppen zijn opgeheven (behalve de soorten die blijven rijden)
  if (soort === 'leeg') { spel.leeg = leegKeuze(); leegToepassen(); melding(`${spel.leeg.naam}: het openbaar vervoer is opgeheven${spel.leeg.behoud.length ? ' (behalve ' + spel.leeg.behoud.join(', ') + ')' : ''}. Aan jou om het aan te leggen.`, 9000); }
  else leegToepassen();
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
    // alle onderdelen van het bedrijf (bus, trein, merken) samen
    const lid = new Set(vervoerder.leden.map(v => v.id)), lijnen = [];
    AI.lijnen = AI.lijnen.filter(a => !lid.has(a.vervoerder));
    for (const v of vervoerder.leden) { AI.geladen.delete(v.id); lijnen.push(...await laadVervoerderLijnen(v)); }
    AI.lijnen = AI.lijnen.filter(a => !lid.has(a.vervoerder));
    const gedaan = new Set();
    for (const a of lijnen) {
      if (gedaan.has(a.vervoerder + ':' + a.lijnId) || !a.sleutel.endsWith(':0')) continue;
      gedaan.add(a.vervoerder + ':' + a.lijnId);
      const modus = MODI[a.modus] ? a.modus : 'bus';
      const l = { haltes: [], route: null };
      vulVanAI(l, a, lijnen.filter(x => x.vervoerder === a.vervoerder));
      const lijn = S.maakLijn(spel, { nr: a.nr, naam: a.naam, modus, typeId: typeVoor({ ...a, typeId: null, _typ: null }, spel.jaar, standaardType) || S.standaardTypeVoor(spel, modus), haltes: l.haltes, route: l.route, concessie: true });
      if (modus === 'trein') { lijn.spitsDubbel = true; S.herbereken(lijn); } // zoals in het echt: in de spits gekoppeld
      lijn.echt = l.echt; lijn.bron = { vervoerder: a.vervoerder, lijnId: a.lijnId }; lijn.paden = 99; S.herbereken(lijn);
    }
    for (const l of spel.lijnen) spel.voertuigen[l.typeId] = (spel.voertuigen[l.typeId] || 0) + Math.ceil(l.nodig * 1.08);
    spel.geld = +($('s-kapitaal')?.value || 200e6); // gekozen startkapitaal
    melding(`Je neemt ${spel.lijnen.length} lijnen van ${vervoerder.naam} over, met ${Object.values(spel.voertuigen).reduce((s, n) => s + n, 0)} voertuigen.`, 7000);
  }
  begin();
  const bb = vervoerder?.bbox || (hist && gebiedVan(hist)) || (spel.leeg && leegBbox(spel.leeg));
  if (bb) { const b = bb; kaart.vliegNaar((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(b[2] - b[0], b[3] - b[1]) / Math.min(kaart.W, kaart.H) * 1.1); }
  else kaart.vliegNaar(140700, 470500, 18); // 't Gooi
  $('s-start').disabled = false; $('s-start').textContent = 'Spel starten';
  voorrekenen(bb || [130000, 460000, 152000, 482000]);
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
  if (spel.groot === undefined) spel.groot = !!spel.vervoerder && spel.lijnen.length > 40; // reus als NS: minder (maar grotere) opdrachten
  AI.opgeheven = new Set(spel.opgeheven || []);
  marktStart(spel);
  if (!spel.vrachtGestart) { spel.vrachtGestart = true; vrachtAanvullen(3); } else vrachtAanvullen(0);
  aanbiedingenAanvullen(); aanbiedingenToetsen();
  for (const l of spel.lijnen) if (l.bijzonder) bijzonderBijwerken(l); // vertrektijden worden niet opgeslagen
  netwerkLagen(); hud(); laadAIinBeeld();
  if (spel.jaar < 2020) historischeAI();
  if (!spel.lijnen.length) setTimeout(() => melding('Tip: kies ＋ Lijn, dan Bus, en klik een paar plekken in een stad aan. Haltes komen er vanzelf bij.', 8000), 1200);
}

// Bedrijven: merken en dochters van één concern zijn samen één bedrijf (Arriva-bus, Arriva-trein, Bravo (Arriva) ...)
const SAMENWERKING = [['Blauwnet', /blauwnet/i], ['R-net', /r-net/i], ['RRReis', /rrreis/i]];
const CONCERNS = [['Arriva', /arriva/i], ['Keolis', /keolis|^rrreis$|allgo/i], ['Transdev', /connexxion|transdev|hermes/i], ['NS', /^ns\b|^ns international|r-net ns/i], ['Qbuzz', /qbuzz|^u-ov$/i]];
function bedrijven() {
  const uit = new Map();
  for (const v of D.vervoerders) {
    const c = CONCERNS.find(([, re]) => re.test(v.naam) || re.test(v.id));
    const id = c ? 'concern:' + c[0] : v.id, naam = c ? c[0] : v.naam;
    if (!uit.has(id)) uit.set(id, { id, naam, leden: [], modi: {}, lijnen: 0, bbox: null });
    const b = uit.get(id); b.leden.push(v); b.lijnen += v.lijnen || 0;
    for (const [m, n] of Object.entries(v.modi || {})) b.modi[m] = (b.modi[m] || 0) + n;
    if (v.bbox) b.bbox = b.bbox ? [Math.min(b.bbox[0], v.bbox[0]), Math.min(b.bbox[1], v.bbox[1]), Math.max(b.bbox[2], v.bbox[2]), Math.max(b.bbox[3], v.bbox[3])] : [...v.bbox];
  }
  // samenwerkingen (merk van meerdere bedrijven): ook als eigen bedrijf te kiezen, met dezelfde onderdelen
  for (const [naam, re] of SAMENWERKING) {
    const leden = D.vervoerders.filter(v => re.test(v.naam) || re.test(v.id)); if (leden.length < 2) continue;
    const b = { id: 'samen:' + naam, naam, leden, modi: {}, lijnen: 0, bbox: null, samenwerking: true };
    for (const v of leden) { b.lijnen += v.lijnen || 0; for (const [m, n] of Object.entries(v.modi || {})) b.modi[m] = (b.modi[m] || 0) + n;
      if (v.bbox) b.bbox = b.bbox ? [Math.min(b.bbox[0], v.bbox[0]), Math.min(b.bbox[1], v.bbox[1]), Math.max(b.bbox[2], v.bbox[2]), Math.max(b.bbox[3], v.bbox[3])] : [...v.bbox]; }
    uit.set(b.id, b);
  }
  return [...uit.values()].sort((a, b) => b.lijnen - a.lijnen);
}
// ---------------------------------------------------------------- lege regio
// Een gebied (land, provincie, regio of gemeente) zonder openbaar vervoer: lijnen die er stoppen zijn opgeheven,
// behalve de soorten die je laat rijden. De rest van de wereld rijdt gewoon.
const LEEG_SOORTEN = [['trein', 'Trein'], ['metro', 'Metro'], ['tram', 'Tram en sneltram'], ['bus', 'Bus'], ['veer', 'Veer'], ['vlucht', 'Vliegtuig']];
const leegGroep = m => m === 'sneltram' ? 'tram' : ['hov', 'belbus'].includes(m) ? 'bus' : m === 'watertaxi' ? 'veer' : m;
let leegBehoud = new Set();
function leegKeuzeVullen(wat = null) {
  const G = D.grenzen; if (!G) return;
  const land = $('s-leeg-land'), pr = $('s-leeg-prov'), rg = $('s-leeg-regio'), gm = $('s-leeg-gem');
  const landen = Object.entries(G.landen || { NL: 'Nederland' }).filter(([c]) => (G.p || []).some(p => (G.land?.[p[0]] || 'NL') === c));
  if (!wat) { land.innerHTML = landen.map(([c, n]) => `<option value="${c}">${esc(n)}</option>`).join(''); land.value = $('s-land')?.value || 'NL'; }
  const L = land.value;
  if (!wat || wat === 'land') pr.innerHTML = `<option value="">— heel ${esc(G.landen?.[L] || L)} —</option>` + G.p.map((p, i) => [p, i]).filter(([p]) => (G.land?.[p[0]] || 'NL') === L).sort((a, b) => a[0][1].localeCompare(b[0][1])).map(([p, i]) => `<option value="${i}">${esc(p[1])}</option>`).join('');
  const pi = pr.value === '' ? -1 : +pr.value;
  if (!wat || wat === 'land' || wat === 'prov') { const rs = (G.r || []).map((r, i) => [r, i]).filter(([r]) => pi >= 0 && r[2] === pi);
    rg.innerHTML = `<option value="">— ${pi >= 0 ? 'hele provincie' : 'kies eerst een provincie'} —</option>` + rs.map(([r, i]) => `<option value="${i}">${esc(r[1])}</option>`).join(''); rg.disabled = !rs.length; }
  const ri = rg.value === '' ? -1 : +rg.value;
  if (wat !== 'gem') { const gs = (G.g || []).map((g, i) => [g, i]).filter(([g, i]) => pi >= 0 && g[2] === pi && (ri < 0 || G.gr?.[i] === ri)).sort((a, b) => a[0][1].localeCompare(b[0][1]));
    gm.innerHTML = `<option value="">— ${ri >= 0 ? 'hele regio' : pi >= 0 ? 'hele provincie' : 'kies eerst een provincie'} —</option>` + gs.map(([g, i]) => `<option value="${i}">${esc(g[1])}</option>`).join(''); gm.disabled = !gs.length; }
  land.onchange = () => leegKeuzeVullen('land'); pr.onchange = () => leegKeuzeVullen('prov'); rg.onchange = () => leegKeuzeVullen('regio'); gm.onchange = () => leegKeuzeVullen('gem');
  if (!wat) $('s-leeg-behoud').innerHTML = LEEG_SOORTEN.map(([k, n]) => `<label class="rij klein" style="margin-right:12px"><input type="checkbox" data-behoud="${k}" ${leegBehoud.has(k) ? 'checked' : ''}> ${n}</label>`).join('');
  $('s-leeg-behoud').querySelectorAll('[data-behoud]').forEach(c => c.onchange = () => { c.checked ? leegBehoud.add(c.dataset.behoud) : leegBehoud.delete(c.dataset.behoud); leegUitleg(); });
  leegUitleg();
}
function leegKeuze() {
  const G = D.grenzen, L = $('s-leeg-land').value, pi = $('s-leeg-prov').value, ri = $('s-leeg-regio').value, gi = $('s-leeg-gem').value;
  if (gi !== '') return { niveau: 'g', i: +gi, naam: G.g[+gi][1], land: L, behoud: [...leegBehoud] };
  if (ri !== '') return { niveau: 'r', i: +ri, naam: G.r[+ri][1], land: L, behoud: [...leegBehoud] };
  if (pi !== '') return { niveau: 'p', i: +pi, naam: G.p[+pi][1], land: L, behoud: [...leegBehoud] };
  return { niveau: 'land', land: L, naam: G.landen?.[L] || L, behoud: [...leegBehoud] };
}
function leegUitleg() { const k = leegKeuze(); $('s-leeg-uitleg').textContent = `${k.naam}: ${k.behoud.length ? `alleen ${k.behoud.map(b => LEEG_SOORTEN.find(x => x[0] === b)[1].toLowerCase()).join(', ')} blijft rijden` : 'al het openbaar vervoer is weg'}; de rest van de wereld rijdt gewoon.`; }
// test of een punt in het gekozen gebied ligt (polygonen uit grenzen.json)
function leegVlakken(k) {
  const G = D.grenzen; if (!G || !k) return [];
  const rij = k.niveau === 'g' ? [G.g[k.i].slice(3)] : k.niveau === 'r' ? [G.r[k.i].slice(3)] : k.niveau === 'p' ? [G.p[k.i].slice(2)] : G.p.filter(p => (G.land?.[p[0]] || 'NL') === k.land).map(p => p.slice(2));
  return rij.map(rr => gebiedVlak('start', k.naam, rr));
}
function leegGebiedTest(k) {
  const G = D.grenzen; if (!G || !k) return () => false;
  const vlakken = leegVlakken(k);
  return (x, y) => vlakken.some(v => gebiedBinnen(v, x, y));
}
function leegBbox(k) {
  const G = D.grenzen; if (!G) return null;
  const rij = k.niveau === 'g' ? [G.g[k.i].slice(3)] : k.niveau === 'r' ? [G.r[k.i].slice(3)] : k.niveau === 'p' ? [G.p[k.i].slice(2)] : G.p.filter(p => (G.land?.[p[0]] || 'NL') === k.land).map(p => p.slice(2));
  const b = rij.map(rr => gebiedVlak('x', 'x', rr).bbox);
  return b.length ? [Math.min(...b.map(x => x[0])), Math.min(...b.map(x => x[1])), Math.max(...b.map(x => x[2])), Math.max(...b.map(x => x[3]))] : null;
}
// AI-filter aanzetten voor een lege regio (bij de start en na het laden van een spel)
function leegToepassen() {
  if (!spel?.leeg) { if (AI.filter) { AI.filter = null; AI.lijnen = []; AI.geladen.clear(); } return; } // vorige lege regio: alles opnieuw laden
  const binnen = leegGebiedTest(spel.leeg), behoud = new Set(spel.leeg.behoud || []);
  AI.filter = l => behoud.has(leegGroep(l.modus)) || !l.haltes.some(h => binnen(h.x, h.y));
  AI.lijnen = AI.lijnen.filter(AI.filter);
}
// is deze vervoerder (uit de dienstregeling) van het bedrijf van de speler?
const vanSpeler = id => !!spel?.vervoerder && (spel.vervoerder.id === id || (spel.vervoerder.leden || []).includes(id));
let startModi = new Set(), startUit = new Set(); // startUit: onderdelen van een bedrijf die je niet overneemt
function vulVervoerders(jaar) {
  const modern = jaar >= 2020 && D.vervoerders.length;
  const MODNAAM = { trein: 'trein', bus: 'bus', tram: 'tram', metro: 'metro', veer: 'veer', belbus: 'belbus', vlucht: 'vliegtuig', sneltram: 'sneltram', hov: 'snelbus' };
  const lijst = modern
    ? bedrijven().map(b => ({ waarde: 'gtfs:' + b.id, naam: b.naam, modi: Object.keys(b.modi), kleur: vervoerderKleur(b.naam), leden: b.leden, info: `${b.samenwerking ? 'samenwerking · ' : ''}${b.lijnen} lijnen · ${Object.entries(b.modi).map(([m, n]) => `${n} ${MODNAAM[m] || m}`).join(', ')}` }))
    : vervoerdersIn(jaar).map(v => ({ waarde: 'hist:' + v.id, naam: v.naam, modi: v.modi, kleur: v.kleur || vervoerderKleur(v.naam), info: `${v.van}–${v.tot > 2050 ? 'nu' : v.tot} · ${v.modi.map(m => MODNAAM[m] || m).join(', ')}` }));
  // filterknoppen per vervoerwijze en zoeken op naam
  const alleModi = [...new Set(lijst.flatMap(v => v.modi))].filter(m => MODNAAM[m]);
  $('s-modi').innerHTML = alleModi.map(m => `<button type="button" class="knop klein ${startModi.has(m) ? 'hoofd' : ''}" data-m="${m}">${MODNAAM[m]}</button>`).join('');
  $('s-modi').querySelectorAll('[data-m]').forEach(b => b.onclick = () => { startModi.has(b.dataset.m) ? startModi.delete(b.dataset.m) : startModi.add(b.dataset.m); vulVervoerders(jaar); });
  const zoek = ($('s-zoek')?.value || '').trim().toLowerCase();
  let gekozen = document.querySelector('input[name="vervoerder"]:checked')?.value;
  const zicht = lijst.filter(v => (!zoek || (v.naam + ' ' + v.info).toLowerCase().includes(zoek)) && [...startModi].every(m => v.modi.includes(m)));
  if (!zicht.some(v => v.waarde === gekozen)) gekozen = null; // gekozen bedrijf valt buiten het filter: het eerste zichtbare
  $('s-vervoerders').innerHTML = zicht.length ? zicht.map((v, i) => `<label><input type="radio" name="vervoerder" value="${esc(v.waarde)}" ${(gekozen ? v.waarde === gekozen : !i) ? 'checked' : ''}> <span class="kleurstip" style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${v.kleur};margin-right:4px;vertical-align:-1px"></span>${esc(v.naam)}<span>${esc(v.info)}</span>${v.leden?.length > 1 ? `<span class="leden">${v.leden.map(m => `<label class="klein" style="display:inline-flex;gap:3px;margin-right:10px"><input type="checkbox" data-lid="${esc(m.id)}" ${startUit.has(m.id) ? '' : 'checked'}> ${esc(m.naam)} <small>(${Object.entries(m.modi || {}).map(([mm, n]) => `${n} ${MODNAAM[mm] || mm}`).join(', ')})</small></label>`).join('')}</span>` : ''}</label>`).join('')
    + (modern ? '' : '<p class="klein" style="padding:6px 10px">Van dit jaar is geen echte dienstregeling bewaard. Het spel bouwt een lijnennet dat past bij het spoor, de plaatsen en het materieel van toen.</p>')
    : lijst.length ? '<p class="klein" style="padding:8px 10px">Geen bedrijf gevonden met deze zoekterm of vervoerwijzen.</p>' : '<p class="klein" style="padding:8px 10px">De dienstregeling wordt nog verwerkt. Probeer het later of begin met een eigen bedrijf.</p>';
  $('s-vervoerders').querySelectorAll('[data-lid]').forEach(c => c.onchange = () => { c.checked ? startUit.delete(c.dataset.lid) : startUit.add(c.dataset.lid); });
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
  const kiesSoort = v => { document.querySelectorAll('#s-soort button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('s-bestaand').hidden = v !== 'bestaand'; $('s-eigen').hidden = v === 'bestaand'; $('s-leeg').hidden = v !== 'leeg'; if (v === 'leeg') leegKeuzeVullen(); };
  $('s-zoek').oninput = () => vulVervoerders(+jaar.value);
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
  kaart.lagenBoven.push((ctx, k) => { try { tekenBoven(ctx, k); } catch (e) { lusFout('voertuigen tekenen', e); } });
  kaart.bijKlik = klik;
  kaart.map.on('dragstart', () => { if (volg) { volg = null; melding('Volgen gestopt.'); if (paneelSoort === 'rit') ververs(); } });
  kaart.bijBeweeg = (px, py) => { if (bouw?.punten?.length) bouw.muis = [px, py]; snapTonen(px, py); };
  const oudVuil = Object.getOwnPropertyDescriptor(Kaart.prototype, 'vuil');
  void oudVuil;
  let vorigeZicht = '';
  setInterval(spoorPlannen, 2500);
  setInterval(kandidatenTonen, 400);
  // bouwprojecten: de voortgangsbalken lopen zichtbaar vol zolang je het paneel open hebt
  setInterval(() => { if (spel && paneelSoort === 'station' && !paneelData?.verbouw && tijdLoopt) ververs(); }, 3000); // vertrekbord bijwerken
  setInterval(() => { if (spel && paneelSoort === 'bouw' && tijdLoopt && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) ververs(); }, 1000);
  setInterval(() => { const z = kaart.zicht().map(v => Math.round(v / 2000)).join(',') + kaart.res.toFixed(0); if (z !== vorigeZicht) { vorigeZicht = z; laadAIinBeeld(); } }, 700);
  $('bron').textContent = '';
  document.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => zetTool(b.dataset.tool)));
  document.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => categorie(b.dataset.cat)));
  document.querySelectorAll('[data-paneel]').forEach(b => b.addEventListener('click', () => paneelSoort === b.dataset.paneel ? sluitPaneel() : openPaneel(b.dataset.paneel)));
  $('paneel-sluit').onclick = sluitPaneel;
  $('b-legenda').onclick = () => legendaKaart();
  $('legenda').addEventListener('click', (e) => { if (e.target.closest('[data-legenda-dicht]')) legendaKaart(false); });
  try { if (localStorage.getItem('ov_legenda') === '1') legendaKaart(true); } catch {}
  document.querySelectorAll('.snelheid button').forEach(b => b.addEventListener('click', () => zetSnelheid(+b.dataset.s)));
  addEventListener('keydown', e => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); zetTijd(!tijdLoopt); }
    if (e.key === 'Escape') { zetTool('kijk'); sluitPaneel(); }
  });
  $('b-account').onclick = () => toonStart();
  $('b-instellingen').onclick = () => paneelSoort === 'instellingen' ? sluitPaneel() : openPaneel('instellingen');
  zetLiedje(INST.liedje || 0);
  $('b-muziek').onclick = e => { const b = e.currentTarget; if (muziekSpeelt()) muziekUit(); else muziekAan();
    const aan = muziekSpeelt(); b.setAttribute('aria-pressed', aan); b.title = aan ? 'Muziek uitzetten' : 'Muziek aanzetten'; };
  $('start').addEventListener('cancel', e => { if (!spel) e.preventDefault(); });
  addEventListener('visibilitychange', () => { if (document.hidden) bewaar(); });
  addEventListener('pagehide', () => bewaar());
  // automatisch opslaan: elke minuut (in deze browser; online hooguit elke minuut, zie bewaar)
  setInterval(() => { if (spel && !document.hidden) bewaar(); }, 60000);
  $('b-opslaan').onclick = () => { if (!spel) { melding('Er is nog geen spel om op te slaan.'); return; } bewaar(true); };
  zetSnelheid(5);
  $('b-tijdknop').onclick = () => zetTijd(!tijdLoopt);
  Cloud.bijInlog(u => { $('b-account').textContent = u ? (u.displayName || u.email || 'Account').split(' ')[0] : 'Inloggen'; if ($('start').open) toonAccount(); });
  Cloud.start().catch(() => {});
  laad.toon('Spitsuur wordt geladen');
  laadData().then(() => { laad.zet(1, 'Klaar'); laad.verberg(); toonStart(); });
  requestAnimationFrame(lus);
}
// Dienstregeling instellen. Hoogfrequent: per deel van de dag een interval dat in een uurpatroon past, en de minuut
// over het uur waarop de cyclus begint (heen en terug). Laagfrequent: losse ritten met eigen tijd en eigen dagen.
const DAG_KORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];
const freqNaam = f => !f || f >= 999 ? 'geen' : f >= 60 ? `elke ${f / 60 === Math.round(f / 60) ? f / 60 + ' uur' : String(f / 60).replace('.', ',') + ' uur'}` : `elke ${String(f).replace('.', ',')} min`;
function dienstBlok(l) {
  if (l.dienst === 'eenmalig') { const r = l.ritten || []; return `<p>Eenmalige rit op <b>${S.datumTekst(r[0]?.dag ?? spel.dag)}</b>: ${r.map(x => `${x.r ? 'terug' : 'heen'} ${S.klok(x.t)}`).join(', ')}. Daarna vervalt de lijn.</p>`; }
  const laag = l.dienst === 'laag', twee = S.ritRichtingen(l) > 1;
  const kop = `<div class="rij"><label><input type="radio" name="dienst-${l.id}" data-wijzig="dienst" data-id="${l.id}" value="hoog" ${laag ? '' : 'checked'}> Vast patroon per uur</label>
    <label><input type="radio" name="dienst-${l.id}" data-wijzig="dienst" data-id="${l.id}" value="laag" ${laag ? 'checked' : ''}> Losse ritten (laagfrequent)</label></div>
    ${l.echt && !l.aangepast ? '<p class="klein">Rijdt nu volgens de echte dienstregeling. Pas je iets aan, dan maakt het spel een eigen dienstregeling.</p>' : ''}`;
  if (!laag) {
    const sel = (keys, waarde) => `<select data-wijzig="freq" data-id="${l.id}" data-p="${keys.join(',')}">${[0, ...S.FREQS].map(f => `<option value="${f}" ${(+waarde || 0) === f || (!f && (!waarde || waarde >= 999)) ? 'selected' : ''}>${freqNaam(f)}</option>`).join('')}</select>`;
    const iv = l.interval, anders = (iv.vroeg !== iv.dal || iv.avond !== iv.dal) ? ` <span class="klein">(vroeg ${freqNaam(iv.vroeg)}, avond ${freqNaam(iv.avond)})</span>` : '';
    return kop + `<div class="raster2"><label class="veld">Spits (werkdagen 7–9 en 16–18:30)${sel(['ochtendspits', 'avondspits'], iv.ochtendspits)}</label>
      <label class="veld">Overdag en 's avonds${anders}${sel(['vroeg', 'dal', 'avond'], iv.dal)}</label>
      <label class="veld">Nacht (na 0:30)${sel(['nacht'], iv.nacht)}</label></div>
      <details class="klein"><summary>Per periode apart instellen</summary><div class="raster2">${S.PERIODES.map(p => `<label class="veld">${p.naam}${sel([p.id], iv[p.id])}</label>`).join('')}</div></details>
      <div class="raster2"><label class="veld">Heen: minuut over het uur<input type="number" min="0" max="59" value="${S.cyclusMinuut(l, 0)}" data-wijzig="minuut" data-id="${l.id}" data-r="0"></label>
      ${twee ? `<label class="veld">Terug: minuut over het uur<input type="number" min="0" max="59" value="${S.cyclusMinuut(l, 1)}" data-wijzig="minuut" data-id="${l.id}" data-r="1"></label>` : ''}
      <label class="veld">Eerste rit<input type="time" value="${S.klok(l.eerste)}" data-wijzig="eerste" data-id="${l.id}"></label>
      <label class="veld">Laatste rit<input type="time" value="${S.klok(l.laatste)}" data-wijzig="laatste" data-id="${l.id}"></label></div>
      <p class="klein">Vertrek ${esc(l.haltes[0].naam)}: ${l.vertrek[0].filter(v => v >= 12 * 60 && v < 14 * 60).map(S.klok).join(', ') || '—'} (12–14 uur). Het patroon komt elk uur terug${[90, 120].some(f => Object.values(iv).includes(f)) ? ' (bij 90 en 120 min elke 3 of 2 uur)' : ''}.</p>`;
  }
  // laagfrequent: aantal ritten per dag per richting, per rit de tijd en de dagen
  const rr = r => (l.ritten || []).map((x, k) => ({ ...x, k })).filter(x => x.r === r).sort((a, b) => a.t - b.t);
  const richting = r => { const lijst = rr(r), van = r ? l.haltes[l.haltes.length - 1].naam : l.haltes[0].naam;
    return `<h4>${r ? 'Terug' : 'Heen'} vanaf ${esc(van)}</h4>
      <label class="veld">Ritten per dag<input type="number" min="0" max="40" value="${lijst.length}" data-wijzig="laag-n" data-id="${l.id}" data-r="${r}" style="width:5em"></label>
      <table class="tabel klein">${lijst.map(x => `<tr><td><input type="time" value="${S.klok(x.t)}" data-wijzig="laag-tijd" data-id="${l.id}" data-k="${x.k}"></td>
        <td>${DAG_KORT.map((d, i) => `<button class="knop klein ${!x.dagen || x.dagen.includes(i) ? 'hoofd' : ''}" data-actie="laag-dag" data-id="${l.id}" data-k="${x.k}" data-d="${i}" title="rijdt op ${S.WEEKDAG[i]}">${d}</button>`).join('')}</td>
        <td class="klein">${!x.dagen || x.dagen.length === 7 ? 'elke dag' : x.dagen.length ? x.dagen.length + '× per week' : '<b style="color:var(--rood)">rijdt nooit</b>'}</td></tr>`).join('')}</table>`; };
  return kop + `<p class="klein">Kies per richting hoeveel ritten per dag, hun vertrektijd en op welke dagen ze rijden (bv. alleen zaterdag en zondag, of één keer per week). Handig voor een museumlijn, vluchten en internationale treinen en bussen.</p>
    ${richting(0)}${twee ? richting(1) : ''}`;
}
// welk materieel rijdt er op een lijn (bij een mix alle typen)
const lijnModellen = l => { const ids = (l.mix || []).filter(m => TYPE[m.id]).map(m => m.id); const lijst = ids.length ? ids : [l.typeId]; return [...new Set(lijst.filter(id => TYPE[id]).map(id => vlootNaam(id)))].join(' + ') || 'geen materieel'; };
// Stations die je aandoet (trein-, metro-, tram- en busstations; losse haltes zijn ondergeschikt), met wachtende reizigers
function mijnStations() {
  const uit = new Map();
  for (const l of spel.lijnen.filter(l => l.actief !== false)) for (const h of l.haltes || []) {
    let b = null, bd = 300; for (const st of D.stations) { if (!['trein', 'metro', 'sneltram', 'tram', 'busstation'].includes(st.s)) continue; const d = Math.abs(st.x - h.x) + Math.abs(st.y - h.y); if (d < bd * 1.5) { const e = Math.hypot(st.x - h.x, st.y - h.y); if (e < bd) { bd = e; b = st; } } }
    if (!b) continue;
    const k = b.n + '@' + Math.round(b.x / 100); if (!uit.has(k)) uit.set(k, { naam: b.n, x: b.x, y: b.y, p: b.p, s: b.s, lijnen: new Set() });
    uit.get(k).lijnen.add(l);
  }
  return [...uit.values()];
}
function wachtendBij(st, l) { // reizigers die bij de eerstvolgende vertrekken van lijn l (beide richtingen) bij dit station instappen
  let som = 0; const nu = spel.tijd, bij = h => Math.hypot(h.x - st.x, h.y - st.y) < 350;
  for (let r = 0; r < S.ritRichtingen(l); r++) {
    const volg = r ? [...l.haltes].reverse() : l.haltes, i = volg.findIndex(bij); if (i < 0 || i === volg.length - 1) continue;
    const t = l.tr?.[r] || l.t, v = (l.vertrek[r] || []).find(v => v + t[i] / 60 >= nu); if (v == null) continue;
    try { som += ritReizigers(spel, l, r, v, l.typeId, ctx()).haltes?.[i]?.in || 0; } catch {}
  }
  return Math.round(som);
}
// Stationsoverzicht: de vertrekken van de komende anderhalf uur van alle lijnen die hier stoppen (eigen en van
// anderen), met soort vervoer, vervoerder, richting en hoeveel mensen er op die rit wachten.
function stationOverzicht(s) {
  const nu = spel.tijd, bij = h => Math.hypot(h.x - s.x, h.y - s.y) < 350 || h.naam === s.naam;
  const rijen = [];
  for (const l of [...spel.lijnen.filter(l => l.actief !== false), ...AI.lijnen]) {
    if (!l.vertrek || !l.haltes?.some(bij)) continue;
    for (let r = 0; r < S.ritRichtingen(l); r++) {
      const n = l.haltes.length, volg = r ? [...l.haltes].reverse() : l.haltes, i = volg.findIndex(bij);
      if (i < 0 || i === n - 1) continue; // hier eindigt de rit
      const t = l.tr?.[r] || l.t;
      for (const v of l.vertrek[r] || []) {
        const pw = l._ritWacht?.get(`${r}:${v}`) || [], extra = pw.reduce((a, q) => a + (q.t <= t[i] + 1 ? q.w : 0), 0);
        const dep = v + (t[i] + extra) / 60 + ((l.halteWacht?.[`${r}:${i}`] || l.dw?.[i] || 0));
        if (dep >= nu - 0.5 && dep <= nu + 90) rijen.push({ l, r, v, i, dep, naar: volg[n - 1].naam });
      }
    }
  }
  rijen.sort((a, b) => a.dep - b.dep);
  const toon = rijen.slice(0, 16);
  const wachtend = x => { try { const typeId = x.l.ai ? typeVoor(x.l, spel.jaar, standaardType) : x.l.typeId; const rr = ritReizigers(spel, x.l, x.r, x.v, typeId, ctx()); return Math.round(rr.haltes?.[x.i]?.in || 0); } catch { return null; } };
  const eigen = l => !l.ai;
  return `<div class="rij"><button class="knop hoofd" data-actie="station-verbouw">Verbouwen</button></div>
    <h2>${esc(s.naam)}</h2><p class="klein">${s.eigen ? 'Jouw station' : 'Bestaand station'}${s.p ? ` · ongeveer ${s.p} sporen` : ''} · vertrekken de komende anderhalf uur (nu ${S.klok(nu)})</p>
    ${toon.length ? `<table class="tabel"><tr><th>Tijd</th><th>Lijn</th><th>Soort</th><th>Vervoerder</th><th>Richting</th><th class="getal">Wachtend</th></tr>
      ${toon.map(x => { const w = wachtend(x); return `<tr ${eigen(x.l) ? `data-actie="toon-lijn" data-id="${x.l.id}" style="cursor:pointer"` : ''}><td class="getal"><b>${S.klok(Math.floor(x.dep))}</b></td>
        <td><span class="lijnnr" style="background:${eigen(x.l) ? spel.kleur : esc(x.l.kleur || '#777')}">${esc(x.l.nr || '')}</span></td><td>${esc(MODI[x.l.modus]?.naam || x.l.modus)}</td>
        <td>${esc(eigen(x.l) ? spel.naam : x.l.vervoerderNaam || '')}</td><td>${esc(x.naar)}</td><td class="getal">${w == null ? '—' : w}</td></tr>`; }).join('')}</table>
      ${rijen.length > toon.length ? `<p class="klein">En nog ${rijen.length - toon.length} vertrekken later.</p>` : ''}` : '<p>De komende anderhalf uur vertrekt hier niets.</p>'}
    <p class="klein">Wachtend = reizigers die bij deze halte instappen op die rit.</p>
    ${stationOverstappen(s, rijen)}`;
}
// overstappen op dit station: van elke aankomende eigen rit naar de eerstvolgende vertrekken van andere lijnen (ook van anderen)
function stationOverstappen(s, vertrekken) {
  const bij = h => Math.hypot(h.x - s.x, h.y - s.y) < 350, nu = spel.tijd, aank = [];
  for (const l of spel.lijnen.filter(l => l.actief !== false && l.haltes?.some(bij))) for (let r = 0; r < S.ritRichtingen(l); r++) {
    const volg = r ? [...l.haltes].reverse() : l.haltes, i = volg.findIndex(bij); if (i <= 0) continue;
    const t = l.tr?.[r] || l.t; for (const v of l.vertrek[r] || []) { const a = v + t[i] / 60 - 0.5; if (a >= nu - 5 && a <= nu + 120) aank.push({ l, a, van: volg[0].naam }); }
  }
  const paren = new Map();
  for (const x of aank) for (const y of vertrekken) {
    if (y.l === x.l || y.dep < x.a + 2 || y.dep > x.a + 60) continue;
    const k = `${x.l.id}|${x.van}|${y.l.sleutel || y.l.id}|${y.naar}`; const p = paren.get(k) || { x, y, wacht: [] };
    if (!p.wacht.length || p.laatsteA !== x.a) { p.wacht.push(y.dep - x.a); p.laatsteA = x.a; } paren.set(k, p);
  }
  const lijst = [...paren.values()].map(p => ({ ...p, gem: p.wacht.reduce((a, b) => a + b, 0) / p.wacht.length })).filter(p => p.wacht.length).sort((a, b) => b.gem - a.gem).slice(0, 10);
  if (!lijst.length) return '';
  return `<h3>Overstappen vanaf je eigen lijnen</h3><p class="klein">Gemiddelde wachttijd tussen aankomst en het eerstvolgende vertrek (komende 2 uur). Lange wachttijden: daar valt winst te halen door tijden af te stemmen.</p>
    <table class="tabel"><tr><th>Van</th><th>Naar</th><th class="getal">Wachten</th></tr>${lijst.map(p => `<tr><td><span class="lijnnr" style="background:${lijnKleur(p.x.l)}">${esc(p.x.l.nr)}</span> uit ${esc(p.x.van)}</td>
      <td><span class="lijnnr" style="background:${p.y.l.ai ? esc(p.y.l.kleur || '#777') : lijnKleur(p.y.l)}">${esc(p.y.l.nr || '')}</span> naar ${esc(p.y.naar)}${p.y.l.ai ? ` <span class="klein">(${esc(p.y.l.vervoerderNaam || '')})</span>` : ''}</td>
      <td class="getal" style="color:${p.gem > 15 ? 'var(--rood)' : 'inherit'}">${Math.round(p.gem)} min</td></tr>`).join('')}</table>`;
}
// samenvatting van de spoorplanner voor een lijn: waar wordt gewacht (kruisen op enkelspoor, achter een voorganger)
function spoorplanTekst(l) {
  const k = l._kruis; if (l.modus !== 'trein' || !k) return '';
  const n = l.haltes.length, per = new Map();
  for (const [sl, w] of l._ritWacht || []) { const r = +sl[0]; for (const q of w) { const h = q.h >= 0 ? l.haltes[r ? n - 1 - q.h : q.h]?.naam || '?' : 'een passeerspoor of sein'; per.set(h, (per.get(h) || 0) + q.w); } }
  const top = [...per].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, s]) => `${esc(h)} (${Math.round(s / 60)} min/dag)`).join(', ');
  return `<p class="klein">Spoorplan: ${k.ritten ? `${k.ritten} rit(ten) wachten vast op een tegentrein (enkelspoor) of voorganger, samen ${Math.round(k.wacht / 60)} min per dag${top ? `; vooral bij ${top}` : ''}.` : 'geen wachttijden: het spoor is vrij.'}
    ${k.mislukt ? `<span class="chip fout">${k.mislukt} rit(ten) krijgen geen pad en vallen uit</span> (ze zouden meer dan 25 min moeten wachten). Leg een passeerspoor (kort stuk dubbelspoor) of dubbelspoor aan, of verschuif de vertrektijden.` : ''}
    ${!l.ai && (k.ritten || k.mislukt) ? `<br><button class="knop klein" data-actie="spoor-afstem" data-id="${l.id}" title="zoekt de verschuiving van heen- en terugrichting (binnen één interval) met het minste wachten">Vertrektijden afstemmen op het spoor</button>` : ''}</p>`;
}
let perronVind = null;
const perronVinder = () => perronVind || (perronVind = stationVinder(D.stations));
// plekken waar treinen elkaar kunnen kruisen: stations en je eigen (opgeleverde) passeersporen
function kruisPlek() {
  stationBij = stationBij || stationZoeker(D.stations);
  const lussen = (spel.spoor || []).filter(s => s.passeer && s.klaar).map(s => s.punten);
  const f = (x, y) => stationBij(x, y) || lussen.some(p => p.some(([px, py], i) => i % 3 === 0 && Math.hypot(px - x, py - y) < 60));
  f.versie = lussen.length;
  return f;
}
const treinenVoorPlan = () => [...AI.lijnen.filter(l => l.modus === 'trein').map(lijn => ({ lijn, vast: 1 })), ...spel.lijnen.filter(l => l.modus === 'trein' && l.actief !== false).map(lijn => ({ lijn, vast: 0 }))];
// vertrektijden van een eigen lijn afstemmen op het enkelspoor (heen en terug verschuiven binnen één interval)
let afstemBezig = false;
async function spoorAfstemmen(l) {
  if (afstemBezig) return; afstemBezig = true;
  melding(`Lijn ${l.nr}: vertrektijden afstemmen op het spoor…`, 4000);
  try {
    const a = await zoekAfstemming(treinenVoorPlan(), l, net, spel.jaar, { bijStation: kruisPlek(), stationVan: perronVinder() });
    if (!a) { melding('Afstemmen lukte niet.'); return; }
    if (a.kosten >= a.basis.kosten - 30) { melding(`Lijn ${l.nr}: de huidige vertrektijden zijn al het best (${Math.round(a.basis.wacht / 60)} min wachten per dag${a.basis.mislukt ? `, ${a.basis.mislukt} ritten zonder pad` : ''}). Een passeerspoor of dubbelspoor helpt dan meer.`, 8000); return; }
    l.offset = (l.offset || 0) + a.s0; l.offsetTerug = (l.offsetTerug || 0) + a.s1;
    if (l.echt) l.aangepast = true;
    S.herbereken(l); padOpnieuwNodig(l);
    const tekst = [a.s0 ? `hele lijn ${a.s0 > 0 ? '+' : ''}${a.s0} min` : '', a.s1 ? `terugrichting ${a.s1 > 0 ? '+' : ''}${a.s1} min` : ''].filter(Boolean).join(', ');
    melding(`Lijn ${l.nr} afgestemd (${tekst}): wachten ${Math.round(a.basis.wacht / 60)} → ${Math.round(a.wacht / 60)} min per dag${a.basis.mislukt || a.mislukt ? `, ritten zonder pad ${a.basis.mislukt} → ${a.mislukt}` : ''}.`, 9000);
    ververs();
  } finally { afstemBezig = false; }
}
// Lijn aanleggen: alleen de stations en haltes waar dit soort vervoer kan stoppen vallen op, de rest wordt dof
let kandSig = '';
const DOF_STIP = ['net-stations', 'net-haltes', 'net-vlieg-stip', 'net-overslag', 'net-voorz11', 'net-voorz13', 'net-voorz15'];
const DOF_TEKST = ['net-stations-naam', 'net-haltes-naam', 'net-vlieg', 'net-overslag-naam', 'net-voorz-naam11', 'net-voorz-naam13', 'net-voorz-naam15'];
function kandidatenTonen() {
  if (!spel || !kaart?.map?.getSource('kandidaten')) return;
  const modus = tool === 'lijn' ? bouw?.modus : tool === 'lijnhalte' && bouw?.lijnId ? lijnVan(bouw.lijnId)?.modus : null;
  const sig = modus ? `${modus}:${spel.jaar}:${(spel.haltes || []).length}` : '';
  if (sig === kandSig) return; kandSig = sig;
  const m = kaart.map, dof = modus ? 0.22 : 1;
  for (const id of DOF_STIP) if (m.getLayer(id)) { m.setPaintProperty(id, 'circle-opacity', dof); m.setPaintProperty(id, 'circle-stroke-opacity', dof); }
  for (const id of DOF_TEKST) if (m.getLayer(id)) m.setPaintProperty(id, 'text-opacity', modus ? 0.3 : 1);
  kaart.bron('kandidaten', { type: 'FeatureCollection', features: modus ? kandidaten(modus).map(c => ({ type: 'Feature', properties: { n: c.naam }, geometry: { type: 'Point', coordinates: lonlat(c.x, c.y) } })) : [] });
}
// spoorplanner: opnieuw zodra een treinlijn (van jou of een vervoerder) verandert. Rekent op de achtergrond.
let planSig = '', planLoopt = null, stationBij = null;
function spoorPlannen() {
  if (!spel || !net) return;
  const treinen = treinenVoorPlan();
  const sig = spel.jaar + '|' + (spel.spoor || []).filter(s => s.passeer && s.klaar).length + '|' + treinen.map(({ lijn: l }) => `${l.id || l.sleutel}:${l.vertrek?.[0]?.length || 0},${l.vertrek?.[1]?.length || 0},${l.vertrek?.[0]?.[0] ?? ''}:${Math.round((l.tr || [l.t])[0]?.at(-1) || 0)}:${l.route?.pts?.length || 0}:${l.actief === false ? 0 : 1}`).join('|');
  if (sig === planSig) return;
  if (planLoopt) planLoopt.stop = true;
  const taak = { stop: false }; planLoopt = taak;
  planAlles(treinen, net, spel.jaar, { stop: () => taak.stop, bijStation: kruisPlek(), stationVan: perronVinder() }).then(r => { if (taak.stop || !r) return; planSig = sig; planLoopt = null; if (paneelSoort === 'lijn') ververs(); }).catch(e => { console.error(e); planLoopt = null; planSig = sig; });
}
function zetTijd(aan) { tijdLoopt = aan; $('b-tijdknop').setAttribute('aria-pressed', String(aan)); $('b-tijdstand').textContent = aan ? '▶' : '❚❚'; }
function zetSnelheid(s) { if (!s) return zetTijd(false); snelheid = s; zetTijd(true); document.querySelectorAll('.snelheid button').forEach(b => b.classList.toggle('aan', +b.dataset.s === s)); }

init();
