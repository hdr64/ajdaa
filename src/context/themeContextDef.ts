import { createContext } from 'react';

export type ThemeMode = 'dark' | 'light';
export type ThemeVariant = 'classic' | 'prime';

export interface ThemeContextType {
  theme: ThemeMode;
  variant: ThemeVariant;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  toggleVariant: () => void;
  setVariant: (variant: ThemeVariant) => void;
}

export const STORAGE_KEY = 'ajda-theme-mode';
export const VARIANT_STORAGE_KEY = 'ajda-theme-variant';

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
