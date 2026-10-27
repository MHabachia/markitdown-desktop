"""Access control of the local API.

The server only binds to 127.0.0.1, rejects foreign Host/Origin headers (CSRF / DNS rebinding)
and, when MARKITDOWN_API_TOKEN is set (the Tauri shell does this), requires that token in the
X-API-Token header.
"""

import hmac
import os
from typing import List

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

API_TOKEN = os.environ.get("MARKITDOWN_API_TOKEN", "")

APP_ORIGINS = ["tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"]
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
ALLOWED_HOSTNAMES = {"127.0.0.1", "localhost", "[::1]"}


def allowed_origins(token: str) -> List[str]:
    """The desktop app always passes a token; without one we are in development (browser + Vite),
    which is the only case where the dev server's origin is allowed."""
    return APP_ORIGINS if token else APP_ORIGINS + DEV_ORIGINS


ALLOWED_ORIGINS = allowed_origins(API_TOKEN)


async def guard_requests(request: Request, call_next):
    raw_host = request.headers.get("host") or ""
    if raw_host.startswith("["):
        host = raw_host.split("]")[0] + "]"
    else:
        host = raw_host.split(":")[0]
    if host and host not in ALLOWED_HOSTNAMES:
        return JSONResponse({"detail": "Host nicht erlaubt"}, status_code=403)

    origin = request.headers.get("origin")
    if origin is not None and origin not in ALLOWED_ORIGINS:
        return JSONResponse({"detail": "Origin nicht erlaubt"}, status_code=403)

    # CORS preflights cannot carry custom headers; they are answered by CORSMiddleware.
    if API_TOKEN and request.method != "OPTIONS":
        supplied = request.headers.get("x-api-token", "")
        if not hmac.compare_digest(supplied.encode(), API_TOKEN.encode()):
            return JSONResponse({"detail": "Ungültiges oder fehlendes API-Token"}, status_code=401)

    return await call_next(request)


def install(app: FastAPI) -> None:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.middleware("http")(guard_requests)
