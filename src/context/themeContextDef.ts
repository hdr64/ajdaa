import { createContext } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

export const STORAGE_KEY = 'ajda-theme-mode';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
