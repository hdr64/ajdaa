import React from 'react';
import { Warehouse, MapPin, CheckCircle2, ArrowLeft, TrendingUp, Layers } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import almansoria from '../../assets/ajda1/almansoria.webp';
import alehsa from '../../assets/ajda1/alehsa.webp';
import alehsa2 from '../../assets/ajda1/alehsa2.webp';
import alehsa3 from '../../assets/ajda1/alehsa3.webp';
import alehsa4 from '../../assets/ajda1/alehsa4.webp';
import alehsa5 from '../../assets/ajda1/alehsa5.webp';
import alkher from '../../assets/ajda1/alkher.webp';
import alkher2 from '../../assets/ajda1/alkher2.webp';

interface ProjectsSectionProps {
  onExplore?: () => void;
}

const PROJECTS = [
  {
    id: 1,
    title: 'مستودعات المنصورية اللوجستية · Al Mansoria',
    subtitle: 'مشروع لوجستي متكامل يضم مستودعات ومخازن وسلاسل إمداد بمواصفات تخزين عالمية وساحات شحن هيدروليكية',
    city: 'مدينة الرياض · حي المنصورية',
    status: 'متاح للتأجير والاستثمار',
    units: 'مستودعات ومخازن كبرى',
    image: almansoria,
    gallery: [almansoria],
    features: ['سقف مرتفع وسعات تخزين واسعة', 'أرصفة شحن وتفريغ هيدروليكية', 'أنظمة إطفاء وأمن متطورة 24/7'],
  },
  {
    id: 2,
    title: 'مشروع الأحساء التجاري · Al Ahsa Commercial',
    subtitle: 'مجمع تجاري ومحلات استثمارية فاخرة في موقع استراتيجي حيوي بواجهات زجاجية وتصاميم معمارية راقية',
    city: 'مدينة الأحساء · موقع استراتيجي حيوي',
    status: 'محجوز بالكامل',
    units: 'مجمع محلات تجارية متكامل',
    image: alehsa,
    gallery: [alehsa, alehsa2, alehsa3, alehsa4, alehsa5],
    features: ['تصميم معماري وتراثي عصري فاخر', 'واجهات زجاجية مزدوجة للمحلات', 'مواقف سيارات واسعة ومهيأة للزوار'],
  },
  {
    id: 3,
    title: 'مجمع محلات أجدى لوكس · Ajda Lux Shops',
    subtitle: 'سلسلة صالات ومحلات تجارية راقية بتصميم مودرن عصري مع تراسات خارجية ومواقف زوار مخصصة',
    city: 'مدينة الرياض · محور تجاري رئيسي',
    status: 'متاح للتأجير والاستثمار',
    units: 'محلات ومعارض تجارية فاخرة',
    image: alkher2,
    gallery: [alkher2, alkher],
    features: ['واجهات عرض زجاجية مزدوجة', 'تراسات وجلسات خارجية راقية', 'مواقف خاصة لعملاء المحلات'],
  },
];

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onExplore }) => {
  return (
    <section className="relative py-14 sm:py-24 max-w-7xl mx-auto px-4 sm:px-6 overflow-hidden">
      {/* Section Header */}
      <div className="relative text-center mb-10 sm:mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-3.5 py-1.5 rounded-full mb-3">
          <Warehouse className="w-3.5 h-3.5 text-gold" />
          المشاريع اللوجستية والمحلات التجارية
        </span>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black mt-2 sm:mt-3 leading-tight">
          أهم المشاريع اللوجستية والمحلات التجارية <span className="brand-gradient-text">لأجدى العقارية</span>
        </h2>
        <p className="text-xs sm:text-base text-neutral-text/80 max-w-2xl mx-auto mt-3 sm:mt-4 leading-relaxed font-medium">
          مستودعات ومخازن لوجستية متطورة ومجمعات محلات تجارية استراتيجية صُممت لخدمة قطاع الأعمال وسلاسل الإمداد في المملكة.
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 relative z-10">
        {PROJECTS.map((project, idx) => (
          <Reveal key={project.id} delay={idx * 140} direction="up">
            <div className="glass-card rounded-2xl sm:rounded-3xl overflow-hidden group flex flex-col justify-between border border-muted-border/30 hover:border-accent/50 transition-all duration-300 h-full">
              <div className="relative h-56 sm:h-64 overflow-hidden img-shine">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/20 to-transparent" />

                <span
                  className={`absolute top-3.5 right-3.5 text-[11px] sm:text-xs font-black px-3 py-1 rounded-full shadow-lg ${
                    project.status === 'محجوز بالكامل'
                      ? 'bg-amber-500 text-black font-black'
                      : 'brand-fill'
                  }`}
                >
                  {project.status}
                </span>

                <span className="absolute bottom-3 left-3.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-canvas/85 text-neutral-text border border-muted-border/30 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-accent" />
                  {project.gallery.length} صور
                </span>
              </div>

              <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-accent font-bold mb-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{project.city}</span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-heading mb-2 group-hover:text-accent transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-xs text-neutral-text/75 leading-relaxed mb-4 sm:mb-6 font-medium">
                    {project.subtitle}
                  </p>

                  <div className="space-y-1.5 sm:space-y-2 border-t border-muted-border/20 pt-3 sm:pt-4 mb-4 sm:mb-6">
                    {project.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-neutral-text/80 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-muted-border/20">
                  <div className="flex items-center gap-1 text-xs text-gold font-bold">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span className="truncate">{project.units}</span>
                  </div>

                  <button
                    onClick={onExplore}
                    className="brand-btn-primary text-xs font-extrabold px-4 sm:px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 hover:scale-105 active:scale-95 transition cursor-pointer shrink-0"
                  >
                    استعراض
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
};
