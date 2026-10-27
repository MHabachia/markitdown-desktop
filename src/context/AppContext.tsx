import { createContext, useContext } from 'react';
import { AppSettings } from '../types';
import { Notify } from '../hooks/useToasts';

/** What most screens need: the settings, toasts and "open in the file manager / default app". */
export interface AppContextValue {
  settings: AppSettings;
  updateSettings: (changes: Partial<AppSettings>) => void;
  notify: Notify;
  openFolder: (path: string) => void;
  openFile: (path: string) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppContext.Provider>');
  return value;
}
