import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, ImageUp, FileText, X as CloseIcon } from 'lucide-react';
import type { Property, PropertyUnit, PropertyType, UnitStatus } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import { getErrorMessage } from '../../services/api';
import { uploadMedia, isAcceptedMedia, MAX_UPLOAD_BYTES } from '../../services/mediaService';

type PriceType = 'إيجار' | 'بيع' | 'استثمار';

interface ProjectCreateModalProps {
  onClose: () => void;
  onCreated: (project: Property) => void | Promise<void>;
  onShowToast: (message: string) => void;
}

const TYPE_AR: Record<PropertyType, string> = {
  commercial: 'مجمع ومراكز تجارية',
  residential: 'مجمع سكني فاخر',
  office: 'مبنى إداري للأعمال',
  logistics: 'مستودعات ومخازن لوجستية',
  hotel: 'فنادق وأجنحة فندقية',
};

const MAX_FLOORS = 10;
const MAX_UNITS_PER_FLOOR = 12;

const EMPTY_FORM = {
  title: '',
  type: 'commercial' as PropertyType,
  city: 'الرياض',
  area: 5000,
  priceType: 'إيجار' as PriceType,
  description: '',
  floorsCount: 3,
  unitsPerFloor: 4,
  imageUrl: '',
  brochureUrl: '',
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;

function floorNameAr(index: number): string {
  if (index === 0) return 'الدور الأرضي';
  if (index === 1) return 'الدور الأول';
  if (index === 2) return 'الدور الثاني';
  return `الدور ${index + 1}`;
}

/** Builds the starting floors and units for a new project. */
function generateFloors(form: typeof EMPTY_FORM) {
  const floorsCount = clamp(form.floorsCount, 1, MAX_FLOORS);
  const unitsPerFloor = clamp(form.unitsPerFloor, 1, MAX_UNITS_PER_FLOOR);

  return Array.from({ length: floorsCount }).map((_, fIdx) => {
    const name = floorNameAr(fIdx);
    const units: PropertyUnit[] = Array.from({ length: unitsPerFloor }).map((__, uIdx) => {
      const unitType: PropertyUnit['type'] =
        form.type === 'residential'
          ? 'apartment'
          : form.type === 'hotel'
          ? 'showroom'
          : form.type === 'commercial' && fIdx === 0
          ? 'showroom'
          : form.type === 'logistics'
          ? 'warehouse'
          : 'office';

      const unitTypeAr =
        unitType === 'apartment'
          ? 'شقة سكنية فاخرة'
          : unitType === 'showroom'
          ? form.type === 'hotel'
            ? 'جناح فندقي'
            : 'معرض تجاري'
          : unitType === 'warehouse'
          ? 'مستودع تخزين'
          : 'مكتب إداري';

      return {
        // Unit ids are globally unique on the server; titles are not.
        id: `u-${crypto.randomUUID()}`,
        unitNumber: `وحدة ${(fIdx + 1) * 100 + (uIdx + 1)}`,
        floorNumber: fIdx,
        floorNameAr: name,
        type: unitType,
        typeAr: unitTypeAr,
        area: Math.round(form.area / (floorsCount * unitsPerFloor)),
        status: 'available' as UnitStatus,
        statusAr: 'متاح',
        features: ['تشطيب راقي', 'تكييف مركزي', 'مواقف خاصة'],
      };
    });

    return {
      floorNumber: fIdx,
      floorNameAr: name,
      floorNameEn: `Floor ${fIdx}`,
      totalArea: Math.round(form.area / floorsCount),
      units,
    };
  });
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ onClose, onCreated, onShowToast }) => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [uploadingField, setUploadingField] = useState<'image' | 'brochure' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<'image' | 'brochure'>('image');

  const isDirty = JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);
  const busy = creating || uploadingField !== null;

  const requestClose = () => {
    if (busy) return;
    if (isDirty && !window.confirm('لديك بيانات غير محفوظة. هل تريد إغلاق النافذة دون إنشاء المشروع؟')) return;
    onClose();
  };

  // Escape closes, via the same dirty-check as the close button.
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleFileSelected = async (file: File | undefined) => {
    if (!file) return;
    const target = uploadTargetRef.current;
    if (!isAcceptedMedia(file)) {
      onShowToast('صيغة الملف غير مدعومة (JPG, PNG, WebP, PDF)');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onShowToast('حجم الملف يتجاوز 50 ميجابايت');
      return;
    }

    setUploadingField(target);
    try {
      const uploaded = await uploadMedia(file);
      setForm((current) =>
        target === 'image' ? { ...current, imageUrl: uploaded.url } : { ...current, brochureUrl: uploaded.url }
      );
      onShowToast('تم رفع الملف بنجاح');
    } catch (error) {
      onShowToast(getErrorMessage(error, 'تعذر رفع الملف'));
    } finally {
      setUploadingField(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openFilePicker = (target: 'image' | 'brochure') => {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (!form.imageUrl) {
      onShowToast('يرجى رفع صورة للمشروع');
      return;
    }

    setCreating(true);
    const floors = generateFloors(form);
    const draft: Property = {
      // The server assigns the id; 0 keeps the draft shape valid until then.
      id: 0,
      title: form.title.trim(),
      type: form.type,
      typeAr: TYPE_AR[form.type],
      priceType: form.priceType,
      city: form.city.trim() || 'الرياض',
      area: Math.max(0, form.area),
      status: 'متاح',
      image: form.imageUrl,
      gallery: [form.imageUrl],
      brochureUrl: form.brochureUrl || undefined,
      description: form.description.trim() || undefined,
      floors,
      virtualTour3dAvailable: true,
    };

    try {
      const created = await AdminStorage.createProject(draft, floors);
      onShowToast('تم إنشاء المشروع الجديد بنجاح!');
      await onCreated(created);
    } catch (error) {
      onShowToast(getErrorMessage(error, 'تعذر إنشاء المشروع'));
    } finally {
      setCreating(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';
  const labelClass = 'block text-[11px] font-bold text-neutral-text/70 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        className="relative w-full max-w-lg bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 sm:p-8 my-8"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 id="create-project-title" className="text-base font-black text-heading">
              إضافة مشروع عقاري جديد
            </h3>
            <p className="text-[11px] text-neutral-text/60 mt-1">
              التفاصيل الإضافية (الموقع، الفيديو، النصوص الإنجليزية) تُضاف من شاشة تعديل المشروع بعد الإنشاء.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-surface-hover cursor-pointer shrink-0"
            aria-label="إغلاق"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>اسم المشروع *</label>
            <input
              type="text"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: مجمع أبراج السحاب السكني"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>نوع المشروع</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PropertyType })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="commercial">مجمع تجاري (محلات ومعارض)</option>
                <option value="residential">مجمع سكني (أدوار وشقق)</option>
                <option value="office">مبنى ومكاتب إدارية</option>
                <option value="logistics">مستودعات لوجستية</option>
                <option value="hotel">فنادق وأجنحة</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>طبيعة العقد</label>
              <select
                value={form.priceType}
                onChange={(e) => setForm({ ...form, priceType: e.target.value as PriceType })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="إيجار">للإيجار</option>
                <option value="بيع">للبيع والتملك</option>
                <option value="استثمار">فرصة استثمارية</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>المدينة</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>المساحة (م²)</label>
              <input
                type="number"
                min={0}
                value={form.area}
                onChange={(e) => setForm({ ...form, area: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>عدد الأدوار (1–{MAX_FLOORS})</label>
              <input
                type="number"
                min={1}
                max={MAX_FLOORS}
                value={form.floorsCount}
                onChange={(e) => setForm({ ...form, floorsCount: Number(e.target.value) })}
                onBlur={() => setForm((f) => ({ ...f, floorsCount: clamp(f.floorsCount, 1, MAX_FLOORS) }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>وحدات بكل دور (1–{MAX_UNITS_PER_FLOOR})</label>
              <input
                type="number"
                min={1}
                max={MAX_UNITS_PER_FLOOR}
                value={form.unitsPerFloor}
                onChange={(e) => setForm({ ...form, unitsPerFloor: Number(e.target.value) })}
                onBlur={() =>
                  setForm((f) => ({ ...f, unitsPerFloor: clamp(f.unitsPerFloor, 1, MAX_UNITS_PER_FLOOR) }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>وصف المشروع</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر لمميزات المشروع والموقع..."
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>صورة المشروع *</label>
              {form.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-muted-border/50">
                  <img src={form.imageUrl} alt="صورة المشروع" className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, imageUrl: '' }))}
                    className="absolute top-1.5 start-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                    title="إزالة الصورة"
                  >
                    <CloseIcon className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openFilePicker('image')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    uploadTargetRef.current = 'image';
                    void handleFileSelected(e.dataTransfer.files[0]);
                  }}
                  className="w-full h-28 rounded-xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {uploadingField === 'image' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ImageUp className="w-5 h-5" />}
                  <span className="text-[10px] font-bold">
                    {uploadingField === 'image' ? 'جارٍ الرفع...' : 'اسحب صورة أو انقر للرفع'}
                  </span>
                </button>
              )}
            </div>

            <div>
              <label className={labelClass}>ملف الكتيّب (PDF)</label>
              {form.brochureUrl ? (
                <div className="h-28 rounded-xl border border-muted-border/50 bg-canvas flex items-center gap-2 p-3">
                  <FileText className="w-5 h-5 text-accent shrink-0" />
                  <a
                    href={form.brochureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-heading hover:text-accent truncate min-w-0"
                  >
                    عرض الكتيّب
                  </a>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, brochureUrl: '' }))}
                    className="ms-auto p-1 rounded-lg text-neutral-text/60 hover:text-red-500 transition cursor-pointer shrink-0"
                    title="إزالة الملف"
                  >
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openFilePicker('brochure')}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    uploadTargetRef.current = 'brochure';
                    void handleFileSelected(e.dataTransfer.files[0]);
                  }}
                  className="w-full h-28 rounded-xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex flex-col items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {uploadingField === 'brochure' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                  <span className="text-[10px] font-bold">
                    {uploadingField === 'brochure' ? 'جارٍ الرفع...' : 'اسحب ملف PDF أو انقر للرفع'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf"
            className="hidden"
            onChange={(e) => void handleFileSelected(e.target.files?.[0])}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-muted-border/30">
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy}
              className="brand-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {creating ? 'جارٍ الإنشاء...' : 'تأكيد وإنشاء المشروع'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
