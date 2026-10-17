import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div 
          key={t.id} 
          className={`toast ${t.type}`}
          onClick={() => onDismiss(t.id)}
          style={{ cursor: 'pointer' }}
        >
          {t.type === 'success' && <CheckCircle2 size={16} color="var(--color-success)" />}
          {t.type === 'error' && <AlertCircle size={16} color="var(--color-error)" />}
          {t.type === 'info' && <Info size={16} color="var(--accent-primary)" />}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
};
