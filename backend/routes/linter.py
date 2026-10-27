"""Markdown helpers of the editor."""

from fastapi import APIRouter

from backend.linter import clean_blank_lines, format_markdown_tables, generate_toc
from backend.models import LinterRequest

router = APIRouter()


@router.post("/api/linter/format-tables")
def api_format_tables(req: LinterRequest):
    return {"formatted": format_markdown_tables(req.content)}


@router.post("/api/linter/clean-whitespace")
def api_clean_whitespace(req: LinterRequest):
    return {"formatted": clean_blank_lines(req.content)}


@router.post("/api/linter/generate-toc")
def api_generate_toc(req: LinterRequest):
    return {"formatted": generate_toc(req.content)}
