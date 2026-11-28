// Bouwt een geloofwaardig lijnennet voor een (historische) vervoerder in een bepaald jaar,
// op basis van het echte spoor-, tram- en veernet en de plaatsen van dat moment.
import { vangst, herbereken, nieuwId } from './spel.js';
import { standaardType, MODI } from './vloot.js';
import { binnen, frequentie } from './historie.js';

const afst = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const stationBestaat = (s, jaar) => !(s.b && s.b > jaar) && !(s.e === 1 ? jaar >= 1990 : s.e && s.e <= jaar);
const pauze = () => new Promise(r => setTimeout(r, 0));

// stations langs een route, op volgorde van de route
function stationsLangs(route, kandidaten, max = 160) {
  const pts = route.pts, uit = [];
  const cum = [0];
  for (let k = 2; k < pts.length; k += 2) cum.push(cum[cum.length - 1] + Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]));
  for (const s of kandidaten) {
    let beste = Infinity, km = 0;
    for (let k = 2; k < pts.length; k += 2) {
      const ax = pts[k - 2], ay = pts[k - 1], dx = pts[k] - ax, dy = pts[k + 1] - ay, l2 = dx * dx + dy * dy || 1;
      const f = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.y - ay) * dy) / l2));
      const d = Math.hypot(s.x - ax - dx * f, s.y - ay - dy * f);
      if (d < beste) { beste = d; km = cum[k / 2 - 1] + f * Math.sqrt(l2); }
    }
    if (beste < max) uit.push({ s, km });
  }
  uit.sort((a, b) => a.km - b.km);
  return uit.map(u => u.s).filter((s, i, a) => !i || s.n !== a[i - 1].n);
}

function interval(modus, jaar, belangrijk) {
  const [spits, dal, avond] = frequentie(modus, jaar, belangrijk);
  return { vroeg: dal, ochtendspits: spits, dal, avondspits: spits, avond };
}

function lijnObject(v, jaar, { nr, naam, modus, haltes, route, belangrijk }) {
  const l = {
    id: nieuwId('g'), nr: String(nr), naam, modus, typeId: standaardType(v.naam, modus, jaar).id,
    haltes: haltes.map(h => ({ naam: h.n || h.naam, x: h.x, y: h.y })), route,
    interval: interval(modus, jaar, belangrijk), eerste: jaar < 1950 ? 6 * 60 : 5.5 * 60, laatste: jaar < 1950 ? 22 * 60 : 24 * 60,
    offset: [...String(nr)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) % 10, concessie: modus !== 'trein' || v.id !== 'ns', kleur: v.kleur, controle: 0, actief: true,
  };
  herbereken(l);
  return l;
}

// ---------------------------------------------------------------- trein
async function treinNet(v, jaar, D, net, plaatsen) {
  const st = D.stations.filter(s => s.s === 'trein' && stationBestaat(s, jaar) && binnen(v, s.x, s.y));
  if (st.length < 2) return [];
  for (const s of st) s._w = s._w ?? vangst(plaatsen, s.x, s.y, 2500);
  const gesorteerd = [...st].sort((a, b) => b._w - a._w);
  const maxHubs = Math.min(28, Math.max(4, Math.round(st.length / 12)));
  const hubs = [];
  for (const s of gesorteerd) { if (hubs.length >= maxHubs) break; if (hubs.every(h => afst(h, s) > 14000)) hubs.push(s); }
  // minimale opspannende boom over de hubs (hemelsbreed), alleen verbindingen die over het spoor bestaan
  const inBoom = new Set([0]), randen = [];
  while (inBoom.size < hubs.length) {
    let beste = null;
    for (const i of inBoom) for (let j = 0; j < hubs.length; j++) if (!inBoom.has(j)) {
      const d = afst(hubs[i], hubs[j]);
      if (!beste || d < beste.d) beste = { i, j, d };
    }
    inBoom.add(beste.j);
    if (beste.d < 90000) randen.push([beste.i, beste.j]);
  }
  // randen tot ketens (intercitylijnen) samenvoegen
  const buren = new Map();
  for (const [a, b] of randen) { (buren.get(a) || buren.set(a, []).get(a)).push(b); (buren.get(b) || buren.set(b, []).get(b)).push(a); }
  const gebruikt = new Set(), ketens = [];
  const sleutel = (a, b) => a < b ? a + '-' + b : b + '-' + a;
  const eindpunten = [...buren.keys()].sort((a, b) => (buren.get(a).length === 1 ? -1 : 0) - (buren.get(b).length === 1 ? -1 : 0));
  for (const start of eindpunten) {
    for (const eerste of buren.get(start)) {
      if (gebruikt.has(sleutel(start, eerste))) continue;
      const keten = [start, eerste]; gebruikt.add(sleutel(start, eerste));
      let vorig = start, nu = eerste;
      while (keten.length < 7) {
        const volgende = (buren.get(nu) || []).filter(n => n !== vorig && !gebruikt.has(sleutel(nu, n)))
          .sort((a, b) => Math.abs(richting(hubs[vorig], hubs[nu], hubs[a])) - Math.abs(richting(hubs[vorig], hubs[nu], hubs[b])))[0];
        if (volgende == null) break;
        gebruikt.add(sleutel(nu, volgende)); keten.push(volgende); vorig = nu; nu = volgende;
      }
      ketens.push(keten);
    }
  }
  const lijnen = [];
  let icNr = jaar < 1970 ? 1 : 500, stopNr = jaar < 1970 ? 100 : 5000;
  const gedekt = new Set();
  for (const keten of ketens) {
    const pts = [], takken = []; let lengte = 0, ok = true;
    for (let i = 1; i < keten.length; i++) {
      const r = net.route([hubs[keten[i - 1]].x, hubs[keten[i - 1]].y], [hubs[keten[i]].x, hubs[keten[i]].y], 'trein', jaar);
      if (!r) { ok = false; break; }
      pts.push(...r.pts); lengte += r.lengte; takken.push(...r.takken);
      // stoptrein over dit stuk
      const langs = stationsLangs(r, st);
      if (langs.length >= 3) {
        langs.forEach(s => gedekt.add(s.n));
        lijnen.push(lijnObject(v, jaar, { nr: stopNr += 2, naam: `${langs[0].n} – ${langs[langs.length - 1].n}`, modus: 'trein', haltes: langs, route: { ...r, takken: r.takken }, belangrijk: false }));
      }
      await pauze();
    }
    if (!ok || keten.length < 2) continue;
    const haltes = keten.map(i => hubs[i]);
    haltes.forEach(s => gedekt.add(s.n));
    lijnen.push(lijnObject(v, jaar, { nr: jaar < 1970 ? `D${icNr++}` : `IC ${icNr += 100}`, naam: `${haltes[0].n} – ${haltes[haltes.length - 1].n}`, modus: 'trein', haltes, route: { pts, lengte, takken }, belangrijk: true }));
  }
  // zijlijnen: stations die nog niet bediend worden, met een lokaaltrein naar de dichtstbijzijnde hub
  const rest = st.filter(s => !gedekt.has(s.n)).sort((a, b) => b._w - a._w);
  for (const s of rest) {
    if (gedekt.has(s.n) || lijnen.length > 80) continue;
    const hub = [...hubs].sort((a, b) => afst(a, s) - afst(b, s))[0];
    const r = net.route([hub.x, hub.y], [s.x, s.y], 'trein', jaar);
    if (!r || r.lengte > 70000) { gedekt.add(s.n); continue; }
    const langs = stationsLangs(r, st);
    if (langs.length < 2) continue;
    langs.forEach(x => gedekt.add(x.n));
    lijnen.push(lijnObject(v, jaar, { nr: stopNr += 2, naam: `${langs[0].n} – ${langs[langs.length - 1].n}`, modus: 'trein', haltes: langs, route: r, belangrijk: false }));
    await pauze();
  }
  return lijnen;
}
function richting(a, b, c) { const h1 = Math.atan2(b.y - a.y, b.x - a.x), h2 = Math.atan2(c.y - b.y, c.x - b.x); let d = h2 - h1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

// ---------------------------------------------------------------- tram / metro (stad)
async function railStad(v, jaar, D, net, modus) {
  const soort = modus === 'tram' ? [3, 1] : [2, 1];
  const takken = net.takken.filter(t => soort.includes(t.soort) && net.bestaat(t, jaar) && binnen(v, t.pts[0], t.pts[1]));
  if (!takken.length) return [];
  const graad = new Map();
  for (const t of takken) for (const k of [t.a, t.b]) graad.set(k, (graad.get(k) || 0) + 1);
  const eind = [...graad.entries()].filter(([, g]) => g === 1).map(([k]) => ({ k, x: net.knoopX(k), y: net.knoopY(k) }));
  // centrum: zwaartepunt van de takken
  let cx = 0, cy = 0; for (const t of takken) { cx += t.pts[0]; cy += t.pts[1]; } cx /= takken.length; cy /= takken.length;
  eind.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
  const termini = [];
  for (const e of eind) { if (termini.length >= 14) break; if (Math.hypot(e.x - cx, e.y - cy) > 1500 && termini.every(t => afst(t, e) > 1200)) termini.push(e); }
  const haltesBekend = D.stations.filter(s => (s.s === 'tram' || s.s === 'metro' || s.s === 'sneltram') && binnen(v, s.x, s.y));
  const lijnen = [];
  const gebruikt = new Set();
  let nr = 1;
  for (const a of termini) {
    if (gebruikt.has(a)) continue;
    // tegenoverliggend eindpunt
    const b = termini.filter(t => t !== a && !gebruikt.has(t)).sort((p, q) => {
      const hp = Math.abs(richting({ x: a.x, y: a.y }, { x: cx, y: cy }, p)), hq = Math.abs(richting({ x: a.x, y: a.y }, { x: cx, y: cy }, q));
      return hp - hq;
    })[0];
    if (!b) break;
    const r = net.route([a.x, a.y], [b.x, b.y], modus === 'tram' ? 'tram' : 'metro', jaar);
    if (!r || r.lengte < 2000) continue;
    gebruikt.add(a); gebruikt.add(b);
    let haltes = stationsLangs(r, haltesBekend, 60);
    if (haltes.length < 4) haltes = haltesLangs(r, modus === 'tram' ? 450 : 1000, D, `${v.stad || ''}`);
    lijnen.push(lijnObject(v, jaar, { nr: modus === 'metro' ? `M${nr++}` : nr++, naam: `${haltes[0].n} – ${haltes[haltes.length - 1].n}`, modus, haltes, route: r, belangrijk: true }));
    await pauze();
  }
  return lijnen;
}
// haltes om de zoveel meter langs een route, met een naam van de dichtstbijzijnde bekende halte of plaats
function haltesLangs(route, stap, D, prefix) {
  const pts = route.pts, uit = [];
  let rest = 0;
  for (let k = 2; k < pts.length; k += 2) {
    const ax = pts[k - 2], ay = pts[k - 1], d = Math.hypot(pts[k] - ax, pts[k + 1] - ay);
    while (rest <= d) {
      const f = d ? rest / d : 0, x = ax + (pts[k] - ax) * f, y = ay + (pts[k + 1] - ay) * f;
      uit.push({ x, y, n: naamBij(D, x, y) || `${prefix} halte ${uit.length + 1}` });
      rest += stap;
    }
    rest -= d;
  }
  uit.push({ x: pts[pts.length - 2], y: pts[pts.length - 1], n: naamBij(D, pts[pts.length - 2], pts[pts.length - 1]) || `${prefix} eindpunt` });
  return uit.filter((h, i, a) => !i || h.n !== a[i - 1].n);
}
function naamBij(D, x, y) {
  let beste = null, bd = 250;
  for (const h of D.haltes) { const d = Math.abs(h[1] - x) + Math.abs(h[2] - y); if (d < bd) { bd = d; beste = h[0]; } }
  return beste;
}

// ---------------------------------------------------------------- bus
function busNet(v, jaar, D, plaatsen) {
  const lijnen = [];
  if (v.stad) {
    // stadsbus: radiale lijnen vanuit het centrum
    const pl = plaatsen.filter(p => binnen(v, p[1], p[2])).sort((a, b) => b[3] - a[3]);
    const c = pl[0]; if (!c) return [];
    for (let i = 0; i < 8; i++) {
      const hoek = i / 8 * 2 * Math.PI, r = 4500;
      const doel = { x: c[1] + Math.cos(hoek) * r, y: c[2] + Math.sin(hoek) * r };
      const haltes = [];
      for (let s = 0; s <= 10; s++) { const x = c[1] + (doel.x - c[1]) * s / 10, y = c[2] + (doel.y - c[2]) * s / 10; haltes.push({ x, y, n: naamBij(D, x, y) || `${c[0]}, halte ${s + 1}` }); }
      const uniek = haltes.filter((h, k, a) => !k || h.n !== a[k - 1].n);
      lijnen.push(lijnObject(v, jaar, { nr: i + 1, naam: `${uniek[0].n} – ${uniek[uniek.length - 1].n}`, modus: 'bus', haltes: uniek, route: rechte(uniek), belangrijk: true }));
    }
    return lijnen;
  }
  // streekbus: dorpen naar de dichtstbijzijnde stad, gebundeld per richting
  const pl = plaatsen.filter(p => binnen(v, p[1], p[2]));
  const steden = pl.filter(p => p[3] >= 20000).map(p => ({ n: p[0], x: p[1], y: p[2], inw: p[3] }));
  const dorpen = pl.filter(p => p[3] < 20000 && p[3] >= 400).map(p => ({ n: p[0], x: p[1], y: p[2], inw: p[3] }));
  if (!steden.length) return [];
  const bundels = new Map();
  for (const d of dorpen) {
    const s = steden.reduce((b, x) => afst(x, d) < afst(b, d) ? x : b, steden[0]);
    if (afst(s, d) > 30000) continue;
    const sector = Math.round(Math.atan2(d.y - s.y, d.x - s.x) / (Math.PI / 4));
    const k = s.n + '|' + sector;
    if (!bundels.has(k)) bundels.set(k, { stad: s, dorpen: [] });
    bundels.get(k).dorpen.push(d);
  }
  let nr = jaar < 1970 ? 1 : 10;
  const lijst = [...bundels.values()].sort((a, b) => b.dorpen.reduce((s, d) => s + d.inw, 0) - a.dorpen.reduce((s, d) => s + d.inw, 0)).slice(0, 45);
  for (const b of lijst) {
    const route = [{ n: b.stad.n + (jaar >= 1950 ? ', Station' : ''), x: b.stad.x, y: b.stad.y }, ...b.dorpen.sort((p, q) => afst(p, b.stad) - afst(q, b.stad)).slice(0, 7)];
    lijnen.push(lijnObject(v, jaar, { nr: nr++, naam: `${route[0].n} – ${route[route.length - 1].n}`, modus: 'bus', haltes: route, route: rechte(route), belangrijk: b.dorpen.length > 3 }));
  }
  return lijnen;
}
function rechte(haltes) {
  const pts = haltes.flatMap(h => [h.x, h.y]);
  let lengte = 0; for (let k = 2; k < pts.length; k += 2) lengte += Math.hypot(pts[k] - pts[k - 2], pts[k + 1] - pts[k - 1]) * 1.25;
  return { pts, lengte, rechtLijnig: true };
}

// ---------------------------------------------------------------- veer en lucht
function veerNet(v, jaar, D) {
  const re = v.filter ? new RegExp(v.filter, 'i') : null;
  return D.veren.filter(f => binnen(v, f.c[0], f.c[1]) && (!re || re.test(f.n + ' ' + f.o))).slice(0, 25).map((f, i) => {
    const a = { x: f.c[0], y: f.c[1] }, b = { x: f.c[f.c.length - 2], y: f.c[f.c.length - 1] };
    let lengte = 0; for (let k = 2; k < f.c.length; k += 2) lengte += Math.hypot(f.c[k] - f.c[k - 2], f.c[k + 1] - f.c[k - 1]);
    const naam = f.n || 'Veer';
    return lijnObject(v, jaar, { nr: `V${i + 1}`, naam, modus: 'veer', haltes: [{ ...a, n: naamBij(D, a.x, a.y) || naam.split(/[-–]/)[0].trim() }, { ...b, n: naamBij(D, b.x, b.y) || (naam.split(/[-–]/)[1] || 'overkant').trim() }], route: { pts: f.c, lengte }, belangrijk: true });
  });
}
function luchtNet(v, jaar, D) {
  const velden = D.vliegvelden.filter(f => f.iata && f.s !== 'militair' && !(f.b && f.b > jaar));
  const hub = velden.find(f => /schiphol/i.test(f.n)) || velden[0];
  if (!hub) return [];
  return velden.filter(f => f !== hub && afst(f, hub) > 60000).map((f, i) => lijnObject(v, jaar, {
    nr: `KL${1100 + i * 2}`, naam: `${hub.n} – ${f.n}`, modus: 'vlucht',
    haltes: [{ n: hub.n, x: hub.x, y: hub.y }, { n: f.n, x: f.x, y: f.y }], route: rechte([hub, f]), belangrijk: true,
  }));
}

// ---------------------------------------------------------------- alles samen
export async function genereerVervoerder(v, jaar, D, net, plaatsen, voortgang) {
  const lijnen = [];
  for (const modus of v.modi) {
    voortgang?.(`${MODI[modus]?.naam || modus}lijnen van ${v.naam} opbouwen…`);
    if (modus === 'trein') lijnen.push(...await treinNet(v, jaar, D, net, plaatsen));
    else if (modus === 'tram' || modus === 'metro') { if (v.stad) lijnen.push(...await railStad(v, jaar, D, net, modus)); }
    else if (modus === 'bus') lijnen.push(...busNet(v, jaar, D, plaatsen));
    else if (modus === 'veer') lijnen.push(...veerNet(v, jaar, D));
    else if (modus === 'vlucht') lijnen.push(...luchtNet(v, jaar, D));
    await pauze();
  }
  return lijnen.filter(l => l.haltes.length >= 2 && l.duur > 0);
}
