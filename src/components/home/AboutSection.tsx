import React from 'react';
import { Compass, Sparkles, Award, Clock, ShieldCheck, Lightbulb, Users, Target, Eye } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import aboutHero from '../../assets/imgs/ajda_hero_bg.webp';

const VALUES = [
  {
    icon: Award,
    title: 'الجودة',
    desc: 'نلتزم بأعلى المعايير العالمية في كل مراحل التخطيط والتطوير والبناء.',
  },
  {
    icon: Clock,
    title: 'الالتزام',
    desc: 'نحترم وعودنا ونفي بكافة مواعيدنا مع عملائنا وشركائنا بصرامة دقيقة.',
  },
  {
    icon: ShieldCheck,
    title: 'الشفافية',
    desc: 'الصراحة والمصداقية التامة هي أساس كافة تعاملاتنا الاستثمارية والعقارية.',
  },
  {
    icon: Lightbulb,
    title: 'الابتكار',
    desc: 'نوفر حلولاً عقارية ذكية ومستدامة تسبق تطلعات السوق وتراعي البيئة.',
  },
  {
    icon: Users,
    title: 'العميل أولاً',
    desc: 'نضع تطلعات واحتياجات العميل في صميم كل قرار معمارياً واستثمارياً.',
  },
];

const OFFICIAL_STATS = [
  { number: '25+', label: 'سنوات خبرة في التطوير العقاري' },
  { number: '250+', label: 'مشروع نوعي استراتيجي' },
  { number: '8+', label: 'مدن سعودية ضمن تغطيتنا' },
];

export const AboutSection: React.FC = () => {
  return (
    <section className="relative py-14 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 overflow-hidden">
      {/* Section Header */}
      <div className="text-center mb-10 sm:mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-3.5 py-1.5 rounded-full mb-3">
          <Compass className="w-3.5 h-3.5 text-gold" />
          عن أجدا العقارية · Ajda Real Estate
        </span>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mt-2 leading-tight">
          شركاء في بناء <span className="brand-gradient-text">مستقبل عمراني متكامل</span>
        </h2>
        <p className="text-xs sm:text-base text-neutral-text/80 max-w-3xl mx-auto mt-3 sm:mt-4 leading-relaxed font-medium">
          أجدا العقارية هي شركة سعودية رائدة للتطوير والاستثمار العقاري، تأسست على أسس من الالتزام، الجودة، والابتكار، متخصصة في تطوير أضخم المشاريع اللوجستية كالمستودعات والمخازن، والمحلات والمجمعات التجارية الفاخرة، ومراكز الأعمال الإدارية الاستراتيجية.
        </p>
      </div>

      {/* Main Story & Hero Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-center mb-12 sm:mb-20">
        <Reveal direction="right">
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-accent/30 shadow-2xl shadow-black/60 group h-64 sm:h-[420px]">
            <img
              src={aboutHero}
              alt="عن أجدا العقارية"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />

            <div className="absolute bottom-4 right-4 left-4 sm:bottom-6 sm:right-6 sm:left-6 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-canvas/85 backdrop-blur-md border border-accent/30">
              <div className="flex items-center gap-2 text-xs font-bold text-gold mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>نصنع الفرق بخبرتنا الطويلة</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-heading">المستقبل يُبنى هنا مع أجدا</h3>
            </div>
          </div>
        </Reveal>

        <Reveal direction="left">
          <div className="space-y-4 sm:space-y-6">
            <h3 className="text-xl sm:text-3xl font-black text-heading leading-snug">
              منذ انطلاقة شركتنا، كانت رؤيتنا واضحة ورسالتنا متطلعة للريادة
            </h3>
            <p className="text-xs sm:text-sm text-neutral-text/80 leading-relaxed font-medium">
              تأسست شركة أجدا للتطوير والاستثمار العقاري على أسس راسخة من الالتزام، والجودة، والرغبة
              الصادقة في إحداث تأثير إيجابي ومستدام في سوق التطوير العقاري.
            </p>
            <p className="text-xs sm:text-sm text-neutral-text/75 leading-relaxed font-medium">
              جاءت بدايتنا من إيمان عميق بأن العقار ليس مجرد مبنى، بل هو تجربة حياة. ولهذا سعينا منذ
              اليوم الأول إلى تقديم مشاريع تضيف قيمة حقيقية، وتراعي احتياجات الإنسان، والبيئة،
              والاقتصاد.
            </p>
            <p className="text-xs sm:text-sm text-neutral-text/75 leading-relaxed font-medium">
              نعمل وفق منهجية تعتمد على الابتكار والاستدامة، وطموحنا لا يقتصر على الريادة المحلية، بل
              نتطلع إلى التوسع إقليميًا وعالميًا عبر مشاريع نوعية تترك بصمتنا في كل مكان.
            </p>
          </div>
        </Reveal>
      </div>

      {/* Vision & Mission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-12 sm:mb-20">
        <Reveal direction="up" delay={100}>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-accent/30 relative overflow-hidden h-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl brand-fill flex items-center justify-center mb-4 sm:mb-6 font-black">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-canvas-dark" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-heading mb-2 sm:mb-3">رؤيتنا</h3>
            <p className="text-xs sm:text-sm text-neutral-text/80 leading-relaxed font-medium">
              التوسع في مختلف مناطق المملكة، وبناء سجل قوي من النجاحات يؤهلنا للإدراج في سوق الأسهم
              وتحقيق نمو مستدام.
            </p>
          </div>
        </Reveal>

        <Reveal direction="up" delay={200}>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gold/40 relative overflow-hidden h-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gold text-canvas-dark flex items-center justify-center mb-4 sm:mb-6 font-black">
              <Target className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-heading mb-2 sm:mb-3">رسالتنا</h3>
            <p className="text-xs sm:text-sm text-neutral-text/80 leading-relaxed font-medium">
              تحسين جودة الحياة وتحقيق عائد استثماري فعّال عبر تطوير مشاريع تجمع بين التخطيط الذكي،
              التصميم العصري، والخدمة الفائقة.
            </p>
          </div>
        </Reveal>
      </div>

      {/* Values Grid */}
      <div className="mb-12 sm:mb-20">
        <div className="text-center mb-8 sm:mb-12">
          <span className="text-xs font-bold text-accent brand-badge px-3.5 py-1.5 rounded-full">
            قيمنا الجوهرية
          </span>
          <h3 className="text-xl sm:text-3xl lg:text-4xl font-black text-heading mt-2 sm:mt-3">
            نبتكر ولا نكرر، ونوازن بين <span className="brand-gradient-text">الرؤية والتنفيذ الذكي</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {VALUES.map((val, idx) => {
            const Icon = val.icon;
            return (
              <Reveal key={val.title} delay={idx * 100} direction="up" className={idx === 4 ? 'col-span-2 lg:col-span-1' : ''}>
                <div className="glass-card rounded-2xl p-4 sm:p-6 h-full text-center border border-muted-border/30 hover:border-accent/50 transition">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <h4 className="font-extrabold text-sm sm:text-base text-heading mb-1.5">{val.title}</h4>
                  <p className="text-[11px] sm:text-xs text-neutral-text/70 leading-relaxed">{val.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* Official Statistics Bar */}
      <Reveal direction="up">
        <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-10 border border-accent/40 bg-gradient-to-r from-surface/90 via-canvas/95 to-surface/90 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-center">
            {OFFICIAL_STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={`py-1.5 sm:py-2 ${i > 0 ? 'border-t md:border-t-0 md:border-s border-muted-border/30 pt-4 md:pt-2' : ''}`}
              >
                <div className="text-3xl sm:text-5xl font-black brand-gradient-text tracking-tight mb-1 sm:mb-2">
                  {stat.number}
                </div>
                <div className="text-xs sm:text-sm font-bold text-neutral-text/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
};
