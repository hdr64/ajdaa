import React from 'react';
import { Sparkles, Crown } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';

interface ThemeVariantToggleProps {
  variant?: 'navbar' | 'mobile';
}

export const ThemeVariantToggle: React.FC<ThemeVariantToggleProps> = ({ variant: displayVariant = 'navbar' }) => {
  const { variant, toggleVariant } = useTheme();
  const { language } = useLanguage();
  const isPrime = variant === 'prime';

  if (displayVariant === 'mobile') {
    return (
      <button
        type="button"
        onClick={toggleVariant}
        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer ${
          isPrime
            ? 'bg-linear-to-r from-amber-500/20 via-yellow-500/10 to-transparent border-amber-400/50 text-amber-300'
            : 'bg-surface/80 border-muted-border/40 text-heading hover:border-accent'
        }`}
        aria-label="Toggle theme variant"
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              isPrime ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40' : 'bg-accent/15 text-accent'
            }`}
          >
            {isPrime ? <Crown className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
          </div>
          <div className="text-start">
            <span className="block text-sm font-bold">
              {language === 'ar'
                ? isPrime ? 'طابع أجدا برايم (PDF)' : 'الطابع الكلاسيكي'
                : isPrime ? 'Ajda Prime Edition (PDF)' : 'Classic Edition'}
            </span>
            <span className="block text-[10px] text-neutral-text/70">
              {language === 'ar'
                ? isPrime ? 'هوية معمارية فاخرة باللون الكحلي والذهبي' : 'الهوية الأساسية للشركة'
                : isPrime ? 'Midnight petrol & gold architectural theme' : 'Original corporate theme'}
            </span>
          </div>
        </div>

        <span
          className={`text-xs font-black px-2.5 py-1 rounded-lg ${
            isPrime
              ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/40'
              : 'brand-fill text-white'
          }`}
        >
          {isPrime ? (language === 'ar' ? 'برايم' : 'Prime') : (language === 'ar' ? 'كلاسيك' : 'Classic')}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleVariant}
      className={`h-10 px-3 rounded-xl border transition-all duration-300 cursor-pointer flex items-center gap-1.5 shrink-0 select-none ${
        isPrime
          ? 'bg-amber-400/15 border-amber-400/50 text-amber-300 shadow-xs hover:bg-amber-400/25'
          : 'bg-surface/90 border-muted-border/40 text-neutral-text/80 hover:text-accent hover:border-accent/60 hover:bg-surface-hover shadow-xs'
      }`}
      title={
        language === 'ar'
          ? isPrime ? 'التبديل إلى الطابع الكلاسيكي' : 'التبديل إلى طابع أجدا برايم (PDF)'
          : isPrime ? 'Switch to Classic theme' : 'Switch to Ajda Prime (PDF) theme'
      }
      aria-label="Toggle Theme Variant"
    >
      {isPrime ? (
        <Crown className="w-4 h-4 text-amber-300 animate-pulse" />
      ) : (
        <Sparkles className="w-4 h-4 text-accent" />
      )}
      <span className="text-xs font-black tracking-tight">
        {isPrime
          ? (language === 'ar' ? 'برايم' : 'Prime')
          : (language === 'ar' ? 'كلاسيك' : 'Classic')}
      </span>
    </button>
  );
};
