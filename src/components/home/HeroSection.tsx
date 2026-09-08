import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { HeroScene } from './HeroScene';
import { useLanguage } from '../../hooks/useLanguage';
import heroImage from '../../assets/imgs/a1.webp';

interface HeroSectionProps {
  onExplore: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onBook?: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onExplore }) => {
  const { t, isRTL } = useLanguage();
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 1024);
      setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);

    const el = sectionRef.current;
    if (!el) return;

    let rafId = 0;
    const update = () => {
      const total = el.offsetHeight || 1;
      setScrollProgress(Math.min(Math.max(-el.getBoundingClientRect().top / total, 0), 1));
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', checkViewport);
    };
  }, []);

  // On mobile/tablets, disable scroll fade to prevent content disappearing while user scrolls within hero
  const contentStyle = (!isDesktop || reducedMotion)
    ? undefined
    : {
        opacity: Math.max(1 - scrollProgress * 1.25, 0),
        transform: `translate3d(0, ${-scrollProgress * 50}px, 0)`,
        willChange: 'transform, opacity' as const,
      };

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section ref={sectionRef} className="relative min-h-[90vh] sm:min-h-screen overflow-hidden flex flex-col justify-end">
      {/* Background Image with Crisp Clarity */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={heroImage}
          alt={t.nav.brandName}
          className="w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.04]"
        />
      </div>

      {/* Multi-layered responsive gradient overlay */}
      {/* Bottom up gradient: gentle transition into the page canvas */}
      <div className="hero-scrim-gradient absolute inset-0 z-1 pointer-events-none" />
      {/* Top subtle vignette for clean navbar isolation */}
      <div className="absolute inset-x-0 top-0 h-28 sm:h-36 z-1 bg-gradient-to-b from-canvas/80 via-canvas/30 to-transparent pointer-events-none" />
      <div className="hero-grid absolute inset-0 z-1 opacity-10 sm:opacity-15 pointer-events-none" />

      {/* Lightweight Ambient Glow Scene */}
      <HeroScene className="absolute inset-0 z-2" />

      {/* Main Hero Content */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full flex flex-col justify-end pt-28 sm:pt-36 pb-10 sm:pb-24"
        style={contentStyle}
      >
        <div className="lg:max-w-3xl text-start">
          {/* Frosted glass container on mobile for pristine contrast & luxury aesthetics */}
          <div className="p-5 xs:p-7 sm:p-0 rounded-3xl sm:rounded-none hero-glass-panel- bg-none! sm:bg-transparent sm:backdrop-blur-none sm:border-0 sm:shadow-none transition-all">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full brand-badge text-[11px] sm:text-xs font-bold w-fit mb-3.5 sm:mb-7 hero-reveal border border-accent/40 max-w-full"
              style={{ animationDelay: '150ms' }}
            >
              <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
              <span className="text-neutral-text truncate">{t.hero.badge}</span>
            </div>

            {/* Headline */}
            <h1 className="text-2xl xs:text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.25] sm:leading-[1.15] tracking-tight">
              <span className="block text-heading hero-reveal" style={{ animationDelay: '300ms' }}>
                {t.hero.titleLine1}
              </span>
              <span
                className="block brand-gradient-text hero-reveal mt-1 sm:mt-2"
                style={{ animationDelay: '500ms' }}
              >
                {t.hero.titleLine2}
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-neutral-text/90 text-xs xs:text-sm sm:text-base lg:text-lg max-w-2xl mt-3.5 sm:mt-6 leading-relaxed hero-reveal font-medium"
              style={{ animationDelay: '650ms' }}
            >
              {t.hero.subtitle}
            </p>

            {/* CTAs */}
            <div
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-5 sm:mt-9 hero-reveal"
              style={{ animationDelay: '750ms' }}
            >
              <button
                onClick={() => onExplore()}
                className="w-full sm:w-auto brand-btn-primary font-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl inline-flex items-center justify-center gap-2.5 transition-all duration-300 cursor-pointer text-xs xs:text-sm sm:text-base"
              >
                <span>{t.hero.exploreBtn}</span>
                <ArrowIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              {/* <button
                onClick={onBook}
                className="w-full sm:w-auto brand-btn-secondary font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl inline-flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer text-xs xs:text-sm sm:text-base"
              >
                <CalendarCheck className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                <span>{t.hero.consultBtn}</span>
              </button> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
