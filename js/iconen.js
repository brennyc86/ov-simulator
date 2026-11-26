// Pictogrammen (SVG, 24×24, lijnen in de tekstkleur) voor de balk onderin, de submenu's en de filters.
const S = (inhoud, extra = '') => `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${extra}>${inhoud}</svg>`;
const P = {
  // voertuigen (vooraanzicht of zijaanzicht)
  bus: '<rect x="5" y="3" width="14" height="15" rx="2.5"/><path d="M5 11h14M8 21v-3M16 21v-3M8 14.5h.01M16 14.5h.01M9 6h6"/>',
  hov: '<rect x="4" y="3" width="13" height="15" rx="2.5"/><path d="M4 11h13M7 21v-3M14 21v-3M7 14.5h.01M14 14.5h.01M20 6l-2 4h3l-2 4"/>',
  belbus: '<path d="M3 15v-4l2-4h10l3 4h2v4z"/><circle cx="7" cy="16" r="1.8"/><circle cx="16" cy="16" r="1.8"/><path d="M6 11h11"/>',
  tram: '<rect x="6" y="6" width="12" height="12" rx="2.5"/><path d="M9 2h6M12 2v4M6 12h12M9 21l-1.5-3M15 21l1.5-3M9 15h.01M15 15h.01"/>',
  sneltram: '<rect x="7" y="6" width="11" height="12" rx="3"/><path d="M10 2h5M12.5 2v4M7 12h11M10 21l-1.5-3M15 21l1.5-3M2 9h3M2 12h3M2 15h3"/>',
  metro: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M8 21l2-3M16 21l-2-3M9 13V8l3 3 3-3v5"/>',
  trein: '<rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 10h14M9 21l-2-4M15 21l2-4M9 13.5h.01M15 13.5h.01"/>',
  monorail: '<rect x="4" y="4" width="16" height="9" rx="4"/><path d="M4 9h16M12 13v3M6 16h12M12 16v5"/>',
  veer: '<path d="M2 15h20l-3 4H5zM6 15v-5h12v5M10 10V6h4v4"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1"/>',
  watertaxi: '<path d="M3 14h18l-4 4H6zM8 14l2-4h5l2 4"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1"/>',
  vliegtuig: '<path d="M2 13l8-2 4-7 2 1-2 6 6 1 1 2-7 1-2 6-2-1 1-5-8 1z"/>',
  vracht: '<rect x="2" y="6" width="12" height="10" rx="1"/><path d="M14 9h4l3 3v4h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  // haltes en stations
  halte: '<path d="M12 21V10"/><rect x="7" y="3" width="10" height="7" rx="1.5"/><path d="M10 5v3M14 5v3M10 6.5h4"/>',
  halteWeg: '<path d="M10 21V10"/><rect x="5" y="3" width="10" height="7" rx="1.5"/><path d="M8 5v3M12 5v3M8 6.5h4M18 21V3M21 21V3"/>',
  tramhalte: '<path d="M8 21V10"/><rect x="3" y="3" width="10" height="7" rx="1.5"/><path d="M6 5h4M8 5v3M16 12h6M16 16h6M16 20h6M17 10v12M21 10v12"/>',
  steiger: '<path d="M3 11h18M5 11v6M10 11v6M15 11v6M19 11v6M7 7h4M9 5v6"/><path d="M2 21c2 0 2-1 4-1s2 1 4 1 2-1 4-1 2 1 4 1"/>',
  station: '<path d="M3 10l9-6 9 6M5 10v10h14V10M9 20v-5h6v5"/><circle cx="12" cy="10" r="1.6"/>',
  busstation: '<path d="M2 8h20M4 8v12M20 8v12"/><rect x="7" y="11" width="10" height="7" rx="1.5"/><path d="M7 15h10M9 20v-2M15 20v-2"/>',
  metrostation: '<circle cx="12" cy="8" r="5"/><path d="M9.5 10V6.5l2.5 2.5 2.5-2.5V10M5 21h14M7 21v-3h3v-2h4v2h3v3"/>',
  // sporen en wegen
  spoor: '<path d="M8 2v20M16 2v20M6 5h12M6 9h12M6 13h12M6 17h12M6 21h12"/>',
  tramspoor: '<path d="M9 2v20M15 2v20M7 6h10M7 12h10M7 18h10" stroke-dasharray="0"/><path d="M4 2v20M20 2v20" stroke-opacity=".45"/>',
  trambaan: '<path d="M3 2l-1 20M21 2l1 20" stroke-opacity=".5"/><path d="M12 3v3M12 10v3M12 17v3" stroke-opacity=".5"/><path d="M7.5 2l-.5 20M16.5 2l.5 20"/>',
  metrospoor: '<path d="M6 2v20M12 2v20M4 6h10M4 12h10M4 18h10"/><circle cx="18.5" cy="6" r="3.5"/><path d="M17 7.5V5l1.5 1.5L20 5v2.5"/>',
  monorailspoor: '<path d="M12 2v20M10 2h4M10 22h4"/><rect x="7" y="7" width="10" height="6" rx="2.5"/>',
  perron: '<path d="M5 2v20M10 2v20"/><rect x="13" y="4" width="7" height="16" rx="1"/>',
  verdubbel: '<path d="M4 2v20M9 2v20M15 2v20M20 2v20"/><path d="M12 9v6M9.5 12h5" stroke-width="2.2"/>',
  passeer: '<path d="M12 2v5c0 2-5 3-5 5s5 3 5 5v5M12 7c0 2 5 3 5 5s-5 3-5 5"/>',
  kruising: '<path d="M2 18h20"/><path d="M3 21c3-12 15-12 18 0" /><path d="M7 14l-1 4M17 14l1 4"/>',
  trolley: '<path d="M2 3h20M2 6h20M9 6l3 6M13 6l3 6"/><rect x="5" y="12" width="14" height="8" rx="2"/><circle cx="8" cy="21" r="1"/><circle cx="16" cy="21" r="1"/>',
  weg: '<path d="M8 2L5 22M16 2l3 20M12 3v3M12 10v3M12 17v3"/>',
  haven: '<circle cx="12" cy="5" r="2"/><path d="M12 7v13M8 11h8M5 14c0 4 3 6 7 6s7-2 7-6"/>',
  vliegveld: '<path d="M9 22l2-20h2l2 20M12 5v2M12 10v2M12 15v2M5 22h14"/>',
  heli: '<circle cx="12" cy="12" r="9"/><path d="M8.5 7.5v9M15.5 7.5v9M8.5 12h7"/>',
  terug: '<path d="M15 5l-7 7 7 7"/>',
};
// pictogram; met nieuw = true een plusje rechtsboven (nieuwe lijn van die soort)
export function ico(naam, nieuw = false) {
  const plus = nieuw ? '<circle cx="19.5" cy="4.5" r="4" fill="var(--accent, #c2412d)" stroke="none"/><path d="M19.5 2.5v4M17.5 4.5h4" stroke="#fff" stroke-width="1.6"/>' : '';
  return S((P[naam] || '') + plus);
}
// pictogram per soort vervoer
export const MODUS_ICO = { trein: 'trein', metro: 'metro', sneltram: 'sneltram', tram: 'tram', bus: 'bus', hov: 'hov', belbus: 'belbus', veer: 'veer', watertaxi: 'watertaxi', vlucht: 'vliegtuig', monorail: 'monorail' };
