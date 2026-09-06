import React, { useState, useEffect } from 'react';
import { Building2, Phone, Menu, X, ArrowLeft, CalendarCheck, Home, Briefcase, MessageSquare } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavbarProps {
  currentPage: string;
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
}

const NAV_ITEMS = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'works', label: 'أعمالنا والعقارات', icon: Briefcase },
  { id: 'booking', label: 'الحجز والمعاينة', icon: CalendarCheck },
  { id: 'contact', label: 'تواصل معنا', icon: MessageSquare },
] as const;

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
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

  return (
    <>
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-xl backdrop-saturate-150 bg-surface/80 border-b border-muted-border/30 py-3 shadow-xl shadow-black/10'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <div
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-11 h-11 brand-btn-primary rounded-xl flex items-center justify-center font-bold shadow-lg shadow-accent/20 group-hover:scale-105 transition-transform duration-300">
              <Building2 className="w-6 h-6 text-[var(--brand-btn-text)]" />
            </div>
            <div>
              <span className="text-xl font-black brand-gradient-text tracking-wide block leading-tight">
                أجـدا
              </span>
              <span className="text-[10px] text-neutral-text/60 tracking-[0.2em] block font-bold">
                العقارية · Ajda
              </span>
            </div>
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
          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle />
            <a
              href="tel:+966500000000"
              className="flex items-center gap-2 text-xs text-neutral-text/75 hover:text-accent font-semibold transition-colors px-1"
            >
              <Phone className="w-4 h-4 text-accent" />
              <span dir="ltr">+966 50 000 0000</span>
            </a>
            <button
              onClick={() => handleNav('booking')}
              className={`brand-btn-primary font-black text-xs px-5 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer ${
                currentPage !== 'booking' ? 'booking-pulse' : ''
              }`}
            >
              احجز الآن
            </button>
          </div>

          {/* Mobile Right Controls: ThemeToggle + Hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-xl bg-surface/70 border border-muted-border/30 text-heading hover:text-accent active:scale-95 transition-all cursor-pointer z-50"
              aria-label="القائمة"
            >
              <div className={`transition-transform duration-300 ${mobileMenuOpen ? 'rotate-90' : 'rotate-0'}`}>
                {mobileMenuOpen ? <X className="w-6 h-6 text-accent" /> : <Menu className="w-6 h-6" />}
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Animated Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-canvas/95 backdrop-blur-2xl mobile-menu-overlay flex flex-col justify-between p-8 pt-28 md:hidden overflow-y-auto">
          {/* Ambient Light Orb */}
          <div className="brand-glow z-0 w-80 h-80 top-1/4 left-1/2 -translate-x-1/2 opacity-40 pointer-events-none" />

          {/* Navigation Links */}
          <div className="relative z-10 flex flex-col gap-4 max-w-sm mx-auto w-full my-auto">
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const active = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.id)}
                  style={{ animationDelay: `${(idx + 1) * 80}ms` }}
                  className={`mobile-nav-item w-full flex items-center justify-between p-4 rounded-2xl border text-right transition-all duration-300 cursor-pointer ${
                    active
                      ? 'bg-accent/15 border-accent text-heading font-black shadow-lg shadow-accent/20 translate-x-1'
                      : 'bg-surface/40 border-muted-border/30 text-neutral-text/80 font-bold hover:bg-surface/70 hover:border-accent/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        active ? 'brand-fill text-canvas' : 'bg-surface border border-muted-border/30 text-accent'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-lg">{item.label}</span>
                  </div>

                  <ArrowLeft className={`w-4 h-4 transition ${active ? 'text-accent' : 'opacity-40'}`} />
                </button>
              );
            })}
          </div>

          {/* Mobile Bottom CTA Section */}
          <div
            className="relative z-10 mobile-nav-item max-w-sm mx-auto w-full pt-6 border-t border-muted-border/30 flex flex-col gap-3"
            style={{ animationDelay: '420ms' }}
          >
            <ThemeToggle variant="mobile" />

            <a
              href="tel:+966500000000"
              className="w-full brand-btn-secondary font-bold text-xs py-3.5 rounded-2xl flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4 text-accent" />
              <span dir="ltr">+966 50 000 0000</span>
            </a>

            <button
              onClick={() => handleNav('booking')}
              className="w-full brand-btn-primary font-black text-sm py-4 rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-xl shadow-accent/25"
            >
              <CalendarCheck className="w-5 h-5 text-[var(--brand-btn-text)]" />
              احجز موعد معاينة الآن
            </button>
          </div>
        </div>
      )}
    </>
  );
};
