import React from 'react';
import ctaBg from '../../assets/imgs/5.webp';

interface CtaSectionProps {
  onBook: () => void;
  onContact: () => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onBook, onContact }) => {
  return (
    <section className="relative py-24 overflow-hidden my-12 border-y border-muted-border/20">
      <div className="absolute inset-0 z-0">
        <img
          src={ctaBg}
          alt="عقارات المملكة"
          className="w-full h-full object-cover opacity-15"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/80 to-canvas" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
          جاهز لإيجار أو <span className="brand-gradient-text">شراء عقارك؟</span>
        </h2>
        <p className="text-neutral-text/75 text-sm md:text-base max-w-xl mx-auto mb-8 leading-relaxed">
          تواصل معنا اليوم ودعنا نساعدك في إيجاد العقار المثالي الذي يلبي جميع احتياجاتك الاستثمارية والسكنية.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onBook}
            className="brand-btn-primary font-bold text-xs md:text-sm px-8 py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            احجز عقارك الآن
          </button>
          <button
            onClick={onContact}
            className="brand-btn-secondary font-bold text-xs md:text-sm px-8 py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
          >
            تواصل معنا
          </button>
        </div>
      </div>
    </section>
  );
};
