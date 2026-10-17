import React, { useMemo, useState } from 'react';
import { ExternalLink, FolderOpen, RotateCcw, Search, Trash2 } from 'lucide-react';
import { HistoryItem } from '../types';
import { formatDateTime, metaLine } from '../utils/format';
import { IconButton } from './IconButton';

interface HistoryViewProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onOpenFile: (path: string) => void;
  onReconvert: (sourcePath: string) => void;
}

const extensionLabel = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toUpperCase() : 'DATEI';
};

export const HistoryView: React.FC<HistoryViewProps> = ({
  history,
  onClearHistory,
  onDeleteItem,
  onOpenFolder,
  onOpenFile,
  onReconvert
}) => {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (item) => item.source_name.toLowerCase().includes(q) || (item.target_path ?? '').toLowerCase().includes(q)
    );
  }, [history, search]);

  if (history.length === 0) {
    return (
      <div className="empty-state">
        <h2>Noch keine Konvertierungen</h2>
        <p>Konvertierte Dateien erscheinen hier, damit du sie später wieder öffnen kannst.</p>
      </div>
    );
  }

  return (
    <div className="queue">
      <div className="queue-toolbar">
        <label className="search-field">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            placeholder="Nach Dateinamen suchen"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Verlauf durchsuchen"
          />
        </label>
        <div className="queue-actions">
          <button type="button" className="btn-ghost btn-sm danger-text" onClick={onClearHistory}>
            <Trash2 size={14} aria-hidden="true" />
            Verlauf leeren
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="queue-empty">Keine Treffer für „{search}“.</p>
      ) : (
        <ul className="list" aria-label="Verlauf">
          {visible.map((item) => {
            const failed = item.status === 'failed';
            const meta = failed
              ? metaLine(formatDateTime(item.timestamp), item.error || 'Fehlgeschlagen')
              : metaLine(formatDateTime(item.timestamp), item.word_count ? `${item.word_count} Wörter` : '');
            return (
              <li className="list-row" key={item.id}>
                <span className="format-badge">{extensionLabel(item.source_name)}</span>
                <div className="list-row-main">
                  <span className="list-row-name" title={item.source_path}>{item.source_name}</span>
                  <span className={`list-row-meta ${failed ? 'error' : ''}`}>{meta}</span>
                </div>
                <span className={`status status-${failed ? 'failed' : 'success'}`}>
                  <span className="status-dot" aria-hidden="true" />
                  {failed ? 'Fehler' : 'Fertig'}
                </span>
                <div className="list-row-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => item.target_path && onOpenFile(item.target_path)}
                    disabled={failed || !item.target_path}
                    title="Markdown-Datei im Standardprogramm öffnen"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    Öffnen
                  </button>
                  <IconButton
                    label="Im Ordner zeigen"
                    onClick={() => item.target_path && onOpenFolder(item.target_path)}
                    disabled={!item.target_path}
                  >
                    <FolderOpen size={15} />
                  </IconButton>
                  <IconButton label="Erneut konvertieren" onClick={() => onReconvert(item.source_path)}>
                    <RotateCcw size={15} />
                  </IconButton>
                  <IconButton label="Aus Verlauf entfernen" onClick={() => onDeleteItem(item.id)}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
