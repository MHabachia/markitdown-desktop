"""
API endpoint integration tests using FastAPI TestClient.
"""

from backend.tests._isolation import TEST_BASE_URL  # noqa: F401  (must come first)
import unittest
from fastapi.testclient import TestClient
from backend.api import app
import os
import tempfile
from backend.sample_generator import generate_sample_files

class TestFastAPIEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url=TEST_BASE_URL)
        cls.temp_dir = tempfile.mkdtemp()
        cls.sample_files = generate_sample_files(cls.temp_dir)

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["engine"], "Microsoft MarkItDown")
        self.assertTrue(data["is_local_only"])

    def test_formats_endpoint(self):
        response = self.client.get("/api/formats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)
        self.assertTrue(any(f["id"] == "pdf" for f in data))

    def test_convert_single_endpoint(self):
        txt_file = self.sample_files["txt"]
        response = self.client.post("/api/convert", json={
            "source_path": txt_file,
            "collision_strategy": "overwrite"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("MarkItDown Desktop", data["markdown"])

    def test_convert_base64_endpoint(self):
        import base64
        sample_text = b"# Test Document\n\nUploaded content via base64."
        b64_str = base64.b64encode(sample_text).decode("utf-8")
        response = self.client.post("/api/convert", json={
            "file_base64": b64_str,
            "file_name": "uploaded_test.txt",
            "collision_strategy": "overwrite"
        })
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertIn("Uploaded content via base64", data["markdown"])

    def test_save_file_endpoint(self):
        test_file = os.path.join(self.temp_dir, "editable.md")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("# Original Content")
        save_resp = self.client.post("/api/save-file", json={
            "file_path": test_file,
            "content": "# Updated Content by Editor"
        })
        self.assertEqual(save_resp.status_code, 200)
        with open(test_file, encoding="utf-8") as f:
            self.assertEqual(f.read(), "# Updated Content by Editor")

    def test_save_file_does_not_create_folders(self):
        target = os.path.join(self.temp_dir, "gibt-es-nicht", "x.md")
        resp = self.client.post("/api/save-file", json={"file_path": target, "content": "x"})
        self.assertEqual(resp.status_code, 400)
        self.assertFalse(os.path.exists(os.path.dirname(target)))

    def test_unknown_collision_strategy_is_rejected(self):
        for url, body in (
            ("/api/convert", {"source_path": self.sample_files["txt"], "collision_strategy": "rename "}),
            ("/api/save-markdown", {"content": "x", "target_dir": self.temp_dir, "collision_strategy": "ueberschreiben"}),
        ):
            self.assertEqual(self.client.post(url, json=body).status_code, 422, url)

    def test_upload_copy_is_removed_after_conversion(self):
        import base64
        from backend import api
        before = set(os.listdir(api.UPLOAD_DIR)) if os.path.isdir(api.UPLOAD_DIR) else set()
        for save in (False, True):
            resp = self.client.post("/api/convert", json={
                "file_base64": base64.b64encode(b"Hallo").decode(),
                "file_name": "upload.txt",
                "target_dir": self.temp_dir,
                "save": save,
            })
            self.assertTrue(resp.json()["success"])
        after = set(os.listdir(api.UPLOAD_DIR)) if os.path.isdir(api.UPLOAD_DIR) else set()
        self.assertEqual(after - before, set())

    def test_convert_without_target_writes_next_to_source(self):
        folder = tempfile.mkdtemp()
        src = os.path.join(folder, "notes.txt")
        with open(src, "w", encoding="utf-8") as f:
            f.write("Hello")
        resp = self.client.post("/api/convert", json={"source_path": src})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["target_path"], os.path.join(folder, "notes.md"))

    def test_resolve_paths_expands_folders_and_skips_unsupported(self):
        folder = tempfile.mkdtemp()
        os.makedirs(os.path.join(folder, "sub"))
        os.makedirs(os.path.join(folder, ".git"))
        for rel in ["a.txt", "sub/b.csv", ".git/c.txt", "d.exe"]:
            with open(os.path.join(folder, rel), "w") as f:
                f.write("x")
        resp = self.client.post("/api/resolve-paths", json={
            "paths": [folder, os.path.join(folder, "a.txt"), os.path.join(folder, "d.exe"), "/does/not/exist"]})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        names = sorted(f["name"] for f in data["files"])
        self.assertEqual(names, ["a.txt", "b.csv"])  # deduplicated, hidden and unsupported skipped
        self.assertEqual(data["skipped"], 2)

    def test_settings_ignore_unknown_keys(self):
        from backend import api as api_module
        with open(api_module.SETTINGS_FILE, "w", encoding="utf-8") as f:
            f.write('{"theme": "light", "enable_plugins": true}')
        data = self.client.get("/api/settings").json()
        self.assertEqual(data["theme"], "light")
        self.assertNotIn("enable_plugins", data)

    def test_settings_endpoint(self):
        resp = self.client.get("/api/settings")
        self.assertEqual(resp.status_code, 200)
        settings = resp.json()
        self.assertIn("theme", settings)

        # Update settings
        update_resp = self.client.post("/api/settings", json={
            **settings,
            "theme": "dark",
            "collision_strategy": "rename"
        })
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["theme"], "dark")

    def test_history_endpoint(self):
        resp = self.client.get("/api/history")
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.json(), list)

class TestApiSecurity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url=TEST_BASE_URL)
        cls.temp_dir = tempfile.mkdtemp()

    def test_foreign_origin_is_rejected(self):
        resp = self.client.get("/api/history", headers={"Origin": "https://evil.example"})
        self.assertEqual(resp.status_code, 403)

    def test_allowed_origin_passes(self):
        resp = self.client.get("/api/history", headers={"Origin": "tauri://localhost"})
        self.assertEqual(resp.status_code, 200)

    def test_foreign_host_is_rejected(self):
        resp = self.client.get("/api/history", headers={"Host": "evil.example:8765"})
        self.assertEqual(resp.status_code, 403)

    def test_upload_filename_traversal_is_neutralised(self):
        import base64
        from backend import api as api_module
        b64 = base64.b64encode(b"hello").decode()
        resp = self.client.post("/api/convert", json={
            "file_base64": b64,
            "file_name": "../../../escaped.txt",
            "target_dir": self.temp_dir,
            "collision_strategy": "overwrite",
        })
        self.assertEqual(resp.status_code, 200)
        src = resp.json()["source_path"]
        self.assertTrue(os.path.realpath(src).startswith(os.path.realpath(api_module.UPLOAD_DIR)))
        self.assertEqual(os.path.basename(src), "escaped.txt")

    def test_save_file_rejects_non_markdown(self):
        resp = self.client.post("/api/save-file", json={
            "file_path": os.path.join(self.temp_dir, "evil.sh"), "content": "rm -rf /"})
        self.assertEqual(resp.status_code, 403)

    def test_open_file_rejects_executables(self):
        script = os.path.join(self.temp_dir, "run.command")
        with open(script, "w") as f:
            f.write("echo hi")
        resp = self.client.post("/api/open-file", json={"path": script})
        self.assertEqual(resp.status_code, 403)

    def test_testserver_host_is_rejected(self):
        resp = TestClient(app).get("/api/history")
        self.assertEqual(resp.status_code, 403)


class TestPreviewThenSave(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url=TEST_BASE_URL)

    def setUp(self):
        self.folder = tempfile.mkdtemp()
        self.src = os.path.join(self.folder, "bericht.txt")
        with open(self.src, "w", encoding="utf-8") as f:
            f.write("Hallo Welt")

    def test_convert_without_save_writes_nothing(self):
        resp = self.client.post("/api/convert", json={"source_path": self.src, "save": False})
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertFalse(data["saved"])
        self.assertIsNone(data["target_path"])
        self.assertIn("Hallo Welt", data["markdown"])
        self.assertEqual(sorted(os.listdir(self.folder)), ["bericht.txt"])

    def test_save_markdown_next_to_source_with_collision_rename(self):
        first = self.client.post("/api/save-markdown", json={"source_path": self.src, "content": "# A"}).json()
        second = self.client.post("/api/save-markdown", json={"source_path": self.src, "content": "# B"}).json()
        self.assertEqual(first["target_path"], os.path.join(self.folder, "bericht.md"))
        self.assertEqual(second["target_path"], os.path.join(self.folder, "bericht (1).md"))
        with open(second["target_path"], encoding="utf-8") as f:
            self.assertEqual(f.read(), "# B")

    def test_save_markdown_collision_error_is_409(self):
        self.client.post("/api/save-markdown", json={"source_path": self.src, "content": "# A"})
        resp = self.client.post("/api/save-markdown", json={
            "source_path": self.src, "content": "# B", "collision_strategy": "error"})
        self.assertEqual(resp.status_code, 409)

    def test_save_markdown_to_chosen_file(self):
        target = os.path.join(self.folder, "eigener name.md")
        resp = self.client.post("/api/save-markdown", json={"content": "# C", "target_path": target})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(os.path.isfile(target))

    def test_save_markdown_rejects_other_extensions(self):
        resp = self.client.post("/api/save-markdown", json={
            "content": "x", "target_path": os.path.join(self.folder, "evil.sh")})
        self.assertEqual(resp.status_code, 400)

    def test_saved_result_appears_in_history(self):
        self.client.post("/api/save-markdown", json={"source_path": self.src, "file_name": "bericht.txt", "content": "# D"})
        names = [h["source_name"] for h in self.client.get("/api/history").json()]
        self.assertIn("bericht.txt", names)

    def test_zip_from_content_sanitises_and_dedupes_names(self):
        target = os.path.join(self.folder, "export.zip")
        resp = self.client.post("/api/export-zip", json={"target_path": target, "items": [
            {"name": "../../a.pdf", "content": "# 1"},
            {"name": "a.docx", "content": "# 2"},
        ]})
        self.assertEqual(resp.status_code, 200)
        import zipfile
        with zipfile.ZipFile(target) as zf:
            self.assertEqual(sorted(zf.namelist()), ["a (1).md", "a.md"])

    def test_zip_rejects_non_zip_target(self):
        resp = self.client.post("/api/export-zip", json={
            "items": [{"name": "a", "content": "x"}], "target_path": os.path.join(self.folder, "evil.sh")})
        self.assertEqual(resp.status_code, 400)


class TestTightenedAccess(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url=TEST_BASE_URL)
        cls.folder = tempfile.mkdtemp()

    def test_open_file_only_opens_markdown(self):
        for name in ["script.py", "page.html", "notes.txt"]:
            path = os.path.join(self.folder, name)
            with open(path, "w") as f:
                f.write("x")
            self.assertEqual(self.client.post("/api/open-file", json={"path": path}).status_code, 403, name)

    def test_export_allows_html_and_text_but_not_scripts(self):
        for name, expected in [("export.html", 200), ("export.txt", 200), ("export.md", 200), ("evil.py", 403)]:
            resp = self.client.post("/api/save-file", json={"file_path": os.path.join(self.folder, name), "content": "x"})
            self.assertEqual(resp.status_code, expected, name)

    def test_dev_origin_rejected_when_running_as_app(self):
        import importlib
        from unittest import mock
        from backend import api as api_module
        with mock.patch.dict(os.environ, {"MARKITDOWN_API_TOKEN": "t"}):
            reloaded = importlib.reload(api_module)
            try:
                self.assertNotIn("http://localhost:5173", reloaded.ALLOWED_ORIGINS)
            finally:
                os.environ.pop("MARKITDOWN_API_TOKEN", None)
                importlib.reload(api_module)
        self.assertIn("http://localhost:5173", api_module.ALLOWED_ORIGINS)


class TestApiToken(unittest.TestCase):
    def test_token_required_when_configured(self):
        from backend import api as api_module
        original = api_module.API_TOKEN
        api_module.API_TOKEN = "secret-token"
        try:
            client = TestClient(app, base_url=TEST_BASE_URL)
            self.assertEqual(client.get("/api/history").status_code, 401)
            self.assertEqual(client.get("/api/history", headers={"X-API-Token": "wrong"}).status_code, 401)
            self.assertEqual(client.get("/api/history", headers={"X-API-Token": "secret-token"}).status_code, 200)
        finally:
            api_module.API_TOKEN = original

if __name__ == "__main__":
    unittest.main()
