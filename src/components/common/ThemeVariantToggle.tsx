import React from 'react';
import { Sparkles, Crown, Check } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';

interface ThemeVariantToggleProps {
  variant?: 'navbar' | 'mobile';
}

export const ThemeVariantToggle: React.FC<ThemeVariantToggleProps> = ({ variant: displayVariant = 'navbar' }) => {
  const { variant, setVariant } = useTheme();
  const { language } = useLanguage();
  const isPrime = variant === 'prime';
  const isAr = language === 'ar';

  if (displayVariant === 'mobile') {
    return (
      <div className="w-full flex flex-col gap-2 p-3 rounded-2xl bg-surface/60 border border-muted-border/30">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black text-heading flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            {isAr ? 'اختر طابع التصميم' : 'Select Theme Variant'}
          </span>
          <span className="text-[10px] text-neutral-text/70 font-semibold">
            {isPrime
              ? (isAr ? 'برايم (ذهبي وكحلي)' : 'Prime (Gold & Navy)')
              : (isAr ? 'كلاسيكي' : 'Classic')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          {/* Classic Option */}
          <button
            type="button"
            onClick={() => setVariant('classic')}
            className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              !isPrime
                ? 'bg-accent/15 border-accent text-heading shadow-sm'
                : 'bg-surface/50 border-muted-border/30 text-neutral-text/70 hover:bg-surface/80'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#197285] inline-block shadow-xs" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#334155] inline-block shadow-xs" />
              </div>
              {!isPrime && <Check className="w-3.5 h-3.5 text-accent" />}
            </div>
            <div>
              <span className="block text-xs font-black">
                {isAr ? 'الكلاسيكي' : 'Classic'}
              </span>
              <span className="block text-[9px] text-neutral-text/70 line-clamp-1">
                {isAr ? 'الأخضر والرصاصي' : 'Teal & Slate'}
              </span>
            </div>
          </button>

          {/* Prime Option */}
          <button
            type="button"
            onClick={() => setVariant('prime')}
            className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer flex flex-col justify-between gap-2 ${
              isPrime
                ? 'bg-gradient-to-br from-amber-500/20 via-yellow-500/10 to-transparent border-amber-400/60 text-amber-300 shadow-sm shadow-amber-500/20'
                : 'bg-surface/50 border-muted-border/30 text-neutral-text/70 hover:bg-surface/80'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#030a16] border border-amber-400/50 inline-block shadow-xs" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] inline-block shadow-xs" />
              </div>
              {isPrime ? (
                <Crown className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              ) : (
                <Crown className="w-3.5 h-3.5 text-neutral-text/50" />
              )}
            </div>
            <div>
              <span className="block text-xs font-black text-amber-400">
                {isAr ? 'أجدا برايم' : 'Ajda Prime'}
              </span>
              <span className="block text-[9px] text-neutral-text/70 line-clamp-1">
                {isAr ? 'ذهبي وكحلي (PDF)' : 'Gold & Dark Blue'}
              </span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Desktop Navbar Segmented Switcher
  return (
    <div
      className="h-9 p-0.5 rounded-xl bg-surface/90 border border-muted-border/40 flex items-center gap-0.5 shadow-xs shrink-0 select-none"
      role="group"
      aria-label={isAr ? 'اختيار طابع التصميم' : 'Theme Variant Selection'}
    >
      {/* Classic Tab */}
      <button
        type="button"
        onClick={() => setVariant('classic')}
        className={`h-full px-2.5 rounded-lg text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
          !isPrime
            ? 'brand-fill text-white shadow-xs'
            : 'text-neutral-text/75 hover:text-heading hover:bg-surface-hover/70'
        }`}
        title={
          isAr
            ? 'الطابع الكلاسيكي (الأخضر البترولي والرصاصي)'
            : 'Classic Corporate Edition (Teal & Slate)'
        }
      >
        <Sparkles className="w-3.5 h-3.5 shrink-0" />
        <span className="whitespace-nowrap">{isAr ? 'كلاسيك' : 'Classic'}</span>
      </button>

      {/* Prime (Gold & Dark Blue) Tab */}
      <button
        type="button"
        onClick={() => setVariant('prime')}
        className={`h-full px-2.5 rounded-lg text-xs font-black transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
          isPrime
            ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 shadow-sm shadow-amber-500/40'
            : 'text-neutral-text/75 hover:text-amber-400 hover:bg-surface-hover/70'
        }`}
        title={
          isAr
            ? 'طابع أجدا برايم (الذهبي والأزرق الداكن - الكتالوج والـ PDF)'
            : 'Ajda Prime Edition (Gold & Dark Blue - PDF / Screenshot)'
        }
      >
        <Crown className={`w-3.5 h-3.5 shrink-0 ${isPrime ? 'animate-pulse text-slate-950' : 'text-amber-400'}`} />
        <span className="whitespace-nowrap">{isAr ? 'برايم (ذهبي)' : 'Prime (Gold)'}</span>
      </button>
    </div>
  );
};
