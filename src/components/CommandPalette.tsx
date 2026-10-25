import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  FilePlus, 
  FolderPlus, 
  Play, 
  Trash2, 
  History, 
  Settings, 
  Sparkles, 
  Sun, 
  Archive,
  ArrowRight,
  FolderSync,
  Info
} from 'lucide-react';
import { ActiveTab } from '../types';
import { shortcut } from '../utils/platform';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'Aktionen' | 'Navigation' | 'Darstellung';
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  onAddFilesClick: () => void;
  onAddFolderClick: () => void;
  onLoadSamples: () => void;
  onConvertAll: () => void;
  onClearQueue: () => void;
  onToggleTheme: () => void;
  onExportZip: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  onAddFilesClick,
  onAddFolderClick,
  onLoadSamples,
  onConvertAll,
  onClearQueue,
  onToggleTheme,
  onExportZip
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    {
      id: 'convert-all',
      title: 'Alle Dateien konvertieren',
      subtitle: 'Startet die Umwandlung aller ausstehenden Dokumente',
      shortcut: shortcut('Enter'),
      icon: <Play size={16} color="var(--accent-primary)" />,
      action: onConvertAll,
      category: 'Aktionen'
    },
    {
      id: 'add-files',
      title: 'Dateien auswählen & importieren',
      subtitle: 'PDF, Office, HTML, Tabellen oder Daten öffnen',
      shortcut: shortcut('O'),
      icon: <FilePlus size={16} />,
      action: onAddFilesClick,
      category: 'Aktionen'
    },
    {
      id: 'add-folder',
      title: 'Kompletten Ordner hinzufügen',
      subtitle: 'Rekursiv alle unterstützten Dateien importieren',
      shortcut: shortcut('O', { shift: true }),
      icon: <FolderPlus size={16} />,
      action: onAddFolderClick,
      category: 'Aktionen'
    },
    {
      id: 'load-samples',
      title: 'Beispieldokumente laden',
      subtitle: 'Generiert echte Testdateien (PDF, Word, Excel, PPTX, CSV)',
      icon: <Sparkles size={16} color="var(--color-warning)" />,
      action: onLoadSamples,
      category: 'Aktionen'
    },
    {
      id: 'export-zip',
      title: 'Alle Ergebnisse als ZIP exportieren',
      subtitle: 'Packt alle erzeugten Markdown-Dateien in ein Archiv',
      icon: <Archive size={16} />,
      action: onExportZip,
      category: 'Aktionen'
    },
    {
      id: 'clear-queue',
      title: 'Liste leeren',
      icon: <Trash2 size={16} color="var(--color-error)" />,
      action: onClearQueue,
      category: 'Aktionen'
    },
    {
      id: 'nav-studio',
      title: 'Gehe zu: Umwandeln',
      icon: <ArrowRight size={16} />,
      action: () => setActiveTab('studio'),
      category: 'Navigation'
    },
    {
      id: 'nav-history',
      title: 'Gehe zu: Verlauf',
      icon: <History size={16} />,
      action: () => setActiveTab('history'),
      category: 'Navigation'
    },
    {
      id: 'nav-watcher',
      title: 'Gehe zu: Ordner-Überwachung',
      icon: <FolderSync size={16} />,
      action: () => setActiveTab('watcher'),
      category: 'Navigation'
    },
    {
      id: 'nav-settings',
      title: 'Gehe zu: Einstellungen',
      icon: <Settings size={16} />,
      action: () => setActiveTab('settings'),
      category: 'Navigation'
    },
    {
      id: 'nav-about',
      title: 'Gehe zu: Über MarkItDown',
      subtitle: 'Version, Tech-Stack und GitHub',
      icon: <Info size={16} />,
      action: () => setActiveTab('about'),
      category: 'Navigation'
    },
    {
      id: 'toggle-theme',
      title: 'Farbschema umschalten',
      subtitle: 'Wechselt zwischen Dunkel- und Hell-Modus',
      icon: <Sun size={16} />,
      action: onToggleTheme,
      category: 'Darstellung'
    }
  ];

  const filtered = commands.filter(c => 
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    (c.subtitle && c.subtitle.toLowerCase().includes(query.toLowerCase())) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  // The palette is mounted fresh each time it opens, so state starts empty.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="markdown-modal-backdrop" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '80px' }}>
      <div 
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '10px',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <Search size={18} color="var(--text-muted)" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Befehl eingeben oder suchen... (z. B. 'Batch', 'PDF', 'Theme')"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              padding: 0,
              boxShadow: 'none'
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)', padding: '2px 6px', borderRadius: '4px' }}>
            ESC
          </span>
        </div>

        {/* Command List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '6px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Keine passenden Befehle gefunden.
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => { cmd.action(); onClose(); }}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  backgroundColor: selectedIndex === idx ? 'var(--bg-surface-active)' : 'transparent',
                  color: selectedIndex === idx ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {cmd.icon}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '13px', fontWeight: selectedIndex === idx ? 600 : 500, color: 'var(--text-primary)' }}>
                      {cmd.title}
                    </span>
                    {cmd.subtitle && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {cmd.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {cmd.category}
                  </span>
                  {cmd.shortcut && (
                    <span 
                      style={{ 
                        fontSize: '11px', 
                        fontFamily: 'var(--font-mono)',
                        padding: '2px 5px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-code)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {cmd.shortcut}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div 
          style={{
            padding: '8px 14px',
            backgroundColor: 'var(--bg-sidebar)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          <span><b>↑↓</b> Navigieren • <b>↵</b> Ausführen</span>
          <span>Befehlsmenü ({shortcut('K')})</span>
        </div>
      </div>
    </div>
  );
};
