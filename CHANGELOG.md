# Changelog

## 1.2.1

- Das macOS-Paket ist etwa 20 % kleiner (rund 160 statt 200 MB), weil das Disk-Image jetzt mit LZMA gepackt wird. Dafür braucht es macOS 10.15 oder neuer. Der Build prüft vor dem Hochladen, dass das Image sich öffnen lässt und die App darin gültig signiert ist.

## 1.2.0

- Neu: Texterkennung für Bilder. Fotos und Screenshots (PNG, JPG, WebP, BMP) werden jetzt gelesen, auf Deutsch und Englisch, komplett offline. Dafür muss nichts installiert werden, die Erkennung ist in der App eingebaut. Bilder ohne Text ergeben einen kurzen Hinweis.
- Dafür ist die App größer geworden: Das macOS-Paket wächst von etwa 91 auf 189 MB. Updates laden entsprechend mehr herunter.
- Die Erkennung läuft wie die Umwandlung in einem eigenen Prozess und fällt unter das Zeitlimit.
- Der Build prüft jetzt vor dem Paketieren, dass eine Textdatei und ein Bild mit Text im gepackten Backend umgewandelt werden.

## 1.1.3

- Windows: Der Installer und der Deinstaller zeigen jetzt das App-Icon statt des Standard-Symbols.
- Kommt die Umwandlungs-Engine nicht hoch, zeigt die App das jetzt deutlich an (rote Anzeige in der Seitenleiste und ein Hinweis mit dem Ort des Protokolls). Das Protokoll des letzten Starts bleibt als `backend.previous.log` erhalten.
- Dokumente ohne lesbaren Text (z. B. gescannte PDFs) liefern einen kurzen Hinweis, der sie nicht mehr als „Bild“ bezeichnet.
- Hochgeladene Dateien im Browser-Modus werden nach der Umwandlung sofort gelöscht, nicht erst nach 24 Stunden.
- Das Backend nimmt nur noch gültige Werte für die Namenskollision an, „Speichern“ legt keine fehlenden Ordner mehr an, und ein Test hängt nicht mehr an einer festen MarkItDown-Version.

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
