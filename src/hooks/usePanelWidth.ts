import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'markitdown.panelWidth';
export const PANEL_MIN = 320;
export const PANEL_DEFAULT = 400;
/** Space that must stay for the sidebar (220 px) and a usable file list. */
const RESERVED_FOR_REST = 220 + 380;

const maxWidth = () => Math.max(PANEL_MIN, window.innerWidth - RESERVED_FOR_REST);
const clamp = (w: number) => Math.round(Math.min(maxWidth(), Math.max(PANEL_MIN, w)));

const load = () => {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(saved) && saved > 0 ? clamp(saved) : PANEL_DEFAULT;
  } catch {
    return PANEL_DEFAULT;
  }
};

/** Width of the studio side panel: clamped to the window and remembered on this device. */
export function usePanelWidth() {
  const [width, setWidth] = useState(load);

  const update = useCallback((next: number, persist: boolean) => {
    const value = clamp(next);
    setWidth(value);
    if (!persist) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      /* not remembered, still applies for this session */
    }
  }, []);

  // Keep the panel inside the window when the window gets smaller.
  useEffect(() => {
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return { width, setWidth: update, max: maxWidth };
}
