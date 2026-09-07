import { useContext } from 'react';
import { LanguageContext } from '../context/languageContextDef';
import { translations } from '../i18n/translations';

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }

  const { language, dir, isRTL, setLanguage, toggleLanguage } = context;
  const t = translations[language];

  return {
    language,
    dir,
    isRTL,
    setLanguage,
    toggleLanguage,
    t,
  };
};
