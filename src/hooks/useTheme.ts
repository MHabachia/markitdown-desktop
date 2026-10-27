import { useEffect } from 'react';
import { AppSettings } from '../types';

/** Applies the theme to the document. "system" follows the OS setting and updates live when it changes. */
export function useTheme(theme: AppSettings['theme']) {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const resolved = theme === 'system' ? (media.matches ? 'light' : 'dark') : theme;
      document.documentElement.setAttribute('data-theme', resolved);
    };
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}
