# Changelog

## 1.1.3

- Editor: „Tabellen“, „Bereinigen“ und „+TOC“ melden jetzt einen Fehler, wenn das Backend die Anfrage ablehnt, statt Erfolg zu melden. Beim Speichern aus dem Editor erscheint der echte Grund (zum Beispiel „Der Zielordner existiert nicht“).
- Intern aufgeräumt, ohne Änderung am Verhalten: Das Backend (`api.py`) und die Oberfläche (`App.tsx`, Editor, Stylesheet) sind in kleinere Module zerlegt, und es gibt Tests für die Warteschlange, die Einstellungen und den API-Client.
## 1.1.2

- Weniger Speicherverbrauch nach großen Stapeln: Die Umwandlungsprozesse mit den geladenen Erkennungsmodellen werden nach fünf Minuten Leerlauf beendet und nach 50 Dateien durch frische ersetzt.
- Kleine Updates der Oberfläche (Tauri-Bibliotheken, marked, vite, lucide-react, oxlint). `THIRD_PARTY_NOTICES.md` ist auf dem aktuellen Stand.
- Im Repository: `CONTRIBUTING.md`, Vorlage für Pull Requests, `.editorconfig`, und die Pakete nur für Tests stehen getrennt in `requirements-dev.in`.
## 1.1.1

- Die Markdown-Helfer im Editor lassen Code-Blöcke jetzt unverändert: „Tabellen ausrichten“ und „Leerzeilen aufräumen“ greifen nicht mehr in Code ein, und das Inhaltsverzeichnis übernimmt keine `#`-Zeilen aus Code. Tabellenzellen mit maskiertem Strich (`\|`) bleiben heil, und doppelte Überschriften bekommen wie auf GitHub nummerierte Anker.
- Ordner-Überwachung: Wer sie beendet und sofort wieder startet, während noch eine Datei umgewandelt wird, bekommt keine zweite, doppelte Überwachung mehr.
- Einstellungen und Verlauf: Scheitert das Speichern, zeigt die App jetzt eine Fehlermeldung statt stillschweigend weiterzumachen. Eine beschädigte `history.json` oder `settings.json` wird als `.corrupt` beiseitegelegt und nicht beim nächsten Speichern überschrieben.
- Unter der Haube: Python-Prüfung mit ruff in der CI, Python-Tests auch unter macOS, und der Installer-Build läuft ohne neue Version nur noch, wenn sich etwas Relevantes geändert hat.
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
