"""
Tests for new features:
- Filename Templates
- Markdown Linter (table alignment, whitespace, TOC)
- Folder Watcher Service
- New API Endpoints
"""

import os
import sys
import unittest
import tempfile
import pathlib

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.tests._isolation import TEST_BASE_URL  # noqa: E402  (must come before backend imports)

from fastapi.testclient import TestClient
from backend.api import app, engine
from backend.linter import clean_blank_lines, format_markdown_tables, generate_toc
from backend.watcher import FolderWatcher

client = TestClient(app, base_url=TEST_BASE_URL)

class TestNewFeatures(unittest.TestCase):

    def test_filename_template(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
            src_path = f.name
        try:
            target_path = engine.compute_target_path(
                source_path=src_path,
                filename_template="[MD] {name}_{date}.md"
            )
            base_name = pathlib.Path(src_path).stem
            self.assertTrue(target_path.endswith(".md"))
            self.assertIn(f"[MD] {base_name}", target_path)
        finally:
            if os.path.exists(src_path):
                os.remove(src_path)

    def test_linter_table_formatting(self):
        raw_table = "| Name | Role |\n|---|---|\n| Alice | Software Engineer |\n| Bob | Designer |"
        formatted = format_markdown_tables(raw_table)
        self.assertIn("| Name  | Role              |", formatted)
        self.assertIn("| Alice | Software Engineer |", formatted)

    def test_linter_whitespace(self):
        messy = "Line 1   \n\n\n\nLine 2   "
        cleaned = clean_blank_lines(messy)
        self.assertNotIn("\n\n\n", cleaned)
        self.assertIn("Line 1\n\nLine 2", cleaned)

    def test_linter_toc_generation(self):
        doc = "# Chapter 1\nText\n## Section 1.1\nMore text"
        with_toc = generate_toc(doc)
        self.assertIn("## Inhaltsverzeichnis", with_toc)
        self.assertIn("* [Chapter 1](#chapter-1)", with_toc)
        self.assertIn("* [Section 1.1](#section-11)", with_toc)

    def test_linter_api_endpoints(self):
        res = client.post("/api/linter/format-tables", json={"content": "| A | B |\n|---|---|\n| 1 | 2 |"})
        self.assertEqual(res.status_code, 200)
        self.assertIn("formatted", res.json())

        res_toc = client.post("/api/linter/generate-toc", json={"content": "# Test Title\nContent"})
        self.assertEqual(res_toc.status_code, 200)
        self.assertIn("Inhaltsverzeichnis", res_toc.json()["formatted"])

    def test_watcher_lifecycle(self):
        with tempfile.TemporaryDirectory() as tmp_in, tempfile.TemporaryDirectory() as tmp_out:
            w = FolderWatcher(convert_fn=lambda s, o: {"success": True})
            status = w.get_status()
            self.assertFalse(status["is_running"])

            start_res = w.start(inbox_dir=tmp_in, output_dir=tmp_out)
            self.assertTrue(start_res["is_running"])
            self.assertTrue(w.is_running)

            stop_res = w.stop()
            self.assertFalse(stop_res["is_running"])
            self.assertFalse(w.is_running)

    def test_watcher_api_endpoints(self):
        with tempfile.TemporaryDirectory() as tmp_in, tempfile.TemporaryDirectory() as tmp_out:
            res_start = client.post("/api/watcher/start", json={"inbox_dir": tmp_in, "output_dir": tmp_out})
            self.assertEqual(res_start.status_code, 200)
            self.assertTrue(res_start.json()["is_running"])

            res_status = client.get("/api/watcher/status")
            self.assertEqual(res_status.status_code, 200)
            self.assertTrue(res_status.json()["is_running"])

            res_stop = client.post("/api/watcher/stop")
            self.assertEqual(res_stop.status_code, 200)
            self.assertFalse(res_stop.json()["is_running"])


class TestDiagnostics(unittest.TestCase):
    def test_installed_version_known_and_unknown(self):
        from backend.system_info import get_installed_version
        self.assertNotEqual(get_installed_version("pdfminer.six"), "Nicht installiert")
        self.assertEqual(get_installed_version("definitely-not-a-package"), "Nicht installiert")

    def test_no_audio_capability_without_support(self):
        from backend.system_info import get_format_capabilities
        self.assertNotIn("audio", [c["id"] for c in get_format_capabilities()])


class TestSafeTargetNames(unittest.TestCase):
    def test_template_cannot_escape_target_dir(self):
        import tempfile, os
        from backend.engine import ConversionEngine
        engine = ConversionEngine()
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "doc.txt")
            open(src, "w").close()
            out = os.path.join(tmp, "out")
            target = engine.compute_target_path(src, target_dir=out, filename_template="../../evil_{name}")
            self.assertEqual(os.path.dirname(os.path.realpath(target)), os.path.realpath(out))
            self.assertTrue(target.endswith(".md"))

    def test_prefix_with_separator_is_neutralised(self):
        import tempfile, os
        from backend.engine import ConversionEngine
        engine = ConversionEngine()
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "doc.txt")
            open(src, "w").close()
            target = engine.compute_target_path(src, target_dir=tmp, naming_strategy="prefix", custom_prefix="../")
            self.assertEqual(os.path.dirname(os.path.realpath(target)), os.path.realpath(tmp))

    def test_watcher_expands_home(self):
        import os, tempfile
        from unittest import mock
        from backend.watcher import FolderWatcher
        with tempfile.TemporaryDirectory() as home:
            with mock.patch.dict(os.environ, {"HOME": home, "USERPROFILE": home}):
                watcher = FolderWatcher(convert_fn=lambda s, o: {"success": True})
                try:
                    watcher.start(inbox_dir="~/Inbox")
                    self.assertEqual(os.path.realpath(watcher.inbox_dir), os.path.realpath(os.path.join(home, "Inbox")))
                finally:
                    watcher.stop()

if __name__ == "__main__":
    unittest.main()


class TestDataMigration(unittest.TestCase):
    def test_legacy_history_is_copied_once(self):
        from unittest import mock
        from backend import api as api_module
        with tempfile.TemporaryDirectory() as legacy, tempfile.TemporaryDirectory() as new:
            with open(os.path.join(legacy, "history.json"), "w") as fh:
                fh.write("[]")
            with mock.patch.object(api_module, "LEGACY_DATA_DIR", legacy), mock.patch.object(api_module, "DATA_DIR", new):
                api_module.migrate_legacy_data()
            self.assertTrue(os.path.isfile(os.path.join(new, "history.json")))
