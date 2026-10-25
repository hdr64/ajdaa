import React, { useState, useEffect, useRef } from 'react';
import {
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  X,
  Maximize2,
  Globe,
  Radio,
  Home,
  Building,
  Users,
  Mail,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { acquireSocket, releaseSocket } from '../../../services/realtimeSocket';

export type DeviceViewport = 'desktop' | 'tablet' | 'mobile';

export interface CmsLivePreviewPaneProps {
  currentPath: string;
  onPathChange?: (path: string) => void;
  onExpandFullscreen?: () => void;
  onClose?: () => void;
  isSplitView?: boolean;
}

const PAGES = [
  { id: '/', labelAr: 'الرئيسية', labelEn: 'Home', icon: Home },
  { id: '/works', labelAr: 'المشاريع', labelEn: 'Works', icon: Building },
  { id: '/clients', labelAr: 'الشركاء والعملاء', labelEn: 'Clients', icon: Users },
  { id: '/contact', labelAr: 'التواصل', labelEn: 'Contact', icon: Mail },
];

export const CmsLivePreviewPane: React.FC<CmsLivePreviewPaneProps> = ({
  currentPath,
  onPathChange,
  onExpandFullscreen,
  onClose,
  isSplitView = false,
}) => {
  const [device, setDevice] = useState<DeviceViewport>(isSplitView ? 'desktop' : 'desktop');
  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const [zoom, setZoom] = useState<number>(isSplitView ? 80 : 100);
  const [isLoading, setIsLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [justUpdated, setJustUpdated] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Real-time flash notification when backend broadcasts CMS update
  useEffect(() => {
    const socket = acquireSocket();

    const handleCmsUpdate = () => {
      setJustUpdated(true);
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => {
        setJustUpdated(false);
      }, 2500);
    };

    socket.on('cms:updated', handleCmsUpdate);
    socket.on('cms:clients:updated', handleCmsUpdate);

    return () => {
      socket.off('cms:updated', handleCmsUpdate);
      socket.off('cms:clients:updated', handleCmsUpdate);
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      releaseSocket();
    };
  }, []);

  const iframeSrc = `${currentPath}?preview=1&lang=${lang}&v=${reloadKey}`;

  // Container styling depending on device
  const getContainerStyles = () => {
    switch (device) {
      case 'mobile':
        return isSplitView
          ? 'w-[360px] h-[720px] max-h-[calc(100vh-230px)] rounded-[40px] border-[8px] border-slate-900 shadow-2xl bg-canvas overflow-hidden flex flex-col mx-auto'
          : 'w-[380px] h-[780px] max-h-[82vh] rounded-[44px] border-[10px] border-slate-900 shadow-2xl bg-canvas overflow-hidden flex flex-col relative mx-auto';
      case 'tablet':
        return isSplitView
          ? 'w-[720px] max-w-full h-[820px] max-h-[calc(100vh-230px)] rounded-3xl border-[8px] border-slate-900/80 shadow-2xl bg-canvas overflow-hidden flex flex-col mx-auto'
          : 'w-[768px] h-[920px] max-h-[85vh] rounded-3xl border-[8px] border-slate-900/80 shadow-2xl bg-canvas overflow-hidden flex flex-col mx-auto';
      case 'desktop':
      default:
        return 'w-full h-full rounded-2xl border border-muted-border/40 shadow-xl bg-canvas overflow-hidden flex flex-col';
    }
  };

  return (
    <div
      className={`flex flex-col bg-surface rounded-3xl border border-muted-border/40 shadow-sm overflow-hidden transition-all duration-300 ${
        isSplitView ? 'h-[calc(100vh-140px)] min-h-[580px]' : 'w-full h-full'
      }`}
    >
      {/* Top Header / Control Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-surface/95 border-b border-muted-border/30 shrink-0 text-heading">
        {/* Left Side: Title & Live Sync Badge */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl brand-fill text-canvas flex items-center justify-center shadow-xs">
              <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-heading">معاينة حية للموقع</span>
              {justUpdated ? (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary text-canvas animate-bounce shadow-xs">
                  <Sparkles className="w-3 h-3" />
                  تم التحديث الآن!
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  مزامنة لحظية
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center gap-1 p-0.5 rounded-2xl bg-canvas border border-muted-border/30">
          <button
            type="button"
            onClick={() => setDevice('desktop')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
              device === 'desktop'
                ? 'brand-fill text-canvas shadow-xs'
                : 'text-neutral-text hover:text-heading'
            }`}
            title="سطح المكتب (عرض كامل)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">سطح المكتب</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('tablet')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
              device === 'tablet'
                ? 'brand-fill text-canvas shadow-xs'
                : 'text-neutral-text hover:text-heading'
            }`}
            title="جهاز لوحي (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">لوحي</span>
          </button>
          <button
            type="button"
            onClick={() => setDevice('mobile')}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-xl transition cursor-pointer ${
              device === 'mobile'
                ? 'brand-fill text-canvas shadow-xs'
                : 'text-neutral-text hover:text-heading'
            }`}
            title="هاتف ذكي (375px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px]">هاتف</span>
          </button>
        </div>

        {/* Right Side: Page Selector, Language, Zoom, Fullscreen, Close */}
        <div className="flex items-center gap-1.5">
          {/* Page Picker (Dropdown or compact pills) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-canvas border border-muted-border/30">
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
                      onPathChange?.(page.id);
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                    isSelected
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-neutral-text/70 hover:text-heading'
                  }`}
                  title={page.labelAr}
                >
                  <Icon className="w-3 h-3" />
                  <span className={isSplitView ? 'hidden xl:inline' : 'hidden md:inline'}>
                    {page.labelAr}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Language Switcher */}
          <div className="flex items-center rounded-xl bg-canvas border border-muted-border/30 p-0.5">
            <button
              type="button"
              onClick={() => handleLangToggle('ar')}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
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
              className={`px-2 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${
                lang === 'en'
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'text-neutral-text hover:text-heading'
              }`}
            >
              EN
            </button>
          </div>

          {/* Zoom options */}
          <select
            aria-label="تكبير أو تصغير العرض"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="text-[11px] px-1.5 py-1 rounded-xl bg-canvas border border-muted-border/30 text-neutral-text focus:outline-none focus:border-primary/50 cursor-pointer hidden sm:block"
            title="مقياس العرض (Zoom)"
          >
            <option value={100}>100%</option>
            <option value={90}>90%</option>
            <option value={80}>80%</option>
            <option value={75}>75%</option>
            <option value={67}>67%</option>
            <option value={50}>50%</option>
          </select>

          {/* Reload Button */}
          <button
            type="button"
            onClick={handleRefresh}
            className="p-1.5 rounded-xl bg-canvas border border-muted-border/30 hover:border-primary/50 text-neutral-text hover:text-heading transition cursor-pointer"
            title="إعادة تحميل المعاينة"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </button>

          {/* Open External Tab */}
          <button
            type="button"
            onClick={handleOpenExternal}
            className="p-1.5 rounded-xl bg-canvas border border-muted-border/30 hover:border-primary/50 text-neutral-text hover:text-heading transition cursor-pointer hidden md:block"
            title="فتح في تبويب مستقل جديد"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          {/* Expand to Fullscreen Modal (if in split view) */}
          {isSplitView && onExpandFullscreen && (
            <button
              type="button"
              onClick={onExpandFullscreen}
              className="p-1.5 rounded-xl bg-canvas border border-muted-border/30 hover:border-primary/50 text-neutral-text hover:text-heading transition cursor-pointer"
              title="توسيع ملء الشاشة"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Close Split View */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition cursor-pointer"
              title="إخفاء المعاينة الجانبية"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Preview Container */}
      <div className="flex-1 flex items-center justify-center p-2.5 sm:p-4 overflow-hidden relative bg-black/5 dark:bg-black/30">
        <div
          className={`${getContainerStyles()} transition-all duration-300`}
          style={{
            transform: zoom !== 100 ? `scale(${zoom / 100})` : 'none',
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

          {/* Browser Address Bar Simulation */}
          {device === 'desktop' && (
            <div className="flex items-center gap-2.5 px-3 py-1.5 bg-surface/80 border-b border-muted-border/30 shrink-0 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500/80 inline-block" />
                <span className="w-2 h-2 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <div className="flex-1 flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-canvas border border-muted-border/20 text-neutral-text/70 font-mono text-[10px] truncate">
                <Globe className="w-3 h-3 text-primary shrink-0" />
                <span>
                  https://ajda.sa{currentPath === '/' ? '' : currentPath}?lang={lang}
                </span>
              </div>
            </div>
          )}

          {/* Iframe Viewport Frame */}
          <div className="relative flex-1 w-full h-full bg-canvas overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-canvas/90 backdrop-blur-xs gap-2">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
                <p className="text-[11px] font-bold text-neutral-text animate-pulse">
                  جاري تحميل المعاينة...
                </p>
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={reloadKey}
              src={iframeSrc}
              title="Ajda CMS Live Preview Frame"
              className="w-full h-full border-0 select-none bg-canvas"
              onLoad={() => setIsLoading(false)}
            />
          </div>

          {/* Mobile Bottom Home Bar Indicator */}
          {device === 'mobile' && (
            <div className="h-5 w-full bg-slate-900 flex items-center justify-center shrink-0">
              <div className="w-24 h-1 bg-slate-600 rounded-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
