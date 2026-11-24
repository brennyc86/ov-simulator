// Laadscherm: een drukke getekende OV-scène (trein, tram, metro, bus, veerpont, vliegtuig) met een gebogen banner
// 'OV-Manager', en een balk die volloopt met een schatting van de resterende tijd. Gebruikt bij het laden van de
// gegevens en bij eenmalig rekenwerk aan het begin van een spel (routes op het spoor leggen).
import { schets } from './schets.js';

// een schets-svg (van schets.js) op een plek in de scène zetten
function plaats(svg, x, y, w, h) {
  const eind = svg.indexOf('>');
  const kop = svg.slice(0, eind).replace('width="100%"', `width="${w}"`).replace(/height="[\d.]+"/, `height="${h}"`).replace('<svg ', `<svg x="${x}" y="${y}" preserveAspectRatio="xMidYMax meet" `);
  return kop + svg.slice(eind);
}

export function illustratie() {
  const W = 1200, H = 680;
  const gebouwen = Array.from({ length: 26 }, (_, i) => {
    const x = i * 48 - 10, h = 90 + ((i * 53) % 110), kl = ['#c9b8a6', '#b4a08d', '#d8c3a5', '#a9967f', '#c2ab92'][i % 5];
    const ramen = Array.from({ length: Math.floor(h / 22) }, (_, r) => `<rect x="${x + 8}" y="${330 - h + 10 + r * 22}" width="10" height="12" fill="#f3e7c9" opacity=".8"/><rect x="${x + 24}" y="${330 - h + 10 + r * 22}" width="10" height="12" fill="#f3e7c9" opacity=".8"/>`).join('');
    return `<rect x="${x}" y="${330 - h}" width="44" height="${h}" fill="${kl}"/>${ramen}`;
  }).join('');
  const voertuig = (ids, modus, x, y, w, h) => plaats(schets(ids, modus, { breed: Math.round(w), hoog: 70 }), x, y, w, h);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="OV-Manager">
    <defs>
      <linearGradient id="ls-lucht" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc4ec"/><stop offset="1" stop-color="#d9eef8"/></linearGradient>
      <linearGradient id="ls-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f8fc4"/><stop offset="1" stop-color="#2a6d9e"/></linearGradient>
      <path id="ls-boog" d="M 170 190 Q 600 40 1030 190"/>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#ls-lucht)"/>
    <circle cx="1060" cy="120" r="46" fill="#ffd866" opacity=".9"/>
    <g opacity=".95">${gebouwen}</g>
    <!-- vliegtuig in de lucht -->
    <g transform="translate(820 262) rotate(-8)">${voertuig(['b737'], 'vlucht', 0, 0, 260, 70)}</g>
    <!-- viaduct met intercity en metro -->
    <rect x="0" y="372" width="${W}" height="16" fill="#8a8f96"/>${Array.from({ length: 13 }, (_, i) => `<rect x="${i * 100 + 30}" y="388" width="18" height="60" fill="#9aa0a6"/>`).join('')}
    ${voertuig(['icm'], 'trein', 40, 300, 560, 80)}
    ${voertuig(['gvbm5'], 'metro', 640, 306, 420, 74)}
    <!-- straat met tram en bus -->
    <rect x="0" y="448" width="${W}" height="70" fill="#6b6f75"/><rect x="0" y="480" width="${W}" height="4" fill="#e9e3d0" opacity=".6"/>
    ${voertuig(['combino'], 'tram', 60, 392, 420, 78)}
    ${voertuig(['citaro'], 'bus', 560, 404, 250, 70)}
    ${voertuig(['stoom3700'], 'trein', 860, 402, 300, 66)}
    <!-- water met veerpont -->
    <rect x="0" y="518" width="${W}" height="${H - 518}" fill="url(#ls-water)"/>
    ${Array.from({ length: 18 }, (_, i) => `<path d="M ${i * 70} ${560 + (i % 3) * 30} q 15 -6 30 0" stroke="#bfe0f5" stroke-width="2" fill="none" opacity=".6"/>`).join('')}
    ${voertuig(['ijveer'], 'veer', 300, 520, 360, 90)}
    <!-- gebogen banner met de naam -->
    <use href="#ls-boog" stroke="#7a1f2b" stroke-width="104" fill="none" stroke-linecap="round"/>
    <use href="#ls-boog" stroke="#c2412d" stroke-width="92" fill="none" stroke-linecap="round"/>
    <use href="#ls-boog" stroke="#f2c14e" stroke-width="3" fill="none" stroke-dasharray="10 8" transform="translate(0 -36)"/>
    <use href="#ls-boog" stroke="#f2c14e" stroke-width="3" fill="none" stroke-dasharray="10 8" transform="translate(0 36)"/>
    <text font-family="Barlow Semi Condensed, Arial, sans-serif" font-weight="800" font-size="78" fill="#fff8e6" letter-spacing="3" dy="26" style="paint-order:stroke" stroke="#5a1520" stroke-width="5">
      <textPath href="#ls-boog" startOffset="50%" text-anchor="middle">OV-Manager</textPath></text>
  </svg>`;
}

// het scherm zelf: tonen, voortgang (0..1) met tekst en geschatte resterende tijd, en weer weg
let begin = 0;
export const laad = {
  toon(titel) {
    const el = document.getElementById('laadscherm'); if (!el) return;
    if (el.style.display !== 'flex') { document.getElementById('laad-plaat').innerHTML = illustratie(); begin = performance.now(); }
    el.style.display = 'flex'; document.getElementById('laad-titel').textContent = titel || 'Laden…';
    this.zet(0, '');
  },
  zet(f, tekst) {
    const el = document.getElementById('laadscherm'); if (!el || el.style.display !== 'flex') return;
    f = Math.max(0, Math.min(1, f));
    document.getElementById('laad-vol').style.width = (f * 100).toFixed(1) + '%';
    const verstreken = (performance.now() - begin) / 1000, rest = f > 0.04 ? verstreken / f * (1 - f) : null;
    document.getElementById('laad-tekst').textContent = `${tekst || ''}${rest != null && f < 0.995 ? ` · nog ongeveer ${rest < 60 ? Math.max(1, Math.round(rest)) + ' s' : Math.round(rest / 60) + ' min'}` : ''}`;
  },
  verberg() { const el = document.getElementById('laadscherm'); if (el) el.style.display = 'none'; },
  nieuweFase() { begin = performance.now(); },
};
