// Zijaanzicht-schetsen van voertuigen (SVG) voor het samenstellen, en de aandrijving per voertuig:
// paarden, stoom, diesel of elektrisch, en bij elektrisch de spanningen met de landen waar het kan rijden.
// De kop van de trein staat links.
import { TYPE } from './vloot.js';
import { uiterlijk } from './voertuig.js';
import { spanningenVan } from './stroom.js';

const RAAM = '#1d2a33', WIEL = '#2b2b2b';
const r1 = v => Math.round(v * 10) / 10;
function donker(hex, f = 0.72) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return '#555';
  const n = parseInt(m[1], 16), c = s => Math.round(((n >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
const isLicht = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return false; const n = parseInt(m[1], 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 200; };

// één onderdeel (treinstel, loc, rijtuig, stuurstand, bus ...) als lijst bakken met tekeninformatie
function onderdeel(id, modus) {
  const t = TYPE[id], u = uiterlijk(id, modus), soort = t?.soort || TYPE[t?.basis]?.soort || '';
  const energie = t?.energie || TYPE[t?.basis]?.energie || '';
  // cabines: treinstel aan beide kanten, loc beide, stuurstand rechts (achteraan de trein), rijtuig geen
  const kopL = !soort || soort === 'loc', kopR = !soort || soort === 'loc' || soort === 'stuurstand';
  return u.bakken.map((L, i) => ({ L, u, i, n: u.bakken.length, soort, energie, kopL: kopL && i === 0, kopR: kopR && i === u.bakken.length - 1,
    loc: (u.loc && i < u.loc) || soort === 'loc' }));
}

// voorkant-profiel: hoe ver de bovenkant terugwijkt (m) en hoe hoog de knik zit (fractie van de hoogte)
const PROFIEL = { spits: [3.6, 0.62], rond: [1.6, 0.45], koploper: [3.8, 0.55], hondekop: [2.6, 0.55], hoekig: [1.0, 0.35], plat: [0.35, 0.2], loc: [0.5, 0.25] };

function bakSvg(b, x, w, s, vs, gelNaast) {
  const u = b.u, kleur = u.kleur || '#ffc917', grond = 62;
  if (u.neus === 'paard' && b.i === 0) return paard(x, w, grond);
  if (u.neus === 'stoom' && b.loc) return b.i === 0 ? stoomketel(x, w, grond) : tender(x, w, grond);
  if (u.neus === 'boot') return boot(x, w, kleur);
  if (u.neus === 'vlieg') return vliegtuig(x, w, kleur);
  const bus = !!u.bus, hm = bus ? 2.9 : u.dd ? 4.1 : b.loc ? 3.3 : u.smal ? 2.8 : 3.1;
  const vloer = bus ? grond - 5 : grond - 6, top = vloer - hm * vs, h = vloer - top;
  const [dl, kn] = b.kopL ? PROFIEL[bus ? 'plat' : u.neus] || PROFIEL.plat : [0, 0], [dr, kr] = b.kopR ? PROFIEL[bus ? 'plat' : u.neus] || PROFIEL.plat : [0, 0];
  const ml = Math.min(w * 0.3, dl * s), mr = Math.min(w * 0.3, dr * s), x1 = x + w;
  // romp met afgeronde kop(pen)
  const pad = `M${r1(x + ml)},${r1(top)} L${r1(x1 - mr)},${r1(top)} ` +
    (mr > 1 ? `Q${r1(x1)},${r1(top)} ${r1(x1)},${r1(top + h * kr)} ` : `L${r1(x1)},${r1(top)} `) + `L${r1(x1)},${r1(vloer)} L${r1(x)},${r1(vloer)} ` +
    (ml > 1 ? `L${r1(x)},${r1(top + h * kn)} Q${r1(x)},${r1(top)} ${r1(x + ml)},${r1(top)} Z` : `L${r1(x)},${r1(top)} Z`);
  let o = `<path d="${pad}" fill="${kleur}" stroke="#333" stroke-width="0.8"/>`;
  // band onderaan in een donkerder tint (en een sierlijn bij lichte treinen)
  o += `<rect x="${r1(x + 0.6)}" y="${r1(vloer - h * 0.17)}" width="${r1(w - 1.2)}" height="${r1(h * 0.17 - 0.5)}" fill="${donker(kleur, isLicht(kleur) ? 0.55 : 0.75)}" opacity="0.8"/>`;
  // ramen
  const vrijL = x + ml + (b.kopL ? 3 : 2), vrijR = x1 - mr - (b.kopR ? 3 : 2);
  const rijen = b.loc ? [] : u.dd ? [[0.14, 0.24], [0.52, 0.22]] : bus ? [[0.12, 0.42]] : [[0.18, 0.3]];
  const deuren = b.loc || bus ? [] : u.gel || w / s < 18 ? [0.5] : [0.2, 0.8];
  const deurB = Math.max(3, 1.3 * s), deurX = deuren.map(f => x + w * f - deurB / 2);
  const rw = Math.max(2.4, 1.5 * s), stap = Math.max(rw + 1.4, 2.3 * s);
  for (const [f, hf] of rijen) for (let rx = vrijL; rx + rw <= vrijR; rx += stap) {
    if (deurX.some(dx => rx + rw > dx - 1 && rx < dx + deurB + 1)) continue;
    o += `<rect x="${r1(rx)}" y="${r1(top + h * f)}" width="${r1(rw)}" height="${r1(h * hf)}" rx="0.6" fill="${RAAM}"/>`;
  }
  for (const dx of deurX) o += `<rect x="${r1(dx)}" y="${r1(top + h * (u.dd ? 0.5 : 0.16))}" width="${r1(deurB)}" height="${r1(vloer - top - h * (u.dd ? 0.5 : 0.16) - 0.6)}" fill="${donker(kleur, 0.85)}" stroke="#333" stroke-width="0.5"/>` +
    `<rect x="${r1(dx + deurB * 0.2)}" y="${r1(top + h * (u.dd ? 0.55 : 0.22))}" width="${r1(deurB * 0.6)}" height="${r1(h * 0.22)}" fill="${RAAM}"/>`;
  // cabineramen (voorruit) aan de kop(pen)
  const ruit = (links, m) => { const bx = links ? x + Math.max(0.8, m * 0.25) : x1 - Math.max(0.8, m * 0.25) - Math.max(3, 1.6 * s);
    return `<rect x="${r1(bx)}" y="${r1(top + h * 0.12)}" width="${r1(Math.max(3, 1.6 * s))}" height="${r1(h * 0.3)}" rx="1" fill="${RAAM}"/>`; };
  if (b.kopL) o += ruit(true, ml);
  if (b.kopR) o += ruit(false, mr);
  if (b.loc && !b.kopL && !b.kopR) o += ruit(true, 0) + ruit(false, 0);
  // roosters op een loc
  if (b.loc) for (let k = 0; k < 3; k++) o += `<rect x="${r1(x + w * (0.3 + k * 0.15))}" y="${r1(top + h * 0.2)}" width="${r1(w * 0.1)}" height="${r1(h * 0.35)}" fill="none" stroke="${donker(kleur, 0.5)}" stroke-width="0.6"/>`;
  // dak: stroomafnemer of uitlaat
  const elek = ['elektrisch', 'bovenleiding'].includes(b.energie);
  if (elek && (u.pant?.includes(b.i) || (b.loc && b.i === 0))) {
    const cx = x + w * (b.loc ? 0.3 : 0.5);
    o += `<path d="M${r1(cx - 5)},${r1(top)} L${r1(cx + 2)},${r1(top - 5)} L${r1(cx - 3)},${r1(top - 9)} M${r1(cx - 7)},${r1(top - 9)} L${r1(cx + 3)},${r1(top - 9)}" fill="none" stroke="#333" stroke-width="0.9"/>`;
  } else if (!elek && b.energie !== '-' && !bus && (b.loc || b.i === 0)) o += `<rect x="${r1(x + w * 0.4)}" y="${r1(top - 3)}" width="2.5" height="3" fill="#444"/>`;
  // wielen
  if (bus) for (const f of [0.18, 0.78]) o += `<circle cx="${r1(x + w * f)}" cy="${grond - 3.5}" r="3.5" fill="${WIEL}"/><circle cx="${r1(x + w * f)}" cy="${grond - 3.5}" r="1.3" fill="#999"/>`;
  else {
    const draai = f => { const cx = x + w * f, a = Math.max(2.5, 1.2 * s); return `<rect x="${r1(cx - a - 2)}" y="${grond - 6.5}" width="${r1(2 * a + 4)}" height="2" fill="#444"/><circle cx="${r1(cx - a)}" cy="${grond - 2.4}" r="2.4" fill="${WIEL}"/><circle cx="${r1(cx + a)}" cy="${grond - 2.4}" r="2.4" fill="${WIEL}"/>`; };
    if (u.gel) { if (!gelNaast.links) o += draai(0.12); o += draai(gelNaast.rechts ? 1 : 0.88); }
    else o += draai(0.16) + draai(0.84);
  }
  return o;
}

function paard(x, w, g) {
  const cx = x + w * 0.5, y = g - 16, sx = w / 22;
  return `<g fill="#7a5230" stroke="#4a3018" stroke-width="0.6"><ellipse cx="${r1(cx)}" cy="${y}" rx="${r1(8 * sx)}" ry="4.5"/>
    <path d="M${r1(cx - 6 * sx)},${y - 2} L${r1(cx - 10 * sx)},${y - 10} L${r1(cx - 13 * sx)},${y - 8} L${r1(cx - 9 * sx)},${y + 1} Z"/>
    ${[-5, -3, 3, 5].map(d => `<rect x="${r1(cx + d * sx)}" y="${y + 3}" width="1.6" height="${g - y - 3}"/>`).join('')}
    <path d="M${r1(cx + 8 * sx)},${y - 1} q4,2 3,8" fill="none"/></g>`;
}
function stoomketel(x, w, g) {
  const y0 = g - 30;
  return `<g stroke="#111" stroke-width="0.6"><rect x="${r1(x + 2)}" y="${g - 23}" width="${r1(w * 0.68)}" height="13" rx="6" fill="#262626"/>
    <rect x="${r1(x + 5)}" y="${g - 31}" width="4" height="9" fill="#1a1a1a"/><rect x="${r1(x + 3.5)}" y="${g - 32}" width="7" height="2" fill="#1a1a1a"/>
    <ellipse cx="${r1(x + w * 0.38)}" cy="${g - 23}" rx="3.5" ry="2.5" fill="#8a6b2a"/>
    <rect x="${r1(x + w * 0.7)}" y="${y0}" width="${r1(w * 0.3 - 1)}" height="24" fill="#2b2b2b"/><rect x="${r1(x + w * 0.74)}" y="${y0 + 4}" width="${r1(w * 0.18)}" height="7" fill="#c9b27a"/>
    <rect x="${r1(x)}" y="${g - 10}" width="${r1(w)}" height="3" fill="#7a1f1f"/>
    ${[0.25, 0.47, 0.69].map(f => `<circle cx="${r1(x + w * f)}" cy="${g - 5}" r="5" fill="#7a1f1f"/><circle cx="${r1(x + w * f)}" cy="${g - 5}" r="1.5" fill="#222"/>`).join('')}
    <line x1="${r1(x + w * 0.25)}" y1="${g - 5}" x2="${r1(x + w * 0.69)}" y2="${g - 5}" stroke="#bbb" stroke-width="1.2"/>
    <circle cx="${r1(x + w * 0.9)}" cy="${g - 3}" r="3" fill="${WIEL}"/></g>`;
}
function tender(x, w, g) {
  return `<g stroke="#111" stroke-width="0.6"><rect x="${r1(x)}" y="${g - 22}" width="${r1(w)}" height="15" fill="#262626"/><rect x="${r1(x + 1)}" y="${g - 24}" width="${r1(w - 2)}" height="3" fill="#111"/>
    ${[0.2, 0.5, 0.8].map(f => `<circle cx="${r1(x + w * f)}" cy="${g - 3}" r="3" fill="${WIEL}"/>`).join('')}</g>`;
}
function boot(x, w, kleur) {
  return `<path d="M${r1(x)},44 L${r1(x + w)},44 L${r1(x + w * 0.92)},58 L${r1(x + w * 0.06)},58 Z" fill="${kleur}" stroke="#333"/>
    <rect x="${r1(x + w * 0.25)}" y="32" width="${r1(w * 0.45)}" height="12" fill="#f4f4f4" stroke="#333"/>
    ${Array.from({ length: Math.max(2, Math.floor(w * 0.45 / 8)) }, (_, k) => `<rect x="${r1(x + w * 0.27 + k * 8)}" y="35" width="5" height="4" fill="${RAAM}"/>`).join('')}
    <path d="M0,61 q8,-3 16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0 t16,0" fill="none" stroke="#5b9bd5"/>`;
}
function vliegtuig(x, w, kleur) {
  return `<path d="M${r1(x)},42 Q${r1(x)},34 ${r1(x + 10)},34 L${r1(x + w - 18)},34 L${r1(x + w - 4)},18 L${r1(x + w)},18 L${r1(x + w - 4)},38 Q${r1(x + w - 10)},46 ${r1(x + w - 30)},46 L${r1(x + 8)},46 Q${r1(x)},46 ${r1(x)},42 Z" fill="${kleur}" stroke="#333"/>
    <path d="M${r1(x + w * 0.4)},42 L${r1(x + w * 0.62)},52 L${r1(x + w * 0.68)},52 L${r1(x + w * 0.56)},42 Z" fill="${donker(kleur, 0.8)}" stroke="#333"/>
    ${Array.from({ length: Math.floor((w - 40) / 5) }, (_, k) => `<rect x="${r1(x + 14 + k * 5)}" y="37" width="2.5" height="3" fill="${RAAM}"/>`).join('')}`;
}

// SVG van een lijst onderdelen (ids), kop links; lange treinen worden ingekort (begin ... eind)
export function schets(ids, modus, { breed = 230, hoog = 70 } = {}) {
  ids = (Array.isArray(ids) ? ids : [ids]).filter(id => TYPE[id]);
  if (!ids.length) return `<svg viewBox="0 0 ${breed} ${hoog}" width="100%" height="${hoog}"><line x1="0" y1="64" x2="${breed}" y2="64" stroke="#999"/><text x="${breed / 2}" y="40" text-anchor="middle" font-size="11" fill="#888">kies een voertuig</text></svg>`;
  let bakken = ids.flatMap(id => onderdeel(id, modus));
  let weg = 0;
  if (bakken.length > 7) { weg = bakken.length - 5; bakken = [...bakken.slice(0, 4), null, bakken[bakken.length - 1]]; }
  const tussen = b => b?.u.gel ? 0.6 : 2.2, gat = 22;
  const Ltot = bakken.reduce((a, b) => a + (b ? b.L : 0), 0), vast = bakken.reduce((a, b, k) => a + (k ? (b ? tussen(b) : gat) : 0), 0);
  const s = Math.min(7, (breed - 8 - vast) / Ltot), vs = 8;
  let x = 4 + Math.max(0, (breed - 8 - vast - Ltot * s) / 2), o = '';
  bakken.forEach((b, k) => {
    if (!b) { o += `<text x="${r1(x + gat / 2)}" y="44" text-anchor="middle" font-size="10" fill="#555">⋯</text><text x="${r1(x + gat / 2)}" y="56" text-anchor="middle" font-size="8" fill="#555">+${weg}</text>`; x += gat; return; }
    if (k && bakken[k - 1]) { const g = tussen(b); if (!b.u.gel || b.i === 0) o += `<rect x="${r1(x)}" y="52" width="${g}" height="1.5" fill="#333"/>`; x += g; }
    const w = b.L * s, naast = { links: b.u.gel && b.i > 0, rechts: b.u.gel && b.i < b.n - 1 };
    o += bakSvg(b, x, w, s, vs, naast); x += w;
  });
  const water = bakken.some(b => b?.u.neus === 'boot' || b?.u.neus === 'vlieg');
  return `<svg viewBox="0 0 ${breed} ${hoog}" width="100%" height="${hoog}" role="img">${water ? '' : `<line x1="0" y1="62.5" x2="${breed}" y2="62.5" stroke="#777" stroke-width="1.2"/><line x1="0" y1="65" x2="${breed}" y2="65" stroke="#b8a690" stroke-width="2" stroke-dasharray="2 4"/>`}${o}</svg>`;
}

// ---------------------------------------------------------------- aandrijving en landen
const KORT = { '1500DC': '1,5 kV =', '3000DC': '3 kV =', '15kVAC': '15 kV ~', '25kVAC': '25 kV ~', '750DC3': '750 V = (derde rail)', '750DC': '750 V =', '600DC': '600 V =' };
const VLAG = {
  NL: ['h', '#ae1c28', '#fff', '#21468b'], BE: ['v', '#000', '#fdda24', '#ef3340'], LU: ['h', '#ed2939', '#fff', '#00a1de'],
  DE: ['h', '#000', '#dd0000', '#ffce00'], FR: ['v', '#002395', '#fff', '#ed2939'],
};
// net = spanning(en) van het gewone spoor, hsl = hogesnelheidsnet met een andere spanning (in DE is dat ook 15 kV)
export const LANDEN = [
  { c: 'NL', naam: 'Nederland', net: ['1500DC'], hsl: { naam: 'HSL', sys: '25kVAC' } },
  { c: 'BE', naam: 'België', net: ['3000DC'], hsl: { naam: 'HSL', sys: '25kVAC' } },
  { c: 'LU', naam: 'Luxemburg', net: ['25kVAC'] },
  { c: 'DE', naam: 'Duitsland', net: ['15kVAC'] },
  { c: 'FR', naam: 'Frankrijk', net: ['25kVAC', '1500DC'], hsl: { naam: 'TGV', sys: '25kVAC' } },
];
const vlag = (c, aan) => { const [r, a, b, d] = VLAG[c], h = r === 'h';
  return `<svg width="18" height="12" viewBox="0 0 3 2" style="vertical-align:-1px;${aan ? '' : 'filter:grayscale(1);opacity:.35'}"><rect width="3" height="2" fill="${b}"/>` +
    (h ? `<rect width="3" height=".667" fill="${a}"/><rect y="1.333" width="3" height=".667" fill="${d}"/>` : `<rect width="1" height="2" fill="${a}"/><rect x="2" width="1" height="2" fill="${d}"/>`) + `<rect width="3" height="2" fill="none" stroke="#0003" stroke-width=".08"/></svg>`; };

// aandrijving van een voertuig of samenstelling: wat trekt de trein?
function aandrijvers(id) {
  const t = TYPE[id]; if (!t) return [];
  if (t.samen) { const locs = t.samen.filter(c => TYPE[c]?.soort === 'loc'); return [...new Set((locs.length ? locs : t.samen.filter(c => !TYPE[c]?.soort)))]; }
  return [id];
}
const ENERGIE = { paarden: '🐎 Paarden', kolen: '♨ Stoom', diesel: '⛽ Diesel', 'diesel/LNG': '⛽ Diesel/LNG', 'accu-hybride': '🔋 Accu + diesel (hybride)', waterstof: '💧 Waterstof', benzine: '⛽ Benzine', kerosine: '✈ Kerosine', avgas: '✈ Avgas' };

// HTML: aandrijving, en bij elektrisch de spanningen; bij treinen ook de landen (vlag; HSL/TGV groen = geschikt, rood = niet)
export function aandrijving(id, modus) {
  const t = TYPE[id]; if (!t) return '';
  const delen = aandrijvers(id);
  if (!delen.length || delen.every(c => (TYPE[c]?.energie || TYPE[TYPE[c]?.basis]?.energie) === '-')) return '<div class="aandrijving klein"><span class="chip">geen eigen aandrijving</span></div>';
  const sp = spanningenVan(id), soorten = [...new Set(delen.map(c => TYPE[c]?.energie || TYPE[TYPE[c]?.basis]?.energie).filter(e => e && e !== '-'))];
  let o = soorten.filter(e => !['elektrisch', 'bovenleiding'].includes(e)).map(e => `<span class="chip">${ENERGIE[e] || esc(e)}</span>`).join('');
  if (sp) o += `<span class="chip">⚡ Elektrisch: ${sp.map(x => KORT[x] || x).join(' · ')}</span>`;
  else if (soorten.includes('bovenleiding')) o += '<span class="chip">⚡ Trolley (bovenleiding)</span>';
  if (modus === 'trein') {
    const landen = LANDEN.map(l => {
      const kan = !sp || l.net.some(x => sp.includes(x)), deels = sp && kan && !l.net.every(x => sp.includes(x));
      const hsl = sp && l.hsl ? `<b style="color:${sp.includes(l.hsl.sys) ? '#1a8a3a' : '#c62828'};font-size:10px;margin-left:2px">${l.hsl.naam}</b>` : '';
      const uitleg = `${l.naam}: ${!kan ? 'kan hier niet rijden' : deels ? 'alleen op een deel van het net (' + l.net.filter(x => sp.includes(x)).map(x => KORT[x]).join(', ') + ')' : 'kan hier rijden'}${l.hsl && sp ? `; ${l.hsl.naam}-net (${KORT[l.hsl.sys]}) ${sp.includes(l.hsl.sys) ? 'geschikt' : 'niet geschikt'}` : ''}`;
      return `<span class="land" title="${uitleg}">${vlag(l.c, kan)}${deels ? '<sup style="font-size:8px">½</sup>' : ''}${hsl}</span>`;
    }).join('');
    o += `<div class="landen">${landen}</div>`;
  }
  return `<div class="aandrijving klein">${o}</div>`;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
