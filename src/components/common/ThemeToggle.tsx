import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface ThemeToggleProps {
  className?: string;
  variant?: 'navbar' | 'mobile';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', variant = 'navbar' }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
          isDark
            ? 'bg-surface/50 border-muted-border/30 hover:bg-surface/80 text-heading'
            : 'bg-surface/90 border-muted-border/40 hover:bg-surface-hover text-heading shadow-sm'
        } ${className}`}
        aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 ${
              isDark
                ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30'
                : 'bg-accent/15 text-accent border border-accent/30'
            }`}
          >
            {isDark ? (
              <Sun className="w-5 h-5 transition-transform duration-500 rotate-0 hover:rotate-90 text-amber-300" />
            ) : (
              <Moon className="w-5 h-5 transition-transform duration-500 -rotate-12 text-accent" />
            )}
          </div>
          <div className="text-right">
            <span className="block text-xs font-bold text-heading">
              {isDark ? 'الوضع الليلي (مفعّل)' : 'الوضع النهاري (مفعّل)'}
            </span>
            <span className="block text-[10px] text-neutral-text/70">
              {isDark ? 'اضغط للتحويل إلى الوضع النهاري' : 'اضغط للتحويل إلى الوضع الليلي'}
            </span>
          </div>
        </div>

        {/* Switch indicator */}
        <div
          className={`w-12 h-6 rounded-full p-0.5 flex items-center transition-colors duration-300 ${
            isDark ? 'bg-surface-hover border border-muted-border/40 justify-start' : 'bg-accent justify-end'
          }`}
        >
          <div
            className={`w-5 h-5 rounded-full transition-transform duration-300 ${
              isDark ? 'bg-amber-300 shadow-sm shadow-amber-500/50' : 'bg-white shadow-sm'
            }`}
          />
        </div>
      </button>
    );
  }

  // Desktop Navbar button
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-10 h-10 relative group rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-center shrink-0 ${
        isDark
          ? 'bg-surface/50 border-muted-border/30 hover:border-amber-400/50 hover:bg-surface-hover/80 text-amber-300 shadow-xs'
          : 'bg-surface/90 border-muted-border/40 hover:border-accent/60 hover:bg-surface-hover text-accent shadow-xs'
      } ${className}`}
      title={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
      aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        <Sun
          className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
            isDark
              ? 'opacity-100 rotate-0 scale-100 text-amber-300'
              : 'opacity-0 rotate-90 scale-0 text-amber-400'
          }`}
        />
        <Moon
          className={`w-5 h-5 absolute inset-0 transition-all duration-500 ${
            isDark
              ? 'opacity-0 -rotate-90 scale-0 text-accent'
              : 'opacity-100 rotate-0 scale-100 text-accent'
          }`}
        />
      </div>
      <span className="sr-only">
        {isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
      </span>
    </button>
  );
};
