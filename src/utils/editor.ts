import { escapeHtml } from './format';

export interface DocumentStats {
  chars: number;
  words: number;
  lines: number;
  readTimeMinutes: number;
}

export function documentStats(content: string): DocumentStats {
  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const lines = content.split('\n').length;
  const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
  return { chars, words, lines, readTimeMinutes };
}

/** How often `query` occurs in `content`, ignoring case. The query is plain text, not a pattern. */
export function countMatches(content: string, query: string): number {
  if (!query) return 0;
  return (content.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
}

/** A standalone HTML page around already rendered (and sanitized) Markdown. */
export function buildHtmlDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #111; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; }
    th { background: #f4f4f4; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
