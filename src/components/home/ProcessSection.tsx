import React from 'react';
import { Route, Search } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useCmsContent } from '../../hooks/useCmsContent';
import { useCmsText } from '../../hooks/useCmsText';
import { resolveCmsIcon } from '../common/cmsIcons';

export const ProcessSection: React.FC = () => {
  const { content } = useCmsContent();
  const { text } = useCmsText();
  const section = content.home.process;

  return (
    <section className="relative overflow-hidden py-24 max-w-7xl mx-auto px-6">
      <div
        aria-hidden
        className="absolute top-1/3 right-0 w-[420px] h-[320px] bg-gold/4 blur-[120px] rounded-full pointer-events-none"
      />

      <div className="relative text-center mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <Route className="w-3.5 h-3.5 text-accent-light" />
          {text(section.badgeAr, section.badgeEn)}
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          {text(section.titleAr, section.titleEn)}{' '}
          <span className="brand-gradient-text">{text(section.titleHighlightAr, section.titleHighlightEn)}</span>
        </h2>
        <p className="text-sm md:text-base text-neutral-text/75 max-w-xl mx-auto mt-4 leading-relaxed">
          {text(section.descAr, section.descEn)}
        </p>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6">
        <div
          aria-hidden
          className="absolute top-7 inset-x-12 hidden lg:block h-px bg-gradient-to-r from-accent/0 via-accent/30 to-accent/0"
        />

        {section.steps.map((step, i) => {
          const Icon = resolveCmsIcon(step.icon, Search);
          return (
            <Reveal key={step.id} delay={i * 130} direction="up" className="h-full">
              <div className="relative h-full flex flex-col items-center text-center px-4">
                <div className="relative z-10 w-13 h-13 rounded-full brand-fill flex items-center justify-center text-lg font-black border border-white/20 mb-6">
                  {i + 1}
                </div>
                <div className="w-13 h-13 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent mb-5 transition-colors duration-300">
                  <Icon className="w-5.5 h-5.5" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-heading">
                  {text(step.titleAr, step.titleEn)}
                </h3>
                <p className="text-xs text-neutral-text/75 leading-relaxed">
                  {text(step.descAr, step.descEn)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};