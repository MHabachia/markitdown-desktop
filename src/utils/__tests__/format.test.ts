import { describe, expect, it } from 'vitest';
import { escapeHtml, formatBytes, isPending, metaLine } from '../format';

describe('format helpers', () => {
  it('formats byte sizes', () => {
    expect(formatBytes(0)).toBe('');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
  });

  it('joins only non-empty parts', () => {
    expect(metaLine('PDF', '', undefined, false, '43 Wörter')).toBe('PDF · 43 Wörter');
  });

  it('escapes HTML special characters', () => {
    expect(escapeHtml('<a href="x">\'&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });

  it('knows which statuses are still open', () => {
    expect(isPending('ready')).toBe(true);
    expect(isPending('converting')).toBe(true);
    expect(isPending('success')).toBe(false);
  });
});
