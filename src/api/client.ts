import { SystemDiagnostics, FormatCapability, AppSettings, HistoryItem, ResolvedFile, WatcherStatus } from '../types';

export const DEFAULT_CAPABILITIES: FormatCapability[] = [
  {
    id: 'pdf',
    name: 'Portable Document Format',
    extensions: ['.pdf'],
    status: 'ready',
    dependency: 'pdfminer.six',
    description: 'Extrahiert Fließtext, Tabellen und Struktur aus PDF-Dokumenten.',
    category: 'Dokumente'
  },
  {
    id: 'docx',
    name: 'Microsoft Word',
    extensions: ['.docx'],
    status: 'ready',
    dependency: 'mammoth',
    description: 'Konvertiert Word-Absätze, Überschriften, Listen und Tabellen.',
    category: 'Office'
  },
  {
    id: 'pptx',
    name: 'Microsoft PowerPoint',
    extensions: ['.pptx'],
    status: 'ready',
    dependency: 'python-pptx',
    description: 'Wandelt Folieninhalte, Titel und Notizen in Folienblöcke um.',
    category: 'Office'
  },
  {
    id: 'xlsx',
    name: 'Microsoft Excel',
    extensions: ['.xlsx', '.xls'],
    status: 'ready',
    dependency: 'openpyxl / pandas',
    description: 'Generiert saubere Markdown-Tabellen aus Tabellenblättern.',
    category: 'Office'
  },
  {
    id: 'html',
    name: 'HTML & Webseiten',
    extensions: ['.html', '.htm', '.xhtml'],
    status: 'ready',
    dependency: 'beautifulsoup4 / markdownify',
    description: 'Konvertiert semantisches HTML inklusive Überschriften, Links und Tabellen.',
    category: 'Web'
  },
  {
    id: 'csv',
    name: 'CSV & TSV Daten',
    extensions: ['.csv', '.tsv'],
    status: 'ready',
    dependency: 'Integriert (Standardbibliothek)',
    description: 'Wandelt tabellarische Rohdaten direkt in formatierte Markdown-Tabellen um.',
    category: 'Daten'
  },
  {
    id: 'json',
    name: 'JSON & XML',
    extensions: ['.json', '.xml'],
    status: 'ready',
    dependency: 'Integriert (Standardbibliothek)',
    description: 'Konvertiert strukturierte Daten in formatierte Code-/Textblöcke.',
    category: 'Daten'
  },
  {
    id: 'text',
    name: 'Reiner Text & Quellcode',
    extensions: ['.txt', '.log', '.rtf', '.yaml', '.yml'],
    status: 'ready',
    dependency: 'Integriert',
    description: 'Verarbeitet reinen Text und Logdateien unter Beibehaltung der Zeilenumbrüche.',
    category: 'Text'
  },
  {
    id: 'ipynb',
    name: 'Jupyter Notebooks',
    extensions: ['.ipynb'],
    status: 'ready',
    dependency: 'Integriert',
    description: 'Extrahiert Code- und Markdown-Zellen aus Jupyter Notebooks.',
    category: 'Code'
  },
  {
    id: 'image',
    name: 'Bilder (Metadaten)',
    extensions: ['.jpg', '.jpeg', '.png', '.webp'],
    status: 'ready',
    dependency: 'Pillow',
    description: 'Liest Metadaten wie EXIF-Angaben aus Bildern aus.',
    category: 'Medien'
  },
  {
    id: 'zip',
    name: 'ZIP Archive',
    extensions: ['.zip'],
    status: 'ready',
    dependency: 'Integriert',
    description: 'Extrahiert enthaltene Dokumente und fügt die Inhalte zusammen.',
    category: 'Archive'
  }
];

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// Browser dev mode (Vite proxy) uses a relative base. In the Tauri shell the backend
// listens on a random private port and requires a per-session token.
export let API_BASE = '/api';
let apiToken = '';

const backendReady: Promise<void> = (async () => {
  if (!isTauri) {
    if (typeof window !== 'undefined' && window.location.port !== '5173') {
      API_BASE = 'http://127.0.0.1:8765/api';
    }
    return;
  }
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const cfg = await invoke<{ port: number; token: string }>('backend_config');
    API_BASE = `http://127.0.0.1:${cfg.port}/api`;
    apiToken = cfg.token;
    // The bundled backend needs a while to unpack and start: wait until it answers.
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${API_BASE}/health`, { headers: { 'X-API-Token': apiToken } });
        if (res.ok) break;
      } catch {
        /* backend not up yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch {
    API_BASE = 'http://127.0.0.1:8765/api';
  }
})();

/** Parses a JSON response and turns HTTP errors into exceptions carrying the backend's message. */
async function parseJson<T = any>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  await backendReady;
  const headers = new Headers(init.headers);
  if (apiToken) headers.set('X-API-Token', apiToken);
  return fetch(`${API_BASE}${path}`, { ...init, headers });
}

export const apiClient = {
  async getHealth(): Promise<SystemDiagnostics> {
    const res = await apiFetch(`/health`);
    if (!res.ok) throw new Error('Fehler beim Abrufen der Systemdiagnose');
    return parseJson(res);
  },

  async getFormats(): Promise<FormatCapability[]> {
    const res = await apiFetch(`/formats`);
    if (!res.ok) throw new Error('Fehler beim Abrufen der Formate');
    return parseJson(res);
  },

  async convertFile(
    params: {
      source_path?: string;
      file_base64?: string;
      file_name?: string;
      target_dir?: string;
      filename_template?: string;
      collision_strategy?: string;
      keep_data_uris?: boolean;
      save?: boolean;
    },
    signal?: AbortSignal
  ) {
    const res = await apiFetch(`/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal
    });
    if (!res.ok) {
      // Validation/auth/size errors come back as {detail}: surface them instead of a blank failure.
      let detail = '';
      try {
        const body = await res.json();
        detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body);
      } catch {
        detail = await res.text().catch(() => '');
      }
      return {
        success: false,
        error: `Backend antwortete mit HTTP ${res.status}${detail ? `: ${detail}` : ''}`,
        error_details: `POST ${API_BASE}/convert -> ${res.status} ${res.statusText}\n${detail}`,
        solution_hint: res.status === 401 || res.status === 403
          ? 'Die App-Sitzung ist nicht mehr gültig. Starte die App neu.'
          : 'Details stehen im Fehlerprotokoll. Prüfe Datei, Zielordner und Berechtigungen.'
      };
    }
    return parseJson(res);
  },

  async saveFile(file_path: string, content: string) {
    const res = await apiFetch(`/save-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path, content })
    });
    if (!res.ok) throw new Error('Datei konnte nicht gespeichert werden');
    return parseJson(res);
  },

  async openFolder(path: string) {
    const res = await apiFetch(`/open-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    return parseJson(res);
  },

  async openFile(path: string) {
    const res = await apiFetch(`/open-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    return parseJson(res);
  },

  async generateSamples() {
    const res = await apiFetch(`/generate-samples`, {
      method: 'POST'
    });
    return parseJson(res);
  },

  /** Expands files and folders into supported files with metadata (desktop app: real paths). */
  async resolvePaths(paths: string[]): Promise<{ files: ResolvedFile[]; skipped: number; truncated: boolean }> {
    const res = await apiFetch(`/resolve-paths`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths })
    });
    return parseJson(res);
  },

  /** Saves a previewed result: next to the source / into target_dir, or exactly to target_path. */
  async saveMarkdown(params: {
    content: string;
    source_path?: string;
    file_name?: string;
    target_dir?: string;
    target_path?: string;
    filename_template?: string;
    collision_strategy?: string;
    word_count?: number;
    duration_ms?: number;
  }) {
    const res = await apiFetch(`/save-markdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    return parseJson<{ success: boolean; target_path: string; saved: boolean; skipped: boolean }>(res);
  },

  async exportZip(items: Array<{ name: string; content: string }>, options: { zipName?: string; targetPath?: string } = {}) {
    const res = await apiFetch(`/export-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, zip_name: options.zipName, target_path: options.targetPath })
    });
    return parseJson<{ success: boolean; zip_path: string; size_bytes: number; file_count: number }>(res);
  },

  async getHistory(): Promise<HistoryItem[]> {
    const res = await apiFetch(`/history`);
    return parseJson(res);
  },

  async clearHistory() {
    const res = await apiFetch(`/history`, { method: 'DELETE' });
    return parseJson(res);
  },

  async deleteHistoryItem(id: string) {
    const res = await apiFetch(`/history/${id}`, { method: 'DELETE' });
    return parseJson(res);
  },

  async getSettings(): Promise<AppSettings> {
    const res = await apiFetch(`/settings`);
    return parseJson(res);
  },

  async saveSettings(settings: AppSettings) {
    const res = await apiFetch(`/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return parseJson(res);
  },

  // Folder Watcher API
  async startWatcher(inbox_dir: string, output_dir?: string) {
    const res = await apiFetch(`/watcher/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inbox_dir, output_dir })
    });
    return parseJson(res);
  },

  async stopWatcher() {
    const res = await apiFetch(`/watcher/stop`, { method: 'POST' });
    return parseJson(res);
  },

  async getWatcherStatus(): Promise<WatcherStatus> {
    const res = await apiFetch(`/watcher/status`);
    return parseJson<WatcherStatus>(res);
  },

  // Markdown Linter API
  async formatTables(content: string): Promise<string> {
    const res = await apiFetch(`/linter/format-tables`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    return data.formatted || content;
  },

  async cleanWhitespace(content: string): Promise<string> {
    const res = await apiFetch(`/linter/clean-whitespace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    return data.formatted || content;
  },

  async generateToc(content: string): Promise<string> {
    const res = await apiFetch(`/linter/generate-toc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    return data.formatted || content;
  }
};
