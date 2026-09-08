import { useState, useRef, useEffect } from 'react';
import type { Property } from './types/property';
import { Navbar } from './components/common/Navbar';
import { PropertyModal } from './components/common/PropertyModal';
import { Footer } from './components/common/Footer';
import { BackgroundDecor } from './components/common/BackgroundDecor';
import { ThemeProvider } from './context/ThemeProvider';
import { HomePage, WorksPage, BookingPage, ContactPage } from './pages';
import { CheckCircle2 } from 'lucide-react';

type PageKey = 'home' | 'works' | 'booking' | 'contact';

const getPageFromPath = (pathname: string): PageKey => {
  const cleanPath = pathname.replace(/\/$/, '').toLowerCase();
  if (cleanPath.endsWith('/works')) return 'works';
  if (cleanPath.endsWith('/booking')) return 'booking';
  if (cleanPath.endsWith('/contact')) return 'contact';
  return 'home';
};

const getPathForPage = (page: PageKey): string => {
  const pathname = window.location.pathname;
  let basePath = pathname;
  ['/works', '/booking', '/contact'].forEach((p) => {
    if (basePath.endsWith(p)) {
      basePath = basePath.slice(0, -p.length);
    }
  });
  if (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }

  if (page === 'home') return basePath || '/';
  return `${basePath}/${page}`;
};

const TRANSITION_EXIT_MS = 400;
const TRANSITION_ENTER_MS = 650;

export function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>(() => getPageFromPath(window.location.pathname));
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedModalProperty, setSelectedModalProperty] = useState<Property | null>(null);
  const [initialFilters, setInitialFilters] = useState<{ city?: string; type?: string; priceType?: string } | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [transition, setTransition] = useState<'idle' | 'out' | 'in'>('idle');
  const transitioningRef = useRef(false);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    if (!window.history.state?.page) {
      const initialPage = getPageFromPath(window.location.pathname);
      window.history.replaceState({ page: initialPage, scrollY: window.scrollY }, '', getPathForPage(initialPage));
    }

    const handlePopState = (event: PopStateEvent) => {
      const pageFromState = (event.state?.page as PageKey) || getPageFromPath(window.location.pathname);
      const targetScrollY = event.state?.scrollY ?? scrollPositionsRef.current[pageFromState] ?? 0;

      runTransition(() => {
        setCurrentPage(pageFromState);
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetScrollY, behavior: 'auto' });
        });
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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

  const navigateTo = (page: PageKey, pushHistory = true) => {
    if (page === currentPage) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const currentScrollY = window.scrollY;
    scrollPositionsRef.current[currentPage] = currentScrollY;
    window.history.replaceState({ page: currentPage, scrollY: currentScrollY }, '', getPathForPage(currentPage));

    runTransition(() => {
      setCurrentPage(page);
      if (pushHistory) {
        window.history.pushState({ page, scrollY: 0 }, '', getPathForPage(page));
      }
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
              <HomePage
                onExploreHero={handleHeroExplore}
                onNavigate={navigateTo}
                onSelectProperty={handleSelectProperty}
                onQuickView={handleQuickView}
                onShowToast={showToast}
              />
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
              <BookingPage
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
