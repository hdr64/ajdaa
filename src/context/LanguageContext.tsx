import React, { useEffect, useState } from 'react';
import { LanguageContext, LANG_STORAGE_KEY, type Language, type Direction } from './languageContextDef';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ar';
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY) as Language | null;
      if (saved === 'ar' || saved === 'en') {
        return saved;
      }
    } catch {
      // Ignore localStorage error
    }
    return 'ar';
  });

  const dir: Direction = language === 'ar' ? 'rtl' : 'ltr';
  const isRTL = language === 'ar';

  const applyLanguage = (lang: Language) => {
    const root = document.documentElement;
    const nextDir = lang === 'ar' ? 'rtl' : 'ltr';
    root.setAttribute('lang', lang);
    root.setAttribute('dir', nextDir);

    // Dynamic Title
    if (lang === 'ar') {
      document.title = 'أجدا العقارية | نُعيد تعريف العقار… مشروعاً، وقيمة، وتجربة';
      document.body.classList.remove('font-sans-en');
      document.body.classList.add('font-cairo');
    } else {
      document.title = 'Ajda Real Estate | Redefining Real Estate… Project, Value, and Experience';
      document.body.classList.remove('font-cairo');
      document.body.classList.add('font-sans-en');
    }
  };

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => {
      const next = prev === 'ar' ? 'en' : 'ar';
      try {
        localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // Ignore
      }
      return next;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, dir, isRTL, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
