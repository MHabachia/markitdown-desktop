import { useEffect, useLayoutEffect, useRef } from 'react';

export interface HotkeyHandlers {
  onCommandPalette: () => void;
  onConvertAll: () => void;
  onAddFiles: () => void;
  onAddFolder: () => void;
}

/** Global shortcuts (⌘/Strg + K, Enter, O, Shift+O). Handlers are read fresh on every key press. */
export function useHotkeys(handlers: HotkeyHandlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === 'k') ref.current.onCommandPalette();
      else if (e.key === 'Enter') ref.current.onConvertAll();
      else if (key === 'o' && e.shiftKey) ref.current.onAddFolder();
      else if (key === 'o') ref.current.onAddFiles();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
