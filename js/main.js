// Knooppunt — opstarten, kaartlagen, gereedschap, spellus en panelen.
import { Kaart } from './kaart.js';
import { ACHTERGRONDEN, zetKaartjaren, kaartjaarVoor } from './geo.js';
import { Net, wegRoute } from './net.js';
import { MODI, VLOOT, TYPE, beschikbaar } from './vloot.js';
import * as S from './spel.js';
import { AI, laadVervoerderLijnen, nieuwVerzoek, beoordeelVerschuiving, beoordeelPad, beoordeelBouw, beoordeelConcessie,
  bedenkAIVerzoek, beoordeelTegenOpAI, gedeeldeHaltes, overstappen } from './ai.js';
import * as Cloud from './cloud.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const D = { stations: [], wissels: [], plaatsen: [], veren: [], haltes: [], vervoerders: [], dag: '', ok: {} };
let net = new Net(null), kaart, spel = null, snelheid = 1, tool = 'kijk', slot = null, paneelSoort = null;
let bouw = null, selectie = null;

// ---------------------------------------------------------------- data laden
async function json(pad) {
  try { const r = await fetch(pad, { cache: 'no-cache' }); if (!r.ok) throw 0; D.ok[pad] = true; return await r.json(); }
  catch { D.ok[pad] = false; return null; }
}
async function laadData() {
  const [spoor, st, w, pl, ve, ha, vv, hi] = await Promise.all(['data/spoor.json', 'data/stations.json', 'data/wissels.json',
    'data/plaatsen.json', 'data/veren.json', 'data/haltes.json', 'data/vervoerders.json', 'data/historie.json'].map(json));
  net = new Net(spoor);
  D.stations = st?.stations || [];
  D.wissels = w?.wissels || [];
  D.plaatsen = pl?.plaatsen || [];
  D.veren = ve?.veren || [];
  D.haltes = ha?.haltes || [];
  AI.haltes = D.haltes;
  D.vervoerders = vv?.vervoerders || [];
  D.dag = vv?.dag || '';
  AI.vervoerders = D.vervoerders;
  if (hi?.jaren) zetKaartjaren(hi.jaren);
  if (!spoor) melding('De kaartdata wordt nog voor het eerst gegenereerd (GitHub Actions). Je kunt al rondkijken; spoor en stations verschijnen zodra die klaar is.', 9000);
  kaart.vuil = true;
}

// ---------------------------------------------------------------- kaartlagen
let padCache = null;
function netPaden(jaar) {
  if (padCache?.jaar === jaar && padCache.n === net.eigen.length) return padCache;
  const p = { jaar, n: net.eigen.length, h1: new Path2D(), h2: new Path2D(), h3: new Path2D(), zij: new Path2D(), tram: new Path2D(),
    metro: new Path2D(), snel: new Path2D(), oud: new Path2D(), smal: new Path2D(), eigen: new Path2D(), veer: new Path2D() };
  for (const t of net.takken) {
    if (!net.bestaat(t, jaar)) continue;
    let doel;
    if (t.soort === 5 || t.soort === 6) doel = p.oud;
    else if (t.soort === 3) doel = p.tram;
    else if (t.soort === 2) doel = p.metro;
    else if (t.soort === 1) doel = p.snel;
    else if (t.soort === 4 || t.soort === 8) doel = p.smal;
    else if (t.dienst) doel = p.zij;
    else doel = t.sporen >= 3 ? p.h3 : t.sporen === 2 ? p.h2 : p.h1;
    const q = t.pts;
    doel.moveTo(q[0], q[1]);
    for (let k = 2; k < q.length; k += 2) doel.lineTo(q[k], q[k + 1]);
  }
  for (const t of net.eigen) { p.eigen.moveTo(t.pts[0], t.pts[1]); for (let k = 2; k < t.pts.length; k += 2) p.eigen.lineTo(t.pts[k], t.pts[k + 1]); }
  for (const v of D.veren) { p.veer.moveTo(v.c[0], v.c[1]); for (let k = 2; k < v.c.length; k += 2) p.veer.lineTo(v.c[k], v.c[k + 1]); }
  return (padCache = p);
}

function tekenNet(ctx, k) {
  const jaar = spel?.jaar ?? 2026, r = k.res, p = netPaden(jaar);
  k.wereldTransform(ctx);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const donker = matchMedia('(prefers-color-scheme: dark)').matches && document.documentElement.dataset.theme !== 'light';
  const hist = k.achtergrond === 'historisch';
  const lijn = (pad, kleur, px, streep) => { ctx.strokeStyle = kleur; ctx.lineWidth = px * r; ctx.setLineDash(streep ? streep.map(s => s * r) : []); ctx.stroke(pad); };
  lijn(p.veer, '#1f8fb8', 1.6, [6, 5]);
  if (hist || jaar < 2000) lijn(p.oud, '#8a5a2b', 1.4, [5, 3]);
  if (r < 30) lijn(p.zij, donker ? '#5d6b66' : '#9aa39e', 0.8);
  if (r < 60) lijn(p.tram, '#c2412d', r < 6 ? 1.2 : 1.5);
  lijn(p.smal, '#6b5b45', 1.2);
  lijn(p.snel, '#0f7c8a', 2);
  lijn(p.metro, '#1f6fd1', 2.2);
  const spoorKleur = donker ? '#cfd8d4' : '#2a3431';
  const fijn = r < 4;
  lijn(p.h1, spoorKleur, fijn ? 1.1 : 1.6);
  lijn(p.h2, spoorKleur, fijn ? 1.1 : 2.4);
  lijn(p.h3, spoorKleur, fijn ? 1.1 : 3.4);
  if (!fijn && r < 400) { // dwarsliggers-effect op enkelspoor zodat het opvalt
    lijn(p.h1, donker ? '#101716' : '#ffffff', 0.7, [2, 6]);
  }
  if (spel) lijn(p.eigen, spel.kleur, 3.2);
  ctx.setLineDash([]);
  // wissels
  if (r < 2.5 && D.wissels.length) {
    const [x0, y0, x1, y1] = k.zicht(10);
    ctx.fillStyle = '#e0a516';
    const w = D.wissels;
    for (let i = 0; i < w.length; i += 2) if (w[i] > x0 && w[i] < x1 && w[i + 1] > y0 && w[i + 1] < y1) ctx.fillRect(w[i] - 1.2 * r, w[i + 1] - 1.2 * r, 2.4 * r, 2.4 * r);
  }
  // spoor in aanleg
  if (spel) for (const s of spel.spoor) if (!s.klaar) {
    ctx.beginPath(); s.punten.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.strokeStyle = spel.kleur; ctx.lineWidth = 3 * r; ctx.setLineDash([4 * r, 4 * r]); ctx.stroke(); ctx.setLineDash([]);
  }
  tekenStations(ctx, k);
}

function stationZichtbaar(s, jaar) {
  if (s.b && s.b > jaar) return false;
  if (s.e === 1) return jaar < 1990;
  if (s.e && s.e <= jaar) return false;
  return true;
}
function tekenStations(ctx, k) {
  const r = k.res, jaar = spel?.jaar ?? 2026;
  const [x0, y0, x1, y1] = k.zicht(40);
  k.schermTransform(ctx);
  ctx.textBaseline = 'middle';
  const labels = [];
  for (const s of D.stations) {
    if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1 || !stationZichtbaar(s, jaar)) continue;
    const trein = s.s === 'trein';
    if (!trein && r > (s.s === 'tram' ? 6 : 25)) continue;
    if (trein && r > 300 && !(s.p >= 4)) continue;
    const px = k.sx(s.x), py = k.sy(s.y);
    const groot = trein ? (s.p >= 6 ? 5.5 : s.p >= 3 ? 4.5 : 3.5) : 2.6;
    ctx.beginPath(); ctx.arc(px, py, groot, 0, 7);
    ctx.fillStyle = s.e ? '#e7d9c4' : '#fff'; ctx.fill();
    ctx.lineWidth = trein ? 2 : 1.4;
    ctx.strokeStyle = { trein: '#173b3a', metro: '#1f6fd1', sneltram: '#0f7c8a', tram: '#c2412d', veer: '#1f8fb8', busstation: '#3d8b3d' }[s.s] || '#333';
    ctx.stroke();
    if ((trein && (r < 40 || (r < 120 && s.p >= 4) || s.p >= 8)) || (!trein && r < 3)) labels.push([s.n + (s.e ? ' (opgeheven)' : ''), px + groot + 4, py, trein]);
  }
  // GTFS-haltes (bus) bij inzoomen
  if (r < 6) {
    for (const h of D.haltes) {
      if (h[1] < x0 || h[1] > x1 || h[2] < y0 || h[2] > y1 || !(h[3] & (8 | 32 | 16))) continue;
      const px = k.sx(h[1]), py = k.sy(h[2]);
      ctx.fillStyle = h[3] & 16 ? '#1f8fb8' : '#3d8b3d';
      ctx.fillRect(px - 2.5, py - 2.5, 5, 5);
      if (r < 1.5) labels.push([h[0], px + 5, py, false]);
    }
  }
  // eigen haltes en stations
  if (spel) for (const h of spel.haltes) {
    if (h.x < x0 || h.x > x1 || h.y < y0 || h.y > y1) continue;
    const px = k.sx(h.x), py = k.sy(h.y);
    ctx.beginPath(); ctx.arc(px, py, h.modus === 'trein' ? 6 : 4.5, 0, 7);
    ctx.fillStyle = h.gereedDag > spel.dag ? '#ffffffaa' : '#fff'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = spel.kleur; ctx.setLineDash(h.gereedDag > spel.dag ? [3, 3] : []); ctx.stroke(); ctx.setLineDash([]);
    if (r < 60) labels.push([h.naam + (h.gereedDag > spel.dag ? ' (in aanbouw)' : ''), px + 8, py, true]);
  }
  ctx.lineJoin = 'round';
  for (const [t, x, y, vet] of labels) {
    ctx.font = `${vet ? 600 : 500} ${vet ? 12.5 : 11}px "Source Sans 3", system-ui, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeText(t, x, y);
    ctx.fillStyle = '#1d2724'; ctx.fillText(t, x, y);
  }
}

// bewegende laag: eigen lijnen, AI-voertuigen, bouwgereedschap
const zichtLijnen = [];
function tekenBoven(ctx, k) {
  if (!spel) return;
  const [x0, y0, x1, y1] = k.zicht(30);
  const r = k.res;
  const inZicht = l => !(l.bbox[0] > x1 || l.bbox[2] < x0 || l.bbox[1] > y1 || l.bbox[3] < y0);
  // eigen lijnen
  k.wereldTransform(ctx);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const l of spel.lijnen) {
    if (!inZicht(l)) continue;
    const pts = l.route.pts;
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6 * r; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = l.actief ? spel.kleur : '#888'; ctx.lineWidth = (selectie?.lijn === l ? 4.5 : 3) * r;
    ctx.setLineDash(l.actief ? [] : [6 * r, 5 * r]); ctx.stroke(); ctx.setLineDash([]);
  }
  // voertuigen
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
  k.schermTransform(ctx);
  const maat = r < 3 ? 1.6 : r < 15 ? 1.25 : r < 60 ? 1 : 0.75;
  for (let i = vt.length - 1; i >= 0; i--) {
    const v = vt[i], eigen = i < eigenN;
    const px = k.sx(v.x), py = k.sy(v.y);
    if (px < -20 || py < -20 || px > k.W + 20 || py > k.H + 20) continue;
    const m = v.lijn.modus, lang = (m === 'trein' ? 14 : m === 'metro' || m === 'tram' || m === 'sneltram' ? 11 : m === 'veer' ? 10 : 8) * maat;
    const breed = (m === 'trein' ? 4.5 : 4) * maat;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-v.hoek);
    ctx.fillStyle = eigen ? spel.kleur : (v.lijn.kleur && v.lijn.kleur.length === 7 ? v.lijn.kleur : MODI[m]?.kleur || '#555');
    ctx.strokeStyle = eigen ? '#fff' : 'rgba(0,0,0,.55)'; ctx.lineWidth = eigen ? 1.5 : 0.8;
    if (m === 'veer' || m === 'watertaxi') { ctx.beginPath(); ctx.moveTo(lang / 2, 0); ctx.lineTo(-lang / 2, breed); ctx.lineTo(-lang / 2, -breed); ctx.closePath(); }
    else { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-lang / 2, -breed / 2, lang, breed, 1.5) : ctx.rect(-lang / 2, -breed / 2, lang, breed); }
    ctx.fill(); ctx.stroke();
    ctx.restore();
    if (r < 2.5 && v.lijn.nr) {
      ctx.font = '600 10px "Barlow Semi Condensed", sans-serif'; ctx.fillStyle = '#1d2724';
      ctx.fillText(v.lijn.nr, px + 8, py - 7);
    }
    zichtLijnen.push(v);
  }
  // bouwgereedschap: lijn of spoor in wording
  if (bouw?.punten?.length) {
    ctx.strokeStyle = spel.kleur; ctx.lineWidth = 3; ctx.setLineDash([7, 5]);
    ctx.beginPath(); bouw.punten.forEach((p, i) => { const x = k.sx(p.x), y = k.sy(p.y); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    if (bouw.muis) ctx.lineTo(bouw.muis[0], bouw.muis[1]);
    ctx.stroke(); ctx.setLineDash([]);
    bouw.punten.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(k.sx(p.x), k.sy(p.y), 6, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = spel.kleur; ctx.stroke();
      ctx.fillStyle = '#1d2724'; ctx.font = '700 11px "JetBrains Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), k.sx(p.x), k.sy(p.y) - 13); ctx.textAlign = 'left';
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
  for (const s of spel.spoor) if (!s.klaar && s.gereedDag <= spel.dag) { s.klaar = true; const t = net.voegEigenSpoorToe(s.punten.map(p => [p[0], p[1]]), s.eigenaar, s.sporen, spel.jaar); s.takId = t.i; melding(`Spoor opgeleverd: ${(t.lengte / 1000).toFixed(1).replace('.', ',')} km ${s.sporen === 2 ? 'dubbel' : 'enkel'}spoor (${s.eigenaar === 'speler' ? 'van jou' : 'ProRail'}).`); kaart.vuil = true; }
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
    if (spel.dag % 360 === 0) { spel.jaar++; kaart.jaar = spel.jaar; padCache = null; kaart.vuil = true; melding(`Gelukkig nieuwjaar: het is nu ${spel.jaar}.`); }
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
      ${Object.entries(ACHTERGRONDEN).map(([id, a]) => `<label class="rij"><input type="radio" name="achtergrond" value="${id}" data-wijzig="achtergrond" ${kaart.achtergrond === id ? 'checked' : ''}> ${a.naam}${id === 'historisch' ? ` (${kaartjaarVoor(spel.jaar)})` : ''}</label>`).join('')}
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
    const typen = beschikbaar(spel.jaar, d.modus);
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
        melding(`Bouw van station ${naam} gestart. Klaar over 30 speldagen.`); kaart.vuil = true; sluitPaneel();
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
        melding(`Aanleg gestart (${S.euroKort(kosten)}).`); kaart.vuil = true; sluitPaneel();
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
    case 'achtergrond': kaart.achtergrond = i.value; kaart.vuil = true; $('bron').textContent = ACHTERGRONDEN[i.value].bron || ''; break;
  }
  i.blur(); ververs();
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
  kaart.vuil = true;
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
  const modi = [['trein', 'Trein'], ['metro', 'Metro'], ['sneltram', 'Sneltram'], ['tram', 'Tram'], ['bus', 'Bus'], ['hov', 'Snelbus'], ['belbus', 'Belbus'], ['veer', 'Veer'], ['watertaxi', 'Watertaxi']];
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
  kaart.vuil = true;
  return h;
}

// welke bestaande haltes en stations passen bij een modus
function kandidaten(modus) {
  const uit = [];
  const st = { trein: ['trein'], metro: ['metro', 'sneltram'], sneltram: ['sneltram', 'tram', 'metro'], tram: ['tram', 'sneltram'], bus: ['busstation'], hov: ['busstation'], belbus: ['busstation'], veer: ['veer'], watertaxi: ['veer'] }[modus];
  for (const s of D.stations) if (st.includes(s.s) && stationZichtbaar(s, spel.jaar)) uit.push({ naam: s.n, x: s.x, y: s.y, p: s.p });
  const bit = { trein: 1, metro: 2, sneltram: 6, tram: 4, bus: 8 | 32, hov: 8, belbus: 8 | 32, veer: 16, watertaxi: 16 }[modus];
  if (spel.jaar >= 2015) for (const h of D.haltes) if (h[3] & bit) uit.push({ naam: h[0], x: h[1], y: h[2] });
  for (const h of spel.haltes) if (h.gereedDag <= spel.dag && (h.modus === modus || (['bus', 'hov', 'belbus'].includes(modus) && ['bus', 'hov', 'belbus'].includes(h.modus)) || (modus === 'watertaxi' && h.modus === 'veer'))) uit.push({ naam: h.naam, x: h.x, y: h.y, eigen: h.id });
  return uit;
}
function dichtsteKandidaat(modus, px, py, maxPx = 18) {
  let beste = null, bd = maxPx;
  for (const c of kandidaten(modus)) { const d = Math.hypot(kaart.sx(c.x) - px, kaart.sy(c.y) - py); if (d < bd) { bd = d; beste = c; } }
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
  } else if (m === 'veer' || m === 'watertaxi') {
    const pts = p.flatMap(h => [h.x, h.y]); let lengte = 0;
    for (let i = 1; i < p.length; i++) lengte += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    route = { pts, lengte };
  } else route = await wegRoute(p.map(h => [h.x, h.y]));
  bouw.route = route;
  hint(null);
  openPaneel('nieuweLijn', { modus: m, haltes: p.map(h => ({ naam: h.naam, x: h.x, y: h.y })), route, waarschuwing });
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
  for (const v of zichtLijnen) { const d = Math.hypot(kaart.sx(v.x) - px, kaart.sy(v.y) - py); if (d < bd) { bd = d; beste = v; } }
  if (beste) { if (beste.lijn.ai) openPaneel('aiLijn', beste.lijn); else { selectie = { lijn: beste.lijn }; openPaneel('lijn', beste.lijn); } return; }
  for (const l of spel.lijnen) {
    const pts = l.route.pts;
    for (let i = 2; i < pts.length; i += 2) {
      if (afstandTotLijnstuk(px, py, kaart.sx(pts[i - 2]), kaart.sy(pts[i - 1]), kaart.sx(pts[i]), kaart.sy(pts[i + 1])) < 6) { selectie = { lijn: l }; openPaneel('lijn', l); return; }
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
function opslagVorm() {
  const kopie = { ...spel, lijnen: spel.lijnen.map(l => {
    const { cum, km, t, vertrek, _vangst, bbox, nodig, duur, lengteKm, stat, bezetting, ...rest } = l;
    if (l.bron && !l.aangepast) { delete rest.route; delete rest.echt; }
    else if (rest.echt) rest.echt = { ...rest.echt, v: undefined };
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
  let vervoerder = null;
  if (soort === 'bestaand') {
    const id = document.querySelector('input[name="vervoerder"]:checked')?.value;
    vervoerder = D.vervoerders.find(v => v.id === id);
    if (!vervoerder) { melding('Kies eerst een vervoerder.'); return; }
  }
  $('s-start').disabled = true; $('s-start').textContent = 'Bezig…';
  spel = S.nieuwSpel({ naam: vervoerder ? vervoerder.naam : naam, kleur: $('s-kleur').value, jaar, start: soort, vervoerder: vervoerder ? { id: vervoerder.id, naam: vervoerder.naam } : null, kapitaal: 25e6 });
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
  if (vervoerder?.bbox) { const b = vervoerder.bbox; kaart.vliegNaar((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, Math.max(b[2] - b[0], b[3] - b[1]) / Math.min(kaart.W, kaart.H) * 1.1); }
  else kaart.vliegNaar(136000, 456000, 25);
  $('s-start').disabled = false; $('s-start').textContent = 'Spel starten';
}
function begin() {
  $('start').close();
  kaart.jaar = spel.jaar; padCache = null;
  if (spel.jaar < 1995 && kaart.achtergrond !== 'historisch') { kaart.achtergrond = 'historisch'; $('bron').textContent = ACHTERGRONDEN.historisch.bron; }
  $('b-bedrijf').hidden = false; $('b-naam').textContent = spel.naam; $('b-kleur').style.background = spel.kleur;
  kaart.vuil = true; hud(); laadAIinBeeld();
  if (!spel.lijnen.length) setTimeout(() => melding('Tip: kies ＋ Lijn, dan Bus, en klik een paar plekken in een stad aan. Haltes komen er vanzelf bij.', 8000), 1200);
}

function jaarUitleg(j) {
  if (j >= 2020) return 'Huidige situatie: echte dienstregeling van alle vervoerders rijdt mee.';
  if (j >= 1990) return 'Recent verleden: modern spoornet zonder recente nieuwbouw (voor zover bekend in OpenStreetMap). Andere vervoerders rijden nog niet mee.';
  return `Historisch: kaart uit ${kaartjaarVoor(j)}, opgeheven spoorlijnen zichtbaar en materieel uit die tijd. Andere vervoerders rijden nog niet mee.`;
}
async function toonStart() {
  const dlg = $('start');
  if (!dlg.open) dlg.showModal();
  const jaar = $('s-jaar');
  jaar.oninput = () => { $('s-jaar-uit').textContent = jaar.value; $('s-jaar-uitleg').textContent = jaarUitleg(+jaar.value); const oud = +jaar.value < 2020; document.querySelector('#s-soort [data-v="bestaand"]').disabled = oud; if (oud) kiesSoort('blanco'); };
  const kiesSoort = v => { document.querySelectorAll('#s-soort button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === v))); $('s-vervoerders').hidden = v !== 'bestaand'; };
  document.querySelectorAll('#s-soort button').forEach(b => b.onclick = () => kiesSoort(b.dataset.v));
  const MODNAAM = { trein: 'trein', bus: 'bus', tram: 'tram', metro: 'metro', veer: 'veer', belbus: 'belbus' };
  $('s-vervoerders').innerHTML = D.vervoerders.length ? D.vervoerders.map((v, i) => `<label><input type="radio" name="vervoerder" value="${esc(v.id)}" ${i ? '' : 'checked'}> ${esc(v.naam)}<span>${v.lijnen} lijnen · ${Object.keys(v.modi).map(m => MODNAAM[m] || m).join(', ')}</span></label>`).join('')
    : '<p class="klein" style="padding:8px 10px">De dienstregeling wordt nog verwerkt. Probeer het later of begin blanco.</p>';
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
  kaart.vliegNaar(150000, 460000, 420);
  kaart.lagenOnder.push(tekenNet);
  kaart.lagenBoven.push(tekenBoven);
  kaart.bijKlik = klik;
  kaart.bijBeweeg = (px, py) => { if (bouw?.punten?.length) bouw.muis = [px, py]; };
  const oudVuil = Object.getOwnPropertyDescriptor(Kaart.prototype, 'vuil');
  void oudVuil;
  let vorigeZicht = '';
  setInterval(() => { const z = kaart.zicht().map(v => Math.round(v / 2000)).join(',') + kaart.res.toFixed(0); if (z !== vorigeZicht) { vorigeZicht = z; laadAIinBeeld(); } }, 700);
  $('bron').textContent = ACHTERGRONDEN.grijs.bron;
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
