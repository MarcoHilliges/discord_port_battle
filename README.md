# Hafenkampf Discord Bot

Dieser Bot hilft dir, Hafenschlachten in `World of Sea Battle` zu planen.

Funktionen:

- `/schlacht-anlegen` erstellt eine neue Hafenschlacht
- Der Bot postet eine Uebersicht mit allen wichtigen Infos
- Mitglieder koennen sich ueber ein Auswahlmenue in eine Schiffskategorie eintragen
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

Der Command `/schlacht-anlegen` erwartet:

- `titel`
- `schlacht_zeit`
- `schlacht_ort`
- `treffpunkt_zeit`
- `treffpunkt_ort`
- `spielerzahl`
- `schiffskategorien`
- `stufen`
- `unterstuetzende_gilden`
- `gegnerische_gilde`

Beispiel fuer `schiffskategorien`:

```text
Linienschiff, Fregatte, Support
```

Beispiel fuer `stufen`:

```text
6-8
```

## Naechste sinnvolle Erweiterungen

- Rollenbasierte Rechte fuer Schlachtleiter
- `/schlacht-liste` und `/schlacht-schliessen`
- Automatische Erinnerungen vor Treffpunkt und Kampfbeginn
- Export der Anmeldungen als Text oder CSV
