"""Worker processes, the conversion timeout, the folder watcher and the image fallback."""

from backend.tests._isolation import TEST_BASE_URL  # noqa: F401  (must come first)
import os
import pathlib
import tempfile
import threading
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
                text, _, _ = pool.convert(str(src), False, timeout=60)
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


class TestWorkerLifetime(unittest.TestCase):
    def test_worker_is_replaced_after_its_job_limit(self):
        pool = ConversionPool(size=1, worker_target=_workers.echo_worker, max_jobs=2)
        try:
            pool.convert("x", False, timeout=30)
            first = pool._idle[0]
            pool.convert("x", False, timeout=30)  # second job reaches the limit
            self.assertEqual(pool._idle, [])
            self.assertFalse(first.process.is_alive())
            pool.convert("x", False, timeout=30)
            self.assertIsNot(pool._idle[0], first)
        finally:
            pool.shutdown()

    def test_idle_worker_is_ended(self):
        pool = ConversionPool(size=1, worker_target=_workers.echo_worker, idle_timeout=0.4)
        try:
            pool.convert("x", False, timeout=30)
            worker = pool._idle[0]
            # kill() closes the connection last, so a closed connection means the process is gone;
            # asking the process itself meanwhile would race with kill() waiting on it.
            deadline = time.monotonic() + 10
            while not worker.conn.closed and time.monotonic() < deadline:
                time.sleep(0.1)
            self.assertEqual(pool._idle, [])
            self.assertTrue(worker.conn.closed)
            self.assertFalse(worker.process.is_alive())
            # the pool still works afterwards
            self.assertEqual(pool.convert("x", False, timeout=30)[0], "ok")
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


class TestWatcherRestart(unittest.TestCase):
    def test_restart_during_a_conversion_does_not_leave_two_loops(self):
        started, release = threading.Event(), threading.Event()

        def slow(src, out):
            started.set()
            release.wait(10)
            return {"success": True}

        def loops():
            return [t for t in threading.enumerate() if t.name == "folder-watcher" and t.is_alive()]

        with tempfile.TemporaryDirectory() as inbox:
            w = FolderWatcher(convert_fn=slow)
            w.start(inbox_dir=inbox)
            try:
                (pathlib.Path(inbox) / "a.txt").write_text("hallo")
                self.assertTrue(started.wait(5), "the conversion never started")
                w.stop()  # gives up waiting after 2 s: the loop is still inside the conversion
                w.start(inbox_dir=inbox)
                release.set()
                deadline = time.time() + 5
                while len(loops()) > 1 and time.time() < deadline:
                    time.sleep(0.1)
                self.assertEqual(len(loops()), 1)
            finally:
                release.set()
                w.stop()


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


GERMAN_LINES = [
    "Übung 3: Größenordnung der Gebühren",
    "Die Prüfung findet am 14. März 2027 statt.",
    "Zusammenfassung für Studenten (Seite 12)",
    "Preis: 1.250,00 € – inkl. 19 % MwSt.",
]
FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]


ENGLISH_LINES = [
    "The quick brown fox jumps over the lazy dog.",
    "Machine learning models require large amounts of training data.",
    "Deadline: March 14th, 2027 - please submit your assignment.",
]
MIXED_LINES = [
    "Die Vorlesung 'Introduction to Algorithms' beginnt um 10:15 Uhr.",
    "Bitte lest Chapter 4 (Dynamic Programming) vor dem Meeting.",
]


def _german_text_image(folder: str, lines=None, name: str = "deutsch.png"):
    """A picture of the lines (default: GERMAN_LINES), or None if the computer has no font with umlauts."""
    lines = GERMAN_LINES if lines is None else lines
    from PIL import Image, ImageDraw, ImageFont
    font_path = next((f for f in FONT_CANDIDATES if os.path.exists(f)), None)
    if font_path is None:
        return None
    font = ImageFont.truetype(font_path, 38)
    width = int(max(font.getlength(line) for line in lines)) + 80  # wide fonts must not clip a line
    img = Image.new("RGB", (width, 60 + len(lines) * 75), "white")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(lines):
        draw.text((30, 25 + i * 75), line, fill="black", font=font)
    path = os.path.join(folder, name)
    img.save(path)
    return path


class TestGermanOcr(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.image = _german_text_image(self._tmp.name)
        if self.image is None:
            self.skipTest("keine Schrift mit Umlauten gefunden")

    def test_reads_german_text_in_process(self):
        res = ConversionEngine().convert_file(self.image, save=False)
        self.assertTrue(res["success"])
        text = res["markdown"]
        for word in ("Größenordnung", "Prüfung", "März", "Zusammenfassung", "MwSt"):
            self.assertIn(word, text)
        self.assertNotIn(self._tmp.name, text)

    def test_reads_german_text_in_worker_process(self):
        engine = ConversionEngine()
        try:
            res = engine.convert_file(self.image, save=False, timeout=120)
        finally:
            engine._pool.shutdown()
        self.assertTrue(res["success"])
        self.assertIn("Größenordnung", res["markdown"])
        self.assertIn("14. März 2027", res["markdown"])

    def test_reads_english_and_mixed_text(self):
        engine = ConversionEngine()
        for lines in (ENGLISH_LINES, MIXED_LINES):
            image = _german_text_image(self._tmp.name, lines, name=f"t{len(lines)}.png")
            text = engine.convert_file(image, save=False)["markdown"]
            squeezed = text.lower().replace(" ", "")
            for line in lines:
                self.assertIn(line.lower().replace(" ", ""), squeezed, line)

    def test_blank_image_gives_the_short_note(self):
        from PIL import Image
        blank = os.path.join(self._tmp.name, "leer.png")
        Image.new("RGB", (300, 120), "white").save(blank)
        res = ConversionEngine().convert_file(blank, save=False)
        self.assertTrue(res["success"])
        self.assertIn("kein Text erkannt", res["markdown"])


class TestImageFallback(unittest.TestCase):
    def test_note_has_no_path_and_no_metadata_table(self):
        from unittest import mock
        from PIL import Image
        from backend import ocr_service
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "foto.png")
            Image.new("RGB", (4, 3)).save(path)
            with mock.patch.object(ocr_service, "run_ocr", return_value=None):
                out = ocr_service.extract_image_visual_markdown(path)
            self.assertFalse(out["has_ocr"])
            self.assertIn("foto.png", out["markdown"])
            self.assertNotIn(tmp, out["markdown"])
            self.assertNotIn("|", out["markdown"])
            with mock.patch.object(ocr_service, "run_ocr", return_value="Erkannter Text"):
                out = ocr_service.extract_image_visual_markdown(path)
            self.assertEqual(out["markdown"].strip(), "Erkannter Text")


if __name__ == "__main__":
    unittest.main()
