import { MutableRefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { AppSettings, FileItem, ResolvedFile } from '../types';
import { IS_DESKTOP, pickMarkdownTarget } from '../utils/desktop';
import { Notify } from './useToasts';

interface QueueOptions {
  settingsRef: MutableRefObject<AppSettings>;
  notify: Notify;
  onHistoryChanged: () => void;
  /** Called with the first successful result when "show result in preview" is enabled. */
  onShowResult: (file: FileItem) => void;
}

const MAX_PARALLEL = 8;

const newId = () => crypto.randomUUID();

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
};

const fromResolved = (file: ResolvedFile): FileItem => ({
  id: newId(),
  name: file.name,
  path: file.path,
  size: file.size,
  extension: file.extension,
  status: 'ready',
  progress: 0
});

/** Browser fallback only: a File without a real path is uploaded as base64. */
const fromBrowserFile = (file: File): FileItem => ({
  id: newId(),
  name: file.name,
  path: file.name,
  size: file.size,
  extension: extensionOf(file.name),
  status: 'ready',
  progress: 0,
  fileBlob: file
});

const readAsDataUrl = (blob: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as string));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(blob);
  });

/** The conversion queue: adding files, converting them (with a parallel pool and timeout), removing them. */
export function useQueue({ settingsRef, notify, onHistoryChanged, onShowResult }: QueueOptions) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  // A ref, not state: two quick clicks/hotkeys must not both start a batch.
  const converting = useRef(false);
  const filesRef = useRef(files);
  useLayoutEffect(() => {
    filesRef.current = files;
  }, [files]);

  const patch = (id: string, changes: Partial<FileItem>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f)));

  const addResolved = useCallback((resolved: ResolvedFile[]) => {
    if (resolved.length === 0) return 0;
    // Skip files that are already waiting in the list.
    const known = new Set(filesRef.current.map((f) => f.path));
    const fresh = resolved.filter((f) => !known.has(f.path)).map(fromResolved);
    setFiles((prev) => [...prev, ...fresh]);
    return fresh.length;
  }, []);

  const addPaths = useCallback(
    async (paths: string[]) => {
      try {
        const result = await apiClient.resolvePaths(paths);
        const added = addResolved(result.files);
        if (result.files.length === 0) notify('Keine unterstützten Dateien gefunden', 'info');
        else if (result.truncated) notify(`Nur die ersten ${result.files.length} Dateien wurden übernommen`, 'info');
        else if (result.skipped > 0) notify(`${added} Dateien hinzugefügt, ${result.skipped} übersprungen`, 'info');
      } catch (e) {
        notify(`Dateien konnten nicht gelesen werden: ${e instanceof Error ? e.message : e}`, 'error');
      }
    },
    [addResolved, notify]
  );

  const addBrowserFiles = useCallback((list: File[]) => {
    setFiles((prev) => [...prev, ...list.map(fromBrowserFile)]);
  }, []);

  const convertOne = async (file: FileItem): Promise<FileItem> => {
    const settings = settingsRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), settings.timeout_seconds * 1000);
    try {
      const res = await apiClient.convertFile(
        {
          source_path: file.fileBlob ? undefined : file.path,
          file_base64: file.fileBlob ? await readAsDataUrl(file.fileBlob) : undefined,
          file_name: file.name,
          target_dir: settings.default_output_dir || undefined,
          filename_template: settings.filename_template,
          collision_strategy: settings.collision_strategy,
          keep_data_uris: settings.keep_data_uris,
          save: settings.auto_save_after_convert
        },
        controller.signal
      );
      if (res.success) {
        return {
          ...file,
          status: 'success',
          progress: 100,
          targetPath: res.target_path ?? undefined,
          saved: Boolean(res.saved),
          markdownContent: res.markdown,
          title: res.title,
          wordCount: res.word_count,
          charCount: res.char_count,
          lineCount: res.line_count,
          durationMs: res.duration_ms
        };
      }
      return {
        ...file,
        status: 'failed',
        progress: 100,
        error: res.error,
        errorDetails: res.error_details,
        solutionHint: res.solution_hint,
        durationMs: res.duration_ms
      };
    } catch (e) {
      const timedOut = controller.signal.aborted;
      return {
        ...file,
        status: 'failed',
        progress: 100,
        error: timedOut
          ? `Zeitüberschreitung nach ${settings.timeout_seconds} s`
          : `Backend nicht erreichbar${e instanceof Error ? ` (${e.message})` : ''}`,
        errorDetails: e instanceof Error ? e.stack ?? e.message : String(e),
        solutionHint: timedOut
          ? 'Erhöhe das Zeitlimit in den Einstellungen oder wandle die Datei einzeln um.'
          : 'Das Backend startet beim ersten Öffnen einige Sekunden. Warte kurz und versuche es erneut; hilft das nicht, starte die App neu.'
      };
    } finally {
      clearTimeout(timer);
    }
  };

  const convertSingle = useCallback(
    async (id: string) => {
      const file = filesRef.current.find((f) => f.id === id);
      if (!file || converting.current) return;
      patch(id, { status: 'converting', progress: 50 });
      const result = await convertOne(file);
      patch(id, result);
      onHistoryChanged();
      if (result.status === 'success') {
        notify(result.saved ? `${result.name} umgewandelt und gespeichert` : `${result.name} umgewandelt – zum Speichern prüfen`, 'success');
        if (settingsRef.current.open_preview_after_convert) onShowResult(result);
      } else {
        notify(`${result.name}: ${result.error || 'Umwandlung fehlgeschlagen'}`, 'error');
      }
    },
    // convertOne only reads refs; listing it would re-create the callback every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, onHistoryChanged, onShowResult]
  );

  const convertAll = useCallback(async () => {
    if (converting.current) return;
    const todo = filesRef.current.filter((f) => f.status === 'ready' || f.status === 'queued' || f.status === 'failed');
    if (todo.length === 0) return;

    converting.current = true;
    setIsConverting(true);
    const settings = settingsRef.current;
    const pool = Math.max(1, Math.min(MAX_PARALLEL, settings.concurrency_limit || 4));
    const succeeded: FileItem[] = [];
    let failed = 0;
    let next = 0;

    const worker = async () => {
      while (next < todo.length) {
        const file = todo[next++];
        patch(file.id, { status: 'converting', progress: 50 });
        const result = await convertOne(file);
        patch(file.id, result);
        if (result.status === 'success') succeeded.push(result);
        else failed++;
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(pool, todo.length) }, worker));
    } finally {
      converting.current = false;
      setIsConverting(false);
    }

    onHistoryChanged();
    notify(
      failed > 0 ? `${succeeded.length} umgewandelt, ${failed} mit Fehler` : `${succeeded.length} umgewandelt`,
      failed > 0 ? 'error' : 'success'
    );
    const first = succeeded[0];
    if (first && settings.open_preview_after_convert) onShowResult(first);
    if (first?.targetPath && first.saved && settings.open_output_after_convert) {
      apiClient.openFolder(first.targetPath).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify, onHistoryChanged, onShowResult]);

  /**
   * Writes a previewed result to disk. saveAs opens a "save as" dialog (desktop app);
   * otherwise the naming template and collision rule decide the file next to the original.
   * Returns the saved file, or null if cancelled/failed.
   */
  const save = useCallback(
    async (id: string, options: { saveAs?: boolean; content?: string } = {}): Promise<FileItem | null> => {
      const file = filesRef.current.find((f) => f.id === id);
      const content = options.content ?? file?.markdownContent;
      if (!file || file.status !== 'success' || content === undefined) return null;
      const settings = settingsRef.current;
      try {
        let targetPath: string | undefined;
        if (options.saveAs && IS_DESKTOP) {
          const base = file.name.replace(/\.[^.]+$/, '');
          const chosen = await pickMarkdownTarget(`${base}.md`);
          if (!chosen) return null; // dialog cancelled
          targetPath = chosen;
        }
        const res = await apiClient.saveMarkdown({
          content,
          // Browser uploads have no real source path; the backend then falls back to Downloads.
          source_path: file.fileBlob ? undefined : file.path,
          file_name: file.name,
          target_dir: settings.default_output_dir || undefined,
          target_path: targetPath,
          filename_template: settings.filename_template,
          collision_strategy: settings.collision_strategy,
          word_count: file.wordCount,
          duration_ms: file.durationMs
        });
        if (res.skipped) {
          notify(`${file.name}: Datei existiert bereits, übersprungen`, 'info');
          return null;
        }
        const saved: FileItem = { ...file, markdownContent: content, targetPath: res.target_path, saved: true };
        patch(id, saved);
        onHistoryChanged();
        return saved;
      } catch (e) {
        notify(`${file.name} konnte nicht gespeichert werden: ${e instanceof Error ? e.message : e}`, 'error');
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, onHistoryChanged]
  );

  const saveAll = useCallback(async () => {
    const unsaved = filesRef.current.filter((f) => f.status === 'success' && !f.saved);
    const results: FileItem[] = [];
    for (const file of unsaved) {
      const saved = await save(file.id);
      if (saved) results.push(saved);
    }
    if (results.length > 0) notify(`${results.length} ${results.length === 1 ? 'Datei' : 'Dateien'} gespeichert`, 'success');
    if (results[0]?.targetPath && settingsRef.current.open_output_after_convert) {
      apiClient.openFolder(results[0].targetPath).catch(() => undefined);
    }
    return results.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, notify]);

  const remove = useCallback((id: string) => setFiles((prev) => prev.filter((f) => f.id !== id)), []);
  const clear = useCallback(() => setFiles([]), []);

  /** Editor changes: keep the new content; `saved` says whether it is already on disk. */
  const updateContent = useCallback((id: string, content: string, saved: boolean) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, markdownContent: content, saved } : f)));
  }, []);

  return {
    files,
    isConverting,
    addPaths,
    addResolved,
    addBrowserFiles,
    convertSingle,
    convertAll,
    save,
    saveAll,
    remove,
    clear,
    updateContent
  };
}
