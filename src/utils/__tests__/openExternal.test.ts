import { describe, expect, it, vi } from 'vitest';
import { openExternal, PROJECT_URL } from '../openExternal';

describe('openExternal', () => {
  it('opens allowed GitHub pages', async () => {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    await openExternal(`${PROJECT_URL}/releases`);
    expect(open).toHaveBeenCalledWith(`${PROJECT_URL}/releases`, '_blank', 'noopener,noreferrer');
    vi.unstubAllGlobals();
  });

  it('rejects anything else, including look-alike prefixes', async () => {
    await expect(openExternal('https://evil.example')).rejects.toThrow();
    await expect(openExternal(`${PROJECT_URL}-fake`)).rejects.toThrow();
  });
});
