import { createContext } from 'react';

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';

export interface LanguageContextType {
  language: Language;
  dir: Direction;
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const LANG_STORAGE_KEY = 'ajda-lang';

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);
