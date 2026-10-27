import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiClient } from '../api/client';
import { IS_DESKTOP, listenForFileDrops, pickFiles, pickFolder } from '../utils/desktop';
import { Notify } from './useToasts';
import { useQueue } from './useQueue';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface FileIntakeOptions {
  queue: ReturnType<typeof useQueue>;
  notify: Notify;
  /** Called whenever files are added: the list lives on the "Umwandeln" page. */
  showStudio: () => void;
}

/** Every way files get into the queue: dialogs, drag & drop, browser inputs and the example files. */
export function useFileIntake({ queue, notify, showStudio }: FileIntakeOptions) {
  const [isDragging, setIsDragging] = useState(false);

  // Browser builds have no native dialogs: hidden <input type="file"> elements stand in.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addPaths = useCallback(
    (paths: string[]) => {
      showStudio();
      return queue.addPaths(paths);
    },
    [queue, showStudio]
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
      showStudio();
    },
    [queue, showStudio]
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
      showStudio();
      notify(`${added} Beispieldateien hinzugefügt`, 'success');
    } catch (e) {
      notify(`Beispieldateien konnten nicht geladen werden: ${errorText(e)}`, 'error');
    }
  }, [queue, notify, showStudio]);

  return {
    isDragging,
    fileInputRef,
    folderInputRef,
    addPaths,
    handlePickFiles,
    handlePickFolder,
    handleBrowserFiles,
    handleLoadSamples
  };
}
