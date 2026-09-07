import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface LanguageToggleProps {
  variant?: 'navbar' | 'mobile';
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({ variant = 'navbar' }) => {
  const { language, toggleLanguage } = useLanguage();

  if (variant === 'mobile') {
    return (
      <button
        onClick={toggleLanguage}
        className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-surface/80 border border-muted-border/40 text-heading hover:border-accent font-bold transition-all duration-300 cursor-pointer shadow-sm active:scale-[0.98]"
        aria-label="Toggle language"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center text-accent">
            <Globe className="w-4 h-4" />
          </div>
          <span className="text-sm">
            {language === 'ar' ? 'English (EN)' : 'العربية (AR)'}
          </span>
        </div>
        <span className="text-xs font-black px-2.5 py-1 rounded-lg brand-fill">
          {language === 'ar' ? 'EN' : 'عربي'}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="relative group p-2.5 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-center bg-surface/90 border-muted-border/40 hover:border-accent/60 hover:bg-surface-hover text-accent shadow-sm dark:bg-surface/50 dark:border-muted-border/30 dark:hover:border-accent/50 dark:hover:bg-surface-hover/80 active:scale-95 select-none"
      title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <Globe className="w-5 h-5 text-accent group-hover:rotate-45 transition-transform duration-300" />
      </div>
      <span className="absolute -bottom-1 -right-1 text-[8px] font-black px-1 rounded bg-accent text-white shadow-xs leading-tight pointer-events-none">
        {language === 'ar' ? 'EN' : 'عربي'}
      </span>
      <span className="sr-only">
        {language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      </span>
    </button>
  );
};
