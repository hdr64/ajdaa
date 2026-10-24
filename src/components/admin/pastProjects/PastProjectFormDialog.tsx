import React, { useEffect, useState } from 'react';
import { X, Upload, Trash2, FileText, ImageIcon, Loader2 } from 'lucide-react';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { ApiError } from '../../../services/api';
import { uploadMedia } from '../../../services/mediaService';
import type { PastProject, PastProjectInput } from '../../../services/adminStorage';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface Props {
  initial: PastProject | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="mt-1 text-[11px] text-red-500">{errors[0]}</p>;
}

export const PastProjectFormDialog: React.FC<Props> = ({ initial, onClose, onSaved }) => {
  const { showToast, confirm } = useAdmin();
  const { t } = useAdminT();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [titleEn, setTitleEn] = useState(initial?.titleEn ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [categoryEn, setCategoryEn] = useState(initial?.categoryEn ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn ?? '');
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [published, setPublished] = useState(initial?.published ?? true);
  const [image, setImage] = useState<string | null>(initial?.image ?? null);
  const [gallery, setGallery] = useState<string[]>(initial?.gallery ?? []);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initial?.pdfUrl ?? null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [dirty, setDirty] = useState(false);

  const markDirty = () => setDirty(true);

  const requestClose = async () => {
    if (dirty) {
      const ok = await confirm({
        title: t('pastProjects.form.dirtyConfirmTitle'),
        message: t('pastProjects.form.dirtyConfirmMessage'),
        confirmLabel: t('pastProjects.form.dirtyConfirmLabel'),
        danger: true,
      });
      if (!ok) return;
    }
    onClose();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const res = await uploadMedia(file);
      setImage(res.url);
      markDirty();
    } catch (err) {
      showToast(getErrorMessage(err, t('pastProjects.form.uploadImageError')), 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleGalleryUpload = async (files: FileList) => {
    setUploadingGallery(true);
    try {
      for (const file of Array.from(files)) {
        const res = await uploadMedia(file);
        setGallery((prev) => [...prev, res.url]);
      }
      markDirty();
    } catch (err) {
      showToast(getErrorMessage(err, t('pastProjects.form.uploadImageError')), 'error');
    } finally {
      setUploadingGallery(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    setUploadingPdf(true);
    try {
      const res = await uploadMedia(file);
      setPdfUrl(res.url);
      setPdfName(file.name);
      markDirty();
    } catch (err) {
      showToast(getErrorMessage(err, t('pastProjects.form.uploadFileError')), 'error');
    } finally {
      setUploadingPdf(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setFieldErrors({});

    // Client-side required checks.
    const errors: Record<string, string[]> = {};
    if (!title.trim()) errors.title = [t('pastProjects.form.validation.titleRequired')];
    if (!image) errors.image = [t('pastProjects.form.validation.imageRequired')];
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const payload: PastProjectInput = {
      title: title.trim(),
      titleEn: titleEn.trim() || null,
      category: category.trim() || null,
      categoryEn: categoryEn.trim() || null,
      image: image ?? '',
      gallery,
      pdfUrl,
      description: description.trim() || null,
      descriptionEn: descriptionEn.trim() || null,
      sortOrder: Number(sortOrder) || 0,
      published,
    };
    setSaving(true);
    try {
      if (initial) {
        await AdminStorage.updatePastProject(initial.id, payload);
        showToast(t('pastProjects.form.successUpdate'));
      } else {
        await AdminStorage.createPastProject(payload);
        showToast(t('pastProjects.form.successCreate'));
      }
      await onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const mapped: Record<string, string[]> = {};
        for (const field of Object.keys(err.fieldErrors ?? {})) {
          mapped[field] = [t('pastProjects.form.error.invalid')];
        }
        setFieldErrors(mapped);
      }
      showToast(getErrorMessage(err, t('pastProjects.form.saveError')), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) void requestClose();
      }}
    >
      <form
        onSubmit={submit}
        noValidate
        onChange={markDirty}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-heading">{initial ? t('pastProjects.form.editTitle') : t('pastProjects.form.newTitle')}</h3>
          <button type="button" onClick={() => void requestClose()} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer" aria-label={t('pastProjects.form.closeAria')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.titleArLabel')}</span>
            <input value={title} onChange={(e) => { setTitle(e.target.value); markDirty(); }} className={inputClass} />
            <FieldError errors={fieldErrors.title} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.titleEnLabel')}</span>
            <input dir="ltr" value={titleEn} onChange={(e) => { setTitleEn(e.target.value); markDirty(); }} className={inputClass} />
            <FieldError errors={fieldErrors.titleEn} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.categoryArLabel')}</span>
            <input value={category} onChange={(e) => { setCategory(e.target.value); markDirty(); }} className={inputClass} />
            <FieldError errors={fieldErrors.category} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.categoryEnLabel')}</span>
            <input dir="ltr" value={categoryEn} onChange={(e) => { setCategoryEn(e.target.value); markDirty(); }} className={inputClass} />
            <FieldError errors={fieldErrors.categoryEn} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.descriptionArLabel')}</span>
            <textarea rows={4} value={description} onChange={(e) => { setDescription(e.target.value); markDirty(); }} className={`${inputClass} resize-none`} />
            <FieldError errors={fieldErrors.description} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.descriptionEnLabel')}</span>
            <textarea rows={4} dir="ltr" value={descriptionEn} onChange={(e) => { setDescriptionEn(e.target.value); markDirty(); }} className={`${inputClass} resize-none`} />
            <FieldError errors={fieldErrors.descriptionEn} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('pastProjects.form.sortOrderLabel')}</span>
            <input type="number" value={sortOrder} onChange={(e) => { setSortOrder(e.target.value); markDirty(); }} className={inputClass} />
            <FieldError errors={fieldErrors.sortOrder} />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={published} onChange={(e) => { setPublished(e.target.checked); markDirty(); }} />
            <span className="text-xs font-bold text-heading">{t('pastProjects.form.publishedLabel')}</span>
          </label>
        </div>

        {/* Main image */}
        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-neutral-text/70">{t('pastProjects.form.mainImageLabel')}</span>
          {image && (
            <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-muted-border/40">
              <img src={image} alt="main" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setImage(null); markDirty(); }}
                className="absolute top-1 end-1 p-1 rounded-lg bg-black/60 text-white hover:bg-red-500 cursor-pointer"
                aria-label={t('pastProjects.form.removeImageAria')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer hover:border-accent">
            {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {image ? t('pastProjects.form.replaceImage') : t('pastProjects.form.uploadImage')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImageUpload(f);
                e.target.value = '';
              }}
            />
          </label>
          <FieldError errors={fieldErrors.image} />
        </div>

        {/* Gallery */}
        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-neutral-text/70">{t('pastProjects.form.galleryLabel')}</span>
          <div className="flex flex-wrap gap-2">
            {gallery.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative w-24 h-20 rounded-xl overflow-hidden border border-muted-border/40">
                <img src={url} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setGallery((prev) => prev.filter((_, i) => i !== idx)); markDirty(); }}
                  className="absolute top-1 end-1 p-1 rounded-lg bg-black/60 text-white hover:bg-red-500 cursor-pointer"
                  aria-label={t('pastProjects.form.removeAria')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer hover:border-accent">
            {uploadingGallery ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {t('pastProjects.form.addImages')}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length) void handleGalleryUpload(files);
                e.target.value = '';
              }}
            />
          </label>
          <FieldError errors={fieldErrors.gallery} />
        </div>

        {/* PDF */}
        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-neutral-text/70">{t('pastProjects.form.pdfLabel')}</span>
          {pdfUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas border border-muted-border/40">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-heading truncate">{pdfName ?? t('pastProjects.form.pdfFallback')}</span>
              <button
                type="button"
                onClick={() => { setPdfUrl(null); setPdfName(null); markDirty(); }}
                className="ms-auto p-1 rounded-lg text-neutral-text/60 hover:text-red-500 cursor-pointer"
                aria-label={t('pastProjects.form.removeFileAria')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer hover:border-accent">
            {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {pdfUrl ? t('pastProjects.form.replaceFile') : t('pastProjects.form.uploadPdf')}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePdfUpload(f);
                e.target.value = '';
              }}
            />
          </label>
          <FieldError errors={fieldErrors.pdfUrl} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-muted-border/30">
          <button type="button" onClick={() => void requestClose()} className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            {t('pastProjects.form.cancel')}
          </button>
          <button type="submit" disabled={saving} className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {initial ? t('pastProjects.form.save') : t('pastProjects.form.create')}
          </button>
        </div>
      </form>
    </div>
  );
};