import { describe, expect, it } from 'vitest';
import { buildHtmlDocument, countMatches, documentStats } from '../editor';

describe('documentStats', () => {
  it('counts characters, words and lines', () => {
    expect(documentStats('Hallo Welt\nzweite Zeile')).toEqual({ chars: 23, words: 4, lines: 2, readTimeMinutes: 1 });
  });

  it('treats an empty document as zero words and still one line', () => {
    expect(documentStats('   ')).toMatchObject({ words: 0, lines: 1, readTimeMinutes: 1 });
  });

  it('rounds the reading time up at 200 words per minute', () => {
    expect(documentStats('wort '.repeat(201)).readTimeMinutes).toBe(2);
  });
});

describe('countMatches', () => {
  it('ignores case and counts every occurrence', () => {
    expect(countMatches('Markdown markdown MARKDOWN', 'markdown')).toBe(3);
  });

  it('takes the query literally, not as a pattern', () => {
    expect(countMatches('a.b a+b axb', 'a.b')).toBe(1);
    expect(countMatches('(x) (y)', '(')).toBe(2);
  });

  it('finds nothing for an empty query', () => {
    expect(countMatches('text', '')).toBe(0);
  });
});

describe('buildHtmlDocument', () => {
  it('wraps the body in a complete page and escapes the title', () => {
    const html = buildHtmlDocument('<b>x</b>.md', '<p>Inhalt</p>');
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<title>&lt;b&gt;x&lt;/b&gt;.md</title>');
    expect(html).toContain('<body>\n<p>Inhalt</p>\n</body>');
  });
});
