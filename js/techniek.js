// Techniek per voertuigtype: vermogen (kW), gewicht (ton), doorloop tussen gekoppelde eenheden en een
// Wikipedia-artikel voor de foto. Waarden bij benadering (openbare gegevens, afgerond).
import { TYPE } from './vloot.js';

// [kW, ton, doorloop naar een gekoppelde eenheid, wikipedia (nl), wikipedia (en)]
const T = {
  stoomloc3700: [920, 115, true, 'NS 3700', 'NS 3700'], loc1000: [2580, 99, true, 'NS 1000', 'NS Class 1000'], loc1100: [2200, 80, true, 'NS 1100', 'NS Class 1100'],
  loc1200: [2360, 108, true, 'NS 1200', 'NS Class 1200'], loc1300: [3000, 111, true, 'NS 1300', 'NS Class 1300'], loc2200: [660, 72, true, 'NS 2200', 'NS Class 2200'],
  loc1600: [4540, 83, true, 'NS 1600', 'NS Class 1600'], loc1700: [4540, 86, true, 'NS 1700', 'NS Class 1700'], loc186: [5600, 85, true, 'Bombardier TRAXX', 'Bombardier TRAXX'], loc193: [6400, 90, true, 'Siemens Vectron', 'Siemens Vectron'],
  coupe: [0, 18, true, 'Coupérijtuig', 'Compartment coach'], staalrijtuig: [0, 38, true, 'Blokkendoos (spoorwegrijtuig)', 'NS steel coaches'], plane: [0, 40, true, 'Plan E', 'NS Plan E'], planw: [0, 42, true, 'Plan W', 'NS Plan W'],
  icr: [0, 42, true, 'Intercityrijtuig', 'ICR (railway coach)'], icrbvk: [0, 46, true, 'Intercityrijtuig', 'ICR (railway coach)'], ddm1: [0, 50, true, 'Dubbeldeksmaterieel', 'NS double-deck coaches'], ddm1bvk: [0, 55, true, 'Dubbeldeksmaterieel', 'NS double-deck coaches'],
  viaggio: [0, 48, true, 'Siemens Viaggio', 'Siemens Viaggio Comfort'], viaggiobvk: [0, 52, true, 'Siemens Viaggio', 'Siemens Viaggio Comfort'],
  stoomtramloc: [150, 22, true, 'Stoomtramlocomotief (los)', 'Stoomtramlocomotief (los)'],
  dieseltramloc: [180, 20, true, 'Dieseltramlocomotief (motortram als trekker)', 'Dieseltramlocomotief (motortram als trekker)'],
  tramelloc: [300, 22, true, 'Elektrische tramloc (ook voor goederen door de straat)', 'Elektrische tramloc (ook voor goederen door de straat)'],
  bijwagen: [0, 8, true, 'Tramaanhangrijtuig (bijwagen, open balkons)', 'Tramaanhangrijtuig (bijwagen, open balkons)'],
  bijwagen2: [0, 11, true, 'Gesloten tramaanhangrijtuig', 'Gesloten tramaanhangrijtuig'],
  stoomtramrijtuig: [0, 9, true, 'Stoomtramrijtuig (houten bak)', 'Stoomtramrijtuig (houten bak)'],
  tramstuur: [0, 14, true, 'Stuurstand-bijwagen (concept)', 'Stuurstand-bijwagen (concept)'],
  metroloc: [1000, 45, true, 'Metroloc (accu, werkloc; als trekker een concept)', 'Metroloc (accu, werkloc; als trekker een concept)'],
  metrorijtuig: [0, 28, true, 'Metro-aanhangrijtuig (concept)', 'Metro-aanhangrijtuig (concept)'],
  metrostuur: [0, 31, true, 'Metro-stuurstandrijtuig (concept)', 'Metro-stuurstandrijtuig (concept)'],
  stoomloc3900: [1250, 140, true, 'Stoomlocomotief NS 3900 (los)', 'Stoomlocomotief NS 3900 (los)'],
  stoomlocbr01: [1650, 170, true, 'Stoomlocomotief DR/DB baureihe 01 (los)', 'Stoomlocomotief DR/DB baureihe 01 (los)'],
  loc1500: [2300, 98, true, 'Elektrische loc NS 1500 (ex-BR class 77)', 'Elektrische loc NS 1500 (ex-BR class 77)'],
  loc2400: [625, 60, true, 'Diesellocomotief NS 2400', 'Diesellocomotief NS 2400'],
  loc6400: [1180, 80, true, 'Diesellocomotief NS 6400 (goederen)', 'Diesellocomotief NS 6400 (goederen)'],
  loc189: [6400, 87, true, 'Siemens ES64F4 (BR 189, 4 spanningen)', 'Siemens ES64F4 (BR 189, 4 spanningen)'],
  class66: [2385, 126, true, 'EMD Class 66 (diesel, goederen)', 'EMD Class 66 (diesel, goederen)'],
  g2000: [2700, 87, true, 'Vossloh G2000 (diesel)', 'Vossloh G2000 (diesel)'],
  br101: [6400, 87, true, 'DB baureihe 101', 'DB baureihe 101'],
  br103: [7440, 114, true, 'DB baureihe 103', 'DB baureihe 103'],
  br110: [3700, 85, true, 'DB baureihe 110 (E 10)', 'DB baureihe 110 (E 10)'],
  br185: [5600, 85, true, 'Bombardier TRAXX AC (BR 185)', 'Bombardier TRAXX AC (BR 185)'],
  br218: [1840, 79, true, 'DB baureihe 218 (diesel)', 'DB baureihe 218 (diesel)'],
  nmbs13: [5000, 90, true, 'NMBS HLE 13 (2 spanningen)', 'NMBS HLE 13 (2 spanningen)'],
  nmbs27: [4380, 85, true, 'NMBS HLE 27', 'NMBS HLE 27'],
  nmbs55: [1435, 110, true, 'NMBS HLD 55 (diesel)', 'NMBS HLD 55 (diesel)'],
  nmbs77: [1150, 90, true, 'NMBS HLD 77 (diesel)', 'NMBS HLD 77 (diesel)'],
  cfl3000: [5000, 90, true, 'CFL 3000 (2 spanningen)', 'CFL 3000 (2 spanningen)'],
  cfl4000: [5600, 84, true, 'CFL 4000 TRAXX (meersysteem)', 'CFL 4000 TRAXX (meersysteem)'],
  bb26000: [5600, 91, true, 'SNCF BB 26000 "Sybic"', 'SNCF BB 26000 "Sybic"'],
  bb7200: [4040, 84, true, 'SNCF BB 7200', 'SNCF BB 7200'],
  bb15000: [4620, 90, true, 'SNCF BB 15000', 'SNCF BB 15000'],
  bb22200: [4360, 90, true, 'SNCF BB 22200 (2 spanningen)', 'SNCF BB 22200 (2 spanningen)'],
  bb67400: [1765, 83, true, 'SNCF BB 67400 (diesel)', 'SNCF BB 67400 (diesel)'],
  bb75000: [2000, 82, true, 'SNCF BB 75000 Prima (diesel)', 'SNCF BB 75000 Prima (diesel)'],
  br146: [5600, 84, true, 'Bombardier TRAXX P160 AC (BR 146)', 'Bombardier TRAXX P160 AC (BR 146)'],
  loc1800: [5600, 85, true, 'Elektrische loc NS 1800 (TRAXX MS, 3 spanningen)', 'Elektrische loc NS 1800 (TRAXX MS, 3 spanningen)'],
  plank: [0, 38, true, 'Rijtuig Plan K', 'Rijtuig Plan K'],
  icrm: [0, 44, true, 'Intercityrijtuig ICRm (gemoderniseerd)', 'Intercityrijtuig ICRm (gemoderniseerd)'],
  icrmbvk: [0, 48, true, 'ICRm-stuurstandrijtuig', 'ICRm-stuurstandrijtuig'],
  wr: [0, 50, true, 'Restauratierijtuig (WR)', 'Restauratierijtuig (WR)'],
  wl: [0, 52, true, 'Slaaprijtuig (WL)', 'Slaaprijtuig (WL)'],
  nmbsm4: [0, 40, true, 'NMBS M4-rijtuig', 'NMBS M4-rijtuig'],
  nmbsm6: [0, 50, true, 'NMBS M6 dubbeldeksrijtuig', 'NMBS M6 dubbeldeksrijtuig'],
  nmbsm6bx: [0, 56, true, 'NMBS M6-stuurstandrijtuig (Bx)', 'NMBS M6-stuurstandrijtuig (Bx)'],
  nmbsi11: [0, 46, true, 'NMBS I11-rijtuig', 'NMBS I11-rijtuig'],
  nmbsi11bdx: [0, 50, true, 'NMBS I11-stuurstandrijtuig (BDx)', 'NMBS I11-stuurstandrijtuig (BDx)'],
  nmbsm7r: [0, 52, true, 'NMBS M7 dubbeldeksrijtuig', 'NMBS M7 dubbeldeksrijtuig'],
  nmbsm7bmx: [0, 58, true, 'NMBS M7-stuurstandrijtuig (BMx)', 'NMBS M7-stuurstandrijtuig (BMx)'],
  dbn: [0, 32, true, 'DB n-Wagen "Silberling"', 'DB n-Wagen "Silberling"'],
  dbnbdf: [0, 36, true, 'DB n-Wagen-Steuerwagen (BDnf)', 'DB n-Wagen-Steuerwagen (BDnf)'],
  dbdosto: [0, 49, true, 'DB Doppelstockwagen (Dosto)', 'DB Doppelstockwagen (Dosto)'],
  dbdostost: [0, 56, true, 'DB Dosto-Steuerwagen', 'DB Dosto-Steuerwagen'],
  dbic: [0, 45, true, 'DB IC-rijtuig (Bpmz)', 'DB IC-rijtuig (Bpmz)'],
  dbic2: [0, 52, true, 'DB IC2 dubbeldeksrijtuig (Twindexx)', 'DB IC2 dubbeldeksrijtuig (Twindexx)'],
  dbic2st: [0, 58, true, 'DB IC2-stuurstandrijtuig', 'DB IC2-stuurstandrijtuig'],
  corail: [0, 42, true, 'SNCF Corail-rijtuig (VTU)', 'SNCF Corail-rijtuig (VTU)'],
  vb2n: [0, 46, true, 'SNCF VB2N dubbeldeksrijtuig', 'SNCF VB2N dubbeldeksrijtuig'],
  vb2nst: [0, 50, true, 'SNCF VB2N-stuurstandrijtuig', 'SNCF VB2N-stuurstandrijtuig'],
  stoom3700: [920, 300, true, 'NS 3700', 'NS 3700'], mat36: [820, 90, false, "Materieel '36", "NS Mat '36"], hondekop: [1240, 190, false, "Materieel '54", "NS Mat '54"], planv: [784, 103, false, "Materieel '64", "NS Mat '64"],
  sgm: [1240, 135, false, 'Stadsgewestelijk Materieel', 'NS SGM'], icm: [1680, 185, true, 'Intercitymaterieel', 'NS Koploper'], icmm: [1680, 190, false, 'Intercitymaterieel', 'NS Koploper'],
  mddm4: [2400, 230, false, 'Dubbeldeksmaterieel', 'NS mDDM'], mddm6: [2400, 330, false, 'Dubbeldeksmaterieel', 'NS mDDM'], ddr: [4540, 280, true, 'Dubbeldeksmaterieel', 'NS DDM-1'],
  ddz: [3000, 370, false, 'NS DDZ', 'NS DDZ'], virm6: [2700, 360, false, 'Verlengd InterRegioMaterieel', 'NS VIRM'], icng5: [4000, 250, false, 'Intercity Nieuwe Generatie', 'NS ICNG'],
  slt6: [1680, 160, false, 'Sprinter Lighttrain', 'NS Sprinter Lighttrain'], sng4: [1500, 130, false, 'Sprinter Nieuwe Generatie', 'NS Sprinter New Generation'], flirt4: [2600, 160, false, 'Stadler FLIRT', 'Stadler FLIRT'],
  gtw: [600, 70, false, 'Stadler GTW', 'Stadler GTW'], wink: [1000, 100, false, 'Stadler WINK', 'Stadler WINK'], lint41: [630, 70, false, 'Alstom Coradia LINT', 'Alstom Coradia LINT'], buffel: [800, 100, false, "DM '90", "NS DM '90"], ice3: [8000, 410, false, 'ICE 3', 'ICE 3'],
  icngb: [4000, 255, false, 'Intercity Nieuwe Generatie', 'NS ICNG'], flirt3ms: [2600, 165, false, 'Stadler FLIRT', 'Stadler FLIRT'], am08: [1680, 160, true, 'Siemens Desiro ML', 'Siemens Desiro ML'],
  am96: [1400, 160, true, 'NMBS AM96', 'SNCB Class AM 96'], nmbsm7: [5000, 420, true, 'M7 (rijtuig)', 'SNCB M7'], cflkiss: [4000, 220, false, 'Stadler KISS', 'Stadler KISS'], cfl2200: [2000, 200, true, 'CFL 2200', 'CFL Class 2200'],
  talent2: [2000, 150, false, 'Bombardier Talent 2', 'Bombardier Talent 2'], ice4: [9900, 670, false, 'ICE 4', 'ICE 4'], regio2n: [3200, 300, true, 'Regio 2N', 'Bombardier Omneo'],
  tgvduplex: [8800, 800, true, 'TGV Duplex', 'TGV Duplex'], thalys: [8800, 385, false, 'Thalys PBKA', 'Thalys PBKA'], hle18: [6400, 90, true, 'HLE 18', 'SNCB Class 18'],
  gvbm1: [1000, 100, false, 'M1 (Amsterdamse metro)', 'Amsterdam Metro M1/M2/M3'], gvbm5: [2000, 190, false, 'M5 (Amsterdamse metro)', 'Alstom Metropolis'], gvbm7: [2000, 190, false, 'M7 (Amsterdamse metro)', 'CAF Inneo'],
  retmg2: [800, 70, false, 'MG2/1', 'RET MG2/1'], retrsg3: [800, 60, false, 'RSG3', 'Bombardier Flexity Swift'], regiocitadis: [600, 60, false, 'RegioCitadis', 'Alstom Citadis'], urbos100: [700, 60, false, 'CAF Urbos', 'CAF Urbos'],
  sigsneltram: [600, 50, false, 'SIG-sneltram', 'SIG light rail Utrecht'], paardentram: [10, 4, false, 'Paardentram', 'Horsecar'], stoomtram: [150, 40, false, 'Stoomtram', 'Steam tram'],
  tweeasser: [100, 12, false, 'Tweeasser (tram)', 'Tram'], pcc: [220, 18, false, 'PCC-car', 'PCC streetcar'], gvb9g: [200, 22, false, 'Gelede tram', 'Articulated tram'], gtl8: [300, 37, false, 'GTL8', 'HTM GTL8'],
  combino: [400, 37, false, 'Siemens Combino', 'Siemens Combino'], citadis302: [480, 40, false, 'Alstom Citadis', 'Alstom Citadis'], urbos15g: [480, 42, false, 'CAF Urbos', 'CAF Urbos'], tina: [500, 45, false, 'TINA (tram)', 'Alstom Citadis'],
  citaro: [220, 12, false, 'Mercedes-Benz Citaro', 'Mercedes-Benz Citaro'], citealle: [220, 13, false, 'VDL Citea', 'VDL Citea'], citeagelede: [300, 18, false, 'VDL Citea', 'VDL Citea'],
  trolley: [240, 17, false, 'Trolleybus', 'Trolleybus'], ebusco22: [250, 12, false, 'Ebusco', 'Ebusco'], kromhout: [100, 8, false, 'Kromhout (bus)', 'Kromhout Motoren Fabriek'], leylandverheul: [150, 10, false, 'Leyland-Verheul', 'Leyland-Verheul'],
};
export const vermogen = id => T[TYPE[id]?.basis || id]?.[0] ?? (TYPE[id]?.soort ? 0 : 400);
export const massa = id => T[TYPE[id]?.basis || id]?.[1] ?? Math.max(10, ((TYPE[id]?.zit || 40) + (TYPE[id]?.sta || 20)) * 0.25);
export const doorloop = id => T[TYPE[id]?.basis || id]?.[2] ?? !!TYPE[id]?.soort;
export const wiki = id => T[TYPE[id]?.basis || id]?.slice(3) || [TYPE[id]?.naam?.split(/ \(| "/)[0]];

// rijweerstand (kN) bij v km/u: rollen + lucht (meer bakken = meer luchtweerstand)
const weerstand = (ton, bakken, v) => 0.011 * ton + 0.0001 * ton * v + 0.00012 * bakken * v * v;
// prestaties van een samenstelling uit delen [{id, n}]: topsnelheid (constructie en vermogen), optrekken, gewicht
export function prestaties(delen, bakkenVan) {
  let kw = 0, ton = 0, bakken = 0, vbouw = Infinity;
  for (const { id, n = 1 } of delen) { const t = TYPE[id]; if (!t) continue; kw += vermogen(id) * n; ton += massa(id) * n; bakken += (bakkenVan?.(id)?.length || 1) * n; vbouw = Math.min(vbouw, t.vmax || 999); }
  if (!ton) return { kw: 0, ton: 0, vmax: 0, acc: 0, vbouw: 0 };
  const acc = Math.max(0.05, Math.min(1.2, kw * 0.04 / ton)); // trekkracht per ton (adhesie begrenst rond 1,2 m/s²)
  let vP = 0; for (let v = 5; v <= 350; v += 5) { if (weerstand(ton, bakken, v) * v / 3.6 <= kw * 0.85) vP = v; else break; } // waar het vermogen op is
  return { kw, ton, bakken, acc, vbouw, vmaxVermogen: vP, vmax: kw ? Math.min(vbouw, vP) : 0 };
}
