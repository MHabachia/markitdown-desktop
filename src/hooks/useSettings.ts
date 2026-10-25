import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { AppSettings, DEFAULT_SETTINGS } from '../types';

/**
 * App settings with optimistic updates. Changes are merged into the latest state (not a
 * stale render copy) and saved in order, so quick successive edits never overwrite each other.
 */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const latest = useRef(settings);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    apiClient
      .getSettings()
      .then((loaded) => {
        latest.current = { ...DEFAULT_SETTINGS, ...loaded };
        setSettings(latest.current);
      })
      .catch(() => {
        /* backend not reachable yet: defaults stay in place */
      });
  }, []);

  const update = useCallback((changes: Partial<AppSettings>) => {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    setSettings(next);
    saveChain.current = saveChain.current.then(() => apiClient.saveSettings(next)).catch(() => undefined);
  }, []);

  return { settings, settingsRef: latest, updateSettings: update };
}
