# Mitmachen

Fehler, Ideen und Pull Requests sind willkommen. Es ist ein privates Projekt, ich antworte also nicht immer sofort.

- **Fehler melden:** über [Fehler melden](https://github.com/MHabachia/markitdown-desktop/issues/new/choose). Hilfreich sind die App-Version (unter „Über MarkItDown“), das System und, wenn möglich, eine Beispieldatei oder `backend.log` (Ort steht im README).
- **Sicherheitslücken:** bitte nicht als Issue, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.
- **Größere Änderungen:** erst ein Issue aufmachen, dann ist klar, ob es zur App passt.

## Entwickeln

Einrichtung, Tests und Build stehen im Abschnitt „Selbst bauen“ des [README](README.md). Vor einem Pull Request sollte lokal laufen:

```bash
npm test                # Python-Tests des Backends
npm run test:ui         # Vitest
npm run lint            # oxlint
npx tsc --noEmit        # TypeScript
.venv/bin/ruff check backend scripts    # Python
```

Die CI führt dasselbe aus, dazu die Browser-Tests (Playwright) und eine Prüfung der Rust-Pakete.

## Regeln

- Ein Pull Request, ein Thema. Kleine, gut lesbare Änderungen sind schneller geprüft.
- Neues Verhalten bekommt einen Test, ein Fehler bekommt einen Test, der ohne die Korrektur fehlschlägt.
- Die Oberfläche und die Texte sind auf Deutsch. Code und Kommentare sind auf Englisch.
- Python-Pakete werden nicht von Hand in `requirements.txt` geändert, sondern über die `.in`-Dateien und `uv` neu erzeugt (Befehle im README).
- Die Versionsnummer ändert nur, wer ein Release auslösen will: `npm run version:set -- X.Y.Z` und ein Abschnitt in `CHANGELOG.md`.
