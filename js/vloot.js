// Voertuigtypen. Prijzen en kosten zijn benaderingen in euro's van nu (ook voor historische
// typen, zodat jaren onderling te vergelijken zijn). "van"/"tot" = jaren in dienst in Nederland.
// zit/sta = plaatsen per eenheid, vmax km/u, acc m/s², prijs €, km = onderhoud + energie €/km,
// pers = benodigd rijdend personeel (bestuurders), leven = jaren afschrijving.

export const MODI = {
  trein:   { naam: 'Trein',        kleur: '#2b4a8b', loon: 68, halteTijd: 60,  keer: 8,  bereik: 2000, ikoon: 'T' },
  sneltram:{ naam: 'Sneltram',     kleur: '#0f7c8a', loon: 58, halteTijd: 30,  keer: 6,  bereik: 900,  ikoon: 'S' },
  metro:   { naam: 'Metro',        kleur: '#1f6fd1', loon: 58, halteTijd: 30,  keer: 6,  bereik: 900,  ikoon: 'M' },
  tram:    { naam: 'Tram',         kleur: '#c2412d', loon: 55, halteTijd: 25,  keer: 6,  bereik: 450,  ikoon: 'Tr' },
  bus:     { naam: 'Bus',          kleur: '#3d8b3d', loon: 52, halteTijd: 25,  keer: 6,  bereik: 450,  ikoon: 'B' },
  hov:     { naam: 'Snelbus (HOV)',kleur: '#7a3f9d', loon: 52, halteTijd: 25,  keer: 6,  bereik: 800,  ikoon: 'Q' },
  belbus:  { naam: 'Belbus / regiotaxi', kleur: '#8a6d1f', loon: 40, halteTijd: 30, keer: 4, bereik: 1200, ikoon: 'R' },
  veer:    { naam: 'Veerpont',     kleur: '#127a9c', loon: 60, halteTijd: 240, keer: 5,  bereik: 1500, ikoon: 'V' },
  watertaxi:{naam: 'Watertaxi',    kleur: '#0aa3a3', loon: 50, halteTijd: 60,  keer: 3,  bereik: 800,  ikoon: 'W' },
  vlucht:  { naam: 'Vliegtuig',    kleur: '#5b4bb7', loon: 95, halteTijd: 1800, keer: 30, bereik: 15000, ikoon: '✈' },
};

export const VLOOT = [
  // ---------------- trein ----------------
  { id: 'stoom3700', naam: 'Stoomlocomotief NS 3700 + rijtuigen', modus: 'trein', van: 1910, tot: 1958, zit: 240, sta: 60, vmax: 90, acc: 0.25, prijs: 4.5e6, km: 4.5, energie: 'kolen', pers: 2, leven: 40, wie: 'HSM, SS, NS' },
  { id: 'mat36', naam: 'Materieel \'36 (Mat \'36)', modus: 'trein', van: 1936, tot: 1962, zit: 200, sta: 80, vmax: 125, acc: 0.5, prijs: 6e6, km: 2.6, energie: 'elektrisch', pers: 1, leven: 30, wie: 'NS' },
  { id: 'hondekop', naam: 'Mat \'54 "Hondekop" (4-delig)', modus: 'trein', van: 1956, tot: 1996, zit: 216, sta: 100, vmax: 140, acc: 0.55, prijs: 8e6, km: 2.8, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'planv', naam: 'Mat \'64 "Plan V" (2-delig)', modus: 'trein', van: 1966, tot: 2016, zit: 152, sta: 100, vmax: 140, acc: 0.6, prijs: 5e6, km: 2.0, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'sgm', naam: 'SGM "Sprinter" (3-delig)', modus: 'trein', van: 1975, tot: 2021, zit: 180, sta: 190, vmax: 125, acc: 0.9, prijs: 6e6, km: 2.1, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'icm', naam: 'ICM "Koploper" (4-delig)', modus: 'trein', van: 1983, tot: 2027, zit: 240, sta: 120, vmax: 160, acc: 0.6, prijs: 9e6, km: 2.9, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'ddr', naam: 'DDM-1 dubbeldekker met loc 1700 ("DDR")', modus: 'trein', van: 1985, tot: 2019, zit: 470, sta: 200, vmax: 140, acc: 0.45, prijs: 13e6, km: 4.0, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'ddz', naam: 'DDZ dubbeldekker (6-delig)', modus: 'trein', van: 2011, tot: 2030, zit: 550, sta: 250, vmax: 140, acc: 0.6, prijs: 14e6, km: 4.2, energie: 'elektrisch', pers: 1, leven: 30, wie: 'NS' },
  { id: 'virm6', naam: 'VIRM dubbeldekker (6-delig)', modus: 'trein', van: 1994, tot: 2035, zit: 570, sta: 300, vmax: 160, acc: 0.6, prijs: 16e6, km: 4.4, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'icng5', naam: 'ICNG (5-delig)', modus: 'trein', van: 2023, tot: 2065, zit: 286, sta: 240, vmax: 200, acc: 0.7, prijs: 15e6, km: 3.2, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'slt6', naam: 'SLT Sprinter (6-delig)', modus: 'trein', van: 2009, tot: 2045, zit: 250, sta: 370, vmax: 160, acc: 1.1, prijs: 11e6, km: 3.0, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'sng4', naam: 'SNG Sprinter (4-delig)', modus: 'trein', van: 2018, tot: 2060, zit: 160, sta: 300, vmax: 160, acc: 1.1, prijs: 9.5e6, km: 2.5, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS' },
  { id: 'flirt4', naam: 'Stadler FLIRT (4-delig)', modus: 'trein', van: 2016, tot: 2060, zit: 200, sta: 240, vmax: 160, acc: 1.1, prijs: 8e6, km: 2.4, energie: 'elektrisch', pers: 1, leven: 35, wie: 'NS, Arriva, Keolis, Qbuzz' },
  { id: 'gtw', naam: 'Stadler GTW (2/6, diesel)', modus: 'trein', van: 2006, tot: 2040, zit: 110, sta: 90, vmax: 140, acc: 0.9, prijs: 5e6, km: 2.2, energie: 'diesel', pers: 1, leven: 30, wie: 'Arriva, Keolis' },
  { id: 'wink', naam: 'Stadler WINK (accu/HVO)', modus: 'trein', van: 2021, tot: 2060, zit: 150, sta: 120, vmax: 140, acc: 1.0, prijs: 9e6, km: 1.9, energie: 'accu-hybride', pers: 1, leven: 35, wie: 'Arriva' },
  { id: 'lint41', naam: 'Alstom Coradia LINT 41 (diesel)', modus: 'trein', van: 2006, tot: 2040, zit: 120, sta: 80, vmax: 120, acc: 0.9, prijs: 4.5e6, km: 2.1, energie: 'diesel', pers: 1, leven: 30, wie: 'Keolis, Arriva' },
  { id: 'buffel', naam: 'DM \'90 "Buffel" (diesel)', modus: 'trein', van: 1996, tot: 2021, zit: 128, sta: 80, vmax: 140, acc: 0.8, prijs: 5e6, km: 2.5, energie: 'diesel', pers: 1, leven: 30, wie: 'NS, Syntus' },
  { id: 'ice3', naam: 'ICE 3 (hogesnelheid)', modus: 'trein', van: 2000, tot: 2050, zit: 440, sta: 0, vmax: 300, acc: 0.6, prijs: 35e6, km: 7.0, energie: 'elektrisch', pers: 1, leven: 30, wie: 'DB, NS International' },

  // ---------------- metro / sneltram ----------------
  { id: 'gvbm1', naam: 'GVB M1/M2 (Linke-Hofmann-Busch)', modus: 'metro', van: 1977, tot: 2015, zit: 120, sta: 200, vmax: 70, acc: 1.0, prijs: 5e6, km: 3.2, energie: 'elektrisch', pers: 1, leven: 35, wie: 'GVB' },
  { id: 'gvbm5', naam: 'Alstom Metropolis (GVB M5)', modus: 'metro', van: 2013, tot: 2055, zit: 180, sta: 820, vmax: 70, acc: 1.2, prijs: 9e6, km: 4.0, energie: 'elektrisch', pers: 1, leven: 35, wie: 'GVB' },
  { id: 'gvbm7', naam: 'CAF Inneo (GVB M7)', modus: 'metro', van: 2023, tot: 2065, zit: 180, sta: 820, vmax: 80, acc: 1.2, prijs: 10e6, km: 3.8, energie: 'elektrisch', pers: 1, leven: 35, wie: 'GVB' },
  { id: 'retmg2', naam: 'RET MG2/1 (Düwag)', modus: 'metro', van: 1968, tot: 2026, zit: 110, sta: 190, vmax: 80, acc: 1.0, prijs: 5e6, km: 3.5, energie: 'elektrisch', pers: 1, leven: 40, wie: 'RET' },
  { id: 'retrsg3', naam: 'Bombardier Flexity Swift (RET RSG3)', modus: 'metro', van: 2009, tot: 2050, zit: 120, sta: 260, vmax: 100, acc: 1.1, prijs: 6e6, km: 3.6, energie: 'elektrisch', pers: 1, leven: 35, wie: 'RET' },
  { id: 'regiocitadis', naam: 'Alstom RegioCitadis (RandstadRail)', modus: 'sneltram', van: 2007, tot: 2045, zit: 90, sta: 140, vmax: 80, acc: 1.1, prijs: 3.8e6, km: 2.8, energie: 'elektrisch', pers: 1, leven: 30, wie: 'HTM' },
  { id: 'urbos100', naam: 'CAF Urbos 100 (U-OV sneltram)', modus: 'sneltram', van: 2019, tot: 2060, zit: 70, sta: 210, vmax: 70, acc: 1.2, prijs: 3.5e6, km: 2.6, energie: 'elektrisch', pers: 1, leven: 30, wie: 'U-OV' },
  { id: 'sigsneltram', naam: 'SIG sneltram Utrecht', modus: 'sneltram', van: 1983, tot: 2022, zit: 80, sta: 120, vmax: 80, acc: 1.0, prijs: 3e6, km: 3.0, energie: 'elektrisch', pers: 1, leven: 35, wie: 'Westnederland, Connexxion, Qbuzz' },

  // ---------------- tram ----------------
  { id: 'paardentram', naam: 'Paardentram', modus: 'tram', van: 1864, tot: 1917, zit: 20, sta: 10, vmax: 10, acc: 0.3, prijs: 90e3, km: 1.8, energie: 'paarden', pers: 1, leven: 20, wie: 'HTM, AOM, RTM' },
  { id: 'stoomtram', naam: 'Stoomtram', modus: 'tram', van: 1879, tot: 1966, zit: 90, sta: 30, vmax: 30, acc: 0.3, prijs: 900e3, km: 3.2, energie: 'kolen', pers: 2, leven: 35, wie: 'RTM, NTM, GTW' },
  { id: 'tweeasser', naam: 'Elektrische tweeasser (Werkspoor/Beijnes)', modus: 'tram', van: 1900, tot: 1970, zit: 22, sta: 40, vmax: 40, acc: 0.8, prijs: 900e3, km: 1.9, energie: 'elektrisch', pers: 2, leven: 35, wie: 'GVB, HTM, RET, GVU, NZH' },
  { id: 'pcc', naam: 'HTM PCC-car', modus: 'tram', van: 1949, tot: 1993, zit: 40, sta: 80, vmax: 60, acc: 1.2, prijs: 1.6e6, km: 2.2, energie: 'elektrisch', pers: 1, leven: 35, wie: 'HTM' },
  { id: 'gvb9g', naam: 'GVB Beijnes 9G/10G gelede tram', modus: 'tram', van: 1957, tot: 2004, zit: 40, sta: 110, vmax: 50, acc: 1.0, prijs: 1.8e6, km: 2.3, energie: 'elektrisch', pers: 1, leven: 35, wie: 'GVB' },
  { id: 'gtl8', naam: 'HTM GTL8 (BN)', modus: 'tram', van: 1981, tot: 2027, zit: 70, sta: 120, vmax: 70, acc: 1.1, prijs: 2.5e6, km: 2.4, energie: 'elektrisch', pers: 1, leven: 40, wie: 'HTM' },
  { id: 'combino', naam: 'Siemens Combino (GVB 13G/14G)', modus: 'tram', van: 2002, tot: 2035, zit: 52, sta: 120, vmax: 70, acc: 1.2, prijs: 2.8e6, km: 2.4, energie: 'elektrisch', pers: 1, leven: 30, wie: 'GVB' },
  { id: 'citadis302', naam: 'Alstom Citadis (RET)', modus: 'tram', van: 2002, tot: 2040, zit: 58, sta: 130, vmax: 70, acc: 1.2, prijs: 2.9e6, km: 2.4, energie: 'elektrisch', pers: 1, leven: 30, wie: 'RET' },
  { id: 'urbos15g', naam: 'CAF Urbos (GVB 15G)', modus: 'tram', van: 2020, tot: 2060, zit: 64, sta: 170, vmax: 70, acc: 1.2, prijs: 3.3e6, km: 2.3, energie: 'elektrisch', pers: 1, leven: 30, wie: 'GVB' },
  { id: 'tina', naam: 'Alstom Citadis "TINA" (HTM)', modus: 'tram', van: 2024, tot: 2064, zit: 72, sta: 180, vmax: 70, acc: 1.2, prijs: 3.6e6, km: 2.3, energie: 'elektrisch', pers: 1, leven: 30, wie: 'HTM' },

  // ---------------- bus ----------------
  { id: 'omnibus', naam: 'Paardenomnibus', modus: 'bus', van: 1839, tot: 1925, zit: 14, sta: 4, vmax: 10, acc: 0.3, prijs: 45e3, km: 1.2, energie: 'paarden', pers: 1, leven: 15, wie: 'diverse' },
  { id: 'tbus', naam: 'Vroege autobus (Ford/Chevrolet)', modus: 'bus', van: 1920, tot: 1950, zit: 22, sta: 8, vmax: 50, acc: 0.6, prijs: 120e3, km: 0.9, energie: 'benzine', pers: 1, leven: 12, wie: 'streekvervoerders, GADO, FRAM, BBA' },
  { id: 'kromhout', naam: 'Kromhout stadsbus', modus: 'bus', van: 1935, tot: 1975, zit: 32, sta: 40, vmax: 60, acc: 0.7, prijs: 200e3, km: 0.95, energie: 'diesel', pers: 1, leven: 15, wie: 'GVB, RET, HTM, GVU, gemeentelijke bedrijven' },
  { id: 'leylandverheul', naam: 'Leyland-Verheul streekbus', modus: 'bus', van: 1950, tot: 1978, zit: 42, sta: 25, vmax: 75, acc: 0.7, prijs: 230e3, km: 0.95, energie: 'diesel', pers: 1, leven: 15, wie: 'NZH, BBA, ZWN, GSM, FRAM, Maarse & Kroon' },
  { id: 'standaardstreek', naam: 'Den Oudsten standaard streekbus', modus: 'bus', van: 1966, tot: 2000, zit: 45, sta: 30, vmax: 80, acc: 0.8, prijs: 260e3, km: 0.95, energie: 'diesel', pers: 1, leven: 15, wie: 'streekvervoerders' },
  { id: 'csa1', naam: 'DAF/Hainje CSA-1 stadsbus', modus: 'bus', van: 1967, tot: 2000, zit: 30, sta: 60, vmax: 70, acc: 0.9, prijs: 250e3, km: 0.95, energie: 'diesel', pers: 1, leven: 15, wie: 'stadsvervoerders' },
  { id: 'citaro', naam: 'Mercedes-Benz Citaro', modus: 'bus', van: 1998, tot: 2040, zit: 36, sta: 60, vmax: 80, acc: 1.0, prijs: 300e3, km: 0.85, energie: 'diesel', pers: 1, leven: 14, wie: 'Arriva, Qbuzz, RET, HTM' },
  { id: 'citealle', naam: 'VDL Citea LLE-120', modus: 'bus', van: 2012, tot: 2040, zit: 40, sta: 40, vmax: 80, acc: 1.0, prijs: 290e3, km: 0.75, energie: 'diesel', pers: 1, leven: 14, wie: 'Arriva, Keolis, Qbuzz' },
  { id: 'citeaslfe', naam: 'VDL Citea SLF-120 Electric', modus: 'bus', van: 2016, tot: 2045, zit: 32, sta: 60, vmax: 80, acc: 1.1, prijs: 520e3, km: 0.45, energie: 'elektrisch', pers: 1, leven: 14, wie: 'Hermes, Transdev, GVB' },
  { id: 'citeagelede', naam: 'VDL Citea SLFA-181 Electric (geleed)', modus: 'bus', van: 2017, tot: 2045, zit: 44, sta: 100, vmax: 80, acc: 1.0, prijs: 780e3, km: 0.6, energie: 'elektrisch', pers: 1, leven: 14, wie: 'Hermes, Connexxion, EBS' },
  { id: 'ebusco22', naam: 'Ebusco 2.2', modus: 'bus', van: 2016, tot: 2040, zit: 36, sta: 50, vmax: 80, acc: 1.0, prijs: 480e3, km: 0.45, energie: 'elektrisch', pers: 1, leven: 14, wie: 'Qbuzz, Transdev, Keolis' },
  { id: 'urbinoh2', naam: 'Solaris Urbino 12 Hydrogen', modus: 'bus', van: 2020, tot: 2045, zit: 34, sta: 55, vmax: 80, acc: 1.0, prijs: 650e3, km: 0.9, energie: 'waterstof', pers: 1, leven: 14, wie: 'Qbuzz (Groningen)' },
  { id: 'trolley', naam: 'Hess Swisstrolley (trolleybus)', modus: 'bus', van: 2001, tot: 2045, zit: 44, sta: 100, vmax: 70, acc: 1.1, prijs: 900e3, km: 0.5, energie: 'bovenleiding', pers: 1, leven: 20, wie: 'Breng (Arnhem)' },
  { id: 'futura', naam: 'VDL Futura (snelbus/Qliner)', modus: 'hov', van: 2010, tot: 2040, zit: 56, sta: 0, vmax: 100, acc: 0.9, prijs: 400e3, km: 0.9, energie: 'diesel', pers: 1, leven: 14, wie: 'Qbuzz, Arriva' },
  { id: 'hovelektrisch', naam: 'VDL Citea XLE-145 Electric (HOV)', modus: 'hov', van: 2018, tot: 2045, zit: 56, sta: 40, vmax: 100, acc: 1.0, prijs: 620e3, km: 0.55, energie: 'elektrisch', pers: 1, leven: 14, wie: 'Connexxion (R-net), Arriva' },
  { id: 'buurtbus', naam: 'Mercedes Sprinter buurtbus', modus: 'belbus', van: 1977, tot: 2045, zit: 8, sta: 0, vmax: 90, acc: 1.2, prijs: 90e3, km: 0.35, energie: 'diesel', pers: 1, leven: 8, wie: 'buurtbusverenigingen' },
  { id: 'taxibus', naam: 'Elektrische taxibus (regiotaxi)', modus: 'belbus', van: 2018, tot: 2045, zit: 7, sta: 0, vmax: 100, acc: 1.4, prijs: 75e3, km: 0.22, energie: 'elektrisch', pers: 1, leven: 7, wie: 'regiotaxi-vervoerders' },

  // ---------------- veer / watertaxi ----------------
  { id: 'stoomveer', naam: 'Stoomveerboot', modus: 'veer', van: 1850, tot: 1965, zit: 300, sta: 100, vmax: 18, acc: 0.1, prijs: 8e6, km: 25, energie: 'kolen', pers: 4, leven: 40, wie: 'diverse' },
  { id: 'pontje', naam: 'Fiets- en voetveer (pontje)', modus: 'veer', van: 1900, tot: 2060, zit: 30, sta: 30, vmax: 12, acc: 0.2, prijs: 600e3, km: 4, energie: 'diesel', pers: 1, leven: 30, wie: 'gemeenten, veerdiensten' },
  { id: 'ijveer', naam: 'Elektrische IJveer', modus: 'veer', van: 2019, tot: 2060, zit: 0, sta: 450, vmax: 14, acc: 0.2, prijs: 4e6, km: 6, energie: 'elektrisch', pers: 2, leven: 30, wie: 'GVB' },
  { id: 'aqualiner', naam: 'Waterbus (snelle catamaran)', modus: 'veer', van: 1999, tot: 2050, zit: 130, sta: 0, vmax: 40, acc: 0.3, prijs: 5e6, km: 28, energie: 'diesel', pers: 2, leven: 25, wie: 'Waterbus (Blue Amigo)' },
  { id: 'autoveer', naam: 'Autoveerboot (Waddeneilanden)', modus: 'veer', van: 1960, tot: 2060, zit: 1200, sta: 500, vmax: 26, acc: 0.1, prijs: 70e6, km: 120, energie: 'diesel/LNG', pers: 8, leven: 35, wie: 'TESO, Doeksen, Wagenborg' },
  { id: 'sneldienst', naam: 'Snelle catamaran (sneldienst)', modus: 'veer', van: 1995, tot: 2060, zit: 400, sta: 0, vmax: 60, acc: 0.3, prijs: 25e6, km: 90, energie: 'diesel', pers: 4, leven: 25, wie: 'Doeksen, Westerschelde Ferry' },
  { id: 'watertaxi', naam: 'Watertaxi (12 personen)', modus: 'watertaxi', van: 1990, tot: 2060, zit: 12, sta: 0, vmax: 45, acc: 0.6, prijs: 350e3, km: 6, energie: 'diesel', pers: 1, leven: 15, wie: 'Watertaxi Rotterdam' },
  { id: 'watertaxie', naam: 'Elektrische watertaxi', modus: 'watertaxi', van: 2021, tot: 2060, zit: 12, sta: 0, vmax: 30, acc: 0.5, prijs: 500e3, km: 2.5, energie: 'elektrisch', pers: 1, leven: 15, wie: 'diverse' },

  // ---------------- luchtvaart (baan = minimale baanlengte in meters, gras = kan op een grasbaan) ----------------
  { id: 'fokker7', naam: 'Fokker F.VII', modus: 'vlucht', van: 1924, tot: 1940, zit: 10, sta: 0, vmax: 185, acc: 1.2, prijs: 1.5e6, km: 6, energie: 'benzine', pers: 2, leven: 15, baan: 600, gras: true, wie: 'KLM' },
  { id: 'dc3', naam: 'Douglas DC-3 Dakota', modus: 'vlucht', van: 1936, tot: 1965, zit: 28, sta: 0, vmax: 290, acc: 1.5, prijs: 3e6, km: 9, energie: 'avgas', pers: 3, leven: 25, baan: 800, gras: true, wie: 'KLM' },
  { id: 'f27', naam: 'Fokker F27 Friendship', modus: 'vlucht', van: 1958, tot: 1996, zit: 48, sta: 0, vmax: 460, acc: 1.5, prijs: 8e6, km: 10, energie: 'kerosine', pers: 3, leven: 25, baan: 1100, gras: false, wie: 'NLM, KLM' },
  { id: 'f50', naam: 'Fokker 50', modus: 'vlucht', van: 1987, tot: 2018, zit: 50, sta: 0, vmax: 520, acc: 1.5, prijs: 12e6, km: 9, energie: 'kerosine', pers: 4, leven: 25, baan: 1100, gras: false, wie: 'KLM Cityhopper, Denim Air' },
  { id: 'f70', naam: 'Fokker 70', modus: 'vlucht', van: 1994, tot: 2017, zit: 80, sta: 0, vmax: 780, acc: 2, prijs: 20e6, km: 14, energie: 'kerosine', pers: 5, leven: 25, baan: 1300, gras: false, wie: 'KLM Cityhopper' },
  { id: 'cessna172', naam: 'Cessna 172 (rondvlucht/taxi)', modus: 'vlucht', van: 1956, tot: 2060, zit: 3, sta: 0, vmax: 220, acc: 1.5, prijs: 450e3, km: 1.2, energie: 'avgas', pers: 1, leven: 30, baan: 450, gras: true, wie: 'vliegscholen, Paracentrum Texel' },
  { id: 'islander', naam: 'Britten-Norman Islander', modus: 'vlucht', van: 1967, tot: 2060, zit: 9, sta: 0, vmax: 270, acc: 1.5, prijs: 2.2e6, km: 2.8, energie: 'avgas', pers: 1, leven: 30, baan: 400, gras: true, wie: 'eilandhoppers' },
  { id: 'pilatus', naam: 'Pilatus PC-12 (luchttaxi)', modus: 'vlucht', van: 1994, tot: 2060, zit: 8, sta: 0, vmax: 500, acc: 1.5, prijs: 5.5e6, km: 3.5, energie: 'kerosine', pers: 1, leven: 25, baan: 800, gras: true, wie: 'luchttaxibedrijven' },
  { id: 'atr72', naam: 'ATR 72-600', modus: 'vlucht', van: 2011, tot: 2060, zit: 70, sta: 0, vmax: 510, acc: 1.5, prijs: 26e6, km: 8, energie: 'kerosine', pers: 4, leven: 25, baan: 1300, gras: false, wie: 'regionale maatschappijen' },
  { id: 'e175', naam: 'Embraer 175', modus: 'vlucht', van: 2008, tot: 2045, zit: 88, sta: 0, vmax: 830, acc: 2, prijs: 45e6, km: 15, energie: 'kerosine', pers: 5, leven: 25, baan: 1700, gras: false, wie: 'KLM Cityhopper' },
  { id: 'e195e2', naam: 'Embraer 195-E2', modus: 'vlucht', van: 2021, tot: 2060, zit: 132, sta: 0, vmax: 830, acc: 2, prijs: 60e6, km: 17, energie: 'kerosine', pers: 6, leven: 25, baan: 1900, gras: false, wie: 'KLM Cityhopper' },
  { id: 'b737', naam: 'Boeing 737-800', modus: 'vlucht', van: 1998, tot: 2045, zit: 186, sta: 0, vmax: 840, acc: 2, prijs: 75e6, km: 22, energie: 'kerosine', pers: 6, leven: 25, baan: 2200, gras: false, wie: 'KLM, Transavia, TUI' },
  { id: 'heli', naam: 'Helikopter (AW139)', modus: 'vlucht', van: 2004, tot: 2060, zit: 12, sta: 0, vmax: 300, acc: 2, prijs: 13e6, km: 16, energie: 'kerosine', pers: 2, leven: 20, baan: 0, gras: true, wie: 'offshore, ANWB MAA' },
];

export const TYPE = Object.fromEntries(VLOOT.map(v => [v.id, v]));
export function beschikbaar(jaar, modus) {
  return VLOOT.filter(v => v.van <= jaar && v.tot >= jaar && (!modus || v.modus === modus));
}
// Welk materieel een bestaande vervoerder waarschijnlijk inzet voor een modus
export function standaardType(vervoerder, modus, jaar = 2026) {
  const lijst = beschikbaar(jaar, modus);
  if (!lijst.length) {
    // geen type uit precies dit jaar: neem het type van deze modus dat er het dichtst bij zit
    const zelfde = VLOOT.filter(v => v.modus === modus);
    return zelfde.sort((a, b) => Math.max(a.van - jaar, jaar - a.tot, 0) - Math.max(b.van - jaar, jaar - b.tot, 0))[0] || VLOOT[0];
  }
  const n = (vervoerder || '').toLowerCase();
  const pas = lijst.find(v => v.wie.toLowerCase().split(/[ ,()]+/).some(w => w.length > 2 && n.includes(w)));
  return pas || lijst[lijst.length - 1];
}
