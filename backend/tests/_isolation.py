"""
Imported first by every test module: points the backend at a throwaway data folder so
tests never read or write the developer's real history and settings.
"""
import os
import tempfile

os.environ.setdefault("MARKITDOWN_DATA_DIR", tempfile.mkdtemp(prefix="markitdown-test-"))

# FastAPI's TestClient defaults to the host "testserver", which the API rejects.
TEST_BASE_URL = "http://127.0.0.1"
