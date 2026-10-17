import React, { version as reactVersion } from 'react';
import {
  Download,
  Info,
  RefreshCw,
  Copy,
  Cpu,
  ExternalLink,
  FileInput,
  GitBranch,
  LucideIcon,
  Monitor,
  Scale,
  ShieldCheck,
  Sparkles,
  Wand2
} from 'lucide-react';
import { version as APP_VERSION } from '../../package.json';
import { FormatCapability, SystemDiagnostics } from '../types';
import { UpdateState } from '../hooks/useUpdater';
import { MARKITDOWN_URL, PROJECT_URL, openExternal } from '../utils/openExternal';
import { FormatStrip } from './FormatStrip';
import { Logo } from './Logo';

interface AboutViewProps {
  diagnostics: SystemDiagnostics | null;
  capabilities: FormatCapability[];
  update: UpdateState;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

interface StackLayer {
  icon: LucideIcon;
  title: string;
  description: string;
  items: string[];
}

export const AboutView: React.FC<AboutViewProps> = ({
  diagnostics,
  capabilities,
  update,
  onCheckUpdate,
  onInstallUpdate,
  onNotify
}) => {
  const stack: StackLayer[] = [
    {
      icon: Monitor,
      title: 'Oberfläche',
      description: 'Was du siehst und bedienst',
      items: [`React ${reactVersion}`, 'TypeScript', 'Vite', 'Lucide Icons']
    },
    {
      icon: Cpu,
      title: 'Desktop-App',
      description: 'Fenster, Installer, Start und Ende des Backends',
      items: ['Tauri 2', 'Rust', 'macOS und Windows']
    },
    {
      icon: Wand2,
      title: 'Konvertierung',
      description: 'Wandelt Dokumente lokal in Markdown um',
      items: [
        `Microsoft MarkItDown ${diagnostics ? `v${diagnostics.markitdown_version}` : ''}`.trim(),
        `Python ${diagnostics?.python_version ?? '3.12'}`,
        'FastAPI'
      ]
    },
    {
      icon: ShieldCheck,
      title: 'Sicherheit',
      description: 'Alles bleibt auf deinem Gerät',
      items: ['Nur 127.0.0.1', 'Sitzungs-Token', 'Bereinigte Vorschau', 'Keine Telemetrie']
    }
  ];

  const open = (url: string) =>
    openExternal(url).catch((e) => onNotify(`Link konnte nicht geöffnet werden: ${e instanceof Error ? e.message : e}`, 'error'));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(PROJECT_URL);
      onNotify('Link kopiert', 'success');
    } catch {
      onNotify('Kopieren nicht möglich', 'error');
    }
  };

  const systemRows: Array<[string, string]> = [
    ['App-Version', APP_VERSION],
    ['MarkItDown', diagnostics ? `v${diagnostics.markitdown_version}` : '–'],
    ['Python', diagnostics?.python_version ?? '–'],
    ['System', diagnostics?.platform ?? '–'],
    ['Engine', diagnostics ? 'Bereit (lokal)' : 'Nicht verbunden']
  ];

  return (
    <div className="about">
      <section className="about-hero">
        <Logo size={72} />
        <div className="about-hero-text">
          <div className="about-title-row">
            <h2>MarkItDown Desktop</h2>
            <span className="about-version">v{APP_VERSION}</span>
          </div>
          <p>
            Wandelt PDFs, Office-Dokumente, Webseiten und Daten lokal in sauberes Markdown um, für Notizen, Wikis und
            KI-Werkzeuge. Ohne Cloud, ohne Konto.
          </p>
          {/* The repository has its own card below; the hero only carries the update action. */}
          <div className="about-actions">
            <UpdateButton update={update} onCheck={onCheckUpdate} onInstall={onInstallUpdate} />
          </div>
          <UpdateStatus update={update} />
        </div>
      </section>

      <section className="about-section">
        <h3>So funktioniert es</h3>
        <div className="about-steps">
          {[
            { icon: FileInput, title: 'Dateien wählen', text: 'Ziehen, auswählen oder einen ganzen Ordner hinzufügen.' },
            { icon: Wand2, title: 'Umwandeln', text: 'MarkItDown erkennt Überschriften, Listen und Tabellen.' },
            { icon: Sparkles, title: 'Prüfen und speichern', text: 'Vorschau ansehen, bei Bedarf bearbeiten, dann speichern oder als ZIP exportieren.' }
          ].map(({ icon: Icon, title, text }, i) => (
            <div className="about-step" key={title}>
              <span className="about-step-number">{i + 1}</span>
              <Icon size={18} aria-hidden="true" />
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h3>Tech-Stack</h3>
        <div className="stack-grid">
          {stack.map(({ icon: Icon, title, description, items }) => (
            <div className="stack-card" key={title}>
              <div className="stack-card-head">
                <span className="stack-icon"><Icon size={18} aria-hidden="true" /></span>
                <div>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </div>
              </div>
              <div className="stack-pills">
                {items.map((item) => (
                  <span className="stack-pill" key={item}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="about-section">
        <h3>Unterstützte Formate</h3>
        <FormatStrip capabilities={capabilities} />
      </section>

      <section className="about-section about-two-col">
        <div className="repo-card">
          <div className="repo-card-head">
            <GitBranch size={20} aria-hidden="true" />
            <div>
              <strong>MHabachia/markitdown-desktop</strong>
              <span>Quellcode, Releases und Fehlermeldungen</span>
            </div>
          </div>
          <code className="repo-url">{PROJECT_URL}</code>
          <div className="about-actions">
            <button type="button" className="btn-secondary btn-sm" onClick={() => open(PROJECT_URL)}>
              <ExternalLink size={13} aria-hidden="true" />
              Repository öffnen
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={copyLink}>
              <Copy size={13} aria-hidden="true" />
              Link kopieren
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => open(`${PROJECT_URL}/releases`)}>
              Releases
            </button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => open(`${PROJECT_URL}/issues`)}>
              Problem melden
            </button>
          </div>
        </div>

        <div className="repo-card">
          <div className="repo-card-head">
            <Info size={20} aria-hidden="true" />
            <div>
              <strong>Systeminformationen</strong>
              <span>Hilfreich für Fehlermeldungen</span>
            </div>
          </div>
          <dl className="system-list">
            {systemRows.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </section>

      <footer className="about-legal">
        <Scale size={13} aria-hidden="true" />
        <span>
          MIT-Lizenz. Basiert auf{' '}
          <button type="button" className="link-button inline" onClick={() => open(MARKITDOWN_URL)}>
            Microsoft MarkItDown
          </button>
          .
        </span>
      </footer>
    </div>
  );
};

const UpdateButton: React.FC<{ update: UpdateState; onCheck: () => void; onInstall: () => void }> = ({ update, onCheck, onInstall }) => {
  if (update.status === 'unsupported') return null;
  if (update.status === 'available' || update.status === 'installing') {
    return (
      <button type="button" className="btn-primary" onClick={onInstall} disabled={update.status === 'installing'}>
        <Download size={14} aria-hidden="true" />
        {update.status === 'installing' ? 'Wird installiert …' : `Update ${update.version} installieren`}
      </button>
    );
  }
  return (
    <button type="button" className="btn-secondary" onClick={onCheck} disabled={update.status === 'checking'}>
      <RefreshCw size={14} className={update.status === 'checking' ? 'spin-icon' : ''} aria-hidden="true" />
      Nach Updates suchen
    </button>
  );
};

const UpdateStatus: React.FC<{ update: UpdateState }> = ({ update }) => {
  if (update.status === 'none') return <p className="update-note ok">Du verwendest die neueste Version.</p>;
  if (update.status === 'error') return <p className="update-note error">Update-Prüfung fehlgeschlagen: {update.message}</p>;
  return null;
};
