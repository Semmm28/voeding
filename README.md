# Voeding

Een lokale, offline-first PWA die zonder backend en zonder AI een voedingsschema,
receptenoverzicht en boodschappenlijst maakt. De planner draait volledig in de
browser en bewaart persoonlijke instellingen en schema's in IndexedDB.

## Belangrijk over voedingswaarden

De app berekent elk recept opnieuw uit de gramhoeveelheden en de waarden per
100 gram van de gekoppelde ingrediënten. De meegeleverde catalogus is een
bruikbare MVP-startset, maar is **nog geen volledig geaudite NEVO-export**.
Generieke startwaarden zijn als referentiewaarde gemarkeerd; bij samengestelde
of merkafhankelijke producten blijft het etiket leidend. Voor professioneel of
medisch gebruik moeten de ingrediënten eerst één voor één aan een exacte
NEVO-code of een gecontroleerd productetiket worden gekoppeld.

NEVO is het officiële Nederlandse voedingsstoffenbestand van het RIVM:
<https://www.rivm.nl/nederlands-voedingsstoffenbestand>.

De opgeslagen prijzen zijn indicatieve startwaarden in de lokale catalogus. Ze
zijn niet bedoeld als actuele supermarktprijzen.

## Functies

- Schema's voor één tot zeven dagen en drie, vier of vijf eetmomenten.
- Doelen voor kcal, eiwit, koolhydraten en vet.
- Filters voor dieet, allergenen, ongewenste ingrediënten, tijd en budget.
- Lokale optimalisatie op doelen, variatie, bereidingstijd en kosten.
- Acties per maaltijd: meer eiwit, goedkoper, sneller en vervangen.
- Dagen staan standaard compact met zichtbare dagtotalen en zijn afzonderlijk uitklapbaar.
- Een maaltijd opent met één klik direct het bijbehorende recept.
- Duidelijke waarschuwingen wanneer filters of doelen niet haalbaar zijn.
- Recepten zoeken en filteren, met berekende voedingswaarden.
- Automatisch samengevoegde boodschappenlijst.
- JSON-back-up en herstel van persoonlijke gegevens.
- Offline app-shell via een serviceworker die alleen eigen `voeding-pwa-*`
  caches beheert.
- Geen account, tracking, externe API of AI.

## Lokaal draaien

ES modules en serviceworkers vereisen een lokale webserver. Bijvoorbeeld:

```bash
python -m http.server 8080
```

Open daarna <http://localhost:8080>. Een serviceworker werkt op `localhost` of
via HTTPS; rechtstreeks openen als `file://` is onvoldoende.

## Controleren

Er zijn geen runtime-dependencies. Met Node.js 20 of nieuwer:

```bash
npm run check
```

Dit voert de catalogusvalidatie en alle unit-tests uit. De validator controleert
onder meer unieke IDs, receptverwijzingen, portiegrenzen, voedingsvelden en
voldoende dekking per eetmoment.

## GitHub Pages

De workflow in `.github/workflows/pages.yml` test elke wijziging. Na een push
naar `main` wordt de statische site als GitHub Pages-artifact gepubliceerd.
GitHub Pages moet in de repository-instellingen als bron **GitHub Actions**
gebruiken.

## Gegevens en privacy

Ingebouwde ingrediënten en recepten zijn read-only. De opslaglaag staat alleen
persoonlijke kopieën toe en weigert dat een ingebouwde ID wordt overschreven.
Instellingen, schema's, persoonlijke records en back-upmetadata blijven lokaal
in de browser, tenzij de gebruiker zelf een JSON-back-up exporteert.

Een JSON-back-up wordt structureel gevalideerd voordat hij wordt geïmporteerd.
Onbekende velden en gevaarlijke objectsleutels worden geweigerd; het bestand
wordt nooit als code uitgevoerd.

## Projectstructuur

```text
assets/                 vormgeving en PWA-iconen
scripts/                catalogusvalidatie
src/data/               lokale ingrediënten en recepten
src/engine/             voedingsberekening en planner
src/storage/            IndexedDB en back-ups
src/ui/                 veilige DOM-rendering
src/app.js              integratie en browserinteracties
tests/                  unit- en integriteitstests
sw.js                   offline cache
manifest.webmanifest    PWA-manifest
```
