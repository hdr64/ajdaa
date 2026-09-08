import React from 'react';
import { Search, MousePointerClick, MessagesSquare, KeyRound, Route } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useLanguage } from '../../hooks/useLanguage';

const steps = [
  {
    icon: Search,
    titleAr: 'استكشف العقارات والمشاريع',
    titleEn: 'Discover Flagship Projects',
    descAr: 'تصفح باقتنا المتنوعة من المستودعات اللوجستية، المحلات التجارية، والمكاتب الإدارية في أهم مدن المملكة.',
    descEn: 'Browse our portfolio of modern logistics facilities, commercial hubs, and corporate towers across the Kingdom.',
  },
  {
    icon: MousePointerClick,
    titleAr: 'اختر المساحة والموقع المثالي',
    titleEn: 'Select Your Ideal Space',
    descAr: 'قارن المواصفات الاستراتيجية، السعات التشغيلية، وخطط المساحات التي تلبي متطلبات نشاطك المؤسسي بدقة.',
    descEn: 'Evaluate operational specifications, loading capacities, and layouts tailored precisely to your operational goals.',
  },
  {
    icon: MessagesSquare,
    titleAr: 'تواصل مع مستشارنا العقاري',
    titleEn: 'Consult With Our Advisors',
    descAr: 'فريقنا الاستشاري المتخصص جاهز للإجابة على استفساراتك وترتيب معاينة ميدانية فورية للموقع.',
    descEn: 'Our specialized advisory team coordinates private on-site viewings and delivers customized financial models.',
  },
  {
    icon: KeyRound,
    titleAr: 'أتمم التعاقد واستلم مفاتيحك',
    titleEn: 'Finalize & Receive Keys',
    descAr: 'نوفر إجراءات تعاقدية موثوقة وميسرة ترافقك خطوة بخطوة حتى استلام وحدتك وبدء نشاطك بنجاح.',
    descEn: 'Seamless end-to-end lease or acquisition procedures ensuring prompt handover and operational launch.',
  },
];

export const ProcessSection: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <section className="relative overflow-hidden py-24 max-w-7xl mx-auto px-6">
      <div
        aria-hidden
        className="absolute top-1/3 right-0 w-[420px] h-[320px] bg-gold/4 blur-[120px] rounded-full pointer-events-none"
      />

      <div className="relative text-center mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <Route className="w-3.5 h-3.5 text-accent-light" />
          {isAr ? 'كيف نعمل' : 'Our Advisory Process'}
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          {isAr ? (
            <>
              أربع خطوات تفصلك عن <span className="brand-gradient-text">عقارك المثالي</span>
            </>
          ) : (
            <>
              Four Clear Steps to Your <span className="brand-gradient-text">Ideal Commercial Asset</span>
            </>
          )}
        </h2>
        <p className="text-sm md:text-base text-neutral-text/75 max-w-xl mx-auto mt-4 leading-relaxed">
          {isAr
            ? 'رحلة استثمارية وتشغيلية سلسة ومبسطة، مع مستشارين متخصصين يرافقونك باحترافية في كل خطوة.'
            : 'A transparent, streamlined advisory journey with dedicated real estate professionals guiding you every step.'}
        </p>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6">
        <div
          aria-hidden
          className="absolute top-7 inset-x-12 hidden lg:block h-px bg-gradient-to-r from-accent/0 via-accent/30 to-accent/0"
        />

        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <Reveal key={i} delay={i * 130} direction="up" className="h-full">
              <div className="relative h-full flex flex-col items-center text-center px-4">
                <div className="relative z-10 w-13 h-13 rounded-full brand-fill flex items-center justify-center text-lg font-black border border-white/20 mb-6">
                  {i + 1}
                </div>
                <div className="w-13 h-13 rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent mb-5 transition-colors duration-300">
                  <Icon className="w-5.5 h-5.5" />
                </div>
                <h3 className="font-bold text-lg mb-2 text-heading">
                  {isAr ? step.titleAr : step.titleEn}
                </h3>
                <p className="text-xs text-neutral-text/75 leading-relaxed">
                  {isAr ? step.descAr : step.descEn}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};
