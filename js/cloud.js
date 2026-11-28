// Inloggen (Google / Microsoft) en spellen online bewaren via hetzelfde Firebase-project
// als Tijdkompas. Zonder inlog bewaart het spel lokaal in de browser.
const B = 'https://www.gstatic.com/firebasejs/10.14.1/';
const CONFIG = {
  apiKey: 'AIzaSyAaA8n67JaBUmjMJfOJsxBGBOUS7foOfJA',
  authDomain: 'brennycc86-apps.firebaseapp.com',
  projectId: 'brennycc86-apps',
  storageBucket: 'brennycc86-apps.firebasestorage.app',
  messagingSenderId: '144197829489',
  appId: '1:144197829489:web:7ded3fe52355e9f9f92cd0',
};

let A = null, F = null, auth = null, db = null, laden = null;
export let gebruiker = null;
const luisteraars = new Set();
export function bijInlog(f) { luisteraars.add(f); f(gebruiker); }

export function start() {
  if (laden) return laden;
  laden = (async () => {
    const [app, a, f] = await Promise.all([import(B + 'firebase-app.js'), import(B + 'firebase-auth.js'), import(B + 'firebase-firestore.js')]);
    A = a; F = f;
    const fb = app.initializeApp(CONFIG);
    auth = a.getAuth(fb);
    db = f.getFirestore(fb);
    a.onAuthStateChanged(auth, u => { gebruiker = u; for (const l of luisteraars) l(u); });
  })().catch(e => { console.warn('Firebase niet beschikbaar', e); laden = null; throw e; });
  return laden;
}

export async function inloggen(soort) {
  await start();
  const p = soort === 'google' ? new A.GoogleAuthProvider() : new A.OAuthProvider('microsoft.com');
  if (soort === 'microsoft') p.setCustomParameters({ prompt: 'select_account' });
  try {
    return await A.signInWithPopup(auth, p);
  } catch (e) {
    if (e.code === 'auth/operation-not-allowed') throw new Error('Inloggen met Microsoft staat nog niet aan in het Firebase-project.');
    if (e.code === 'auth/popup-blocked') throw new Error('Je browser blokkeerde het inlogvenster. Sta pop-ups toe voor deze site.');
    if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
    if (e.code === 'auth/account-exists-with-different-credential') throw new Error('Dit e-mailadres hoort al bij een ander inlogaccount. Log in met de dienst die je eerder gebruikte.');
    throw e;
  }
}
export async function uitloggen() { await start(); await A.signOut(auth); }

const pad = slot => ['apps', 'knooppunt', 'spelers', gebruiker.uid, 'spellen', slot];

// ---- compressie: grote spellen (NS: ~4 MB JSON) passen zo in de browser en online
const KOP = 'GZ1|';
async function inpakken(obj) {
  const tekst = JSON.stringify(obj);
  if (typeof CompressionStream === 'undefined') return tekst;
  const buf = new Uint8Array(await new Response(new Blob([tekst]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let b = ''; for (let i = 0; i < buf.length; i += 0x8000) b += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return KOP + btoa(b);
}
async function uitpakken(tekst) {
  if (tekst == null) return null;
  if (!tekst.startsWith(KOP)) return JSON.parse(tekst); // oude opslag: gewone JSON
  const bin = atob(tekst.slice(KOP.length)); const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return JSON.parse(await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
}

// ---- online: één document per spel; past het niet (regel: < 900.000 tekens), dan extra delen
// als losse documenten <slot>_<generatie>_<i>. Eerst de delen, dan het hoofddocument, dan de oude delen weg.
const STUK = 850000;
const isDeel = id => /_g[a-z0-9]+_\d+$/.test(id);
const vorigeDelen = new Map(); // slot -> [ids] van de laatst bekende generatie
const deelIds = (slot, kop) => { const m = /^DL\|([a-z0-9]+)\|(\d+)\|/.exec(kop || ''); return m ? Array.from({ length: +m[2] }, (_, i) => `${slot}_g${m[1]}_${i + 1}`) : []; };
export async function bewaarOnline(slot, naam, spel, samenvatting) {
  if (!gebruiker) throw new Error('Niet ingelogd');
  const data = await inpakken(spel);
  const meta = { naam: String(naam).slice(0, 80), bijgewerkt: new Date().toISOString(), versie: 2, samenvatting: String(samenvatting || '').slice(0, 200) };
  let hoofd = data, nieuw = [];
  if (data.length > STUK) {
    const gen = Date.now().toString(36);
    const stukken = []; for (let i = STUK; i < data.length; i += STUK) stukken.push(data.slice(i, i + STUK));
    const kop = `DL|${gen}|${stukken.length}|`;
    nieuw = deelIds(slot, kop);
    await Promise.all(stukken.map((st, i) => F.setDoc(F.doc(db, ...pad(nieuw[i])), { naam: '~deel', spel: st, bijgewerkt: meta.bijgewerkt, versie: 2 })));
    hoofd = kop + data.slice(0, STUK);
  }
  await F.setDoc(F.doc(db, ...pad(slot)), { ...meta, spel: hoofd });
  const oud = (vorigeDelen.get(slot) || []).filter(id => !nieuw.includes(id));
  vorigeDelen.set(slot, nieuw);
  await Promise.all(oud.map(id => F.deleteDoc(F.doc(db, ...pad(id))).catch(() => {})));
}
export async function lijstOnline() {
  if (!gebruiker) return [];
  const q = await F.getDocs(F.collection(db, 'apps', 'knooppunt', 'spelers', gebruiker.uid, 'spellen'));
  return q.docs.filter(d => !isDeel(d.id)).map(d => ({ slot: d.id, naam: d.get('naam'), bijgewerkt: d.get('bijgewerkt'), samenvatting: d.get('samenvatting') }))
    .sort((a, b) => (b.bijgewerkt || '').localeCompare(a.bijgewerkt || ''));
}
export async function laadOnline(slot) {
  const d = await F.getDoc(F.doc(db, ...pad(slot)));
  if (!d.exists()) return null;
  let s = d.get('spel');
  const ids = deelIds(slot, s);
  if (ids.length) {
    const delen = await Promise.all(ids.map(id => F.getDoc(F.doc(db, ...pad(id)))));
    if (delen.some(x => !x.exists())) throw new Error('Een deel van dit online spel ontbreekt.');
    s = s.replace(/^DL\|[a-z0-9]+\|\d+\|/, '') + delen.map(x => x.get('spel')).join('');
  }
  vorigeDelen.set(slot, ids);
  return uitpakken(s);
}
export async function wisOnline(slot) {
  const d = await F.getDoc(F.doc(db, ...pad(slot)));
  const ids = d.exists() ? deelIds(slot, d.get('spel')) : [];
  await Promise.all([slot, ...ids].map(id => F.deleteDoc(F.doc(db, ...pad(id)))));
}

// ---- lokaal (zonder inlog, of als reservekopie)
const LS = 'knooppunt-spellen';
export function lijstLokaal() {
  let l = [];
  try { l = JSON.parse(localStorage.getItem(LS) || '[]'); } catch {}
  // spellen die wel bewaard zijn maar uit de lijst vielen (vroeger hooguit 10 in de lijst) weer tonen
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(LS + ':')) continue;
      const slot = k.slice(LS.length + 1);
      if (!l.some(s => s.slot === slot)) l.push({ slot, naam: 'Ouder spel', samenvatting: `${Math.round(localStorage.getItem(k).length / 1024)} kB` });
    }
  } catch {}
  return l.filter(s => { try { return localStorage.getItem(LS + ':' + s.slot) != null; } catch { return false; } });
}
// geeft true, of een foutmelding (tekst) als de browser vol zit
export async function bewaarLokaal(slot, naam, spel, samenvatting) {
  let data;
  try { data = await inpakken(spel); } catch (e) { return 'inpakken mislukte: ' + e.message; }
  try {
    localStorage.setItem(LS + ':' + slot, data);
  } catch {
    return `de browseropslag is vol (dit spel is ${Math.round(data.length / 1024)} kB). Wis oude spellen in het startscherm of log in.`;
  }
  try {
    const l = lijstLokaal().filter(s => s.slot !== slot);
    l.unshift({ slot, naam, bijgewerkt: new Date().toISOString(), samenvatting });
    localStorage.setItem(LS, JSON.stringify(l));
  } catch {}
  return true;
}
export async function laadLokaal(slot) {
  return uitpakken(localStorage.getItem(LS + ':' + slot));
}
export function wisLokaal(slot) {
  try { localStorage.removeItem(LS + ':' + slot); localStorage.setItem(LS, JSON.stringify(lijstLokaal().filter(s => s.slot !== slot))); } catch {}
}
