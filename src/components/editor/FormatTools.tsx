import React from 'react';
import { ListOrdered, Sparkles, Table } from 'lucide-react';

interface FormatToolsProps {
  onFormatTables: () => void;
  onCleanWhitespace: () => void;
  onInsertToc: () => void;
}

/** Quick formatting helpers, shown next to the source editor. */
export const FormatTools: React.FC<FormatToolsProps> = ({ onFormatTables, onCleanWhitespace, onInsertToc }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '8px' }}>
    <button type="button" className="btn-ghost btn-sm" onClick={onFormatTables} title="Markdown-Tabellen sauber ausrichten">
      <Table size={13} style={{ marginRight: 4 }} />
      Tabellen
    </button>
    <button
      type="button"
      className="btn-ghost btn-sm"
      onClick={onCleanWhitespace}
      title="Überflüssige Leerzeilen & Whitespace bereinigen"
    >
      <Sparkles size={13} style={{ marginRight: 4 }} />
      Bereinigen
    </button>
    <button type="button" className="btn-ghost btn-sm" onClick={onInsertToc} title="Inhaltsverzeichnis (TOC) am Anfang generieren">
      <ListOrdered size={13} style={{ marginRight: 4 }} />
      +TOC
    </button>
  </div>
);
