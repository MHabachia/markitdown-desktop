import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { HistoryItem } from '../types';
import { Notify } from './useToasts';

export function useHistory(notify: Notify) {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const reload = useCallback(() => {
    apiClient.getHistory().then(setHistory).catch(() => undefined);
  }, []);

  useEffect(reload, [reload]);

  const clear = useCallback(async () => {
    try {
      await apiClient.clearHistory();
      setHistory([]);
    } catch (e) {
      notify(`Verlauf konnte nicht geleert werden: ${e instanceof Error ? e.message : e}`, 'error');
    }
  }, [notify]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await apiClient.deleteHistoryItem(id);
        setHistory((prev) => prev.filter((h) => h.id !== id));
      } catch (e) {
        notify(`Eintrag konnte nicht entfernt werden: ${e instanceof Error ? e.message : e}`, 'error');
      }
    },
    [notify]
  );

  return { history, reloadHistory: reload, clearHistory: clear, removeHistoryItem: remove };
}
