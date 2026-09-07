import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  Tag,
  ArrowUpDown,
  SearchX,
  SlidersHorizontal,
  RotateCcw,
  LayoutGrid,
  List,
  Briefcase,
  Warehouse,
  Store,
  Sparkles,
  X,
  Maximize2,
  BedDouble,
  Bath,
  ArrowLeft,
  ChevronDown,
  ShieldCheck,
} from 'lucide-react';
import { properties } from '../../data/properties';
import type { Property, PropertyType, PriceType } from '../../types/property';
import { PropertyCard } from '../common/PropertyCard';

interface WorksPageProps {
  onSelect: (prop: Property) => void;
  onQuickView?: (prop: Property) => void;
  onFavToast?: (msg: string) => void;
  initialFilters?: { city?: string; type?: string; priceType?: string };
}

const MIN_LOADING_MS = 500;
const MAX_LOADING_MS = 1500;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const preloadImages = (): Promise<void> => {
  const tasks = properties.map(
    (p) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = p.image;
      }),
  );
  return Promise.all(tasks).then(() => undefined);
};

const typeLabels: Record<PropertyType, string> = {
  logistics: 'مستودعات ومخازن',
  commercial: 'محلات ومجمعات تجارية',
  office: 'مكاتب ومباني إدارية',
};

type CategoryKey = 'all' | PropertyType;
type SortKey = 'default' | 'area-desc' | 'area-asc' | 'rooms-desc';

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'default', label: 'الترتيب الافتراضي' },
  { key: 'area-desc', label: 'المساحة: الأكبر أولاً' },
  { key: 'area-asc', label: 'المساحة: الأصغر أولاً' },
  { key: 'rooms-desc', label: 'عدد الوحدات / الغرف' },
];

const categoryIcons: Record<CategoryKey, React.ComponentType<{ className?: string }>> = {
  all: LayoutGrid,
  logistics: Warehouse,
  commercial: Store,
  office: Briefcase,
};

const specChip =
  'flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-neutral-text/80';

const SkeletonCard: React.FC = () => (
  <div className="glass-card rounded-2xl overflow-hidden">
    <div className="skeleton h-60" />
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-4 w-1/3 rounded-full" />
        <div className="skeleton h-5 w-16 rounded-full" />
      </div>
      <div className="skeleton h-5 w-2/3 rounded-full" />
      <div className="skeleton h-9 w-full rounded-xl" />
      <div className="flex items-center justify-between pt-2">
        <div className="skeleton h-4 w-1/4 rounded-full" />
        <div className="skeleton h-9 w-24 rounded-full" />
      </div>
    </div>
  </div>
);

const SkeletonGrid: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" aria-hidden="true">
    {Array.from({ length: 6 }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

const EmptyState: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <div className="glass-card rounded-3xl p-14 text-center">
    <div className="w-16 h-16 mx-auto rounded-2xl bg-accent/10 border border-accent/25 flex items-center justify-center text-accent mb-6">
      <SearchX className="w-8 h-8" />
    </div>
    <h3 className="text-xl font-black mb-3">لا توجد نتائج مطابقة للبحث</h3>
    <p className="text-sm text-neutral-text/60 mb-7 leading-relaxed max-w-sm mx-auto">
      جرّب تعديل الكلمات الدالة أو إعادة تعيين الفلاتر للعثور على العقار المناسب
    </p>
    <button
      onClick={onReset}
      className="brand-btn-primary font-bold text-xs px-6 py-3 rounded-full cursor-pointer"
    >
      إعادة تعيين الفلاتر
    </button>
  </div>
);

export const WorksPage: React.FC<WorksPageProps> = ({
  onSelect,
  onQuickView,
  onFavToast,
  initialFilters,
}) => {
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>(() => {
    if (!initialFilters?.type || initialFilters.type === 'الكل') return 'all';
    const t = initialFilters.type;
    if (t.includes('مستودع') || t.includes('لوجست') || t === 'logistics') return 'logistics';
    if (t.includes('محل') || t.includes('تجار') || t === 'commercial') return 'commercial';
    if (t.includes('مكتب') || t.includes('مبان') || t.includes('إدار') || t === 'office') return 'office';
    return 'all';
  });
  const [city, setCity] = useState<string>(
    initialFilters?.city && initialFilters.city !== 'الكل' ? initialFilters.city : 'all'
  );
  const [priceType, setPriceType] = useState<'all' | PriceType>(
    initialFilters?.priceType && initialFilters.priceType !== 'all'
      ? (initialFilters.priceType as PriceType)
      : 'all'
  );
  const [sort, setSort] = useState<SortKey>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.race([
        Promise.all([preloadImages(), wait(MIN_LOADING_MS)]),
        wait(MAX_LOADING_MS),
      ]);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo<{ key: CategoryKey; label: string; count: number }[]>(() => {
    const counts = properties.reduce<Record<CategoryKey, number>>(
      (acc, p) => {
        acc[p.type] = (acc[p.type] ?? 0) + 1;
        acc.all += 1;
        return acc;
      },
      { all: 0, logistics: 0, commercial: 0, office: 0 },
    );
    return [
      { key: 'all', label: 'الكل', count: counts.all },
      ...(Object.keys(typeLabels) as PropertyType[]).map((t) => ({
        key: t as CategoryKey,
        label: typeLabels[t],
        count: counts[t] || 0,
      })),
    ];
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(properties.map((p) => p.city))).sort(),
    [],
  );

  const featured = useMemo(
    () => properties.find((p) => p.badge?.includes('رئيسي')) || properties[0],
    [],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    let list = properties.filter((p) => {
      if (category !== 'all' && p.type !== category) return false;
      if (city !== 'all' && p.city !== city) return false;
      if (priceType !== 'all' && p.priceType !== priceType) return false;
      if (q && !(p.title.includes(q) || p.city.includes(q) || p.typeAr.includes(q))) return false;
      return true;
    });

    switch (sort) {
      case 'area-desc':
        list = [...list].sort((a, b) => b.area - a.area);
        break;
      case 'area-asc':
        list = [...list].sort((a, b) => a.area - b.area);
        break;
      case 'rooms-desc':
        list = [...list].sort((a, b) => (b.rooms ?? 0) - (a.rooms ?? 0));
        break;
      default:
        break;
    }
    return list;
  }, [query, category, city, priceType, sort]);

  const hasActiveFilters =
    query.trim() !== '' || category !== 'all' || city !== 'all' || priceType !== 'all';

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (query.trim()) chips.push({ key: 'q', label: `"${query.trim()}"`, onRemove: () => setQuery('') });
    if (category !== 'all')
      chips.push({ key: 'cat', label: typeLabels[category], onRemove: () => setCategory('all') });
    if (city !== 'all') chips.push({ key: 'city', label: city, onRemove: () => setCity('all') });
    if (priceType !== 'all') chips.push({ key: 'pt', label: priceType, onRemove: () => setPriceType('all') });
    return chips;
  }, [query, category, city, priceType]);

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setCity('all');
    setPriceType('all');
    setSort('default');
  };

  const filterKey = `${query}|${category}|${city}|${priceType}|${sort}`;
  const selectShell = 'field-shell w-full text-sm';

  return (
    <div className="relative pt-32 pb-24 max-w-7xl mx-auto px-6 ">
      {/* Mobile Collapsible Filter Toggle Header */}
      <button
        onClick={() => setMobileFilterOpen((v) => !v)}
        className="w-full md:hidden flex items-center justify-between p-4 rounded-2xl bg-surface/98 border border-accent/40 font-bold text-xs text-heading cursor-pointer mb-4 shadow-xl sticky top-20 z-30"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-accent" />
          <span>خيارات البحث وتصفية العقارات</span>
          {hasActiveFilters && (
            <span className="brand-badge text-[10px] px-2 py-0.5 rounded-full font-bold">
              فلاتر نشطة
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-300 ${
            mobileFilterOpen ? 'rotate-180 text-accent' : ''
          }`}
        />
      </button>

      {/* Filter Bar Container */}
      <div
        className={`bg-surface/98 border border-accent/30 rounded-3xl p-5 md:p-6 mb-8 sticky top-20 z-30 shadow-2xl shadow-black/20 transition-all duration-300 ${
          mobileFilterOpen ? 'block' : 'hidden md:block'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          <span className="flex items-center gap-1.5 text-xs text-neutral-text/50 font-semibold ml-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
            الفئات:
          </span>
          {categories.map((cat) => {
            const Icon = categoryIcons[cat.key];
            return (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                  category === cat.key
                    ? 'brand-fill text-canvas shadow-lg shadow-accent/30 scale-105'
                    : 'bg-surface/40 border border-muted-border/25 text-neutral-text/60 hover:text-heading hover:border-accent/40 hover:-translate-y-0.5'
                }`}
              >
                <Icon
                  className={`w-3.5 h-3.5 ${
                    category === cat.key ? 'text-canvas' : 'text-accent/70'
                  }`}
                />
                {cat.label}
                <span
                  className={`text-[10px] ${
                    category === cat.key ? 'opacity-70' : 'text-gold/70'
                  }`}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="h-px bg-muted-border/15 mb-5" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={selectShell}>
            <Search className="w-4 h-4 text-accent shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث بالاسم أو المدينة..."
              className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-neutral-text/40 hover:text-heading transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className={selectShell}>
            <MapPin className="w-4 h-4 text-accent shrink-0" />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="field-select"
            >
              <option value="all">كل المدن</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={selectShell}>
            <Tag className="w-4 h-4 text-accent shrink-0" />
            <select
              value={priceType}
              onChange={(e) => setPriceType(e.target.value as 'all' | PriceType)}
              className="field-select"
            >
              <option value="all">كل العقود والفرص</option>
              <option value="إيجار">تأجير واستثمار</option>
              <option value="بيع">بيع وتملك</option>
              <option value="استثمار">فرص استثمارية</option>
            </select>
          </div>

          <div className={selectShell}>
            <ArrowUpDown className="w-4 h-4 text-accent shrink-0" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="field-select"
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Featured Banner when no query */}
      {!hasActiveFilters && (
        <div
          className="relative mb-10 rounded-[28px] p-px bg-gradient-to-l from-accent/40 via-gold/35 to-accent/40 stagger-anim cursor-pointer"
          style={{ animationDelay: '220ms' }}
          onClick={() => onQuickView?.(featured)}
        >
          <div className="relative overflow-hidden rounded-[27px] bg-gradient-to-l from-surface/80 to-canvas/60 backdrop-blur-2xl group">
            <div
              aria-hidden
              className="absolute -top-24 -left-24 w-72 h-72 bg-gold/10 blur-[100px] rounded-full pointer-events-none"
            />

            <div className="grid md:grid-cols-2 items-stretch">
              <div className="relative order-1 md:order-2 h-64 md:h-auto overflow-hidden img-shine">
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-l from-canvas/90 via-canvas/20 to-transparent" />
              </div>

              <div className="relative order-2 md:order-1 p-8 md:p-10 flex flex-col justify-center">
                <span className="flex items-center gap-1.5 w-fit text-[11px] font-bold px-3.5 py-1.5 rounded-full bg-gold/15 border border-gold/40 text-gold-light mb-4">
                  <Sparkles className="w-3.5 h-3.5 text-gold" />
                  المشروع الاستراتيجي المميز
                </span>

                <h3 className="text-2xl md:text-3xl font-black text-heading mb-3 leading-snug group-hover:text-accent transition-colors">
                  {featured.title}
                </h3>
                <p className="text-xs text-neutral-text/60 mb-6 flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  {featured.city} · {featured.typeAr} · {featured.priceType}
                </p>

                <div className="flex flex-wrap gap-2.5 mb-7">
                  <span className={specChip}>
                    <Maximize2 className="w-3 h-3 text-accent" /> {featured.area.toLocaleString('en-US')} م²
                  </span>
                  {featured.rooms && featured.rooms > 0 ? (
                    <>
                      <span className={specChip}>
                        <BedDouble className="w-3 h-3 text-accent" /> {featured.rooms} غرف
                      </span>
                      <span className={specChip}>
                        <Bath className="w-3 h-3 text-accent" /> {featured.bathrooms} حمام
                      </span>
                    </>
                  ) : (
                    <>
                      <span className={specChip}>
                        <Warehouse className="w-3 h-3 text-accent" /> {featured.units || 'سعات تخزين كبرى'}
                      </span>
                      <span className={specChip}>
                        <ShieldCheck className="w-3 h-3 text-accent" /> معتمد ومجهز
                      </span>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-5">
                  <div className="text-2xl font-black brand-gradient-text">
                    {featured.status || featured.badge || 'متاح للاستثمار والتأجير'}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(featured);
                    }}
                    className="brand-btn-primary font-extrabold text-xs px-7 py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    حجز معاينة / استفسار
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar & View Mode Switcher */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 mb-6 stagger-anim"
        style={{ animationDelay: '260ms' }}
      >
        <div className="text-xs text-neutral-text/60 font-semibold">
          عرض{' '}
          <span className="font-black text-accent text-sm">
            {filtered.length}
          </span>{' '}
          من أصل <span className="font-black text-heading">{properties.length}</span> عقارات
        </div>

        <div className="flex items-center gap-3">
          {/* Active filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                onClick={chip.onRemove}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-accent-light hover:bg-accent/20 transition-colors cursor-pointer"
              >
                {chip.label}
                <X className="w-3 h-3" />
              </button>
            ))}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1.5 text-xs font-bold text-accent hover:text-accent-light transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                إعادة التعيين
              </button>
            )}
          </div>

          {/* Grid / List Mode */}
          <div className="flex items-center bg-surface/60 border border-muted-border/30 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-accent text-[var(--brand-btn-text)] shadow'
                  : 'text-neutral-text/50 hover:text-heading'
              }`}
              title="عرض الشبكة"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-accent text-[var(--brand-btn-text)] shadow'
                  : 'text-neutral-text/50 hover:text-heading'
              }`}
              title="عرض القائمة"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Properties Display */}
      {!ready ? (
        <SkeletonGrid />
      ) : filtered.length === 0 ? (
        <EmptyState onReset={resetFilters} />
      ) : viewMode === 'grid' ? (
        <div key={filterKey} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((prop, idx) => (
            <div
              key={prop.id}
              className="stagger-anim"
              style={{ animationDelay: `${150 + (idx % 4) * 80}ms` }}
            >
              <PropertyCard
                property={prop}
                onSelect={onSelect}
                onQuickView={onQuickView}
                onFavToast={onFavToast}
              />
            </div>
          ))}
        </div>
      ) : (
        /* List Mode Layout */
        <div key={filterKey} className="flex flex-col gap-4">
          {filtered.map((prop) => (
            <div
              key={prop.id}
              onClick={() => onQuickView?.(prop)}
              className="glass-card rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 group hover:-translate-y-1 transition duration-300 cursor-pointer border border-muted-border/30 hover:border-accent/50"
            >
              <div className="relative w-full md:w-64 h-48 rounded-xl overflow-hidden shrink-0">
                <img
                  src={prop.image}
                  alt={prop.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span
                  className={`absolute top-3 right-3 text-[11px] font-extrabold px-3 py-1 rounded-full ${
                    prop.status === 'محجوز بالكامل' || prop.badge === 'محجوز بالكامل'
                      ? 'bg-amber-500 text-black font-black'
                      : prop.type === 'logistics'
                      ? 'bg-blue-600 text-white font-bold'
                      : prop.type === 'commercial'
                      ? 'bg-emerald-600 text-white font-bold'
                      : prop.priceType === 'بيع'
                      ? 'brand-fill'
                      : 'bg-success text-canvas font-black'
                  }`}
                >
                  {prop.status === 'محجوز بالكامل' ? 'محجوز بالكامل' : prop.badge || prop.priceType}
                </span>
              </div>

              <div className="flex-1 w-full flex flex-col justify-between h-full">
                <div>
                  <div className="flex items-center justify-between text-xs text-neutral-text/60 mb-2">
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-accent" /> {prop.city}
                    </span>
                    <span className="brand-badge text-accent-light px-2.5 py-0.5 rounded-full font-bold">
                      {prop.typeAr}
                    </span>
                  </div>

                  <h3 className="font-bold text-lg text-heading group-hover:text-accent transition mb-3">
                    {prop.title}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-text/70 mb-4">
                    <span className="flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-accent" /> {prop.area.toLocaleString('en-US')} م²
                    </span>
                    {prop.rooms && prop.rooms > 0 ? (
                      <>
                        <span className="flex items-center gap-1">
                          <BedDouble className="w-3.5 h-3.5 text-accent" /> {prop.rooms} غرف نوم
                        </span>
                        <span className="flex items-center gap-1">
                          <Bath className="w-3.5 h-3.5 text-accent" /> {prop.bathrooms} دورات مياه
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex items-center gap-1 font-semibold text-heading">
                          {prop.units || prop.typeAr}
                        </span>
                        <span className="flex items-center gap-1 text-accent font-semibold">
                          جاهز ومجهز
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-muted-border/20">
                  <div>
                    <span className="text-[10px] text-neutral-text/50 block">حالة المشروع</span>
                    <span className={`text-base font-black ${
                      prop.status === 'محجوز بالكامل' || prop.badge === 'محجوز بالكامل'
                        ? 'text-amber-400'
                        : 'brand-gradient-text'
                    }`}>
                      {prop.status || prop.badge || 'متاح للاستثمار'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickView?.(prop);
                      }}
                      className="brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl"
                    >
                      التفاصيل
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(prop);
                      }}
                      className="brand-btn-primary text-xs font-bold px-5 py-2.5 rounded-xl"
                    >
                      احجز الآن
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
