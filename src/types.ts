export type FileStatus = 'ready' | 'queued' | 'converting' | 'success' | 'failed' | 'cancelled';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  extension: string;
  category?: string;
  status: FileStatus;
  progress: number;
  fileBlob?: File;
  targetPath?: string;
  /** The Markdown exists on disk (explicitly saved, or auto-saved). */
  saved?: boolean;
  markdownContent?: string;
  title?: string;
  wordCount?: number;
  charCount?: number;
  lineCount?: number;
  durationMs?: number;
  error?: string;
  errorDetails?: string;
  solutionHint?: string;
  timestamp?: string;
}

export interface FormatCapability {
  id: string;
  name: string;
  extensions: string[];
  status: 'ready' | 'needs_dependency' | 'unsupported';
  dependency: string;
  description: string;
  category: string;
}

export interface SystemDiagnostics {
  status: 'ready' | 'error';
  engine: string;
  markitdown_version: string;
  python_version: string;
  python_path: string;
  platform: string;
  is_local_only: boolean;
  capabilities: FormatCapability[];
  supported_extensions: string[];
  ready_formats_count: number;
  total_formats_count: number;
  packages: Record<string, string>;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  default_output_dir: string;
  open_output_after_convert: boolean;
  open_preview_after_convert: boolean;
  collision_strategy: 'rename' | 'overwrite' | 'skip' | 'error';
  filename_template: string;
  concurrency_limit: number;
  watcher_inbox_dir: string;
  watcher_output_dir: string;
  keep_data_uris: boolean;
  auto_save_after_convert: boolean;
  timeout_seconds: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  default_output_dir: '',
  open_output_after_convert: false,
  open_preview_after_convert: true,
  collision_strategy: 'rename',
  filename_template: '{name}.md',
  concurrency_limit: 4,
  watcher_inbox_dir: '',
  watcher_output_dir: '',
  keep_data_uris: false,
  auto_save_after_convert: false,
  timeout_seconds: 60
};

/** A file on disk as reported by /api/resolve-paths. */
export interface ResolvedFile {
  name: string;
  path: string;
  size: number;
  extension: string;
}

export interface WatcherStatus {
  is_running: boolean;
  inbox: string | null;
  output: string | null;
  processed_count: number;
  last_error: string | null;
  last_event_time: number | null;
}

export interface HistoryItem {
  id: string;
  source_name: string;
  source_path: string;
  target_path?: string;
  status: 'success' | 'failed';
  timestamp: string;
  duration_ms: number;
  word_count?: number;
  file_size_bytes?: number;
  error?: string;
}

export type ActiveTab = 'studio' | 'history' | 'watcher' | 'settings' | 'about';
