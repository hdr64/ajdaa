import React, { useState, useEffect } from 'react';
import { Menu, X, CalendarCheck, MessageSquare, Briefcase, Home, ArrowLeft, ArrowRight } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { ThemeVariantToggle } from './ThemeVariantToggle';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';

import logoArLight from '../../assets/logos/ar-1.png';
import logoArDark from '../../assets/logos/ar-2.png';
import logoEnLight from '../../assets/logos/en-1.png';
import logoEnDark from '../../assets/logos/en-2.png';

interface NavbarProps {
  currentPage: 'home' | 'works' | 'booking' | 'contact';
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, isRTL, language } = useLanguage();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const logoSrc = isDark
    ? (language === 'ar' ? logoArDark : logoEnDark)
    : (language === 'ar' ? logoArLight : logoEnLight);

  const NAV_ITEMS = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'works', label: t.nav.works, icon: Briefcase },
    { id: 'booking', label: t.nav.booking, icon: CalendarCheck },
    { id: 'contact', label: t.nav.contact, icon: MessageSquare },
  ] as const;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [mobileMenuOpen]);

  const handleNav = (page: 'home' | 'works' | 'booking' | 'contact') => {
    onNavigate(page);
    setMobileMenuOpen(false);
  };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <>
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-xl backdrop-saturate-150 bg-surface/90 border-b border-muted-border/30 py-2 sm:py-3 shadow-xs'
            : 'backdrop-blur-md bg-canvas/75 sm:bg-transparent sm:backdrop-blur-none border-b border-muted-border/20 sm:border-transparent py-2.5 sm:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo - Dynamically switches between the 4 official brand logos */}
          <div
            onClick={() => handleNav('home')}
            className="flex items-center cursor-pointer select-none group py-1"
          >
            <img
              src={logoSrc}
              alt={language === 'ar' ? 'أجدا العقارية' : 'Ajda Real Estate'}
              className="h-8 xs:h-9 sm:h-11 w-auto object-contain transition-opacity duration-300 group-hover:opacity-90 navbar-logo"
            />
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleNav(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-all relative cursor-pointer ${
                  currentPage === tab.id
                    ? 'text-accent font-extrabold'
                    : 'text-neutral-text/75 hover:text-accent font-semibold'
                }`}
              >
                {tab.label}
                {currentPage === tab.id && (
                  <span className="absolute bottom-0 inset-x-4 h-0.5 rounded-full bg-gradient-to-r from-accent-light via-accent to-accent-dark transition-all duration-300" />
                )}
              </button>
            ))}
          </div>

          {/* Desktop Right CTA */}
          <div className="hidden md:flex items-center gap-2.5 lg:gap-3">
            <ThemeVariantToggle />
            <LanguageToggle />
            <ThemeToggle />
            <button
              onClick={() => handleNav('booking')}
              className="brand-btn-primary font-black text-xs px-5 py-2.5 rounded-full transition-all duration-300 cursor-pointer"
            >
              {t.nav.bookNow}
            </button>
          </div>

          {/* Mobile Right Controls: Unified capsule dock with Language + Theme + Hamburger */}
          <div className="md:hidden flex items-center gap-1 p-1 rounded-2xl bg-surface/85 backdrop-blur-xl border border-muted-border/40 shadow-xs">
            <LanguageToggle variant="compact" />
            <ThemeToggle variant="compact" />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-9 h-9 rounded-xl brand-fill text-canvas hover:opacity-90 transition-all cursor-pointer flex items-center justify-center shadow-xs"
              aria-label={t.nav.menu}
            >
              <div className={`transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
                {mobileMenuOpen ? <X className="w-4 h-4 text-inherit" /> : <Menu className="w-4 h-4 text-inherit" />}
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Animated Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-canvas/95 backdrop-blur-2xl mobile-menu-overlay flex flex-col justify-between p-6 sm:p-8 pt-24 md:hidden overflow-y-auto">
          {/* Ambient Light Orb */}
          <div className="brand-glow z-0 w-72 h-72 top-1/4 left-1/2 -translate-x-1/2 opacity-30 pointer-events-none" />

          {/* Brand Header inside drawer */}
          <div className="relative z-10 flex items-center justify-between mb-6 pb-4 border-b border-muted-border/30">
            <img
              src={logoSrc}
              alt={language === 'ar' ? 'أجدا العقارية' : 'Ajda Real Estate'}
              className="h-9 w-auto object-contain navbar-logo"
            />
          </div>

          {/* Navigation Links */}
          <div className="relative z-10 flex flex-col gap-2.5 max-w-sm mx-auto w-full my-auto">
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  style={{ animationDelay: `${(idx + 1) * 70}ms` }}
                  className={`mobile-nav-item w-full flex items-center justify-between p-3.5 rounded-2xl border ${isRTL ? 'text-right' : 'text-left'} transition-all duration-300 cursor-pointer ${
                    active
                      ? 'bg-accent/15 border-accent text-heading font-black'
                      : 'bg-surface/40 border-muted-border/30 text-neutral-text/80 font-bold hover:bg-surface/70 hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        active ? 'brand-fill text-canvas' : 'bg-surface border border-muted-border/30 text-accent'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-base">{item.label}</span>
                  </div>

                  <ArrowIcon className={`w-4 h-4 transition ${active ? 'text-accent' : 'opacity-40'}`} />
                </button>
              );
            })}
          </div>

          {/* Mobile Bottom CTA Section */}
          <div
            className="relative z-10 mobile-nav-item max-w-sm mx-auto w-full pt-4 border-t border-muted-border/30 flex flex-col gap-2.5 mt-auto"
            style={{ animationDelay: '350ms' }}
          >
            <ThemeVariantToggle variant="mobile" />
            <LanguageToggle variant="mobile" />

            <a
              href="https://wa.me/966580484528"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full brand-btn-secondary font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 hover:text-emerald-500 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-emerald-500 shrink-0" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              <span dir="ltr">+966 58 048 4528</span>
            </a>

            <button
              onClick={() => handleNav('booking')}
              className="w-full brand-btn-primary font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <CalendarCheck className="w-4 h-4 text-[var(--brand-btn-text)]" />
              {t.nav.bookNow}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
