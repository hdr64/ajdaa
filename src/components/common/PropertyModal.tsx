import React, { useEffect, useState } from 'react';
import type { Property } from '../../types/property';
import {
  X,
  MapPin,
  Maximize2,
  BedDouble,
  Bath,
  Calendar,
  ShieldCheck,
  Sparkles,
  Share2,
  Heart,
  PhoneCall,
  CheckCircle2,
  Building2,
  Check,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Images,
  Warehouse,
  Store,
} from 'lucide-react';

interface PropertyModalProps {
  property: Property | null;
  onClose: () => void;
  onBook: (prop: Property) => void;
  onToast: (msg: string) => void;
}

const AMENITIES = [
  { icon: Sparkles, name: 'تشطيب سوبر ديلوكس' },
  { icon: ShieldCheck, name: 'نظام أمني سمارت 24/7' },
  { icon: Building2, name: 'موقف سيارات مظلل وخاص' },
  { icon: CheckCircle2, name: 'تكييف مركزي دكت' },
  { icon: Sparkles, name: 'حديقة وجلسة خارجية عصرية' },
  { icon: ShieldCheck, name: 'ضمانات هيكلية وشاملة' },
];

export const PropertyModal: React.FC<PropertyModalProps> = ({
  property,
  onClose,
  onBook,
  onToast,
}) => {
  const [isFav, setIsFav] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const isBooked = property?.status === 'محجوز بالكامل' || property?.badge === 'محجوز بالكامل';

  const images = property?.gallery && property.gallery.length > 0
    ? property.gallery
    : property
    ? [property.image]
    : [];

  useEffect(() => {
    setActiveImageIndex(0);
  }, [property]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
    };
    if (property) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [property, activeImageIndex, images.length]);

  if (!property) return null;

  const handleNextImage = () => {
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    if (images.length <= 1) return;
    setActiveImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleShare = () => {
    navigator.clipboard.writeText?.(window.location.href);
    setCopied(true);
    onToast('تم نسخ رابط العقار إلى الحافظة!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleFav = () => {
    setIsFav((v) => !v);
    onToast(!isFav ? 'تم إدراج العقار في المفضلة ❤️' : 'تمت إزالة العقار من المفضلة');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-canvas/85 backdrop-blur-md transition-opacity animate-hero-bg0"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl bg-surface/95 border border-accent/30 rounded-3xl shadow-2xl shadow-black/30 overflow-hidden z-10 my-auto panel-in flex flex-col max-h-[90vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted-border/30 bg-surface/50 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <span className="brand-badge text-xs font-bold px-3 py-1 rounded-full">
              أجدا · {property.typeAr}
            </span>
            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                isBooked
                  ? 'bg-amber-500 text-black font-black'
                  : property.type === 'logistics'
                  ? 'bg-blue-600 text-white font-bold'
                  : property.type === 'commercial'
                  ? 'bg-emerald-600 text-white font-bold'
                  : property.priceType === 'بيع'
                  ? 'brand-fill'
                  : 'bg-success text-white font-black'
              }`}
            >
              {isBooked ? 'محجوز بالكامل' : property.badge || property.priceType}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleFav}
              className="w-9 h-9 rounded-full bg-surface-hover/80 border border-muted-border/40 flex items-center justify-center hover:border-accent transition cursor-pointer"
              title="المفضلة"
            >
              <Heart
                className={`w-4 h-4 transition ${
                  isFav ? 'fill-red-400 text-red-400' : 'text-neutral-text/70'
                }`}
              />
            </button>
            <button
              onClick={handleShare}
              className="w-9 h-9 rounded-full bg-surface-hover/80 border border-muted-border/40 flex items-center justify-center hover:border-accent transition cursor-pointer"
              title="مشاركة العقار"
            >
              {copied ? (
                <Check className="w-4 h-4 text-accent" />
              ) : (
                <Share2 className="w-4 h-4 text-neutral-text/70" />
              )}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-surface-hover/80 border border-muted-border/40 flex items-center justify-center hover:border-accent text-neutral-text hover:text-heading transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
          {/* Main Showcase Image Gallery Slider */}
          <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden group bg-canvas">
            <img
              src={images[activeImageIndex] || property.image}
              alt={property.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-canvas/95 via-canvas/20 to-transparent pointer-events-none" />

            {/* Slider Arrow Controls */}
            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-canvas/80 backdrop-blur-md border border-muted-border/40 flex items-center justify-center text-heading hover:bg-accent hover:text-[var(--brand-btn-text)] transition cursor-pointer z-10"
                  aria-label="الصورة السابقة"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-canvas/80 backdrop-blur-md border border-muted-border/40 flex items-center justify-center text-heading hover:bg-accent hover:text-[var(--brand-btn-text)] transition cursor-pointer z-10"
                  aria-label="الصورة التالية"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Photo Counter Pill */}
            <div className="absolute top-4 left-4 z-10 bg-canvas/80 backdrop-blur-md border border-muted-border/40 px-3 py-1 rounded-full text-[11px] font-bold text-neutral-text flex items-center gap-1.5">
              <Images className="w-3.5 h-3.5 text-accent" />
              <span>
                صورة {activeImageIndex + 1} من {images.length}
              </span>
            </div>

            <div className="absolute bottom-4 right-4 left-4 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3 z-10">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-accent-light mb-1">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span>{property.city}</span>
                </div>
                <h2 className="text-xl sm:text-3xl font-black text-heading leading-tight">
                  {property.title}
                </h2>
              </div>
              <div className="bg-canvas/90 backdrop-blur-md border border-accent/40 px-5 py-2.5 rounded-2xl text-left">
                <span className="text-[10px] text-neutral-text/50 block">حالة المشروع</span>
                <span className={`text-base sm:text-xl font-black ${
                  isBooked
                    ? 'text-amber-400'
                    : 'brand-gradient-text'
                }`}>
                  {property.status || property.badge || 'متاح للاستثمار'}
                </span>
              </div>
            </div>
          </div>

          {/* Thumbnail Gallery Picker */}
          {images.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIndex(idx)}
                  className={`relative w-20 h-16 rounded-xl overflow-hidden shrink-0 border-2 transition cursor-pointer ${
                    activeImageIndex === idx
                      ? 'border-accent scale-105 shadow-md shadow-accent/20'
                      : 'border-muted-border/30 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Quick Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-4 text-center">
              <Maximize2 className="w-5 h-5 text-accent mx-auto mb-2" />
              <div className="text-xs text-neutral-text/50">المساحة الإجمالية</div>
              <div className="text-base font-extrabold text-heading mt-0.5">{property.area.toLocaleString('en-US')} م²</div>
            </div>
            {property.rooms && property.rooms > 0 ? (
              <>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <BedDouble className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">غرف ومكاتب</div>
                  <div className="text-base font-extrabold text-heading mt-0.5">{property.rooms}</div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <Bath className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">دورات المياه</div>
                  <div className="text-base font-extrabold text-heading mt-0.5">{property.bathrooms}</div>
                </div>
              </>
            ) : property.type === 'logistics' ? (
              <>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <Warehouse className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">تصنيف المشروع</div>
                  <div className="text-sm font-extrabold text-heading mt-0.5">مستودعات ومخازن</div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <ShieldCheck className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">بوابات الشحن</div>
                  <div className="text-sm font-extrabold text-heading mt-0.5">شحن هيدروليكي</div>
                </div>
              </>
            ) : property.type === 'commercial' ? (
              <>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <Store className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">تصنيف المشروع</div>
                  <div className="text-sm font-extrabold text-heading mt-0.5">محلات ومعارض</div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <Building2 className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">الواجهات</div>
                  <div className="text-sm font-extrabold text-heading mt-0.5">واجهات زجاجية</div>
                </div>
              </>
            ) : (
              <>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <Building2 className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">تصنيف المشروع</div>
                  <div className="text-sm font-extrabold text-heading mt-0.5">{property.typeAr}</div>
                </div>
                <div className="glass-card rounded-2xl p-4 text-center">
                  <ShieldCheck className="w-5 h-5 text-accent mx-auto mb-2" />
                  <div className="text-xs text-neutral-text/50">الترخيص</div>
                  <div className="text-sm font-extrabold text-heading mt-0.5">معتمد بالكامل</div>
                </div>
              </>
            )}
            <div className="glass-card rounded-2xl p-4 text-center">
              <Calendar className="w-5 h-5 text-accent mx-auto mb-2" />
              <div className="text-xs text-neutral-text/50">تطوير أجدا</div>
              <div className="text-base font-extrabold text-heading mt-0.5">حديث / مكتمل</div>
            </div>
          </div>

          {/* Description & Overview */}
          <div>
            <h3 className="text-base font-bold text-heading mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent" />
              تفاصيل ومميزات مشروع أجدا العقارية
            </h3>
            <p className="text-sm text-neutral-text/80 leading-relaxed bg-surface/40 p-5 rounded-2xl border border-muted-border/20">
              {property.description ||
                `يتميز هذا المشروع من شركة أجدا للتطوير والاستثمار العقاري بموقع استراتيجي فريد في قلب مدينة ${property.city}، بتصميم وتنفيذ على أعلى معايير الجودة والاستدامة.`}
            </p>
          </div>

          {/* Project Features Highlights if available */}
          {property.features && property.features.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-heading mb-3">أهم مميزات المشروع</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {property.features.map((feat, fIdx) => (
                  <div
                    key={fIdx}
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-accent/10 border border-accent/20 text-xs font-bold text-heading"
                  >
                    <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amenities Grid */}
          <div>
            <h3 className="text-base font-bold text-heading mb-3">المرافق والضمانات المشمولة</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AMENITIES.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-muted-border/20 text-xs text-neutral-text/80"
                  >
                    <Icon className="w-4 h-4 text-accent shrink-0" />
                    <span>{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-muted-border/30 bg-surface/60 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <a
              href="https://wa.me/966550484326"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none brand-btn-secondary px-5 py-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2"
            >
              <PhoneCall className="w-4 h-4 text-accent" />
              استشارة عبر واتساب
            </a>
          </div>

          <button
            onClick={() => {
              onClose();
              onBook(property);
            }}
            className="w-full sm:w-auto brand-btn-primary px-8 py-3.5 rounded-xl text-sm font-extrabold inline-flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
          >
            {isBooked ? 'طلب استفسار عن المشروع' : 'احجز معاينة هذا المشروع'}
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
