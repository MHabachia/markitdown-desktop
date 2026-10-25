import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { ActiveTab, FileItem } from './types';
import { apiClient } from './api/client';
import { useToasts } from './hooks/useToasts';
import { useSettings } from './hooks/useSettings';
import { useSystemInfo } from './hooks/useSystemInfo';
import { useHistory } from './hooks/useHistory';
import { useQueue } from './hooks/useQueue';
import { useHotkeys } from './hooks/useHotkeys';
import { useUpdater } from './hooks/useUpdater';
import {
  IS_DESKTOP,
  confirmAction,
  guardWindowClose,
  listenForFileDrops,
  pickFiles,
  pickFolder,
  pickZipTarget,
  backendLogFolder
} from './utils/desktop';

import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { DropZone } from './components/DropZone';
import { FileQueue, ViewMode } from './components/FileQueue';
import { PanelTab, StudioPanel } from './components/StudioPanel';
import { HistoryView } from './components/HistoryView';
import { WatcherView } from './components/WatcherView';
import { SettingsView } from './components/SettingsView';
import { AboutView } from './components/AboutView';
import { MarkdownViewer } from './components/MarkdownViewer';
import { ErrorModal } from './components/ErrorModal';
import { ToastContainer } from './components/Toast';
import { CommandPalette } from './components/CommandPalette';

import './styles/global.css';
import './styles/layout.css';
import './styles/views.css';

const PAGE_TITLES: Record<ActiveTab, string> = {
  studio: 'Umwandeln',
  history: 'Verlauf',
  watcher: 'Ordner-Überwachung',
  settings: 'Einstellungen',
  about: 'Über MarkItDown'
};

const VIEW_MODE_KEY = 'markitdown.viewMode';

/** Remembered per device; storage can be unavailable, so every access is guarded. */
const loadViewMode = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const App: React.FC = () => {
  const { toasts, notify, dismiss } = useToasts();
  const { settings, settingsRef, updateSettings } = useSettings();
  const { update, checkForUpdate, installUpdate } = useUpdater(settings.check_updates);
  const { diagnostics, capabilities, unreachable: engineUnreachable, refresh: refreshSystemInfo } = useSystemInfo();
  const { history, reloadHistory, clearHistory, removeHistoryItem } = useHistory(notify);

  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>('options');
  const [fileFilter, setFileFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [isDragging, setIsDragging] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editorFile, setEditorFile] = useState<FileItem | null>(null);
  const [errorFile, setErrorFile] = useState<FileItem | null>(null);

  const showInPanel = useCallback((file: FileItem) => {
    setSelectedFileId(file.id);
    setPanelTab('preview');
    setIsPanelOpen(true);
  }, []);

  const queue = useQueue({ settingsRef, notify, onHistoryChanged: reloadHistory, onShowResult: showInPanel });

  // ---------- engine not coming up ----------
  useEffect(() => {
    if (!engineUnreachable) return;
    let cancelled = false;
    backendLogFolder().then((folder) => {
      if (cancelled) return;
      const where = folder ? ` Das Protokoll liegt in: ${folder}` : '';
      notify(`Die Umwandlungs-Engine antwortet nicht. Starte die App neu.${where}`, 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [engineUnreachable, notify]);

  // ---------- theme ----------
  useEffect(() => {
    // "system" follows the OS setting and updates live when it changes.
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = settings.theme === 'system' ? (media.matches ? 'light' : 'dark') : settings.theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    if (settings.theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme]);

  // ---------- adding files ----------
  // Browser builds have no native dialogs: hidden <input type="file"> elements stand in.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addPaths = useCallback(
    (paths: string[]) => {
      setActiveTab('studio');
      return queue.addPaths(paths);
    },
    [queue]
  );

  const handlePickFiles = useCallback(async () => {
    if (!IS_DESKTOP) return fileInputRef.current?.click();
    try {
      const paths = await pickFiles();
      if (paths) await addPaths(paths);
    } catch (e) {
      notify(`Dateiauswahl fehlgeschlagen: ${errorText(e)}`, 'error');
    }
  }, [addPaths, notify]);

  const handlePickFolder = useCallback(async () => {
    if (!IS_DESKTOP) return folderInputRef.current?.click();
    try {
      const folder = await pickFolder();
      if (folder) await addPaths([folder]);
    } catch (e) {
      notify(`Ordnerauswahl fehlgeschlagen: ${errorText(e)}`, 'error');
    }
  }, [addPaths, notify]);

  const handleBrowserFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list || list.length === 0) return;
      queue.addBrowserFiles(Array.from(list));
      setActiveTab('studio');
    },
    [queue]
  );

  // Native drag & drop delivers real paths, so results can be saved next to the originals.
  const addPathsRef = useRef(addPaths);
  useLayoutEffect(() => {
    addPathsRef.current = addPaths;
  });
  useEffect(() => {
    if (!IS_DESKTOP) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    listenForFileDrops({
      onHover: setIsDragging,
      onDrop: (paths) => void addPathsRef.current(paths)
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  const handleLoadSamples = useCallback(async () => {
    try {
      const res = await apiClient.generateSamples();
      const added = queue.addResolved(res.files ?? []);
      setActiveTab('studio');
      notify(`${added} Beispieldateien hinzugefügt`, 'success');
    } catch (e) {
      notify(`Beispieldateien konnten nicht geladen werden: ${errorText(e)}`, 'error');
    }
  }, [queue, notify]);

  // ---------- queue actions ----------
  const handleRemove = (id: string) => {
    queue.remove(id);
    setSelectedFileId((prev) => (prev === id ? null : prev));
  };

  const unsavedCount = queue.files.filter((f) => f.status === 'success' && !f.saved).length;

  const handleClear = async () => {
    if (
      unsavedCount > 0 &&
      !(await confirmAction(
        `${unsavedCount} umgewandelte ${unsavedCount === 1 ? 'Datei ist' : 'Dateien sind'} noch nicht gespeichert. Trotzdem leeren?`,
        'Leeren'
      ))
    ) {
      return;
    }
    queue.clear();
    setFileFilter('');
    setSelectedFileId(null);
    setPanelTab('options');
  };

  const handleExportZip = async () => {
    // Uses the current (possibly edited) content, saved or not.
    const items = queue.files
      .filter((f) => f.status === 'success' && f.markdownContent !== undefined)
      .map((f) => ({ name: f.name, content: f.markdownContent! }));
    if (items.length === 0) {
      notify('Noch keine umgewandelten Dateien zum Exportieren', 'info');
      return;
    }
    const defaultName = `markitdown_export_${new Date().toISOString().slice(0, 10)}.zip`;
    try {
      const targetPath = IS_DESKTOP ? await pickZipTarget(defaultName) : undefined;
      if (IS_DESKTOP && !targetPath) return; // dialog cancelled
      const res = await apiClient.exportZip(items, { zipName: defaultName, targetPath: targetPath ?? undefined });
      notify(`${res.file_count} Dateien als ZIP gespeichert`, 'success');
      apiClient.openFolder(res.zip_path).catch(() => undefined);
    } catch (e) {
      notify(`ZIP-Export fehlgeschlagen: ${errorText(e)}`, 'error');
    }
  };

  const handleOpenFolder = (path: string) => {
    apiClient.openFolder(path).catch((e) => notify(`Ordner konnte nicht geöffnet werden: ${errorText(e)}`, 'error'));
  };

  const handleOpenFile = (path: string) => {
    apiClient.openFile(path).catch((e) => notify(`Datei konnte nicht geöffnet werden: ${errorText(e)}`, 'error'));
  };

  /** Editor "save": overwrite the file if it is already on disk, otherwise save it for the first time. */
  const handleEditorSave = async (file: FileItem, content: string) => {
    const current = queue.files.find((f) => f.id === file.id) ?? file;
    if (current.saved && current.targetPath) {
      await apiClient.saveFile(current.targetPath, content);
      queue.updateContent(file.id, content, true);
      return;
    }
    queue.updateContent(file.id, content, false);
    const saved = await queue.save(file.id, { content });
    if (!saved) throw new Error('nicht gespeichert');
  };

  const handleSave = async (file: FileItem, saveAs = false) => {
    const saved = await queue.save(file.id, { saveAs });
    if (saved) notify(`Gespeichert: ${saved.targetPath?.split(/[\\/]/).pop()}`, 'success');
  };

  // Ask before closing the window while converted results are not saved yet.
  const unsavedRef = useRef(unsavedCount);
  useLayoutEffect(() => {
    unsavedRef.current = unsavedCount;
  });
  useEffect(() => {
    if (!IS_DESKTOP) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;
    guardWindowClose(
      () => unsavedRef.current > 0,
      'Es gibt umgewandelte Dateien, die noch nicht gespeichert sind. App trotzdem schließen?'
    ).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useHotkeys({
    onCommandPalette: () => setIsCommandPaletteOpen((open) => !open),
    onConvertAll: () => void queue.convertAll(),
    onAddFiles: () => void handlePickFiles(),
    onAddFolder: () => void handlePickFolder()
  });

  const isStudioWithFiles = activeTab === 'studio' && queue.files.length > 0;

  return (
    <div className="app-container">
      {!IS_DESKTOP && (
        <>
          <input
            type="file"
            ref={fileInputRef}
            multiple
            hidden
            onChange={(e) => {
              handleBrowserFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            type="file"
            ref={folderInputRef}
            // @ts-expect-error webkitdirectory is supported by Chromium and WebKit
            webkitdirectory="true"
            multiple
            hidden
            onChange={(e) => {
              handleBrowserFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      )}

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        fileCount={queue.files.length}
        diagnostics={diagnostics}
        engineUnreachable={engineUnreachable}
        onRetryConnection={refreshSystemInfo}
        update={update}
        onInstallUpdate={installUpdate}
      />

      <main className="main-workspace">
        <TopBar
          title={PAGE_TITLES[activeTab]}
          subtitle={activeTab === 'history' && history.length > 0 ? `${history.length} Einträge` : undefined}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          studioTools={
            isStudioWithFiles
              ? {
                  filter: fileFilter,
                  onFilterChange: setFileFilter,
                  viewMode,
                  onViewModeChange: (mode) => {
                    setViewMode(mode);
                    try {
                      localStorage.setItem(VIEW_MODE_KEY, mode);
                    } catch {
                      /* not persisted, still works for this session */
                    }
                  },
                  isPanelOpen,
                  onTogglePanel: () => setIsPanelOpen((open) => !open)
                }
              : undefined
          }
        />

        <section
          className={`workspace-content ${isDragging && isStudioWithFiles ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            if (isStudioWithFiles && !IS_DESKTOP) e.preventDefault();
          }}
          onDrop={(e) => {
            if (!isStudioWithFiles || IS_DESKTOP) return;
            e.preventDefault();
            handleBrowserFiles(e.dataTransfer.files);
          }}
        >
          {activeTab === 'studio' &&
            (queue.files.length === 0 ? (
              <DropZone
                capabilities={capabilities}
                isDragging={isDragging}
                onPickFiles={handlePickFiles}
                onPickFolder={handlePickFolder}
                onLoadSamples={handleLoadSamples}
                onBrowserDrop={handleBrowserFiles}
              />
            ) : (
              <FileQueue
                files={queue.files}
                filter={fileFilter}
                viewMode={viewMode}
                selectedId={selectedFileId}
                isConverting={queue.isConverting}
                onSelect={showInPanel}
                onConvertAll={queue.convertAll}
                onConvertSingle={queue.convertSingle}
                onSave={(f) => void handleSave(f)}
                onSaveAll={() => void queue.saveAll()}
                onRemoveFile={handleRemove}
                onClearAll={handleClear}
                onOpenFolder={handleOpenFolder}
                onShowErrorDetails={setErrorFile}
                onAddFilesClick={handlePickFiles}
                onAddFolderClick={handlePickFolder}
                onLoadSamples={handleLoadSamples}
                onExportZip={handleExportZip}
              />
            ))}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onClearHistory={clearHistory}
              onDeleteItem={removeHistoryItem}
              onOpenFolder={handleOpenFolder}
              onOpenFile={handleOpenFile}
              onReconvert={(sourcePath) => void addPaths([sourcePath])}
            />
          )}

          {activeTab === 'watcher' && <WatcherView settings={settings} onUpdateSettings={updateSettings} onNotify={notify} />}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={updateSettings}
              diagnostics={diagnostics}
              onRefreshDiagnostics={refreshSystemInfo}
              onClearHistory={clearHistory}
              onNotify={notify}
            />
          )}

          {activeTab === 'about' && (
            <AboutView
              diagnostics={diagnostics}
              capabilities={capabilities}
              update={update}
              onCheckUpdate={checkForUpdate}
              onInstallUpdate={installUpdate}
              onNotify={notify}
            />
          )}
        </section>
      </main>

      {isStudioWithFiles && isPanelOpen && (
        <StudioPanel
          tab={panelTab}
          onTabChange={setPanelTab}
          onClose={() => setIsPanelOpen(false)}
          file={queue.files.find((f) => f.id === selectedFileId) ?? null}
          settings={settings}
          onUpdateSettings={updateSettings}
          onOpenEditor={setEditorFile}
          onSave={(f, saveAs) => void handleSave(f, saveAs)}
          onOpenFolder={handleOpenFolder}
          onShowErrorDetails={setErrorFile}
          onNotify={notify}
        />
      )}

      {isCommandPaletteOpen && (
      <CommandPalette
        isOpen
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        onAddFilesClick={handlePickFiles}
        onAddFolderClick={handlePickFolder}
        onLoadSamples={handleLoadSamples}
        onConvertAll={queue.convertAll}
        onClearQueue={handleClear}
        onToggleTheme={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
        onExportZip={handleExportZip}
      />
      )}

      {editorFile && (
        <MarkdownViewer
          key={editorFile.id}
          file={editorFile}
          onClose={() => setEditorFile(null)}
          onSave={(content) => handleEditorSave(editorFile, content)}
          onOpenFile={handleOpenFile}
          onOpenFolder={handleOpenFolder}
          onNotify={notify}
        />
      )}

      {errorFile && <ErrorModal file={errorFile} onClose={() => setErrorFile(null)} />}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};
