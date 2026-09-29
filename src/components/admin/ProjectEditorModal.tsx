import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PriceType, Property, PropertyType } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import { getErrorMessage } from '../../services/api';
import { isAcceptedMedia, MAX_UPLOAD_BYTES, uploadMedia } from '../../services/mediaService';
import { toYoutubeEmbedUrl } from '../../services/youtube';
import {
  AlertCircle,
  ImageUp,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  X as CloseIcon,
  XCircle,
} from 'lucide-react';

interface ProjectEditorModalProps {
  project: Property;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onShowToast: (msg: string) => void;
}

/**
 * Arabic project-type labels. Kept in sync with the dashboard's "add project"
 * modal: it is a plain record, and `react/only-export-components` only exempts
 * primitive constant exports, so it cannot be shared from a component file.
 */
const PROJECT_TYPE_LABELS_AR: Record<PropertyType, string> = {
  commercial: 'مجمع ومراكز تجارية',
  residential: 'مجمع سكني فاخر',
  office: 'مبنى إداري للأعمال',
  logistics: 'مستودعات ومخازن لوجستية',
  hotel: 'فنادق وأجنحة فندقية',
};

const PRICE_TYPES: PriceType[] = ['إيجار', 'بيع', 'استثمار'];

const PROPERTY_TYPES: PropertyType[] = ['commercial', 'residential', 'office', 'logistics', 'hotel'];

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

const LABEL_CLASS = 'block text-[11px] font-bold text-neutral-text/70 mb-1';

interface EditorForm {
  title: string;
  titleEn: string;
  type: PropertyType;
  typeAr: string;
  priceType: PriceType;
  status: string;
  statusEn: string;
  badge: string;
  badgeEn: string;
  city: string;
  cityEn: string;
  area: string;
  description: string;
  descriptionEn: string;
  features: string;
  featuresEn: string;
  lat: string;
  lng: string;
  videoUrl: string;
  image: string;
  gallery: string[];
  virtualTour3dAvailable: boolean;
}

function trimmedOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** One entry per non-empty line, which is how the textareas are authored. */
function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function toFormState(project: Property): EditorForm {
  return {
    title: project.title ?? '',
    titleEn: project.titleEn ?? '',
    type: project.type,
    typeAr: project.typeAr ?? '',
    priceType: project.priceType,
    status: project.status ?? '',
    statusEn: project.statusEn ?? '',
    badge: project.badge ?? '',
    badgeEn: project.badgeEn ?? '',
    city: project.city ?? '',
    cityEn: project.cityEn ?? '',
    area: project.area === undefined || project.area === null ? '' : String(project.area),
    description: project.description ?? '',
    descriptionEn: project.descriptionEn ?? '',
    features: (project.features ?? []).join('\n'),
    featuresEn: (project.featuresEn ?? []).join('\n'),
    lat: project.lat === undefined || project.lat === null ? '' : String(project.lat),
    lng: project.lng === undefined || project.lng === null ? '' : String(project.lng),
    videoUrl: project.videoUrl ?? '',
    image: project.image ?? '',
    gallery: [...(project.gallery ?? [])],
    virtualTour3dAvailable: project.virtualTour3dAvailable ?? false,
  };
}

function parseRequiredNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validateImageFile(file: File): string | null {
  if (!isAcceptedMedia(file) || !file.type.startsWith('image/')) {
    return 'صيغة الصورة غير مدعومة (JPG, PNG, WebP, AVIF, GIF)';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'حجم الصورة يتجاوز 50 ميجابايت';
  }
  return null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-2xl border border-muted-border/40 bg-canvas/40 p-4">
      <legend className="px-1.5 text-[11px] font-black text-accent">{title}</legend>
      {children}
    </fieldset>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-500">
      <AlertCircle className="w-3 h-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export const ProjectEditorModal: React.FC<ProjectEditorModalProps> = ({
  project,
  onClose,
  onSaved,
  onShowToast,
}) => {
  const [baseline] = useState<EditorForm>(() => toFormState(project));
  const [form, setForm] = useState<EditorForm>(baseline);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((changes: Partial<EditorForm>) => {
    setForm((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current;
      const next = { ...current };
      Object.keys(changes).forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  /**
   * Appends freshly uploaded gallery URLs to whatever the gallery holds *now*.
   * Sequential uploads take a while, so reading `form.gallery` up front would
   * resurrect a thumbnail the admin removed while the upload was in flight.
   */
  const appendGallery = useCallback((urls: string[]) => {
    setForm((current) => ({ ...current, gallery: [...current.gallery, ...urls] }));
  }, []);

  const embedUrl = toYoutubeEmbedUrl(form.videoUrl);
  const isBusy = saving || uploading;
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  const validate = useCallback((): Record<string, string> => {
    const found: Record<string, string> = {};

    if (!form.title.trim()) found.title = 'اسم المشروع مطلوب';
    if (!form.city.trim()) found.city = 'المدينة مطلوبة';
    if (!form.image.trim()) found.image = 'صورة المشروع مطلوبة لحفظ التغييرات';

    const area = parseRequiredNumber(form.area);
    if (area === null || Number.isNaN(area)) found.area = 'المساحة مطلوبة ويجب أن تكون رقماً';
    else if (area < 0) found.area = 'المساحة لا يمكن أن تكون سالبة';

    const lat = parseRequiredNumber(form.lat);
    if (Number.isNaN(lat)) found.lat = 'خط العرض يجب أن يكون رقماً';
    else if (lat !== null && (lat < -90 || lat > 90)) found.lat = 'خط العرض يجب أن يكون بين -90 و 90';

    const lng = parseRequiredNumber(form.lng);
    if (Number.isNaN(lng)) found.lng = 'خط الطول يجب أن يكون رقماً';
    else if (lng !== null && (lng < -180 || lng > 180)) found.lng = 'خط الطول يجب أن يكون بين -180 و 180';

    if (embedUrl === undefined) {
      found.videoUrl = 'رابط الفيديو غير صالح. استخدم رابط يوتيوب أو معرّف الفيديو (11 حرفاً)';
    }

    return found;
  }, [form, embedUrl]);

  const requestClose = useCallback(() => {
    if (isBusy) return;
    if (isDirty && !window.confirm('لديك تعديلات غير محفوظة. هل تريد بالتأكيد على إغلاق النافذة دون حفظ؟')) {
      return;
    }
    onClose();
  }, [isBusy, isDirty, onClose]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [requestClose]);

  const uploadImage = async (file: File) => {
    const fileError = validateImageFile(file);
    if (fileError) {
      onShowToast(fileError);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadMedia(file);
      patch({ image: uploaded.url });
      onShowToast('تم رفع صورة المشروع بنجاح');
    } catch (error) {
      onShowToast(getErrorMessage(error, 'تعذر رفع الصورة'));
    } finally {
      setUploading(false);
    }
  };

  const uploadGalleryImages = async (files: FileList) => {
    const selected = Array.from(files);
    if (selected.length === 0) return;

    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      // Sequential on purpose: parallel 50 MB uploads starve the browser's connection pool.
      for (const file of selected) {
        const fileError = validateImageFile(file);
        if (fileError) {
          onShowToast(fileError);
          continue;
        }
        const uploaded = await uploadMedia(file);
        uploadedUrls.push(uploaded.url);
      }

      if (uploadedUrls.length > 0) {
        appendGallery(uploadedUrls);
        onShowToast(
          uploadedUrls.length === selected.length
            ? 'تم رفع صور المعرض بنجاح'
            : `تم رفع ${uploadedUrls.length} من ${selected.length} صورة`
        );
      }
    } catch (error) {
      if (uploadedUrls.length > 0) {
        appendGallery(uploadedUrls);
      }
      onShowToast(getErrorMessage(error, 'تعذر رفع صور المعرض'));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      onShowToast('يرجى تصحيح الحقول المميزة قبل الحفظ');
      return;
    }

    const area = parseRequiredNumber(form.area) as number;
    const lat = parseRequiredNumber(form.lat);
    const lng = parseRequiredNumber(form.lng);

    const merged: Property = {
      ...project,
      title: form.title.trim(),
      titleEn: trimmedOrUndefined(form.titleEn),
      type: form.type,
      typeAr: form.typeAr,
      priceType: form.priceType,
      status: trimmedOrUndefined(form.status),
      statusEn: trimmedOrUndefined(form.statusEn),
      badge: trimmedOrUndefined(form.badge),
      badgeEn: trimmedOrUndefined(form.badgeEn),
      city: form.city.trim(),
      cityEn: trimmedOrUndefined(form.cityEn),
      area,
      description: trimmedOrUndefined(form.description),
      descriptionEn: trimmedOrUndefined(form.descriptionEn),
      features: splitLines(form.features),
      featuresEn: splitLines(form.featuresEn),
      lat: lat === null ? undefined : lat,
      lng: lng === null ? undefined : lng,
      videoUrl: embedUrl ?? undefined,
      image: form.image,
      gallery: [...form.gallery],
      virtualTour3dAvailable: form.virtualTour3dAvailable,
    };

    setSaving(true);
    try {
      await AdminStorage.updateProject(project.id, merged);
      onShowToast('تم حفظ تعديلات المشروع');
      await onSaved();
      onClose();
    } catch (error) {
      onShowToast(getErrorMessage(error, 'تعذر حفظ التعديلات'));
    } finally {
      setSaving(false);
    }
  };

  // Only offer the maps deep link once both coordinates are actually usable.
  const parsedLat = parseRequiredNumber(form.lat);
  const parsedLng = parseRequiredNumber(form.lng);
  const mapsLink =
    parsedLat !== null && parsedLng !== null && !Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)
      ? `https://www.google.com/maps?q=${encodeURIComponent(parsedLat)},${encodeURIComponent(parsedLng)}`
      : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="تعديل بيانات المشروع"
    >
      <div className="relative w-full max-w-3xl bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-5 sm:p-6 my-4 sm:my-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-base font-black text-heading truncate">تعديل المشروع</h3>
            <p className="text-[11px] text-neutral-text/60 mt-0.5 truncate">
              تحديث بيانات العرض العامة للمشروع. تعديل الأدوار والوحدات يتم من تبويب "إدارة الوحدات".
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            title="إغلاق"
            className="p-2 rounded-xl text-neutral-text/60 hover:text-accent hover:bg-surface-hover transition cursor-pointer shrink-0"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Basic information */}
          <Section title="البيانات الأساسية">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="pe-title">
                  اسم المشروع *
                </label>
                <input
                  id="pe-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  className={INPUT_CLASS}
                />
                {errors.title && <ErrorText>{errors.title}</ErrorText>}
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-title-en">
                  اسم المشروع (بالإنجليزية)
                </label>
                <input
                  id="pe-title-en"
                  type="text"
                  dir="ltr"
                  value={form.titleEn}
                  onChange={(e) => patch({ titleEn: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-type">
                  نوع المشروع
                </label>
                <select
                  id="pe-type"
                  value={form.type}
                  onChange={(e) => {
                    const nextType = e.target.value as PropertyType;
                    patch({ type: nextType, typeAr: PROJECT_TYPE_LABELS_AR[nextType] });
                  }}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PROJECT_TYPE_LABELS_AR[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-price-type">
                  طبيعة العقد
                </label>
                <select
                  id="pe-price-type"
                  value={form.priceType}
                  onChange={(e) => patch({ priceType: e.target.value as PriceType })}
                  className={`${INPUT_CLASS} cursor-pointer`}
                >
                  {PRICE_TYPES.map((priceType) => (
                    <option key={priceType} value={priceType}>
                      {priceType}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-status">
                  الحالة
                </label>
                <input
                  id="pe-status"
                  type="text"
                  value={form.status}
                  onChange={(e) => patch({ status: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-status-en">
                  الحالة (بالإنجليزية)
                </label>
                <input
                  id="pe-status-en"
                  type="text"
                  dir="ltr"
                  value={form.statusEn}
                  onChange={(e) => patch({ statusEn: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-badge">
                  الشارة
                </label>
                <input
                  id="pe-badge"
                  type="text"
                  value={form.badge}
                  onChange={(e) => patch({ badge: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-badge-en">
                  الشارة (بالإنجليزية)
                </label>
                <input
                  id="pe-badge-en"
                  type="text"
                  dir="ltr"
                  value={form.badgeEn}
                  onChange={(e) => patch({ badgeEn: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-city">
                  المدينة *
                </label>
                <input
                  id="pe-city"
                  type="text"
                  value={form.city}
                  onChange={(e) => patch({ city: e.target.value })}
                  className={INPUT_CLASS}
                />
                {errors.city && <ErrorText>{errors.city}</ErrorText>}
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-city-en">
                  المدينة (بالإنجليزية)
                </label>
                <input
                  id="pe-city-en"
                  type="text"
                  dir="ltr"
                  value={form.cityEn}
                  onChange={(e) => patch({ cityEn: e.target.value })}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-area">
                  المساحة (م²) *
                </label>
                <input
                  id="pe-area"
                  type="number"
                  min={0}
                  value={form.area}
                  onChange={(e) => patch({ area: e.target.value })}
                  className={INPUT_CLASS}
                />
                {errors.area && <ErrorText>{errors.area}</ErrorText>}
              </div>
            </div>
          </Section>

          {/* Descriptions */}
          <Section title="الوصف">
            <div>
              <label className={LABEL_CLASS} htmlFor="pe-description">
                الوصف (بالعربية)
              </label>
              <textarea
                id="pe-description"
                rows={3}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                className={`${INPUT_CLASS} resize-y leading-relaxed`}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="pe-description-en">
                الوصف (بالإنجليزية)
              </label>
              <textarea
                id="pe-description-en"
                rows={3}
                dir="ltr"
                value={form.descriptionEn}
                onChange={(e) => patch({ descriptionEn: e.target.value })}
                className={`${INPUT_CLASS} resize-y leading-relaxed`}
              />
            </div>
          </Section>

          {/* Features */}
          <Section title="المزايا (عنصر واحد في كل سطر)">
            <div>
              <label className={LABEL_CLASS} htmlFor="pe-features">
                المزايا (بالعربية)
              </label>
              <textarea
                id="pe-features"
                rows={4}
                value={form.features}
                onChange={(e) => patch({ features: e.target.value })}
                placeholder={'موقع استراتيجي\nمواقف خاصة\nتشطيب راقي'}
                className={`${INPUT_CLASS} resize-y leading-loose`}
              />
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="pe-features-en">
                المزايا (بالإنجليزية)
              </label>
              <textarea
                id="pe-features-en"
                rows={4}
                dir="ltr"
                value={form.featuresEn}
                onChange={(e) => patch({ featuresEn: e.target.value })}
                placeholder={'Prime location\nPrivate parking\nLuxury finishing'}
                className={`${INPUT_CLASS} resize-y leading-loose`}
              />
            </div>
          </Section>

          {/* Location */}
          <Section title="الموقع الجغرافي">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="pe-lat">
                  خط العرض (Latitude)
                </label>
                <input
                  id="pe-lat"
                  type="number"
                  step="any"
                  dir="ltr"
                  placeholder="24.7136"
                  value={form.lat}
                  onChange={(e) => patch({ lat: e.target.value })}
                  className={INPUT_CLASS}
                />
                {errors.lat && <ErrorText>{errors.lat}</ErrorText>}
              </div>

              <div>
                <label className={LABEL_CLASS} htmlFor="pe-lng">
                  خط الطول (Longitude)
                </label>
                <input
                  id="pe-lng"
                  type="number"
                  step="any"
                  dir="ltr"
                  placeholder="46.6753"
                  value={form.lng}
                  onChange={(e) => patch({ lng: e.target.value })}
                  className={INPUT_CLASS}
                />
                {errors.lng && <ErrorText>{errors.lng}</ErrorText>}
              </div>
            </div>

            {mapsLink && (
              <a
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[10px] font-bold text-accent hover:underline"
              >
                <MapPin className="w-3 h-3" />
                <span>فتح في خرائط Google</span>
              </a>
            )}
          </Section>

          {/* Video */}
          <Section title="فيديو المشروع">
            <div>
              <label className={LABEL_CLASS} htmlFor="pe-video">
                رابط فيديو يوتيوب
              </label>
              <input
                id="pe-video"
                type="text"
                dir="ltr"
                placeholder="https://www.youtube.com/watch?v=XXXXXXXXXXX"
                value={form.videoUrl}
                onChange={(e) => patch({ videoUrl: e.target.value })}
                className={INPUT_CLASS}
              />
              {errors.videoUrl && <ErrorText>{errors.videoUrl}</ErrorText>}
            </div>

            {embedUrl && (
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-muted-border/50 bg-neutral-950">
                <iframe
                  src={embedUrl}
                  title="معاينة فيديو المشروع"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            )}
          </Section>

          {/* Media */}
          <Section title="الصور">
            <div>
              <label className={LABEL_CLASS}>صورة المشروع الرئيسية *</label>
              {form.image ? (
                <div className="relative rounded-2xl overflow-hidden border border-muted-border/50">
                  <img
                    src={form.image}
                    alt="صورة المشروع الرئيسية"
                    className="w-full h-40 object-cover"
                  />
                  <div className="absolute top-2 inset-x-2 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/70 text-white text-[10px] font-bold hover:bg-black/85 transition cursor-pointer disabled:opacity-60"
                    >
                      {uploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ImageUp className="w-3 h-3" />}
                      <span>{uploading ? 'جارٍ الرفع...' : 'استبدال الصورة'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isBusy}
                  className="w-full h-40 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex flex-col items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                >
                  {uploading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ImageUp className="w-5 h-5" />}
                  <span className="text-[10px] font-bold">
                    {uploading ? 'جارٍ الرفع...' : 'ارفع صورة المشروع'}
                  </span>
                </button>
              )}
              {errors.image && <ErrorText>{errors.image}</ErrorText>}
            </div>

            <div>
              <label className={LABEL_CLASS}>معرض الصور</label>
              {form.gallery.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                  {form.gallery.map((src, index) => (
                    <div
                      // Gallery URLs are not guaranteed unique across uploads, so index the key.
                      key={`${src}-${index}`}
                      className="relative group rounded-xl overflow-hidden border border-muted-border/40 aspect-square"
                    >
                      <img
                        src={src}
                        alt={`صورة المعرض ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patch({ gallery: form.gallery.filter((_, position) => position !== index) })
                        }
                        title="إزالة الصورة"
                        className="absolute top-1.5 left-1.5 p-1 rounded-lg bg-black/70 text-white hover:bg-red-500 transition cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                disabled={isBusy}
                className="w-full py-3 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
              >
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="text-[10px] font-bold">
                  {uploading ? 'جارٍ رفع الصور...' : 'إضافة صور للمعرض'}
                </span>
              </button>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.virtualTour3dAvailable}
                onChange={(e) => patch({ virtualTour3dAvailable: e.target.checked })}
                className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[11px] font-bold text-heading">الجولة الافتراضية ثلاثية الأبعاد متوفرة</span>
            </label>
          </Section>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadImage(file);
              e.target.value = '';
            }}
          />

          <input
            ref={galleryInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) void uploadGalleryImages(files);
              e.target.value = '';
            }}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted-border/30">
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="brand-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isBusy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'جارٍ الحفظ...' : uploading ? 'جارٍ الرفع...' : 'حفظ التعديلات'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
