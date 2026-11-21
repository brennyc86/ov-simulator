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

export async function bewaarOnline(slot, naam, spel, samenvatting) {
  if (!gebruiker) throw new Error('Niet ingelogd');
  await F.setDoc(F.doc(db, ...pad(slot)), {
    naam: String(naam).slice(0, 80), spel: JSON.stringify(spel), bijgewerkt: new Date().toISOString(),
    versie: 1, samenvatting: String(samenvatting || '').slice(0, 200),
  });
}
export async function lijstOnline() {
  if (!gebruiker) return [];
  const q = await F.getDocs(F.collection(db, 'apps', 'knooppunt', 'spelers', gebruiker.uid, 'spellen'));
  return q.docs.map(d => ({ slot: d.id, naam: d.get('naam'), bijgewerkt: d.get('bijgewerkt'), samenvatting: d.get('samenvatting') }))
    .sort((a, b) => (b.bijgewerkt || '').localeCompare(a.bijgewerkt || ''));
}
export async function laadOnline(slot) {
  const d = await F.getDoc(F.doc(db, ...pad(slot)));
  return d.exists() ? JSON.parse(d.get('spel')) : null;
}
export async function wisOnline(slot) { await F.deleteDoc(F.doc(db, ...pad(slot))); }

// lokaal (zonder inlog, of als reservekopie)
const LS = 'knooppunt-spellen';
export function lijstLokaal() {
  try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch { return []; }
}
export function bewaarLokaal(slot, naam, spel, samenvatting) {
  try {
    const l = lijstLokaal().filter(s => s.slot !== slot);
    l.unshift({ slot, naam, bijgewerkt: new Date().toISOString(), samenvatting });
    localStorage.setItem(LS, JSON.stringify(l.slice(0, 10)));
    localStorage.setItem(LS + ':' + slot, JSON.stringify(spel));
    return true;
  } catch { return false; }
}
export function laadLokaal(slot) {
  try { return JSON.parse(localStorage.getItem(LS + ':' + slot)); } catch { return null; }
}
