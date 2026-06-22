# Hafenkampf Discord Bot

Dieser Bot hilft dir, Hafenschlachten in `World of Sea Battle` zu planen.

Funktionen:

- `/schlacht-anlegen` erstellt eine neue Hafenschlacht
- Der Bot postet eine Uebersicht mit allen wichtigen Infos
- Die Schlachterstellung nutzt feste Schiffsauswahlen aus einer lokalen Datenbank
- Die Schiffsdaten sind in `data/ships.json` nach `tree` getrennt
- `/schlacht-anlegen` arbeitet jetzt in 3 Schritten mit Input-Feldern
- Datum, Uhrzeit und Schiffklassen werden ueber Select-Felder statt Freitext gesetzt
- Das Treffpunktdatum ist immer identisch mit dem Schlachtdatum
- Die Treffpunktuhrzeit wird aktuell frei per Feld eingetragen
- Schiffsklassen werden beim Anlegen per Mehrfachauswahl ueber Select-Feld ausgewaehlt
- Mitglieder koennen sich ueber ein Auswahlmenue genau in die vom Ersteller vorgegebenen Klasse-Stufe-Kombinationen eintragen
- Mitglieder koennen ihre Anmeldung wieder entfernen
- Der Bot zeigt aktuelle Anmeldungen im Verhaeltnis zur maximalen Spielerzahl
- Volle Schlachten koennen nicht ueberbucht werden
- Daten werden lokal in `data/battles.json` gespeichert

## Voraussetzungen

- Node.js 22 oder neuer
- Ein Discord Bot mit aktivierten Privileged Gateway Intents ist nicht noetig

## Installation

1. Abhaengigkeiten installieren:

```bash
npm install
```

2. `.env.example` nach `.env` kopieren und ausfuellen:

```env
DISCORD_TOKEN=dein_bot_token
CLIENT_ID=deine_application_id
GUILD_ID=deine_test_server_id
```

`GUILD_ID` ist optional, aber fuer Tests empfohlen, weil Slash-Commands dann sofort sichtbar sind.

3. Bot starten:

```bash
npm start
```

## Slash-Command

Der Command `/schlacht-anlegen` erwartet keine direkten Slash-Optionen mehr.

Der Ablauf ist:

1. Allgemeine Angaben
   Name sowie getrennte Gildenfelder
2. Treffpunkt
   Ort, Datum und Uhrzeit
3. Flotte
   Anzahl Personen, Schiffklassen und Schiffstufen

Wichtig:

- Zwischen den Schritten gibt es jeweils einen `Weiter`-Button, weil Discord kein Modal direkt aus einem anderen Modal oeffnen kann.
- Fuer `Ausrichtende Gilde`, `Unterstuetzende Gilden` und `Gegnerische Gilde` gibt es eigene Input-Felder.
- Schlacht-Ort wird aktuell per Select-Feld aus der Liste der verfuegbaren Orte gewaehlt.
- Schlachtdatum wird ueber ein Datums-Select gesetzt.
- Schlachtuhrzeit wird ueber zwei Select-Felder gesetzt: Stunde und Minute.
- Treffpunkt-Ort und Treffpunkt-Datum werden ebenfalls ueber Select-Felder gesetzt.
- Schiffsklassen werden ueber ein Mehrfachauswahl-Select gesetzt.
- Spieleranzahl wird ueber ein Select-Feld gesetzt.
- Schiffstufen werden kommagetrennt eingegeben, z. B. `1,2,3`
- Wenn aus Klassen x Stufen mehr als 25 Anmeldeoptionen entstehen, blockiert der Bot die Erstellung, weil Discord-Select-Menues nur 25 Optionen erlauben.

Die Datenbank ist aktuell in diese Trees getrennt:

- `fast`
- `combat`
- `heavy`
- `siege`
- `imperial`

Beim Anlegen einer Schlacht sind `schiff_tree`, `schiff_name` und freie `schiffskategorien` nicht noetig.
Die Anmeldung laeuft ueber die ausgewaehlten Kombinationen aus Schiffsklasse und Schiffsstufe der Schlacht.

Beispiel fuer `schiffskategorien`:

```text
Linienschiff, Fregatte, Support
```

## Naechste sinnvolle Erweiterungen

- Rollenbasierte Rechte fuer Schlachtleiter
- `/schlacht-liste` und `/schlacht-schliessen`
- Automatische Erinnerungen vor Treffpunkt und Kampfbeginn
- Export der Anmeldungen als Text oder CSV
