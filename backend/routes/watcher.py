"""Folder watcher control."""

from fastapi import APIRouter, HTTPException

from backend.models import WatcherStartRequest
from backend.services import watcher

router = APIRouter()


@router.post("/api/watcher/start")
def start_watcher(req: WatcherStartRequest):
    try:
        return watcher.start(inbox_dir=req.inbox_dir, output_dir=req.output_dir)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/api/watcher/stop")
def stop_watcher():
    return watcher.stop()


@router.get("/api/watcher/status")
def get_watcher_status():
    return watcher.get_status()
