import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Save, 
  ExternalLink, 
  FolderOpen, 
  Columns, 
  FileText, 
  Code, 
  Search, 
  Download,
  Share2,
  FileCode,
  Printer,
  Table,
  Sparkles,
  ListOrdered
} from 'lucide-react';
import { escapeHtml } from '../utils/format';
import { shortcut } from '../utils/platform';
import { blockLinkNavigation, renderMarkdown } from '../utils/markdown';
import { FileItem } from '../types';
import { apiClient } from '../api/client';

interface MarkdownViewerProps {
  file: FileItem;
  onClose: () => void;
  /** Saves the edited content (overwrites the saved file, or saves it for the first time). */
  onSave: (content: string) => Promise<void>;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onNotify: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  file,
  onClose,
  onSave,
  onOpenFile,
  onOpenFolder,
  onNotify
}) => {
  const [content, setContent] = useState<string>(file.markdownContent || '');
  const [initialContent, setInitialContent] = useState<string>(file.markdownContent || '');
  const [viewMode, setViewMode] = useState<'preview' | 'editor' | 'split'>('preview');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const hasUnsavedChanges = content !== initialContent;

  // Stats calculation
  const stats = useMemo(() => {
    const chars = content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    const lines = content.split('\n').length;
    const readTimeMinutes = Math.max(1, Math.ceil(words / 200));
    return { chars, words, lines, readTimeMinutes };
  }, [content]);

  const renderedHtml = useMemo(() => renderMarkdown(content), [content]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      setInitialContent(content);
      onNotify('Datei erfolgreich gespeichert!', 'success');
    } catch (e) {
      onNotify(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : e}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, onNotify]);

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (hasUnsavedChanges) {
          handleSave();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      } else if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, showSearch, handleSave, onClose]);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setIsCopied(true);
      onNotify('Markdown-Inhalt in Zwischenablage kopiert!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      onNotify('Kopieren fehlgeschlagen', 'error');
    }
  };

  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(renderedHtml);
      onNotify('Gerendertes HTML in Zwischenablage kopiert!', 'success');
      setShowExportMenu(false);
    } catch {
      onNotify('HTML-Kopieren fehlgeschlagen', 'error');
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('.md Datei heruntergeladen', 'success');
    setShowExportMenu(false);
  };

  const handleDownloadHtml = () => {
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(file.name)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #111; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; }
    th { background: #f4f4f4; }
    pre { background: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
    code { font-family: ui-monospace, Menlo, Consolas, monospace; }
  </style>
</head>
<body>
${renderedHtml}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('HTML Dokument heruntergeladen', 'success');
    setShowExportMenu(false);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, '')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('.txt Datei heruntergeladen', 'success');
    setShowExportMenu(false);
  };

  const handlePrintPdf = () => {
    setShowExportMenu(false);
    window.print();
  };

  const handleFormatTables = async () => {
    try {
      const formatted = await apiClient.formatTables(content);
      setContent(formatted);
      onNotify('Markdown-Tabellen sauber ausgerichtet', 'success');
    } catch {
      onNotify('Tabellenformatierung fehlgeschlagen', 'error');
    }
  };

  const handleCleanWhitespace = async () => {
    try {
      const cleaned = await apiClient.cleanWhitespace(content);
      setContent(cleaned);
      onNotify('Leerzeilen & Whitespace bereinigt', 'success');
    } catch {
      onNotify('Bereinigung fehlgeschlagen', 'error');
    }
  };

  const handleInsertToc = async () => {
    try {
      const withToc = await apiClient.generateToc(content);
      setContent(withToc);
      onNotify('Inhaltsverzeichnis eingefügt', 'success');
    } catch {
      onNotify('TOC-Generierung fehlgeschlagen', 'error');
    }
  };


  return (
    <div className="markdown-modal-backdrop" onClick={onClose}>
      <div className="markdown-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="editor-header">
          <div className="editor-title-group">
            <span className="editor-title">
              {file.name}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              &rarr; {file.saved && file.targetPath ? file.targetPath.split(/[\\/]/).pop() : 'nicht gespeichert'}
            </span>
            {hasUnsavedChanges && (
              <span 
                className="unsaved-dot" 
                title={`Ungespeicherte Änderungen (${shortcut('S')} zum Speichern)`}
              />
            )}
          </div>

          <div className="editor-tools">
            {/* View Mode Switcher */}
            <div className="view-mode-tabs">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
                onClick={() => setViewMode('preview')}
                title="Gerenderte Vorschau"
              >
                <FileText size={13} style={{ display: 'inline', marginRight: 4 }} />
                Vorschau
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'editor' ? 'active' : ''}`}
                onClick={() => setViewMode('editor')}
                title="Markdown-Quelltext bearbeiten"
              >
                <Code size={13} style={{ display: 'inline', marginRight: 4 }} />
                Quelltext
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
                onClick={() => setViewMode('split')}
                title="Geteilte Ansicht (Split-View)"
              >
                <Columns size={13} style={{ display: 'inline', marginRight: 4 }} />
                Geteilt
              </button>
            </div>

            {/* Quick Formatting Tools in Editor / Split Mode */}
            {viewMode !== 'preview' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '8px' }}>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleFormatTables}
                  title="Markdown-Tabellen sauber ausrichten"
                >
                  <Table size={13} style={{ marginRight: 4 }} />
                  Tabellen
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleCleanWhitespace}
                  title="Überflüssige Leerzeilen & Whitespace bereinigen"
                >
                  <Sparkles size={13} style={{ marginRight: 4 }} />
                  Bereinigen
                </button>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={handleInsertToc}
                  title="Inhaltsverzeichnis (TOC) am Anfang generieren"
                >
                  <ListOrdered size={13} style={{ marginRight: 4 }} />
                  +TOC
                </button>
              </div>
            )}

            {/* Search Toggle */}
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setShowSearch(!showSearch)}
              title={`Im Dokument suchen (${shortcut('F')})`}
            >
              <Search size={14} />
            </button>

            {/* Copy Button */}
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleCopyMarkdown}
              title="Markdown in Zwischenablage kopieren"
            >
              {isCopied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
              {isCopied ? 'Kopiert' : 'Kopieren'}
            </button>

            {/* Export Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowExportMenu(!showExportMenu)}
                title="Export-Optionen"
              >
                <Share2 size={13} />
                Export
              </button>

              {showExportMenu && (
                <div 
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '100%',
                    marginTop: '4px',
                    width: '230px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '6px',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                >
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={handleDownloadMarkdown}
                  >
                    <Download size={13} /> Als .md herunterladen
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={handleDownloadHtml}
                  >
                    <FileCode size={13} /> Als HTML herunterladen
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={handleDownloadTxt}
                  >
                    <FileText size={13} /> Als .txt herunterladen
                  </button>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={handlePrintPdf}
                  >
                    <Printer size={13} /> Als PDF drucken / speichern
                  </button>
                  <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', width: '100%' }}
                    onClick={handleCopyHtml}
                  >
                    <Copy size={13} /> HTML in Zwischenablage
                  </button>
                </div>
              )}
            </div>

            {/* Save Button */}
            {hasUnsavedChanges && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={handleSave}
                disabled={isSaving}
                title={`Änderungen speichern (${shortcut('S')})`}
              >
                <Save size={13} />
                {isSaving ? 'Speichert …' : `Speichern (${shortcut('S')})`}
              </button>
            )}

            {/* Native OS open */}
            {file.targetPath && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => onOpenFile(file.targetPath!)}
                title="Im Standardprogramm öffnen"
              >
                <ExternalLink size={14} />
              </button>
            )}

            {file.targetPath && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => onOpenFolder(file.targetPath!)}
                title="Im Dateimanager anzeigen"
              >
                <FolderOpen size={14} />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={onClose}
              title="Schließen (ESC)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search Bar Overlay */}
        {showSearch && (
          <div 
            style={{ 
              padding: '8px 16px', 
              background: 'var(--bg-surface)', 
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Suchbegriff eingeben... (ESC zum Schließen)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '4px 8px' }}
              autoFocus
            />
            {searchQuery && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                { (content.match(new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length } Treffer
              </span>
            )}
            <button 
              type="button" 
              className="btn-ghost btn-sm"
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Modal Editor / Preview Body */}
        <div className="editor-body">
          {(viewMode === 'editor' || viewMode === 'split') && (
            <div className="editor-pane raw-source">
              <textarea
                className="code-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Markdown Inhalt..."
                spellCheck={false}
              />
            </div>
          )}

          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="editor-pane rendered">
              <div
                className="rendered-markdown"
                onClick={blockLinkNavigation}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          )}
        </div>

        {/* Footer Stats Bar */}
        <div className="editor-footer">
          <div className="editor-stats-bar">
            <span>{stats.words.toLocaleString()} Wörter</span>
            <span>•</span>
            <span>{stats.chars.toLocaleString()} Zeichen</span>
            <span>•</span>
            <span>{stats.lines} Zeilen</span>
            <span>•</span>
            <span>ca. {stats.readTimeMinutes} Min. Lesezeit</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>{`${shortcut('S')} Speichern · ${shortcut('F')} Suchen`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
