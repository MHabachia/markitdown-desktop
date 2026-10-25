# Changelog

## 1.1.0

Erste veröffentlichte Version. Die App arbeitet in drei Schritten: Dateien wählen, umwandeln, prüfen und speichern.

- Umwandlung von PDF, Word, PowerPoint, Excel, HTML, CSV, JSON, XML, Text, Jupyter-Notebooks, ZIP-Archiven und Bildern in Markdown, komplett lokal.
- Texterkennung für Bilder (PNG, JPG, WebP, BMP) auf Deutsch und Englisch, offline und ohne Installation.
- Ergebnisse werden erst angezeigt und dann gespeichert: einzeln, über „Speichern unter …“ oder alle zusammen. Mit „Automatisch speichern“ geht es ohne Zwischenschritt.
- Kachel- und Listenansicht mit Vorschau und Editor, helles und dunkles Design, Befehlsmenü (`⌘K` bzw. `Strg+K`).
- Ordner-Überwachung, Verlauf, Dateinamen-Muster, Regeln für vorhandene Dateien und ZIP-Export.
- Zeitlimit pro Dokument: Eine hängende Datei wird wirklich abgebrochen.
- Die App kann sich selbst aktualisieren (abschaltbar in den Einstellungen).
- Sicherheit: Die Oberfläche spricht mit dem Backend nur über einen zufälligen Port und ein Token, die Updates sind signiert, die Lizenzen aller mitgelieferten Bibliotheken stehen in `THIRD_PARTY_NOTICES.md`.
- macOS: Die App ist ad hoc signiert, beim ersten Start ist „Dennoch öffnen“ nötig. Windows: Der Installer zeigt das App-Icon.
