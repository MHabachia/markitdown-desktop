import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Minimal stand-in for testing-library's renderHook: renders a hook and exposes its latest result. */
export function renderHook<T>(hook: () => T) {
  const result = { current: undefined as unknown as T };
  function Probe() {
    result.current = hook();
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => {
    root.render(createElement(Probe));
  });
  return { result, unmount: () => act(() => root.unmount()) };
}

export { act };
