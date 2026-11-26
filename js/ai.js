// Andere vervoerders (uit de echte dienstregeling), ProRail en de provincie:
// verzoeken, tegenvoorstellen en wat zij van jou vragen.
import { nieuwId, klok, euro, vangst, PERIODES } from './spel.js';
import { MODI } from './vloot.js';
import { bboxVan } from './net.js';

export const AI = { vervoerders: [], geladen: new Map(), lijnen: [], haltes: [], dag: '', opgeheven: new Set() }; // opgeheven: 'vervoerder:lijn' die de vervoerder (in het spel) heeft opgeheven

export async function laadVervoerderLijnen(v, verschuivingen = {}) {
  if (AI.geladen.has(v.id)) return AI.geladen.get(v.id);
  const p = fetch(`data/lijnen/${v.bestand}`).then(r => r.ok ? r.json() : { lijnen: [] }).then(d => {
    const uit = [];
    for (const l of d.lijnen) {
      if (AI.opgeheven.has(`${v.id}:${l.id}`)) continue;
      for (let [ri, r] of l.r.entries()) {
        // haltes met onzinnige coördinaten (fout in de bron, bv. St. Pölten op 5700 km onder de evenaar) weglaten,
        // samen met hun tijden, anders trekt de lijn een streep dwars over de kaart
        const goed = r.h.map(i => { const h = AI.haltes[i]; return h && Math.abs(h[1]) < 2.5e6 && Math.abs(h[2]) < 2.5e6; });
        if (goed.includes(false)) { const k = goed.map((g, j) => g ? j : -1).filter(j => j >= 0); if (k.length < 2) continue;
          r = { ...r, h: k.map(j => r.h[j]), t: r.t.map((_, j) => j).filter(j => goed[j]).map(j => r.t[j]), km: r.km ? k.map(j => r.km[j]) : r.km, vorm: r.vorm ? zonderUitschieters(r.vorm) : r.vorm }; }
        const haltes = r.h.map(i => { const h = AI.haltes[i]; return { naam: h[0], x: h[1], y: h[2], ref: i }; });
        let pts;
        if (r.vorm) {
          pts = [r.vorm[0], r.vorm[1]];
          let x = pts[0], y = pts[1];
          for (let k = 2; k < r.vorm.length; k += 2) { x += r.vorm[k]; y += r.vorm[k + 1]; pts.push(x, y); }
        } else pts = haltes.flatMap(h => [h.x, h.y]);
        const km = r.km && r.vorm ? r.km : null;
        const cum = [0];
        for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
        const kmVan = km || haltes.map((h, i) => {
          // zonder vorm: rechte lijnen tussen haltes
          let s = 0; for (let j = 1; j <= i; j++) s += Math.hypot(haltes[j].x - haltes[j - 1].x, haltes[j].y - haltes[j - 1].y); return s;
        });
        const sleutel = `${v.id}:${l.id}:${ri}`;
        const schuif = verschuivingen[`${v.id}:${l.id}`] || 0;
        uit.push({
          sleutel, lijnId: l.id, vervoerder: v.id, vervoerderNaam: v.naam, nr: l.nr, naam: l.naam, kop: r.kop,
          modus: l.m === 'trein' ? 'trein' : l.m, kleur: l.kl ? '#' + l.kl : (MODI[l.m]?.kleur || '#777'),
          haltes, route: { pts, lengte: cum[cum.length - 1] }, cum, km: kmVan, t: r.t, duur: Math.max(60, r.t[r.t.length - 1]),
          vertrek: [r.v.map(m => m + schuif), []], bbox: bboxVan(pts), ai: true,
        });
      }
    }
    // lege regio: lijnen die in het gekozen gebied stoppen (en niet van een behouden soort zijn) zijn opgeheven
    const houd = AI.filter ? uit.filter(AI.filter) : uit;
    AI.lijnen.push(...houd);
    return houd;
  }).catch(() => []);
  AI.geladen.set(v.id, p);
  return p;
}

// ---------------------------------------------------------------- aansluitingen
const DICHTBIJ = 180;
function bij(h, x, y) { return Math.hypot(h.x - x, h.y - y) < DICHTBIJ; }

// aankomst- en vertrektijden (minuten) van een lijn bij een halte, in beide richtingen
export function tijdenBij(lijn, x, y) {
  const uit = { aankomst: [], vertrek: [] };
  const n = lijn.haltes.length;
  lijn.haltes.forEach((h, i) => {
    if (!bij(h, x, y)) return;
    for (let r = 0; r < lijn.vertrek.length; r++) {
      const idx = r === 0 ? i : n - 1 - i;
      const sec = lijn.t[idx] ?? 0;
      for (const v of lijn.vertrek[r]) {
        const t = v + sec / 60;
        if (idx > 0) uit.aankomst.push(t);
        if (idx < n - 1) uit.vertrek.push(t);
      }
    }
  });
  return uit;
}

// aantal goede overstappen (2–8 min, trein 3–10) van lijn A naar lijn B bij (x,y) in het daluur 12–13
export function overstappen(a, b, x, y, schuifA = 0, schuifB = 0) {
  const ta = tijdenBij(a, x, y), tb = tijdenBij(b, x, y);
  const min = a.modus === 'trein' || b.modus === 'trein' ? 3 : 2, max = a.modus === 'trein' || b.modus === 'trein' ? 10 : 8;
  let n = 0;
  for (const aan of ta.aankomst) {
    const t = aan + schuifA;
    if (t < 12 * 60 || t >= 13 * 60) continue;
    if (tb.vertrek.some(v => { const w = v + schuifB - t; return w >= min && w <= max; })) n++;
  }
  for (const aan of tb.aankomst) {
    const t = aan + schuifB;
    if (t < 12 * 60 || t >= 13 * 60) continue;
    if (ta.vertrek.some(v => { const w = v + schuifA - t; return w >= min && w <= max; })) n++;
  }
  return n;
}

// gedeelde haltes tussen een eigen lijn en AI-lijnen
export function gedeeldeHaltes(lijn) {
  const uit = [];
  for (const h of lijn.haltes) {
    for (const a of AI.lijnen) {
      if (a.bbox[0] > h.x + DICHTBIJ || a.bbox[2] < h.x - DICHTBIJ || a.bbox[1] > h.y + DICHTBIJ || a.bbox[3] < h.y - DICHTBIJ) continue;
      if (a.haltes.some(ah => bij(ah, h.x, h.y))) uit.push({ halte: h, ai: a });
    }
  }
  return uit;
}

// hoeveel eigen aansluitingen verliest de AI-vervoerder als lijn `a` k minuten verschuift
function eigenVerlies(a, k) {
  let verlies = 0;
  const andere = AI.lijnen.filter(b => b.vervoerder === a.vervoerder && b.lijnId !== a.lijnId);
  for (const h of a.haltes) {
    for (const b of andere) {
      if (b.bbox[0] > h.x + DICHTBIJ || b.bbox[2] < h.x - DICHTBIJ || b.bbox[1] > h.y + DICHTBIJ || b.bbox[3] < h.y - DICHTBIJ) continue;
      if (!b.haltes.some(bh => bij(bh, h.x, h.y))) continue;
      verlies += overstappen(a, b, h.x, h.y) - overstappen(a, b, h.x, h.y, k, 0);
    }
  }
  return verlies;
}

// ---------------------------------------------------------------- verzoeken
export function nieuwVerzoek(spel, v) {
  const vz = { id: nieuwId('v'), status: 'open', dag: spel.dag, tijd: spel.tijd, ...v };
  // antwoord komt na 1–3 speldagen (ProRail en provincie doen er langer over)
  // antwoord: ProRail en provincie binnen ongeveer drie kwartier speltijd, andere vervoerders binnen een paar uur
  const wacht = { prorail: 0.03, provincie: 0.03 }[v.aan] ?? (0.08 + Math.random() * 0.12);
  vz.antwoordDag = spel.dag + wacht;
  spel.verzoeken.unshift(vz);
  return vz;
}

// Speler vraagt een AI-vervoerder om een lijn te verschuiven
export function beoordeelVerschuiving(spel, vz, ctx) {
  const a = AI.lijnen.find(l => l.sleutel === vz.aiSleutel);
  const eigen = spel.lijnen.find(l => l.id === vz.lijnId);
  if (!a || !eigen) return { status: 'afgewezen', reden: 'Deze lijn rijdt niet meer.' };
  const h = vz.halte;
  const winst = overstappen(eigen, a, h.x, h.y, 0, vz.minuten) - overstappen(eigen, a, h.x, h.y);
  const goodwill = spel.goodwill[a.vervoerder] ?? 0;
  const enkelspoor = a.modus === 'trein' ? ctx.enkelspoorBij?.(a) : false;
  const kosten = (k) => eigenVerlies(a, k) * 1.5 + Math.abs(k) * 0.15 + (enkelspoor && k ? 4 : 0) + (a.modus === 'trein' ? 2 : 0);
  const waarde = (k, geld) => {
    const w = overstappen(eigen, a, h.x, h.y, 0, k) - overstappen(eigen, a, h.x, h.y);
    return w * 0.8 + geld / 15000 + goodwill / 20;
  };
  const k = vz.minuten;
  if (winst <= 0) return { status: 'afgewezen', reden: `Met ${k > 0 ? '+' : ''}${k} min ontstaat er bij ${h.naam} geen betere overstap. Kijk nog eens naar de tijden.` };
  if (waarde(k, vz.vergoeding || 0) >= kosten(k)) {
    return { status: 'geaccepteerd', reden: `${a.vervoerderNaam} schuift lijn ${a.nr} ${k > 0 ? k + ' min later' : -k + ' min eerder'}. Dat levert ${winst} extra overstap(pen) per uur op bij ${h.naam}.` };
  }
  // tegenvoorstel: een andere verschuiving die voor hen goedkoper is en voor jou nog winst geeft
  let beste = null;
  for (let kk = -8; kk <= 8; kk++) {
    if (!kk || kk === k) continue;
    const w = overstappen(eigen, a, h.x, h.y, 0, kk) - overstappen(eigen, a, h.x, h.y);
    if (w <= 0) continue;
    const marge = waarde(kk, vz.vergoeding || 0) - kosten(kk);
    if (!beste || marge > beste.marge) beste = { kk, marge, w };
  }
  if (beste && beste.marge >= 0) {
    return { status: 'tegenvoorstel', tegen: { minuten: beste.kk, vergoeding: vz.vergoeding || 0 },
      reden: `${k > 0 ? '+' : ''}${k} min breekt onze eigen aansluitingen. We kunnen wel ${beste.kk > 0 ? '+' : ''}${beste.kk} min schuiven; dan heb je ${beste.w} overstap(pen) per uur.` };
  }
  // geld vragen
  const tekort = kosten(k) - waarde(k, vz.vergoeding || 0);
  if (tekort < 6) {
    const vraag = Math.ceil((tekort * 15000 + (vz.vergoeding || 0)) / 5000) * 5000;
    return { status: 'tegenvoorstel', tegen: { minuten: k, vergoeding: vraag },
      reden: `Het kan, maar het kost ons ${eigenVerlies(a, k)} eigen aansluiting(en) en extra omlopen. Voor ${euro(vraag)} per jaar doen we het.` };
  }
  return { status: 'afgewezen', reden: enkelspoor ? `Lijn ${a.nr} rijdt over enkelspoor; een andere tijd botst met tegentreinen.` : `Dat kost ons te veel eigen aansluitingen (${eigenVerlies(a, k)}). Misschien kun jij je eigen lijn verschuiven?` };
}

// Speler vraagt ProRail om ruimte op het spoor (een treinpad) voor een lijn
export function beoordeelPad(spel, vz, ctx) {
  const lijn = spel.lijnen.find(l => l.id === vz.lijnId);
  if (!lijn) return { status: 'afgewezen', reden: 'Lijn bestaat niet meer.' };
  const sporen = lijn.route.takken ? ctx.net.minSporen(lijn.route.takken) : (lijn.route.minSporen || 2);
  const cap = sporen >= 4 ? 24 : sporen === 3 ? 18 : sporen === 2 ? 12 : 4;
  const gevraagd = Math.ceil(60 / Math.min(...Object.values(lijn.interval).map(v => v || 999)));
  const gebruik = treinenPerUurOp(lijn);
  const vrij = Math.max(0, cap - gebruik);
  if (gevraagd <= vrij) {
    return { status: 'geaccepteerd', reden: `Pad toegekend: ${gevraagd} trein(en) per uur per richting. Krapste stuk: ${sporen === 1 ? 'enkelspoor' : sporen + ' sporen'}, al ${gebruik} treinen per uur van anderen.` };
  }
  if (vrij >= 1) {
    const iv = Math.ceil(60 / vrij / 5) * 5;
    return { status: 'tegenvoorstel', tegen: { interval: iv },
      reden: `Er is maar ruimte voor ${vrij} trein(en) per uur (${sporen === 1 ? 'enkelspoor' : sporen + ' sporen'}, ${gebruik} bezet). Voorstel: elke ${iv} minuten.` };
  }
  return { status: 'afgewezen', reden: `Het spoor zit vol (${gebruik} van ${cap} paden per uur bezet). Vraag extra spoor aan of leg zelf een stuk aan.` };
}

// treinen per uur van andere vervoerders op de drukste stationsparen van deze lijn
function treinenPerUurOp(lijn) {
  let max = 0;
  for (let i = 0; i < lijn.haltes.length - 1; i++) {
    const A = lijn.haltes[i], Bh = lijn.haltes[i + 1];
    let n = 0;
    for (const a of AI.lijnen) {
      if (a.modus !== 'trein') continue;
      const ia = a.haltes.findIndex(h => bij(h, A.x, A.y)), ib = a.haltes.findIndex(h => bij(h, Bh.x, Bh.y));
      if (ia < 0 || ib < 0) continue;
      n += a.vertrek[0].filter(v => v >= 12 * 60 && v < 13 * 60).length;
    }
    max = Math.max(max, n);
  }
  return max;
}

// ProRail: verzoek om nieuw spoor of een nieuw station (maatschappelijke kosten-batenanalyse)
export function beoordeelBouw(spel, vz, ctx) {
  if (vz.soort === 'spoor') {
    const pts = vz.punten;
    let km = 0, bewoners = 0;
    for (let i = 1; i < pts.length; i++) km += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / 1000;
    for (let i = 0; i < pts.length; i++) bewoners += vangst(ctx.plaatsen, pts[i][0], pts[i][1], 2000);
    const kosten = km * (vz.sporen === 2 ? 15e6 : 8e6);
    const baten = bewoners * 45 * 30 / Math.max(1, pts.length);
    const mkba = baten / kosten;
    if (mkba >= 1) return { status: 'geaccepteerd', mkba, bouwDagen: Math.round(60 + km * 8),
      reden: `MKBA ${mkba.toFixed(2).replace('.', ',')}: de baten wegen op tegen ${euroKort(kosten)}. ProRail legt ${km.toFixed(1).replace('.', ',')} km ${vz.sporen === 2 ? 'dubbel' : 'enkel'}spoor aan.` };
    return { status: 'afgewezen', mkba, reden: `MKBA ${mkba.toFixed(2).replace('.', ',')}: te weinig reizigers voor ${euroKort(kosten)}. Je kunt het spoor zelf aanleggen; dan is het van jou.` };
  }
  if (vz.soort === 'station') {
    const b = vangst(ctx.plaatsen, vz.x, vz.y, 2000);
    const mkba = b / 9000;
    if (mkba >= 1) return { status: 'geaccepteerd', mkba, bouwDagen: 45, reden: `MKBA ${mkba.toFixed(2).replace('.', ',')}: ongeveer ${Math.round(b).toLocaleString('nl-NL')} mensen binnen fietsafstand. ProRail bouwt station ${vz.naam}.` };
    return { status: 'afgewezen', mkba, reden: `MKBA ${mkba.toFixed(2).replace('.', ',')}: te weinig inwoners rond deze plek. Je kunt het station zelf bouwen.` };
  }
  return { status: 'afgewezen', reden: 'Onbekend verzoek.' };
}

// Provincie: concessie (subsidie) voor een eigen lijn
export function beoordeelConcessie(spel, vz, ctx) {
  const lijn = spel.lijnen.find(l => l.id === vz.lijnId);
  if (!lijn) return { status: 'afgewezen', reden: 'Lijn bestaat niet meer.' };
  const overlap = ctx.concurrentie(lijn);
  const v = lijn._vangst ? lijn._vangst.reduce((s, x) => s + x, 0) / lijn._vangst.length : 0;
  if (overlap > 0.6) return { status: 'afgewezen', reden: `Afgewezen: ${Math.round(overlap * 100)}% van je haltes wordt al bediend door andere vervoerders, en de provincie betaalt niet twee keer voor dezelfde verbinding. Wat wel kan: een route kiezen die nieuwe plaatsen ontsluit, of een van de aangeboden subsidies (Overleg → Aangeboden subsidies).` };
  if (v < 1500 && lijn.modus !== 'belbus') return { status: 'tegenvoorstel', tegen: { modus: 'belbus' }, reden: 'Te weinig inwoners voor een vaste lijn. De provincie subsidieert hier wel een belbus/regiotaxi.' };
  return { status: 'geaccepteerd', reden: `De provincie verleent een concessie voor lijn ${lijn.nr}: subsidie per dienstregelingsuur zolang je rijdt.` };
}

// Provincie: extra subsidie voor een verliesgevende lijn. Ze kijkt naar maatschappelijk nut (reizigers per
// dienstregelingsuur, inwoners langs de lijn) en betaalt liever per reiziger dan een vast bedrag.
export function beoordeelSubsidie(spel, vz, ctx) {
  const lijn = spel.lijnen.find(l => l.id === vz.lijnId), st = lijn?.stat;
  if (!lijn || !st) return { status: 'afgewezen', reden: 'Er zijn nog geen cijfers van deze lijn.' };
  if (!lijn.concessie) return { status: 'afgewezen', reden: 'Deze lijn heeft geen concessie. Vraag eerst een concessie aan.' };
  const drempel = { trein: 40, metro: 35, sneltram: 25, tram: 20, bus: 6, hov: 8, belbus: 1.5, veer: 10 }[lijn.modus] || 6;
  const perUur = st.reizigers / Math.max(1, st.vu);
  const inwoners = lijn._vangst ? lijn._vangst.reduce((a, b) => a + b, 0) / lijn._vangst.length : 0;
  const nut = Math.min(1.2, 0.35 * perUur / drempel + 0.25 * Math.min(1, inwoners / 8000) + (spel.goodwill.provincie || 0) / 200 + (1 - ctx.concurrentie(lijn)) * 0.25);
  if (nut < 0.35) return { status: 'afgewezen', reden: `Te weinig reizigers voor extra geld (${perUur.toFixed(1).replace('.', ',')} per dienstregelingsuur). Rij minder vaak of zet kleiner materieel in.` };
  const maandReizigers = st.reizigers / ((spel.dag % 30) + 1) * 30;
  if (nut >= 0.9) return { status: 'geaccepteerd', reden: `De provincie vindt lijn ${lijn.nr} belangrijk en betaalt ${euro(vz.bedrag)} per maand extra.` };
  const deel = Math.max(0.3, Math.min(0.85, nut));
  const perReiziger = Math.round(deel * vz.bedrag / Math.max(1, maandReizigers) * 100) / 100;
  return { status: 'tegenvoorstel', tegen: { perReiziger }, reden: `De provincie wil niet het hele tekort dekken, maar betaalt € ${perReiziger.toFixed(2).replace('.', ',')} per reiziger extra (ongeveer ${Math.round(deel * 100)}% van wat je vroeg). Meer reizigers = meer subsidie.` };
}

// AI-vervoerders vragen zelf ook dingen aan jou
export function bedenkAIVerzoek(spel) {
  const kandidaten = [];
  for (const lijn of spel.lijnen) {
    if (!lijn.actief) continue;
    for (const { halte, ai } of gedeeldeHaltes(lijn)) {
      for (let k = -6; k <= 6; k++) {
        if (!k) continue;
        const w = overstappen(lijn, ai, halte.x, halte.y, k, 0) - overstappen(lijn, ai, halte.x, halte.y);
        if (w > 0) kandidaten.push({ lijn, ai, halte, k, w });
      }
    }
  }
  if (!kandidaten.length) return null;
  kandidaten.sort((a, b) => b.w - a.w || Math.abs(a.k) - Math.abs(b.k));
  const c = kandidaten[Math.floor(Math.random() * Math.min(3, kandidaten.length))];
  return {
    van: c.ai.vervoerder, vanNaam: c.ai.vervoerderNaam, aan: 'speler', soort: 'verschuif-jij', lijnId: c.lijn.id, aiSleutel: c.ai.sleutel,
    halte: { naam: c.halte.naam, x: c.halte.x, y: c.halte.y }, minuten: c.k, vergoeding: 0,
    tekst: `${c.ai.vervoerderNaam} vraagt: kun je lijn ${c.lijn.nr} ${c.k > 0 ? c.k + ' min later' : -c.k + ' min eerder'} laten rijden? Dan sluit je bij ${c.halte.naam} aan op hun lijn ${c.ai.nr} (${c.w} overstap(pen) per uur erbij).`,
  };
}

// Jouw tegenvoorstel op een AI-verzoek
export function beoordeelTegenOpAI(spel, vz) {
  const lijn = spel.lijnen.find(l => l.id === vz.lijnId);
  const a = AI.lijnen.find(l => l.sleutel === vz.aiSleutel);
  if (!lijn || !a) return { status: 'afgewezen', reden: 'Situatie veranderd.' };
  const k = vz.tegen.minuten, h = vz.halte;
  const w = overstappen(lijn, a, h.x, h.y, k, 0) - overstappen(lijn, a, h.x, h.y);
  const geld = vz.tegen.vergoeding || 0;
  if (w > 0 && geld <= 0) return { status: 'geaccepteerd', reden: `Prima, ${k > 0 ? '+' : ''}${k} min werkt voor ons ook (${w} overstap(pen) per uur).` };
  if (w > 0 && geld <= w * 20000) return { status: 'geaccepteerd', reden: `Akkoord. We betalen ${euro(geld)} per jaar voor de aanpassing.` };
  if (w > 0) return { status: 'tegenvoorstel', tegen: { minuten: k, vergoeding: w * 15000 }, reden: `Te duur. We bieden ${euro(w * 15000)} per jaar.` };
  return { status: 'afgewezen', reden: `Met ${k > 0 ? '+' : ''}${k} min halen onze reizigers de overstap niet. Dan laten we het zo.` };
}

const euroKort = n => n >= 1e9 ? `€ ${(n / 1e9).toFixed(1).replace('.', ',')} mld` : `€ ${(n / 1e6).toFixed(0)} mln`;
export { klok, PERIODES };

// Speler vraagt een andere vervoerder (vanuit een rit) om een lijn te verschuiven of langer te laten wachten.
// Zij wegen hun eigen nadeel (aansluitingen in hun net, reistijd, spoorpaden) af tegen goodwill en geld.
export function beoordeelAanpassing(spel, vz, ctx) {
  const a = AI.lijnen.find(l => l.sleutel === vz.aiSleutel);
  if (!a) return { status: 'afgewezen', reden: 'Deze lijn rijdt niet meer.' };
  const k = vz.minuten, wacht = vz.wijze === 'wacht';
  const goodwill = spel.goodwill[a.vervoerder] ?? 0;
  const enkelspoor = a.modus === 'trein' ? ctx.enkelspoorBij?.(a) : false;
  // nadeel in "punten": verloren aansluitingen in hun eigen net + reistijd voor hun reizigers + gedoe met paden
  const nadeel = m => (wacht ? m * 0.9 + (m > 3 ? (m - 3) * 1.2 : 0) : eigenVerlies(a, m) * 1.5 + Math.abs(m) * 0.25)
    + (a.modus === 'trein' ? 1.5 + (enkelspoor ? 3 : 0) : 0.4);
  const waarde = geld => 0.6 + geld / 15000 + goodwill / 20;
  const geld = vz.vergoeding || 0;
  const wat = m => wacht ? `${m} min langer wachten bij ${vz.halte.naam}` : `${m > 0 ? m + ' min later' : -m + ' min eerder'} rijden`;
  if (waarde(geld) >= nadeel(k)) return { status: 'geaccepteerd', reden: `${a.vervoerderNaam} gaat akkoord: lijn ${a.nr} gaat ${wat(k)}.` };
  // tegenvoorstel: minder minuten voor hetzelfde geld, of hetzelfde voor een vergoeding
  for (let m = Math.abs(k) - 1; m >= 1; m--) {
    const mm = Math.sign(k) * m;
    if (waarde(geld) >= nadeel(mm)) return { status: 'tegenvoorstel', tegen: { minuten: mm, vergoeding: geld }, reden: `${wat(k)} gaat ons te ver. ${wat(mm)} kan wel.` };
  }
  const nodig = Math.ceil((nadeel(k) - waarde(0)) * 15000 / 5000) * 5000;
  if (nodig <= 150000) return { status: 'tegenvoorstel', tegen: { minuten: k, vergoeding: nodig }, reden: `Dat kost ons reizigers en aansluitingen. Voor ${euro(nodig)} per jaar doen we het.` };
  return { status: 'afgewezen', reden: `${wat(k)} past niet in onze dienstregeling${enkelspoor ? ' (enkelspoor: de kruisingen liggen vast)' : ''}.` };
}

// vorm (eerste punt absoluut, daarna verschillen) zonder punten met onzinnige coördinaten
function zonderUitschieters(vorm) {
  const pts = [vorm[0], vorm[1]]; let x = vorm[0], y = vorm[1];
  for (let k = 2; k < vorm.length; k += 2) { x += vorm[k]; y += vorm[k + 1]; pts.push(x, y); }
  const ok = []; for (let k = 0; k < pts.length; k += 2) if (Math.abs(pts[k]) < 2.5e6 && Math.abs(pts[k + 1]) < 2.5e6) ok.push(pts[k], pts[k + 1]);
  if (ok.length < 4) return null;
  const uit = [ok[0], ok[1]]; for (let k = 2; k < ok.length; k += 2) uit.push(ok[k] - ok[k - 2], ok[k + 1] - ok[k - 1]);
  return uit;
}
