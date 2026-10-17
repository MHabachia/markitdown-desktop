import React from 'react';
import { LayoutGrid, List, PanelRight, Search } from 'lucide-react';
import { shortcut } from '../utils/platform';
import { ViewMode } from './FileQueue';

interface TopBarProps {
  title: string;
  subtitle?: string;
  /** Studio with files: filter field, view switch and panel toggle. */
  studioTools?: {
    filter: string;
    onFilterChange: (value: string) => void;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    isPanelOpen: boolean;
    onTogglePanel: () => void;
  };
  onOpenCommandPalette: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, studioTools, onOpenCommandPalette }) => (
  <header className="top-bar">
    <div className="top-bar-left">
      <h1 className="page-title">{title}</h1>
      {subtitle && <span className="page-subtitle">{subtitle}</span>}
    </div>

    {studioTools && (
      <label className="command-bar">
        <Search size={14} aria-hidden="true" />
        <input
          type="search"
          placeholder="Dateien filtern"
          value={studioTools.filter}
          onChange={(e) => studioTools.onFilterChange(e.target.value)}
          aria-label="Dateien filtern"
        />
        <button type="button" className="command-bar-kbd" onClick={onOpenCommandPalette} title="Befehlsmenü öffnen">
          {shortcut('K')}
        </button>
      </label>
    )}

    <div className="top-bar-right">
      {studioTools ? (
        <>
          <div className="segmented" role="group" aria-label="Ansicht">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`segmented-item icon ${studioTools.viewMode === mode ? 'active' : ''}`}
                onClick={() => studioTools.onViewModeChange(mode)}
                aria-pressed={studioTools.viewMode === mode}
                title={mode === 'grid' ? 'Kacheln' : 'Liste'}
                aria-label={mode === 'grid' ? 'Kacheln' : 'Liste'}
              >
                {mode === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`icon-button ${studioTools.isPanelOpen ? 'active' : ''}`}
            onClick={studioTools.onTogglePanel}
            title={studioTools.isPanelOpen ? 'Seitenleiste ausblenden' : 'Vorschau und Optionen einblenden'}
            aria-label={studioTools.isPanelOpen ? 'Seitenleiste ausblenden' : 'Vorschau und Optionen einblenden'}
            aria-pressed={studioTools.isPanelOpen}
          >
            <PanelRight size={16} />
          </button>
        </>
      ) : (
        <button type="button" className="btn-ghost btn-sm kbd-button" onClick={onOpenCommandPalette} aria-label="Befehlsmenü öffnen">
          <kbd>{shortcut('K')}</kbd>
        </button>
      )}
    </div>
  </header>
);
