import { useCallback } from 'react';
// Side-effect import: loading the aggregate runs every area's `defineStrings`,
// which fills the registry `translateAdmin` reads. The type-only imports of
// `./index` elsewhere never load it at runtime.
import './index';
import { useLanguage } from '../../hooks/useLanguage';
import type { Direction } from '../../context/languageContextDef';
import { adminLocale, translateAdmin, type TranslateFn, type TranslationParams } from './core';
import type { AdminKey } from './index';

export interface AdminTranslation {
  /** Reads an admin key and fills its `{name}` placeholders. */
  t: (key: AdminKey, params?: TranslationParams) => string;
  language: 'ar' | 'en';
  isAr: boolean;
  dir: Direction;
  /** Locale `adminFormat.ts` should format with. */
  locale: string;
}

/** Language of the running admin, straight from the site-wide `useLanguage()`. */
export function useAdminT(): AdminTranslation {
  const { language, dir } = useLanguage();
  const t = useCallback<TranslateFn>((key, params) => translateAdmin(language, key, params), [language]);
  return { t, language, isAr: language === 'ar', dir, locale: adminLocale(language) };
}
