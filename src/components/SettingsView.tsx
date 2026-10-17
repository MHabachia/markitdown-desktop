import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { AppSettings, SystemDiagnostics } from '../types';
import { Checkbox, NumberField, TEMPLATE_PRESETS, TextField } from './fields';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  diagnostics: SystemDiagnostics | null;
  onRefreshDiagnostics: () => void;
  onClearHistory: () => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}


export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  diagnostics,
  onRefreshDiagnostics,
  onClearHistory,
  onNotify
}) => {

  return (
    <div className="settings-container">
      <Section title="Ausgabe">
        <Row title="Ausgabeordner" description="Leer lassen, um die Markdown-Datei neben dem Original abzulegen.">
          <TextField
            value={settings.default_output_dir}
            placeholder="Neben dem Original"
            onCommit={(v) => onUpdateSettings({ default_output_dir: v })}
          />
        </Row>
        <Row title="Dateiname" description="Platzhalter: {name}, {date}, {time}, {ext}">
          <div className="field-stack">
            <TextField
              value={settings.filename_template || '{name}.md'}
              placeholder="{name}.md"
              onCommit={(v) => onUpdateSettings({ filename_template: v || '{name}.md' })}
            />
            <div className="chip-row">
              {TEMPLATE_PRESETS.map((tpl) => (
                <button key={tpl} type="button" className="chip" onClick={() => onUpdateSettings({ filename_template: tpl })}>
                  {tpl}
                </button>
              ))}
            </div>
          </div>
        </Row>
        <Row title="Wenn die Datei schon existiert">
          <select
            value={settings.collision_strategy}
            onChange={(e) => onUpdateSettings({ collision_strategy: e.target.value as AppSettings['collision_strategy'] })}
          >
            <option value="rename">Nummerieren (datei (1).md)</option>
            <option value="overwrite">Überschreiben</option>
            <option value="skip">Überspringen</option>
            <option value="error">Als Fehler melden</option>
          </select>
        </Row>
      </Section>

      <Section title="Verarbeitung">
        <Row title="Gleichzeitige Konvertierungen">
          <select
            value={settings.concurrency_limit || 4}
            onChange={(e) => onUpdateSettings({ concurrency_limit: parseInt(e.target.value, 10) || 4 })}
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="4">4 (empfohlen)</option>
            <option value="8">8</option>
          </select>
        </Row>
        <Row title="Zeitlimit pro Dokument" description="In Sekunden.">
          <NumberField
            value={settings.timeout_seconds}
            min={1}
            max={3600}
            onCommit={(v) => onUpdateSettings({ timeout_seconds: v })}
          />
        </Row>
        <Row title="Nach dem Umwandeln" description="Standard: Ergebnis erst prüfen, dann speichern.">
          <div className="field-stack">
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
          </div>
        </Row>
        <Row title="Eingebettete Bilder" description="Bilder als Data-URI in der Markdown-Datei behalten.">
          <Checkbox checked={settings.keep_data_uris} label="Behalten" onChange={(v) => onUpdateSettings({ keep_data_uris: v })} />
        </Row>
      </Section>


      <Section title="Darstellung">
        <Row title="Erscheinungsbild">
          <select value={settings.theme} onChange={(e) => onUpdateSettings({ theme: e.target.value as AppSettings['theme'] })}>
            <option value="dark">Dunkel</option>
            <option value="light">Hell</option>
            <option value="system">System</option>
          </select>
        </Row>
      </Section>

      <Section
        title="Engine"
        action={
          <button type="button" className="btn-ghost btn-sm" onClick={onRefreshDiagnostics}>
            <RefreshCw size={13} aria-hidden="true" />
            Neu prüfen
          </button>
        }
      >
        <EngineInfo diagnostics={diagnostics} />
      </Section>

      <Section title="Datenschutz">
        <Row title="Verlauf" description="Alles bleibt auf diesem Gerät, es gibt keine Telemetrie.">
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => {
              onClearHistory();
              onNotify('Verlauf geleert', 'info');
            }}
          >
            <Trash2 size={13} aria-hidden="true" />
            Verlauf leeren
          </button>
        </Row>
      </Section>
    </div>
  );
};

/* ---------- building blocks ---------- */

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="settings-section">
    <div className="settings-section-header">
      <h3>{title}</h3>
      {action}
    </div>
    <div className="settings-card">{children}</div>
  </section>
);

const Row: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <div className="setting-row">
    <div className="setting-info">
      <span className="setting-title">{title}</span>
      {description && <span className="setting-desc">{description}</span>}
    </div>
    <div className="setting-control">{children}</div>
  </div>
);

const EngineInfo: React.FC<{ diagnostics: SystemDiagnostics | null }> = ({ diagnostics }) => {
  const connected = diagnostics !== null;
  const items: Array<[string, string]> = [
    ['Status', connected ? 'Verbunden' : 'Nicht verbunden'],
    ['MarkItDown', connected ? `v${diagnostics.markitdown_version}` : '–'],
    ['Python', connected ? diagnostics.python_version : '–'],
    ['System', connected ? diagnostics.platform.split(' (')[0] : '–']
  ];
  return (
    <div className="engine-info">
      <div className="diag-grid">
        {items.map(([label, value]) => (
          <div className="diag-item" key={label}>
            <span className="diag-label">{label}</span>
            <span className={`diag-value ${label === 'Status' ? (connected ? 'ok' : 'warn') : ''}`}>{value}</span>
          </div>
        ))}
      </div>
      {diagnostics && (
        <details className="details-toggle">
          <summary>Technische Details</summary>
          <div className="details-body">
            <div className="path-box">{diagnostics.python_path || '–'}</div>
            <div className="pkg-grid">
              {Object.entries(diagnostics.packages ?? {}).map(([pkg, ver]) => (
                <div key={pkg} className={`pkg-item ${ver.startsWith('Nicht') ? 'missing' : ''}`}>
                  <span>{pkg}</span>
                  <span>{ver}</span>
                </div>
              ))}
            </div>
          </div>
        </details>
      )}
    </div>
  );
};
