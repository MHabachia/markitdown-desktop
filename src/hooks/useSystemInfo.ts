import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { FormatCapability, SystemDiagnostics } from '../types';

const RETRY_MS = 2000;

/** Engine diagnostics; retries until the backend answers, then stops polling. */
export function useSystemInfo() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [capabilities, setCapabilities] = useState<FormatCapability[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [diag, caps] = await Promise.all([apiClient.getHealth(), apiClient.getFormats()]);
      setDiagnostics(diag);
      setCapabilities(caps);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = async () => {
      const ok = await refresh();
      if (!ok && !cancelled) timer = setTimeout(attempt, RETRY_MS);
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  return { diagnostics, capabilities, refresh };
}
