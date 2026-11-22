// Voertuigen in bovenaanzicht. Uitgezoomd: een staafje waarvan de lengte iets meegroeit met de echte
// lengte. Ingezoomd: elk rijtuig/bakdeel op ware grootte, langs de route gebogen, met een eigen
// kopvorm (ICM-koploper, VIRM/DDZ rond, SLT/SNG plat, ICNG/FLIRT spits, DDR met loc, enz.).
import { puntOp } from './spel.js';
import { TYPE } from './vloot.js';

// bakken: lengtes in meters (rijtuigen of bakdelen). gel = gelede/Jacobs-draaistellen (kleine tussenruimte)
// neus: plat | rond | koploper | spits | hondekop | loc | stoom | bus | boot | vlieg
// dd = dubbeldekker, pant = indexen van bakken met een stroomafnemer, loc = eerste bak is een locomotief
const U = {
  stoom3700:   { bakken: [11.5, 8, 20, 20, 20, 20], neus: 'stoom', kleur: '#6b2f24', loc: 2 },
  mat36:       { bakken: [23, 23], neus: 'rond', kleur: '#2f5d3a', pant: [0] },
  hondekop:    { bakken: [25.5, 25.5, 25.5, 25.5], neus: 'hondekop', kleur: '#ffc917', pant: [0, 2] },
  planv:       { bakken: [26, 26], neus: 'plat', kleur: '#ffc917', pant: [1] },
  sgm:         { bakken: [26, 26, 26], neus: 'plat', kleur: '#ffc917', pant: [1] },
  icm:         { bakken: [27, 26.5, 26.5, 27], neus: 'koploper', kleur: '#ffc917', pant: [1] },
  ddr:         { bakken: [17.6, 26.8, 26.8, 26.8, 26.8], neus: 'loc', kleur: '#ffc917', dd: true, loc: 1, pant: [0] },
  ddz:         { bakken: [27, 27, 27, 27, 27, 27], neus: 'hoekig', kleur: '#ffc917', dd: true, pant: [1, 4] },
  virm6:       { bakken: [27.3, 26.9, 26.9, 26.9, 26.9, 27.3], neus: 'rond', kleur: '#ffc917', dd: true, pant: [1, 4] },
  icng5:       { bakken: [23.5, 20.6, 20.6, 20.6, 23.5], neus: 'spits', kleur: '#ffc917', gel: true, pant: [2] },
  slt6:        { bakken: [18.2, 15.8, 15.8, 15.8, 15.8, 18.2], neus: 'plat', kleur: '#ffc917', gel: true, pant: [2] },
  sng4:        { bakken: [20.6, 17, 17, 20.6], neus: 'plat', kleur: '#ffc917', gel: true, pant: [1] },
  flirt4:      { bakken: [20.8, 16.6, 16.6, 20.8], neus: 'spits', kleur: '#1d9fd1', gel: true, pant: [1] },
  gtw:         { bakken: [17.5, 5.5, 17.5], neus: 'spits', kleur: '#1d9fd1', gel: true },
  wink:        { bakken: [22, 11, 22], neus: 'spits', kleur: '#1d9fd1', gel: true },
  lint41:      { bakken: [20.8, 20.8], neus: 'spits', kleur: '#1d9fd1', gel: true },
  buffel:      { bakken: [26.1, 26.1], neus: 'plat', kleur: '#ffc917' },
  ice3:        { bakken: [25.8, 24.8, 24.8, 24.8, 24.8, 24.8, 24.8, 25.8], neus: 'spits', kleur: '#f2f2f2', pant: [1, 6] },
  // losse locs en rijtuigen (één bak); een samenstelling plakt ze achter elkaar
  stoomloc3700:{ bakken: [11.5, 8], neus: 'stoom', kleur: '#2b2b2b', loc: 2 },
  loc1000:     { bakken: [16.2], neus: 'loc', kleur: '#2f5d8a', loc: 1, pant: [0] },
  loc1100:     { bakken: [14.1], neus: 'loc', kleur: '#2f5d8a', loc: 1, pant: [0] },
  loc1200:     { bakken: [18.1], neus: 'loc', kleur: '#2f5d8a', loc: 1, pant: [0] },
  loc1300:     { bakken: [18.9], neus: 'loc', kleur: '#2f5d8a', loc: 1, pant: [0] },
  loc2200:     { bakken: [14.1], neus: 'loc', kleur: '#ffc917', loc: 1 },
  loc1600:     { bakken: [17.5], neus: 'loc', kleur: '#ffc917', loc: 1, pant: [0] },
  loc1700:     { bakken: [17.6], neus: 'loc', kleur: '#ffc917', loc: 1, pant: [0] },
  loc186:      { bakken: [18.9], neus: 'loc', kleur: '#ffc917', loc: 1, pant: [0] },
  loc193:      { bakken: [18.9], neus: 'loc', kleur: '#c9cdd1', loc: 1, pant: [0] },
  coupe:       { bakken: [14], neus: 'plat', kleur: '#6b3a2a' },
  staalrijtuig:{ bakken: [21], neus: 'plat', kleur: '#6b3a2a' },
  plane:       { bakken: [24.5], neus: 'plat', kleur: '#6b3a2a' },
  planw:       { bakken: [25.2], neus: 'plat', kleur: '#2d4f8a' },
  icr:         { bakken: [26.4], neus: 'plat', kleur: '#ffc917' },
  icrbvk:      { bakken: [26.4], neus: 'koploper', kleur: '#ffc917' },
  ddm1:        { bakken: [26.8], neus: 'plat', kleur: '#ffc917', dd: true },
  ddm1bvk:     { bakken: [26.8], neus: 'rond', kleur: '#ffc917', dd: true },
  viaggio:     { bakken: [26.5], neus: 'plat', kleur: '#c9cdd1' },
  viaggiobvk:  { bakken: [26.5], neus: 'spits', kleur: '#c9cdd1' },
  gvbm1:       { bakken: [18.7, 18.7, 18.7, 18.7], neus: 'plat', kleur: '#c7ccd1', gel: true },
  gvbm5:       { bakken: [19.4, 19.4, 19.4, 19.4, 19.4, 19.4], neus: 'rond', kleur: '#c7ccd1' },
  gvbm7:       { bakken: [19.4, 19.4, 19.4, 19.4, 19.4, 19.4], neus: 'rond', kleur: '#c7ccd1' },
  retmg2:      { bakken: [14.9, 14.9, 14.9, 14.9], neus: 'plat', kleur: '#c9d1d6', gel: true },
  retrsg3:     { bakken: [14, 14, 14], neus: 'rond', kleur: '#c9d1d6', gel: true },
  regiocitadis:{ bakken: [12, 6, 12], neus: 'rond', kleur: '#2e8b57', gel: true, smal: true },
  urbos100:    { bakken: [8, 5, 6, 5, 8], neus: 'rond', kleur: '#d4dee6', gel: true, smal: true },
  sigsneltram: { bakken: [15, 15], neus: 'plat', kleur: '#d4dee6', gel: true, smal: true },
  paardentram: { bakken: [3, 7], neus: 'paard', kleur: '#6b4423', smal: true },
  stoomtram:   { bakken: [6, 9, 9, 9], neus: 'stoom', kleur: '#4a3326', loc: 1, smal: true },
  tweeasser:   { bakken: [10.5], neus: 'rond', kleur: '#e9d6a6', smal: true, pant: [0] },
  pcc:         { bakken: [14.3], neus: 'rond', kleur: '#e9d6a6', smal: true, pant: [0] },
  gvb9g:       { bakken: [10, 10], neus: 'rond', kleur: '#ffffff', smal: true, gel: true, pant: [0] },
  gtl8:        { bakken: [9.5, 9.5, 9.5], neus: 'plat', kleur: '#e9d6a6', smal: true, gel: true, pant: [1] },
  combino:     { bakken: [7, 5, 5, 5, 7], neus: 'plat', kleur: '#ffffff', smal: true, gel: true, pant: [2] },
  citadis302:  { bakken: [8, 4, 6, 4, 8], neus: 'rond', kleur: '#e8e9ea', smal: true, gel: true, pant: [2] },
  urbos15g:    { bakken: [8, 4.5, 5, 4.5, 8], neus: 'rond', kleur: '#ffffff', smal: true, gel: true, pant: [2] },
  tina:        { bakken: [8, 5, 5, 5, 5, 8], neus: 'rond', kleur: '#e30613', smal: true, gel: true, pant: [2] },
  citeagelede: { bakken: [11, 7], neus: 'bus', kleur: '#ffffff', gel: true, bus: true },
  trolley:     { bakken: [11, 7.5], neus: 'bus', kleur: '#ffffff', gel: true, bus: true },
  hovelektrisch:{ bakken: [14.5], neus: 'bus', kleur: '#ffffff', bus: true },
  futura:      { bakken: [13], neus: 'bus', kleur: '#ffffff', bus: true },
  omnibus:     { bakken: [3, 4.5], neus: 'paard', kleur: '#6b4423', bus: true },
  buurtbus:    { bakken: [7], neus: 'bus', kleur: '#ffffff', bus: true, breed: 2 },
  taxibus:     { bakken: [5.5], neus: 'bus', kleur: '#ffffff', bus: true, breed: 2 },
  pontje:      { bakken: [14], neus: 'boot', kleur: '#e0e4e6', breed: 6 },
  ijveer:      { bakken: [41], neus: 'boot', kleur: '#f2f2f2', breed: 13 },
  aqualiner:   { bakken: [31], neus: 'boot', kleur: '#ffffff', breed: 9 },
  autoveer:    { bakken: [115], neus: 'boot', kleur: '#ffffff', breed: 19 },
  sneldienst:  { bakken: [52], neus: 'boot', kleur: '#ffffff', breed: 14 },
  stoomveer:   { bakken: [45], neus: 'boot', kleur: '#2b2b2b', breed: 9 },
  watertaxi:   { bakken: [10], neus: 'boot', kleur: '#f5c400', breed: 3 },
  watertaxie:  { bakken: [10], neus: 'boot', kleur: '#f5c400', breed: 3 },
};
const STANDAARD = {
  trein: { bakken: [26, 26, 26], neus: 'plat', kleur: '#ffc917' }, metro: { bakken: [19, 19, 19, 19], neus: 'rond', kleur: '#c7ccd1' },
  sneltram: { bakken: [10, 10, 10], neus: 'rond', kleur: '#d4dee6', gel: true, smal: true }, tram: { bakken: [9, 9, 9], neus: 'rond', kleur: '#ffffff', gel: true, smal: true },
  bus: { bakken: [12], neus: 'bus', kleur: '#ffffff', bus: true }, hov: { bakken: [13], neus: 'bus', kleur: '#ffffff', bus: true },
  belbus: { bakken: [5.5], neus: 'bus', kleur: '#ffffff', bus: true, breed: 2 }, veer: { bakken: [35], neus: 'boot', kleur: '#ffffff', breed: 10 },
  watertaxi: { bakken: [10], neus: 'boot', kleur: '#f5c400', breed: 3 }, vlucht: { bakken: [30], neus: 'vlieg', kleur: '#ffffff', breed: 28 },
};
const NS_TYPEN = { ic: ['icm', 'virm6', 'ddz', 'icng5', 'virm6', 'icm', 'ddr', 'hondekop'], spr: ['slt6', 'sng4', 'slt6', 'sgm', 'sng4', 'planv'] };

function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

// type voor een lijn kiezen (AI-lijnen uit de dienstregeling hebben geen type: kies iets passends)
export function typeVoor(lijn, jaar, standaardType) {
  if (lijn.typeId) return lijn.typeId;
  if (lijn._typ) return lijn._typ;
  if (lijn._trolley && jaar >= 2001) return (lijn._typ = 'trolley');
  let id;
  const n = `${lijn.nr || ''} ${lijn.naam || ''}`.toLowerCase();
  const ns = lijn.modus === 'trein' && /^ns\b|nederlandse spoorwegen/i.test(lijn.vervoerderNaam || '');
  const lijst = ns ? (/sprinter|stoptrein/.test(n) ? NS_TYPEN.spr : NS_TYPEN.ic).filter(t => TYPE[t] && TYPE[t].van <= jaar && TYPE[t].tot > jaar) : [];
  if (lijst.length) id = lijst[hash(lijn.lijnId || lijn.sleutel || lijn.id) % lijst.length];
  else id = standaardType(lijn.vervoerderNaam || '', lijn.modus, jaar)?.id;
  if (lijn.modus === 'bus' && /\b(3\d\d|1\d\d)\b/.test(n) && hash(lijn.sleutel) % 3 === 0) id = 'citeagelede';
  lijn._typ = id;
  return id;
}

// bakken (wagons) van een type zonder locs: [{lengte, loc}] — voor de indeling per wagon
export function bakkenVan(typeId, modus) {
  const u = uiterlijk(typeId, modus);
  return u.bakken.map((L, i) => ({ lengte: L, loc: !!(u.loc && i < u.loc) }));
}
export function uiterlijk(typeId, modus) {
  const t = TYPE[typeId];
  if (t?.samen && !U[typeId]) { // samenstelling: de delen achter elkaar
    const delen = t.samen.map(c => uiterlijk(c, modus)), eerste = delen[0];
    U[typeId] = { bakken: delen.flatMap(d => d.bakken), neus: eerste.neus, kleur: (delen.find(d => !d.loc) || eerste).kleur, loc: eerste.loc || 0,
      dd: delen.some(d => d.dd), pant: eerste.pant || [] };
  }
  const u = U[typeId] || U[t?.basis] || STANDAARD[modus] || STANDAARD.bus; // een serie ziet eruit als zijn basistype
  if (!u._l) {
    const tussen = u.gel ? 0.3 : 0.9;
    u._l = u.bakken.reduce((a, b) => a + b, 0) + tussen * (u.bakken.length - 1);
    u._tussen = tussen;
    u._b = u.breed || (u.bus ? 2.55 : u.smal ? 2.4 : 2.9);
  }
  return u;
}
export const lengteVan = (typeId, modus) => uiterlijk(typeId, modus)._l;

// schematische lengte in pixels (uitgezoomd): iets langer voor langere voertuigen
export const schemaLengte = L => 5 + 11 * Math.sqrt(Math.min(220, L) / 160);

const DAK = '#a3a6a9', DAK_DD = '#b8babc', RAAM = '#1d2a33';

// één voertuig ware grootte tekenen. v = {lijn, s (m langs route), r (0 heen / 1 terug)}
export function tekenEcht(ctx, k, v, u, kleur, eigen) {
  const lijn = v.baan || v.lijn, totaal = lijn.cum[lijn.cum.length - 1]; // rijbaan per richting: altijd vooruit
  const richting = v.r && !v.baan ? -1 : 1;
  // de dienstregeling geeft de plek van de halte: de trein staat met zijn midden bij het perron
  const kopS = Math.max(0, Math.min(totaal, v.s + richting * (u.neus === 'boot' || u.neus === 'vlieg' ? 0 : u._l / 2)));
  const pm = 1 / k.res;                 // pixels per meter
  const W = u._b * pm;
  let off = 0;
  for (let i = 0; i < u.bakken.length; i++) {
    const L = u.bakken[i];
    const sv = Math.max(0, Math.min(totaal, kopS - richting * off)), sa = Math.max(0, Math.min(totaal, kopS - richting * (off + L)));
    off += L + u._tussen;
    const [ax, ay] = puntOp(lijn, sv), [bx, by] = puntOp(lijn, sa);
    const [pax, pay] = k.scherm(ax, ay), [pbx, pby] = k.scherm(bx, by);
    let lp = Math.hypot(pax - pbx, pay - pby);
    if (lp < 0.5) { if (sv === sa) continue; lp = L * pm; }
    const hoek = Math.atan2(pay - pby, pax - pbx);
    ctx.save();
    ctx.translate((pax + pbx) / 2, (pay + pby) / 2); ctx.rotate(hoek);
    const eerste = i === 0, laatste = i === u.bakken.length - 1;
    bak(ctx, lp, W, pm, u, i, eerste, laatste, kleur, eigen);
    ctx.restore();
  }
}

// één bak in lokale coördinaten: x van -L/2 (achter) tot +L/2 (voor)
function bak(ctx, L, W, pm, u, i, eerste, laatste, kleur, eigen) {
  const h = W / 2, x0 = -L / 2, x1 = L / 2;
  const neus = u.neus;
  const isLoc = u.loc && i < u.loc;
    ctx.lineJoin = 'round';
  if (neus === 'boot') return boot(ctx, L, W, kleur, eigen);
  if (neus === 'vlieg') return vlieg(ctx, L, W, kleur, eigen);
  if (neus === 'paard' && eerste) { ctx.fillStyle = '#7a5230'; ctx.beginPath(); ctx.ellipse(0, 0, L / 2, h * 0.5, 0, 0, 7); ctx.fill(); return; }
  if (neus === 'stoom' && isLoc) return stoomloc(ctx, L, W, i);

  // romp
  const pad = new Path2D();
  const vorm = (voorKop, achterKop) => {
    const t = s => s * pm;
    const neusVoor = voorKop ? kopMaat(u.neus, t) : null, neusAchter = achterKop ? kopMaat(u.neus, t) : null;
    const r = Math.min(h, (u.bus ? 0.25 : 0.35) * pm);
    if (neusVoor) {
      pad.moveTo(x1 - neusVoor.d, -h);
      pad.bezierCurveTo(x1 - neusVoor.d * 0.35, -h, x1, -h * neusVoor.w, x1, 0);
      pad.bezierCurveTo(x1, h * neusVoor.w, x1 - neusVoor.d * 0.35, h, x1 - neusVoor.d, h);
    } else { pad.moveTo(x1 - r, -h); pad.quadraticCurveTo(x1, -h, x1, -h + r); pad.lineTo(x1, h - r); pad.quadraticCurveTo(x1, h, x1 - r, h); }
    if (neusAchter) {
      pad.lineTo(x0 + neusAchter.d, h);
      pad.bezierCurveTo(x0 + neusAchter.d * 0.35, h, x0, h * neusAchter.w, x0, 0);
      pad.bezierCurveTo(x0, -h * neusAchter.w, x0 + neusAchter.d * 0.35, -h, x0 + neusAchter.d, -h);
    } else { pad.lineTo(x0 + r, h); pad.quadraticCurveTo(x0, h, x0, h - r); pad.lineTo(x0, -h + r); pad.quadraticCurveTo(x0, -h, x0 + r, -h); }
    pad.closePath();
  };
  const voorKop = eerste, achterKop = laatste && !u.bus && neus !== 'stoom' && neus !== 'paard';
  vorm(voorKop, achterKop);
  // zijkant in huiskleur, dak grijs daarbinnen
  ctx.fillStyle = isLoc ? (neus === 'loc' ? '#ffc917' : kleur) : kleur;
  ctx.fill(pad);
  ctx.save(); ctx.clip(pad);
  const zij = Math.max(0.6, 0.45 * pm);
  ctx.fillStyle = u.bus ? '#e9ecee' : isLoc ? '#5f6366' : u.dd ? DAK_DD : DAK;
  ctx.fillRect(x0 + (achterKop ? 2.2 * pm : 0.25 * pm), -h + zij, L - (voorKop ? 2.2 * pm : 0.25 * pm) - (achterKop ? 2.2 * pm : 0.25 * pm), W - 2 * zij);
  if (pm > 1.2) {
    if (u.dd) { // dubbeldekker: twee lange dakbanen
      ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(x0 + 2.5 * pm, -0.9 * pm, L - 5 * pm, 0.25 * pm); ctx.fillRect(x0 + 2.5 * pm, 0.65 * pm, L - 5 * pm, 0.25 * pm);
    }
    // dakapparatuur (airco) en stroomafnemer
    ctx.fillStyle = u.bus ? '#c9cdd0' : '#8a8d90';
    if (u.bus) ctx.fillRect(-1.6 * pm, -0.8 * pm, 3.2 * pm, 1.6 * pm);
    else if (L > 8 * pm) { ctx.fillRect(-L * 0.18, -0.6 * pm, 1.6 * pm, 1.2 * pm); ctx.fillRect(L * 0.18 - 1.6 * pm, -0.6 * pm, 1.6 * pm, 1.2 * pm); }
    if (u.pant?.includes(i) || (isLoc && neus === 'loc')) {
      ctx.strokeStyle = '#2b2f33'; ctx.lineWidth = Math.max(0.6, 0.12 * pm);
      ctx.beginPath(); ctx.moveTo(-0.9 * pm, 0); ctx.lineTo(0, -0.8 * pm); ctx.lineTo(0.9 * pm, 0); ctx.lineTo(0, 0.8 * pm); ctx.closePath(); ctx.stroke();
    }
  }
  // kopstuk: neus in huiskleur met voorruit
  const kopTekenen = (aan, teken) => {
    if (!aan) return;
    const m = kopMaat(u.neus, s => s * pm);
    ctx.fillStyle = kleur; ctx.fillRect(teken > 0 ? x1 - m.d - 2.2 * pm : x0, -h, m.d + 2.2 * pm, W);
    ctx.fillStyle = RAAM;
    const raamX = m.raam * pm, raamB = Math.max(1, 0.7 * pm);
    ctx.fillRect(teken > 0 ? x1 - raamX - raamB : x0 + raamX, -h * 0.82, raamB, h * 1.64);
  };
  if (!isLoc || neus === 'loc') { kopTekenen(voorKop, 1); kopTekenen(achterKop, -1); }
  if (u.bus) { ctx.fillStyle = RAAM; ctx.fillRect(x1 - 0.5 * pm, -h * 0.85, 0.45 * pm, h * 1.7); }
  ctx.restore();
  ctx.strokeStyle = eigen ? '#ffffff' : 'rgba(0,0,0,.6)';
  ctx.lineWidth = eigen ? Math.max(1.2, 0.25 * pm) : Math.max(0.5, 0.08 * pm);
  ctx.stroke(pad);
}

// d = lengte van het taps toelopende kopstuk, w = breedte aan de punt (fractie), raam = afstand voorruit tot punt
function kopMaat(neus, t) {
  switch (neus) {
    case 'koploper': return { d: t(4.2), w: 0.34, raam: 4.6 };   // ICM: lange neus, hoge cabine erachter
    case 'hondekop': return { d: t(3.0), w: 0.5, raam: 3.2 };
    case 'spits': return { d: t(4.2), w: 0.22, raam: 3.4 };
    case 'hoekig': return { d: t(1.2), w: 0.8, raam: 1.9 };
    case 'rond': return { d: t(1.8), w: 0.62, raam: 1.6 };
    case 'loc': return { d: t(0.6), w: 0.9, raam: 1.2 };
    default: return { d: t(0.5), w: 0.92, raam: 0.9 };            // plat (SLT, SNG, SGM)
  }
}

function stoomloc(ctx, L, W, i) {
  const h = W / 2;
  ctx.fillStyle = '#1e1e1e'; ctx.fillRect(-L / 2, -h * 0.9, L, W * 0.9);
  if (i === 0) { ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.ellipse(L * 0.1, 0, L * 0.38, h * 0.55, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.38, 0, h * 0.28, 0, 7); ctx.fill(); }
  else { ctx.fillStyle = '#2d2a26'; ctx.fillRect(-L / 2 + 1, -h * 0.6, L - 2, h * 1.2); }
}
function boot(ctx, L, W, kleur, eigen) {
  const h = W / 2;
  ctx.beginPath(); ctx.moveTo(L / 2, 0); ctx.quadraticCurveTo(L * 0.3, -h, L * 0.05, -h); ctx.lineTo(-L / 2, -h * 0.9); ctx.lineTo(-L / 2, h * 0.9); ctx.lineTo(L * 0.05, h); ctx.quadraticCurveTo(L * 0.3, h, L / 2, 0); ctx.closePath();
  ctx.fillStyle = kleur; ctx.fill(); ctx.strokeStyle = eigen ? '#fff' : 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#d7dbde'; ctx.fillRect(-L * 0.25, -h * 0.55, L * 0.4, h * 1.1);
}
function vlieg(ctx, L, W, kleur, eigen) {
  const h = W / 2, r = L * 0.06;
  ctx.fillStyle = kleur; ctx.strokeStyle = eigen ? '#fff' : 'rgba(0,0,0,.5)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 0, L / 2, r, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(L * 0.08, -r); ctx.lineTo(-L * 0.1, -h); ctx.lineTo(-L * 0.18, -h); ctx.lineTo(-L * 0.06, -r); ctx.moveTo(L * 0.08, r); ctx.lineTo(-L * 0.1, h); ctx.lineTo(-L * 0.18, h); ctx.lineTo(-L * 0.06, r); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-L * 0.38, 0); ctx.lineTo(-L * 0.47, -h * 0.35); ctx.lineTo(-L * 0.5, -h * 0.35); ctx.lineTo(-L * 0.46, 0); ctx.lineTo(-L * 0.5, h * 0.35); ctx.lineTo(-L * 0.47, h * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
}

// huiskleur per vervoerder (als de dienstregeling geen bruikbare kleur meegeeft)
const HUIS = [[/^ns\b|nederlandse spoorwegen/i, '#ffc917'], [/arriva/i, '#00a5b5'], [/keolis|blauwnet/i, '#1f4e9c'], [/qbuzz/i, '#e2001a'],
  [/connexxion|transdev/i, '#e6007e'], [/ebs/i, '#e2001a'], [/gvb/i, '#ffffff'], [/ret\b/i, '#e30613'], [/htm/i, '#c8102e'], [/u-?ov/i, '#d40f14'],
  [/syntus/i, '#e74e0f'], [/hermes/i, '#e6007e'], [/breng/i, '#e6007e']];
export function huiskleur(lijn, u) {
  const n = lijn.vervoerderNaam || '';
  for (const [re, k] of HUIS) if (re.test(n)) return (u.kleur === '#ffc917' || u.bus || lijn.modus === 'trein') ? k : u.kleur;
  return lijn.kleur && lijn.kleur.length === 7 && !/^#(fff|000)/i.test(lijn.kleur) ? lijn.kleur : u.kleur;
}
