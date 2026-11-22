# Echo Studio

**Die Karten deiner Echo Show (TECHO5) direkt in Home Assistant gestalten.**

Echo Studio fügt der Seitenleiste von Home Assistant eine Seite hinzu, auf der du bestimmst, was das
Dashboard der Echo Show zeigt und wie es aussieht:

- **Geräte auswählen:** ein Haken setzt das Label `echo`, nach Raum und Art gefiltert, mit Suche
- **Sortieren:** Karten in der Vorschau ziehen, Überschriften einfügen
- **Gestalten je Karte:** eigener Name, Symbol (mit Suche), eigenes Icon als Bild, Hintergrundbild,
  Farbe wenn an und wenn aus, Name oder Zustand ausblenden, Größe klein, breit oder groß
- **Vorschau** im Format der Echo Show
- **Deck** (Hilal OS, unter *Menü → Deck*): ein Stream Deck im Stil von Macro Deck für den Reiter
  „Deck“ der Show – Seiten mit einem Raster aus Tasten, die Geräte schalten, Szenen und Skripte
  starten, Seiten wie Ordner öffnen, am PC Tasten drücken (TECHO5-Deck-Programm) oder OBS steuern.
  Auf der Show ändert ein langer Druck Name, Farbe und Platz einer Taste; das erscheint hier von selbst.

Die Echo Show braucht dafür [TECHO5](https://github.com/HuskerMinion/techo5) mit der Wahl
**„Geräte mit Label echo“** unter **Dashboard to show** und **Dashboard: Drawn on the device**.

## Installation über HACS

1. **HACS → ⋮ → Benutzerdefinierte Repositories**, dieses Repository als **Integration** hinzufügen.
2. **Echo Studio** in HACS installieren und Home Assistant neu starten.
3. **Einstellungen → Geräte & Dienste → Integration hinzufügen → „Echo Studio“**.
4. In der Seitenleiste erscheint **Echo Studio** (nur für Administratoren).

## So kommt die Gestaltung auf die Echo Show

1. Auf der Echo Show (in Home Assistant beim Gerät, Karte *Konfiguration*): **Dashboard** auf
   *Drawn on the device* und **Dashboard to show** auf *Geräte mit Label echo*.
2. In Echo Studio Geräte anhaken, gestalten und **Speichern**.
3. Die Echo Show zeigt die neue Gestaltung, sobald ihr Dashboard neu öffnet, spätestens nach fünf
   Minuten.

## Wo die Daten liegen

- Die Gestaltung: in Home Assistant (`.storage/echo_studio.layout`)
- Eigene Bilder: im Ordner `echo_studio` der Home-Assistant-Konfiguration, ausgeliefert nur mit
  Anmeldung (die Echo Show nutzt ihren eigenen Zugang)
- Welche Geräte erscheinen: im Label `echo` der Entitäten

## Entwicklung

Die Oberfläche ist eine einzelne JavaScript-Datei ohne Bauschritt
(`custom_components/echo_studio/frontend/echo-studio-panel.js`). Die Prüfung der Gestaltung
(`layout.py`) hat Tests in `tests/`.
