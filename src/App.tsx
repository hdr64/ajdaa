import { useState, useRef, useEffect } from 'react';
import type { Property } from './types/property';
import { Navbar, type NavPageKey } from './components/common/Navbar';
import { PropertyModal } from './components/common/PropertyModal';
import { Footer } from './components/common/Footer';
import { BackgroundDecor } from './components/common/BackgroundDecor';
import { ThemeProvider } from './context/ThemeProvider';
import {
  HomePage,
  WorksPage,
  ClientsPage,
  ProjectDetailPage,
  InterestRegistrationView,
  ContactPage,
  AdminLoginPage,
  AdminDashboardPage,
} from './pages';
import { AdminStorage } from './services/adminStorage';
import { CheckCircle2 } from 'lucide-react';

export type PageKey = NavPageKey;

interface RouteState {
  page: PageKey;
  projectId?: number;
}

const parsePath = (pathname: string): RouteState => {
  const clean = pathname.replace(/\/$/, '').toLowerCase();

  if (clean.includes('/admin/login')) return { page: 'admin_login' };
  if (clean.endsWith('/admin')) {
    return AdminStorage.isAuthenticated() ? { page: 'admin' } : { page: 'admin_login' };
  }
  if (clean.endsWith('/clients')) return { page: 'clients' };
  if (clean.endsWith('/works')) return { page: 'works' };
  if (clean.endsWith('/booking') || clean.endsWith('/register-interest')) return { page: 'booking' };
  if (clean.endsWith('/contact')) return { page: 'contact' };

  // Match /projects/:id or /project/:id
  const projectMatch = clean.match(/\/projects?\/(\d+)/);
  if (projectMatch && projectMatch[1]) {
    return { page: 'project', projectId: parseInt(projectMatch[1], 10) };
  }

  return { page: 'home' };
};

const getPathForRoute = (route: RouteState): string => {
  const pathname = window.location.pathname;
  let basePath = pathname;
  ['/works', '/clients', '/booking', '/register-interest', '/contact', '/admin/login', '/admin'].forEach((p) => {
    if (basePath.endsWith(p)) {
      basePath = basePath.slice(0, -p.length);
    }
  });

  const projectMatch = basePath.match(/\/projects?\/\d+/);
  if (projectMatch) {
    basePath = basePath.replace(projectMatch[0], '');
  }

  if (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }

  switch (route.page) {
    case 'home':
      return basePath || '/';
    case 'project':
      return `${basePath}/projects/${route.projectId || 206}`;
    case 'admin_login':
      return `${basePath}/admin/login`;
    case 'admin':
      return `${basePath}/admin`;
    case 'booking':
      return `${basePath}/booking`;
    default:
      return `${basePath}/${route.page}`;
  }
};

const TRANSITION_EXIT_MS = 180;
const TRANSITION_ENTER_MS = 220;

export function App() {
  const [route, setRoute] = useState<RouteState>(() => parsePath(window.location.pathname));
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [selectedModalProperty, setSelectedModalProperty] = useState<Property | null>(null);
  const [initialFilters, setInitialFilters] = useState<{ city?: string; type?: string; priceType?: string } | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [transition, setTransition] = useState<'idle' | 'out' | 'in'>('idle');
  const transitioningRef = useRef(false);
  const scrollPositionsRef = useRef<Record<string, number>>({});

  const currentPage = route.page;
  const currentProjectId = route.projectId || 206;

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    if (!window.history.state?.page) {
      const initialRoute = parsePath(window.location.pathname);
      window.history.replaceState(
        { route: initialRoute, scrollY: window.scrollY },
        '',
        getPathForRoute(initialRoute)
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      const routeFromState = (event.state?.route as RouteState) || parsePath(window.location.pathname);
      const targetScrollY = event.state?.scrollY ?? scrollPositionsRef.current[routeFromState.page] ?? 0;

      setTransition('idle');
      transitioningRef.current = false;
      setRoute(routeFromState);
      window.scrollTo({ top: targetScrollY, behavior: 'instant' as ScrollBehavior });
      requestAnimationFrame(() => {
        window.scrollTo({ top: targetScrollY, behavior: 'instant' as ScrollBehavior });
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

  const navigateTo = (page: PageKey, pushHistory = true, options?: { projectId?: number }) => {
    const nextRoute: RouteState = { page, projectId: options?.projectId };

    if (page === currentPage && options?.projectId === route.projectId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const currentScrollY = window.scrollY;
    scrollPositionsRef.current[currentPage] = currentScrollY;
    window.history.replaceState({ route, scrollY: currentScrollY }, '', getPathForRoute(route));

    runTransition(() => {
      setRoute(nextRoute);
      if (pushHistory) {
        window.history.pushState({ route: nextRoute, scrollY: 0 }, '', getPathForRoute(nextRoute));
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
    navigateTo('project', true, { projectId: prop.id });
  };

  // Dedicated Admin views (clean full-screen portals)
  if (currentPage === 'admin_login') {
    return (
      <ThemeProvider>
        <AdminLoginPage
          onLoginSuccess={() => navigateTo('admin')}
          onNavigateHome={() => navigateTo('home')}
        />
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-md border border-accent/40 text-heading px-6 py-3 rounded-full flex items-center gap-2.5 shadow-lg text-xs font-bold z-50 panel-in">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </ThemeProvider>
    );
  }

  if (currentPage === 'admin') {
    if (!AdminStorage.isAuthenticated()) {
      return (
        <ThemeProvider>
          <AdminLoginPage
            onLoginSuccess={() => navigateTo('admin')}
            onNavigateHome={() => navigateTo('home')}
          />
        </ThemeProvider>
      );
    }

    return (
      <ThemeProvider>
        <AdminDashboardPage
          onLogout={() => {
            AdminStorage.logout();
            navigateTo('home');
          }}
          onNavigateHome={() => navigateTo('home')}
          onShowToast={showToast}
        />
        {toastMessage && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-md border border-accent/40 text-heading px-6 py-3 rounded-full flex items-center gap-2.5 shadow-lg text-xs font-bold z-50 panel-in">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </ThemeProvider>
    );
  }

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

            {currentPage === 'clients' && (
              <ClientsPage onNavigate={navigateTo} />
            )}

            {currentPage === 'project' && (
              <ProjectDetailPage
                projectId={currentProjectId}
                onNavigate={(p, opts) => navigateTo(p, true, opts)}
                onShowToast={showToast}
              />
            )}

            {currentPage === 'booking' && (
              <InterestRegistrationView
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
          onViewProjectPage={(prop) => {
            setSelectedModalProperty(null);
            navigateTo('project', true, { projectId: prop.id });
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
