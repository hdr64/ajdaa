import React from 'react';
import { ExternalLink, Sparkles, Building2, MapPin } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useLanguage } from '../../hooks/useLanguage';

const YoutubeIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export const VideoSection: React.FC = () => {
  const { language } = useLanguage();

  const isAr = language === 'ar';

  return (
    <section className="relative py-16 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] bg-accent/10 blur-[140px] rounded-full pointer-events-none"
      />

      {/* Header */}
      <div className="relative text-center mb-10 sm:mb-14">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-1.5 rounded-full mb-3">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          {isAr ? 'فيديو تعريفي للمشروع' : 'Project Video Showcase'}
        </span>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mt-2 leading-tight">
          {isAr ? 'شاهد بالفيديو: أيقونة' : 'Watch Video: The Icon'}{' '}
          <span className="brand-gradient-text">
            {isAr ? 'أجدا برايم على طريق الملك فهد' : 'Ajda Prime on King Fahd Road'}
          </span>
        </h2>
        <p className="text-xs sm:text-base text-neutral-text/80 max-w-2xl mx-auto mt-3 sm:mt-4 leading-relaxed font-medium">
          {isAr
            ? 'جولة معمارية واستعراض لأيقونة الأعمال والاستثمار الجديدة لشركة أجدا العقارية على أهم المحاور التجارية بمدينة الرياض.'
            : "A visual architectural tour of the new business & commercial icon developed by Ajda Real Estate on Riyadh's premier commercial highway."}
        </p>
      </div>

      {/* Video Container */}
      <Reveal direction="up">
        <div className="relative max-w-5xl mx-auto rounded-3xl overflow-hidden glass-card border border-accent/30 shadow-2xl shadow-black/50 p-2 sm:p-4">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/90 shadow-inner">
            <iframe
              src="https://www.youtube-nocookie.com/embed/Ti7MQxfmNWY?rel=0&modestbranding=1"
              title={isAr ? 'فيديو تعريفي بمشروع أجدا برايم' : 'Ajda Prime Video Showcase'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>

          {/* Video Footer info & Channel Button */}
          <div className="pt-4 pb-2 px-3 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs font-semibold text-neutral-text/80">
              <div className="w-8 h-8 rounded-xl brand-fill flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4 text-canvas-dark" />
              </div>
              <div>
                <span className="text-heading font-black block">
                  {isAr ? 'أجدا برايم · AJDA PRIME' : 'Ajda Prime · King Fahd Road'}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-accent">
                  <MapPin className="w-3 h-3" />
                  {isAr ? 'الرياض · طريق الملك فهد (+200م واجهة على 3 شوارع)' : 'Riyadh · King Fahd Rd (+200m frontage on 3 streets)'}
                </span>
              </div>
            </div>

            <a
              href="https://youtube.com/channel/UC5FIObwjjv5ZoiJLy_ufqRQ?si=-b5QV8mXDeOPTjD5"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 brand-btn-secondary text-xs font-bold px-5 py-2.5 rounded-xl hover:scale-105 transition cursor-pointer shadow-md"
            >
              <YoutubeIcon className="w-4 h-4 text-red-500" />
              <span>{isAr ? 'قناة أجدا العقارية على YouTube' : 'Ajda Real Estate on YouTube'}</span>
              <ExternalLink className="w-3 h-3 text-neutral-text/60" />
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
};
