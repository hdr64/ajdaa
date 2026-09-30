import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  FileText,
  ImageUp,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  SearchX,
  XCircle,
  X as CloseIcon,
} from 'lucide-react';
import type { PriceType, Property, PropertyType } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { isAcceptedMedia, MAX_UPLOAD_BYTES, uploadMedia } from '../../../services/mediaService';
import { toYoutubeEmbedUrl } from '../../../services/youtube';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { PRICE_TYPES, PROJECT_TYPE_LABELS_AR, PROPERTY_TYPES } from '../projectLabels';

const INPUT_CLASS =
  'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';
const LABEL_CLASS = 'block text-[11px] font-bold text-neutral-text/70 mb-1';
const FORM_ID = 'project-edit-form';

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
  brochureUrl: string;
  virtualTour3dAvailable: boolean;
}

const trimmedOrUndefined = (value: string) => value.trim() || undefined;

/** One entry per non-empty line, which is how the textareas are authored. */
const splitLines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

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
    area: project.area == null ? '' : String(project.area),
    description: project.description ?? '',
    descriptionEn: project.descriptionEn ?? '',
    features: (project.features ?? []).join('\n'),
    featuresEn: (project.featuresEn ?? []).join('\n'),
    lat: project.lat == null ? '' : String(project.lat),
    lng: project.lng == null ? '' : String(project.lng),
    videoUrl: project.videoUrl ?? '',
    image: project.image ?? '',
    gallery: [...(project.gallery ?? [])],
    brochureUrl: project.brochureUrl ?? '',
    virtualTour3dAvailable: project.virtualTour3dAvailable ?? false,
  };
}

/** null = empty, NaN = not a number. */
function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function validateImageFile(file: File): string | null {
  if (!isAcceptedMedia(file) || !file.type.startsWith('image/')) return 'صيغة الصورة غير مدعومة (JPG, PNG, WebP, AVIF, GIF)';
  if (file.size > MAX_UPLOAD_BYTES) return 'حجم الصورة يتجاوز 50 ميجابايت';
  return null;
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs space-y-4">
      <div>
        <h3 className="text-sm font-black text-heading">{title}</h3>
        {description && <p className="text-[11px] text-neutral-text/60 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
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

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={LABEL_CLASS} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

const ProjectEditForm: React.FC<{ project: Property }> = ({ project }) => {
  const { projects, navigate, showToast, confirm, confirmDelete } = useAdmin();
  const [baseline, setBaseline] = useState<EditorForm>(() => toFormState(project));
  const [form, setForm] = useState<EditorForm>(baseline);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'gallery' | 'brochure' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const imageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const brochureInputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((changes: Partial<EditorForm>) => {
    setForm((current) => ({ ...current, ...changes }));
    setErrors((current) => {
      if (Object.keys(current).length === 0) return current;
      const next = { ...current };
      Object.keys(changes).forEach((key) => delete next[key]);
      return next;
    });
  }, []);

  // Removals only change the form until it is saved, but they still ask first.
  const removeGalleryImage = async (index: number) => {
    const url = form.gallery[index];
    const ok = await confirmDelete({
      title: 'إزالة هذه الصورة من المعرض؟',
      message: 'تُحذف من المشروع عند حفظ التعديلات.',
      confirmLabel: 'إزالة الصورة',
    });
    if (!ok) return;
    // By URL, not index: an upload may have appended images while the dialog was open.
    setForm((current) => {
      const at = current.gallery.indexOf(url);
      return at === -1 ? current : { ...current, gallery: current.gallery.filter((_, i) => i !== at) };
    });
  };

  const removeBrochure = async () => {
    const ok = await confirmDelete({
      title: 'إزالة ملف الكتيّب؟',
      message: 'يُحذف من المشروع عند حفظ التعديلات.',
      confirmLabel: 'إزالة الكتيّب',
    });
    if (ok) patch({ brochureUrl: '' });
  };

  const embedUrl = toYoutubeEmbedUrl(form.videoUrl);
  const busy = saving || uploading !== null;
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  // Refresh / tab close with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const validate = (): Record<string, string> => {
    const found: Record<string, string> = {};
    if (!form.title.trim()) found.title = 'اسم المشروع مطلوب';
    if (!form.city.trim()) found.city = 'المدينة مطلوبة';
    if (!form.image.trim()) found.image = 'صورة المشروع الرئيسية مطلوبة';

    const area = parseNumber(form.area);
    if (area === null || Number.isNaN(area)) found.area = 'المساحة مطلوبة ويجب أن تكون رقماً';
    else if (area < 0) found.area = 'المساحة لا يمكن أن تكون سالبة';

    const lat = parseNumber(form.lat);
    const lng = parseNumber(form.lng);
    if (Number.isNaN(lat)) found.lat = 'خط العرض يجب أن يكون رقماً';
    else if (lat !== null && (lat < -90 || lat > 90)) found.lat = 'خط العرض يجب أن يكون بين -90 و 90';
    if (Number.isNaN(lng)) found.lng = 'خط الطول يجب أن يكون رقماً';
    else if (lng !== null && (lng < -180 || lng > 180)) found.lng = 'خط الطول يجب أن يكون بين -180 و 180';
    if ((lat === null) !== (lng === null)) found.lng = 'أدخل خطي العرض والطول معاً أو اتركهما فارغين';

    if (embedUrl === undefined) found.videoUrl = 'رابط الفيديو غير صالح. استخدم رابط يوتيوب أو معرّف الفيديو (11 حرفاً)';
    return found;
  };

  const upload = async (kind: 'image' | 'brochure', file: File) => {
    if (kind === 'image') {
      const problem = validateImageFile(file);
      if (problem) return showToast(problem);
    } else if (file.type !== 'application/pdf') {
      return showToast('الكتيّب يجب أن يكون ملف PDF');
    } else if (file.size > MAX_UPLOAD_BYTES) {
      return showToast('حجم الملف يتجاوز 50 ميجابايت');
    }

    setUploading(kind);
    try {
      const uploaded = await uploadMedia(file);
      patch(kind === 'image' ? { image: uploaded.url } : { brochureUrl: uploaded.url });
      showToast(kind === 'image' ? 'تم رفع الصورة الرئيسية' : 'تم رفع الكتيّب');
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر رفع الملف'));
    } finally {
      setUploading(null);
    }
  };

  const uploadGallery = async (files: FileList) => {
    const selected = Array.from(files);
    if (selected.length === 0) return;
    setUploading('gallery');
    const urls: string[] = [];
    try {
      // Sequential on purpose: parallel 50 MB uploads starve the connection pool.
      for (const file of selected) {
        const problem = validateImageFile(file);
        if (problem) {
          showToast(problem);
          continue;
        }
        urls.push((await uploadMedia(file)).url);
      }
      if (urls.length > 0) {
        showToast(urls.length === selected.length ? 'تم رفع صور المعرض' : `تم رفع ${urls.length} من ${selected.length} صورة`);
      }
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر رفع صور المعرض'));
    } finally {
      // Append to the gallery as it is *now*: removals made during the upload stay removed.
      if (urls.length > 0) setForm((current) => ({ ...current, gallery: [...current.gallery, ...urls] }));
      setUploading(null);
    }
  };

  const moveGalleryItem = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= form.gallery.length) return;
    const gallery = [...form.gallery];
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    patch({ gallery });
  };

  const leave = async () => {
    if (busy) return;
    if (isDirty) {
      const ok = await confirm({
        title: 'تجاهل التعديلات غير المحفوظة؟',
        message: 'ستفقد التغييرات التي لم تحفظها على هذا المشروع.',
        confirmLabel: 'تجاهل التعديلات',
        danger: true,
      });
      if (!ok) return;
    }
    navigate({ section: 'project', projectId: project.id });
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      showToast('يرجى تصحيح الحقول المميزة قبل الحفظ');
      document.getElementById(`pe-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    const lat = parseNumber(form.lat);
    const lng = parseNumber(form.lng);
    const merged: Property = {
      ...project,
      title: form.title.trim(),
      titleEn: trimmedOrUndefined(form.titleEn),
      type: form.type,
      typeAr: form.typeAr.trim() || PROJECT_TYPE_LABELS_AR[form.type],
      priceType: form.priceType,
      status: trimmedOrUndefined(form.status),
      statusEn: trimmedOrUndefined(form.statusEn),
      badge: trimmedOrUndefined(form.badge),
      badgeEn: trimmedOrUndefined(form.badgeEn),
      city: form.city.trim(),
      cityEn: trimmedOrUndefined(form.cityEn),
      area: parseNumber(form.area) as number,
      description: trimmedOrUndefined(form.description),
      descriptionEn: trimmedOrUndefined(form.descriptionEn),
      features: splitLines(form.features),
      featuresEn: splitLines(form.featuresEn),
      lat: lat ?? undefined,
      lng: lng ?? undefined,
      videoUrl: embedUrl ?? undefined,
      image: form.image,
      gallery: [...form.gallery],
      brochureUrl: form.brochureUrl || undefined,
      virtualTour3dAvailable: form.virtualTour3dAvailable,
    };

    setSaving(true);
    try {
      await AdminStorage.updateProject(project.id, merged);
      setBaseline(form); // clears the dirty flag before leaving
      showToast('تم حفظ تعديلات المشروع');
      await projects.reload();
      navigate({ section: 'project', projectId: project.id });
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حفظ التعديلات'));
    } finally {
      setSaving(false);
    }
  };

  const lat = parseNumber(form.lat);
  const lng = parseNumber(form.lng);
  const hasCoords = lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);

  return (
    <>
      <AdminHeaderActions>
        <button
          type="button"
          onClick={() => void leave()}
          disabled={saving}
          className="brand-btn-secondary px-3 sm:px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
        >
          إلغاء
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={busy || !isDirty}
          className="brand-btn-primary px-3 sm:px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          title={!isDirty ? 'لا توجد تعديلات لحفظها' : undefined}
        >
          {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span className="hidden sm:inline">{saving ? 'جارٍ الحفظ...' : uploading ? 'جارٍ الرفع...' : 'حفظ التعديلات'}</span>
        </button>
      </AdminHeaderActions>

      <form id={FORM_ID} onSubmit={handleSave} noValidate className="space-y-5">
        <button
          type="button"
          onClick={() => void leave()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-text/60 hover:text-accent cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
          العودة إلى صفحة المشروع
        </button>

        {isDirty && (
          <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 text-[11px] font-bold">
            لديك تعديلات غير محفوظة.
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
          {/* Content column */}
          <div className="xl:col-span-3 space-y-5">
            <Card title="البيانات الأساسية">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="اسم المشروع *" htmlFor="pe-title" error={errors.title}>
                  <input id="pe-title" type="text" value={form.title} onChange={(e) => patch({ title: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="اسم المشروع (بالإنجليزية)" htmlFor="pe-titleEn">
                  <input id="pe-titleEn" type="text" dir="ltr" value={form.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="نوع المشروع" htmlFor="pe-type">
                  <select
                    id="pe-type"
                    value={form.type}
                    onChange={(e) => {
                      const type = e.target.value as PropertyType;
                      patch({ type, typeAr: PROJECT_TYPE_LABELS_AR[type] });
                    }}
                    className={`${INPUT_CLASS} cursor-pointer`}
                  >
                    {PROPERTY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {PROJECT_TYPE_LABELS_AR[type]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="وصف النوع المعروض" htmlFor="pe-typeAr">
                  <input id="pe-typeAr" type="text" value={form.typeAr} onChange={(e) => patch({ typeAr: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="طبيعة العقد" htmlFor="pe-priceType">
                  <select id="pe-priceType" value={form.priceType} onChange={(e) => patch({ priceType: e.target.value as PriceType })} className={`${INPUT_CLASS} cursor-pointer`}>
                    {PRICE_TYPES.map((priceType) => (
                      <option key={priceType} value={priceType}>
                        {priceType}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="المساحة (م²) *" htmlFor="pe-area" error={errors.area}>
                  <input id="pe-area" type="number" min={0} value={form.area} onChange={(e) => patch({ area: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="المدينة *" htmlFor="pe-city" error={errors.city}>
                  <input id="pe-city" type="text" value={form.city} onChange={(e) => patch({ city: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="المدينة (بالإنجليزية)" htmlFor="pe-cityEn">
                  <input id="pe-cityEn" type="text" dir="ltr" value={form.cityEn} onChange={(e) => patch({ cityEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="حالة المشروع" htmlFor="pe-status">
                  <input id="pe-status" type="text" placeholder="متاح للتأجير" value={form.status} onChange={(e) => patch({ status: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="حالة المشروع (بالإنجليزية)" htmlFor="pe-statusEn">
                  <input id="pe-statusEn" type="text" dir="ltr" value={form.statusEn} onChange={(e) => patch({ statusEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="الشارة" htmlFor="pe-badge">
                  <input id="pe-badge" type="text" placeholder="مشروع رئيسي مميز" value={form.badge} onChange={(e) => patch({ badge: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="الشارة (بالإنجليزية)" htmlFor="pe-badgeEn">
                  <input id="pe-badgeEn" type="text" dir="ltr" value={form.badgeEn} onChange={(e) => patch({ badgeEn: e.target.value })} className={INPUT_CLASS} />
                </Field>
              </div>
            </Card>

            <Card title="الوصف">
              <Field label="الوصف (بالعربية)" htmlFor="pe-description">
                <textarea id="pe-description" rows={5} value={form.description} onChange={(e) => patch({ description: e.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
              </Field>
              <Field label="الوصف (بالإنجليزية)" htmlFor="pe-descriptionEn">
                <textarea id="pe-descriptionEn" rows={5} dir="ltr" value={form.descriptionEn} onChange={(e) => patch({ descriptionEn: e.target.value })} className={`${INPUT_CLASS} resize-y leading-relaxed`} />
              </Field>
            </Card>

            <Card title="المزايا" description="عنصر واحد في كل سطر.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="بالعربية" htmlFor="pe-features">
                  <textarea id="pe-features" rows={7} value={form.features} onChange={(e) => patch({ features: e.target.value })} placeholder={'موقع استراتيجي\nمواقف خاصة'} className={`${INPUT_CLASS} resize-y leading-loose`} />
                </Field>
                <Field label="بالإنجليزية" htmlFor="pe-featuresEn">
                  <textarea id="pe-featuresEn" rows={7} dir="ltr" value={form.featuresEn} onChange={(e) => patch({ featuresEn: e.target.value })} placeholder={'Prime location\nPrivate parking'} className={`${INPUT_CLASS} resize-y leading-loose`} />
                </Field>
              </div>
            </Card>
          </div>

          {/* Media column */}
          <div className="xl:col-span-2 space-y-5">
            <Card title="الصور">
              <div>
                <span className={LABEL_CLASS}>الصورة الرئيسية *</span>
                {form.image ? (
                  <div className="relative rounded-2xl overflow-hidden border border-muted-border/50">
                    <img src={form.image} alt="الصورة الرئيسية" className="w-full aspect-[16/9] object-cover" />
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={busy}
                      className="absolute top-2 end-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/70 text-white text-[10px] font-bold hover:bg-black/85 cursor-pointer disabled:opacity-60"
                    >
                      {uploading === 'image' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ImageUp className="w-3 h-3" />}
                      {uploading === 'image' ? 'جارٍ الرفع...' : 'استبدال'}
                    </button>
                  </div>
                ) : (
                  <button
                    id="pe-image"
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={busy}
                    className="w-full aspect-[16/9] rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {uploading === 'image' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ImageUp className="w-5 h-5" />}
                    <span className="text-[10px] font-bold">{uploading === 'image' ? 'جارٍ الرفع...' : 'ارفع الصورة الرئيسية'}</span>
                  </button>
                )}
                {errors.image && <ErrorText>{errors.image}</ErrorText>}
              </div>

              <div>
                <span className={LABEL_CLASS}>معرض الصور ({form.gallery.length})</span>
                {form.gallery.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {form.gallery.map((src, index) => (
                      <div key={`${src}-${index}`} className="relative group rounded-xl overflow-hidden border border-muted-border/40 aspect-square">
                        <img src={src} alt={`صورة المعرض ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
                          <div className="flex gap-1">
                            <button type="button" onClick={() => moveGalleryItem(index, -1)} disabled={index === 0} className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-black disabled:opacity-30 cursor-pointer" aria-label="تقديم الصورة">
                              →
                            </button>
                            <button type="button" onClick={() => moveGalleryItem(index, 1)} disabled={index === form.gallery.length - 1} className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-black disabled:opacity-30 cursor-pointer" aria-label="تأخير الصورة">
                              ←
                            </button>
                          </div>
                          {form.image !== src && (
                            <button type="button" onClick={() => patch({ image: src })} className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold cursor-pointer" title="اجعلها الصورة الرئيسية">
                              رئيسية
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeGalleryImage(index)}
                          title="إزالة الصورة"
                          aria-label="إزالة الصورة"
                          className="absolute top-1 start-1 p-1 rounded-lg bg-black/70 text-white hover:bg-red-500 cursor-pointer"
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
                  disabled={busy}
                  className="w-full py-3 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {uploading === 'gallery' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="text-[10px] font-bold">{uploading === 'gallery' ? 'جارٍ رفع الصور...' : 'إضافة صور للمعرض'}</span>
                </button>
              </div>
            </Card>

            <Card title="الموقع على الخريطة" description="بدون إحداثيات لا يظهر المشروع على خريطة الموقع.">
              <div className="grid grid-cols-2 gap-3">
                <Field label="خط العرض (Latitude)" htmlFor="pe-lat" error={errors.lat}>
                  <input id="pe-lat" type="number" step="any" dir="ltr" placeholder="24.7136" value={form.lat} onChange={(e) => patch({ lat: e.target.value })} className={INPUT_CLASS} />
                </Field>
                <Field label="خط الطول (Longitude)" htmlFor="pe-lng" error={errors.lng}>
                  <input id="pe-lng" type="number" step="any" dir="ltr" placeholder="46.6753" value={form.lng} onChange={(e) => patch({ lng: e.target.value })} className={INPUT_CLASS} />
                </Field>
              </div>
              {hasCoords ? (
                <>
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted-border/50">
                    <iframe
                      title="معاينة الموقع"
                      src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                      className="w-full h-full"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-accent hover:underline">
                    <MapPin className="w-3 h-3" />
                    فتح في خرائط Google
                  </a>
                </>
              ) : (
                <p className="text-[11px] text-neutral-text/50">
                  انسخ الإحداثيات من خرائط Google: انقر بزر الفأرة الأيمن على الموقع ثم انقر على الأرقام لنسخها.
                </p>
              )}
            </Card>

            <Card title="الفيديو" description="يقبل رابط يوتيوب بأي صيغة (watch، youtu.be، shorts) أو معرّف الفيديو.">
              <Field label="رابط الفيديو" htmlFor="pe-videoUrl" error={errors.videoUrl}>
                <input id="pe-videoUrl" type="text" dir="ltr" placeholder="https://youtu.be/XXXXXXXXXXX" value={form.videoUrl} onChange={(e) => patch({ videoUrl: e.target.value })} className={INPUT_CLASS} />
              </Field>
              {embedUrl && (
                <div className="aspect-video w-full overflow-hidden rounded-2xl border border-muted-border/50 bg-neutral-950">
                  <iframe src={embedUrl} title="معاينة الفيديو" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full" />
                </div>
              )}
            </Card>

            <Card title="الكتيّب والجولة الافتراضية">
              <div>
                <span className={LABEL_CLASS}>ملف الكتيّب (PDF)</span>
                {form.brochureUrl ? (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-muted-border/50 bg-canvas">
                    <FileText className="w-5 h-5 text-accent shrink-0" />
                    <a href={form.brochureUrl} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-heading hover:text-accent truncate min-w-0">
                      عرض الكتيّب
                    </a>
                    <button type="button" onClick={() => brochureInputRef.current?.click()} disabled={busy} className="ms-auto text-[10px] font-bold text-accent hover:underline cursor-pointer">
                      استبدال
                    </button>
                    <button type="button" onClick={() => void removeBrochure()} className="p-1 rounded-lg text-neutral-text/60 hover:text-red-500 cursor-pointer" aria-label="إزالة الكتيّب" title="إزالة الكتيّب">
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => brochureInputRef.current?.click()}
                    disabled={busy}
                    className="w-full py-3 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {uploading === 'brochure' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    <span className="text-[10px] font-bold">{uploading === 'brochure' ? 'جارٍ الرفع...' : 'رفع ملف PDF'}</span>
                  </button>
                )}
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.virtualTour3dAvailable} onChange={(e) => patch({ virtualTour3dAvailable: e.target.checked })} className="w-4 h-4 cursor-pointer accent-[var(--accent)]" />
                <span className="text-[11px] font-bold text-heading">الجولة الافتراضية ثلاثية الأبعاد متوفرة</span>
              </label>
            </Card>
          </div>
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload('image', file);
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
            if (e.target.files?.length) void uploadGallery(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={brochureInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload('brochure', file);
            e.target.value = '';
          }}
        />
      </form>
    </>
  );
};

export const ProjectEditSection: React.FC = () => {
  const { projects, location, can, navigate } = useAdmin();
  const project = projects.data.find((p) => p.id === location.projectId);

  if (!can('manageProjects')) return <NoAccess />;
  if (projects.error) return <SectionError message={projects.error} onRetry={() => void projects.reload()} />;
  if (!project && projects.loading) return <SectionLoading label="جاري تحميل المشروع..." />;
  if (!project) {
    return (
      <EmptyState
        icon={SearchX}
        title="المشروع غير موجود"
        description="ربما تم حذفه أو أن الرابط غير صحيح."
        action={
          <button onClick={() => navigate({ section: 'projects' })} className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
            العودة إلى المشاريع
          </button>
        }
      />
    );
  }

  // Keyed by id so switching projects resets the form state.
  return <ProjectEditForm key={project.id} project={project} />;
};
