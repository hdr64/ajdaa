import React, { useEffect, useState } from 'react';
import { ThemeContext, STORAGE_KEY, VARIANT_STORAGE_KEY, type ThemeMode, type ThemeVariant } from './themeContextDef';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    try {
      localStorage.removeItem('ajda-theme');
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Ignore localStorage access errors
    }
    return 'light';
  });

  const [variant, setVariantState] = useState<ThemeVariant>(() => {
    if (typeof window === 'undefined') return 'classic';
    try {
      const saved = localStorage.getItem(VARIANT_STORAGE_KEY) as ThemeVariant | null;
      if (saved === 'classic' || saved === 'prime') {
        return saved;
      }
    } catch {
      // Ignore localStorage access errors
    }
    return 'classic';
  });

  const applyTheme = (mode: ThemeMode, currentVariant: ThemeVariant) => {
    const root = document.documentElement;
    if (mode === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }

    if (currentVariant === 'prime') {
      root.setAttribute('data-theme-variant', 'prime');
    } else {
      root.removeAttribute('data-theme-variant');
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      if (currentVariant === 'prime') {
        metaThemeColor.setAttribute('content', mode === 'dark' ? '#07151d' : '#fbf9f5');
      } else {
        metaThemeColor.setAttribute('content', mode === 'dark' ? '#0d1620' : '#f6f8fa');
      }
    }
  };

  useEffect(() => {
    applyTheme(theme, variant);
  }, [theme, variant]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore error
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore error
      }
      return next;
    });
  };

  const setVariant = (newVariant: ThemeVariant) => {
    setVariantState(newVariant);
    try {
      localStorage.setItem(VARIANT_STORAGE_KEY, newVariant);
    } catch {
      // Ignore error
    }
  };

  const toggleVariant = () => {
    setVariantState((prev) => {
      const next = prev === 'classic' ? 'prime' : 'classic';
      try {
        localStorage.setItem(VARIANT_STORAGE_KEY, next);
      } catch {
        // Ignore error
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, variant, toggleTheme, setTheme, toggleVariant, setVariant }}>
      {children}
    </ThemeContext.Provider>
  );
};
