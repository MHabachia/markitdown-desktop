import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ActiveTab, FileItem } from './types';
import { apiClient } from './api/client';
import { AppContext, AppContextValue } from './context/AppContext';
import { useToasts } from './hooks/useToasts';
import { useSettings } from './hooks/useSettings';
import { useSystemInfo } from './hooks/useSystemInfo';
import { useHistory } from './hooks/useHistory';
import { useQueue } from './hooks/useQueue';
import { useHotkeys } from './hooks/useHotkeys';
import { useUpdater } from './hooks/useUpdater';
import { useTheme } from './hooks/useTheme';
import { useCloseGuard } from './hooks/useCloseGuard';
import { useFileIntake } from './hooks/useFileIntake';
import { useResultActions } from './hooks/useResultActions';
import { IS_DESKTOP, confirmAction, backendLogFolder } from './utils/desktop';

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
import './styles/views/index.css';

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
  const { settings, settingsRef, updateSettings } = useSettings(notify);
  const { update, checkForUpdate, installUpdate } = useUpdater(settings.check_updates);
  const { diagnostics, capabilities, unreachable: engineUnreachable, refresh: refreshSystemInfo } = useSystemInfo();
  const { history, reloadHistory, clearHistory, removeHistoryItem } = useHistory(notify);

  const [activeTab, setActiveTab] = useState<ActiveTab>('studio');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>('options');
  const [fileFilter, setFileFilter] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [editorFile, setEditorFile] = useState<FileItem | null>(null);
  const [errorFile, setErrorFile] = useState<FileItem | null>(null);

  const showInPanel = useCallback((file: FileItem) => {
    setSelectedFileId(file.id);
    setPanelTab('preview');
    setIsPanelOpen(true);
  }, []);

  const queue = useQueue({ settingsRef, notify, onHistoryChanged: reloadHistory, onShowResult: showInPanel });

  const openFolder = useCallback(
    (path: string) => {
      apiClient.openFolder(path).catch((e) => notify(`Ordner konnte nicht geöffnet werden: ${errorText(e)}`, 'error'));
    },
    [notify]
  );
  const openFile = useCallback(
    (path: string) => {
      apiClient.openFile(path).catch((e) => notify(`Datei konnte nicht geöffnet werden: ${errorText(e)}`, 'error'));
    },
    [notify]
  );
  const appContext = useMemo<AppContextValue>(
    () => ({ settings, updateSettings, notify, openFolder, openFile }),
    [settings, updateSettings, notify, openFolder, openFile]
  );

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

  useTheme(settings.theme);

  const showStudio = useCallback(() => setActiveTab('studio'), []);
  const intake = useFileIntake({ queue, notify, showStudio });
  const { fileInputRef, folderInputRef } = intake;
  const results = useResultActions(queue, notify);

  // ---------- queue actions ----------
  const handleRemove = (id: string) => {
    queue.remove(id);
    setSelectedFileId((prev) => (prev === id ? null : prev));
  };

  const unsavedCount = queue.files.filter((f) => f.status === 'success' && !f.saved).length;
  useCloseGuard(unsavedCount);

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

  useHotkeys({
    onCommandPalette: () => setIsCommandPaletteOpen((open) => !open),
    onConvertAll: () => void queue.convertAll(),
    onAddFiles: () => void intake.handlePickFiles(),
    onAddFolder: () => void intake.handlePickFolder()
  });

  const isStudioWithFiles = activeTab === 'studio' && queue.files.length > 0;

  return (
    <AppContext.Provider value={appContext}>
      <div className="app-container">
        {!IS_DESKTOP && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              multiple
              hidden
              onChange={(e) => {
                intake.handleBrowserFiles(e.target.files);
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
                intake.handleBrowserFiles(e.target.files);
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
            className={`workspace-content ${intake.isDragging && isStudioWithFiles ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              if (isStudioWithFiles && !IS_DESKTOP) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!isStudioWithFiles || IS_DESKTOP) return;
              e.preventDefault();
              intake.handleBrowserFiles(e.dataTransfer.files);
            }}
          >
            {activeTab === 'studio' &&
              (queue.files.length === 0 ? (
                <DropZone
                  capabilities={capabilities}
                  isDragging={intake.isDragging}
                  onPickFiles={intake.handlePickFiles}
                  onPickFolder={intake.handlePickFolder}
                  onLoadSamples={intake.handleLoadSamples}
                  onBrowserDrop={intake.handleBrowserFiles}
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
                  onSave={(f) => void results.save(f)}
                  onSaveAll={() => void queue.saveAll()}
                  onRemoveFile={handleRemove}
                  onClearAll={handleClear}
                  onShowErrorDetails={setErrorFile}
                  onAddFilesClick={intake.handlePickFiles}
                  onAddFolderClick={intake.handlePickFolder}
                  onLoadSamples={intake.handleLoadSamples}
                  onExportZip={results.exportZip}
                />
              ))}

            {activeTab === 'history' && (
              <HistoryView
                history={history}
                onClearHistory={clearHistory}
                onDeleteItem={removeHistoryItem}
                onReconvert={(sourcePath) => void intake.addPaths([sourcePath])}
              />
            )}

            {activeTab === 'watcher' && <WatcherView />}

            {activeTab === 'settings' && (
              <SettingsView
                diagnostics={diagnostics}
                onRefreshDiagnostics={refreshSystemInfo}
                onClearHistory={clearHistory}
              />
            )}

            {activeTab === 'about' && (
              <AboutView
                diagnostics={diagnostics}
                capabilities={capabilities}
                update={update}
                onCheckUpdate={checkForUpdate}
                onInstallUpdate={installUpdate}
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
            onOpenEditor={setEditorFile}
            onSave={(f, saveAs) => void results.save(f, saveAs)}
            onShowErrorDetails={setErrorFile}
          />
        )}

        {isCommandPaletteOpen && (
          <CommandPalette
            isOpen
            onClose={() => setIsCommandPaletteOpen(false)}
            setActiveTab={setActiveTab}
            onAddFilesClick={intake.handlePickFiles}
            onAddFolderClick={intake.handlePickFolder}
            onLoadSamples={intake.handleLoadSamples}
            onConvertAll={queue.convertAll}
            onClearQueue={handleClear}
            onToggleTheme={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}
            onExportZip={results.exportZip}
          />
        )}

        {editorFile && (
          <MarkdownViewer
            key={editorFile.id}
            file={editorFile}
            onClose={() => setEditorFile(null)}
            onSave={(content) => results.saveFromEditor(editorFile, content)}
          />
        )}

        {errorFile && <ErrorModal file={errorFile} onClose={() => setErrorFile(null)} />}

        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </div>
    </AppContext.Provider>
  );
};
