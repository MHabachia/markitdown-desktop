import { useEffect, useLayoutEffect, useRef } from 'react';
import { IS_DESKTOP, guardWindowClose } from '../utils/desktop';

/** Asks before the window closes while converted results are not saved yet (desktop app only). */
export function useCloseGuard(unsavedCount: number) {
  const unsavedRef = useRef(unsavedCount);
  useLayoutEffect(() => {
    unsavedRef.current = unsavedCount;
  });
  useEffect(() => {
    if (!IS_DESKTOP) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    guardWindowClose(
      () => unsavedRef.current > 0,
      'Es gibt umgewandelte Dateien, die noch nicht gespeichert sind. App trotzdem schließen?'
    ).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);
}
