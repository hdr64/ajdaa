import { useState, useRef } from 'react';
import type { Property } from './types/property';
import { properties } from './data/properties';
import { Navbar } from './components/common/Navbar';
import { HeroSection } from './components/home/HeroSection';
import { Marquee } from './components/home/Marquee';
import { ServicesSection } from './components/home/ServicesSection';
import { ProcessSection } from './components/home/ProcessSection';
import { StatsSection } from './components/home/StatsSection';
import { Testimonials } from './components/home/Testimonials';
import { CtaSection } from './components/home/CtaSection';
import { ProjectsSection } from './components/home/ProjectsSection';
import { VideoSection } from './components/home/VideoSection';
import { AboutSection } from './components/home/AboutSection';
import { ContactPage } from './components/contact/ContactPage';
import { PropertyCard } from './components/common/PropertyCard';
import { PropertyModal } from './components/common/PropertyModal';
import { WorksPage } from './components/works/WorksPage';
import { BookingView } from './components/booking/BookingView';
import { Reveal } from './components/common/Reveal';
import { ThemeProvider } from './context/ThemeProvider';
import { useLanguage } from './hooks/useLanguage';
import { CheckCircle2, Phone, Mail, MapPin, Building2, Clock, Send, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';

const SOCIALS: { label: string; path: string }[] = [
  {
    label: 'X',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
  },
  {
    label: 'فيسبوك',
    path: 'M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z',
  },
  {
    label: 'انستغرام',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z',
  },
  {
    label: 'لينكد إن',
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.064 2.064 0 1 1 0-4.128 2.064 2.064 0 0 1 0 4.128ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z',
  },
];

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
  const [newsletterEmail, setNewsletterEmail] = useState('');
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

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail.trim()) {
      showToast(t.footer.newsletterSuccess);
      setNewsletterEmail('');
    }
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-canvas flex flex-col justify-between overflow-clip transition-colors duration-300">
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
                <ProjectsSection onExplore={() => navigateTo('works')} />
              </Reveal>

              <Reveal direction="up">
                <VideoSection />
              </Reveal>

              <Reveal direction="up">
                <Testimonials />
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

      <footer className="relative bg-canvas-dark border-t border-muted-border/20 pt-16 pb-8 overflow-hidden">
        {/* Animated Light Beam */}
        <div className="absolute top-0 inset-x-0 h-1 footer-top-beam" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-accent/10 blur-[130px] rounded-full pointer-events-none" />

        <Reveal direction="up">
          <div className="relative max-w-7xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-14">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 brand-btn-primary rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                  <Building2 className="w-5 h-5 text-[var(--brand-btn-text)]" />
                </div>
                <div>
                  <span className="text-xl font-black brand-gradient-text block leading-tight">{t.nav.brandName}</span>
                  <span className="text-[10px] text-neutral-text/50 font-bold tracking-widest">{t.nav.brandSub}</span>
                </div>
              </div>
              <p className="text-xs text-neutral-text/70 leading-relaxed mb-6">
                {t.footer.brandDesc}
              </p>
              <div className="flex items-center gap-2.5">
                {SOCIALS.map((social) => (
                  <a
                    key={social.label}
                    href="#"
                    onClick={(e) => e.preventDefault()}
                    aria-label={social.label}
                    className="w-9 h-9 rounded-full border border-muted-border/30 flex items-center justify-center text-neutral-text/70 hover:text-accent hover:border-accent/80 hover:bg-accent/15 social-icon-glow cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path d={social.path} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-heading mb-5">{t.footer.quickLinks}</h4>
              <div className="flex flex-col gap-3 text-xs text-neutral-text/70">
                {[
                  { label: t.footer.navHome, page: 'home' as const },
                  { label: t.footer.navWorks, page: 'works' as const },
                  { label: t.footer.navBooking, page: 'booking' as const },
                  { label: t.footer.navContact, page: 'contact' as const },
                ].map((link) => {
                  const Chevron = isRTL ? ChevronLeft : ChevronRight;
                  return (
                    <button
                      key={link.page}
                      onClick={() => navigateTo(link.page)}
                      className="flex items-center gap-1.5 text-start hover:text-accent transition cursor-pointer group font-semibold"
                    >
                      <Chevron className={`w-3.5 h-3.5 text-accent/70 ${isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'} transition-transform duration-300`} />
                      {link.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-heading mb-5">{t.footer.servicesTitle}</h4>
              <div className="flex flex-col gap-3 text-xs text-neutral-text/70">
                {t.footer.services.map((service) => {
                  const Chevron = isRTL ? ChevronLeft : ChevronRight;
                  return (
                    <button
                      key={service}
                      onClick={() => navigateTo('works')}
                      className="flex items-center gap-1.5 text-start hover:text-accent transition cursor-pointer group font-semibold"
                    >
                      <Chevron className={`w-3.5 h-3.5 text-accent/70 ${isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1'} transition-transform duration-300`} />
                      {service}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold text-heading mb-5">{t.footer.contactTitle}</h4>
              <div className="space-y-3 text-xs text-neutral-text/70 mb-6">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-accent shrink-0" />
                  <span>{t.footer.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-accent shrink-0" />
                  <span dir="ltr">+966 58 048 4528</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-accent shrink-0" />
                  <span dir="ltr">info@ajdaa.sa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent shrink-0" />
                  <span>{t.footer.hours}</span>
                </div>
              </div>

              <h4 className="text-sm font-bold text-heading mb-3">{t.footer.newsletterTitle}</h4>
              <form
                onSubmit={handleNewsletterSubmit}
                className="flex items-center gap-2 bg-surface/80 border border-muted-border/40 rounded-xl p-1.5 focus-within:border-accent transition shadow-sm"
              >
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder={t.footer.newsletterPlaceholder}
                  aria-label={t.footer.newsletterTitle}
                  className="flex-1 bg-transparent text-xs text-neutral-text placeholder:text-neutral-text/50 px-2 outline-none min-w-0"
                />
                <button type="submit" className="brand-btn-primary w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0 hover:scale-105 transition">
                  <Send className="w-3.5 h-3.5 text-[var(--brand-btn-text)]" />
                </button>
              </form>
            </div>
          </div>
        </Reveal>

        <div className="relative max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-[11px] text-neutral-text/40 border-t border-muted-border/10 pt-6">
          <p>© 2026 {t.nav.brandName} ({t.nav.brandSub}). {t.footer.rights}</p>
          <div className="flex items-center gap-4">
            <p>{t.footer.madeIn}</p>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label={t.footer.backToTop}
              className="w-9 h-9 rounded-xl border border-muted-border/30 flex items-center justify-center text-neutral-text/60 hover:text-accent hover:border-accent/80 hover:bg-accent/15 transition cursor-pointer booking-pulse"
              title={t.footer.backToTop}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>

      {transition !== 'idle' && (
        <div className="page-transition-overlay" aria-hidden="true">
          <div className="page-transition-bar" />
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface/95 backdrop-blur-md border border-accent/50 text-heading px-6 py-3.5 rounded-full flex items-center gap-2.5 shadow-2xl text-xs font-bold z-50 animate-bounce">
          <CheckCircle2 className="w-4.5 h-4.5 text-success shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
    </ThemeProvider>
  );
}
