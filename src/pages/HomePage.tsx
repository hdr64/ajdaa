import React from 'react';
import type { Property } from '../types/property';

import { HeroSection } from '../components/home/HeroSection';
import { Marquee } from '../components/home/Marquee';
import { InteractiveProjectsMap } from '../components/home/InteractiveProjectsMap';
import { AboutSection } from '../components/home/AboutSection';
import { ServicesSection } from '../components/home/ServicesSection';
import { ProcessSection } from '../components/home/ProcessSection';
import { ProjectsSection } from '../components/home/ProjectsSection';
import { ClientsSection } from '../components/home/ClientsSection';
import { CtaSection } from '../components/home/CtaSection';
import { Reveal } from '../components/common/Reveal';
import { useCmsContent } from '../hooks/useCmsContent';
import type { NavPageKey } from '../components/common/Navbar';

interface HomePageProps {
  onExploreHero: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onNavigate: (page: NavPageKey, pushHistory?: boolean, options?: { projectId?: number }) => void;
  onSelectProperty?: (prop: Property) => void;
  onQuickView: (prop: Property) => void;
  onShowToast?: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onExploreHero,
  onNavigate,
  onQuickView,
}) => {
  const { content } = useCmsContent();
  const { home } = content;

  // Each section's visibility is the admin's call, so the page mirrors the
  // `enabled` flags rather than hardcoding an order.
  return (
    <>
      {home.hero.enabled && (
        <HeroSection
          onExplore={onExploreHero}
          onBook={() => onNavigate('booking')}
        />
      )}

      {home.marquee.enabled && <Marquee />}

      {home.mapSection.enabled && (
        <Reveal direction="up">
          <InteractiveProjectsMap
            onNavigate={(page, options) => onNavigate(page, true, options)}
            onQuickView={onQuickView}
          />
        </Reveal>
      )}

      {home.about.enabled && (
        <Reveal direction="up">
          <AboutSection />
        </Reveal>
      )}

      {home.services.enabled && (
        <Reveal direction="up">
          <ServicesSection onExplore={() => onNavigate('works')} />
        </Reveal>
      )}

      {home.process.enabled && (
        <Reveal direction="up">
          <ProcessSection />
        </Reveal>
      )}

      {home.portfolioSection.enabled && (
        <Reveal direction="up">
          <ProjectsSection
            onExplore={() => onNavigate('works')}
            onQuickView={onQuickView}
          />
        </Reveal>
      )}

      {home.clientsSection.enabled && (
        <Reveal direction="up">
          <ClientsSection />
        </Reveal>
      )}

      {home.cta.enabled && (
        <Reveal direction="up">
          <CtaSection
            onBook={() => onNavigate('booking')}
            onContact={() => onNavigate('contact')}
          />
        </Reveal>
      )}
    </>
  );
};
