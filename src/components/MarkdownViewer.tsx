import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, Copy, ExternalLink, FolderOpen, Save, Search, X } from 'lucide-react';
import { shortcut } from '../utils/platform';
import { blockLinkNavigation, renderMarkdown } from '../utils/markdown';
import { countMatches, documentStats } from '../utils/editor';
import { FileItem } from '../types';
import { useApp } from '../context/AppContext';
import { useContentTools } from '../hooks/useContentTools';
import { useEditorExport } from '../hooks/useEditorExport';
import { EditorFooter } from './editor/EditorFooter';
import { ExportMenu } from './editor/ExportMenu';
import { FormatTools } from './editor/FormatTools';
import { SearchBar } from './editor/SearchBar';
import { EditorViewMode, ViewModeTabs } from './editor/ViewModeTabs';

interface MarkdownViewerProps {
  file: FileItem;
  onClose: () => void;
  /** Saves the edited content (overwrites the saved file, or saves it for the first time). */
  onSave: (content: string) => Promise<void>;
}

/** Full-screen editor with preview for one converted file. */
export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ file, onClose, onSave }) => {
  const { notify, openFile, openFolder } = useApp();
  const [content, setContent] = useState<string>(file.markdownContent || '');
  const [initialContent, setInitialContent] = useState<string>(file.markdownContent || '');
  const [viewMode, setViewMode] = useState<EditorViewMode>('preview');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const hasUnsavedChanges = content !== initialContent;
  const stats = useMemo(() => documentStats(content), [content]);
  const renderedHtml = useMemo(() => renderMarkdown(content), [content]);
  const exporter = useEditorExport({ fileName: file.name, content, renderedHtml, notify });
  const tools = useContentTools(content, setContent, notify);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(content);
      setInitialContent(content);
      notify('Datei erfolgreich gespeichert!', 'success');
    } catch (e) {
      notify(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : e}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [content, onSave, notify]);

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
      notify('Markdown-Inhalt in Zwischenablage kopiert!', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      notify('Kopieren fehlgeschlagen', 'error');
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
            <ViewModeTabs value={viewMode} onChange={setViewMode} />

            {viewMode !== 'preview' && (
              <FormatTools
                onFormatTables={tools.formatTables}
                onCleanWhitespace={tools.cleanWhitespace}
                onInsertToc={tools.insertToc}
              />
            )}

            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => setShowSearch(!showSearch)}
              title={`Im Dokument suchen (${shortcut('F')})`}
            >
              <Search size={14} />
            </button>

            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={handleCopyMarkdown}
              title="Markdown in Zwischenablage kopieren"
            >
              {isCopied ? <Check size={13} color="var(--color-success)" /> : <Copy size={13} />}
              {isCopied ? 'Kopiert' : 'Kopieren'}
            </button>

            <ExportMenu
              onSaveMarkdown={exporter.saveMarkdown}
              onSaveHtml={exporter.saveHtml}
              onSaveText={exporter.saveText}
              onPrint={exporter.print}
              onCopyHtml={exporter.copyHtml}
            />

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

            {file.targetPath && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => openFile(file.targetPath!)}
                title="Im Standardprogramm öffnen"
              >
                <ExternalLink size={14} />
              </button>
            )}

            {file.targetPath && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => openFolder(file.targetPath!)}
                title="Im Dateimanager anzeigen"
              >
                <FolderOpen size={14} />
              </button>
            )}

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

        {showSearch && (
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            matches={countMatches(content, searchQuery)}
            onClose={() => {
              setShowSearch(false);
              setSearchQuery('');
            }}
          />
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

        <EditorFooter stats={stats} />
      </div>
    </div>
  );
};
