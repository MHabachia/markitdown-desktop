import { useCallback, useState } from 'react';
import { ToastMessage } from '../components/Toast';

export type Notify = (text: string, type?: 'success' | 'error' | 'info') => void;

const TOAST_MS = 3500;

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const notify: Notify = useCallback(
    (text, type = 'info') => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, text, type }]);
      setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss]
  );

  return { toasts, notify, dismiss };
}
