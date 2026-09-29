import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Tags, Trash2, X as CloseIcon, RefreshCw } from 'lucide-react';
import type { CategoryItem } from '../../../types/admin';
import type { PropertyType } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';

const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'commercial', label: 'تجاري' },
  { value: 'office', label: 'إداري ومكتبي' },
  { value: 'logistics', label: 'لوجستي' },
  { value: 'residential', label: 'سكني' },
  { value: 'hotel', label: 'فندقي' },
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>;

interface CategoryFormState {
  nameAr: string;
  nameEn: string;
  type: PropertyType;
  tags: string;
}

const CategoryDialog: React.FC<{
  initial: CategoryItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}> = ({ initial, onClose, onSaved }) => {
  const { showToast } = useAdmin();
  const [form, setForm] = useState<CategoryFormState>({
    nameAr: initial?.nameAr ?? '',
    nameEn: initial?.nameEn ?? '',
    type: initial?.type ?? 'commercial',
    tags: initial?.tags.join('، ') ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      nameAr: form.nameAr.trim(),
      nameEn: form.nameEn.trim(),
      type: form.type,
      // Accept both Arabic and Latin commas, and new lines.
      tags: [...new Set(form.tags.split(/[،,\n]/).map((t) => t.trim()).filter(Boolean))],
    };
    if (!payload.nameAr || !payload.nameEn) return;

    setSaving(true);
    try {
      if (initial) await AdminStorage.updateCategory(initial.id, payload);
      else await AdminStorage.createCategory(payload);
      showToast(initial ? 'تم تحديث التصنيف' : 'تم إنشاء التصنيف');
      await onSaved();
      onClose();
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حفظ التصنيف'));
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

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
        className="w-full max-w-md bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-heading">{initial ? 'تعديل التصنيف' : 'تصنيف جديد'}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer" aria-label="إغلاق">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">الاسم بالعربية *</span>
            <input required autoFocus value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">الاسم بالإنجليزية *</span>
            <input required dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">نوع المشاريع</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PropertyType })} className={`${inputClass} cursor-pointer`}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">الوسوم (افصل بينها بفاصلة)</span>
          <textarea rows={3} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={`${inputClass} resize-none`} />
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-muted-border/30">
          <button type="button" onClick={onClose} className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            إلغاء
          </button>
          <button type="submit" disabled={saving} className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {initial ? 'حفظ التعديلات' : 'إنشاء التصنيف'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const CategoriesSection: React.FC = () => {
  const { can, showToast, confirm } = useAdmin();
  const canManage = can('manageProjects');
  const categories = useAsyncData<CategoryItem[]>(
    useCallback((signal) => AdminStorage.listCategories(signal), []),
    [],
    []
  );
  const [dialog, setDialog] = useState<{ category: CategoryItem | null } | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});

  const saveTags = async (category: CategoryItem, tags: string[]) => {
    const previous = categories.data;
    categories.setData((current) => current.map((c) => (c.id === category.id ? { ...c, tags } : c)));
    try {
      await AdminStorage.updateCategory(category.id, {
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        type: category.type,
        tags,
      });
      return true;
    } catch (error) {
      categories.setData(previous);
      showToast(getErrorMessage(error, 'تعذر تحديث الوسوم'));
      return false;
    }
  };

  const addTag = async (category: CategoryItem) => {
    const tag = (tagDrafts[category.id] ?? '').trim();
    if (!tag) return;
    if (category.tags.includes(tag)) {
      showToast('الوسم موجود مسبقاً');
      return;
    }
    if (await saveTags(category, [...category.tags, tag])) {
      setTagDrafts((d) => ({ ...d, [category.id]: '' }));
    }
  };

  const deleteCategory = async (category: CategoryItem) => {
    const ok = await confirm({
      title: `حذف التصنيف "${category.nameAr}"؟`,
      message: 'لن يؤثر ذلك على المشاريع نفسها.',
      confirmLabel: 'حذف التصنيف',
      danger: true,
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteCategory(category.id);
      await categories.reload();
      showToast('تم حذف التصنيف');
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حذف التصنيف'));
    }
  };

  const header = canManage && (
    <AdminHeaderActions>
      <button
        onClick={() => setDialog({ category: null })}
        className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">تصنيف جديد</span>
      </button>
    </AdminHeaderActions>
  );

  const dialogNode = dialog && (
    <CategoryDialog initial={dialog.category} onClose={() => setDialog(null)} onSaved={categories.reload} />
  );

  if (categories.error) {
    return (
      <>
        {header}
        <SectionError message={categories.error} onRetry={() => void categories.reload()} />
      </>
    );
  }
  if (categories.loading && categories.data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label="جاري تحميل التصنيفات..." />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {categories.data.length === 0 ? (
        <EmptyState icon={Tags} title="لا توجد تصنيفات" description="أنشئ أول تصنيف من زر «تصنيف جديد» في الأعلى." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
          {categories.data.map((cat) => (
            <div key={cat.id} className="p-5 sm:p-6 rounded-3xl bg-surface border border-muted-border/40 shadow-xs flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-heading truncate">{cat.nameAr}</h4>
                  <span className="text-[10px] text-accent font-bold" dir="ltr">
                    {cat.nameEn}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
                    {TYPE_LABEL[cat.type] ?? cat.type}
                  </span>
                  {canManage && (
                    <>
                      <button onClick={() => setDialog({ category: cat })} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-accent/10 cursor-pointer" title="تعديل التصنيف" aria-label="تعديل التصنيف">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => void deleteCategory(cat)} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-red-500 hover:bg-red-500/10 cursor-pointer" title="حذف التصنيف" aria-label="حذف التصنيف">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-muted-border/30 pt-3 flex-1">
                <span className="text-[11px] font-bold text-neutral-text/60 block mb-2">الوسوم ({cat.tags.length})</span>
                {cat.tags.length === 0 ? (
                  <p className="text-[11px] text-neutral-text/45">لا توجد وسوم.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {cat.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-bold ps-2.5 pe-1.5 py-1 rounded-lg bg-canvas border border-muted-border/40 text-heading">
                        #{tag}
                        {canManage && (
                          <button
                            onClick={() => void saveTags(cat, cat.tags.filter((t) => t !== tag))}
                            className="p-0.5 rounded text-neutral-text/50 hover:text-red-500 cursor-pointer"
                            aria-label={`إزالة الوسم ${tag}`}
                            title="إزالة الوسم"
                          >
                            <CloseIcon className="w-3 h-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {canManage && (
                <form
                  className="flex items-center gap-2 pt-4 mt-4 border-t border-muted-border/20"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void addTag(cat);
                  }}
                >
                  <input
                    type="text"
                    placeholder="وسم جديد..."
                    value={tagDrafts[cat.id] ?? ''}
                    onChange={(e) => setTagDrafts((d) => ({ ...d, [cat.id]: e.target.value }))}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-canvas border border-muted-border/40 text-[11px] text-heading outline-none focus:border-accent"
                  />
                  <button type="submit" className="brand-btn-primary px-3.5 py-2 rounded-xl font-bold text-[11px] cursor-pointer shrink-0">
                    + إضافة
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
      {dialogNode}
    </div>
  );
};
