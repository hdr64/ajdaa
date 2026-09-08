import { useState, useRef } from 'react';
import type { Property } from './types/property';
import { properties } from './data/properties';
import { Navbar } from './components/common/Navbar';
import { HeroSection } from './components/home/HeroSection';
import { Marquee } from './components/home/Marquee';
import { ServicesSection } from './components/home/ServicesSection';
import { ProcessSection } from './components/home/ProcessSection';
import { StatsSection } from './components/home/StatsSection';
import { ClientsSection } from './components/home/ClientsSection';
import { CtaSection } from './components/home/CtaSection';
import { ProjectsSection } from './components/home/ProjectsSection';
import { VideoSection } from './components/home/VideoSection';
import { AboutSection } from './components/home/AboutSection';
import { ContactPage } from './components/contact/ContactPage';
import { PropertyCard } from './components/common/PropertyCard';
import { PropertyModal } from './components/common/PropertyModal';
import { Footer } from './components/common/Footer';
import { WorksPage } from './components/works/WorksPage';
import { BookingView } from './components/booking/BookingView';
import { Reveal } from './components/common/Reveal';
import { ThemeProvider } from './context/ThemeProvider';
import { useLanguage } from './hooks/useLanguage';
import { CheckCircle2 } from 'lucide-react';
import { BackgroundDecor } from './components/common/BackgroundDecor';


type PageKey = 'home' | 'works' | 'booking' | 'contact';

const TRANSITION_EXIT_MS = 400;
const TRANSITION_ENTER_MS = 650;

export function App() {
  const { t, isRTL } = useLanguage();
  const [currentPage, setCurrentPage] = useState<PageKey>('home');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedModalProperty, setSelectedModalProperty] = useState<Property | null>(null);
  const [initialFilters, setInitialFilters] = useState<{ city?: string; type?: string; priceType?: string } | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [transition, setTransition] = useState<'idle' | 'out' | 'in'>('idle');
  const transitioningRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const runTransition = (onSwap?: () => void) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    setTransition('out');

    window.setTimeout(() => {
      onSwap?.();
      setTransition('in');

      window.setTimeout(() => {
        setTransition('idle');
        transitioningRef.current = false;
      }, TRANSITION_ENTER_MS);
    }, TRANSITION_EXIT_MS);
  };

  const navigateTo = (page: PageKey) => {
    if (page === currentPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    runTransition(() => {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  const handleHeroExplore = (filters?: { city?: string; type?: string; priceType?: string }) => {
    setInitialFilters(filters);
    navigateTo('works');
  };

  const handleSelectProperty = (prop: Property) => {
    setSelectedProperty(prop);
    navigateTo('booking');
  };

  const handleQuickView = (prop: Property) => {
    setSelectedModalProperty(prop);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas flex flex-col justify-between overflow-clip transition-colors duration-300 relative">
        <BackgroundDecor />
        <Navbar currentPage={currentPage} onNavigate={navigateTo} />

      <main className="flex-1">
        <div className={transition === 'out' ? 'page-exit-fade' : transition === 'in' ? 'page-enter-fade' : ''}>
          {currentPage === 'home' && (
            <>
              <HeroSection
                onExplore={handleHeroExplore}
                onBook={() => navigateTo('booking')}
              />
              <Marquee />
              <Reveal direction="up">
                <AboutSection />
              </Reveal>

              <section className="py-14 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6">
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
                      onClick={() => navigateTo('works')}
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
                        onSelect={handleSelectProperty}
                        onQuickView={handleQuickView}
                        onFavToast={showToast}
                      />
                    </Reveal>
                  ))}
                </div>
              </section>
              <Reveal direction="up">
                <ServicesSection onExplore={() => navigateTo('works')} />
              </Reveal>

              <Reveal direction="up">
                <ProcessSection />
              </Reveal>

              <StatsSection />



              <Reveal direction="up">
                <ProjectsSection
                  onExplore={() => navigateTo('works')}
                  onQuickView={handleQuickView}
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
                  onBook={() => navigateTo('booking')}
                  onContact={() => navigateTo('contact')}
                />
              </Reveal>
            </>
          )}

          {currentPage === 'works' && (
            <WorksPage
              onSelect={handleSelectProperty}
              onQuickView={handleQuickView}
              onFavToast={showToast}
              initialFilters={initialFilters}
            />
          )}

          {currentPage === 'booking' && (
            <BookingView
              selectedProperty={selectedProperty}
              onSelectProperty={(p) => setSelectedProperty(p)}
              onSuccessToast={showToast}
            />
          )}

          {currentPage === 'contact' && (
            <ContactPage onSuccessToast={showToast} />
          )}
        </div>
      </main>

      {/* Property Details Quick View Modal */}
      <PropertyModal
        property={selectedModalProperty}
        onClose={() => setSelectedModalProperty(null)}
        onBook={(prop) => {
          setSelectedProperty(prop);
          navigateTo('booking');
        }}
        onToast={showToast}
      />

      <Footer onNavigate={navigateTo} onToast={showToast} />

      {transition !== 'idle' && (
        <div className="page-transition-overlay" aria-hidden="true">
          <div className="page-transition-bar" />
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-md border border-accent/40 text-heading px-6 py-3 rounded-full flex items-center gap-2.5 shadow-lg text-xs font-bold z-50 panel-in">
          <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
    </ThemeProvider>
  );
}
