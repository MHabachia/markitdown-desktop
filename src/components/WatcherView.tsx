import React from 'react';
import { FolderInput, FolderOutput, Play, Square } from 'lucide-react';
import { DEFAULT_INBOX, useWatcher } from '../hooks/useWatcher';
import { formatDateTime } from '../utils/format';
import { TextField } from './fields';
import { useApp } from '../context/AppContext';

/** Folder watcher: documents dropped into the inbox are converted automatically. */
export const WatcherView: React.FC = () => {
  const { settings, updateSettings, notify } = useApp();
  const watcher = useWatcher(settings, (msg) => notify(msg, 'error'));
  const running = watcher.status?.is_running ?? false;
  const lastEvent = watcher.status?.last_event_time
    ? formatDateTime(new Date(watcher.status.last_event_time * 1000).toISOString())
    : null;

  return (
    <div className="settings-container">
      <div className={`watcher-hero ${running ? 'running' : ''}`}>
        <div className="watcher-hero-text">
          <span className={`status ${running ? 'status-success' : 'status-ready'}`}>
            <span className="status-dot" aria-hidden="true" />
            {running ? 'Überwachung aktiv' : 'Überwachung aus'}
          </span>
          <h2>Automatisch umwandeln</h2>
          <p>
            Lege Dokumente in den Eingangsordner, MarkItDown wandelt sie im Hintergrund in Markdown um. Ideal für
            Downloads oder einen geteilten Ordner.
          </p>
          {running && (
            <p className="watcher-stats">
              {watcher.status?.processed_count ?? 0} Dateien umgewandelt{lastEvent ? ` · zuletzt ${lastEvent}` : ''}
            </p>
          )}
          {watcher.status?.last_error && <p className="error">Letzter Fehler: {watcher.status.last_error}</p>}
        </div>
        <button type="button" className={running ? 'btn-secondary btn-lg' : 'btn-primary btn-lg'} onClick={watcher.toggle}>
          {running ? <Square size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
          {running ? 'Stoppen' : 'Starten'}
        </button>
      </div>

      <section className="settings-section">
        <div className="settings-section-header">
          <h3>Ordner</h3>
        </div>
        <div className="settings-card">
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-title"><FolderInput size={14} aria-hidden="true" /> Eingangsordner</span>
              <span className="setting-desc">Neue Dateien hier werden umgewandelt. Wird bei Bedarf angelegt.</span>
            </div>
            <div className="setting-control">
              <TextField
                value={settings.watcher_inbox_dir || ''}
                placeholder={DEFAULT_INBOX}
                onCommit={(v) => updateSettings({ watcher_inbox_dir: v })}
              />
            </div>
          </div>
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-title"><FolderOutput size={14} aria-hidden="true" /> Zielordner</span>
              <span className="setting-desc">Leer: Markdown landet neben der Datei im Eingangsordner.</span>
            </div>
            <div className="setting-control">
              <TextField
                value={settings.watcher_output_dir || ''}
                placeholder="Wie Eingangsordner"
                onCommit={(v) => updateSettings({ watcher_output_dir: v })}
              />
            </div>
          </div>
        </div>
      </section>
      {running && <p className="settings-hint">Änderungen an den Ordnern gelten beim nächsten Start der Überwachung.</p>}
    </div>
  );
};
