import { useCallback, useEffect, useRef, useState } from 'react';
import { IS_DESKTOP } from '../utils/desktop';

export type UpdateState =
  | { status: 'idle' | 'checking' | 'none' | 'unsupported' }
  | { status: 'available' | 'installing'; version: string; notes?: string }
  | { status: 'error'; message: string };

const AUTO_CHECK_DELAY_MS = 8000;

type PendingUpdate = { version: string; body?: string; downloadAndInstall: () => Promise<void> };

/** Checks GitHub releases for a signed update; installs and restarts on request. */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: IS_DESKTOP ? 'idle' : 'unsupported' });
  const pending = useRef<PendingUpdate | null>(null);

  const check = useCallback(async (manual: boolean) => {
    if (!IS_DESKTOP) return;
    setState({ status: 'checking' });
    try {
      const { check: checkForUpdate } = await import('@tauri-apps/plugin-updater');
      const update = await checkForUpdate();
      if (update) {
        pending.current = update;
        setState({ status: 'available', version: update.version, notes: update.body });
      } else {
        setState({ status: 'none' });
      }
    } catch (e) {
      // The automatic check stays silent (offline, no release yet); a manual one explains.
      setState(manual ? { status: 'error', message: e instanceof Error ? e.message : String(e) } : { status: 'idle' });
    }
  }, []);

  const install = useCallback(async () => {
    const update = pending.current;
    if (!update) return;
    setState({ status: 'installing', version: update.version });
    try {
      await update.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e) {
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  useEffect(() => {
    if (!IS_DESKTOP) return;
    const timer = setTimeout(() => check(false), AUTO_CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [check]);

  return { update: state, checkForUpdate: () => check(true), installUpdate: install };
}
