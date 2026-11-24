// Vrolijk spoordeuntje, live gemaakt met Web Audio (geen geluidsbestanden, eigen compositie).
// Melodie + oempa-bas + 'tsjoeke-tsjoeke' van de wielen + 'ta-dam' over de railnaden, en aan het eind een stoomfluit.
// Standaard uit; aan/uit met de luidsprekerknop.

let ACHTSTE = 60 / 126 / 2;
const NOOT = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const hz = n => { const m = /^([A-G]#?)(\d)$/.exec(n); return 440 * 2 ** ((NOOT[m[1]] + (+m[2] + 1) * 12 - 69) / 12); };

// 16 maten van 8 achtsten; '-' = aanhouden, '.' = rust
const m16 = l => l.map(m => m.split(' '));
const AKKOORD = { C: ['C3', 'G2', ['E4', 'G4', 'C5']], Am: ['A2', 'E3', ['E4', 'A4', 'C5']], F: ['F2', 'C3', ['F4', 'A4', 'C5']], G: ['G2', 'D3', ['D4', 'G4', 'B4']],
  D7: ['D3', 'A2', ['D4', 'F#4', 'C5']], G7: ['G2', 'D3', ['F4', 'G4', 'B4']], Dm: ['D3', 'A2', ['D4', 'F4', 'A4']], E: ['E2', 'B2', ['E4', 'G#4', 'B4']],
  Em: ['E2', 'B2', ['E4', 'G4', 'B4']], D: ['D3', 'A2', ['D4', 'F#4', 'A4']] };
// eigen composities: spoordeuntje (stoom, wielen, fluit), avondtrein (rustig, mineur), stadsbus (vlot, zonder wielgeluid)
export const LIEDJES = [
  { naam: 'Spoordeuntje', bpm: 126, vorm: 'square', wielen: true, fluit: true, melodie: m16([
    'C5 . E5 G5 - - E5 .', 'A4 . C5 E5 - - C5 .', 'F4 A4 C5 F5 - E5 D5 C5', 'D5 - - B4 G4 - . .',
    'C5 . E5 G5 - - C6 .', 'A5 G5 E5 C5 - . A4 .', 'D5 F#5 A5 - C6 - A5 F#5', 'G5 - - - D5 . . .',
    'A5 - G5 F5 E5 - F5 .', 'G5 - E5 C5 - . E5 .', 'F5 - E5 D5 B4 - D5 .', 'E5 - C5 G4 - . G4 .',
    'A4 C5 F5 A5 - G5 F5 .', 'E5 G5 C6 - G5 E5 C5 .', 'D5 - F5 - B4 - D5 -', 'C5 - - - . . . .']),
    schema: ['C', 'Am', 'F', 'G', 'C', 'Am', 'D7', 'G', 'F', 'C', 'G', 'C', 'F', 'C', 'G7', 'C'] },
  { naam: 'Avondtrein', bpm: 84, vorm: 'triangle', wielen: true, fluit: false, melodie: m16([
    'A4 - - C5 E5 - - .', 'D5 - C5 B4 A4 - . .', 'F4 - A4 C5 F5 - E5 .', 'E5 - - - . . . .',
    'A4 - C5 E5 A5 - G5 .', 'F5 - E5 D5 C5 - . .', 'D5 - F5 - E5 - C5 .', 'B4 - - - . . . .',
    'C5 - E5 - G5 - E5 .', 'F5 - - E5 D5 - . .', 'E5 - C5 - A4 - C5 .', 'B4 - G#4 - E4 - . .',
    'A4 - C5 E5 - D5 C5 .', 'D5 - F5 A5 - G5 F5 .', 'E5 - D5 - B4 - G#4 -', 'A4 - - - . . . .']),
    schema: ['Am', 'Dm', 'F', 'E', 'Am', 'Dm', 'Dm', 'E', 'C', 'F', 'Am', 'E', 'Am', 'Dm', 'E', 'Am'] },
  { naam: 'Stadsbus', bpm: 144, vorm: 'square', wielen: false, fluit: false, melodie: m16([
    'G4 B4 D5 - G5 - D5 .', 'E5 - C5 - A4 - . .', 'D5 - B4 G4 - A4 B4 .', 'A4 - - - . . . .',
    'G4 B4 D5 - G5 - A5 .', 'B5 - A5 G5 - E5 . .', 'D5 E5 F#5 - A5 - F#5 .', 'G5 - - - . . . .',
    'C5 - E5 G5 - E5 C5 .', 'B4 - D5 G5 - D5 B4 .', 'A4 - C5 E5 - D5 C5 .', 'B4 - G4 - D5 . . .',
    'E5 - G5 - E5 C5 A4 .', 'D5 - B4 G4 - B4 D5 .', 'A4 - F#4 - D4 - F#4 -', 'G4 - - - . . . .']),
    schema: ['G', 'C', 'G', 'D', 'G', 'Em', 'D', 'G', 'C', 'G', 'Am', 'G', 'Em', 'G', 'D', 'G'] },
];
let lied = LIEDJES[0];
export function zetLiedje(i) { lied = LIEDJES[i] || LIEDJES[0]; ACHTSTE = 60 / lied.bpm / 2; stap = 0; }
export const liedjeNr = () => LIEDJES.indexOf(lied);

let ctx = null, uit = null, ruis = null, timer = null, stap = 0, volgende = 0, aan = false;

function opzetten() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const comp = ctx.createDynamicsCompressor(); comp.connect(ctx.destination);
  uit = ctx.createGain(); uit.gain.value = 0.16; uit.connect(comp);
  ruis = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = ruis.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function toon(f, t, duur, { vorm = 'square', vol = 0.3, filter = 2400, aanslag = 0.01, glij = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
  o.type = vorm; o.frequency.setValueAtTime(f * (glij ? 2 ** (-glij / 1200) : 1), t);
  if (glij) o.frequency.linearRampToValueAtTime(f, t + 0.08);
  lp.type = 'lowpass'; lp.frequency.value = filter;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + aanslag);
  g.gain.setTargetAtTime(vol * 0.6, t + aanslag, duur * 0.4); g.gain.setTargetAtTime(0, t + duur * 0.9, 0.03);
  o.connect(lp); lp.connect(g); g.connect(uit); o.start(t); o.stop(t + duur + 0.2);
}
function geruis(t, duur, { vol = 0.2, freq = 3000, q = 1, soort = 'bandpass' } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = ruis; s.loop = true; f.type = soort; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + duur);
  s.connect(f); f.connect(g); g.connect(uit); s.start(t, Math.random() * 0.5); s.stop(t + duur + 0.05);
}
function fluit(t) { // stoomfluit: drie licht ontstemde tonen met een 'zucht' ervoor
  geruis(t, 0.25, { vol: 0.12, freq: 1800, q: 0.7 });
  for (const n of ['D#5', 'G5', 'A#5']) toon(hz(n) * (1 + (Math.random() - 0.5) * 0.006), t + 0.05, 0.9, { vorm: 'sawtooth', vol: 0.07, filter: 1900, aanslag: 0.08, glij: 60 });
}

function speelStap(s, t) {
  const maat = Math.floor(s / 8) % 16, tel = s % 8, ak = AKKOORD[lied.schema[maat]], MELODIE = lied.melodie;
  // melodie
  const n = MELODIE[maat][tel];
  if (n !== '-' && n !== '.') {
    let lengte = 1; while (tel + lengte < 8 && MELODIE[maat][tel + lengte] === '-') lengte++;
    toon(hz(n), t, lengte * ACHTSTE * 0.95, { vorm: lied.vorm, vol: lied.vorm === 'triangle' ? 0.2 : 0.11, filter: 2600 });
    toon(hz(n) * 2, t, lengte * ACHTSTE * 0.6, { vorm: 'triangle', vol: 0.04, filter: 5000 }); // glans
  }
  // oempa: bas op 1 en 3, akkoordje op 2 en 4
  if (tel === 0 || tel === 4) toon(hz(tel === 0 ? ak[0] : ak[1]), t, ACHTSTE * 1.6, { vorm: 'triangle', vol: 0.32, filter: 900 });
  if (tel === 2 || tel === 6) for (const a of ak[2]) toon(hz(a), t, ACHTSTE * 0.5, { vorm: 'square', vol: 0.025, filter: 1600 });
  // wielen: tsjoeke-tsjoeke op elke achtste, nadruk op de tweede
  if (lied.wielen) geruis(t, ACHTSTE * 0.5, { vol: tel % 2 ? 0.09 : 0.045, freq: 4500, q: 0.8, soort: 'highpass' });
  // railnaad: ta-dam aan het eind van elke tweede maat
  if (lied.wielen && maat % 2 === 1 && (tel === 6 || tel === 7)) geruis(t + (tel === 7 ? ACHTSTE * 0.3 : 0), 0.06, { vol: 0.25, freq: 900, q: 3 });
  // stoomfluit in de laatste maat
  if (lied.fluit && maat === 15 && tel === 4) fluit(t);
}

function planner() {
  while (volgende < ctx.currentTime + 0.15) { speelStap(stap, volgende); stap++; volgende += ACHTSTE * (stap % 2 ? 1.08 : 0.92); } // beetje swing
}

export function muziekAan() {
  if (!ctx) opzetten();
  ctx.resume(); aan = true;
  stap = 0; volgende = ctx.currentTime + 0.08;
  clearInterval(timer); timer = setInterval(planner, 30);
}
export function muziekUit() {
  aan = false; clearInterval(timer); timer = null;
  if (ctx) ctx.suspend();
}
export const muziekSpeelt = () => aan;
