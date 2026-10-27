// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { DEFAULT_SETTINGS } from '../../types';
import { act, renderHook } from '../../test/renderHook';
import { useSettings } from '../useSettings';

vi.mock('../../api/client', () => ({
  apiClient: { getSettings: vi.fn(), saveSettings: vi.fn() }
}));

const api = vi.mocked(apiClient);

const flush = () => act(async () => {});

beforeEach(() => {
  vi.resetAllMocks();
  api.getSettings.mockResolvedValue({ ...DEFAULT_SETTINGS });
  api.saveSettings.mockResolvedValue({});
});

describe('useSettings', () => {
  it('starts with the defaults and merges what the backend has saved', async () => {
    api.getSettings.mockResolvedValue({ theme: 'dark', timeout_seconds: 120 } as never);
    const { result } = renderHook(() => useSettings(vi.fn()));
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
    await flush();
    expect(result.current.settings.theme).toBe('dark');
    expect(result.current.settings.timeout_seconds).toBe(120);
    expect(result.current.settings.filename_template).toBe('{name}.md');
  });

  it('keeps the defaults while the backend is not reachable', async () => {
    api.getSettings.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useSettings(vi.fn()));
    await flush();
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('quick successive edits do not overwrite each other and are saved in order', async () => {
    const { result } = renderHook(() => useSettings(vi.fn()));
    await flush();
    await act(async () => {
      result.current.updateSettings({ theme: 'light' });
      result.current.updateSettings({ timeout_seconds: 30 });
    });
    expect(result.current.settings).toMatchObject({ theme: 'light', timeout_seconds: 30 });
    expect(result.current.settingsRef.current).toMatchObject({ theme: 'light', timeout_seconds: 30 });
    const saved = api.saveSettings.mock.calls.map(([s]) => s);
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({ theme: 'light', timeout_seconds: 60 });
    expect(saved[1]).toMatchObject({ theme: 'light', timeout_seconds: 30 });
  });

  it('tells the user when saving fails and keeps saving later changes', async () => {
    const notify = vi.fn();
    api.saveSettings.mockRejectedValueOnce(new Error('Die Einstellungen konnten nicht gespeichert werden: Disk voll'));
    const { result } = renderHook(() => useSettings(notify));
    await flush();
    await act(async () => result.current.updateSettings({ theme: 'dark' }));
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Disk voll'), 'error');
    await act(async () => result.current.updateSettings({ theme: 'light' }));
    expect(api.saveSettings).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(1);
  });
});
