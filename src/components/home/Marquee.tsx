import React from 'react';
import { useCmsContent } from '../../hooks/useCmsContent';
import { useCmsText } from '../../hooks/useCmsText';

export const Marquee: React.FC = () => {
  const { content } = useCmsContent();
  const { text } = useCmsText();

  const cities = content.home.marquee.cities.map((city) => text(city.nameAr, city.nameEn));
  // Repeated three times so the -50% translate loop stays seamless.
  const list = [...cities, ...cities, ...cities];

  if (cities.length === 0) return null;

  return (
    <div className="overflow-hidden whitespace-nowrap py-5 bg-canvas/40 backdrop-blur-sm border-y border-muted-border/20 select-none edge-fade">
      <div className="animate-marquee gap-10">
        {list.map((city, idx) => (
          <span
            key={idx}
            aria-hidden={idx >= cities.length}
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