import React, { useEffect, useState } from 'react';
import { LanguageContext, LANG_STORAGE_KEY, type Language, type Direction } from './languageContextDef';
import { twinPath } from '../seo/paths';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'ar';
    try {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname === '/en' || pathname.startsWith('/en/')) {
        return 'en';
      }
      if (pathname === '/admin' || pathname.startsWith('/admin/')) {
        const saved = localStorage.getItem(LANG_STORAGE_KEY) as Language | null;
        if (saved === 'ar' || saved === 'en') return saved;
      }
      const urlParams = new URLSearchParams(window.location.search);
      const urlLang = urlParams.get('lang');
      if (urlLang === 'ar' || urlLang === 'en') {
        return urlLang;
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

    // The document title is owned by `useSeo` (per page and language).
    if (lang === 'ar') {
      document.body.classList.remove('font-sans-en');
      document.body.classList.add('font-cairo');
    } else {
      document.body.classList.remove('font-cairo');
      document.body.classList.add('font-sans-en');
    }
  };

  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object' && event.data.type === 'AJDA_SET_LANG') {
        const nextLang = event.data.lang;
        if (nextLang === 'ar' || nextLang === 'en') {
          setLanguageState(nextLang);
        }
      }
    };

    const handlePopState = () => {
      const pathname = window.location.pathname.toLowerCase();
      if (pathname === '/en' || pathname.startsWith('/en/')) {
        setLanguageState('en');
      } else if (!pathname.startsWith('/admin')) {
        setLanguageState('ar');
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
      const pathname = window.location.pathname;
      if (!pathname.startsWith('/admin')) {
        const target = twinPath(pathname, lang);
        if (target !== pathname) {
          window.history.pushState({ ...window.history.state }, '', target);
        }
      }
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  return (
    <LanguageContext.Provider value={{ language, dir, isRTL, setLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
