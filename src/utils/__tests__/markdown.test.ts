// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdown';

describe('renderMarkdown', () => {
  it('renders regular Markdown', () => {
    const html = renderMarkdown('# Titel\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain('<h1>Titel</h1>');
    expect(html).toContain('<table>');
  });

  it('strips scripts, event handlers and javascript: links from untrusted documents', () => {
    const html = renderMarkdown(
      '<img src="x" onerror="alert(1)">\n\n<script>alert(2)</script>\n\n[klick](javascript:alert(3))\n\n<form><input></form>'
    );
    expect(html).not.toMatch(/onerror|<script|javascript:|<form|<input/i);
  });
});
