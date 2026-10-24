"""Worker processes, the conversion timeout, the folder watcher and the image fallback."""

from backend.tests._isolation import TEST_BASE_URL  # noqa: F401  (must come first)
import os
import pathlib
import tempfile
import time
import unittest

from backend.engine import ConversionEngine
from backend.isolation import ConversionPool, ConversionTimeout, WorkerCrashed
from backend.tests import _workers
from backend.watcher import FolderWatcher


class TestConversionPool(unittest.TestCase):
    def test_converts_in_a_worker_and_reuses_it(self):
        pool = ConversionPool(size=1)
        try:
            with tempfile.TemporaryDirectory() as tmp:
                src = pathlib.Path(tmp) / "a.txt"
                src.write_text("Hallo Welt", encoding="utf-8")
                text, _ = pool.convert(str(src), False, timeout=60)
                self.assertIn("Hallo Welt", text)
                worker = pool._idle[0]
                pool.convert(str(src), False, timeout=60)
                self.assertIs(pool._idle[0], worker)
        finally:
            pool.shutdown()

    def test_timeout_kills_the_worker(self):
        pool = ConversionPool(size=1, worker_target=_workers.hanging_worker)
        try:
            started = time.monotonic()
            with self.assertRaises(ConversionTimeout):
                pool.convert("x", False, timeout=0.5)
            self.assertLess(time.monotonic() - started, 30)
            self.assertEqual(pool._idle, [])
        finally:
            pool.shutdown()

    def test_dead_worker_is_reported(self):
        pool = ConversionPool(size=1, worker_target=_workers.crashing_worker)
        try:
            with self.assertRaises(WorkerCrashed):
                pool.convert("x", False, timeout=30)
        finally:
            pool.shutdown()


class TestEngineTimeout(unittest.TestCase):
    def test_timeout_result_is_a_normal_failure(self):
        engine = ConversionEngine()
        engine._pool = ConversionPool(size=1, worker_target=_workers.hanging_worker)
        try:
            with tempfile.TemporaryDirectory() as tmp:
                src = pathlib.Path(tmp) / "slow.txt"
                src.write_text("x")
                res = engine.convert_file(str(src), save=False, timeout=0.5)
            self.assertFalse(res["success"])
            self.assertIn("Zeitüberschreitung", res["error"])
            self.assertTrue(res["solution_hint"])
        finally:
            engine._pool.shutdown()

    def test_isolated_conversion_matches_in_process(self):
        engine = ConversionEngine()
        try:
            with tempfile.TemporaryDirectory() as tmp:
                src = pathlib.Path(tmp) / "t.csv"
                src.write_text("a,b\n1,2\n")
                direct = engine.convert_file(str(src), save=False)
                isolated = engine.convert_file(str(src), save=False, timeout=60)
            self.assertTrue(isolated["success"])
            self.assertEqual(isolated["markdown"], direct["markdown"])
        finally:
            engine._pool.shutdown()

    def test_keep_data_uris_reaches_the_converter(self):
        import base64
        engine = ConversionEngine()
        png = base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 400).decode()
        html = f'<html><body><p>x</p><img alt="pic" src="data:image/png;base64,{png}"></body></html>'
        with tempfile.TemporaryDirectory() as tmp:
            src = pathlib.Path(tmp) / "img.html"
            src.write_text(html)
            dropped = engine.convert_file(str(src), save=False, keep_data_uris=False)
            kept = engine.convert_file(str(src), save=False, keep_data_uris=True)
        self.assertNotIn(png, dropped["markdown"])
        self.assertIn(png, kept["markdown"])


class TestWatcherFailures(unittest.TestCase):
    def test_failed_file_is_not_retried_until_it_changes(self):
        calls = []

        def fail(src, out):
            calls.append(src)
            return {"success": False, "error": "kaputt"}

        with tempfile.TemporaryDirectory() as inbox:
            w = FolderWatcher(convert_fn=fail)
            w.start(inbox_dir=inbox)
            try:
                bad = pathlib.Path(inbox) / "bad.pdf"
                bad.write_bytes(b"not a pdf")
                time.sleep(4)
                self.assertEqual(len(calls), 1)
                self.assertIn("bad.pdf", w.get_status()["last_error"])
                bad.write_bytes(b"still not a pdf, but different")
                os.utime(bad, (time.time() + 5, time.time() + 5))
                time.sleep(3)
                self.assertEqual(len(calls), 2)
            finally:
                w.stop()

    def test_watcher_uses_the_given_extension_list(self):
        calls = []
        with tempfile.TemporaryDirectory() as inbox:
            w = FolderWatcher(convert_fn=lambda s, o: calls.append(s) or {"success": True}, supported_fn=lambda: {".tsv"})
            w.start(inbox_dir=inbox)
            try:
                (pathlib.Path(inbox) / "a.tsv").write_text("a\tb\n")
                (pathlib.Path(inbox) / "b.pdf").write_bytes(b"x")
                time.sleep(3)
            finally:
                w.stop()
        self.assertEqual([os.path.basename(c) for c in calls], ["a.tsv"])


class TestEmptyResults(unittest.TestCase):
    def test_pdf_without_text_is_not_called_an_image(self):
        engine = ConversionEngine()
        with tempfile.TemporaryDirectory() as tmp:
            src = pathlib.Path(tmp) / "scan.pdf"
            src.write_bytes(b"%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF")
            res = engine.convert_file(str(src), save=False)
        self.assertTrue(res["success"])
        self.assertIn("kein Text gefunden", res["markdown"])
        self.assertNotIn("Bild", res["markdown"])


class TestImageFallback(unittest.TestCase):
    def test_note_has_no_path_and_no_metadata_table(self):
        from unittest import mock
        from PIL import Image
        from backend import ocr_service
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "foto.png")
            Image.new("RGB", (4, 3)).save(path)
            with mock.patch.object(ocr_service, "run_local_ocr_if_available", return_value=None):
                out = ocr_service.extract_image_visual_markdown(path)
            self.assertFalse(out["has_ocr"])
            self.assertIn("foto.png", out["markdown"])
            self.assertNotIn(tmp, out["markdown"])
            self.assertNotIn("|", out["markdown"])
            with mock.patch.object(ocr_service, "run_local_ocr_if_available", return_value="Erkannter Text"):
                out = ocr_service.extract_image_visual_markdown(path)
            self.assertEqual(out["markdown"].strip(), "Erkannter Text")


if __name__ == "__main__":
    unittest.main()
