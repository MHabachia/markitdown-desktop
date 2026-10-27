import React from 'react';
import { Code, Columns, FileText } from 'lucide-react';

export type EditorViewMode = 'preview' | 'editor' | 'split';

const MODES: Array<{ id: EditorViewMode; label: string; title: string; icon: typeof FileText }> = [
  { id: 'preview', label: 'Vorschau', title: 'Gerenderte Vorschau', icon: FileText },
  { id: 'editor', label: 'Quelltext', title: 'Markdown-Quelltext bearbeiten', icon: Code },
  { id: 'split', label: 'Geteilt', title: 'Geteilte Ansicht (Split-View)', icon: Columns }
];

export const ViewModeTabs: React.FC<{ value: EditorViewMode; onChange: (mode: EditorViewMode) => void }> = ({
  value,
  onChange
}) => (
  <div className="view-mode-tabs">
    {MODES.map(({ id, label, title, icon: Icon }) => (
      <button
        key={id}
        type="button"
        className={`view-mode-btn ${value === id ? 'active' : ''}`}
        onClick={() => onChange(id)}
        title={title}
      >
        <Icon size={13} style={{ display: 'inline', marginRight: 4 }} />
        {label}
      </button>
    ))}
  </div>
);
