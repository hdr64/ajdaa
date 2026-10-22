import React, { useCallback, useEffect, useState } from 'react';
import { Archive, X, ChevronLeft, ChevronRight, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { pastProjectService, type PastProject } from '../services/pastProjectService';
import type { NavPageKey } from '../components/common/Navbar';

interface Props {
  onNavigate: (page: NavPageKey) => void;
}

const ALLOWED_URL_RE = /^(https:\/\/|\/uploads\/)[^\s"'<>\\]+$/;

function isAllowedUrl(url: string | null | undefined): boolean {
  return !!url && url.length <= 500 && ALLOWED_URL_RE.test(url);
}

function pick(ar: string | null, en: string | null, language: string): string {
  if (language === 'en') return (en && en.trim()) || (ar ?? '');
  return (ar ?? '') || (en ?? '');
}

export const PastProjectsPage: React.FC<Props> = () => {
  const { language, isRTL } = useLanguage();
  const [items, setItems] = useState<PastProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PastProject | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pastProjectService.list();
      setItems(data);
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!active) return;
    const gallery = active.gallery ?? [];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActive(null);
        return;
      }
      if (gallery.length > 1) {
        if (e.key === 'ArrowLeft') {
          setGalleryIndex((i) => (i - 1 + gallery.length) % gallery.length);
        } else if (e.key === 'ArrowRight') {
          setGalleryIndex((i) => (i + 1) % gallery.length);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const openDetail = (item: PastProject) => {
    setActive(item);
    setGalleryIndex(0);
  };

  const t = (ar: string, en: string) => (language === 'ar' ? ar : en);

  return (
    <div className="pt-28 sm:pt-36 pb-24 min-h-screen relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-2 text-xs font-bold brand-badge px-4 py-2 rounded-full mb-4">
            <Archive className="w-3.5 h-3.5 text-accent" />
            {t('أعمالنا السابقة', 'Past Works')}
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-heading tracking-tight leading-tight">
            {t('أعمالنا السابقة', 'Our Past Works')}
          </h1>
          <p className="mt-4 text-sm sm:text-base text-neutral-text/75 leading-relaxed">
            {t('مجموعة من المشاريع التي أنجزناها', 'A collection of projects we have delivered')}
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl bg-surface border border-muted-border/40 p-4 animate-pulse">
                <div className="h-48 rounded-2xl bg-muted-border/30 mb-4" />
                <div className="h-4 rounded bg-muted-border/30 mb-2" />
                <div className="h-3 rounded bg-muted-border/30 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-neutral-text/75 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="brand-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2"
            >
              <Loader2 className="w-3.5 h-3.5" />
              {t('إعادة المحاولة', 'Retry')}
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="text-center py-16">
            <Archive className="w-10 h-10 text-neutral-text/40 mx-auto mb-3" />
            <p className="text-sm text-neutral-text/75">لا توجد أعمال سابقة حالياً</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const title = pick(item.title, item.titleEn, language);
              const category = pick(item.category, item.categoryEn, language);
              const desc = pick(item.description, item.descriptionEn, language);
              const short = desc.length > 140 ? desc.slice(0, 140) + '…' : desc;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openDetail(item)}
                  className="text-start rounded-3xl bg-surface border border-muted-border/40 hover:border-accent/40 overflow-hidden transition-all hover:-translate-y-1 shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={item.image}
                      alt={title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <div className="p-5">
                    {category && (
                      <span className="inline-block text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 mb-2">
                        {category}
                      </span>
                    )}
                    <h3 className="text-base font-black text-heading mb-2 line-clamp-2">{title}</h3>
                    {short && <p className="text-xs text-neutral-text/70 leading-relaxed line-clamp-3">{short}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActive(null);
          }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-heading">
                {pick( active.title, active.titleEn, language)}
              </h3>
              <button type="button" onClick={() => setActive(null)} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer" aria-label="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>

            {active.gallery && active.gallery.length > 0 ? (
              <div className="relative">
                <img
                  src={active.gallery[galleryIndex]}
                  alt={`gallery-${galleryIndex}`}
                  className="w-full max-h-[50vh] object-contain rounded-2xl bg-canvas"
                />
                {active.gallery.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i - 1 + active.gallery.length) % active.gallery.length)}
                      className="absolute top-1/2 start-2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-accent cursor-pointer"
                      aria-label="السابق"
                    >
                      {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i + 1) % active.gallery.length)}
                      className="absolute top-1/2 end-2 -translate-y-1/2 p-2 rounded-full bg-black/60 text-white hover:bg-accent cursor-pointer"
                      aria-label="التالي"
                    >
                      {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <img
                src={active.image}
                alt={pick( active.title, active.titleEn, language)}
                className="w-full max-h-[50vh] object-contain rounded-2xl bg-canvas"
              />
            )}

            {active.category && (
              <span className="inline-block text-[11px] font-bold px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                {pick( active.category, active.categoryEn, language)}
              </span>
            )}

            <p className="text-sm text-neutral-text/80 leading-relaxed whitespace-pre-line">
              {pick( active.description, active.descriptionEn, language)}
            </p>

            {isAllowedUrl(active.pdfUrl) && (
              <a
                href={active.pdfUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 brand-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold"
              >
                <Download className="w-4 h-4" />
                {t('تحميل ملف المشروع (PDF)', 'Download Project Profile (PDF)')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};