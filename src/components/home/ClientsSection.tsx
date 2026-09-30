import React from 'react';
import { Handshake, Building2, ExternalLink } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useLanguage } from '../../hooks/useLanguage';
import { useCmsContent } from '../../hooks/useCmsContent';
import { useCmsText } from '../../hooks/useCmsText';
import { useCmsContact } from '../../hooks/useCmsContact';

export const ClientsSection: React.FC = () => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const { content } = useCmsContent();
  const { text } = useCmsText();
  const { whatsappHref } = useCmsContact();

  const section = content.home.clientsSection;
  const clients = content.clients;

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden" id="clients">
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[300px] bg-accent/6 blur-[120px] rounded-full pointer-events-none -z-10"
      />
      <div
        aria-hidden
        className="absolute bottom-10 right-1/4 w-[400px] h-[250px] bg-gold/6 blur-[110px] rounded-full pointer-events-none -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <Reveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-xs font-bold brand-badge px-4 py-2 rounded-full mb-4">
              <Handshake className="w-3.5 h-3.5 text-accent" />
              {text(section.badgeAr, section.badgeEn) || t.clients?.badge}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-heading tracking-tight leading-tight">
              {text(section.titleAr, section.titleEn) || t.clients?.title}
            </h2>
            <p className="mt-4 text-sm sm:text-base text-neutral-text/75 leading-relaxed">
              {text(section.descAr, section.descEn) || t.clients?.desc}
            </p>
          </div>
        </Reveal>

        {/* Clients Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
          {clients.map((client, idx) => (
            <Reveal key={client.id} delay={idx * 80}>
              <div className="group relative h-full flex flex-col items-center justify-between p-4 sm:p-5 rounded-2xl bg-surface/80 hover:bg-surface border border-muted-border/40 hover:border-accent/40 transition-all duration-300 hover:-translate-y-0.5 text-center">
                {/* Logo Display Canvas (High-contrast clean card for crisp logo rendering) */}
                <div className="w-full h-24 sm:h-28 rounded-xl bg-white p-3 flex items-center justify-center overflow-hidden border border-slate-100 group-hover:border-accent/20 transition-all">
                  <img
                    src={client.logo}
                    alt={text(client.nameAr, client.nameEn)}
                    className="max-h-full max-w-full object-contain transition-opacity duration-300 group-hover:opacity-90"
                    loading="lazy"
                  />
                </div>

                {/* Client Information */}
                <div className="mt-3.5 w-full">
                  <h3 className="text-xs sm:text-sm font-bold text-heading group-hover:text-accent transition-colors line-clamp-1">
                    {text(client.nameAr, client.nameEn)}
                  </h3>
                  <p className="text-[11px] text-neutral-text/60 mt-0.5 line-clamp-1">
                    {text(client.sectorAr, client.sectorEn)}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Corporate Trust Badge */}
        <Reveal delay={300}>
          <div className="mt-14 p-5 sm:p-6 rounded-2xl bg-surface/60 border border-muted-border/30 max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-start">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-heading">
                  {isAr ? 'شراكات استراتيجية طويلة الأمد' : 'Long-term Strategic Partnerships'}
                </h4>
                <p className="text-xs text-neutral-text/70">
                  {isAr
                    ? 'نوفر بيئات عمل ومواقع تجارية ولوجستية تلبي أدق المعايير العالمية لكبرى الشركات.'
                    : 'Providing logistics and commercial environments that meet the highest standards for leading enterprises.'}
                </p>
              </div>
            </div>

            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="brand-btn-secondary text-xs font-bold px-4 py-2.5 rounded-xl shrink-0 inline-flex items-center gap-2 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
              >
                <span>{isAr ? 'انضم لشركائنا' : 'Partner With Us'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
};
