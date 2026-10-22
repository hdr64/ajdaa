import React, { useEffect, useState } from 'react';
import { X, Upload, Trash2, FileText, ImageIcon, Loader2 } from 'lucide-react';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { ApiError } from '../../../services/api';
import { uploadMedia } from '../../../services/mediaService';
import type { PastProject, PastProjectInput } from '../../../services/adminStorage';

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const res = await uploadMedia(file);
      setImage(res.url);
    } catch (err) {
      alert(getErrorMessage(err, 'تعذر رفع الصورة'));
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
    } catch (err) {
      alert(getErrorMessage(err, 'تعذر رفع الصورة'));
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
    } catch (err) {
      alert(getErrorMessage(err, 'تعذر رفع الملف'));
    } finally {
      setUploadingPdf(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
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
      if (initial) await AdminStorage.updatePastProject(initial.id, payload);
      else await AdminStorage.createPastProject(payload);
      await onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
      } else {
        alert(getErrorMessage(err, 'تعذر حفظ المشروع'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-heading">{initial ? 'تعديل مشروع سابق' : 'مشروع سابق جديد'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">العنوان بالعربية *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
            <FieldError errors={fieldErrors.title} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">العنوان بالإنجليزية</span>
            <input dir="ltr" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className={inputClass} />
            <FieldError errors={fieldErrors.titleEn} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">التصنيف بالعربية</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} />
            <FieldError errors={fieldErrors.category} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">التصنيف بالإنجليزية</span>
            <input dir="ltr" value={categoryEn} onChange={(e) => setCategoryEn(e.target.value)} className={inputClass} />
            <FieldError errors={fieldErrors.categoryEn} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">الوصف بالعربية</span>
            <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-none`} />
            <FieldError errors={fieldErrors.description} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">الوصف بالإنجليزية</span>
            <textarea rows={4} dir="ltr" value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className={`${inputClass} resize-none`} />
            <FieldError errors={fieldErrors.descriptionEn} />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">ترتيب العرض (sortOrder)</span>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className={inputClass} />
            <FieldError errors={fieldErrors.sortOrder} />
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            <span className="text-xs font-bold text-heading">منشور (يظهر في الموقع)</span>
          </label>
        </div>

        {/* Main image */}
        <div className="space-y-2">
          <span className="block text-[11px] font-bold text-neutral-text/70">الصورة الرئيسية *</span>
          {image && (
            <div className="relative w-40 h-28 rounded-xl overflow-hidden border border-muted-border/40">
              <img src={image} alt="main" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImage(null)}
                className="absolute top-1 end-1 p-1 rounded-lg bg-black/60 text-white hover:bg-red-500 cursor-pointer"
                aria-label="إزالة الصورة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer hover:border-accent">
            {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            {image ? 'استبدال الصورة' : 'رفع صورة'}
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
          <span className="block text-[11px] font-bold text-neutral-text/70">معرض الصور</span>
          <div className="flex flex-wrap gap-2">
            {gallery.map((url, idx) => (
              <div key={`${url}-${idx}`} className="relative w-24 h-20 rounded-xl overflow-hidden border border-muted-border/40">
                <img src={url} alt={`gallery-${idx}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setGallery((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute top-1 end-1 p-1 rounded-lg bg-black/60 text-white hover:bg-red-500 cursor-pointer"
                  aria-label="إزالة"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer hover:border-accent">
            {uploadingGallery ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            إضافة صور
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
          <span className="block text-[11px] font-bold text-neutral-text/70">ملف المشروع (PDF)</span>
          {pdfUrl && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-canvas border border-muted-border/40">
              <FileText className="w-4 h-4 text-accent" />
              <span className="text-xs font-bold text-heading truncate">{pdfName ?? 'ملف PDF'}</span>
              <button
                type="button"
                onClick={() => {
                  setPdfUrl(null);
                  setPdfName(null);
                }}
                className="ms-auto p-1 rounded-lg text-neutral-text/60 hover:text-red-500 cursor-pointer"
                aria-label="إزالة الملف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer hover:border-accent">
            {uploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {pdfUrl ? 'استبدال الملف' : 'رفع ملف PDF'}
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
          <button type="button" onClick={onClose} className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {initial ? 'حفظ التعديلات' : 'إنشاء'}
          </button>
        </div>
      </form>
    </div>
  );
};