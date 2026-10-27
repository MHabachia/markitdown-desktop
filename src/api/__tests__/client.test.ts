import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../client';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const mockFetch = (...responses: Response[]) => {
  const fn = vi.fn();
  for (const response of responses) fn.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fn);
  return fn;
};

afterEach(() => vi.unstubAllGlobals());

describe('apiClient', () => {
  it('sends JSON to the right endpoint', async () => {
    const fetchMock = mockFetch(json({ success: true }));
    await apiClient.openFolder('/tmp/docs');
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/open-folder$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ path: '/tmp/docs' });
  });

  it('turns an HTTP error into an exception carrying the backend message', async () => {
    mockFetch(json({ detail: 'Die Einstellungen konnten nicht gespeichert werden: Disk voll' }, 500));
    await expect(apiClient.saveSettings({} as never)).rejects.toThrow('Disk voll');
  });

  it('falls back to the status code when the error body is not JSON', async () => {
    mockFetch(new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(apiClient.getHistory()).rejects.toThrow('HTTP 502');
  });

  it('shows the backend reason when saving a file fails', async () => {
    mockFetch(json({ detail: 'Der Zielordner existiert nicht.' }, 400));
    await expect(apiClient.saveFile('/nope/a.md', 'x')).rejects.toThrow('Der Zielordner existiert nicht.');
  });

  it('reports a rejected conversion request as a failed result, not as an exception', async () => {
    mockFetch(json({ detail: 'Ungültiges oder fehlendes API-Token' }, 401));
    const res = await apiClient.convertFile({ source_path: '/a.txt' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('401');
    expect(res.solution_hint).toContain('Starte die App neu');
  });

  it('passes the abort signal to fetch', async () => {
    const fetchMock = mockFetch(json({ success: true }));
    const controller = new AbortController();
    await apiClient.convertFile({ source_path: '/a.txt' }, controller.signal);
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  describe('Markdown helpers', () => {
    it('return the formatted text', async () => {
      mockFetch(json({ formatted: '| a |\n| - |' }));
      expect(await apiClient.formatTables('| a |')).toBe('| a |\n| - |');
    });

    it('keep an empty result instead of falling back to the input', async () => {
      mockFetch(json({ formatted: '' }));
      expect(await apiClient.cleanWhitespace('   ')).toBe('');
    });

    it('throw when the backend refuses, so the editor does not claim success', async () => {
      mockFetch(json({ detail: 'Ungültiges oder fehlendes API-Token' }, 401));
      await expect(apiClient.generateToc('# a')).rejects.toThrow('API-Token');
    });
  });
});
