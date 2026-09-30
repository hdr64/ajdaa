import React, { useState } from 'react';
import { Mail, MapPin, Clock, Send, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Reveal } from './Reveal';
import { useLanguage } from '../../hooks/useLanguage';
import { newsletterService } from '../../services/newsletterService';
import { getErrorMessage } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { whatsappUrl } from '../../hooks/useSiteSettings';
import { useCmsContent } from '../../hooks/useCmsContent';
import { useCmsText } from '../../hooks/useCmsText';
import { SOCIAL_ICONS } from './socialIcons';
import type { NavPageKey } from './Navbar';

import logoArLight from '../../assets/logos/ar-1.png';
import logoArDark from '../../assets/logos/ar-2.png';
import logoEnLight from '../../assets/logos/en-1.png';
import logoEnDark from '../../assets/logos/en-2.png';

/** Only these nav targets stay inside the single-page shell. */
const FOOTER_ROUTES: readonly NavPageKey[] = ['home', 'works', 'clients', 'booking', 'contact'];

interface FooterProps {
  onNavigate: (page: NavPageKey) => void;
  onToast: (msg: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onToast }) => {
  const { t, isRTL, language } = useLanguage();
  const { theme } = useTheme();
  const { content } = useCmsContent();
  const { text, list } = useCmsText();
  const footer = content.footer;

  const address = text(footer.addressAr, footer.addressEn);
  const hours = text(footer.hoursAr, footer.hoursEn);
  const phone = footer.phone.trim();
  const email = footer.email.trim();
  const whatsappHref = footer.whatsappEnabled ? whatsappUrl(footer.whatsapp) : null;

  const activeSocials = footer.socials
    .filter((social) => social.enabled && social.url.trim())
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((social) => ({ ...social, icon: SOCIAL_ICONS[social.icon] }));

  /** Quick links follow the admin's nav so the two never drift apart. */
  const quickLinks = content.nav
    .filter((item) => item.enabled && item.page !== 'custom' && FOOTER_ROUTES.includes(item.page as NavPageKey))
    .slice()
    .sort((a, b) => a.order - b.order);

  const serviceLinks = list(footer.servicesListAr, footer.servicesListEn);

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
              {text(footer.brandDescAr, footer.brandDescEn)}
            </p>
            {activeSocials.length > 0 && (
              <div className="flex items-center gap-2.5">
                {activeSocials.map((social) => (
                  <a
                    key={social.id}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name || social.icon.label}
                    title={social.name || social.icon.label}
                    className="w-9 h-9 rounded-full border border-muted-border/30 flex items-center justify-center text-neutral-text/70 hover:text-accent hover:border-accent/80 hover:bg-accent/15 social-icon-glow cursor-pointer transition-all hover:scale-105"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d={social.icon.path} />
                    </svg>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Navigation Links */}
          <div>
            <h4 className="text-sm font-bold text-heading mb-5">{text(footer.quickLinksTitleAr, footer.quickLinksTitleEn)}</h4>
            <div className="flex flex-col gap-3 text-xs text-neutral-text/70">
              {quickLinks.map((link) => {
                const Chevron = isRTL ? ChevronLeft : ChevronRight;
                return (
                  <button
                    key={link.id}
                    onClick={() => onNavigate(link.page as NavPageKey)}
                    className="flex items-center gap-1.5 text-start hover:text-accent transition cursor-pointer group font-semibold"
                  >
                    <Chevron
                      className={`w-3.5 h-3.5 text-accent/70 ${
                        isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'
                      } transition-transform duration-300`}
                    />
                    {text(link.labelAr, link.labelEn)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="text-sm font-bold text-heading mb-5">{text(footer.servicesTitleAr, footer.servicesTitleEn)}</h4>
            <div className="flex flex-col gap-3 text-xs text-neutral-text/70">
              {serviceLinks.map((service) => {
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
              {footer.addressEnabled && address && (
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
                    <path d={SOCIAL_ICONS.whatsapp.path} />
                  </svg>
                  {footer.phoneEnabled && phone ? <span dir="ltr">{phone}</span> : null}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30">
                    {language === 'ar' ? 'واتساب مباشر' : 'Direct WhatsApp'}
                  </span>
                </a>
              )}

              {footer.emailEnabled && email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent shrink-0" />
                  <a href={`mailto:${email}`} className="hover:text-accent transition" dir="ltr">
                    {email}
                  </a>
                </div>
              )}

              {footer.hoursEnabled && hours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent shrink-0" />
                  <span>{hours}</span>
                </div>
              )}
            </div>

            {footer.newsletterEnabled && (
              <>
                <h4 className="text-sm font-bold text-heading mb-3">{text(footer.newsletterTitleAr, footer.newsletterTitleEn)}</h4>
                <p className="text-xs text-neutral-text/60 leading-relaxed mb-4">
                  {text(footer.newsletterDescAr, footer.newsletterDescEn)}
                </p>
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
                    aria-label={text(footer.newsletterTitleAr, footer.newsletterTitleEn)}
                    className="flex-1 bg-transparent text-xs text-neutral-text placeholder:text-neutral-text/50 px-2 outline-none min-w-0"
                  />
                  <button
                    type="submit"
                    className="brand-btn-primary w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0 transition-opacity hover:opacity-90"
                  >
                    <Send className="w-3.5 h-3.5 text-[var(--brand-btn-text)]" />
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </Reveal>

      {/* Bottom bar */}
      <div className="relative max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-neutral-text/40 border-t border-muted-border/10 pt-6">
        <p>
          © 2026 {t.nav.brandName} ({t.nav.brandSub}). {text(footer.copyrightAr, footer.copyrightEn)}
        </p>
        <div className="flex items-center gap-4">
          <p>{text(footer.madeInKsaAr, footer.madeInKsaEn)}</p>
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
