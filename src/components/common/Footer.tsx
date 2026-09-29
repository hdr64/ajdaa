import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { useLanguage } from '../../hooks/useLanguage';
import { newsletterService } from '../../services/newsletterService';
import { getErrorMessage } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { useSiteSettings, whatsappUrl } from '../../hooks/useSiteSettings';
import { SOCIAL_KEYS } from '../../services/settingsService';
import { SOCIAL_ICONS } from './socialIcons';

import logoArLight from '../../assets/logos/ar-1.png';
import logoArDark from '../../assets/logos/ar-2.png';
import logoEnLight from '../../assets/logos/en-1.png';
import logoEnDark from '../../assets/logos/en-2.png';

interface FooterProps {
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
  onToast: (msg: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onToast }) => {
  const { t, isRTL, language } = useLanguage();
  const { theme } = useTheme();
  const { settings } = useSiteSettings();
  const address = language === 'ar' ? settings.addressAr : settings.addressEn;
  const hours = language === 'ar' ? settings.hoursAr : settings.hoursEn;
  const whatsappHref = whatsappUrl(settings.whatsapp);

  const activeSocials = SOCIAL_KEYS.map((key) => {
    const href = settings.socials[key];
    const icon = SOCIAL_ICONS[key];
    return { key, href, label: icon.label, path: icon.path };
  }).filter((s) => Boolean(s.href && s.href.trim()));

  const [newsletterEmail, setNewsletterEmail] = useState('');

  const isDark = theme === 'dark';
  const logoSrc = isDark
    ? language === 'ar'
      ? logoArDark
      : logoEnDark
    : language === 'ar'
    ? logoArLight
    : logoEnLight;

  const [subscribing, setSubscribing] = useState(false);
  const [startedAt] = useState<number>(() => Date.now());
  const [website, setWebsite] = useState('');

  // Stores the subscriber (it used to only show the toast and drop the email).
  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim();
    if (!email || subscribing) return;

    // Spam protection check (honeypot or submission faster than 2 seconds)
    const isHoneypot = Boolean(website && website.trim().length > 0);
    const isTooFast = Date.now() - startedAt < 2000;
    if (isHoneypot || isTooFast) {
      onToast(t.footer.newsletterSuccess);
      setNewsletterEmail('');
      return;
    }
    setSubscribing(true);
    try {
      await newsletterService.subscribe(email, language === 'en' ? 'en' : 'ar', 'footer', {
        website,
        elapsedMs: Date.now() - startedAt,
      });
      onToast(t.footer.newsletterSuccess);
      setNewsletterEmail('');
    } catch (error) {
      onToast(getErrorMessage(error, language === 'ar' ? 'تعذر الاشتراك، تحقق من البريد الإلكتروني' : 'Could not subscribe, please check the email'));
    } finally {
      setSubscribing(false);
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
            {activeSocials.length > 0 && (
              <div className="flex items-center gap-2.5">
                {activeSocials.map((social) => (
                  <a
                    key={social.key}
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
            )}
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
              {address && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-accent shrink-0" />
                  <span>{address}</span>
                </div>
              )}

              {/* Direct WhatsApp Contact */}
              {whatsappHref && (
                <a
                  href={whatsappHref}
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
                  {settings.phone ? <span dir="ltr">{settings.phone}</span> : null}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                    {language === 'ar' ? 'واتساب مباشر' : 'Direct WhatsApp'}
                  </span>
                </a>
              )}

              {settings.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-accent transition" dir="ltr">
                    {settings.email}
                  </a>
                </div>
              )}

              {hours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent shrink-0" />
                  <span>{hours}</span>
                </div>
              )}
            </div>

            <h4 className="text-sm font-bold text-heading mb-3">{t.footer.newsletterTitle}</h4>
            <form
              onSubmit={handleNewsletterSubmit}
              className="relative flex items-center gap-2 bg-surface/80 border border-muted-border/40 rounded-xl p-1.5 focus-within:border-accent transition shadow-xs"
            >
              {/* Honeypot field for bot spam prevention */}
              <div
                className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none"
                aria-hidden="true"
                tabIndex={-1}
              >
                <label htmlFor="newsletter-website">Website</label>
                <input
                  id="newsletter-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
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
