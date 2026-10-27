import React, { useMemo } from 'react';
import { Archive, Eye, FilePlus, FolderOpen, FolderPlus, Info, Play, Plus, RefreshCw, Save, Sparkles, Trash2 } from 'lucide-react';
import { FileItem } from '../types';
import { formatBytes, isPending, metaLine, statusClass, statusLabel } from '../utils/format';
import { FILE_MANAGER, shortcut } from '../utils/platform';
import { FileIcon } from './FileIcon';
import { IconButton } from './IconButton';
import { Stepper, StepState } from './Stepper';
import { useApp } from '../context/AppContext';

export type ViewMode = 'grid' | 'list';

/** Characters of Markdown shown on a tile. */
const SNIPPET_LENGTH = 240;

interface FileQueueProps {
  files: FileItem[];
  filter: string;
  viewMode: ViewMode;
  selectedId: string | null;
  isConverting: boolean;
  onSelect: (file: FileItem) => void;
  onConvertAll: () => void;
  onConvertSingle: (id: string) => void;
  onSave: (file: FileItem) => void;
  onSaveAll: () => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onShowErrorDetails: (file: FileItem) => void;
  onAddFilesClick: () => void;
  onAddFolderClick: () => void;
  onLoadSamples: () => void;
  onExportZip: () => void;
}

/** Per-file callbacks shared by tiles and list rows. */
interface ItemActions {
  isConverting: boolean;
  onSelect: (file: FileItem) => void;
  onConvertSingle: (id: string) => void;
  onSave: (file: FileItem) => void;
  onRemoveFile: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onShowErrorDetails: (file: FileItem) => void;
}

const formatDuration = (ms?: number) => {
  if (ms === undefined) return '';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} s`;
};

const fileMeta = (file: FileItem) =>
  file.status === 'failed'
    ? file.error || 'Konvertierung fehlgeschlagen'
    : metaLine(
        file.extension.replace('.', '').toUpperCase(),
        formatBytes(file.size),
        file.status === 'success' && file.wordCount ? `${file.wordCount} Wörter` : '',
        file.status === 'success' ? formatDuration(file.durationMs) : ''
      );

/** Buttons inside a selectable item must not also select it. */
const stop = (fn: () => void) => (e: React.MouseEvent) => {
  e.stopPropagation();
  fn();
};

export const FileQueue: React.FC<FileQueueProps> = (props) => {
  const { openFolder } = useApp();
  const { files, filter, viewMode, selectedId, isConverting, onConvertAll, onSaveAll, onClearAll, onExportZip } = props;

  const counts = useMemo(() => {
    const success = files.filter((f) => f.status === 'success').length;
    const failed = files.filter((f) => f.status === 'failed').length;
    const pending = files.filter((f) => isPending(f.status)).length;
    const unsaved = files.filter((f) => f.status === 'success' && !f.saved).length;
    return { total: files.length, success, failed, pending, unsaved, done: success + failed };
  }, [files]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
  }, [files, filter]);

  const convertible = counts.pending + counts.failed;
  const percent = counts.total ? Math.round((counts.done / counts.total) * 100) : 0;

  const steps: Array<{ label: string; state: StepState }> = [
    { label: 'Dateien wählen', state: 'done' },
    { label: 'Umwandeln', state: convertible === 0 ? 'done' : 'active' },
    {
      label: 'Prüfen und speichern',
      state: counts.success === 0 ? 'todo' : counts.unsaved > 0 || convertible > 0 ? 'active' : 'done'
    }
  ];

  const actions: ItemActions = { ...props, onOpenFolder: openFolder };

  return (
    <div className="queue">
      <Stepper steps={steps} />

      <div className="summary-bar">
        <span className="summary-total">{counts.total} {counts.total === 1 ? 'Datei' : 'Dateien'}</span>
        {counts.success - counts.unsaved > 0 && (
          <span className="status status-success"><span className="status-dot" aria-hidden="true" />{counts.success - counts.unsaved} gespeichert</span>
        )}
        {counts.unsaved > 0 && (
          <span className="status status-unsaved"><span className="status-dot" aria-hidden="true" />{counts.unsaved} nicht gespeichert</span>
        )}
        {counts.failed > 0 && <span className="status status-failed"><span className="status-dot" aria-hidden="true" />{counts.failed} Fehler</span>}
        {counts.pending > 0 && (
          <span className="status status-ready"><span className="status-dot" aria-hidden="true" />{counts.pending} offen</span>
        )}
        <div className="summary-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="summary-fill success" style={{ width: `${counts.total ? (counts.success / counts.total) * 100 : 0}%` }} />
          <div className="summary-fill failed" style={{ width: `${counts.total ? (counts.failed / counts.total) * 100 : 0}%` }} />
        </div>
        <span className="summary-percent">{percent} %</span>
        <div className="queue-actions">
          {counts.success > 0 && (
            <IconButton label="Alle fertigen Dateien als ZIP exportieren" onClick={onExportZip}>
              <Archive size={16} />
            </IconButton>
          )}
          <IconButton label="Liste leeren" onClick={onClearAll} disabled={isConverting}>
            <Trash2 size={16} />
          </IconButton>
          {counts.unsaved > 0 && !isConverting && (
            <button
              type="button"
              className={convertible > 0 ? 'btn-secondary' : 'btn-primary'}
              onClick={onSaveAll}
              title="Alle umgewandelten, noch nicht gespeicherten Dateien speichern"
            >
              <Save size={15} aria-hidden="true" />
              Alle speichern ({counts.unsaved})
            </button>
          )}
          {(convertible > 0 || isConverting) && (
            <button
              type="button"
              className="btn-primary"
              onClick={onConvertAll}
              disabled={isConverting}
              title={`Alle offenen Dateien umwandeln (${shortcut('Enter')})`}
            >
              {isConverting ? <RefreshCw size={15} className="spin-icon" aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
              {isConverting ? `Wandelt um … ${counts.done}/${counts.total}` : `Umwandeln (${convertible})`}
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="queue-empty">Keine Datei passt zu „{filter}“.</p>
      ) : viewMode === 'grid' ? (
        <div className="tile-grid">
          {visible.map((file) => (
            <Tile key={file.id} file={file} selected={file.id === selectedId} {...actions} />
          ))}
          <AddTile {...props} />
        </div>
      ) : (
        <>
          <ul className="list" aria-label="Dateien">
            {visible.map((file) => (
              <Row key={file.id} file={file} selected={file.id === selectedId} {...actions} />
            ))}
          </ul>
          <AddBar {...props} />
        </>
      )}
    </div>
  );
};

/* ---------- grid ---------- */

const Tile: React.FC<ItemActions & { file: FileItem; selected: boolean }> = ({ file, selected, ...a }) => {
  const busy = file.status === 'converting' || a.isConverting;
  return (
    <div
      className={`tile status-${file.status} ${selected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={() => a.onSelect(file)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          a.onSelect(file);
        }
      }}
    >
      <div className="tile-preview">
        {file.status === 'success' && file.markdownContent !== undefined ? (
          <pre>{file.markdownContent.slice(0, SNIPPET_LENGTH)}</pre>
        ) : file.status === 'failed' ? (
          <p className="tile-error">{file.error || 'Konvertierung fehlgeschlagen'}</p>
        ) : file.status === 'converting' ? (
          <div className="tile-progress"><span /></div>
        ) : (
          <div className="tile-placeholder">
            <FileIcon extension={file.extension} size={34} />
            <span>Bereit zum Umwandeln</span>
          </div>
        )}
      </div>
      <div className="tile-info">
        <FileIcon extension={file.extension} size={18} />
        <div className="tile-text">
          <span className="tile-name" title={file.path}>{file.name}</span>
          <span className={`status ${statusClass(file)}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusLabel(file)}
            {file.status === 'success' && file.wordCount ? ` · ${file.wordCount} Wörter` : ''}
          </span>
        </div>
      </div>
      <div className="tile-actions">
        <PrimaryAction file={file} busy={busy} {...a} />
        <span className="tile-actions-spacer" />
        {file.status === 'success' && !file.saved && (
          <IconButton label="Speichern" onClick={stop(() => a.onSave(file))}>
            <Save size={15} />
          </IconButton>
        )}
        {file.targetPath && file.saved && (
          <IconButton label={`Im ${FILE_MANAGER} zeigen`} onClick={stop(() => a.onOpenFolder(file.targetPath!))}>
            <FolderOpen size={15} />
          </IconButton>
        )}
        {(file.status === 'success' || file.status === 'failed') && (
          <IconButton label="Erneut umwandeln" onClick={stop(() => a.onConvertSingle(file.id))} disabled={busy}>
            <RefreshCw size={15} />
          </IconButton>
        )}
        <IconButton label="Entfernen" onClick={stop(() => a.onRemoveFile(file.id))} disabled={busy}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </div>
  );
};

const AddTile: React.FC<FileQueueProps> = ({ onAddFilesClick, onAddFolderClick, onLoadSamples, isConverting }) => (
  <div className="tile tile-add">
    <Plus size={22} aria-hidden="true" />
    <span>Weitere Dateien hierher ziehen</span>
    <div className="tile-add-actions">
      <button type="button" className="btn-secondary btn-sm" onClick={onAddFilesClick} disabled={isConverting} title={shortcut('O')}>
        <FilePlus size={13} aria-hidden="true" />
        Dateien
      </button>
      <button type="button" className="btn-secondary btn-sm" onClick={onAddFolderClick} disabled={isConverting} title={shortcut('O', { shift: true })}>
        <FolderPlus size={13} aria-hidden="true" />
        Ordner
      </button>
    </div>
    <button type="button" className="link-button" onClick={onLoadSamples} disabled={isConverting}>
      <Sparkles size={12} aria-hidden="true" />
      Beispieldateien
    </button>
  </div>
);

/* ---------- list ---------- */

const Row: React.FC<ItemActions & { file: FileItem; selected: boolean }> = ({ file, selected, ...a }) => {
  const busy = file.status === 'converting' || a.isConverting;
  return (
    <li
      className={`list-row selectable ${selected ? 'selected' : ''}`}
      tabIndex={0}
      aria-current={selected ? true : undefined}
      onClick={() => a.onSelect(file)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          a.onSelect(file);
        }
      }}
    >
      <FileIcon extension={file.extension} size={22} />
      <div className="list-row-main">
        <span className="list-row-name" title={file.path}>{file.name}</span>
        <span className={`list-row-meta ${file.status === 'failed' ? 'error' : ''}`}>{fileMeta(file)}</span>
      </div>
      <span className={`status ${statusClass(file)}`}>
        <span className="status-dot" aria-hidden="true" />
        {statusLabel(file)}
      </span>
      <div className="list-row-actions">
        <PrimaryAction file={file} busy={busy} {...a} />
        {file.status === 'success' && !file.saved ? (
          <IconButton label="Speichern" onClick={stop(() => a.onSave(file))}>
            <Save size={15} />
          </IconButton>
        ) : file.targetPath && file.saved ? (
          <IconButton label={`Im ${FILE_MANAGER} zeigen`} onClick={stop(() => a.onOpenFolder(file.targetPath!))}>
            <FolderOpen size={15} />
          </IconButton>
        ) : (
          <span className="icon-slot" aria-hidden="true" />
        )}
        {file.status === 'success' || file.status === 'failed' ? (
          <IconButton label="Erneut umwandeln" onClick={stop(() => a.onConvertSingle(file.id))} disabled={busy}>
            <RefreshCw size={15} />
          </IconButton>
        ) : (
          <span className="icon-slot" aria-hidden="true" />
        )}
        <IconButton label="Entfernen" onClick={stop(() => a.onRemoveFile(file.id))} disabled={busy}>
          <Trash2 size={15} />
        </IconButton>
      </div>
    </li>
  );
};

const AddBar: React.FC<FileQueueProps> = ({ onAddFilesClick, onAddFolderClick, onLoadSamples, isConverting }) => (
  <div className="add-bar">
    <button type="button" className="btn-secondary btn-sm" onClick={onAddFilesClick} disabled={isConverting} title={shortcut('O')}>
      <FilePlus size={13} aria-hidden="true" />
      Dateien hinzufügen
    </button>
    <button type="button" className="btn-secondary btn-sm" onClick={onAddFolderClick} disabled={isConverting} title={shortcut('O', { shift: true })}>
      <FolderPlus size={13} aria-hidden="true" />
      Ordner hinzufügen
    </button>
    <button type="button" className="btn-ghost btn-sm" onClick={onLoadSamples} disabled={isConverting}>
      <Sparkles size={13} aria-hidden="true" />
      Beispieldateien
    </button>
  </div>
);

/* ---------- shared ---------- */

const PrimaryAction: React.FC<ItemActions & { file: FileItem; busy: boolean }> = ({ file, busy, onSelect, onShowErrorDetails, onConvertSingle }) => {
  if (file.status === 'success') {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={stop(() => onSelect(file))}>
        <Eye size={13} aria-hidden="true" />
        Vorschau
      </button>
    );
  }
  if (file.status === 'failed') {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={stop(() => onShowErrorDetails(file))}>
        <Info size={13} aria-hidden="true" />
        Details
      </button>
    );
  }
  if (file.status === 'ready') {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={stop(() => onConvertSingle(file.id))} disabled={busy}>
        <Play size={13} aria-hidden="true" />
        Umwandeln
      </button>
    );
  }
  return null;
};
