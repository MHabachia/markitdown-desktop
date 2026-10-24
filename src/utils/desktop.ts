/**
 * Desktop-only capabilities (native dialogs, drag & drop with real paths). Every function
 * degrades gracefully in a plain browser (dev server), where the callers fall back to
 * <input type="file"> and HTML5 drag & drop.
 */
export const IS_DESKTOP = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Native file picker. Returns absolute paths, or null if cancelled. */
export async function pickFiles(): Promise<string[] | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({ multiple: true, directory: false, title: 'Dateien wählen' });
  if (!result) return null;
  return Array.isArray(result) ? result : [result];
}

/** Native folder picker. Returns the absolute path, or null if cancelled. */
export async function pickFolder(): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const result = await open({ multiple: false, directory: true, title: 'Ordner wählen' });
  return typeof result === 'string' ? result : null;
}

/** "Save as" dialog for an editor export (Markdown, HTML or plain text). */
export async function pickExportTarget(defaultName: string, extension: 'md' | 'html' | 'txt'): Promise<string | null> {
  const labels = { md: 'Markdown', html: 'HTML', txt: 'Text' };
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ defaultPath: defaultName, filters: [{ name: labels[extension], extensions: [extension] }], title: 'Exportieren' });
}

/** "Save as" dialog for one Markdown file. */
export async function pickMarkdownTarget(defaultName: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ defaultPath: defaultName, filters: [{ name: 'Markdown', extensions: ['md'] }], title: 'Markdown speichern' });
}

/** Yes/no question; native dialog in the app, window.confirm in the browser. */
export async function confirmAction(message: string, okLabel: string): Promise<boolean> {
  if (!IS_DESKTOP) return window.confirm(message);
  const { ask } = await import('@tauri-apps/plugin-dialog');
  return ask(message, { title: 'MarkItDown', kind: 'warning', okLabel, cancelLabel: 'Abbrechen' });
}

/** Asks before the window closes while `shouldAsk()` is true. Returns an unsubscribe function. */
export async function guardWindowClose(shouldAsk: () => boolean, message: string): Promise<() => void> {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow().onCloseRequested(async (event) => {
    if (shouldAsk() && !(await confirmAction(message, 'Schließen'))) event.preventDefault();
  });
}

/** "Save as" dialog for the ZIP export. */
export async function pickZipTarget(defaultName: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  return save({ defaultPath: defaultName, filters: [{ name: 'ZIP-Archiv', extensions: ['zip'] }], title: 'ZIP speichern' });
}

export type DropHandler = {
  onHover: (active: boolean) => void;
  onDrop: (paths: string[]) => void;
};

/** Subscribes to native drag & drop on the app window. Returns an unsubscribe function. */
export async function listenForFileDrops(handler: DropHandler): Promise<() => void> {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview');
  return getCurrentWebview().onDragDropEvent((event) => {
    const payload = event.payload;
    if (payload.type === 'enter' || payload.type === 'over') handler.onHover(true);
    else if (payload.type === 'leave') handler.onHover(false);
    else if (payload.type === 'drop') {
      handler.onHover(false);
      if (payload.paths.length > 0) handler.onDrop(payload.paths);
    }
  });
}

/** Folder with the backend log (desktop app only); null in the browser or if it cannot be determined. */
export async function backendLogFolder(): Promise<string | null> {
  if (!IS_DESKTOP) return null;
  try {
    const { appLogDir } = await import('@tauri-apps/api/path');
    return await appLogDir();
  } catch {
    return null;
  }
}
