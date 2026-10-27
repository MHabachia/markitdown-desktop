import { apiClient } from '../api/client';
import { FileItem } from '../types';
import { IS_DESKTOP, pickZipTarget } from '../utils/desktop';
import { Notify } from './useToasts';
import { useQueue } from './useQueue';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** What happens to converted results: saving, saving edits from the editor, and the ZIP export. */
export function useResultActions(queue: ReturnType<typeof useQueue>, notify: Notify) {
  /** Uses the current (possibly edited) content, saved or not. */
  const exportZip = async () => {
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

  /** Editor "save": overwrite the file if it is already on disk, otherwise save it for the first time. */
  const saveFromEditor = async (file: FileItem, content: string) => {
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

  const save = async (file: FileItem, saveAs = false) => {
    const saved = await queue.save(file.id, { saveAs });
    if (saved) notify(`Gespeichert: ${saved.targetPath?.split(/[\\/]/).pop()}`, 'success');
  };

  return { exportZip, saveFromEditor, save };
}
