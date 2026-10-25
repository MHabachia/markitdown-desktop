import React from 'react';
import { Download, FolderSync, History, Info, Settings, Wand2, LucideIcon } from 'lucide-react';
import { ActiveTab, SystemDiagnostics } from '../types';
import { UpdateState } from '../hooks/useUpdater';
import { Logo } from './Logo';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  fileCount: number;
  diagnostics: SystemDiagnostics | null;
  /** The engine has not answered for a long time (as opposed to still starting). */
  engineUnreachable: boolean;
  onRetryConnection: () => void;
  update: UpdateState;
  onInstallUpdate: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string; icon: LucideIcon }> = [
  { id: 'studio', label: 'Umwandeln', icon: Wand2 },
  { id: 'history', label: 'Verlauf', icon: History },
  { id: 'watcher', label: 'Ordner-Überwachung', icon: FolderSync },
  { id: 'settings', label: 'Einstellungen', icon: Settings }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  fileCount,
  diagnostics,
  engineUnreachable,
  onRetryConnection,
  update,
  onInstallUpdate
}) => {
  const isReady = diagnostics?.status === 'ready';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Logo size={28} />
        <span className="brand-title">MarkItDown</span>
      </div>

      <nav className="sidebar-nav" aria-label="Hauptnavigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`nav-item ${activeTab === id ? 'active' : ''}`}
            aria-current={activeTab === id ? 'page' : undefined}
            onClick={() => setActiveTab(id)}
          >
            <span className="nav-item-left">
              <Icon size={16} aria-hidden="true" />
              {label}
            </span>
            {id === 'studio' && fileCount > 0 && <span className="nav-badge">{fileCount}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        {(update.status === 'available' || update.status === 'installing') && (
          <button type="button" className="update-banner" onClick={onInstallUpdate} disabled={update.status === 'installing'}>
            <Download size={15} aria-hidden="true" />
            <span>
              <strong>{update.status === 'installing' ? 'Wird installiert …' : `Update ${update.version}`}</strong>
              {update.status === 'available' && <small>Installieren und neu starten</small>}
            </span>
          </button>
        )}
        <button
          type="button"
          className={`nav-item ${activeTab === 'about' ? 'active' : ''}`}
          aria-current={activeTab === 'about' ? 'page' : undefined}
          onClick={() => setActiveTab('about')}
        >
          <span className="nav-item-left">
            <Info size={16} aria-hidden="true" />
            Über MarkItDown
          </span>
        </button>
        {isReady ? (
          <span className="engine-state">
            <span className="status-dot ok" aria-hidden="true" />
            Bereit · lokal
          </span>
        ) : (
          <button type="button" className="engine-state engine-state-retry" onClick={onRetryConnection}>
            <span className={`status-dot ${engineUnreachable ? 'error' : 'warn'}`} aria-hidden="true" />
            {engineUnreachable ? 'Engine antwortet nicht · erneut versuchen' : 'Engine startet …'}
          </button>
        )}
      </div>
    </aside>
  );
};
