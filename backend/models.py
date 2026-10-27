"""Request and settings models of the API."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from backend import config

CollisionStrategy = Literal["rename", "overwrite", "skip", "error"]


class ConvertRequest(BaseModel):
    source_path: Optional[str] = None
    file_base64: Optional[str] = None
    file_name: Optional[str] = None
    target_dir: Optional[str] = None
    filename_template: Optional[str] = None
    collision_strategy: CollisionStrategy = "rename"
    keep_data_uris: bool = False
    # False: return the Markdown only; the user previews it and saves explicitly.
    save: bool = True


class SaveMarkdownRequest(BaseModel):
    content: str = Field(max_length=config.MAX_MARKDOWN_CHARS)
    source_path: Optional[str] = None
    file_name: Optional[str] = None
    target_dir: Optional[str] = None
    # Exact file chosen in a "save as" dialog (the dialog already asked about overwriting).
    target_path: Optional[str] = None
    filename_template: Optional[str] = None
    collision_strategy: CollisionStrategy = "rename"
    word_count: Optional[int] = None
    duration_ms: Optional[float] = None


class ZipItem(BaseModel):
    name: str
    content: str = Field(max_length=config.MAX_MARKDOWN_CHARS)


class ExportZipRequest(BaseModel):
    # Current (possibly edited, possibly unsaved) results, so the ZIP matches the preview.
    items: List[ZipItem] = Field(max_length=10000)
    zip_name: Optional[str] = "markitdown_export.zip"
    # Full path chosen in a save dialog; must end in .zip and its folder must exist.
    target_path: Optional[str] = None


class ResolvePathsRequest(BaseModel):
    paths: List[str] = Field(default_factory=list, max_length=10000)


class SaveFileRequest(BaseModel):
    file_path: str
    content: str


class OpenPathRequest(BaseModel):
    path: str


class LinterRequest(BaseModel):
    content: str


class WatcherStartRequest(BaseModel):
    inbox_dir: str
    output_dir: Optional[str] = None


class SettingsModel(BaseModel):
    theme: str = "system"  # dark, light, system
    default_output_dir: str = ""
    open_output_after_convert: bool = False
    open_preview_after_convert: bool = True
    collision_strategy: CollisionStrategy = "rename"
    filename_template: str = "{name}.md"
    concurrency_limit: int = Field(default=4, ge=1, le=16)
    watcher_inbox_dir: str = ""
    watcher_output_dir: str = ""
    keep_data_uris: bool = False
    # Off: results are previewed first and saved explicitly.
    auto_save_after_convert: bool = False
    # Asks GitHub for a newer release a few seconds after start (no data is sent).
    check_updates: bool = True
    timeout_seconds: int = Field(default=60, ge=1, le=3600)
