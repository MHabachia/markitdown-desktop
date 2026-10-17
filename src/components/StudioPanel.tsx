import React, { useMemo } from 'react';
import { Copy, FolderOpen, Maximize2, Save, X } from 'lucide-react';
import { AppSettings, FileItem } from '../types';
import { blockLinkNavigation, renderMarkdown } from '../utils/markdown';
import { Checkbox, TEMPLATE_PRESETS, TextField } from './fields';
import { FILE_MANAGER } from '../utils/platform';
import { usePanelWidth } from '../hooks/usePanelWidth';
import { IS_DESKTOP } from '../utils/desktop';
import { ResizeHandle } from './ResizeHandle';

export type PanelTab = 'preview' | 'options';

interface StudioPanelProps {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
  file: FileItem | null;
  settings: AppSettings;
  onUpdateSettings: (s: Partial<AppSettings>) => void;
  onOpenEditor: (file: FileItem) => void;
  onSave: (file: FileItem, saveAs: boolean) => void;
  onOpenFolder: (path: string) => void;
  onShowErrorDetails: (file: FileItem) => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

/** Right-hand panel of the studio: live preview of the selected file, or the quick options. */
export const StudioPanel: React.FC<StudioPanelProps> = (props) => {
  const { tab, onTabChange, onClose } = props;
  const { width, setWidth, max } = usePanelWidth();
  return (
    <aside className="studio-panel" aria-label="Vorschau und Optionen" style={{ width }}>
      <ResizeHandle width={width} max={max} onResize={setWidth} />
      <div className="studio-panel-header">
        <div className="segmented" role="tablist">
          {(['preview', 'options'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`segmented-item ${tab === id ? 'active' : ''}`}
              onClick={() => onTabChange(id)}
            >
              {id === 'preview' ? 'Vorschau' : 'Optionen'}
            </button>
          ))}
        </div>
        <button type="button" className="icon-button" onClick={onClose} title="Panel ausblenden" aria-label="Panel ausblenden">
          <X size={15} />
        </button>
      </div>
      <div className="studio-panel-body">{tab === 'preview' ? <PreviewTab {...props} /> : <OptionsTab {...props} />}</div>
    </aside>
  );
};

const PreviewTab: React.FC<StudioPanelProps> = ({ file, onOpenEditor, onOpenFolder, onShowErrorDetails, onNotify, onSave }) => {
  const markdown = file?.markdownContent;
  const html = useMemo(() => (markdown ? renderMarkdown(markdown) : ''), [markdown]);

  if (!file) {
    return <p className="panel-hint">Wähle links eine Datei, um ihr Markdown hier zu sehen.</p>;
  }
  if (file.status === 'failed') {
    return (
      <div className="panel-message">
        <h4>{file.name}</h4>
        <p className="error">{file.error || 'Konvertierung fehlgeschlagen'}</p>
        {file.solutionHint && <p>{file.solutionHint}</p>}
        <button type="button" className="btn-secondary btn-sm" onClick={() => onShowErrorDetails(file)}>
          Technische Details
        </button>
      </div>
    );
  }
  if (file.status !== 'success' || file.markdownContent === undefined) {
    return (
      <div className="panel-message">
        <h4>{file.name}</h4>
        <p>{file.status === 'converting' ? 'Wird gerade konvertiert …' : 'Noch nicht konvertiert. Die Vorschau erscheint nach der Konvertierung.'}</p>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(file.markdownContent ?? '');
      onNotify('Markdown kopiert', 'success');
    } catch {
      onNotify('Kopieren nicht möglich', 'error');
    }
  };

  return (
    <div className="preview">
      <div className="preview-header">
        <div className="preview-title" title={file.targetPath}>
          {file.saved && file.targetPath ? file.targetPath.split(/[\\/]/).pop() : file.name}
          <span className={`status ${file.saved ? 'status-success' : 'status-unsaved'}`}>
            <span className="status-dot" aria-hidden="true" />
            {file.saved ? 'Gespeichert' : 'Nicht gespeichert'}
          </span>
        </div>
        <div className="preview-actions">
          {!file.saved && (
            <>
              <button type="button" className="btn-primary btn-sm" onClick={() => onSave(file, false)} title="Neben dem Original bzw. im Zielordner speichern">
                <Save size={13} aria-hidden="true" />
                Speichern
              </button>
              {IS_DESKTOP && (
                <button type="button" className="btn-secondary btn-sm" onClick={() => onSave(file, true)}>
                  Speichern unter …
                </button>
              )}
            </>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={copy}>
            <Copy size={13} aria-hidden="true" />
            Kopieren
          </button>
          {file.saved && file.targetPath && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => onOpenFolder(file.targetPath!)}>
              <FolderOpen size={13} aria-hidden="true" />
              Im {FILE_MANAGER}
            </button>
          )}
          <button type="button" className="btn-secondary btn-sm" onClick={() => onOpenEditor(file)} title="Im Editor öffnen (Quelltext, Export)">
            <Maximize2 size={13} aria-hidden="true" />
            Bearbeiten
          </button>
        </div>
      </div>
      <div className="rendered-markdown preview-content" onClick={blockLinkNavigation} dangerouslySetInnerHTML={{ __html: html }} />
      <div className="preview-footer">{file.wordCount ?? 0} Wörter</div>
    </div>
  );
};

const OptionsTab: React.FC<StudioPanelProps> = ({ settings, onUpdateSettings }) => {
  return (
    <div className="panel-options">
      <PanelField label="Zielordner" hint="Leer: neben der Originaldatei">
        <TextField
          className="panel-input"
          value={settings.default_output_dir}
          placeholder="Neben dem Original"
          onCommit={(v) => onUpdateSettings({ default_output_dir: v })}
        />
      </PanelField>

      <PanelField label="Dateiname" hint="{name}, {date}, {time}, {ext}">
        <TextField
          className="panel-input"
          value={settings.filename_template || '{name}.md'}
          onCommit={(v) => onUpdateSettings({ filename_template: v || '{name}.md' })}
        />
        <div className="chip-row left">
          {TEMPLATE_PRESETS.map((tpl) => (
            <button key={tpl} type="button" className="chip" onClick={() => onUpdateSettings({ filename_template: tpl })}>
              {tpl}
            </button>
          ))}
        </div>
      </PanelField>

      <PanelField label="Wenn die Datei schon existiert">
        <select
          className="panel-input"
          value={settings.collision_strategy}
          onChange={(e) => onUpdateSettings({ collision_strategy: e.target.value as AppSettings['collision_strategy'] })}
        >
          <option value="rename">Nummerieren (datei (1).md)</option>
          <option value="overwrite">Überschreiben</option>
          <option value="skip">Überspringen</option>
          <option value="error">Als Fehler melden</option>
        </select>
      </PanelField>

      <PanelField label="Nach dem Umwandeln">
        <Checkbox
          checked={settings.open_preview_after_convert}
          label="Ergebnis in der Vorschau zeigen"
          onChange={(v) => onUpdateSettings({ open_preview_after_convert: v })}
        />
        <Checkbox
          checked={settings.auto_save_after_convert}
          label="Automatisch speichern (ohne Prüfen)"
          onChange={(v) => onUpdateSettings({ auto_save_after_convert: v })}
        />
        <Checkbox
          checked={settings.open_output_after_convert}
          label="Zielordner nach dem Speichern öffnen"
          onChange={(v) => onUpdateSettings({ open_output_after_convert: v })}
        />
      </PanelField>


      <p className="panel-hint">Weitere Optionen unter Einstellungen, automatische Umwandlung unter Ordner-Überwachung.</p>
    </div>
  );
};

const PanelField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="panel-field">
    <span className="panel-label">{label}</span>
    {children}
    {hint && <span className="panel-hint-inline">{hint}</span>}
  </div>
);
