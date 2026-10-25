import React, { useRef } from 'react';
import { PANEL_DEFAULT, PANEL_MIN } from '../hooks/usePanelWidth';

interface ResizeHandleProps {
  width: number;
  max: () => number;
  /** persist = false while dragging, true when the drag ends or for keyboard steps. */
  onResize: (width: number, persist: boolean) => void;
}

const KEY_STEP = 24;

/** Vertical splitter on the panel's left edge: drag, arrow keys, or double-click to reset. */
export const ResizeHandle: React.FC<ResizeHandleProps> = ({ width, max, onResize }) => {
  const drag = useRef<{ startX: number; startWidth: number; last: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startWidth: width, last: width };
    document.body.classList.add('is-resizing');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // The panel sits on the right, so moving left makes it wider.
    const next = drag.current.startWidth + (drag.current.startX - e.clientX);
    drag.current.last = next;
    onResize(next, false);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    onResize(drag.current.last, true);
    drag.current = null;
    document.body.classList.remove('is-resizing');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowLeft: width + KEY_STEP,
      ArrowRight: width - KEY_STEP,
      Home: max(),
      End: PANEL_MIN
    };
    if (!(e.key in steps)) return;
    e.preventDefault();
    onResize(steps[e.key], true);
  };

  return (
    <div
      className="resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Breite der Vorschau ändern"
      aria-valuemin={PANEL_MIN}
      aria-valuemax={max()}
      aria-valuenow={width}
      tabIndex={0}
      title="Ziehen, um die Breite zu ändern · Doppelklick: Standardbreite"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onResize(PANEL_DEFAULT, true)}
      onKeyDown={onKeyDown}
    />
  );
};
