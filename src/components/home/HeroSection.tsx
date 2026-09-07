import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Building2, ChevronDown, ArrowLeft, CalendarCheck, Sparkles, ShieldCheck } from 'lucide-react';
import { HeroScene } from './HeroScene';
import heroImage from '../../assets/imgs/bg.webp';

interface HeroSectionProps {
  onExplore: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onBook: () => void;
}

const CITIES = ['الكل', 'الرياض', 'الأحساء', 'جدة', 'الدمام', 'الخبر'];
const TYPES = ['الكل', 'مستودعات ومشاريع لوجستية', 'محلات ومجمعات تجارية', 'مكاتب ومباني إدارية', 'فلل سكنية'];

export const HeroSection: React.FC<HeroSectionProps> = ({ onExplore, onBook }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Search state
  const [selectedCity, setSelectedCity] = useState('الكل');
  const [selectedType, setSelectedType] = useState('الكل');
  const [selectedPriceType, setSelectedPriceType] = useState<'all' | 'بيع' | 'إيجار' | 'استثمار'>('all');

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

  const handleSearchSubmit = () => {
    onExplore({
      city: selectedCity,
      type: selectedType,
      priceType: selectedPriceType,
    });
  };

  // On mobile/tablets, disable scroll fade to prevent content disappearing while user scrolls within hero
  const contentStyle = (!isDesktop || reducedMotion)
    ? undefined
    : {
        opacity: Math.max(1 - scrollProgress * 1.25, 0),
        transform: `translate3d(0, ${-scrollProgress * 50}px, 0)`,
        willChange: 'transform, opacity' as const,
      };

  return (
    <section ref={sectionRef} className="relative min-h-[90vh] sm:min-h-screen overflow-hidden flex flex-col justify-end">
      {/* Background Image with Rich Vibrant Gradient Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={heroImage}
          alt="أجدا العقارية"
          className="w-full h-full object-cover scale-105 filter brightness-95 contrast-150"
        />
      </div>

      {/* Layered Gradient Overlay for High Contrast & Luxury Aesthetic */}
      <div className="absolute inset-0 z-1 bg-gradient-to-t from-canvas via-canvas/75 to-canvas/40 sm:to-canvas/30 pointer-events-none" />
      <div className="absolute inset-0 z-1 bg-gradient-to-r from-canvas/40 via-canvas/30 to-transparent pointer-events-none" />
      <div className="hero-grid absolute inset-0 z-1 opacity-20 sm:opacity-30 pointer-events-none" />

      {/* Lightweight Ambient Glow Scene */}
      <HeroScene className="absolute inset-0 z-2" />

      {/* Main Hero Content */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 w-full flex flex-col justify-end pt-24 sm:pt-36 pb-12 sm:pb-20"
        style={contentStyle}
      >
        <div className="lg:max-w-3xl text-right">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full brand-badge text-[11px] sm:text-xs font-bold w-fit mb-4 sm:mb-7 hero-reveal shadow-xl shadow-accent/15 border border-accent/30 max-w-full"
            style={{ animationDelay: '150ms' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="text-neutral-text truncate">أجدا العقارية · ريادة المشاريع اللوجستية والتجارية</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.25] sm:leading-[1.15] tracking-tight">
            <span className="block text-heading hero-reveal" style={{ animationDelay: '300ms' }}>
              نعيد تعريف العقار…
            </span>
            <span
              className="block brand-gradient-text hero-reveal mt-1 sm:mt-2"
              style={{ animationDelay: '500ms' }}
            >
              مشروعًا، وقيمة، وتجربة.
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-neutral-text/85 text-sm sm:text-lg max-w-2xl mt-4 sm:mt-6 leading-relaxed hero-reveal font-medium"
            style={{ animationDelay: '650ms' }}
          >
            في “أجدا العقارية” نمزج بين الرؤية الاستراتيجية والتنفيذ المتقن لنبتكر أضخم المشاريع اللوجستية كالمستودعات والمخازن، والمحلات والمجمعات التجارية، والأبنية الإدارية.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-9 hero-reveal"
            style={{ animationDelay: '750ms' }}
          >
            <button
              onClick={() => onExplore()}
              className="w-full sm:w-auto brand-btn-primary font-black px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl inline-flex items-center justify-center gap-2.5 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer shadow-xl shadow-accent/25"
            >
              استعرض مشاريع أجدى
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onBook}
              className="w-full sm:w-auto brand-btn-secondary font-bold px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl inline-flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
            >
              <CalendarCheck className="w-5 h-5 text-accent" />
              حجز موعد استشارة
            </button>
          </div>
        </div>

        {/* Quick Property Search Engine Box */}
        <div className="mt-8 sm:mt-12 lg:max-w-3xl hero-reveal" style={{ animationDelay: '850ms' }}>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 relative overflow-hidden border border-accent/30 shadow-2xl shadow-black/25 backdrop-blur-xl">
            <div className="search-shine" aria-hidden="true" />

            {/* Opportunity Type Tabs */}
            <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2.5 sm:pb-3 border-b border-muted-border/20">
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 w-full sm:w-auto">
                <span className="text-[11px] sm:text-xs font-bold text-neutral-text/60 shrink-0 ml-1 sm:ml-2">نوع الفرصة:</span>
                {(['all', 'إيجار', 'استثمار', 'بيع'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedPriceType(mode)}
                    className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
                      selectedPriceType === mode
                        ? 'brand-fill shadow-md'
                        : 'bg-surface/50 text-neutral-text/70 hover:text-heading hover:bg-surface-hover'
                    }`}
                  >
                    {mode === 'all' ? 'الكل' : mode === 'إيجار' ? 'تأجير' : mode === 'استثمار' ? 'استثمار' : 'بيع'}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gold font-bold shrink-0">
                <ShieldCheck className="w-4 h-4" />
                مشاريع معتمدة ومضمونة
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <label className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent-light mb-1 sm:mb-1.5 px-1">
                  <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                  المدينة
                </span>
                <div className="field-shell min-h-[44px]">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="field-select font-semibold"
                    aria-label="المدينة"
                  >
                    {CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-neutral-text/40 pointer-events-none shrink-0" />
                </div>
              </label>

              <label className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent-light mb-1 sm:mb-1.5 px-1">
                  <Building2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  نوع العقار
                </span>
                <div className="field-shell min-h-[44px]">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="field-select font-semibold"
                    aria-label="نوع العقار"
                  >
                    {TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-neutral-text/40 pointer-events-none shrink-0" />
                </div>
              </label>

              <div className="flex items-end mt-1 sm:mt-0">
                <button
                  onClick={handleSearchSubmit}
                  className="w-full brand-btn-primary font-black text-xs sm:text-sm py-3.5 sm:py-3 px-6 rounded-xl inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition duration-300 cursor-pointer shadow-lg shadow-accent/20 min-h-[44px]"
                >
                  <Search className="w-4 h-4" />
                  البحث عن العقار
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 sm:mt-10 lg:max-w-2xl hero-reveal" style={{ animationDelay: '950ms' }}>
          <div className="glass-card rounded-2xl p-3 sm:p-5 grid grid-cols-3 gap-1 sm:gap-2 border border-muted-border/30">
            <div className="text-center px-1">
              <div className="brand-gradient-text text-xl sm:text-3xl lg:text-4xl font-black">+500</div>
              <div className="text-[10px] sm:text-xs font-semibold text-neutral-text/60 mt-1 leading-tight">وحدة عقارية</div>
            </div>
            <div className="text-center border-s border-muted-border/30 px-1">
              <div className="brand-gradient-text text-xl sm:text-3xl lg:text-4xl font-black">+1,200</div>
              <div className="text-[10px] sm:text-xs font-semibold text-neutral-text/60 mt-1 leading-tight">مستثمر وعميل</div>
            </div>
            <div className="text-center border-s border-muted-border/30 px-1">
              <div className="brand-gradient-text text-xl sm:text-3xl lg:text-4xl font-black">+15</div>
              <div className="text-[10px] sm:text-xs font-semibold text-neutral-text/60 mt-1 leading-tight">مشروع استراتيجي</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
