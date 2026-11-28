// Historische correcties op de kaartdata. OpenStreetMap kent alleen de huidige situatie; hier staan
// wijzigingen met een bron of een melding van een speler. Afstanden in RD-meters t.o.v. het stationspunt.
export const CORRECTIES = [
  // Hilversum: het derde perron (eilandperron aan de oostkant) is gebouwd in 2006–2007 (bron: Wikipedia, Station Hilversum)
  { station: 'Hilversum', soort: 'perron', oostVan: 45, van: 2007 },
];
// beginjaar van een perronvlak volgens de correcties (0 = geen correctie)
export function perronVanaf(stations, pts) {
  let cx = 0, cy = 0; const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]; cy += pts[i + 1]; }
  cx /= n; cy /= n;
  let van = 0;
  for (const c of CORRECTIES) {
    if (c.soort !== 'perron') continue;
    if (!c._st || c._lijst !== stations) { c._lijst = stations; c._st = stations.find(s => s.n === c.station && s.s === 'trein') || null; } // eenmalig opzoeken
    const st = c._st; if (!st || Math.hypot(cx - st.x, cy - st.y) > 400) continue;
    if (c.oostVan != null && cx - st.x > c.oostVan) van = Math.max(van, c.van);
  }
  return van;
}
