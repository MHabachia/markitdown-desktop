# Changelog

## 1.1.2

- Das Zeitlimit gilt jetzt im Backend: Eine hängende Datei wird wirklich abgebrochen, statt im Hintergrund weiterzulaufen, und die Fehlermeldung nennt das Limit.
- „Data-URIs behalten“ in den Einstellungen wirkt jetzt tatsächlich.
- Ordner-Überwachung: Eine Datei, die nicht umgewandelt werden kann, wird nicht mehr jede Sekunde neu versucht (erst wieder, wenn sie sich ändert). Die Überwachung versteht dieselben Dateitypen wie die App, nutzt deine Einstellungen und trägt Ergebnisse in den Verlauf ein.
- Bilder ohne erkannten Text ergeben nur noch einen kurzen Hinweis statt einer Tabelle mit lokalem Dateipfad; das spart Tokens.
- Sicherheit: Pillow 13 (behebt mehrere teils kritische Lücken in der Bildverarbeitung), neueres certifi und OpenTelemetry sowie aktualisierte TLS-Pakete im Updater.
- Dependabot ist entfernt, Abhängigkeiten werden von Hand aktualisiert.

## 1.1.1

- macOS: Die App ist jetzt vollständig (ad hoc) signiert. Heruntergeladene Versionen werden von macOS nicht mehr als „beschädigt“ gemeldet, sondern lassen sich über Systemeinstellungen → Datenschutz & Sicherheit → „Dennoch öffnen“ starten.
- Export aus dem Editor (Markdown, HTML, Text) funktioniert in der App wieder, über einen „Speichern unter“-Dialog.
- Die automatische Update-Suche lässt sich in den Einstellungen abschalten.
- Sicherer: Die App öffnet nur noch Markdown-Dateien und akzeptiert in der fertigen Version keine Anfragen der Entwicklungsumgebung mehr.
- Aufgeräumt: Die Beispieldateien werden mitgeliefert statt erzeugt, dadurch fallen zwei Bibliotheken weg. Die Laufzeit für die Dateityperkennung ist auf einer aktuellen Version (dadurch ist der Download etwas größer).

## 1.1.0

Die App sieht jetzt deutlich anders aus und arbeitet in drei Schritten: Dateien wählen, umwandeln, prüfen und speichern.

- Umgewandelte Dateien werden nicht mehr sofort gespeichert. Man sieht sich das Ergebnis erst an und speichert dann einzeln, über „Speichern unter …“ oder alle zusammen. Wer das alte Verhalten möchte, schaltet „Automatisch speichern“ ein.
- Dateien und Ordner kommen über die normalen Systemdialoge oder per Drag & Drop in die App. Gespeichert wird danach wieder neben dem Original.
- Neue Ansicht mit Kacheln oder Liste, Vorschau daneben (die Breite lässt sich ziehen), helles und dunkles Design, neues Icon.
- Eigene Seiten für die Ordner-Überwachung und für „Über MarkItDown“.
- Die App kann sich selbst aktualisieren.
- Verlauf und Einstellungen liegen jetzt im App-Ordner des Systems und werden beim ersten Start übernommen.
- Unter der Haube: sicherere Verbindung zwischen Oberfläche und Backend, aufgeräumter Code, mehr Tests und feste Paketversionen.

## 1.0.0

Erste Version.
