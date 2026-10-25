import React from 'react';
import { useCmsContent } from '../../hooks/useCmsContent';
import { useCmsText } from '../../hooks/useCmsText';

interface CtaSectionProps {
  onBook: () => void;
  onContact: () => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onBook, onContact }) => {
  const { content } = useCmsContent();
  const { text } = useCmsText();
  const cta = content.home.cta;

  return (
    <section className="relative py-14 sm:py-24 overflow-hidden my-8 sm:my-12 border-y border-muted-border/20">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 to-canvas" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 leading-tight">
          {text(cta.titleAr, cta.titleEn)}{' '}
          <span className="brand-gradient-text">{text(cta.titleHighlightAr, cta.titleHighlightEn)}</span>
        </h2>
        <p className="text-neutral-text/75 text-xs sm:text-base max-w-xl mx-auto mb-6 sm:mb-8 leading-relaxed font-medium">
          {text(cta.descAr, cta.descEn)}
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 w-full max-w-sm sm:max-w-none mx-auto">
          <button
            onClick={onBook}
            className="w-full sm:w-auto brand-btn-primary font-bold text-xs sm:text-sm px-8 py-3.5 sm:py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {text(cta.primaryBtnTextAr, cta.primaryBtnTextEn)}
          </button>
          <button
            onClick={onContact}
            className="w-full sm:w-auto brand-btn-secondary font-bold text-xs sm:text-sm px-8 py-3.5 sm:py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            {text(cta.secondaryBtnTextAr, cta.secondaryBtnTextEn)}
          </button>
        </div>
      </div>
    </section>
  );
};
