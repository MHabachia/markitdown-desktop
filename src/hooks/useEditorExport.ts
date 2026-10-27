import { apiClient } from '../api/client';
import { IS_DESKTOP, pickExportTarget } from '../utils/desktop';
import { buildHtmlDocument } from '../utils/editor';
import { Notify } from './useToasts';

interface EditorExportOptions {
  fileName: string;
  content: string;
  renderedHtml: string;
  notify: Notify;
}

/** Exporting the document from the editor: Markdown, HTML, text, print, or HTML to the clipboard. */
export function useEditorExport({ fileName, content, renderedHtml, notify }: EditorExportOptions) {
  /**
   * Saves an export. The desktop app uses a "save as" dialog (a WebView ignores download
   * links); the browser build falls back to a normal download.
   */
  const exportFile = async (data: string, extension: 'md' | 'html' | 'txt', mime: string) => {
    const exportName = `${fileName.replace(/\.[^/.]+$/, '')}.${extension}`;
    try {
      if (IS_DESKTOP) {
        const target = await pickExportTarget(exportName, extension);
        if (!target) return; // dialog cancelled
        await apiClient.saveFile(target, data);
      } else {
        const url = URL.createObjectURL(new Blob([data], { type: `${mime};charset=utf-8` }));
        const a = document.createElement('a');
        a.href = url;
        a.download = exportName;
        a.click();
        URL.revokeObjectURL(url);
      }
      notify(`${exportName} gespeichert`, 'success');
    } catch (e) {
      notify(`Export fehlgeschlagen: ${e instanceof Error ? e.message : e}`, 'error');
    }
  };

  /** Resolves to true when the HTML was copied. */
  const copyHtml = async () => {
    try {
      await navigator.clipboard.writeText(renderedHtml);
      notify('Gerendertes HTML in Zwischenablage kopiert!', 'success');
      return true;
    } catch {
      notify('HTML-Kopieren fehlgeschlagen', 'error');
      return false;
    }
  };

  return {
    saveMarkdown: () => exportFile(content, 'md', 'text/markdown'),
    saveHtml: () => exportFile(buildHtmlDocument(fileName, renderedHtml), 'html', 'text/html'),
    saveText: () => exportFile(content, 'txt', 'text/plain'),
    print: () => window.print(),
    copyHtml
  };
}
