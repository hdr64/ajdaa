import React from 'react';
import { Warehouse, Store, Building, TrendingUp, Sparkles, ArrowLeft, ArrowRight } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useLanguage } from '../../hooks/useLanguage';

interface ServicesSectionProps {
  onExplore?: () => void;
}

const services = [
  {
    icon: Warehouse,
    titleAr: 'المشاريع اللوجستية والمستودعات',
    titleEn: 'Logistics & Modern Warehousing',
    descAr: 'مستودعات ومخازن حديثة بمواصفات تخزين عالمية، ساحات شحن وتفريغ مجهزة لدعم سلاسل الإمداد والتجارة',
    descEn: 'State-of-the-art warehouses with international standards, hydraulic docks, and integrated supply chain facilities.',
  },
  {
    icon: Store,
    titleAr: 'المحلات والمجمعات التجارية',
    titleEn: 'Commercial Hubs & Showrooms',
    descAr: 'محلات وصالات عرض تجارية في مواقع استراتيجية حيوية، بتصاميم عصرية تناسب مختلف الأنشطة الاستثمارية',
    descEn: 'Prime showrooms and commercial spaces in high-traffic corridors designed for flagship enterprise brands.',
  },
  {
    icon: Building,
    titleAr: 'المباني والمكاتب الإدارية',
    titleEn: 'Corporate Offices & Business Towers',
    descAr: 'مراكز أعمال ومساحات إدارية فاخرة مجهزة بأحدث التقنيات الذكية لبيئة عمل مؤسسية متكاملة',
    descEn: 'Prestigious corporate offices and business centers equipped with smart systems for exceptional productivity.',
  },
  {
    icon: TrendingUp,
    titleAr: 'التطوير والاستثمار العقاري',
    titleEn: 'Real Estate Investment & Development',
    descAr: 'حلول استثمارية مستدامة وتطوير أصول عقارية تحقق عوائد مجزية وشراكات استراتيجية رائدة',
    descEn: 'Sustainable investment solutions and asset development generating resilient returns and strategic growth.',
  },
];

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onExplore }) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="relative overflow-hidden py-24 max-w-7xl mx-auto px-6">
      {/* Section ambient atmosphere */}
      <div
        aria-hidden
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-accent/8 blur-[140px] rounded-full pointer-events-none"
      />

      <div className="relative text-center mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-accent-light" />
          {isAr ? 'تخصصاتنا وخدماتنا' : 'Our Disciplines & Services'}
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          {isAr ? (
            <>
              حلول عقارية <span className="brand-gradient-text">لوجستية وتجارية متكاملة</span>
            </>
          ) : (
            <>
              Integrated Real Estate <span className="brand-gradient-text">Logistics & Commercial</span> Solutions
            </>
          )}
        </h2>
        <p className="text-sm md:text-base text-neutral-text/75 max-w-2xl mx-auto mt-4 leading-relaxed font-medium">
          {isAr
            ? 'من المستودعات اللوجستية والمخازن إلى المحلات والمجمعات التجارية والمكاتب الإدارية، نبني مشاريع تحقق أعلى قيمة استثمارية مستدامة.'
            : 'From modern logistics facilities and storage hubs to commercial centers and corporate offices, we construct landmark developments with lasting investment value.'}
        </p>
        <div
          aria-hidden
          className="w-24 h-0.5 mx-auto mt-7 rounded-full bg-gradient-to-l from-transparent via-accent/60 to-transparent"
        />
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal key={i} delay={i * 120} direction="up" className="h-full">
              <div className="glass-card group relative h-full overflow-hidden rounded-3xl p-8 hover:-translate-y-0.5 transition-all duration-300">
                {/* Ghost index */}
                <span
                  aria-hidden
                  className="absolute top-6 left-7 text-5xl font-black text-neutral-text/5 group-hover:text-accent/15 transition-colors duration-300 select-none"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="relative">
                  <div className="w-13 h-13 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center mb-7 text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-canvas">
                    <Icon className="w-5.5 h-5.5" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 group-hover:text-accent transition-colors">
                    {isAr ? item.titleAr : item.titleEn}
                  </h3>
                  <p className="text-xs text-neutral-text/75 leading-relaxed mb-6">
                    {isAr ? item.descAr : item.descEn}
                  </p>
                  <button
                    onClick={onExplore}
                    className="inline-flex items-center gap-2 text-xs font-bold text-accent group-hover:text-accent-light transition-colors cursor-pointer"
                  >
                    <span>{isAr ? 'اعرف المزيد' : 'Learn More'}</span>
                    <ArrowIcon className="w-3.5 h-3.5 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};
