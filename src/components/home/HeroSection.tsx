import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Building2, ChevronDown, ArrowLeft, CalendarCheck, Sparkles, ShieldCheck } from 'lucide-react';
import { HeroScene } from './HeroScene';
import heroImage from '../../assets/imgs/bg.webp'
interface HeroSectionProps {
  onExplore: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onBook: () => void;
}

const CITIES = ['الكل', 'الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر'];
const TYPES = ['الكل', 'فلل', 'شقق', 'مكاتب', 'بيوت'];

export const HeroSection: React.FC<HeroSectionProps> = ({ onExplore, onBook }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Search state
  const [selectedCity, setSelectedCity] = useState('الكل');
  const [selectedType, setSelectedType] = useState('الكل');
  const [selectedPriceType, setSelectedPriceType] = useState<'all' | 'بيع' | 'إيجار'>('all');

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);

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
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, []);

  const handleSearchSubmit = () => {
    onExplore({
      city: selectedCity,
      type: selectedType,
      priceType: selectedPriceType,
    });
  };

  const contentStyle = reducedMotion
    ? undefined
    : {
        opacity: Math.max(1 - scrollProgress * 1.15, 0),
        transform: `translate3d(0, ${-scrollProgress * 60}px, 0)`,
        willChange: 'transform, opacity' as const,
      };

  return (
    <section ref={sectionRef} className="relative min-h-screen overflow-hidden">
      {/* Background Image with Rich Vibrant Gradient Overlay */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          // src="/bg/2.webp"
          src={heroImage}
          alt="أجدا العقارية"
          className="w-full h-full object-cover scale-105 filter brightness-95 contrast-150"
        />
      </div>

      {/* Layered Gradient Overlay for High Contrast & Luxury Aesthetic */}
      <div className="absolute inset-0 z-1 bg-gradient-to-t from-canvas via-canvas/70 to-canvas/30 pointer-events-none" />
      <div className="absolute inset-0 z-1 bg-gradient-to-r from-canvas/20 via-canvas/30 to-transparent pointer-events-none" />
      <div className="hero-grid absolute inset-0 z-1 opacity-30 pointer-events-none" />

      {/* Lightweight Ambient Glow Scene */}
      <HeroScene className="absolute inset-0 z-2" />

      {/* Main Hero Content */}
      <div
        className="relative z-10 max-w-7xl mx-auto px-6 flex flex-col justify-end min-h-screen pt-36 pb-20"
        style={contentStyle}
      >
        <div className="lg:max-w-3xl text-right">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full brand-badge text-xs font-bold w-fit mb-7 hero-reveal shadow-xl shadow-accent/15 border border-accent/30"
            style={{ animationDelay: '150ms' }}
          >
            <Sparkles className="w-4 h-4 text-gold" />
            <span className="text-neutral-text">أجدا العقارية · Ajda Real Estate</span>
          </div>

          {/* Headline provided by User */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.15] tracking-tight">
            <span className="block text-heading hero-reveal" style={{ animationDelay: '300ms' }}>
              نُعيد تعريف العقار…
            </span>
            <span
              className="relative inline-block brand-gradient-text hero-reveal pb-2 mt-1"
              style={{ animationDelay: '450ms' }}
            >
              أجدا العقارية
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-1 sm:h-1.5 rounded-full bg-gradient-to-l from-gold-light via-accent to-transparent"
              />
            </span>
            <span className="block text-2xl sm:text-4xl lg:text-5xl font-extrabold text-neutral-text/90 mt-3 hero-reveal" style={{ animationDelay: '550ms' }}>
              مشروعًا، وقيمة، وتجربة.
            </span>
          </h1>

          {/* Subtitle provided by User */}
          <p
            className="text-neutral-text/85 text-base sm:text-lg max-w-2xl mt-6 leading-relaxed hero-reveal font-medium"
            style={{ animationDelay: '650ms' }}
          >
            في “أجدا العقارية” نمزج بين الرؤية الاستراتيجية والتصميم الذكي لنبتكر مشاريع ترتقي بجودة الحياة وتحقق قيمة استثمارية مستدامة.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap gap-4 mt-9 hero-reveal"
            style={{ animationDelay: '750ms' }}
          >
            <button
              onClick={() => onExplore()}
              className="brand-btn-primary font-black px-8 py-4 rounded-2xl inline-flex items-center gap-2.5 hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer shadow-xl shadow-accent/25"
            >
              استعرض عقارات أجدا
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onBook}
              className="brand-btn-secondary font-bold px-8 py-4 rounded-2xl inline-flex items-center gap-2 hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              <CalendarCheck className="w-5 h-5 text-accent" />
              حجز موعد استشارة
            </button>
          </div>
        </div>

        {/* Quick Property Search Engine Box */}
        <div className="mt-12 lg:max-w-3xl hero-reveal" style={{ animationDelay: '850ms' }}>
          <div className="glass-card rounded-3xl p-5 relative overflow-hidden border border-accent/30 shadow-2xl shadow-black/25 backdrop-blur-xl">
            <div className="search-shine" aria-hidden="true" />

            {/* Price Type Tabs */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-muted-border/20">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-neutral-text/60 ml-2">نوع العقد:</span>
                {(['all', 'بيع', 'إيجار'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedPriceType(mode)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                      selectedPriceType === mode
                        ? 'brand-fill shadow-md'
                        : 'bg-surface/50 text-neutral-text/70 hover:text-heading hover:bg-surface-hover'
                    }`}
                  >
                    {mode === 'all' ? 'الكل' : mode}
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-1.5 text-xs text-gold font-bold">
                <ShieldCheck className="w-4 h-4" />
                مشاريع مرخصة ومضمونة
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent-light mb-1.5 px-1">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  المدينة
                </span>
                <div className="field-shell">
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
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-accent-light mb-1.5 px-1">
                  <Building2 className="w-3.5 h-3.5 text-accent" />
                  نوع العقار
                </span>
                <div className="field-shell">
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

              <div className="flex items-end">
                <button
                  onClick={handleSearchSubmit}
                  className="w-full brand-btn-primary font-black text-sm py-3 px-6 rounded-xl inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition duration-300 cursor-pointer shadow-lg shadow-accent/20"
                >
                  <Search className="w-4 h-4" />
                  البحث عن العقار
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-10 lg:max-w-2xl hero-reveal" style={{ animationDelay: '950ms' }}>
          <div className="glass-card rounded-2xl p-4 sm:p-5 grid grid-cols-3 gap-2 border border-muted-border/30">
            <div className="text-center">
              <div className="brand-gradient-text text-2xl sm:text-4xl font-black">+500</div>
              <div className="text-[11px] sm:text-xs font-semibold text-neutral-text/60 mt-1">وحدة سكنية وتجارية</div>
            </div>
            <div className="text-center border-s border-muted-border/30">
              <div className="brand-gradient-text text-2xl sm:text-4xl font-black">+1,200</div>
              <div className="text-[11px] sm:text-xs font-semibold text-neutral-text/60 mt-1">مستثمر وسنيور</div>
            </div>
            <div className="text-center border-s border-muted-border/30">
              <div className="brand-gradient-text text-2xl sm:text-4xl font-black">+15</div>
              <div className="text-[11px] sm:text-xs font-semibold text-neutral-text/60 mt-1">مشروعاً استراتيجياً</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
