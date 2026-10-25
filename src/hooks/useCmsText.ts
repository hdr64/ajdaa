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
      /**
       * Index-aligned zip of a paired list. The output keeps the longer array's
       * length and fills each gap from the other language, so callers can keep
       * positional meaning (e.g. a subject's CRM interest type) even when the
       * admin edited only one side.
       */
      list: (ar: string[], en: string[]): string[] => {
        const out: string[] = [];
        for (let i = 0; i < Math.max(ar.length, en.length); i += 1) {
          out.push(isAr ? ar[i] || en[i] || '' : en[i] || ar[i] || '');
        }
        return out;
      },
    }),
    [isAr]
  );
}
