import React from 'react';
import { Phone, Mail, Wrench, Lock } from 'lucide-react';
import { useSiteSettings, whatsappUrl } from '../../hooks/useSiteSettings';
import { useLanguage } from '../../hooks/useLanguage';
import { useTheme } from '../../hooks/useTheme';
import { BackgroundDecor } from './BackgroundDecor';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

import logoArLight from '../../assets/logos/ar-1.png';
import logoArDark from '../../assets/logos/ar-2.png';
import logoEnLight from '../../assets/logos/en-1.png';
import logoEnDark from '../../assets/logos/en-2.png';

interface MaintenanceScreenProps {
  onAdminLogin: () => void;
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ onAdminLogin }) => {
  const { settings } = useSiteSettings();
  const { language, isRTL } = useLanguage();
  const { theme } = useTheme();

  const isAr = language === 'ar';
  const isDark = theme === 'dark';
  const logoSrc = isDark
    ? (isAr ? logoArDark : logoEnDark)
    : (isAr ? logoArLight : logoEnLight);

  const rawMsg = isAr ? settings.maintenance.messageAr : settings.maintenance.messageEn;
  const fallbackMsg = isAr ? settings.maintenance.messageEn : settings.maintenance.messageAr;
  const defaultMsg = isAr
    ? 'الموقع قيد الصيانة المجدولة حالياً لتحسين وتطوير خدماتنا. سنعود قريباً بإذن الله.'
    : 'Our site is currently undergoing scheduled maintenance to improve our services. We will be back shortly.';
  const displayMsg = (rawMsg && rawMsg.trim()) || (fallbackMsg && fallbackMsg.trim()) || defaultMsg;

  const whatsappHref = (settings.whatsapp && whatsappUrl(settings.whatsapp)) || '';
  const hasPhone = Boolean(settings.phone && settings.phone.trim());
  const hasWhatsapp = Boolean(whatsappHref);
  const hasEmail = Boolean(settings.email && settings.email.trim());
  const hasAnyContact = hasPhone || hasWhatsapp || hasEmail;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-canvas flex flex-col justify-between items-center relative overflow-hidden transition-colors duration-300 p-4 sm:p-6"
    >
      <BackgroundDecor />

      {/* Top Header with Language & Theme Controls */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2 sm:py-4 relative z-20">
        <div className="flex items-center">
          <img
            src={logoSrc}
            alt={isAr ? 'أجدا العقارية' : 'Ajda Real Estate'}
            className="h-8 sm:h-10 w-auto object-contain navbar-logo select-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LanguageToggle />
        </div>
      </header>

      {/* Main Centered Content Card */}
      <main className="w-full max-w-lg my-auto py-6 relative z-10">
        <div className="glass-card rounded-3xl border border-muted-border/30 p-6 sm:p-10 text-center shadow-xl relative overflow-hidden">
          {/* Ambient Brand Glow */}
          <div className="brand-glow z-0 w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center">
            {/* Maintenance Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-6 shadow-inner">
              <Wrench className="w-8 h-8 animate-pulse" />
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-bold mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>{isAr ? 'وضع الصيانة المجدولة' : 'Scheduled Maintenance'}</span>
            </div>

            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl font-black text-heading mb-4 leading-tight">
              {isAr ? 'نعمل على تحسين الموقع' : 'We Are Upgrading Our Services'}
            </h1>

            {/* Localized Message */}
            <p className="text-sm sm:text-base text-neutral-text/75 leading-relaxed mb-8 max-w-md">
              {displayMsg}
            </p>

            {/* Contact Options (if any are configured) */}
            {hasAnyContact && (
              <div className="w-full pt-6 border-t border-muted-border/25">
                <p className="text-xs font-bold text-neutral-text/60 mb-3.5">
                  {isAr ? 'يمكنكم التواصل معنا مباشرة عبر:' : 'You can reach out to us directly via:'}
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5 w-full">
                  {hasPhone && (
                    <a
                      href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                      className="w-full sm:w-auto flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface/70 hover:bg-surface border border-muted-border/40 hover:border-accent/40 text-heading font-bold text-xs transition-all duration-200 group shadow-xs"
                    >
                      <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <span dir="ltr">{settings.phone}</span>
                    </a>
                  )}

                  {hasWhatsapp && (
                    <a
                      href={whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface/70 hover:bg-surface border border-muted-border/40 hover:border-emerald-500/40 text-heading font-bold text-xs transition-all duration-200 group shadow-xs hover:text-emerald-500"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                      </div>
                      <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                    </a>
                  )}

                  {hasEmail && (
                    <a
                      href={`mailto:${settings.email}`}
                      className="w-full sm:w-auto flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface/70 hover:bg-surface border border-muted-border/40 hover:border-accent/40 text-heading font-bold text-xs transition-all duration-200 group shadow-xs"
                    >
                      <div className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Mail className="w-3.5 h-3.5" />
                      </div>
                      <span className="truncate max-w-[160px]">{settings.email}</span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Small low-emphasis admin login link */}
            <div className="mt-8 pt-4 border-t border-muted-border/20 w-full flex items-center justify-center">
              <a
                href="/admin/login"
                onClick={(e) => {
                  e.preventDefault();
                  onAdminLogin();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-neutral-text/40 hover:text-accent font-medium py-1 px-3 rounded-lg hover:bg-surface/50 transition-colors cursor-pointer select-none"
              >
                <Lock className="w-3 h-3" />
                <span>{isAr ? 'دخول الإدارة' : 'Admin login'}</span>
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Footer Copyright */}
      <footer className="w-full text-center py-3 relative z-10 text-[11px] text-neutral-text/40">
        © {new Date().getFullYear()} {isAr ? 'شركة أجدا العقارية. جميع الحقوق محفوظة.' : 'Ajda Real Estate. All rights reserved.'}
      </footer>
    </div>
  );
};
