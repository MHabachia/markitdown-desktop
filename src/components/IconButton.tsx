import React from 'react';

/** Square icon-only button; the label doubles as tooltip and accessible name. */
export const IconButton: React.FC<{
  label: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ label, onClick, disabled, children }) => (
  <button type="button" className="icon-button" onClick={onClick} disabled={disabled} title={label} aria-label={label}>
    {children}
  </button>
);
