"""
Unit and integration tests for MarkItDown Desktop Engine and API.
Tests real conversions for all supported document types.
"""

from backend.tests._isolation import TEST_BASE_URL  # noqa: F401  (must come first)
import os
import unittest
import tempfile
import pathlib

from backend.system_info import get_system_diagnostics, get_format_capabilities
from backend.engine import ConversionEngine
from backend.sample_generator import generate_sample_files

class TestMarkItDownEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = ConversionEngine()
        cls.temp_dir = tempfile.mkdtemp()
        cls.sample_files = generate_sample_files(cls.temp_dir)

    def test_01_diagnostics(self):
        diag = get_system_diagnostics()
        self.assertEqual(diag["status"], "ready")
        self.assertEqual(diag["engine"], "Microsoft MarkItDown")
        self.assertIn("0.1.8", diag["markitdown_version"])
        self.assertGreater(diag["ready_formats_count"], 5)

    def test_02_format_capabilities(self):
        caps = get_format_capabilities()
        ids = [c["id"] for c in caps]
        self.assertIn("pdf", ids)
        self.assertIn("docx", ids)
        self.assertIn("xlsx", ids)
        self.assertIn("html", ids)
        self.assertIn("csv", ids)
        self.assertIn("json", ids)

    def test_03_convert_text(self):
        res = self.engine.convert_file(self.sample_files["txt"])
        self.assertTrue(res["success"])
        self.assertIn("MarkItDown Desktop", res["markdown"])
        self.assertTrue(os.path.exists(res["target_path"]))

    def test_04_convert_html(self):
        res = self.engine.convert_file(self.sample_files["html"])
        self.assertTrue(res["success"])
        self.assertIn("MarkItDown Desktop Übersicht", res["markdown"])
        # Check markdown table conversion
        self.assertIn("| Format | Status | Engine |", res["markdown"])

    def test_05_convert_csv(self):
        res = self.engine.convert_file(self.sample_files["csv"])
        self.assertTrue(res["success"])
        self.assertIn("| Quartal |", res["markdown"])
        self.assertIn("Q1 2026", res["markdown"])

    def test_06_convert_json(self):
        res = self.engine.convert_file(self.sample_files["json"])
        self.assertTrue(res["success"])
        self.assertIn("MarkItDown Desktop", res["markdown"])

    def test_07_convert_excel(self):
        if "xlsx" in self.sample_files:
            res = self.engine.convert_file(self.sample_files["xlsx"])
            self.assertTrue(res["success"])
            self.assertIn("Projektphasen", res["markdown"])
            self.assertIn("Lead Architect", res["markdown"])

    def test_08_convert_pptx(self):
        if "pptx" in self.sample_files:
            res = self.engine.convert_file(self.sample_files["pptx"])
            self.assertTrue(res["success"])
            self.assertIn("MarkItDown Desktop", res["markdown"])

    def test_09_convert_pdf(self):
        if "pdf" in self.sample_files:
            res = self.engine.convert_file(self.sample_files["pdf"])
            self.assertTrue(res["success"])
            self.assertIn("MarkItDown Desktop", res["markdown"])

    def test_10_convert_docx(self):
        if "docx" in self.sample_files:
            res = self.engine.convert_file(self.sample_files["docx"])
            self.assertTrue(res["success"])
            self.assertIn("Produktspezifikation", res["markdown"])

    def test_11_collision_handling(self):
        # Test collision rename
        txt_path = self.sample_files["txt"]
        out_dir = os.path.join(self.temp_dir, "collision_test")
        os.makedirs(out_dir, exist_ok=True)

        res1 = self.engine.convert_file(txt_path, target_dir=out_dir, collision_strategy="rename")
        self.assertTrue(res1["success"])
        res2 = self.engine.convert_file(txt_path, target_dir=out_dir, collision_strategy="rename")
        self.assertTrue(res2["success"])
        self.assertNotEqual(res1["target_path"], res2["target_path"])
        self.assertIn("(1)", res2["target_path"])

    def test_12_error_handling_nonexistent(self):
        res = self.engine.convert_file("/non/existent/path/document.pdf")
        self.assertFalse(res["success"])
        self.assertIn("nicht gefunden", res["error"])
        self.assertIsNotNone(res["solution_hint"])

    def test_13_scan_directory(self):
        files = self.engine.scan_directory(self.temp_dir, recursive=True)
        self.assertGreater(len(files), 4)

if __name__ == "__main__":
    unittest.main()
