"""
Markdown Linter & Quality Optimizer
Provides utilities for formatting Markdown tables, normalizing whitespace,
and generating Table of Contents (TOC).

All helpers leave fenced code blocks untouched: what is inside a block is content, not Markdown.
"""

import re
from typing import List, Tuple

_FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
# A pipe that is not escaped with a backslash separates two table cells.
_CELL_SEPARATOR = re.compile(r"(?<!\\)\|")


def _code_flags(lines: List[str]) -> List[bool]:
    """For every line: True if it belongs to a fenced code block (fence lines included)."""
    flags: List[bool] = []
    fence = ""
    for line in lines:
        match = _FENCE.match(line)
        if not fence:
            if match:
                fence = match.group(1)
                flags.append(True)
            else:
                flags.append(False)
        else:
            flags.append(True)
            closes = match and match.group(1)[0] == fence[0] and len(match.group(1)) >= len(fence)
            if closes and not line.strip().strip(fence[0]):
                fence = ""
    return flags


def clean_blank_lines(content: str) -> str:
    """Removes trailing whitespace on each line and caps consecutive blank lines to at most one."""
    lines = content.splitlines()
    in_code = _code_flags(lines)
    cleaned: List[str] = []
    consecutive_empty = 0

    for line, code in zip(lines, in_code, strict=True):
        if code:
            consecutive_empty = 0
            cleaned.append(line)
            continue
        line = line.rstrip()
        if not line:
            consecutive_empty += 1
            if consecutive_empty <= 1:
                cleaned.append("")
        else:
            consecutive_empty = 0
            cleaned.append(line)

    while cleaned and not cleaned[0].strip():
        cleaned.pop(0)
    while cleaned and not cleaned[-1].strip():
        cleaned.pop()
    return "\n".join(cleaned) + "\n"


def _is_table_row(line: str) -> bool:
    trimmed = line.strip()
    return trimmed.startswith("|") and trimmed.endswith("|") and trimmed.count("|") >= 2


def _split_cells(row: str) -> List[str]:
    inner = row.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|") and not inner.endswith("\\|"):
        inner = inner[:-1]
    return [cell.strip() for cell in _CELL_SEPARATOR.split(inner)]


def _format_table(buffer: List[str]) -> List[str]:
    if len(buffer) < 2:
        return buffer

    rows = [_split_cells(row) for row in buffer]
    max_cols = max(len(r) for r in rows)
    for r in rows:
        while len(r) < max_cols:
            r.append("")

    col_widths = [3] * max_cols
    for r_idx, r in enumerate(rows):
        for c_idx, cell in enumerate(r):
            # Don't let separator hyphens artificially expand column width
            if r_idx == 1 and all(ch in "-: " for ch in cell):
                continue
            col_widths[c_idx] = max(col_widths[c_idx], len(cell))

    formatted_rows: List[str] = []
    for r_idx, r in enumerate(rows):
        cells_str = []
        is_sep = r_idx == 1 and all(all(ch in "-: " for ch in cell) for cell in r if cell)
        for c_idx, cell in enumerate(r):
            width = col_widths[c_idx]
            if is_sep:
                # Maintain alignment colons if present
                left_align = cell.startswith(":")
                right_align = cell.endswith(":")
                dash_count = max(3, width)
                if left_align and right_align:
                    sep_cell = ":" + "-" * (dash_count - 2) + ":"
                elif left_align:
                    sep_cell = ":" + "-" * (dash_count - 1)
                elif right_align:
                    sep_cell = "-" * (dash_count - 1) + ":"
                else:
                    sep_cell = "-" * dash_count
                cells_str.append(sep_cell)
            else:
                cells_str.append(cell.ljust(width))
        formatted_rows.append("| " + " | ".join(cells_str) + " |")

    return formatted_rows


def format_markdown_tables(content: str) -> str:
    """
    Detects Markdown tables and aligns columns for clean, readable tabular layout.
    """
    lines = content.splitlines()
    in_code = _code_flags(lines)
    output: List[str] = []
    table_buffer: List[str] = []

    for line, code in zip(lines, in_code, strict=True):
        if not code and _is_table_row(line):
            table_buffer.append(line)
            continue
        if table_buffer:
            output.extend(_format_table(table_buffer))
            table_buffer = []
        output.append(line)

    if table_buffer:
        output.extend(_format_table(table_buffer))

    return "\n".join(output)


def _anchor(title: str) -> str:
    """GitHub-style anchor: lower case, punctuation removed, spaces become hyphens."""
    return re.sub(r"[^\w\s-]", "", title.lower()).replace(" ", "-")


def generate_toc(content: str) -> str:
    """
    Extracts headers and creates a Markdown Table of Contents.
    """
    headings: List[Tuple[int, str, str]] = []
    lines = content.splitlines()
    in_code = _code_flags(lines)
    seen = {}

    for line, code in zip(lines, in_code, strict=True):
        if code:
            continue
        # Up to three spaces of indentation are allowed; more is an indented code block.
        # "[ \t]+" followed by a non-space keeps the match linear (no backtracking over spaces).
        match = re.match(r"^ {0,3}(#{1,6})[ \t]+(\S.*)$", line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            anchor = _anchor(title)
            # GitHub numbers repeated headings: x, x-1, x-2 ...
            count = seen.get(anchor, 0)
            seen[anchor] = count + 1
            headings.append((level, title, anchor if count == 0 else f"{anchor}-{count}"))

    if not headings:
        return "<!-- Kein Inhaltsverzeichnis: Keine Überschriften gefunden -->\n\n" + content

    min_level = min(h[0] for h in headings)
    toc_lines = ["## Inhaltsverzeichnis\n"]
    for level, title, anchor in headings:
        indent = "  " * (level - min_level)
        toc_lines.append(f"{indent}* [{title}](#{anchor})")

    toc_str = "\n".join(toc_lines) + "\n\n---\n\n"
    return toc_str + content
