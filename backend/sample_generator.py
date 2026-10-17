"""
Generates authentic sample files for MarkItDown Desktop testing.
Creates real PDF, Word (docx), PowerPoint (pptx), Excel (xlsx), HTML, CSV, JSON, and Text documents.
"""

import os
import json
import csv
import pathlib

def ensure_samples_dir(target_dir: str = None) -> str:
    if target_dir is None:
        target_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "samples"))
    os.makedirs(target_dir, exist_ok=True)
    return target_dir

def generate_sample_files(target_dir: str = None) -> dict:
    target_dir = ensure_samples_dir(target_dir)
    generated = {}

    # 1. Plain Text
    txt_path = os.path.join(target_dir, "01_notizen.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(
            "MarkItDown Desktop - Notizen & Schnellstart\n"
            "===========================================\n\n"
            "Microsoft MarkItDown konvertiert verschiedenste Dokumentformate lokal und verlustarm in sauberes Markdown.\n"
            "- 100% lokale Ausführung ohne externen Server\n"
            "- Stapelverarbeitung für hunderte Dokumente\n"
            "- Integrierte Vorschau mit Syntax-Highlighting und Wortzähler\n"
        )
    generated["txt"] = txt_path

    # 2. HTML
    html_path = os.path.join(target_dir, "02_produktbericht.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(
            "<!DOCTYPE html>\n"
            "<html lang='de'>\n"
            "<head><meta charset='utf-8'><title>MarkItDown Produktbericht</title></head>\n"
            "<body>\n"
            "  <h1>MarkItDown Desktop Übersicht</h1>\n"
            "  <p>Ein modernes Werkzeug zur Aufbereitung von Unternehmensdokumenten für LLMs und Knowledge Bases.</p>\n"
            "  <h2>Vorteile im Überblick</h2>\n"
            "  <ul>\n"
            "    <li><b>Hohe Geschwindigkeit:</b> Lokale Konvertierung ohne Netzwerklatenz.</li>\n"
            "    <li><b>Datenschutz:</b> Keine Übermittlung an externe Cloud-Dienste.</li>\n"
            "    <li><b>Formatvielfalt:</b> PDF, Office, Tabellen, Webseiten und Code.</li>\n"
            "  </ul>\n"
            "  <h2>Funktionsmatrix</h2>\n"
            "  <table border='1'>\n"
            "    <tr><th>Format</th><th>Status</th><th>Engine</th></tr>\n"
            "    <tr><td>PDF</td><td>Aktiv</td><td>pdfminer.six</td></tr>\n"
            "    <tr><td>Word (.docx)</td><td>Aktiv</td><td>mammoth</td></tr>\n"
            "    <tr><td>Excel (.xlsx)</td><td>Aktiv</td><td>openpyxl</td></tr>\n"
            "  </table>\n"
            "</body>\n"
            "</html>\n"
        )
    generated["html"] = html_path

    # 3. CSV
    csv_path = os.path.join(target_dir, "03_finanzdaten.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["Quartal", "Umsatz (EUR)", "Wachstum", "Status"])
        writer.writerow(["Q1 2026", "125000", "+12.4%", "Bestätigt"])
        writer.writerow(["Q2 2026", "148000", "+18.4%", "Bestätigt"])
        writer.writerow(["Q3 2026", "162000", "+9.5%", "Bestätigt"])
        writer.writerow(["Q4 2026", "195000", "+20.3%", "Prognose"])
    generated["csv"] = csv_path

    # 4. JSON
    json_path = os.path.join(target_dir, "04_konfiguration.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "app": "MarkItDown Desktop",
            "version": "1.0.0",
            "engine": "Microsoft MarkItDown 0.1.8",
            "features": {
                "batch_processing": True,
                "offline_privacy": True,
                "markdown_split_view": True,
                "custom_collision_strategy": True
            },
            "supported_categories": ["Documents", "Spreadsheets", "Presentations", "Web", "Code"]
        }, f, indent=2, ensure_ascii=False)
    generated["json"] = json_path

    # 5. Excel (.xlsx)
    try:
        import openpyxl
        xlsx_path = os.path.join(target_dir, "05_projektplan.xlsx")
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Projektphasen"
        ws.append(["Phase", "Meilenstein", "Verantwortlich", "Status"])
        ws.append(["1. Architektur", "FastAPI Engine & UI Konzept", "Lead Architect", "Abgeschlossen"])
        ws.append(["2. MarkItDown", "Integration der offiziellen Engine", "Core Dev", "Abgeschlossen"])
        ws.append(["3. Desktop UI", "Dreigeteiltes Raycast/Linear Design", "UI Engineer", "In Bearbeitung"])
        ws.append(["4. Verifikation", "Automatisierte Tests & Build", "QA Engineer", "Geplant"])
        wb.save(xlsx_path)
        generated["xlsx"] = xlsx_path
    except Exception as e:
        print(f"Excel generation skipped: {e}")

    # 6. PowerPoint (.pptx)
    try:
        import pptx
        pptx_path = os.path.join(target_dir, "06_praesentation.pptx")
        prs = pptx.Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[0])
        slide.shapes.title.text = "MarkItDown Desktop"
        slide.placeholders[1].text = "Modernes Desktop UI für Microsoft MarkItDown\nPräsentiert auf modernem macOS & Windows"
        slide2 = prs.slides.add_slide(prs.slide_layouts[1])
        slide2.shapes.title.text = "Kernfunktionen"
        slide2.placeholders[1].text = "• Lokale Konvertierung\n• Markdown Vorschau & Editor\n• Stapelverarbeitung & Ordnerimport"
        prs.save(pptx_path)
        generated["pptx"] = pptx_path
    except Exception as e:
        print(f"PPTX generation skipped: {e}")

    # 7. PDF
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        pdf_path = os.path.join(target_dir, "07_handbuch.pdf")
        c = canvas.Canvas(pdf_path, pagesize=letter)
        c.setFont("Helvetica-Bold", 18)
        c.drawString(72, 720, "MarkItDown Desktop – Benutzerhandbuch")
        c.setFont("Helvetica", 12)
        c.drawString(72, 690, "Dies ist ein offizielles Beispieldokument zur Demonstration der PDF-Konvertierung.")
        c.drawString(72, 660, "Microsoft MarkItDown analysiert die Seitenstruktur und wandelt Textblöcke um.")
        c.drawString(72, 630, "1. Ziehe diese PDF-Datei in das MarkItDown Desktop-Fenster.")
        c.drawString(72, 610, "2. Klicke auf 'Konvertierung starten'.")
        c.drawString(72, 590, "3. Begutachte die formatierte Markdown-Vorschau im integrierten Editor.")
        c.save()
        generated["pdf"] = pdf_path
    except Exception as e:
        print(f"PDF generation skipped: {e}")

    # 8. Word (.docx)
    try:
        import docx
        docx_path = os.path.join(target_dir, "08_spezifikation.docx")
        doc = docx.Document()
        doc.add_heading("MarkItDown Desktop – Produktspezifikation", 0)
        p = doc.add_paragraph("Dieses Dokument wurde mit Microsoft Word (.docx) Struktur erstellt.")
        p.add_run(" Wichtige Passagen sind hervorgehoben.").bold = True
        doc.add_heading("Architekturmerkmale", level=1)
        doc.add_paragraph("• Saubere Trennung von UI, Dateiverarbeitung und Konvertierungslogik", style="List Bullet")
        doc.add_paragraph("• Native Desktop-Systemintegration mit Drag & Drop und Datei-Dialogen", style="List Bullet")
        doc.add_paragraph("• Fehlertolerante Stapelverarbeitung pro Datei", style="List Bullet")
        doc.save(docx_path)
        generated["docx"] = docx_path
    except Exception:
        # If python-docx not installed, test if we have another way or skip
        pass

    return generated

if __name__ == "__main__":
    res = generate_sample_files()
    print("Generated sample files:", res)
