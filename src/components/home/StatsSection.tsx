import React, { useEffect, useState } from 'react';
import { Building2, Smile, Award, Map, TrendingUp } from 'lucide-react';
import { useIntersection } from '../../hooks/useIntersection';

interface CounterProps {
  target: number;
  active: boolean;
}

const NumberCounter: React.FC<CounterProps> = ({ target, active }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!active) return;

    let startTime: number | null = null;
    const duration = 1200;
    let rafId: number;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 5);
      setDisplayValue(Math.floor(ease * target));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(target);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, active]);

  return <span>{displayValue.toLocaleString('en-US')}</span>;
};

const stats = [
  { target: 500, label: 'عقار متاح', icon: Building2 },
  { target: 1200, label: 'عميل راضي', icon: Smile },
  { target: 15, label: 'سنة خبرة', icon: Award },
  { target: 8, label: 'مدن سعودية', icon: Map },
];

export const StatsSection: React.FC = () => {
  const { ref, isVisible } = useIntersection<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section ref={ref} className="relative py-20 max-w-7xl mx-auto px-6">
      <div className="text-center mb-12">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <TrendingUp className="w-3.5 h-3.5 text-accent-light" />
          أرقامنا
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          نتائج <span className="brand-gradient-text">تتحدث عنا</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              style={{
                transitionDelay: `${idx * 80}ms`,
                transitionDuration: '600ms',
                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                transform: isVisible ? 'translate3d(0, 0, 0)' : 'translate3d(0, 20px, 0)',
                opacity: isVisible ? 1 : 0,
              }}
              className="gpu-layer glass-card group rounded-3xl p-8 text-center hover:-translate-y-2"
            >
              <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent border border-accent/30 flex items-center justify-center text-accent mb-5 transition-all duration-500 group-hover:bg-accent group-hover:text-canvas group-hover:scale-110 group-hover:rotate-6">
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-4xl md:text-5xl font-black brand-gradient-text tracking-tight mb-2">
                <NumberCounter target={stat.target} active={isVisible} />+
              </div>
              <div className="text-xs md:text-sm text-neutral-text/70 font-medium">
                {stat.label}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
