import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';

import logoArLight from '../../assets/logos/ar-1.png';
import logoArDark from '../../assets/logos/ar-2.png';
import logoEnLight from '../../assets/logos/en-1.png';
import logoEnDark from '../../assets/logos/en-2.png';

interface FooterProps {
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
  onToast: (msg: string) => void;
}

const SOCIALS = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/Ajdaa_RS',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/ajdaa_rs',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@ajdaa_rs',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.24 1.17 2.22 2.39 2.47.78.17 1.6.09 2.33-.24.78-.34 1.41-.97 1.74-1.74.24-.54.34-1.13.34-1.72V0h2.09l.11.02Z',
  },
  {
    label: 'Snapchat',
    href: 'https://snapchat.com/t/sVxEBu75',
    path: 'M12.002 2.002c-4.07 0-6.73 3.03-6.73 6.38 0 1.29.38 2.58.98 3.51.2.31.28.63.22.95-.1.52-.57.85-1.07 1.01-.48.15-1.05.2-1.35.47-.2.18-.28.46-.17.7.15.33.61.53 1.1.66.86.23 1.83.18 2.56.7.4.29.61.73.66 1.17.06.51-.09.99-.44 1.37-.47.51-1.21.84-1.93 1.16-.62.27-.79.62-.64 1.04.14.39.63.63 1.22.75.9.18 1.91.13 2.76.62.58.33.91.86 1.29 1.39.56.77 1.35 1.13 2.73 1.13s2.17-.36 2.73-1.13c.38-.53.71-1.06 1.29-1.39.85-.49 1.86-.44 2.76-.62.59-.12 1.08-.36 1.22-.75.15-.42-.02-.77-.64-1.04-.72-.32-1.46-.65-1.93-1.16-.35-.38-.5-.86-.44-1.37.05-.44.26-.88.66-1.17.73-.52 1.7-.47 2.56-.7.49-.13.95-.33 1.1-.66.11-.24.03-.52-.17-.7-.3-.27-.87-.32-1.35-.47-.5-.16-.97-.49-1.07-1.01-.06-.32.02-.64.22-.95.6-.93.98-2.22.98-3.51 0-3.35-2.66-6.38-6.73-6.38z',
  },
];

export const Footer: React.FC<FooterProps> = ({ onNavigate, onToast }) => {
  const { t, isRTL, language } = useLanguage();
  const { theme } = useTheme();
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const isDark = theme === 'dark';
  const logoSrc = isDark
    ? language === 'ar'
      ? logoArDark
      : logoEnDark
    : language === 'ar'
    ? logoArLight
    : logoEnLight;

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      onToast(t.footer.newsletterSuccess);
      setNewsletterEmail('');
    }
  };

  return (
    <footer className="relative bg-canvas-dark border-t border-muted-border/20 pt-16 pb-8 overflow-hidden">
      {/* Animated Light Beam */}
      <div className="absolute top-0 inset-x-0 h-1 footer-top-beam" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent/10 blur-[130px] rounded-full pointer-events-none" />

      <Reveal direction="up">
        <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-14">
          {/* Brand & Socials Column */}
          <div>
            <div className="mb-4">
              <button
                onClick={() => onNavigate('home')}
                className="inline-flex items-center text-start cursor-pointer focus:outline-none group"
                aria-label={t.nav.brandName}
              >
                <img
                  src={logoSrc}
                  alt={t.nav.brandName}
                  className="h-12 md:h-14 w-auto object-contain transition-opacity duration-300 group-hover:opacity-90"
                />
              </button>
            </div>
            <p className="text-xs text-neutral-text/70 leading-relaxed mb-6">
              {t.footer.brandDesc}
            </p>
            <div className="flex items-center gap-2.5">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="w-9 h-9 rounded-full border border-muted-border/30 flex items-center justify-center text-neutral-text/70 hover:text-accent hover:border-accent/80 hover:bg-accent/15 social-icon-glow cursor-pointer transition-all hover:scale-105"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 className="text-sm font-bold text-heading mb-5">{t.footer.quickLinks}</h4>
            <div className="flex flex-col gap-3 text-xs text-neutral-text/70">
              {[
                { label: t.footer.navHome, page: 'home' as const },
                { label: t.footer.navWorks, page: 'works' as const },
                { label: t.footer.navBooking, page: 'booking' as const },
                { label: t.footer.navContact, page: 'contact' as const },
              ].map((link) => {
                const Chevron = isRTL ? ChevronLeft : ChevronRight;
                return (
                  <button
                    key={link.page}
                    onClick={() => onNavigate(link.page)}
                    className="flex items-center gap-1.5 text-start hover:text-accent transition cursor-pointer group font-semibold"
                  >
                    <Chevron
                      className={`w-3.5 h-3.5 text-accent/70 ${
                        isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'
                      } transition-transform duration-300`}
                    />
                    {link.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="text-sm font-bold text-heading mb-5">{t.footer.servicesTitle}</h4>
            <div className="flex flex-col gap-3 text-xs text-neutral-text/70">
              {t.footer.services.map((service) => {
                const Chevron = isRTL ? ChevronLeft : ChevronRight;
                return (
                  <button
                    key={service}
                    onClick={() => onNavigate('works')}
                    className="flex items-center gap-1.5 text-start hover:text-accent transition cursor-pointer group font-semibold"
                  >
                    <Chevron
                      className={`w-3.5 h-3.5 text-accent/70 ${
                        isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'
                      } transition-transform duration-300`}
                    />
                    {service}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contact & Newsletter Column */}
          <div>
            <h4 className="text-sm font-bold text-heading mb-5">{t.footer.contactTitle}</h4>
            <div className="space-y-3 text-xs text-neutral-text/70 mb-6">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent shrink-0" />
                <span>{t.footer.address}</span>
              </div>

              {/* Direct WhatsApp Contact - Targets WhatsApp directly, not tel */}
              <a
                href="https://wa.me/966580484528"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-emerald-500 hover:text-emerald-400 font-bold transition group"
                title="واتساب مباشر · Direct WhatsApp"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4 text-emerald-500 shrink-0"
                  aria-hidden="true"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                <span dir="ltr">+966 58 048 4528</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                  {language === 'ar' ? 'واتساب مباشر' : 'Direct WhatsApp'}
                </span>
              </a>

              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-accent shrink-0" />
                <a href="mailto:info@ajdaa.sa" className="hover:text-accent transition" dir="ltr">
                  info@ajdaa.sa
                </a>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent shrink-0" />
                <span>{t.footer.hours}</span>
              </div>
            </div>

            <h4 className="text-sm font-bold text-heading mb-3">{t.footer.newsletterTitle}</h4>
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex items-center gap-2 bg-surface/80 border border-muted-border/40 rounded-xl p-1.5 focus-within:border-accent transition shadow-xs"
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder={t.footer.newsletterPlaceholder}
                aria-label={t.footer.newsletterTitle}
                className="flex-1 bg-transparent text-xs text-neutral-text placeholder:text-neutral-text/50 px-2 outline-none min-w-0"
              />
              <button
                type="submit"
                className="brand-btn-primary w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0 transition-opacity hover:opacity-90"
              >
                <Send className="w-3.5 h-3.5 text-[var(--brand-btn-text)]" />
              </button>
            </form>
          </div>
        </div>
      </Reveal>

      {/* Bottom bar */}
      <div className="relative max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-neutral-text/40 border-t border-muted-border/10 pt-6">
        <p>
          © 2026 {t.nav.brandName} ({t.nav.brandSub}). {t.footer.rights}
        </p>
        <div className="flex items-center gap-4">
          <p>{t.footer.madeIn}</p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label={t.footer.backToTop}
            className="w-9 h-9 rounded-xl border border-muted-border/30 flex items-center justify-center text-neutral-text/60 hover:text-accent hover:border-accent/80 hover:bg-accent/15 transition cursor-pointer"
            title={t.footer.backToTop}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};
