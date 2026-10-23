import React from 'react';
import { useLanguage } from '../../../hooks/useLanguage';
import { useAdminT } from '../../../i18n/admin/useAdminT';

/**
 * Segmented AR/EN switch for the sidebar footer. Calls `setLanguage` directly so
 * the active segment follows the site language instead of toggling blindly.
 */
export const AdminLanguageToggle: React.FC = () => {
  const { language, setLanguage } = useLanguage();
  const { t } = useAdminT();

  return (
    <div
      className="grid grid-cols-2 p-0.5 rounded-xl border border-muted-border/40 bg-canvas"
      role="group"
      aria-label={t('layout.language.group')}
    >
      <button
        type="button"
        onClick={() => setLanguage('ar')}
        aria-pressed={language === 'ar'}
        lang="ar"
        className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
          language === 'ar' ? 'brand-fill text-canvas shadow-xs' : 'text-neutral-text/55 hover:text-heading'
        }`}
      >
        العربية
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        lang="en"
        className={`py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
          language === 'en' ? 'brand-fill text-canvas shadow-xs' : 'text-neutral-text/55 hover:text-heading'
        }`}
      >
        EN
      </button>
    </div>
  );
};
