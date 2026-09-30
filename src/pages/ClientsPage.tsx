import React from 'react';
import { Handshake, Building2, CheckCircle2, Award, TrendingUp, ArrowLeft, ArrowRight, ExternalLink, type LucideIcon } from 'lucide-react';
import { Reveal } from '../components/common/Reveal';
import { useLanguage } from '../hooks/useLanguage';
import { useCmsContent } from '../hooks/useCmsContent';
import { useCmsText } from '../hooks/useCmsText';
import { useCmsContact } from '../hooks/useCmsContact';
import type { NavPageKey } from '../components/common/Navbar';

/**
 * `clientsPage.stats` stores only the numbers and captions, so the glyphs cycle
 * through this set in admin-defined order.
 */
const STAT_ICONS: readonly LucideIcon[] = [Handshake, CheckCircle2, Building2, Award];

interface ClientsPageProps {
  onNavigate: (page: NavPageKey) => void;
}

export const ClientsPage: React.FC<ClientsPageProps> = ({ onNavigate }) => {
  const { isRTL } = useLanguage();
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const { content } = useCmsContent();
  const { text, list } = useCmsText();
  const { whatsappHref } = useCmsContact();

  const page = content.clientsPage;
  const clients = content.clients;
  const stats = page.stats.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="pt-28 sm:pt-36 pb-24 min-h-screen relative">
      {/* Background ambient lighting */}
      <div
        aria-hidden
        className="absolute top-24 left-1/3 -translate-x-1/2 w-[600px] h-[350px] bg-accent/6 blur-[140px] rounded-full pointer-events-none -z-10"
      />
      <div
        aria-hidden
        className="absolute bottom-40 right-1/4 w-[500px] h-[300px] bg-gold/5 blur-[130px] rounded-full pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
            <span className="inline-flex items-center gap-2 text-xs font-bold brand-badge px-4 py-2 rounded-full mb-4">
              <Handshake className="w-3.5 h-3.5 text-accent" />
              {text(page.badgeAr, page.badgeEn)}
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-heading tracking-tight leading-tight">
              {text(page.titleAr, page.titleEn)}
            </h1>
            <p className="mt-4 text-sm sm:text-base text-neutral-text/75 leading-relaxed">
              {text(page.subtitleAr, page.subtitleEn)}
            </p>
          </div>
        </Reveal>

        {/* Stats Grid */}
        {stats.length > 0 && (
          <Reveal>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-20">
              {stats.map((stat, idx) => {
                const Icon = STAT_ICONS[idx % STAT_ICONS.length];
                return (
                  <div
                    key={stat.id}
                    className="rounded-3xl bg-surface/80 border border-muted-border/40 p-6 flex flex-col items-center sm:items-start text-center sm:text-start gap-3"
                  >
                    <div className="w-11 h-11 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-2xl sm:text-3xl font-black text-heading brand-gradient-text">
                      {text(stat.valueAr, stat.valueEn)}
                    </span>
                    <span className="text-xs font-semibold text-neutral-text/70 leading-relaxed">
                      {text(stat.labelAr, stat.labelEn)}
                    </span>
                  </div>
                );
              })}
            </div>
          </Reveal>
        )}

        {/* Clients In-depth Cards */}
        <div className="mb-20">
          <div className="flex items-center justify-between gap-4 mb-8">
            <h2 className="text-xl sm:text-2xl font-black text-heading flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-accent" />
              <span>{text('قائمة الشركاء الاستراتيجيين', 'Strategic Partners Directory')}</span>
            </h2>
            <span className="text-xs text-neutral-text/60 font-semibold">
              {`${clients.length} ${text('شركاء معتمدين', 'Accredited Partners')}`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client, idx) => {
              const tags = list(client.tagsAr, client.tagsEn);
              return (
                <Reveal key={client.id} delay={idx * 80}>
                  <div className="h-full rounded-3xl bg-surface/80 border border-muted-border/40 hover:border-accent/40 p-6 flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1 shadow-xs hover:shadow-md">
                    <div>
                      {/* Logo container */}
                      <div className="w-full h-32 rounded-2xl bg-white p-4 flex items-center justify-center border border-slate-100 mb-6 group-hover:border-accent/20 transition-all">
                        <img
                          src={client.logo}
                          alt={text(client.nameAr, client.nameEn)}
                          className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>

                      {/* Sector Badge */}
                      <span className="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 mb-3">
                        {text(client.sectorAr, client.sectorEn)}
                      </span>

                      {/* Client Name */}
                      <h3 className="text-base sm:text-lg font-black text-heading group-hover:text-accent transition-colors mb-2">
                        {text(client.nameAr, client.nameEn)}
                      </h3>

                      {/* Description */}
                      <p className="text-xs text-neutral-text/70 leading-relaxed mb-6">
                        {text(client.descAr, client.descEn)}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="border-t border-muted-border/30 pt-4 flex flex-wrap gap-1.5">
                      {tags.map((tag, tIdx) => (
                        <span
                          key={`${client.id}-${tIdx}`}
                          className="text-[10px] font-semibold px-2.5 py-0.5 rounded-lg bg-surface border border-muted-border/40 text-neutral-text/60"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        {/* Partnership Call to Action Banner */}
        <Reveal delay={200}>
          <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 border border-accent/30 brand-hero-mesh text-center sm:text-start flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-full bg-accent/20 text-accent border border-accent/40 mb-3">
                <TrendingUp className="w-3.5 h-3.5" />
                {text('فرص شراكة واستثمار', 'Partnership & Investment')}
              </span>
              <h3 className="text-2xl sm:text-3xl font-black text-heading">
                {text(page.ctaTitleAr, page.ctaTitleEn)}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-text/75 mt-2 leading-relaxed">
                {text(page.ctaSubtitleAr, page.ctaSubtitleEn)}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={() => onNavigate('contact')}
                className="w-full sm:w-auto brand-btn-primary font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
              >
                <span>{text(page.ctaButtonTextAr, page.ctaButtonTextEn)}</span>
                <ArrowIcon className="w-4 h-4" />
              </button>
              {whatsappHref && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto brand-btn-secondary font-bold text-xs sm:text-sm px-6 py-3.5 rounded-full flex items-center justify-center gap-2"
                >
                  <span>{text('واتساب مباشر', 'WhatsApp Us')}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
};
