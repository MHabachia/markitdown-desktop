import { FileStatus } from '../types';

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ${units[i]}`;
};

export const formatDateTime = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Joins the non-empty parts with a middle dot, e.g. "1,8 KB · 43 Wörter". */
export const metaLine = (...parts: Array<string | false | undefined | null>): string =>
  parts.filter(Boolean).join(' · ');

export const isPending = (status: FileStatus): boolean =>
  status === 'ready' || status === 'queued' || status === 'converting';

export const STATUS_LABELS: Record<FileStatus, string> = {
  ready: 'Bereit',
  queued: 'Wartet',
  converting: 'Läuft …',
  success: 'Fertig',
  failed: 'Fehler',
  cancelled: 'Abgebrochen'
};

/** Status text; a converted but not yet saved result says so. */
export const statusLabel = (file: { status: FileStatus; saved?: boolean }): string =>
  file.status === 'success' && !file.saved ? 'Nicht gespeichert' : file.status === 'success' ? 'Gespeichert' : STATUS_LABELS[file.status];

export const statusClass = (file: { status: FileStatus; saved?: boolean }): string =>
  file.status === 'success' && !file.saved ? 'status-unsaved' : `status-${file.status}`;

/** Escapes text for safe inclusion in generated HTML documents. */
export const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);
