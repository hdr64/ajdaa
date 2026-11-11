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
import { PreviewAnchor } from '../components/common/PreviewAnchor';
import { usePreviewSectionScroll } from '../hooks/usePreviewSectionScroll';

interface HomePageProps {
  onExploreHero: (filters?: { city?: string; type?: string; priceType?: string }) => void;
  onNavigate: (page: NavPageKey, pushHistory?: boolean, options?: { projectId?: number; property?: Property }) => void;
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
  usePreviewSectionScroll();

  // Each section's visibility is the admin's call, so the page mirrors the
  // `enabled` flags rather than hardcoding an order.
  return (
    <>
      {home.hero.enabled && (
        <PreviewAnchor section="hero">
          <HeroSection
            onExplore={onExploreHero}
            onBook={() => onNavigate('booking')}
          />
        </PreviewAnchor>
      )}

      {home.marquee.enabled && (
        <PreviewAnchor section="marquee">
          <Marquee />
        </PreviewAnchor>
      )}

      {home.mapSection.enabled && (
        <PreviewAnchor section="mapSection">
          <Reveal direction="up">
            <InteractiveProjectsMap
              onNavigate={(page, options) => onNavigate(page, true, options)}
              onQuickView={onQuickView}
            />
          </Reveal>
        </PreviewAnchor>
      )}

      {home.about.enabled && (
        <PreviewAnchor section="about">
          <Reveal direction="up">
            <AboutSection />
          </Reveal>
        </PreviewAnchor>
      )}

      {home.services.enabled && (
        <PreviewAnchor section="services">
          <Reveal direction="up">
            <ServicesSection onExplore={() => onNavigate('works')} />
          </Reveal>
        </PreviewAnchor>
      )}

      {home.process.enabled && (
        <PreviewAnchor section="process">
          <Reveal direction="up">
            <ProcessSection />
          </Reveal>
        </PreviewAnchor>
      )}

      {home.portfolioSection.enabled && (
        <PreviewAnchor section="portfolioSection">
          <Reveal direction="up">
            <ProjectsSection
              onExplore={() => onNavigate('works')}
              onQuickView={onQuickView}
            />
          </Reveal>
        </PreviewAnchor>
      )}

      {home.clientsSection.enabled && (
        <PreviewAnchor section="clientsSection">
          <Reveal direction="up">
            <ClientsSection />
          </Reveal>
        </PreviewAnchor>
      )}

      {home.cta.enabled && (
        <PreviewAnchor section="cta">
          <Reveal direction="up">
            <CtaSection
              onBook={() => onNavigate('booking')}
              onContact={() => onNavigate('contact')}
            />
          </Reveal>
        </PreviewAnchor>
      )}
    </>
  );
};
