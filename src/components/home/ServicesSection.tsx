import React from 'react';
import { Home, KeyRound, Building, Layers, Sparkles, ArrowLeft } from 'lucide-react';
import { Reveal } from '../common/Reveal';

interface ServicesSectionProps {
    onExplore?: () => void;
}

const services = [
  { icon: Home, title: 'بيع الفلل', desc: 'فلل فاخرة في أرقى المواقع بتصاميم عصرية ومساحات واسعة تلبي ذوقك' },
  { icon: KeyRound, title: 'تأجير العقارات', desc: 'عقارات للإيجار بأسعار تنافسية وعقود مرنة تناسب احتياجاتك' },
  { icon: Building, title: 'المكاتب التجارية', desc: 'مكاتب ومساحات عمل احترافية في مواقع استراتيجية للأعمال' },
  { icon: Layers, title: 'الشقق السكنية', desc: 'شقق راقية بمرافق متكاملة وخدمات فندقية عالية المستوى' },
];

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onExplore }) => {
  return (
    <section className="relative overflow-hidden py-24 max-w-7xl mx-auto px-6">
      {/* Section ambient glow */}
      <div aria-hidden className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[420px] bg-accent/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative text-center mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-accent-light" />
          خدماتنا المميزة
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          حلول عقارية <span className="brand-gradient-text">متكاملة</span>
        </h2>
        <p className="text-sm md:text-base text-neutral-text/60 max-w-xl mx-auto mt-4 leading-relaxed">
          من الفلل الفاخرة إلى المكاتب التجارية، نرافقك في كل خطوة من البحث وحتى الإغلاق
        </p>
        <div aria-hidden className="w-24 h-1 mx-auto mt-7 rounded-full bg-gradient-to-l from-transparent via-accent to-transparent" />
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((item, i) => {
          const Icon = item.icon;
          return (
            <Reveal key={i} delay={i * 120} direction="up" className="h-full">
              <div className="glass-card group relative h-full overflow-hidden rounded-3xl p-8 hover:-translate-y-2">
                {/* Corner glow */}
                <div
                  aria-hidden
                  className="absolute -top-20 -left-20 w-48 h-48 rounded-full bg-accent/0 blur-3xl group-hover:bg-accent/15 transition-colors duration-500 pointer-events-none"
                />
                {/* Ghost index */}
                <span
                  aria-hidden
                  className="absolute top-6 left-7 text-5xl font-black text-neutral-text/5 group-hover:text-accent/15 transition-colors duration-500 select-none"
                >
                  {String(i + 1).padStart(2, '0')}
                </span>

                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent border border-accent/30 flex items-center justify-center mb-7 text-accent transition-all duration-500 group-hover:bg-accent group-hover:text-canvas group-hover:rotate-6 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-accent/40">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 group-hover:text-accent transition-colors">{item.title}</h3>
                  <p className="text-xs text-neutral-text/70 leading-relaxed mb-6">{item.desc}</p>
                  <button
                    onClick={onExplore}
                    className="inline-flex items-center gap-2 text-xs font-bold text-accent group-hover:text-accent-light transition-colors cursor-pointer"
                  >
                    اعرف المزيد
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
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
