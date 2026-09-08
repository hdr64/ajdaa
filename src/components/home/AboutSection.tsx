import React, { useState } from 'react';
import { Compass, Sparkles, Award, Clock, ShieldCheck, Lightbulb, Users, Target, Eye, Play, X } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useLanguage } from '../../hooks/useLanguage';
import primeHero from '../../assets/ajda/prime/prime1.webp';

const VALUE_ICONS = [Award, Clock, ShieldCheck, Lightbulb, Users];

export const AboutSection: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  return (
    <section className="relative py-14 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 overflow-hidden">
      {/* Section Header */}
      <div className="text-center mb-10 sm:mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-3.5 py-1.5 rounded-full mb-3">
          <Compass className="w-3.5 h-3.5 text-gold" />
          {t.about.badge}
        </span>
        <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mt-2 leading-tight">
          {t.about.title} <span className="brand-gradient-text">{t.about.titleHighlight}</span>
        </h2>
        <p className="text-xs sm:text-base text-neutral-text/80 max-w-3xl mx-auto mt-3 sm:mt-4 leading-relaxed font-medium">
          {t.about.desc}
        </p>
      </div>

      {/* Main Story & Real Project Showcase Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 items-center mb-12 sm:mb-20">
        <Reveal direction={isRTL ? 'right' : 'left'}>
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-accent/30 group h-72 sm:h-[430px] bg-black">
            {isVideoPlaying ? (
              <div className="relative w-full h-full">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/Ti7MQxfmNWY?autoplay=1&rel=0&modestbranding=1"
                  title="Ajda Prime Video Showcase"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
                <button
                  onClick={() => setIsVideoPlaying(false)}
                  className="absolute top-3 end-3 z-20 w-9 h-9 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black transition cursor-pointer border border-white/20"
                  aria-label="Close video"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <img
                  src={primeHero}
                  alt="أجدا برايم - طريق الملك فهد"
                  className="w-full h-full object-cover transition-opacity duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/40 to-transparent" />

                {/* Play Video Button Overlay */}
                <button
                  onClick={() => setIsVideoPlaying(true)}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full brand-fill flex items-center justify-center text-canvas-dark border border-white/25 hover:opacity-95 transition-all duration-300 cursor-pointer group/btn"
                  title="شاهد فيديو المشروع"
                  aria-label="Play Project Video"
                >
                  <Play className="w-7 h-7 fill-current translate-x-0.5" />
                </button>

                <div className="absolute bottom-4 right-4 left-4 sm:bottom-6 sm:right-6 sm:left-6 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-canvas/90 backdrop-blur-md border border-accent/30">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-gold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{t.about.storyBadge}</span>
                    </div>
                    <span className="text-[11px] font-black brand-gradient-text">
                      {isRTL ? 'مشروع حقيقي · أجدا برايم' : 'Real Project · Ajda Prime'}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-heading leading-snug">
                    {isRTL ? 'أجدا برايم · طريق الملك فهد بالرياض' : 'Ajda Prime · King Fahd Road, Riyadh'}
                  </h3>
                </div>
              </>
            )}
          </div>
        </Reveal>

        <Reveal direction={isRTL ? 'left' : 'right'}>
          <div className="space-y-4 sm:space-y-6 text-start">
            <h3 className="text-xl sm:text-3xl font-black text-heading leading-snug">
              {t.about.storyHeading}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-text/80 leading-relaxed font-medium">
              {t.about.p1}
            </p>
            <p className="text-xs sm:text-sm text-neutral-text/75 leading-relaxed font-medium">
              {t.about.p2}
            </p>
            <p className="text-xs sm:text-sm text-neutral-text/75 leading-relaxed font-medium">
              {t.about.p3}
            </p>
          </div>
        </Reveal>
      </div>

      {/* Vision & Mission Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-12 sm:mb-20 text-start">
        <Reveal direction="up" delay={100}>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-accent/30 relative overflow-hidden h-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl brand-fill flex items-center justify-center mb-4 sm:mb-6 font-black">
              <Eye className="w-5 h-5 sm:w-6 sm:h-6 text-canvas-dark" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-heading mb-2 sm:mb-3">{t.about.visionTitle}</h3>
            <p className="text-xs sm:text-sm text-neutral-text/80 leading-relaxed font-medium">
              {t.about.visionDesc}
            </p>
          </div>
        </Reveal>

        <Reveal direction="up" delay={200}>
          <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-gold/40 relative overflow-hidden h-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gold text-canvas-dark flex items-center justify-center mb-4 sm:mb-6 font-black">
              <Target className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-heading mb-2 sm:mb-3">{t.about.missionTitle}</h3>
            <p className="text-xs sm:text-sm text-neutral-text/80 leading-relaxed font-medium">
              {t.about.missionDesc}
            </p>
          </div>
        </Reveal>
      </div>

      {/* Values Grid */}
      <div className="mb-12 sm:mb-20">
        <div className="text-center mb-8 sm:mb-12">
          <span className="text-xs font-bold text-accent brand-badge px-3.5 py-1.5 rounded-full">
            {t.about.valuesBadge}
          </span>
          <h3 className="text-xl sm:text-3xl lg:text-4xl font-black text-heading mt-2 sm:mt-3">
            {t.about.valuesTitle} <span className="brand-gradient-text">{t.about.valuesHighlight}</span>
          </h3>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          {t.about.valuesList.map((val, idx) => {
            const Icon = VALUE_ICONS[idx % VALUE_ICONS.length];
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
        <div className="glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-10 border border-accent/40 bg-gradient-to-r from-surface/90 via-canvas/95 to-surface/90">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 text-center">
            {t.about.officialStats.map((stat, i) => (
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
