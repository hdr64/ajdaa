import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, ImageUp, FileText, X as CloseIcon } from 'lucide-react';
import type { Property, PropertyUnit, PropertyType, UnitStatus } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import { getErrorMessage } from '../../services/api';
import { uploadMedia, isAcceptedMedia, MAX_UPLOAD_BYTES } from '../../services/mediaService';
import { isHttpsUrl } from '../../utils/urlValidation';
import { useAdmin } from '../../pages/admin/adminContextDef';
import { useAdminT } from '../../i18n/admin/useAdminT';

type PriceType = 'إيجار' | 'بيع' | 'استثمار';

interface ProjectCreateModalProps {
  onClose: () => void;
  onCreated: (project: Property) => void | Promise<void>;
  onShowToast: (message: string) => void;
}

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
  model3dUrl: '',
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min;

function floorNames(index: number): { ar: string; en: string } {
  if (index === 0) return { ar: 'الدور الأرضي', en: 'Ground Floor' };
  if (index === 1) return { ar: 'الدور الأول', en: 'First Floor' };
  if (index === 2) return { ar: 'الدور الثاني', en: 'Second Floor' };
  return { ar: `الدور ${index + 1}`, en: `Floor ${index + 1}` };
}

/** Builds the starting floors and units for a new project. */
function generateFloors(form: typeof EMPTY_FORM, isEn: boolean) {
  const floorsCount = clamp(form.floorsCount, 1, MAX_FLOORS);
  const unitsPerFloor = clamp(form.unitsPerFloor, 0, MAX_UNITS_PER_FLOOR);

  return Array.from({ length: floorsCount }).map((_, fIdx) => {
    const names = floorNames(fIdx);
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

      const unitTypeEn =
        unitType === 'apartment'
          ? 'Luxury Apartment'
          : unitType === 'showroom'
          ? form.type === 'hotel'
            ? 'Hotel Suite'
            : 'Commercial Showroom'
          : unitType === 'warehouse'
          ? 'Storage Warehouse'
          : 'Executive Office';

      return {
        // Unit ids are globally unique on the server; titles are not.
        id: `u-${crypto.randomUUID()}`,
        unitNumber: isEn ? `Unit ${(fIdx + 1) * 100 + (uIdx + 1)}` : `وحدة ${(fIdx + 1) * 100 + (uIdx + 1)}`,
        floorNumber: fIdx,
        floorNameAr: names.ar,
        floorNameEn: names.en,
        type: unitType,
        typeAr: unitTypeAr,
        typeEn: unitTypeEn,
        area: Math.round(form.area / (floorsCount * Math.max(1, unitsPerFloor))),
        status: 'available' as UnitStatus,
        statusAr: 'متاح',
        features: [],
      };
    });

    return {
      floorNumber: fIdx,
      floorNameAr: names.ar,
      floorNameEn: names.en,
      totalArea: Math.round(form.area / floorsCount),
      units,
    };
  });
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ onClose, onCreated, onShowToast }) => {
  const { confirm } = useAdmin();
  const { t, isEn } = useAdminT();
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    city: isEn ? 'Riyadh' : 'الرياض',
  });
  const [creating, setCreating] = useState(false);
  const [uploadingField, setUploadingField] = useState<'image' | 'brochure' | null>(null);
  const [model3dError, setModel3dError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<'image' | 'brochure'>('image');

  const isDirty = JSON.stringify(form) !== JSON.stringify({ ...EMPTY_FORM, city: isEn ? 'Riyadh' : 'الرياض' });
  const busy = creating || uploadingField !== null;

  const requestClose = async () => {
    if (busy) return;
    if (isDirty) {
      const discard = await confirm({
        title: t('projectEdit.dirty.confirmTitle'),
        message: t('projectEdit.dirty.confirmMessage'),
        confirmLabel: t('projectEdit.dirty.confirmLabel'),
        danger: true,
      });
      if (!discard) return;
    }
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

  const openFilePicker = (target: 'image' | 'brochure') => {
    uploadTargetRef.current = target;
    if (fileInputRef.current) {
      fileInputRef.current.accept =
        target === 'image'
          ? 'image/jpeg,image/png,image/webp,image/avif,image/gif'
          : 'application/pdf';
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (file?: File) => {
    if (!file) return;
    const target = uploadTargetRef.current;

    if (!isAcceptedMedia(file)) {
      onShowToast(t('projects.modal.toastFormatUnsupported'));
      return;
    }
    if (target === 'image' && file.type === 'application/pdf') {
      onShowToast(t('projects.modal.toastImageNotPdf'));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onShowToast(t('projects.modal.toastFileSizeExceeded'));
      return;
    }

    setUploadingField(target);
    try {
      const folder = target === 'image' ? 'projects' : 'brochures';
      const uploaded = await uploadMedia(file, folder);
      setForm((current) => ({
        ...current,
        [target === 'image' ? 'imageUrl' : 'brochureUrl']: uploaded.url,
      }));
      onShowToast(t('projects.modal.toastUploadSuccess'));
    } catch (error) {
      onShowToast(getErrorMessage(error, t('projects.modal.toastUploadFailed')));
    } finally {
      setUploadingField(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) return;

    if (!form.imageUrl) {
      onShowToast(t('projects.modal.toastImageRequired'));
      return;
    }

    const trimmed3d = form.model3dUrl.trim();
    if (trimmed3d && !isHttpsUrl(trimmed3d)) {
      setModel3dError(t('projects.modal.model3dError'));
      return;
    }

    setCreating(true);
    try {
      const floors = generateFloors(form, isEn);
      const payload: Partial<Property> = {
        titleAr: trimmedTitle,
        titleEn: trimmedTitle,
        type: form.type,
        city: form.city.trim() || (isEn ? 'Riyadh' : 'الرياض'),
        area: form.area,
        status: 'متاح',
        priceType: form.priceType,
        descriptionAr: form.description.trim(),
        descriptionEn: form.description.trim(),
        imageUrl: form.imageUrl,
        brochureUrl: form.brochureUrl.trim() || undefined,
        model3dUrl: trimmed3d || undefined,
        publishStatus: 'draft',
        floors,
      };

      const created = await AdminStorage.createProject(payload);
      onShowToast(t('projects.modal.toastCreatedSuccess'));
      await onCreated(created);
      onClose();
    } catch (error) {
      onShowToast(getErrorMessage(error, t('projects.modal.toastCreateFailed')));
    } finally {
      setCreating(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent transition font-medium';
  const labelClass = 'block text-[11px] font-bold text-neutral-text/70 mb-1.5';

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
              {t('projects.modal.addProjectTitle')}
            </h3>
            <p className="text-[11px] text-neutral-text/60 mt-1">
              {t('projects.modal.addProjectSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-surface-hover cursor-pointer shrink-0"
            aria-label={t('users.close')}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>{t('projects.modal.projectName')}</label>
            <input
              type="text"
              required
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={t('projects.modal.projectNamePlaceholder')}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('projects.modal.projectType')}</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PropertyType })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="commercial">{t('common.projectType.commercial')}</option>
                <option value="residential">{t('common.projectType.residential')}</option>
                <option value="office">{t('common.projectType.office')}</option>
                <option value="logistics">{t('common.projectType.logistics')}</option>
                <option value="hotel">{t('common.projectType.hotel')}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{t('projects.modal.contractType')}</label>
              <select
                value={form.priceType}
                onChange={(e) => setForm({ ...form, priceType: e.target.value as PriceType })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="إيجار">{t('projects.modal.contractRent')}</option>
                <option value="بيع">{t('projects.modal.contractSale')}</option>
                <option value="استثمار">{t('projects.modal.contractInvest')}</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('projects.modal.city')}</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>{t('projects.modal.area')}</label>
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
              <label className={labelClass}>{t('projects.modal.floorsCount', { max: MAX_FLOORS })}</label>
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
              <label className={labelClass}>{t('projects.modal.unitsPerFloor', { max: MAX_UNITS_PER_FLOOR })}</label>
              <input
                type="number"
                min={0}
                max={MAX_UNITS_PER_FLOOR}
                value={form.unitsPerFloor}
                onChange={(e) => setForm({ ...form, unitsPerFloor: Number(e.target.value) })}
                onBlur={() =>
                  setForm((f) => ({ ...f, unitsPerFloor: clamp(f.unitsPerFloor, 0, MAX_UNITS_PER_FLOOR) }))
                }
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('projects.modal.description')}</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t('projects.modal.descriptionPlaceholder')}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('projects.modal.projectImage')}</label>
              {form.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-muted-border/50">
                  <img src={form.imageUrl} alt={t('projects.modal.imageAria')} className="w-full h-28 object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, imageUrl: '' }))}
                    className="absolute top-1.5 start-1.5 p-1 rounded-lg bg-black/60 text-white hover:bg-black/80 transition cursor-pointer"
                    title={t('projects.modal.removeImage')}
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
                    {uploadingField === 'image' ? t('projects.modal.uploading') : t('projects.modal.uploadImageText')}
                  </span>
                </button>
              )}
            </div>

            <div>
              <label className={labelClass}>{t('projects.modal.brochure')}</label>
              {form.brochureUrl ? (
                <div className="h-28 rounded-xl border border-muted-border/50 bg-canvas flex items-center gap-2 p-3">
                  <FileText className="w-5 h-5 text-accent shrink-0" />
                  <a
                    href={form.brochureUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-bold text-heading hover:text-accent truncate min-w-0"
                  >
                    {t('projects.modal.viewBrochure')}
                  </a>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, brochureUrl: '' }))}
                    className="ms-auto p-1 rounded-lg text-neutral-text/60 hover:text-red-500 transition cursor-pointer shrink-0"
                    title={t('projects.modal.removeFile')}
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
                    {uploadingField === 'brochure' ? t('projects.modal.uploading') : t('projects.modal.uploadBrochureText')}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>{t('projects.modal.model3d')}</label>
            <input
              type="url"
              dir="ltr"
              inputMode="url"
              value={form.model3dUrl}
              onChange={(e) => {
                setForm({ ...form, model3dUrl: e.target.value });
                if (model3dError) setModel3dError('');
              }}
              placeholder="https://viewer.example.com/model/123"
              className={inputClass}
            />
            {model3dError && <p className="mt-1 text-[10px] font-bold text-red-500">{model3dError}</p>}
            <p className="mt-1 text-[10px] text-neutral-text/50">
              {t('projects.modal.model3dHint')}
            </p>
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
              {t('projects.modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="brand-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {creating ? t('projects.modal.creatingBtn') : t('projects.modal.createBtn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
