import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
  Globe,
  Radio,
  Home,
  Building,
  Users,
  Mail,
  Loader2,
} from 'lucide-react';

export type DeviceViewport = 'desktop' | 'tablet' | 'mobile';

interface CmsPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRoute?: string;
}

const PAGES = [
  { id: '/', labelAr: 'الرئيسية', labelEn: 'Home', icon: Home },
  { id: '/works', labelAr: 'المشاريع', labelEn: 'Works', icon: Building },
  { id: '/clients', labelAr: 'الشركاء والعملاء', labelEn: 'Clients', icon: Users },
  { id: '/contact', labelAr: 'التواصل', labelEn: 'Contact', icon: Mail },
];

export const CmsPreviewModal: React.FC<CmsPreviewModalProps> = ({
  isOpen,
  onClose,
  initialRoute = '/',
}) => {
  const [device, setDevice] = useState<DeviceViewport>('desktop');
  const [currentPath, setCurrentPath] = useState<string>(initialRoute);
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState<number>(100);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync initial route when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentPath(initialRoute);
      setIsLoading(true);
    }
  }, [isOpen, initialRoute]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle postMessage language change to iframe
  const handleLangToggle = (nextLang: 'ar' | 'en') => {
    setLang(nextLang);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'AJDA_SET_LANG', lang: nextLang },
        '*'
      );
    } catch {
      // Cross-origin fallback (reload iframe with new lang param)
      setReloadKey((k) => k + 1);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    const url = `${window.location.origin}${currentPath}?lang=${lang}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  const iframeSrc = `${currentPath}?preview=1&lang=${lang}&v=${reloadKey}`;

  // Dimensions based on device
  const getContainerStyles = () => {
    switch (device) {
      case 'mobile':
        return 'w-[380px] h-[780px] max-h-[82vh] rounded-[44px] border-[10px] border-slate-900 shadow-2xl bg-canvas overflow-hidden flex flex-col relative';
      case 'tablet':
        return 'w-[768px] h-[920px] max-h-[85vh] rounded-3xl border-[8px] border-slate-900/80 shadow-2xl bg-canvas overflow-hidden flex flex-col';
      case 'desktop':
      default:
        return 'w-full h-full max-w-[1440px] rounded-2xl border border-muted-border/40 shadow-2xl bg-canvas overflow-hidden flex flex-col';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-md transition-all duration-200"
    >
      {/* Top Header / Control Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface/95 border-b border-muted-border/30 shadow-xs z-20 text-heading">
        {/* Left Side: Title & Live Sync Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl brand-fill text-canvas flex items-center justify-center shadow-xs">
              <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="preview-modal-title" className="text-sm font-black text-heading">معاينة حية متزامنة</h3>
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  مزامنة لحظية
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/70 hidden sm:block">
                انعكاس فوري للتغييرات المحفوظة عبر مقابس الويب (WebSockets)
              </p>
            </div>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-canvas border border-muted-border/30">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              device === 'desktop'
                ? 'brand-fill text-canvas shadow-xs'
                : 'text-neutral-text hover:text-heading'
            }`}
            title="شاشة سطح المكتب (100% / 1280px+)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">سطح المكتب</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('tablet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              device === 'tablet'
                ? 'brand-fill text-canvas shadow-xs'
                : 'text-neutral-text hover:text-heading'
            }`}
            title="جهاز لوحي (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden md:inline">جهاز لوحي</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              device === 'mobile'
                ? 'brand-fill text-canvas shadow-xs'
                : 'text-neutral-text hover:text-heading'
            }`}
            title="هاتف ذكي (380px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">هاتف ذكي</span>
          </button>
        </div>

        {/* Right Side: Page Selector, Language, External, Close */}
        <div className="flex items-center gap-2">
          {/* Page Picker */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-canvas border border-muted-border/30">
            {PAGES.map((page) => {
              const Icon = page.icon;
              const isSelected = currentPath === page.id;
              return (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => {
                    if (currentPath !== page.id) {
                      setIsLoading(true);
                      setCurrentPath(page.id);
                    }
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-neutral-text/80 hover:text-heading'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden lg:inline">{page.labelAr}</span>
                </button>
              );
            })}
          </div>

          {/* Language Switcher */}
          <div className="flex items-center rounded-xl bg-canvas border border-muted-border/30 p-0.5">
            <button
              type="button"
              onClick={() => handleLangToggle('ar')}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                lang === 'ar'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text hover:text-heading'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => handleLangToggle('en')}
              className={`px-2 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                lang === 'en'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text hover:text-heading'
              }`}
            >
              EN
            </button>
          </div>

          {/* Zoom options for desktop view */}
          {device === 'desktop' && (
            <select
              aria-label="تكبير أو تصغير العرض"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="text-xs px-2 py-1 rounded-xl bg-canvas border border-muted-border/30 text-neutral-text focus:outline-none focus:border-primary/50 cursor-pointer hidden xl:block"
            >
              <option value={100}>100%</option>
              <option value={90}>90%</option>
              <option value={80}>80%</option>
              <option value={75}>75%</option>
            </select>
          )}

          {/* Reload Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-xl bg-canvas border border-muted-border/30 hover:border-primary/50 text-neutral-text hover:text-heading transition cursor-pointer"
            title="إعادة تحميل المعاينة"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Open External */}
          <button
            type="button"
            onClick={handleOpenExternal}
            className="p-2 rounded-xl bg-canvas border border-muted-border/30 hover:border-primary/50 text-neutral-text hover:text-heading transition cursor-pointer hidden sm:block"
            title="فتح في تبويب مستقل جديد"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Modal Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-canvas border border-muted-border/30 hover:border-primary/50 text-neutral-text hover:text-heading transition cursor-pointer hidden sm:block"
            title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Modal */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
            title="إغلاق المعاينة (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Preview Workspace */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 overflow-hidden relative bg-black/40">
        {/* Device Wrapper */}
        <div
          className={`${getContainerStyles()} transition-all duration-300`}
          style={{
            transform: device === 'desktop' && zoom !== 100 ? `scale(${zoom / 100})` : 'none',
            transformOrigin: 'top center',
          }}
        >
          {/* Mobile Top Dynamic Island / Notch */}
          {device === 'mobile' && (
            <div className="h-7 w-full bg-slate-900 flex items-center justify-center relative shrink-0">
              <div className="w-24 h-4 bg-black rounded-full flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-800" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
              </div>
            </div>
          )}

          {/* Tablet Camera Bezel */}
          {device === 'tablet' && (
            <div className="h-5 w-full bg-slate-900/90 flex items-center justify-center shrink-0">
              <div className="w-2 h-2 rounded-full bg-slate-800" />
            </div>
          )}

          {/* Desktop Browser Address Bar Simulation */}
          {device === 'desktop' && (
            <div className="flex items-center gap-3 px-4 py-2 bg-surface/80 border-b border-muted-border/30 shrink-0 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-xl bg-canvas border border-muted-border/20 text-neutral-text/70 font-mono text-[11px] truncate">
                <Globe className="w-3 h-3 text-primary shrink-0" />
                <span>
                  https://ajda.sa{currentPath === '/' ? '' : currentPath}?lang={lang}
                </span>
              </div>
            </div>
          )}

          {/* Viewport Frame with Iframe */}
          <div className="relative flex-1 w-full h-full bg-canvas overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-canvas/90 backdrop-blur-xs gap-3">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-xs font-bold text-neutral-text animate-pulse">
                  جاري تحميل الصفحة للمعاينة...
                </p>
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={reloadKey}
              src={iframeSrc}
              title="Ajda CMS Live Preview"
              className="w-full h-full border-0 select-none bg-canvas"
              onLoad={() => setIsLoading(false)}
            />
          </div>

          {/* Mobile Bottom Home Bar Indicator */}
          {device === 'mobile' && (
            <div className="h-5 w-full bg-slate-900 flex items-center justify-center shrink-0">
              <div className="w-28 h-1 bg-slate-600 rounded-full" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
