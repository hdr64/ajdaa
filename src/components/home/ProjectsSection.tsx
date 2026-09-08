import React, { useState } from 'react';
import { Building2, MapPin, CheckCircle2, ArrowLeft, ArrowRight, TrendingUp, Layers, Eye } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { useLanguage } from '../../hooks/useLanguage';
import { properties, getPropertyDisplay } from '../../data/properties';
import type { Property } from '../../types/property';

interface ProjectsSectionProps {
  onExplore?: () => void;
  onQuickView?: (prop: Property) => void;
}

type FilterCategory = 'all' | 'commercial' | 'office' | 'logistics';

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onExplore, onQuickView }) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const [activeTab, setActiveTab] = useState<FilterCategory>('all');

  // Categories for filtering
  const tabs: { id: FilterCategory; labelAr: string; labelEn: string }[] = [
    { id: 'all', labelAr: 'كافة المشاريع الرائدة (6)', labelEn: 'All Signature Hubs (6)' },
    { id: 'office', labelAr: 'المباني والأبراج الإدارية', labelEn: 'Corporate & Business Towers' },
    { id: 'commercial', labelAr: 'المعارض والمجمعات التجارية', labelEn: 'Commercial & Showrooms' },
    { id: 'logistics', labelAr: 'المستودعات وسلاسل الإمداد', labelEn: 'Logistics & Warehousing' },
  ];

  // In the top section of the home page, the first 3 properties (201, 202, 203) are displayed.
  // Here, we feature all 6 flagship projects (or filtered by category) so the other projects
  // (Ajda Vera 204, Ajda Vista 205, Ajda Prime 206, Ajda Line 207) are fully highlighted!
  const allProjects = [
    properties[3], // 204: Ajda Vera
    properties[4], // 205: Ajda Vista
    properties[5], // 206: Ajda Prime
    properties[6] || properties[0], // 207: Ajda Line
    properties[1], // 202: Al Ahsa
    properties[0], // 201: Al Mansoria
  ].filter(Boolean);

  const displayedProjects = allProjects.filter((p) => {
    if (activeTab === 'all') return true;
    return p.type === activeTab;
  });

  return (
    <section className="relative py-14 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 overflow-hidden">
      {/* Section Header */}
      <div className="relative text-center mb-8 sm:mb-12">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-3.5 py-1.5 rounded-full mb-3">
          <Building2 className="w-3.5 h-3.5 text-gold" />
          {isAr ? 'محفظة مشاريع أجدى العقارية' : 'Ajda Real Estate Portfolio'}
        </span>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mt-2 sm:mt-3 leading-tight text-heading">
          {isAr ? 'المشاريع الاستثمارية والإدارية ' : 'Investment & Corporate Developments '}
          <span className="brand-gradient-text">{isAr ? 'لأجدى العقارية' : 'by Ajda Real Estate'}</span>
        </h2>
        <p className="text-xs sm:text-base text-neutral-text/80 max-w-2xl mx-auto mt-3 sm:mt-4 leading-relaxed font-medium">
          {isAr
            ? 'مراكز أعمال تنفيذية ومجمعات تجارية ومعارض متطورة في أرقى المواقع الاستراتيجية بالعاصمة الرياض والمملكة.'
            : 'Executive corporate centers, flagship commercial showrooms, and prime logistics hubs developed in prestigious locations across Riyadh and the Kingdom.'}
        </p>

        {/* Filter Tabs - Calm Luxury Pill Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 sm:mt-8">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer border ${
                  isActive
                    ? 'brand-fill text-canvas border-accent/40 shadow-xs'
                    : 'bg-surface/90 text-neutral-text/75 border-muted-border/30 hover:border-accent/40 hover:text-accent'
                }`}
              >
                {isAr ? tab.labelAr : tab.labelEn}
              </button>
            );
          })}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10">
        {displayedProjects.map((prop, idx) => {
          const display = getPropertyDisplay(prop, language);
          const galleryCount = prop.gallery?.length || 1;

          return (
            <Reveal key={prop.id} delay={idx * 100} direction="up">
              <div
                onClick={() => onQuickView?.(prop)}
                className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden group flex flex-col justify-between border border-muted-border/30 hover:border-accent/40 transition-all duration-300 h-full cursor-pointer"
              >
                <div className="relative h-56 sm:h-64 overflow-hidden img-shine">
                  <img
                    src={prop.image}
                    alt={display.title}
                    className="w-full h-full object-cover transition-opacity duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/20 to-transparent" />

                  {/* Status Badge */}
                  <span
                    className={`absolute top-3.5 right-3.5 text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full border border-white/20 ${
                      display.isBooked
                        ? 'bg-amber-500 text-black font-black'
                        : prop.type === 'logistics'
                        ? 'bg-blue-600 text-white'
                        : prop.type === 'commercial'
                        ? 'bg-emerald-600 text-white'
                        : 'brand-fill'
                    }`}
                  >
                    {display.badge}
                  </span>

                  {/* Gallery Count */}
                  <span className="absolute bottom-3 left-3.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-canvas/90 text-neutral-text border border-muted-border/30 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-accent" />
                    {galleryCount} {isAr ? 'صور' : 'Photos'}
                  </span>

                  {/* Quick View Hover Indicator */}
                  <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-canvas/40 backdrop-blur-[2px]">
                    <span className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-full inline-flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-accent" />
                      {isAr ? 'عرض التفاصيل والمعرض' : 'View Details & Gallery'}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-accent font-bold mb-2">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {display.city}
                      </span>
                      <span className="brand-badge text-[10px] px-2 py-0.5 rounded-full">
                        {display.type}
                      </span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-black text-heading mb-2 group-hover:text-accent transition-colors">
                      {display.title}
                    </h3>
                    <p className="text-xs text-neutral-text/75 leading-relaxed mb-4 sm:mb-6 font-medium line-clamp-2">
                      {display.description}
                    </p>

                    <div className="space-y-1.5 sm:space-y-2 border-t border-muted-border/20 pt-3 sm:pt-4 mb-4 sm:mb-6">
                      {display.features.slice(0, 3).map((feat, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2 text-xs text-neutral-text/80 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-muted-border/20 gap-2">
                    <div className="flex items-center gap-1 text-xs text-gold font-bold truncate">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{display.units}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickView?.(prop);
                        }}
                        className="brand-btn-secondary text-xs font-bold px-3 py-2 rounded-xl inline-flex items-center gap-1 hover:border-accent transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-accent" />
                        {isAr ? 'تفاصيل' : 'Details'}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onExplore?.();
                        }}
                        className="brand-btn-primary text-xs font-extrabold px-3.5 sm:px-4 py-2 rounded-xl inline-flex items-center gap-1 transition cursor-pointer shrink-0"
                      >
                        {isAr ? 'استعراض' : 'Explore'}
                        <ArrowIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
};
