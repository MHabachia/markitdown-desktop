import { describe, expect, it, vi } from 'vitest';

describe('shortcut labels', () => {
  it('uses ⌘ on macOS', async () => {
    vi.resetModules();
    vi.stubGlobal('navigator', { platform: 'MacIntel', userAgent: '' });
    const { shortcut } = await import('../platform');
    expect(shortcut('K')).toBe('⌘K');
    expect(shortcut('O', { shift: true })).toBe('⇧⌘O');
    vi.unstubAllGlobals();
  });

  it('uses Strg on Windows', async () => {
    vi.resetModules();
    vi.stubGlobal('navigator', { platform: 'Win32', userAgent: '' });
    const { shortcut, FILE_MANAGER } = await import('../platform');
    expect(shortcut('Enter')).toBe('Strg+Enter');
    expect(shortcut('O', { shift: true })).toBe('Strg+Umschalt+O');
    expect(FILE_MANAGER).toBe('Explorer');
    vi.unstubAllGlobals();
  });
});
