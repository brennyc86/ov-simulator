// Vliegroutes: een vlucht taxiet over de taxibanen van de gate naar het begin van de baan, stijgt op over de echte
// start- en landingsbaan (in de richting die het best bij de bestemming past), vliegt, komt binnen via een
// eindnadering in het verlengde van de baan, landt, rolt uit en taxiet naar de gate bij het station.
// route.fasen[i] = stukken van segment i (tussen halte i en i+1): [{s0, s1, v}] in meters langs route.pts en de
// snelheid (m/s) op dat stuk; v = 0 betekent 'de rest van de tijd' (kruisvlucht).

const TAXI = 9, SPRONG = 5000, START = 45, KLIM = 90, NADER = 75, UITROL = 30;
const NADERING = 6000, UITKLIM = 3000;

// taxibanen als graaf (knopen = punten, afgerond op 2 m), eenmalig per vliegveld
function graaf(v) {
  if (v._graaf) return v._graaf;
  const knopen = new Map(), sleutel = (x, y) => Math.round(x / 2) + ',' + Math.round(y / 2);
  const knoop = (x, y) => { const k = sleutel(x, y); let n = knopen.get(k); if (!n) knopen.set(k, n = { x, y, buren: [] }); return n; };
  for (const l of v.tw || []) {
    let vorig = null;
    for (let i = 0; i + 1 < l.length; i += 2) { const n = knoop(l[i], l[i + 1]); if (vorig && vorig !== n) { const d = Math.hypot(n.x - vorig.x, n.y - vorig.y); vorig.buren.push([n, d]); n.buren.push([vorig, d]); } vorig = n; }
  }
  // losse uiteinden die bijna raken aan elkaar knopen (tekenfoutjes)
  const lijst = [...knopen.values()];
  for (const a of lijst) if (a.buren.length === 1) for (const b of lijst) if (b !== a && !a.buren.some(q => q[0] === b)) { const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < 25) { a.buren.push([b, d]); b.buren.push([a, d]); } }
  return (v._graaf = lijst);
}
const dichtste = (g, x, y) => { let b = null, bd = Infinity; for (const n of g) { const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; b = n; } } return b; };
// kortste taxiroute tussen twee punten (Dijkstra), als [x, y, ...]; zonder taxibanen een rechte lijn
function taxi(v, x0, y0, x1, y1) {
  const g = graaf(v); if (!g.length) return [x0, y0, x1, y1];
  // begin in het grootste verbonden taxinet (losse stukjes taxibaan in de data niet gebruiken)
  if (!v._net) { let groot = new Set(); const gezien = new Set();
    for (const s0 of g) { if (gezien.has(s0)) continue; const c = new Set([s0]), st = [s0]; while (st.length) { const n = st.pop(); for (const [m] of n.buren) if (!c.has(m)) { c.add(m); st.push(m); } } for (const n of c) gezien.add(n); if (c.size > groot.size) groot = c; }
    v._net = [...groot]; }
  const a = dichtste(v._net, x0, y0), b = dichtste(v._net, x1, y1); if (!a || !b) return [x0, y0, x1, y1];
  const dist = new Map([[a, 0]]), van = new Map(), open = [a], klaar = new Set();
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
    const n = open.splice(bi, 1)[0]; if (klaar.has(n)) continue; klaar.add(n); if (n === b) break;
    for (const [m, d] of n.buren) { const nd = dist.get(n) + d; if (nd < (dist.get(m) ?? Infinity)) { dist.set(m, nd); van.set(m, n); open.push(m); } }
  }
  if (!dist.has(b)) return [x0, y0, x1, y1];
  const pad = []; for (let n = b; n; n = van.get(n)) pad.unshift(n);
  return [x0, y0, ...pad.flatMap(n => [n.x, n.y]), x1, y1];
}
// baan en richting die het best passen bij koers (kx, ky): [x0, y0, x1, y1] (in die richting) of null
function kiesBaan(v, kx, ky) {
  const l = Math.hypot(kx, ky) || 1; let beste = null, bs = -Infinity;
  // geen baan in de data (klein veld): een baan van de bekende lengte door het midden van het veld, in de vliegrichting
  if (!v.rw?.length) { if (!v.baan || v.s === 'heliport') return null; const ux = kx / l, uy = ky / l, h = v.baan / 2; return [v.x - ux * h, v.y - uy * h, v.x + ux * h, v.y + uy * h]; }
  for (const [x1, y1, x2, y2] of v.rw || []) {
    const lx = x2 - x1, ly = y2 - y1, ll = Math.hypot(lx, ly) || 1, c = (lx * kx + ly * ky) / ll / l;
    const score = Math.abs(c) * 2 + Math.log(ll) * 0.3; // goed in de richting, en liever een lange baan
    if (score > bs) { bs = score; beste = c >= 0 ? [x1, y1, x2, y2] : [x2, y2, x1, y1]; }
  }
  return beste;
}
// gate: het punt op een taxibaan het dichtst bij het station (de halte)
const gate = (v, h) => { const g = graaf(v); if (g.length) taxi(v, h.x, h.y, h.x, h.y); const n = v._net?.length ? dichtste(v._net, h.x, h.y) : null; return n && Math.hypot(n.x - h.x, n.y - h.y) < 1500 ? [n.x, n.y] : [h.x, h.y]; };

// route langs vliegvelden: haltes [{x, y, veld}] met veld = het vliegveld (met rw en tw). Geeft {pts, lengte, fasen}.
export function vluchtRoute(haltes) {
  const pts = [], fasen = []; let s = 0;
  const erbij = (lijst, v) => { // punten toevoegen; geeft [s0, s1] van dit stuk
    const s0 = s;
    for (let i = 0; i + 1 < lijst.length; i += 2) {
      const x = lijst[i], y = lijst[i + 1];
      if (pts.length) { const d = Math.hypot(x - pts[pts.length - 2], y - pts[pts.length - 1]); if (d < 0.5) continue; s += d; }
      pts.push(x, y);
    }
    return { s0, s1: s, v };
  };
  for (let i = 0; i + 1 < haltes.length; i++) {
    const A = haltes[i], B = haltes[i + 1], kx = B.x - A.x, ky = B.y - A.y, st = [];
    const ga = A.veld?.tw?.length ? gate(A.veld, A) : [A.x, A.y], gb = B.veld?.tw?.length ? gate(B.veld, B) : [B.x, B.y];
    // zonder taxibanen in de data: meteen naar de baan (geen rit over gras of door gebouwen)
    const taxiA = A.veld?.tw?.length ? TAXI : SPRONG, taxiB = B.veld?.tw?.length ? TAXI : SPRONG;
    if (!pts.length) erbij(ga);
    const op = A.veld && kiesBaan(A.veld, kx, ky), neer = B.veld && kiesBaan(B.veld, kx, ky);
    let lucht = [];
    if (op) {
      st.push(erbij(taxi(A.veld, ga[0], ga[1], op[0], op[1]), taxiA));
      st.push(erbij([op[0], op[1], op[2], op[3]], START));
      const lx = op[2] - op[0], ly = op[3] - op[1], ll = Math.hypot(lx, ly) || 1;
      st.push(erbij([op[2] + lx / ll * UITKLIM, op[3] + ly / ll * UITKLIM], KLIM));
    }
    if (neer) {
      const lx = neer[2] - neer[0], ly = neer[3] - neer[1], ll = Math.hypot(lx, ly) || 1;
      lucht = [neer[0] - lx / ll * NADERING, neer[1] - ly / ll * NADERING];
      st.push(erbij(lucht, 0));
      st.push(erbij([neer[0], neer[1]], NADER));
      const rol = Math.min(ll, 1400); // uitrollen tot ongeveer 1,4 km na de drempel
      st.push(erbij([neer[0] + lx / ll * rol, neer[1] + ly / ll * rol], UITROL));
      const [ux, uy] = [pts[pts.length - 2], pts[pts.length - 1]];
      st.push(erbij(taxi(B.veld, ux, uy, gb[0], gb[1]).slice(2), taxiB));
    } else st.push(erbij(gb, 0));
    fasen.push(st.filter(x => x.s1 - x.s0 > 0.5));
  }
  return { pts, lengte: s, fasen };
}

// tijd-afstand-profiel per segment en richting: [[tFrac, sFrac], ...] voor ritPlek. duur = segmentduur (s)
export function vluchtProfiel(fasen, duur, terug) {
  const st = terug ? [...fasen].reverse().map(x => ({ len: x.s1 - x.s0, v: x.v })) : fasen.map(x => ({ len: x.s1 - x.s0, v: x.v }));
  const tot = st.reduce((a, x) => a + x.len, 0) || 1;
  let vast = st.reduce((a, x) => a + (x.v ? x.len / x.v : 0), 0), rest = Math.max(1, duur - vast);
  const kruis = st.reduce((a, x) => a + (x.v ? 0 : x.len), 0);
  // te weinig tijd over voor de kruisvlucht: alles evenredig sneller
  const schaal = kruis && rest < kruis / 300 ? (duur - 60) / (vast + kruis / 250) : 1;
  if (schaal !== 1) { vast *= schaal; rest = Math.max(1, duur - vast); }
  const uit = [[0, 0]]; let t = 0, s = 0;
  for (const x of st) {
    t += x.v ? x.len / x.v * schaal : (kruis ? x.len / kruis * rest : 0); s += x.len;
    uit.push([Math.min(1, t / duur), s / tot]);
  }
  uit[uit.length - 1] = [1, 1];
  return uit;
}
// f (tijdfractie) → afstandsfractie volgens het profiel
export function profielF(p, f) {
  for (let i = 1; i < p.length; i++) if (f <= p[i][0]) { const [t0, s0] = p[i - 1], [t1, s1] = p[i]; return s0 + (s1 - s0) * (t1 > t0 ? (f - t0) / (t1 - t0) : 1); }
  return 1;
}
