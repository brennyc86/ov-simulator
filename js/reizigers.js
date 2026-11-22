// Reizigers per rit: wie stapt waar in en uit, hoe vol is het voertuig, wie bleef achter op het perron
// en hoeveel reizigers hebben een kaartje. Afgeleid van de dagvraag van de lijn (spel.vraagLijn):
// verdeeld over dagdeel/weekdag, dan over de ritten van dat uur, dan over herkomst-bestemmingsparen
// tussen haltes (inwoners in de buurt × afstandsverval). Deterministisch per rit en dag.
import { vraagLijn, vangst, vraagFactor, PERIODES, ZWARTRIJDEN_BASIS, pakkans, eenheden } from './spel.js';
import { MODI, TYPE } from './vloot.js';
import { inrichtingVan, klassenVan, vraagEffect, klassePrijs } from './comfort.js';

// pseudo-toeval dat per rit gelijk blijft
function hash(...a) { let h = 2166136261; for (const x of a) { h ^= Math.round(x * 997) & 0xffffffff; h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

// indeling per voertuig: klassen met zit- en staplaatsen (uit de inrichting van de lijn, zie comfort.js)
export function indeling(typeId, modus, lijn) {
  return klassenVan(inrichtingVan(lijn || { modus }, typeId), typeId, modus);
}

const TOTAAL = PERIODES.reduce((s, p) => s + p.vraag * (p.tot - p.van) / 60, 0);
const cache = new Map();

// geeft { haltes:[{naam, in, uit, achter}], segmenten:[{aanBoord, metKaartje}], cap, klassen, ... } in rijvolgorde
export function ritReizigers(spel, lijn, r, dep, typeId, ctx) {
  const sleutel = `${spel.dag}:${lijn.sleutel || lijn.id}:${r}:${Math.round(dep)}:${typeId}:${JSON.stringify([lijn.catering, lijn.restauratie])}:${klassePrijs('1')}:${klassePrijs('3')}`;
  if (cache.has(sleutel)) return cache.get(sleutel);
  if (cache.size > 4000) cache.clear();
  const mod = MODI[lijn.modus] || MODI.bus;
  if (lijn.bijzonder) { // bijzondere rit: iedereen stapt in bij het begin en reist mee tot het eind
    const klassen = indeling(typeId, lijn.modus, lijn), cap = klassen.reduce((a, k) => a + k.zit + k.sta, 0), n = lijn.haltes.length;
    const mee = Math.min(cap, lijn.bijzonder.charter ? lijn.bijzonder.personen : (lijn.bijzonder.ingeschreven || 0));
    const volg = r ? [...lijn.haltes].reverse() : lijn.haltes;
    return { haltes: volg.map((h, i) => ({ naam: h.naam, in: i ? 0 : mee, uit: i === n - 1 ? mee : 0, achter: 0 })), segmenten: volg.slice(1).map(() => ({ aanBoord: mee, metKaartje: mee })), cap, klassen, totaal: mee, achter: 0 };
  }
  if (!lijn._vangst) lijn._vangst = lijn.haltes.map(h => vangst(ctx.plaatsen, h.x, h.y, mod.bereik));
  const n = lijn.haltes.length;
  const volg = r ? [...lijn.haltes].reverse() : lijn.haltes;
  const V = r ? [...lijn._vangst].reverse() : lijn._vangst;
  const km = r ? lijn.km.map(k => lijn.km[n - 1] - k).reverse() : lijn.km;
  // reizigers op deze rit
  if (lijn._vraagDag !== spel.dag) { lijn._vraagDag = spel.dag; lijn._vraag = vraagLijn(lijn, ctx.plaatsen, lijn.ai ? 0 : ctx.concurrentie(lijn)).perDag; }
  const periode = PERIODES.find(p => dep >= p.van && dep < p.tot) || PERIODES[PERIODES.length - 1];
  const perUur = lijn._vraag * vraagFactor(spel.dag, periode) / TOTAAL;
  const rittenUur = Math.max(1, (lijn.vertrek[0].filter(v => v >= dep - 30 && v < dep + 30).length + lijn.vertrek[1].filter(v => v >= dep - 30 && v < dep + 30).length));
  const eff = lijn.ai ? null : (lijn._eff || vraagEffect(lijn, typeId));
  let totaal = perUur / rittenUur * (lijn.ai ? 1 : (0.6 + 0.4 * (spel.reputatie / 100)) * eff.factor) * (0.75 + 0.5 * hash(dep, r, spel.dag));
  // herkomst-bestemming
  const w = [];
  let som = 0;
  for (let i = 0; i < n; i++) { w.push(new Float64Array(n)); for (let j = i + 1; j < n; j++) { const d = Math.abs(km[j] - km[i]) / 1000; const x = V[i] * V[j] / Math.pow(d + 2, 1.3) * (0.6 + 0.8 * hash(dep, i, j)); w[i][j] = x; som += x; } }
  const eh = eenheden(lijn, spel.dag, dep); // spits: gekoppelde eenheden, dubbele capaciteit
  const klassen = indeling(typeId, lijn.modus, lijn).map((k, i) => ({ ...k, zit: k.zit * eh, sta: k.sta * eh, aandeel: eff?.aandeel?.[i] }));
  const cap = klassen.reduce((s, k) => s + k.zit + k.sta, 0);
  // halte voor halte
  const uit = new Float64Array(n), haltes = [], segmenten = [];
  let aanBoord = 0;
  const maxV = Math.max(1, ...V);
  const basis = ZWARTRIJDEN_BASIS[lijn.modus] ?? 0.03;
  const controle = lijn.ai ? 1 : Math.exp(-pakkans(spel, lijn) * 6) * 1.6 * (spel.controle.poortjes && (lijn.modus === 'trein' || lijn.modus === 'metro') ? 0.35 : 1);
  const laat = dep >= 21 * 60 ? 1.7 : dep >= 19 * 60 ? 1.25 : 1;
  let zwart = 0;
  for (let i = 0; i < n; i++) {
    const af = uit[i];
    aanBoord -= af;
    let vraag = 0;
    for (let j = i + 1; j < n; j++) vraag += som ? totaal * w[i][j] / som : 0;
    const ruimte = Math.max(0, cap - aanBoord);
    const instap = Math.min(vraag, ruimte), achter = vraag - instap;
    if (vraag > 0) for (let j = i + 1; j < n; j++) uit[j] += (som ? totaal * w[i][j] / som : 0) * instap / vraag;
    // zwartrijders: meer in de stad en 's avonds; wie uitstapt neemt zijn deel mee
    const fr = Math.min(0.6, basis * (0.5 + 1.4 * V[i] / maxV) * laat * controle * (0.7 + 0.6 * hash(dep, i, 7)));
    zwart = aanBoord > 0 ? zwart * (aanBoord) / (aanBoord + af) : 0;
    zwart += instap * fr;
    aanBoord += instap;
    haltes.push({ naam: volg[i].naam, in: Math.round(instap), uit: Math.round(af), achter: Math.round(achter) });
    if (i < n - 1) segmenten.push({ aanBoord: Math.round(aanBoord), metKaartje: Math.round(aanBoord - zwart) });
  }
  const res = { haltes, segmenten, cap, klassen, eenheden: eh, totaal: Math.round(haltes.reduce((s, h) => s + h.in, 0)), achter: haltes.reduce((s, h) => s + h.achter, 0) };
  cache.set(sleutel, res);
  return res;
}

// verdeling van een aantal reizigers over de klassen: ieder naar zijn eigen klasse (aandeel uit prijs en comfort).
// Met een kaartje voor een hogere klasse mag je in een lagere zitten (of staan), niet andersom.
// klassen staan gesorteerd van hoog (Premium, 1e) naar laag; wie nergens past staat in zijn eigen klasse (overvol).
export function bezettingKlassen(aantal, klassen) {
  const uit = klassen.map(k => ({ klasse: k.klasse, zit: 0, sta: 0, zitMax: k.zit, staMax: k.sta }));
  const std = { P: 0.03, 1: 0.07, 2: 0.9, 3: 0.12, 4: 0.12, 5: 0.12, 6: 0.12 };
  const w = klassen.map(k => k.aandeel ?? std[k.klasse] ?? 0.1), som = w.reduce((a, b) => a + b, 0) || 1;
  const wil = w.map(x => Math.round(aantal * x / som));
  wil[wil.length - 1] += aantal - wil.reduce((a, b) => a + b, 0); // afronding
  for (let i = 0; i < uit.length; i++) {
    let rest = Math.max(0, wil[i]);
    for (let j = i; j < uit.length && rest > 0; j++) { const z = Math.min(rest, uit[j].zitMax - uit[j].zit); uit[j].zit += z; rest -= z; } // zitten: eigen of lager
    for (let j = i; j < uit.length && rest > 0; j++) { const z = Math.min(rest, uit[j].staMax - uit[j].sta); uit[j].sta += z; rest -= z; } // staan: eigen of lager
    uit[i].sta += rest; // past nergens: staat toch (overvol)
  }
  return uit;
}
