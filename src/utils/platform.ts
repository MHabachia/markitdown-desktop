/**
 * Keyboard shortcut labels for the current OS, so macOS and Windows show the same
 * features with their native key names (⌘ vs. Strg).
 */
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

export const IS_MAC = isMac;

export function shortcut(key: string, options: { shift?: boolean } = {}): string {
  const label = key === 'Enter' ? (isMac ? '↵' : 'Enter') : key;
  if (isMac) return `${options.shift ? '⇧' : ''}⌘${label}`;
  return `Strg+${options.shift ? 'Umschalt+' : ''}${label}`;
}

/** Name of the OS file manager, for labels like "Im Finder zeigen". */
export const FILE_MANAGER = isMac ? 'Finder' : 'Explorer';
