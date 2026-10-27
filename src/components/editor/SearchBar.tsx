import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  matches: number;
  onClose: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ query, onQueryChange, matches, onClose }) => (
  <div
    style={{
      padding: '8px 16px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    }}
  >
    <Search size={14} color="var(--text-muted)" />
    <input
      type="text"
      placeholder="Suchbegriff eingeben... (ESC zum Schließen)"
      value={query}
      onChange={(e) => onQueryChange(e.target.value)}
      style={{ flex: 1, padding: '4px 8px' }}
      autoFocus
    />
    {query && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{matches} Treffer</span>}
    <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
      <X size={12} />
    </button>
  </div>
);
