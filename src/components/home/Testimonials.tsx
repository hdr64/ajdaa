import React from 'react';
import { Star, Quote, BadgeCheck, MessageSquareHeart } from 'lucide-react';
import { Reveal } from '../common/Reveal';

const testimonials = [
  {
    name: 'سلطان القحطاني',
    city: 'الرياض',
    text: 'استأجرنا مساحة تخزين في مستودعات المنصورية اللوجستية، التجهيزات وسهولة دخول وتفريغ الشاحنات الهيدروليكية كانت فارقة في سلاسل إمدادنا.',
  },
  {
    name: 'فهد الشمري',
    city: 'الأحساء',
    text: 'موقع مشروع الأحساء التجاري استثنائي جداً، التصميم المعماري الفخم والواجهات الزجاجية تمنح العلامات التجارية حضوراً باهراً.',
  },
  {
    name: 'عبدالعزيز السديري',
    city: 'الرياض',
    text: 'مجمع محلات أجدا لوكس التجاري صُمم بأعلى درجات الفخامة، تجربة استثمارية ممتازة وتنسيق احترافي في إدارة المساحات التجارية.',
  },
];

export const Testimonials: React.FC = () => {
  return (
    <section className="relative overflow-hidden py-24 max-w-7xl mx-auto px-6">
      <div aria-hidden className="absolute -top-24 left-1/4 w-[480px] h-[300px] bg-accent/8 blur-[130px] rounded-full pointer-events-none" />

      <div className="relative text-center mb-10">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <MessageSquareHeart className="w-3.5 h-3.5 text-accent-light" />
          آراء عملائنا
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          ماذا يقول <span className="brand-gradient-text">عملاؤنا</span>
        </h2>
      </div>

      <div className="relative flex items-center justify-center gap-3 mb-14">
        <div className="flex gap-1 text-accent">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Star key={idx} className="w-5 h-5 fill-accent" />
          ))}
        </div>
        <span className="text-lg font-black text-heading">4.9</span>
        <span className="text-xs text-neutral-text/50">تقييم من أكثر من 1200 عميل</span>
      </div>

      <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((item, i) => (
          <Reveal key={i} delay={i * 120} direction="up" className="h-full">
            <div className="glass-card group relative h-full overflow-hidden rounded-3xl p-7 hover:-translate-y-0.5 transition-all duration-300">
              <Quote
                aria-hidden
                className="absolute -top-3 left-5 w-16 h-16 text-accent/8 group-hover:text-accent/15 transition-colors duration-500"
              />

              <div className="relative">
                <div className="flex gap-1 text-accent mb-4">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <Star key={idx} className="w-4 h-4 fill-accent" />
                  ))}
                </div>
                <p className="text-sm text-neutral-text/75 leading-relaxed mb-7">"{item.text}"</p>

                <div className="flex items-center gap-3 border-t border-muted-border/20 pt-5">
                  <div className="w-11 h-11 rounded-full brand-fill flex items-center justify-center font-black text-sm shrink-0">
                    {item.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-heading flex items-center gap-1.5">
                      {item.name}
                      <BadgeCheck className="w-4 h-4 text-success shrink-0" />
                    </div>
                    <div className="text-xs text-neutral-text/50">{item.city}</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};
