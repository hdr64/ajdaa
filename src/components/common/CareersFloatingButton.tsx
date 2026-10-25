import React from 'react';
import { Briefcase } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface CareersFloatingButtonProps {
  onClick: () => void;
}

/**
 * Floating shortcut to the Jobs page on the public site. It sits on the
 * inline-end side (logical classes, so it flips in RTL) under every modal
 * (`z-40`) and shows its label from `sm` up; below that it is icon only.
 *
 * The wrapper owns the positioning: `brand-btn-primary` sets its own
 * `position`, which would override `fixed` on the button itself.
 */
export const CareersFloatingButton: React.FC<CareersFloatingButtonProps> = ({ onClick }) => {
  const { language } = useLanguage();
  const label = language === 'ar' ? 'الوظائف' : 'Jobs';

  return (
    <div className="fixed bottom-6 end-4 sm:end-6 z-40">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="brand-btn-primary flex items-center gap-2 rounded-full p-3.5 sm:px-5 sm:py-3 shadow-lg text-xs font-black cursor-pointer motion-safe:transition-transform motion-safe:hover:scale-105"
      >
        <Briefcase className="w-5 h-5" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
};
