import React from 'react';
import { Search, MousePointerClick, MessagesSquare, KeyRound, Route } from 'lucide-react';
import { Reveal } from '../common/Reveal';

const steps = [
  { icon: Search, title: 'استكشف العقارات', desc: 'تصفح مجموعتنا الواسعة من العقارات المتاحة في مختلف مدن المملكة' },
  { icon: MousePointerClick, title: 'اختر عقارك المثالي', desc: 'قارن الخيارات واختر العقار الذي يناسب احتياجاتك وميزانيتك' },
  { icon: MessagesSquare, title: 'تواصل مع مستشارنا', desc: 'فريقنا جاهز للإجابة على استفساراتك وترتيب موعد المعاينة' },
  { icon: KeyRound, title: 'استلم مفاتيح عقارك', desc: 'نكمل معك إجراءات الإيجار أو التملك حتى استلام المفاتيح' },
];

export const ProcessSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-24 max-w-7xl mx-auto px-6">
      <div aria-hidden className="absolute top-1/3 right-0 w-[420px] h-[320px] bg-gold/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative text-center mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <Route className="w-3.5 h-3.5 text-accent-light" />
          كيف نعمل
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          أربع خطوات تفصلك عن <span className="brand-gradient-text">عقارك</span>
        </h2>
        <p className="text-sm md:text-base text-neutral-text/60 max-w-xl mx-auto mt-4 leading-relaxed">
          رحلة سلسة ومبسطة من أول بحث حتى استلام المفاتيح، مع مستشارين يرافقونك في كل مرحلة
        </p>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-6">
        <div aria-hidden className="absolute top-7 inset-x-12 hidden lg:block h-px bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0" />

        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <Reveal key={i} delay={i * 130} direction="up" className="h-full">
              <div className="relative h-full flex flex-col items-center text-center px-6">
                <div className="relative z-10 w-14 h-14 rounded-full brand-fill flex items-center justify-center text-xl font-black shadow-lg shadow-accent/30 mb-6">
                  {i + 1}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent border border-accent/30 flex items-center justify-center text-accent mb-5">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg mb-3">{step.title}</h3>
                <p className="text-xs text-neutral-text/70 leading-relaxed">{step.desc}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};
