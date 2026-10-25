"""
Markdown Linter & Quality Optimizer
Provides utilities for formatting Markdown tables, normalizing whitespace,
and generating Table of Contents (TOC).
"""

import re
from typing import List

def clean_blank_lines(content: str) -> str:
    """Removes trailing whitespace on each line and caps consecutive blank lines to at most one."""
    lines = [line.rstrip() for line in content.splitlines()]
    cleaned: List[str] = []
    consecutive_empty = 0

    for line in lines:
        if not line:
            consecutive_empty += 1
            if consecutive_empty <= 1:
                cleaned.append("")
        else:
            consecutive_empty = 0
            cleaned.append(line)

    return "\n".join(cleaned).strip() + "\n"

def format_markdown_tables(content: str) -> str:
    """
    Detects Markdown tables and aligns columns for clean, readable tabular layout.
    """
    lines = content.splitlines()
    output: List[str] = []
    table_buffer: List[str] = []

    def is_table_row(line: str) -> bool:
        trimmed = line.strip()
        return trimmed.startswith("|") and trimmed.endswith("|") and trimmed.count("|") >= 2

    def flush_table(buffer: List[str]) -> List[str]:
        if not buffer:
            return []
        if len(buffer) < 2:
            return buffer

        # Parse rows and calculate column widths
        rows: List[List[str]] = []
        for row in buffer:
            # Strip outer pipes and split
            inner = row.strip()
            if inner.startswith("|"):
                inner = inner[1:]
            if inner.endswith("|"):
                inner = inner[:-1]
            cols = [col.strip() for col in inner.split("|")]
            rows.append(cols)

        max_cols = max(len(r) for r in rows)
        # Pad shorter rows
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

    for line in lines:
        if is_table_row(line):
            table_buffer.append(line)
        else:
            if table_buffer:
                output.extend(flush_table(table_buffer))
                table_buffer = []
            output.append(line)

    if table_buffer:
        output.extend(flush_table(table_buffer))

    return "\n".join(output)

def generate_toc(content: str) -> str:
    """
    Extracts headers and creates a Markdown Table of Contents.
    """
    headings: List[tuple[int, str, str]] = []
    lines = content.splitlines()

    for line in lines:
        # "[ \t]+" followed by a non-space keeps the match linear (no backtracking over spaces).
        match = re.match(r"^(#{1,6})[ \t]+(\S.*)$", line.strip())
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            # Clean anchor link
            anchor = re.sub(r"[^\w\s-]", "", title.lower()).replace(" ", "-")
            headings.append((level, title, anchor))

    if not headings:
        return "<!-- Kein Inhaltsverzeichnis: Keine Überschriften gefunden -->\n\n" + content

    min_level = min(h[0] for h in headings)
    toc_lines = ["## Inhaltsverzeichnis\n"]
    for level, title, anchor in headings:
        indent = "  " * (level - min_level)
        toc_lines.append(f"{indent}* [{title}](#{anchor})")

    toc_str = "\n".join(toc_lines) + "\n\n---\n\n"
    return toc_str + content
