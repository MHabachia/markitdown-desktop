"""History and settings."""

from typing import Callable

from fastapi import APIRouter, HTTPException

from backend import storage
from backend.models import SettingsModel

router = APIRouter()


def _write_or_500(what: str, write: Callable[[], None]) -> None:
    try:
        write()
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"{what} konnte nicht gespeichert werden: {e}") from e


@router.get("/api/history")
def get_history():
    return storage.get_history()


@router.delete("/api/history")
def clear_history():
    _write_or_500("Der Verlauf", storage.clear_history)
    return {"success": True}


@router.delete("/api/history/{item_id}")
def delete_history_item(item_id: str):
    _write_or_500("Der Verlauf", lambda: storage.delete_history_item(item_id))
    return {"success": True}


@router.get("/api/settings")
def get_settings():
    return storage.load_settings()


@router.post("/api/settings")
def update_settings(settings: SettingsModel):
    data = settings.model_dump()
    _write_or_500("Die Einstellungen", lambda: storage.save_settings(data))
    return data
