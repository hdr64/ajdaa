import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Tags,
  Trash2,
  X as CloseIcon,
  RefreshCw,
  LayoutGrid,
  Rows3,
  Table2,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryItem } from '../../../types/admin';
import type { PropertyType } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { usePersistentState } from '../../../hooks/usePersistentState';
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

/* ------------------------------ View layouts ------------------------------ */

type CategoryLayout = 'grid' | 'list' | 'compact';

const isCategoryLayout = (value: unknown): value is CategoryLayout =>
  value === 'grid' || value === 'list' || value === 'compact';

const LAYOUT_OPTIONS: { value: CategoryLayout; label: string; icon: LucideIcon }[] = [
  { value: 'grid', label: 'شبكة', icon: LayoutGrid },
  { value: 'list', label: 'قائمة', icon: Rows3 },
  { value: 'compact', label: 'جدول', icon: Table2 },
];

type CategoryColumns = 1 | 2 | 3 | 4;

const isCategoryColumns = (value: unknown): value is CategoryColumns =>
  value === 1 || value === 2 || value === 3 || value === 4;

const COLUMN_OPTIONS: CategoryColumns[] = [1, 2, 3, 4];

/**
 * Tailwind only sees class names that appear literally in the source, so the
 * column count is mapped through a static table instead of interpolation.
 * Columns kick in at `lg`; phones keep one column and `md` keeps two.
 */
const GRID_COLUMN_CLASSES: Record<CategoryColumns, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

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

/* ---------------------------- Shared fragments ---------------------------- */

interface CategoryHandlers {
  edit: (category: CategoryItem) => void;
  remove: (category: CategoryItem) => void;
  addTag: (category: CategoryItem) => void;
  removeTag: (category: CategoryItem, tag: string) => void;
  setDraft: (categoryId: string, draft: string) => void;
}

const TypeBadge: React.FC<{ type: PropertyType }> = ({ type }) => (
  <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px]">{TYPE_LABEL[type] ?? type}</span>
);

/** Edit / delete controls. Stop propagation so they never trigger a row click. */
const CategoryActions: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({ onEdit, onDelete }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      className="p-1.5 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-accent/10 cursor-pointer"
      title="تعديل التصنيف"
      aria-label="تعديل التصنيف"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="p-1.5 rounded-lg text-neutral-text/60 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
      title="حذف التصنيف"
      aria-label="حذف التصنيف"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

const CategoryTags: React.FC<{ tags: string[]; canManage: boolean; onRemove: (tag: string) => void }> = ({ tags, canManage, onRemove }) => {
  if (tags.length === 0) return <p className="text-[11px] text-neutral-text/45">لا توجد وسوم.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-bold ps-2.5 pe-1.5 py-1 rounded-lg bg-canvas border border-muted-border/40 text-heading">
          #{tag}
          {canManage && (
            <button
              onClick={() => onRemove(tag)}
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
  );
};

const CategoryTagForm: React.FC<{ draft: string; onDraftChange: (value: string) => void; onSubmit: () => void; className?: string }> = ({
  draft,
  onDraftChange,
  onSubmit,
  className = '',
}) => (
  <form
    className={`flex items-center gap-2 ${className}`}
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
  >
    <input
      type="text"
      placeholder="وسم جديد..."
      value={draft}
      onChange={(e) => onDraftChange(e.target.value)}
      className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-canvas border border-muted-border/40 text-[11px] text-heading outline-none focus:border-accent"
    />
    <button type="submit" className="brand-btn-primary px-3.5 py-2 rounded-xl font-bold text-[11px] cursor-pointer shrink-0">
      + إضافة
    </button>
  </form>
);

/* -------------------------------- Layouts -------------------------------- */

const CategoriesGrid: React.FC<{
  categories: CategoryItem[];
  columns: CategoryColumns;
  canManage: boolean;
  drafts: Record<string, string>;
  handlers: CategoryHandlers;
}> = ({ categories, columns, canManage, drafts, handlers }) => (
  <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 ${GRID_COLUMN_CLASSES[columns]}`}>
    {categories.map((cat) => (
      <div key={cat.id} className="p-5 sm:p-6 rounded-3xl bg-surface border border-muted-border/40 shadow-xs flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h4 className="text-sm font-black text-heading truncate">{cat.nameAr}</h4>
            <span className="text-[10px] text-accent font-bold" dir="ltr">
              {cat.nameEn}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <TypeBadge type={cat.type} />
            {canManage && <CategoryActions onEdit={() => handlers.edit(cat)} onDelete={() => handlers.remove(cat)} />}
          </div>
        </div>

        <div className="border-t border-muted-border/30 pt-3 flex-1">
          <span className="text-[11px] font-bold text-neutral-text/60 block mb-2">الوسوم ({cat.tags.length})</span>
          <CategoryTags tags={cat.tags} canManage={canManage} onRemove={(tag) => handlers.removeTag(cat, tag)} />
        </div>

        {canManage && (
          <CategoryTagForm
            className="pt-4 mt-4 border-t border-muted-border/20"
            draft={drafts[cat.id] ?? ''}
            onDraftChange={(value) => handlers.setDraft(cat.id, value)}
            onSubmit={() => handlers.addTag(cat)}
          />
        )}
      </div>
    ))}
  </div>
);

const CategoriesList: React.FC<{
  categories: CategoryItem[];
  canManage: boolean;
  drafts: Record<string, string>;
  handlers: CategoryHandlers;
}> = ({ categories, canManage, drafts, handlers }) => (
  <div className="flex flex-col gap-3">
    {categories.map((cat) => (
      <div
        key={cat.id}
        className="p-4 sm:p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs flex flex-col xl:flex-row xl:items-center gap-3"
      >
        <div className="flex items-start xl:items-center gap-2.5 xl:w-64 shrink-0 min-w-0">
          <div className="min-w-0">
            <h4 className="text-sm font-black text-heading truncate">{cat.nameAr}</h4>
            <span className="text-[10px] text-accent font-bold" dir="ltr">
              {cat.nameEn}
            </span>
          </div>
          <TypeBadge type={cat.type} />
        </div>

        <div className="flex-1 min-w-0">
          <CategoryTags tags={cat.tags} canManage={canManage} onRemove={(tag) => handlers.removeTag(cat, tag)} />
        </div>

        {canManage && (
          <div className="flex items-center gap-2 xl:shrink-0">
            <CategoryActions onEdit={() => handlers.edit(cat)} onDelete={() => handlers.remove(cat)} />
            <CategoryTagForm
              className="flex-1 xl:w-52 xl:flex-none"
              draft={drafts[cat.id] ?? ''}
              onDraftChange={(value) => handlers.setDraft(cat.id, value)}
              onSubmit={() => handlers.addTag(cat)}
            />
          </div>
        )}
      </div>
    ))}
  </div>
);

const COMPACT_TAG_PREVIEW = 4;

const CategoriesTable: React.FC<{
  categories: CategoryItem[];
  canManage: boolean;
  handlers: CategoryHandlers;
}> = ({ categories, canManage, handlers }) => (
  <div className="rounded-2xl border border-muted-border/40 bg-surface overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <caption className="sr-only">التصنيفات</caption>
        <thead className="bg-canvas/60">
          <tr className="text-[11px] text-neutral-text/55">
            <th scope="col" className="px-3 py-2.5 text-start font-bold">
              الاسم بالعربية
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-bold">
              الاسم بالإنجليزية
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-bold">
              النوع
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-bold">
              الوسوم
            </th>
            <th scope="col" className="px-3 py-2.5 text-start font-bold tabular-nums">
              العدد
            </th>
            {canManage && (
              <th scope="col" className="px-3 py-2.5 text-end font-bold">
                إجراءات
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-muted-border/15">
          {categories.map((cat) => {
            const preview = cat.tags.slice(0, COMPACT_TAG_PREVIEW);
            const hidden = cat.tags.length - preview.length;
            return (
              <tr
                key={cat.id}
                onClick={canManage ? () => handlers.edit(cat) : undefined}
                className={canManage ? 'cursor-pointer hover:bg-canvas/60 transition-colors' : undefined}
              >
                <td className="px-3 py-2 text-start">
                  {canManage ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlers.edit(cat);
                      }}
                      className="font-bold text-heading hover:text-accent cursor-pointer"
                    >
                      {cat.nameAr}
                    </button>
                  ) : (
                    <span className="font-bold text-heading">{cat.nameAr}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-start text-accent font-bold" dir="ltr">
                  {cat.nameEn}
                </td>
                <td className="px-3 py-2 text-start">
                  <TypeBadge type={cat.type} />
                </td>
                <td className="px-3 py-2 text-start">
                  {cat.tags.length === 0 ? (
                    <span className="text-neutral-text/45">—</span>
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      {preview.map((tag) => (
                        <span key={tag} className="text-[10px] font-bold ps-2 pe-1.5 py-0.5 rounded-md bg-canvas border border-muted-border/40 text-heading">
                          #{tag}
                        </span>
                      ))}
                      {hidden > 0 && <span className="text-[10px] font-bold text-neutral-text/55">+{hidden}</span>}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-start tabular-nums text-neutral-text/80">{cat.tags.length}</td>
                {canManage && (
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end">
                      <CategoryActions onEdit={() => handlers.edit(cat)} onDelete={() => handlers.remove(cat)} />
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

/* ------------------------------- Switchers ------------------------------- */

const LayoutSwitcher: React.FC<{ value: CategoryLayout; onChange: (layout: CategoryLayout) => void }> = ({ value, onChange }) => (
  <div className="inline-flex rounded-xl border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label="طريقة عرض التصنيفات">
    {LAYOUT_OPTIONS.map(({ value: option, label, icon: Icon }) => (
      <button
        key={option}
        type="button"
        onClick={() => onChange(option)}
        aria-pressed={value === option}
        aria-label={label}
        title={label}
        className={`p-1.5 rounded-lg cursor-pointer transition ${
          value === option ? 'bg-surface text-accent shadow-xs' : 'text-neutral-text/55 hover:text-heading'
        }`}
      >
        <Icon className="w-4 h-4" />
      </button>
    ))}
  </div>
);

const ColumnSwitcher: React.FC<{ value: CategoryColumns; onChange: (columns: CategoryColumns) => void }> = ({ value, onChange }) => (
  <div className="hidden lg:flex items-center gap-2">
    <span className="text-[11px] font-bold text-neutral-text/60">الأعمدة</span>
    <div className="inline-flex rounded-xl border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label="الأعمدة">
      {COLUMN_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          aria-label={`${option} أعمدة`}
          className={`w-8 py-1.5 rounded-lg text-[11px] font-bold tabular-nums cursor-pointer transition ${
            value === option ? 'brand-fill text-canvas shadow-xs' : 'text-neutral-text/55 hover:text-heading'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  </div>
);

export const CategoriesSection: React.FC = () => {
  const { can, showToast, confirm } = useAdmin();
  const canManage = can('manageProjects');
  const [layout, setLayout] = usePersistentState<CategoryLayout>('ajda.admin.categories.layout', 'grid', isCategoryLayout);
  const [columns, setColumns] = usePersistentState<CategoryColumns>('ajda.admin.categories.columns', 3, isCategoryColumns);
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

  const handlers: CategoryHandlers = {
    edit: (category) => setDialog({ category }),
    remove: (category) => void deleteCategory(category),
    addTag: (category) => void addTag(category),
    removeTag: (category, tag) => void saveTags(category, category.tags.filter((t) => t !== tag)),
    setDraft: (categoryId, draft) => setTagDrafts((d) => ({ ...d, [categoryId]: draft })),
  };

  const header = (
    <AdminHeaderActions>
      <LayoutSwitcher value={layout} onChange={setLayout} />
      {canManage && (
        <button
          onClick={() => setDialog({ category: null })}
          className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">تصنيف جديد</span>
        </button>
      )}
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
        <>
          {layout === 'grid' && <ColumnSwitcher value={columns} onChange={setColumns} />}
          {layout === 'grid' && <CategoriesGrid categories={categories.data} columns={columns} canManage={canManage} drafts={tagDrafts} handlers={handlers} />}
          {layout === 'list' && <CategoriesList categories={categories.data} canManage={canManage} drafts={tagDrafts} handlers={handlers} />}
          {layout === 'compact' && <CategoriesTable categories={categories.data} canManage={canManage} handlers={handlers} />}
        </>
      )}
      {dialogNode}
    </div>
  );
};
