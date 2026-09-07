import React from 'react';

const cities = ['الرياض', 'الأحساء', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'أبها', 'تبوك'];

export const Marquee: React.FC = () => {
  const list = [...cities, ...cities, ...cities];

  return (
    <div className="overflow-hidden whitespace-nowrap py-5 bg-canvas/40 backdrop-blur-sm border-y border-muted-border/20 select-none edge-fade">
      <div className="animate-marquee gap-10">
        {list.map((city, idx) => (
          <span
            key={idx}
            aria-hidden={idx > cities.length - 1}
            className={`flex items-center gap-6 text-sm font-bold tracking-wide ${
              idx % 3 === 0 ? 'text-accent/70' : 'text-neutral-text/45'
            }`}
          >
            {city}
            <span className="text-gold/60 text-[10px]">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
};
