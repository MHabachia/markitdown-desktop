import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { FormatCapability, SystemDiagnostics } from '../types';

const RETRY_MS = 2000;
// The bundled backend needs a few seconds on a cold start; after this it is considered stuck.
const UNREACHABLE_AFTER_MS = 60_000;

/** Engine diagnostics; retries until the backend answers, then stops polling. */
export function useSystemInfo() {
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [capabilities, setCapabilities] = useState<FormatCapability[]>([]);
  const [unreachable, setUnreachable] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [diag, caps] = await Promise.all([apiClient.getHealth(), apiClient.getFormats()]);
      setDiagnostics(diag);
      setCapabilities(caps);
      setUnreachable(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    const attempt = async () => {
      const ok = await refresh();
      if (ok || cancelled) return;
      if (Date.now() - startedAt >= UNREACHABLE_AFTER_MS) setUnreachable(true);
      timer = setTimeout(attempt, RETRY_MS);
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  return { diagnostics, capabilities, unreachable, refresh };
}
