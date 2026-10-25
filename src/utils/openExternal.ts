/** Links the app may open in the system browser. Mirrors the scope in src-tauri/capabilities/default.json. */
export const PROJECT_URL = 'https://github.com/MHabachia/markitdown-desktop';
export const MARKITDOWN_URL = 'https://github.com/microsoft/markitdown';

const ALLOWED_PREFIXES = [PROJECT_URL, MARKITDOWN_URL];

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Opens one of the allowed URLs in the default browser (never inside the app window). */
export async function openExternal(url: string): Promise<void> {
  if (!ALLOWED_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`))) {
    throw new Error(`Link nicht erlaubt: ${url}`);
  }
  if (isTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
