# OV-manager — OV-simulator van Nederland

Speel: **https://brennyc86.github.io/ov-simulator/**

Run je eigen OV-bedrijf: begin blanco of neem een echte vervoerder over, leg bus-, tram-, metro-, trein-, veer- en watertaxilijnen aan, maak een dienstregeling, koop echt materieel en stem je tijden af met andere vervoerders, ProRail en de provincie.

## Bronnen
- Achtergrondkaart: PDOK BRT-Achtergrondkaart en luchtfoto; historisch: Kadaster Topotijdreis (1815–2015)
- Spoornet, stations, wissels, veren, plaatsen: OpenStreetMap (Overpass), `tools/osm.py`
- Dienstregeling: OVapi GTFS (`gtfs.ovapi.nl`), `tools/gtfs.py`
- Wegroutes voor bussen: OSRM-demoserver

De data wordt maandelijks (en handmatig via *Actions → Kaartdata en dienstregeling verversen*) opnieuw gegenereerd en op de tak `data` gezet; de site-workflow voegt die bij het publiceren toe.

## Inloggen
Google en Microsoft via Firebase-project `brennycc86-apps` (gedeeld met Tijdkompas). De Firestore-regels voor `apps/knooppunt/...` staan in `tijdkompas/firestore.rules`.

## Testen

`tests/rook.mjs` speelt het hele spel in Node (linkedom + nep-MapLibre): start een spel, opent alle panelen,
laat de klok lopen, klikt op een voertuig en op alle knoppen in het ritpaneel, en meet of heen- en terugritten
elk rechts op hun eigen spoor rijden.

```bash
git archive origin/data | tar -x -C data      # data van de data-tak (data/ staat in .gitignore)
cd tests && npm install && cd ..
node tests/rook.mjs 2026 gtfs:IFF:NS          # of: node tests/rook.mjs 1925
```
