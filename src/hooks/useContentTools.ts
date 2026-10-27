import { apiClient } from '../api/client';
import { Notify } from './useToasts';

/** The editor's Markdown helpers (done by the backend): they replace the content with the result. */
export function useContentTools(content: string, setContent: (content: string) => void, notify: Notify) {
  const run = async (action: (text: string) => Promise<string>, done: string, failed: string) => {
    try {
      setContent(await action(content));
      notify(done, 'success');
    } catch {
      notify(failed, 'error');
    }
  };

  return {
    formatTables: () => run(apiClient.formatTables, 'Markdown-Tabellen sauber ausgerichtet', 'Tabellenformatierung fehlgeschlagen'),
    cleanWhitespace: () => run(apiClient.cleanWhitespace, 'Leerzeilen & Whitespace bereinigt', 'Bereinigung fehlgeschlagen'),
    insertToc: () => run(apiClient.generateToc, 'Inhaltsverzeichnis eingefügt', 'TOC-Generierung fehlgeschlagen')
  };
}
