import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Code2,
  ExternalLink,
  Eye,
  Globe,
  ImageIcon,
  MapPin,
  Monitor,
  Moon,
  Navigation,
  Share2,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { projectPath } from '../../../seo/slug';
import { useTheme } from '../../../hooks/useTheme';

export interface GoogleSearchProductPreviewProps {
  title: string;
  titleEn: string;
  city: string;
  cityEn: string;
  typeAr: string;
  typeEn: string;
  priceType: string;
  priceTypeEn: string;
  price: string;
  priceLabel: string;
  status: string;
  statusEn: string;
  area: string;
  rooms?: string;
  bathrooms?: string;
  unitsCount?: string;
  unitsCountEn?: string;
  description: string;
  descriptionEn: string;
  features: string;
  featuresEn: string;
  locationHighlightsAr: string;
  locationHighlightsEn: string;
  lat: string;
  lng: string;
  image: string;
  gallery: string[];
  projectId?: number;
  defaultExpanded?: boolean;
}

type DeviceMode = 'desktop' | 'mobile';
type LangMode = 'ar' | 'en';
type ViewTab = 'combined' | 'product' | 'knowledge';
type ThemeMode = 'dark' | 'light';

export const GoogleSearchProductPreview: React.FC<GoogleSearchProductPreviewProps> = ({
  title,
  titleEn,
  city,
  cityEn,
  typeAr,
  typeEn,
  priceType,
  priceTypeEn,
  price,
  priceLabel,
  status,
  statusEn,
  area,
  rooms,
  bathrooms,
  unitsCount,
  unitsCountEn,
  description,
  descriptionEn,
  features,
  featuresEn,
  locationHighlightsAr,
  locationHighlightsEn,
  lat,
  lng,
  image,
  gallery,
  projectId = 206,
  defaultExpanded = false,
}) => {
  const { theme: siteTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [lang, setLang] = useState<LangMode>('ar');
  const [tab, setTab] = useState<ViewTab>('combined');
  const [manualTheme, setManualTheme] = useState<{ mode: ThemeMode; forSiteTheme: ThemeMode } | null>(null);
  const [showJsonLd, setShowJsonLd] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  // Directly follows website theme unless manually toggled during current session
  const effectiveTheme: ThemeMode = manualTheme && manualTheme.forSiteTheme === siteTheme ? manualTheme.mode : siteTheme;
  const isDark = effectiveTheme === 'dark';
  const isAr = lang === 'ar';

  // Localized values
  const currentTitle = isAr ? title.trim() || 'مركز أجدا برايم' : titleEn.trim() || title.trim() || 'Ajda Prime';
  const currentCity = isAr ? city.trim() || 'الرياض' : cityEn.trim() || city.trim() || 'Riyadh';
  const currentType = isAr
    ? typeAr.trim() || 'مركز تجاري وإداري فاخر'
    : typeEn.trim() || typeAr.trim() || 'Luxury Commercial & Office Center';
  const currentStatus = isAr
    ? status.trim() || 'متاح للتأجير والاستثمار'
    : statusEn.trim() || status.trim() || 'Available for Lease';
  const currentPriceType = isAr
    ? priceType.trim() || 'استثمار'
    : priceTypeEn.trim() || priceType.trim() || 'Investment';
  const currentDesc = isAr
    ? description.trim() ||
      `${currentTitle} مشروع عقاري مميز تابع لشركة أجدا العقارية في مدينة ${currentCity} بمساحة ${area || '7,200'} م² وتصميم عصري متكامل.`
    : descriptionEn.trim() ||
      description.trim() ||
      `${currentTitle} is a flagship commercial development by Ajda Real Estate in ${currentCity}, offering ${area || '7,200'} m² of modern prime spaces.`;

  const parsedFeatures = useMemo(() => {
    const raw = lang === 'ar' ? features : featuresEn || features;
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [features, featuresEn, lang]);

  const parsedHighlights = useMemo(() => {
    const raw = lang === 'ar' ? locationHighlightsAr : locationHighlightsEn || locationHighlightsAr;
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [locationHighlightsAr, locationHighlightsEn, lang]);

  // All images: main image first, then gallery
  const allImages = useMemo(() => {
    const list: string[] = [];
    if (image.trim()) list.push(image.trim());
    gallery.forEach((g) => {
      const trimmed = g.trim();
      if (trimmed && !list.includes(trimmed)) list.push(trimmed);
    });
    return list;
  }, [image, gallery]);

  const displayImage = allImages[0] || '/logo.png';
  const slugPath = projectPath(projectId, titleEn, lang);
  const fullUrl = `https://ajdaa.sa${slugPath}`;
  const displayUrl = `ajdaa.sa › ${isAr ? 'مشاريعنا' : 'works'} › ${currentTitle.toLowerCase().replace(/\s+/g, '-')}`;

  // Generated JSON-LD representation for Google
  const liveJsonLd = useMemo(() => {
    const isArabic = lang === 'ar';
    const brandName = isArabic ? 'أجدا العقارية' : 'Ajda Real Estate';
    const parsedPrice = Number(price);
    const validPrice = !Number.isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined;

    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          '@id': `${fullUrl}#product`,
          name: currentTitle,
          description: currentDesc,
          url: fullUrl,
          image: allImages.map((src) => (src.startsWith('http') ? src : `https://ajdaa.sa${src}`)),
          brand: {
            '@type': 'Brand',
            name: brandName,
            url: `https://ajdaa.sa${isArabic ? '/' : '/en'}`,
          },
          category: currentType,
          ...(validPrice
            ? {
                offers: {
                  '@type': 'Offer',
                  url: fullUrl,
                  priceCurrency: 'SAR',
                  price: validPrice,
                  priceValidUntil: '2028-12-31',
                  availability: 'https://schema.org/InStock',
                  itemCondition: 'https://schema.org/NewCondition',
                  seller: {
                    '@type': 'RealEstateAgent',
                    name: brandName,
                    url: `https://ajdaa.sa${isArabic ? '/' : '/en'}`,
                  },
                },
              }
            : {}),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '5.0',
            reviewCount: '3',
            bestRating: '5',
            worstRating: '1',
          },
          additionalProperty: [
            area ? { '@type': 'PropertyValue', name: isArabic ? 'المساحة' : 'Floor Area', value: `${area} m²` } : null,
            currentCity ? { '@type': 'PropertyValue', name: isArabic ? 'المدينة' : 'City', value: currentCity } : null,
            currentType ? { '@type': 'PropertyValue', name: isArabic ? 'نوع المشروع' : 'Project Type', value: currentType } : null,
            currentPriceType ? { '@type': 'PropertyValue', name: isArabic ? 'طبيعة العقد' : 'Contract Type', value: currentPriceType } : null,
            currentStatus ? { '@type': 'PropertyValue', name: isArabic ? 'حالة المشروع' : 'Status', value: currentStatus } : null,
            rooms ? { '@type': 'PropertyValue', name: isArabic ? 'الغرف' : 'Rooms', value: String(rooms) } : null,
            bathrooms ? { '@type': 'PropertyValue', name: isArabic ? 'دورات المياه' : 'Bathrooms', value: String(bathrooms) } : null,
            ...parsedFeatures.slice(0, 5).map((f) => ({
              '@type': 'PropertyValue',
              name: isArabic ? 'ميزة' : 'Feature',
              value: f,
            })),
          ].filter(Boolean),
        },
        {
          '@type': 'LocalBusiness',
          '@id': `${fullUrl}#place`,
          name: currentTitle,
          description: currentDesc,
          url: fullUrl,
          image: allImages.map((src) => (src.startsWith('http') ? src : `https://ajdaa.sa${src}`)),
          telephone: '+966114888888',
          address: {
            '@type': 'PostalAddress',
            streetAddress: parsedHighlights[0] || currentCity,
            addressLocality: currentCity,
            addressCountry: 'SA',
          },
          ...(lat && lng
            ? {
                geo: {
                  '@type': 'GeoCoordinates',
                  latitude: Number(lat),
                  longitude: Number(lng),
                },
                hasMap: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
              }
            : {}),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '5.0',
            reviewCount: '3',
          },
          priceRange: '$$$$',
        },
      ],
    };
  }, [
    fullUrl,
    currentTitle,
    currentDesc,
    allImages,
    lang,
    currentType,
    price,
    area,
    currentCity,
    currentPriceType,
    currentStatus,
    rooms,
    bathrooms,
    parsedFeatures,
    parsedHighlights,
    lat,
    lng,
  ]);

  const handleCopyJsonLd = () => {
    void navigator.clipboard.writeText(JSON.stringify(liveJsonLd, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  return (
    <section className="rounded-3xl border border-muted-border/60 bg-surface shadow-sm overflow-hidden transition-all duration-300">
      {/* Collapsible Header Bar */}
      <div
        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition select-none ${
          isExpanded ? 'border-b border-muted-border/40 bg-surface' : 'hover:bg-canvas/60 bg-surface'
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20 shrink-0">
            <Sparkles className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-heading truncate">
                {isAr ? 'معاينة بحث Google كمنتج وبطاقة معرفية' : 'Google Search Product & Knowledge Panel Preview'}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Google Rich Results
              </span>
            </div>
            <p className="text-[11px] text-neutral-text/70 mt-0.5 truncate">
              {isAr
                ? `محاكاة حيّة لـ "${currentTitle}" • ${allImages.length} صور • تقييم 5.0 ★ • بيانات منظمة جاهزة`
                : `Live simulation of "${currentTitle}" • ${allImages.length} images • 5.0 ★ • Schema.org`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas border border-muted-border/50 text-xs font-bold text-heading hover:border-accent/60 transition shadow-xs">
            {isExpanded ? (
              <>
                <span>{isAr ? 'إخفاء المعاينة' : 'Hide Preview'}</span>
                <ChevronUp className="w-4 h-4 text-neutral-text/70" />
              </>
            ) : (
              <>
                <span>{isAr ? 'عرض المعاينة' : 'Show Preview'}</span>
                <ChevronDown className="w-4 h-4 text-neutral-text/70" />
              </>
            )}
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-muted-border/30">
            {/* View Switchers */}
            <div className="inline-flex rounded-xl bg-canvas border border-muted-border/50 p-1 text-xs">
              <button
                type="button"
                onClick={() => setTab('combined')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  tab === 'combined' ? 'bg-surface text-heading shadow-xs' : 'text-neutral-text/60 hover:text-heading'
                }`}
              >
                {isAr ? 'بحث + بطاقة' : 'SERP + Panel'}
              </button>
              <button
                type="button"
                onClick={() => setTab('product')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  tab === 'product' ? 'bg-surface text-heading shadow-xs' : 'text-neutral-text/60 hover:text-heading'
                }`}
              >
                {isAr ? 'منتج البحث' : 'Product Snippet'}
              </button>
              <button
                type="button"
                onClick={() => setTab('knowledge')}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                  tab === 'knowledge' ? 'bg-surface text-heading shadow-xs' : 'text-neutral-text/60 hover:text-heading'
                }`}
              >
                {isAr ? 'بطاقة المعرفة' : 'Knowledge Card'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Language Toggle */}
              <button
                type="button"
                onClick={() => setLang(isAr ? 'en' : 'ar')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-muted-border/50 bg-canvas text-xs font-bold text-heading hover:bg-canvas/80 cursor-pointer"
                title={isAr ? 'Switch to English' : 'التحويل للعربية'}
              >
                <Globe className="w-3.5 h-3.5 text-accent" />
                <span>{isAr ? 'عربي' : 'English'}</span>
              </button>

              {/* Device Toggle */}
              <div className="inline-flex rounded-xl bg-canvas border border-muted-border/50 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDevice('desktop')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    device === 'desktop' ? 'bg-surface text-blue-500 shadow-xs' : 'text-neutral-text/60 hover:text-heading'
                  }`}
                  title="Desktop SERP"
                  aria-label="Desktop SERP"
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDevice('mobile')}
                  className={`p-1.5 rounded-lg transition cursor-pointer ${
                    device === 'mobile' ? 'bg-surface text-blue-500 shadow-xs' : 'text-neutral-text/60 hover:text-heading'
                  }`}
                  title="Mobile SERP"
                  aria-label="Mobile SERP"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Theme Toggle (automatically matches site theme, can toggle) */}
              <button
                type="button"
                onClick={() => setManualTheme({ mode: isDark ? 'light' : 'dark', forSiteTheme: siteTheme })}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-muted-border/50 bg-canvas text-xs font-bold text-heading hover:bg-canvas/80 cursor-pointer"
                title={isDark ? 'تبديل وضع Google للفاتح' : 'تبديل وضع Google للداكن'}
                aria-label="Toggle Google Theme"
              >
                {isDark ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                <span className="text-[11px] text-neutral-text/80">
                  {isDark ? (isAr ? 'Google داكن' : 'Dark') : (isAr ? 'Google فاتح' : 'Light')}
                </span>
              </button>
            </div>
          </div>

      {/* Google SERP Simulated Container */}
      <div
        dir={isAr ? 'rtl' : 'ltr'}
        className={`rounded-2xl transition-all duration-300 overflow-hidden border ${
          isDark
            ? 'bg-[#202124] text-[#e8eaed] border-[#303134]'
            : 'bg-[#ffffff] text-[#3c4043] border-[#dadce0]'
        } ${device === 'mobile' ? 'max-w-[420px] mx-auto shadow-md' : 'w-full shadow-xs'}`}
      >
        {/* Google Search Bar Simulation */}
        <div
          className={`px-4 sm:px-6 py-3.5 border-b flex items-center justify-between gap-3 ${
            isDark ? 'border-[#303134] bg-[#202124]' : 'border-[#ebebeb] bg-white'
          }`}
        >
          <div className="flex items-center gap-3 w-full max-w-xl">
            <span className="font-bold tracking-tight text-sm select-none">
              <span className="text-[#4285f4]">G</span>
              <span className="text-[#ea4335]">o</span>
              <span className="text-[#fbbc05]">o</span>
              <span className="text-[#4285f4]">g</span>
              <span className="text-[#34a853]">l</span>
              <span className="text-[#ea4335]">e</span>
            </span>
            <div
              className={`flex-1 flex items-center justify-between px-3.5 py-1.5 rounded-full text-xs ${
                isDark ? 'bg-[#303134] text-[#e8eaed]' : 'bg-[#f1f3f4] text-[#202124]'
              }`}
            >
              <span className="truncate font-medium">{currentTitle}</span>
              <span className={`text-[11px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#70757a]'}`}>✕</span>
            </div>
          </div>
          {device === 'desktop' && (
            <div className={`hidden sm:flex items-center gap-3 text-[11px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#70757a]'}`}>
              <span className={`font-semibold border-b-2 pb-1 ${isDark ? 'text-[#8ab4f8] border-[#8ab4f8]' : 'text-[#1a73e8] border-[#1a73e8]'}`}>
                {isAr ? 'الكل' : 'All'}
              </span>
              <span>{isAr ? 'الصور' : 'Images'}</span>
              <span>{isAr ? 'خرائط' : 'Maps'}</span>
              <span>{isAr ? 'فيديو' : 'Videos'}</span>
            </div>
          )}
        </div>

        {/* Search Results Area */}
        <div className="p-4 sm:p-6 space-y-6">
          <div className={`grid gap-6 ${tab === 'combined' && device === 'desktop' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
            {/* Left Column: AI Overview & Search Result */}
            {(tab === 'combined' || tab === 'product') && (
              <div className={`${tab === 'combined' && device === 'desktop' ? 'lg:col-span-7 xl:col-span-8' : 'w-full'} space-y-5`}>
                {/* 1. Google AI Overview Box */}
                <div
                  className={`rounded-2xl p-4 sm:p-5 border transition ${
                    isDark ? 'bg-[#2b2c2f] border-[#3c4043]' : 'bg-[#f8fafd] border-[#dfe3e7]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-400">
                      {isAr ? 'نظرة عامة بالذكاء الاصطناعي (AI Overview)' : 'AI Overview'}
                    </span>
                  </div>
                  <div className={`text-xs leading-relaxed space-y-2.5 ${isDark ? 'text-[#bdc1c6]' : 'text-[#4d5156]'}`}>
                    <p>
                      <strong className={isDark ? 'text-white' : 'text-black'}>{currentTitle}</strong>{' '}
                      {isAr
                        ? `هو مشروع عقاري (${currentType}) تابع لشركة أجدا العقارية في المملكة العربية السعودية.`
                        : `is a flagship real estate development (${currentType}) by Ajda Real Estate in Saudi Arabia.`}
                    </p>
                    <ul className="list-disc list-inside space-y-1 ps-1 text-[11px]">
                      <li>
                        <strong className={isDark ? 'text-white' : 'text-neutral-900'}>
                          {isAr ? 'الموقع: ' : 'Location: '}
                        </strong>
                        {parsedHighlights[0] || currentCity}
                      </li>
                      <li>
                        <strong className={isDark ? 'text-white' : 'text-neutral-900'}>
                          {isAr ? 'المساحة والتصميم: ' : 'Area & Design: '}
                        </strong>
                        {isAr
                          ? `يمتد على مساحة ${area || '7,200'} متر مربع، بتصميم معماري حديث ومواصفات نوعية.`
                          : `Spans across ${area || '7,200'} m² with modern architecture and premium specifications.`}
                      </li>
                      {parsedFeatures.length > 0 && (
                        <li>
                          <strong className={isDark ? 'text-white' : 'text-neutral-900'}>
                            {isAr ? 'المزايا: ' : 'Features: '}
                          </strong>
                          {parsedFeatures.slice(0, 3).join(' • ')}
                        </li>
                      )}
                      <li>
                        <strong className={isDark ? 'text-white' : 'text-neutral-900'}>
                          {isAr ? 'حالة المشروع: ' : 'Project Status: '}
                        </strong>
                        {currentStatus}
                      </li>
                    </ul>
                  </div>

                  {/* AI Overview Thumbnails & Sources */}
                  <div className="mt-3.5 pt-3 border-t border-muted-border/20 flex flex-wrap items-center gap-2">
                    <div
                      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[10px] ${
                        isDark ? 'bg-[#303134] text-[#bdc1c6]' : 'bg-white border border-[#dadce0] text-[#3c4043]'
                      }`}
                    >
                      <img src={displayImage} alt="" className="w-4 h-4 rounded object-cover" />
                      <span className="font-semibold truncate max-w-[150px]">
                        {isAr ? 'أجدا العقارية | نُعيد تعريف العقار...' : 'Ajda Real Estate | Official'}
                      </span>
                    </div>
                    {allImages[1] && (
                      <div
                        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl text-[10px] ${
                          isDark ? 'bg-[#303134] text-[#bdc1c6]' : 'bg-white border border-[#dadce0] text-[#3c4043]'
                        }`}
                      >
                        <img src={allImages[1]} alt="" className="w-4 h-4 rounded object-cover" />
                        <span className="font-semibold truncate max-w-[120px]">{currentTitle}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Organic Google Search Product Snippet */}
                <div className="space-y-2">
                  {/* Breadcrumb URL line */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      <img src="/logo.png" alt="Ajda" className="w-4 h-4 object-contain" />
                    </div>
                    <div className="truncate">
                      <div className={`text-[12px] font-semibold leading-tight ${isDark ? 'text-[#dadce0]' : 'text-[#202124]'}`}>
                        {isAr ? 'أجدا العقارية' : 'Ajda Real Estate'}
                      </div>
                      <div className={`text-[11px] truncate leading-tight ${isDark ? 'text-[#9aa0a6]' : 'text-[#4d5156]'}`}>
                        {displayUrl}
                      </div>
                    </div>
                  </div>

                  {/* Title Link */}
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={`block text-base sm:text-lg font-medium leading-snug hover:underline ${
                      isDark ? 'text-[#8ab4f8]' : 'text-[#1a0dab]'
                    }`}
                  >
                    {currentTitle} — {currentCity} | {isAr ? 'أجدا العقارية' : 'Ajda Real Estate'}
                  </a>

                  {/* Google Product Rich Snippet Rating & Badges */}
                  <div className="flex flex-wrap items-center gap-2 text-xs py-0.5">
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <span className="text-[11px]">5.0</span>
                      <div className="flex text-amber-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="w-3 h-3 fill-amber-400" />
                        ))}
                      </div>
                      <span className={`text-[11px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#70757a]'}`}>(3)</span>
                    </div>
                    <span className={isDark ? 'text-[#5f6368]' : 'text-[#dadce0]'}>•</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${isDark ? 'bg-[#303134] text-[#8ab4f8]' : 'bg-blue-50 text-[#1a73e8]'}`}>
                      {currentStatus}
                    </span>
                    {area && (
                      <>
                        <span className={isDark ? 'text-[#5f6368]' : 'text-[#dadce0]'}>•</span>
                        <span className={`text-[11px] ${isDark ? 'text-[#bdc1c6]' : 'text-[#5f6368]'}`}>
                          {area} م²
                        </span>
                      </>
                    )}
                    {priceLabel && (
                      <>
                        <span className={isDark ? 'text-[#5f6368]' : 'text-[#dadce0]'}>•</span>
                        <span className="text-[11px] font-bold text-emerald-500">
                          {priceLabel}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Snippet Description */}
                  <p className={`text-xs leading-relaxed ${isDark ? 'text-[#bdc1c6]' : 'text-[#4d5156]'}`}>
                    {currentDesc}
                  </p>

                  {/* 3. Multi-Image Gallery Strip (Google Product Carousel) */}
                  {allImages.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${isDark ? 'text-[#9aa0a6]' : 'text-[#70757a]'}`}>
                          <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                          {isAr
                            ? `معرض الصور للمشروع (${allImages.length} صور في Google)`
                            : `Project Image Carousel (${allImages.length} images on Google)`}
                        </span>
                        <span className="text-[10px] text-blue-400 font-medium">
                          {isAr ? 'انقر لتكبير الصورة' : 'Click image to inspect'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {allImages.map((src, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePhotoModal(src)}
                            className={`relative rounded-xl overflow-hidden shrink-0 border transition hover:scale-105 cursor-pointer ${
                              idx === 0 ? 'w-28 h-20 border-blue-500/50 ring-2 ring-blue-500/20' : 'w-20 h-20 border-muted-border/40'
                            }`}
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            {idx === 0 && (
                              <span className="absolute bottom-1 end-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-600 text-white shadow-xs">
                                {isAr ? 'رئيسية' : 'Main'}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Right Column: Google Knowledge Panel Card (Matches user screenshot) */}
            {(tab === 'combined' || tab === 'knowledge') && (
              <div
                className={`${
                  tab === 'combined' && device === 'desktop' ? 'lg:col-span-5 xl:col-span-4' : 'w-full max-w-md mx-auto'
                }`}
              >
                <div
                  className={`rounded-2xl border overflow-hidden transition ${
                    isDark ? 'bg-[#1f1f1f] border-[#303134]' : 'bg-white border-[#dadce0] shadow-sm'
                  }`}
                >
                  {/* Photo & Map Header Split */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-black/5 dark:bg-black/30">
                    {/* Main Photo with "See photos" button */}
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden group">
                      <img src={displayImage} alt={currentTitle} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      <button
                        type="button"
                        onClick={() => setActivePhotoModal(displayImage)}
                        className="absolute bottom-2 inset-x-2 py-1 rounded-lg bg-black/75 hover:bg-black/90 text-white text-[10px] font-bold text-center backdrop-blur-xs flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" />
                        <span>{isAr ? `عرض الصور (${allImages.length})` : `See photos (${allImages.length})`}</span>
                      </button>
                    </div>

                    {/* Google Map Thumbnail */}
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-neutral-900">
                      {lat && lng ? (
                        <iframe
                          title="Google Map"
                          src={`https://maps.google.com/maps?q=${lat},${lng}&z=14&output=embed`}
                          className="w-full h-full border-0 pointer-events-none opacity-85"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-neutral-text/60">
                          <MapPin className="w-5 h-5 text-red-500 mb-1" />
                          <span className="text-[10px]">{isAr ? 'خريطة الموقع' : 'Location Map'}</span>
                        </div>
                      )}
                      <div className="absolute top-2 start-2 p-1 rounded-md bg-black/60 text-white">
                        <MapPin className="w-3 h-3 text-red-400" />
                      </div>
                    </div>
                  </div>

                  {/* Knowledge Card Content */}
                  <div className="p-4 space-y-3.5">
                    <div>
                      <h4 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-[#202124]'}`}>
                        {currentTitle}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs font-bold text-amber-400">5.0</span>
                        <div className="flex text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-amber-400" />
                          ))}
                        </div>
                        <span className={`text-xs ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a0dab]'}`}>
                          3 {isAr ? 'تقييمات على Google' : 'Google reviews'}
                        </span>
                      </div>
                      <p className={`text-xs mt-1 ${isDark ? 'text-[#9aa0a6]' : 'text-[#70757a]'}`}>
                        {currentType} {isAr ? `في ${currentCity}، المملكة العربية السعودية` : `in ${currentCity}, Saudi Arabia`}
                      </p>
                    </div>

                    {/* Quick Action Buttons (Website, Directions, Save, Share) */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <a
                        href={fullUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer text-center ${
                          isDark ? 'hover:bg-[#303134] text-[#8ab4f8]' : 'hover:bg-blue-50 text-[#1a73e8]'
                        }`}
                      >
                        <Globe className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">{isAr ? 'الموقع' : 'Website'}</span>
                      </a>
                      <a
                        href={lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer text-center ${
                          isDark ? 'hover:bg-[#303134] text-[#8ab4f8]' : 'hover:bg-blue-50 text-[#1a73e8]'
                        }`}
                      >
                        <Navigation className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">{isAr ? 'الاتجاهات' : 'Directions'}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setIsSaved(!isSaved)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer text-center ${
                          isDark ? 'hover:bg-[#303134] text-[#8ab4f8]' : 'hover:bg-blue-50 text-[#1a73e8]'
                        }`}
                      >
                        <Bookmark className={`w-4 h-4 mb-1 ${isSaved ? 'fill-current' : ''}`} />
                        <span className="text-[10px] font-semibold">{isSaved ? (isAr ? 'محفوظ' : 'Saved') : (isAr ? 'حفظ' : 'Save')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(fullUrl);
                          setIsShared(true);
                          setTimeout(() => setIsShared(false), 2000);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl transition cursor-pointer text-center ${
                          isDark ? 'hover:bg-[#303134] text-[#8ab4f8]' : 'hover:bg-blue-50 text-[#1a73e8]'
                        }`}
                      >
                        <Share2 className="w-4 h-4 mb-1" />
                        <span className="text-[10px] font-semibold">{isShared ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'مشاركة' : 'Share')}</span>
                      </button>
                    </div>

                    {/* Facts List */}
                    <div className={`space-y-2 pt-2 border-t text-xs ${isDark ? 'border-[#303134] text-[#bdc1c6]' : 'border-[#ebebeb] text-[#3c4043]'}`}>
                      {parsedHighlights[0] && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-red-400 mt-0.5" />
                          <span>
                            <strong className={isDark ? 'text-white' : 'text-neutral-900'}>{isAr ? 'العنوان: ' : 'Address: '}</strong>
                            {parsedHighlights[0]}، {currentCity}
                          </span>
                        </div>
                      )}
                      {area && (
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 text-center text-blue-400 font-bold">📐</span>
                          <span>
                            <strong className={isDark ? 'text-white' : 'text-neutral-900'}>{isAr ? 'المساحة: ' : 'Floor Area: '}</strong>
                            {area} م²
                          </span>
                        </div>
                      )}
                      {unitsCount && (
                        <div className="flex items-center gap-2">
                          <span className="w-3.5 text-center text-emerald-400 font-bold">🏢</span>
                          <span>
                            <strong className={isDark ? 'text-white' : 'text-neutral-900'}>{isAr ? 'الوحدات: ' : 'Units: '}</strong>
                            {isAr ? unitsCount : unitsCountEn || unitsCount}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 text-center text-amber-400 font-bold">📞</span>
                        <span>
                          <strong className={isDark ? 'text-white' : 'text-neutral-900'}>{isAr ? 'الهاتف: ' : 'Phone: '}</strong>
                          <span dir="ltr">+966 11 488 8888</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JSON-LD Schema Inspector & Testing Actions */}
      <div className="rounded-2xl border border-muted-border/40 bg-canvas p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-heading">
              {isAr ? 'بيانات Google المنظمة (Schema.org JSON-LD)' : 'Google Structured Data (JSON-LD)'}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500">
              Product + LocalBusiness
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyJsonLd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-muted-border/50 bg-surface text-xs font-bold text-heading hover:border-accent/60 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{copied ? (isAr ? 'تم النسخ!' : 'Copied!') : isAr ? 'نسخ الكود' : 'Copy JSON'}</span>
            </button>

            <a
              href="https://search.google.com/test/rich-results"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{isAr ? 'فحص النتائج الغنية في Google' : 'Test on Google Rich Results'}</span>
            </a>

            <button
              type="button"
              onClick={() => setShowJsonLd(!showJsonLd)}
              className="p-1.5 rounded-xl border border-muted-border/50 bg-surface text-neutral-text hover:text-heading cursor-pointer"
              title={showJsonLd ? 'Hide Code' : 'Show Code'}
            >
              {showJsonLd ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showJsonLd && (
          <div className="pt-2">
            <pre
              dir="ltr"
              className="p-3.5 rounded-xl bg-neutral-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-72 leading-relaxed"
            >
              {JSON.stringify(liveJsonLd, null, 2)}
            </pre>
          </div>
        )}
      </div>
      </div>
      )}

      {/* Lightbox / High-Res Image Modal */}
      {activePhotoModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActivePhotoModal(null);
          }}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
            <button
              type="button"
              onClick={() => setActivePhotoModal(null)}
              className="absolute top-3 end-3 z-10 p-2 rounded-full bg-black/70 hover:bg-red-500 text-white transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={activePhotoModal} alt="" className="w-full h-auto max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </section>
  );
};
