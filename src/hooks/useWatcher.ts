import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { AppSettings, WatcherStatus } from '../types';

export const DEFAULT_INBOX = '~/MarkItDown-Inbox';
const POLL_MS = 3000;

/** Folder-watcher status (polled while a component using it is mounted) and a start/stop toggle. */
export function useWatcher(settings: AppSettings, onError: (message: string) => void) {
  const [status, setStatus] = useState<WatcherStatus | null>(null);

  const refresh = useCallback(() => {
    apiClient.getWatcherStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const toggle = async () => {
    try {
      if (status?.is_running) {
        await apiClient.stopWatcher();
      } else {
        await apiClient.startWatcher(settings.watcher_inbox_dir || DEFAULT_INBOX, settings.watcher_output_dir || undefined);
      }
    } catch (e) {
      onError(`Ordner-Überwachung: ${e instanceof Error ? e.message : String(e)}`);
    }
    refresh();
  };

  return { status, toggle };
}
