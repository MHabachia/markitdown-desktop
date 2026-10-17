# MarkItDown Desktop

Eine kleine Desktop-App für macOS (Apple-Chip) und Windows, mit der man PDFs, Office-Dateien, Webseiten und Tabellen in Markdown umwandelt. Unter der Haube arbeitet [MarkItDown](https://github.com/microsoft/markitdown) von Microsoft, die App drumherum macht es bequem: Dateien reinziehen, Ergebnis ansehen, speichern. Alles passiert auf dem eigenen Rechner, es wird nichts hochgeladen und nichts mitgeschnitten.

Gedacht ist sie für alle, die Unterlagen mit KI-Tools wie ChatGPT bearbeiten: Markdown ist für diese Tools deutlich kompakter als PDF oder Word, man spart also Tokens und bekommt bessere Antworten.

## Download

Die aktuellen Installer liegen unter [Releases](https://github.com/MHabachia/markitdown-desktop/releases):

- macOS (Apple-Chip, M1 und neuer): `…_macos-aarch64.dmg`
- Windows: `…_windows-x86_64.setup.exe`

Python braucht man dafür nicht, das steckt schon in der App. Neue Versionen bietet die App selbst an, unten links oder unter „Über MarkItDown“. Die beiden übrigen Dateien im Release (`…app.tar.gz` und `latest.json`) sind nur für diese automatischen Updates da.

Die App ist ein privates Projekt ohne Entwickler-Zertifikat. Deshalb fragt das System beim ersten Start einmal nach:

- **macOS:** Die App in den Programme-Ordner ziehen und öffnen. macOS meldet, dass der Entwickler nicht überprüft werden kann. Dann unter Systemeinstellungen → Datenschutz & Sicherheit ganz unten auf „Dennoch öffnen“ klicken und bestätigen. Das ist nur beim ersten Mal nötig. Klappt das nicht, hilft im Terminal: `xattr -dr com.apple.quarantine "/Applications/MarkItDown Desktop.app"`
- **Windows:** SmartScreen meldet einen unbekannten Herausgeber, über „Weitere Informationen → Trotzdem ausführen“ geht es weiter.

Der allererste Start dauert ein paar Sekunden länger, danach geht es schnell.

## So funktioniert es

1. Dateien oder einen ganzen Ordner ins Fenster ziehen (oder über die Knöpfe auswählen).
2. Auf „Umwandeln“ klicken. Es wird noch nichts gespeichert.
3. Das Ergebnis rechts in der Vorschau ansehen, bei Bedarf im Editor anpassen und dann speichern: einzeln, über „Speichern unter …“ oder alles auf einmal. Standardmäßig landet die `.md`-Datei neben dem Original.

Wer lieber ohne Zwischenschritt arbeitet, kann in den Einstellungen „Automatisch speichern“ einschalten. Für wiederkehrende Fälle gibt es außerdem die Ordner-Überwachung: Alles, was in einem festgelegten Eingangsordner landet, wird im Hintergrund umgewandelt.

Sonst noch drin: Dateinamen-Muster wie `{date}_{name}.md`, Regeln für bereits vorhandene Dateien, ZIP-Export, ein Verlauf, kleine Markdown-Helfer (Tabellen ausrichten, Leerzeilen aufräumen, Inhaltsverzeichnis) und ein Befehlsmenü über `⌘K` bzw. `Strg+K`. Hell, dunkel oder passend zum System geht auch.

## Formate

PDF, Word (`.docx`), PowerPoint (`.pptx`), Excel (`.xlsx`, `.xls`), HTML, CSV/TSV, JSON, XML, Text- und YAML-Dateien, Jupyter-Notebooks, ZIP-Archive und Bilder (dort werden die Metadaten ausgelesen). Audio-Transkription habe ich weggelassen, weil sie die App um ein Vielfaches größer machen würde.

## Selbst bauen

Gebraucht werden Python 3.12, Node.js ab 22.12 und Rust.

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r requirements-build.txt    # unter Windows: .venv\Scripts\pip
npm install

npm run tauri:dev     # App im Entwicklungsmodus
npm run start         # nur Oberfläche und Backend im Browser, http://localhost:5173
```

Tests:

```bash
npm test              # Backend
npm run test:ui       # Frontend
npm run lint
npx playwright install chromium && npm run test:e2e    # Ende-zu-Ende im Browser
```

Einen fertigen Installer baut `npm run tauri:build:standalone`. Dabei wird das Python-Backend mit PyInstaller verpackt und in die App gelegt.

Die Python-Pakete sind fest gepinnt. Die direkten Abhängigkeiten stehen in `requirements.in` und `requirements-build.in`, daraus erzeugt [uv](https://github.com/astral-sh/uv) die vollständigen Listen:

```bash
uv pip compile --universal --python-version 3.12 requirements.in -o requirements.txt
uv pip compile --universal --python-version 3.12 requirements-build.in -o requirements-build.txt
```

## Aufbau

```
backend/     FastAPI-Server, der MarkItDown aufruft (läuft nur lokal)
src/         Oberfläche in React und TypeScript
src-tauri/   Tauri-Hülle in Rust: Fenster, Dialoge, Updates, Start des Backends
scripts/     Backend-Build und Release-Hilfen
e2e/         Playwright-Tests
```

Beim Start sucht die App einen freien Port und erzeugt einen zufälligen Schlüssel, den nur Oberfläche und Backend kennen. Andere Programme oder Webseiten kommen so nicht an das Backend heran. Geschrieben werden nur Markdown- und ZIP-Dateien, und die Vorschau entfernt Skripte aus umgewandelten Dokumenten, bevor sie angezeigt werden.

Ins Internet geht die App nur für eine Sache: Kurz nach dem Start fragt sie bei GitHub nach, ob es eine neue Version gibt. Dabei werden keine Daten aus der App übertragen, und in den Einstellungen lässt sich das abschalten.

Verlauf und Einstellungen liegen im üblichen App-Ordner des Systems (`~/Library/Application Support/io.github.mhabachia.markitdown/` bzw. `%APPDATA%\io.github.mhabachia.markitdown\`). Wenn etwas hakt, hilft meist ein Blick in `backend.log` unter `~/Library/Logs/io.github.mhabachia.markitdown/` bzw. `%LOCALAPPDATA%\io.github.mhabachia.markitdown\logs\`.

## Releases

Es gibt zwei GitHub-Workflows. „Tests“ läuft bei jedem Push und Pull Request: Python-Unittests unter Ubuntu und Windows, Vitest-Unit-Tests, Lint und Typprüfung, der Frontend-Build, ein Kompiliertest des Rust-Teils, eine Prüfung der Rust-Abhängigkeiten auf bekannte Lücken und die Playwright-Tests. „Build & Release“ startet danach auf `main` und baut die Installer für macOS und Windows.

Für eine neue Version: `npm run version:set -- 1.2.0` ausführen (setzt die Nummer in allen Dateien), einen Abschnitt in `CHANGELOG.md` schreiben und pushen. Ist die Version neu, erstellt der Workflow das Release samt Update-Datei für die installierten Apps.

Damit installierte Apps Updates annehmen, werden die Update-Pakete mit einem eigenen Schlüssel signiert. Er liegt als Secret `TAURI_SIGNING_PRIVATE_KEY` im Repository; der passende öffentliche Schlüssel steht in `src-tauri/tauri.conf.json`.

Abhängigkeiten hält Dependabot aktuell: Kleine Updates (Patch und Minor) werden automatisch übernommen, sobald alle Tests grün sind; große Versionssprünge bleiben zur Durchsicht offen. Sicherheitsmeldungen bitte wie in [SECURITY.md](SECURITY.md) beschrieben.

## Lizenz

MIT. Die eigentliche Umwandlung übernimmt [Microsoft MarkItDown](https://github.com/microsoft/markitdown).
