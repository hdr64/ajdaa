import type { FC } from 'react';
import { properties } from '../../data/properties';
import { useLanguage } from "../../hooks/useLanguage";
import type { Property } from "../../types/property";
import { PropertyCard } from '../common/PropertyCard';
import { Reveal } from "../common/Reveal"
interface Props {
  onExploreHero?: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
  onSelectProperty: (prop: Property) => void;
  onQuickView: (prop: Property) => void;
  onShowToast: (msg: string) => void;
}
const ProjectsSection1:FC<Props> = ({onNavigate,onSelectProperty,onQuickView,onShowToast})=>{
      const { t, isRTL } = useLanguage();
    return (
              <section className="py-14 bg-red-600 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-12">
          <Reveal direction={isRTL ? 'right' : 'left'}>
            <div>
              <span className="text-xs text-accent-light font-semibold brand-badge px-3 py-1 rounded-full">
                {t.works.badge}
              </span>
              <h2 className="text-3xl sm:text-4xl font-black mt-2 text-heading">
                {t.works.title}{' '}
                <span className="brand-gradient-text">{t.works.titleHighlight}</span>
              </h2>
            </div>
          </Reveal>
          <Reveal direction={isRTL ? 'left' : 'right'}>
            <button
              onClick={() => onNavigate('works')}
              className="brand-btn-secondary text-xs font-bold px-5 py-2.5 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
            >
              {t.works.allProjects}
            </button>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.slice(0, 3).map((prop, idx) => (
            <Reveal key={prop.id} delay={idx * 120} direction="up">
              <PropertyCard
                property={prop}
                onSelect={onSelectProperty}
                onQuickView={onQuickView}
                onFavToast={onShowToast}
              />
            </Reveal>
          ))}
        </div>
      </section>
    )
}

export default ProjectsSection1
