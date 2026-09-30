import { useMemo } from 'react';
import { useLanguage } from './useLanguage';

/**
 * Every CMS field is stored as an Arabic/English pair. This picks the right
 * half once per component instead of repeating `isAr ? ar : en` at each usage,
 * and falls back to the other language when one side was left empty.
 */
export function useCmsText() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return useMemo(
    () => ({
      isAr,
      text: (ar: string, en: string): string => (isAr ? ar || en : en || ar),
      list: (ar: string[], en: string[]): string[] => (isAr ? ar : en),
    }),
    [isAr]
  );
}
