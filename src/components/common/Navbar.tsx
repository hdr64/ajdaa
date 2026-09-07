import React, { useState, useEffect } from 'react';
import { Menu, X, Phone, CalendarCheck, MessageSquare, Briefcase, Home, ArrowLeft, ArrowRight } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '../../hooks/useLanguage';
import ajdaLogo from '../../assets/Ajda-MainLogo-English-Digital-RGB.png';

interface NavbarProps {
  currentPage: 'home' | 'works' | 'booking' | 'contact';
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t, isRTL } = useLanguage();

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
            ? 'backdrop-blur-xl backdrop-saturate-150 bg-surface/85 border-b border-muted-border/30 py-2.5 sm:py-3 shadow-xl shadow-black/10'
            : 'bg-transparent py-3 sm:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Logo - Only the company logo image, turned white in dark mode */}
          <div
            onClick={() => handleNav('home')}
            className="flex items-center cursor-pointer select-none group py-1"
          >
            <img
              src={ajdaLogo}
              alt="Ajda Real Estate"
              className="h-9 sm:h-11 w-auto object-contain transition-all duration-300 group-hover:scale-105 navbar-logo drop-shadow-sm"
            />
            {/* Arabic text removed/commented out as requested:
            <span className="text-lg font-black brand-gradient-text">أجـدا العقارية</span>
            */}
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
          <div className="hidden md:flex items-center gap-2.5">
            <LanguageToggle />
            <ThemeToggle />
            <a
              href="tel:+966580484528"
              className="flex items-center gap-2 text-xs text-neutral-text/75 hover:text-accent font-semibold transition-colors px-1"
            >
              <Phone className="w-4 h-4 text-accent" />
              <span dir="ltr">+966 58 048 4528</span>
            </a>
            <button
              onClick={() => handleNav('booking')}
              className={`brand-btn-primary font-black text-xs px-5 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer ${
                currentPage !== 'booking' ? 'booking-pulse' : ''
              }`}
            >
              {t.nav.bookNow}
            </button>
          </div>

          {/* Mobile Right Controls: Language + Theme + Hamburger */}
          <div className="md:hidden flex items-center gap-1.5">
            <LanguageToggle />
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-surface/75 border border-muted-border/30 text-heading hover:text-accent active:scale-95 transition-all cursor-pointer z-50"
              aria-label={t.nav.menu}
            >
              <div className={`transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
                {mobileMenuOpen ? <X className="w-5 h-5 text-accent" /> : <Menu className="w-5 h-5" />}
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

          {/* Brand Header inside drawer - White in dark mode */}
          <div className="relative z-10 flex items-center justify-between mb-6 pb-4 border-b border-muted-border/30">
            <img
              src={ajdaLogo}
              alt="Ajda Real Estate"
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
                      ? 'bg-accent/15 border-accent text-heading font-black shadow-lg shadow-accent/20'
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
            <LanguageToggle variant="mobile" />

            <a
              href="tel:+966580484528"
              className="w-full brand-btn-secondary font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4 text-accent" />
              <span dir="ltr">+966 58 048 4528</span>
            </a>

            <button
              onClick={() => handleNav('booking')}
              className="w-full brand-btn-primary font-black text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-accent/25"
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
