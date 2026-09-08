import React from 'react';
import type { Property } from '../types/property';

import { HeroSection } from '../components/home/HeroSection';
import { Marquee } from '../components/home/Marquee';
import { AboutSection } from '../components/home/AboutSection';
import { ServicesSection } from '../components/home/ServicesSection';
import { ProcessSection } from '../components/home/ProcessSection';
import { StatsSection } from '../components/home/StatsSection';
import { ProjectsSection } from '../components/home/ProjectsSection';
import { VideoSection } from '../components/home/VideoSection';
import { ClientsSection } from '../components/home/ClientsSection';
import { CtaSection } from '../components/home/CtaSection';
import { PropertyCard } from '../components/common/PropertyCard';
import { Reveal } from '../components/common/Reveal';
import { useLanguage } from '../hooks/useLanguage';

interface HomePageProps {
  onExploreHero: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onNavigate: (page: 'home' | 'works' | 'booking' | 'contact') => void;
  onSelectProperty: (prop: Property) => void;
  onQuickView: (prop: Property) => void;
  onShowToast: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onExploreHero,
  onNavigate,
  onSelectProperty,
  onQuickView,
  onShowToast,
}) => {


  return (
    <>
      <HeroSection
        onExplore={onExploreHero}
        onBook={() => onNavigate('booking')}
      />

      <Marquee />

      <Reveal direction="up">
        <AboutSection />
      </Reveal>



      <Reveal direction="up">
        <ServicesSection onExplore={() => onNavigate('works')} />
      </Reveal>

      <Reveal direction="up">
        <ProcessSection />
      </Reveal>

      {/* <StatsSection /> */}

      <Reveal direction="up">
        <ProjectsSection
          onExplore={() => onNavigate('works')}
          onQuickView={onQuickView}
        />
      </Reveal>

      <Reveal direction="up">
        <VideoSection />
      </Reveal>

      <Reveal direction="up">
        <ClientsSection />
      </Reveal>

      <Reveal direction="up">
        <CtaSection
          onBook={() => onNavigate('booking')}
          onContact={() => onNavigate('contact')}
        />
      </Reveal>
    </>
  );
};
