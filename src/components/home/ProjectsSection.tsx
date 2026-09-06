import React from 'react';
import { Building2, MapPin, CheckCircle2, ArrowLeft, TrendingUp, Layers } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import festa1 from '../../assets/ajda/festa/festa1.webp';
import festa2 from '../../assets/ajda/festa/festa2.webp';
import festa3 from '../../assets/ajda/festa/festa3.webp';
import prime1 from '../../assets/ajda/prime/prime1.webp';
import prime2 from '../../assets/ajda/prime/prime2.webp';
import line1 from '../../assets/ajda/line/line1.webp';
import line2 from '../../assets/ajda/line/line2.webp';

interface ProjectsSectionProps {
  onExplore?: () => void;
}

const PROJECTS = [
  {
    id: 1,
    title: 'أجدا فيستا · Ajda Vista',
    subtitle: 'مجمع تجاري وإداري متكامل متعدد المكاتب والأقسام بتصاميم استراتيجية ومساحات واسعة',
    city: 'الرياض · طريق الملك فهد',
    status: 'متاح للإيجار والاستثمار',
    units: 'مبنى تجاري متعدد الأقسام',
    image: festa1,
    gallery: [festa1, festa2, festa3],
    features: ['مكاتب تجارية متعددة المساحات', 'واجهات زجاجية عصرية', 'مواقف خاصة وأنظمة أمنية'],
  },
  {
    id: 2,
    title: 'أجدا برايم · Ajda Prime',
    subtitle: 'مركز أعمال تنفيذي عصري يضم مساحات إدارية ومكاتب فاخرة مجهزة بأحدث التقنيات',
    city: 'جدة · حي الشاطئ',
    status: 'جاهز للاستخدام والتسليم',
    units: 'مبنى إداري تنفيذي',
    image: prime1,
    gallery: [prime1, prime2],
    features: ['مقر استراتيجي للشركات', 'أنظمة تحكم وأمن ذكية', 'قاعات اجتماعات تنفيذية'],
  },
  {
    id: 3,
    title: 'أجدا لاين · Ajda Line',
    subtitle: 'مشروع تجاري وإداري بموقع حيوي متميز يوفر بيئة عمل استثمارية مرخصة ومكتملة',
    city: 'الرياض · شمال طريق الملك سلمان',
    status: 'قيد البيع والاستثمار',
    units: 'مجمع مكاتب وأقسام',
    image: line1,
    gallery: [line1, line2],
    features: ['مواقع تجارية حيوية', 'تصميم معماري مستدام', 'خدمات إدارة ممتلكات متكاملة'],
  },
];

export const ProjectsSection: React.FC<ProjectsSectionProps> = ({ onExplore }) => {
  return (
    <section className="relative py-24 max-w-7xl mx-auto px-6 overflow-hidden">
      {/* Section Header */}
      <div className="relative text-center mb-16">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full mb-3">
          <Building2 className="w-3.5 h-3.5 text-gold" />
          مشاريع أجدا العقارية الرئيسية
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mt-3">
          المشاريع التجارية والأبنية الإدارية <span className="brand-gradient-text">لأجدا العقارية</span>
        </h2>
        <p className="text-sm md:text-base text-neutral-text/80 max-w-2xl mx-auto mt-4 leading-relaxed font-medium">
          مباني تجارية وإدارية متعددة المكاتب والأقسام صُممت لتلبي تطلعات كبرى الشركات والمستثمرين في المملكة.
        </p>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        {PROJECTS.map((project, idx) => (
          <Reveal key={project.id} delay={idx * 140} direction="up">
            <div className="glass-card rounded-3xl overflow-hidden group flex flex-col justify-between border border-muted-border/30 hover:border-accent/50 transition-all duration-300 h-full">
              <div className="relative h-64 overflow-hidden img-shine">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/20 to-transparent" />

                <span className="absolute top-4 right-4 text-xs font-black px-3.5 py-1.5 rounded-full brand-fill shadow-lg">
                  {project.status}
                </span>

                <span className="absolute bottom-3 left-4 text-[10px] font-bold px-2.5 py-1 rounded-full bg-canvas/85 text-neutral-text border border-muted-border/30 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-accent" />
                  {project.gallery.length} صور
                </span>
              </div>

              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-accent font-bold mb-2">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>{project.city}</span>
                  </div>

                  <h3 className="text-xl font-black text-heading mb-2 group-hover:text-accent transition-colors">
                    {project.title}
                  </h3>
                  <p className="text-xs text-neutral-text/75 leading-relaxed mb-6 font-medium">
                    {project.subtitle}
                  </p>

                  <div className="space-y-2 border-t border-muted-border/20 pt-4 mb-6">
                    {project.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2 text-xs text-neutral-text/80 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-muted-border/20">
                  <div className="flex items-center gap-1 text-xs text-gold font-bold">
                    <TrendingUp className="w-4 h-4" />
                    <span>{project.units}</span>
                  </div>

                  <button
                    onClick={onExplore}
                    className="brand-btn-primary text-xs font-extrabold px-5 py-2.5 rounded-xl inline-flex items-center gap-1.5 hover:scale-105 transition cursor-pointer"
                  >
                    استعرض العقارات
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
