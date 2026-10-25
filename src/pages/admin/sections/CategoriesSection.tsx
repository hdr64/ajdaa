// Registers every admin string area first: module-scope translateAdmin calls below need them.
import '../../../i18n/admin';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Pencil,
  Tags,
  Trash2,
  X as CloseIcon,
  RefreshCw,
} from 'lucide-react';
import type { CategoryItem } from '../../../types/admin';
import type { PropertyType } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { DataTable } from '../../../components/admin/common/DataTable';
import { ViewSwitcher } from '../../../components/admin/common/ViewSwitcher';
import type { Column } from '../../../components/admin/common/dataTableTypes';
import {
  GRID_COLUMN_OPTIONS,
  type GridColumns,
  gridColumnsClass,
  isGridColumns,
  isViewMode,
  type ViewMode,
} from '../../../components/admin/common/viewModes';

import { translateAdmin } from '../../../i18n/admin/core';
import { PROJECT_TYPE_KEYS } from '../projectLabels';
const TYPE_OPTIONS: { value: PropertyType; label: string }[] = [
  { value: 'commercial', label: translateAdmin('ar', PROJECT_TYPE_KEYS.commercial) },
  { value: 'office', label: translateAdmin('ar', PROJECT_TYPE_KEYS.office) },
  { value: 'logistics', label: translateAdmin('ar', PROJECT_TYPE_KEYS.logistics) },
  { value: 'residential', label: translateAdmin('ar', PROJECT_TYPE_KEYS.residential) },
  { value: 'hotel', label: translateAdmin('ar', PROJECT_TYPE_KEYS.hotel) },
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label])) as Record<string, string>;

/* ------------------------------ View persistence & migration ------------------------------ */

const CATEGORIES_VIEW_STORAGE_KEY = 'ajda.admin.categories.layout';

// Migrate legacy stored preference: if it holds 'compact', treat as 'list'
function migrateCategoryViewPreference(): void {
  try {
    const raw = window.localStorage.getItem(CATEGORIES_VIEW_STORAGE_KEY);
    if (raw !== null && JSON.parse(raw) === 'compact') {
      window.localStorage.setItem(CATEGORIES_VIEW_STORAGE_KEY, JSON.stringify('list'));
    }
  } catch {
    // Preference read/write may fail in restricted browser environments
  }
}
migrateCategoryViewPreference();

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
  const { t } = useAdminT();
  const [form, setForm] = useState<CategoryFormState>({
    nameAr: initial?.nameAr ?? '',
    nameEn: initial?.nameEn ?? '',
    type: initial?.type ?? 'commercial',
    tags: initial?.tags.join(', ') ?? '',
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
      tags: [...new Set(form.tags.split(/[,\n]/).map((t) => t.trim()).filter(Boolean))],
    };
    if (!payload.nameAr || !payload.nameEn) return;

    setSaving(true);
    try {
      if (initial) await AdminStorage.updateCategory(initial.id, payload);
      else await AdminStorage.createCategory(payload);
      showToast(initial ? t('categories.dialog.updated') : t('categories.dialog.created'));
      await onSaved();
      onClose();
    } catch (error) {
      showToast(getErrorMessage(error, t('categories.dialog.saveError')));
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
          <h3 className="text-base font-black text-heading">{initial ? t('categories.dialog.editTitle') : t('categories.dialog.newTitle')}</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer" aria-label={t('categories.dialog.closeAria')}>
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('categories.dialog.nameArLabel')}</span>
            <input required autoFocus value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('categories.dialog.nameEnLabel')}</span>
            <input required dir="ltr" value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('categories.dialog.typeLabel')}</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PropertyType })} className={`${inputClass} cursor-pointer`}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">{t('categories.dialog.tagsLabel')}</span>
          <textarea rows={3} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className={`${inputClass} resize-none`} />
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-muted-border/30">
          <button type="button" onClick={onClose} className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            {t('categories.dialog.cancel')}
          </button>
          <button type="submit" disabled={saving} className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {initial ? t('categories.dialog.save') : t('categories.dialog.create')}
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

const TypeBadge: React.FC<{ type: PropertyType }> = ({ type }) => {
  const { t } = useAdminT();
  return (
    <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px]">{t(PROJECT_TYPE_KEYS[type])}</span>
  );
};

/** Edit / delete controls. Stop propagation so they never trigger a row click. */
const CategoryActions: React.FC<{ onEdit: () => void; onDelete: () => void }> = ({ onEdit, onDelete }) => {
  const { t } = useAdminT();
  return (
  <div className="flex items-center gap-1.5 shrink-0">
    <button
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      className="p-1.5 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-accent/10 cursor-pointer"
      title={t('categories.action.edit')}
      aria-label={t('categories.action.edit')}
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
    <button
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
      className="p-1.5 rounded-lg text-neutral-text/60 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
      title={t('categories.action.delete')}
      aria-label={t('categories.action.delete')}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
  );
};

const CategoryTags: React.FC<{ tags: string[]; canManage: boolean; onRemove: (tag: string) => void }> = ({ tags, canManage, onRemove }) => {
  const { t } = useAdminT();
  if (tags.length === 0) return <p className="text-[11px] text-neutral-text/45">{t('categories.tags.none')}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 text-[10px] font-bold ps-2.5 pe-1.5 py-1 rounded-lg bg-canvas border border-muted-border/40 text-heading">
          #{tag}
          {canManage && (
            <button
              onClick={() => onRemove(tag)}
              className="p-0.5 rounded text-neutral-text/50 hover:text-red-500 cursor-pointer"
              aria-label={t('categories.tags.removeAria', { tag })}
              title={t('categories.tags.remove')}
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
}) => {
  const { t } = useAdminT();
  return (
  <form
    className={`flex items-center gap-2 ${className}`}
    onSubmit={(e) => {
      e.preventDefault();
      onSubmit();
    }}
  >
    <input
      type="text"
      placeholder={t('categories.tagForm.placeholder')}
      value={draft}
      onChange={(e) => onDraftChange(e.target.value)}
      className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-canvas border border-muted-border/40 text-[11px] text-heading outline-none focus:border-accent"
    />
    <button type="submit" className="brand-btn-primary px-3.5 py-2 rounded-xl font-bold text-[11px] cursor-pointer shrink-0">
      {t('categories.tagForm.add')}
    </button>
  </form>
  );
};

/* -------------------------------- Layouts -------------------------------- */

const CategoriesGrid: React.FC<{
  categories: CategoryItem[];
  columns: GridColumns;
  canManage: boolean;
  drafts: Record<string, string>;
  handlers: CategoryHandlers;
}> = ({ categories, columns, canManage, drafts, handlers }) => {
  const { t } = useAdminT();
  return (
  <div className={`grid gap-5 ${gridColumnsClass(columns)}`}>
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
          <span className="text-[11px] font-bold text-neutral-text/60 block mb-2">{t('categories.tags.count', { count: cat.tags.length })}</span>
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
};

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

const categorySearchText = (cat: CategoryItem): string =>
  [cat.nameAr, cat.nameEn, TYPE_LABEL[cat.type] ?? cat.type, ...cat.tags].filter(Boolean).join(' ');

const CategoriesTable: React.FC<{
  categories: CategoryItem[];
  canManage: boolean;
  handlers: CategoryHandlers;
}> = ({ categories, canManage, handlers }) => {
  const { t } = useAdminT();
  const columns = useMemo<Column<CategoryItem>[]>(
    () => [
      {
        id: 'name',
        header: t('categories.table.category'),
        width: '220px',
        sortValue: (cat) => cat.nameAr,
        cell: (cat) => (
          <div className="min-w-0">
            {canManage ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlers.edit(cat);
                }}
                className="font-bold text-xs text-heading hover:text-accent cursor-pointer truncate block text-start"
              >
                {cat.nameAr}
              </button>
            ) : (
              <span className="font-bold text-xs text-heading truncate block">{cat.nameAr}</span>
            )}
            <span className="text-[10px] text-accent font-bold font-mono block truncate" dir="ltr">
              {cat.nameEn}
            </span>
          </div>
        ),
      },
      {
        id: 'type',
        header: t('categories.table.type'),
        width: '160px',
        sortValue: (cat) => TYPE_LABEL[cat.type] ?? cat.type,
        filter: {
          type: 'select',
          options: TYPE_OPTIONS,
          value: (cat) => cat.type,
        },
        cell: (cat) => <TypeBadge type={cat.type} />,
      },
      {
        id: 'tags',
        header: t('categories.table.tags'),
        sortValue: (cat) => cat.tags.length,
        cell: (cat) => (
          <div className="flex flex-wrap items-center gap-1">
            {cat.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-bold ps-2 pe-1.5 py-0.5 rounded-md bg-canvas border border-muted-border/40 text-heading"
              >
                #{tag}
              </span>
            ))}
            {cat.tags.length > 4 && (
              <span className="text-[10px] font-bold text-neutral-text/55">+{cat.tags.length - 4}</span>
            )}
            {cat.tags.length === 0 && <span className="text-neutral-text/45">—</span>}
          </div>
        ),
      },
      {
        id: 'count',
        header: t('categories.table.tagCount'),
        width: '110px',
        sortValue: (cat) => cat.tags.length,
        cell: (cat) => <span className="tabular-nums font-bold text-neutral-text/80">{cat.tags.length}</span>,
      },
    ],
    [canManage, handlers, t]
  );

  return (
    <DataTable
      storageKey="ajda.admin.categories"
      rows={categories}
      getRowId={(cat) => cat.id}
      columns={columns}
      searchText={categorySearchText}
      initialSort={{ columnId: 'name', direction: 'asc' }}
      onRowClick={canManage ? (cat) => handlers.edit(cat) : undefined}
      rowActions={
        canManage
          ? (cat) => <CategoryActions onEdit={() => handlers.edit(cat)} onDelete={() => handlers.remove(cat)} />
          : undefined
      }
    />
  );
};

const ColumnSwitcher: React.FC<{ value: GridColumns; onChange: (columns: GridColumns) => void }> = ({ value, onChange }) => {
  const { t } = useAdminT();
  return (
  <div className="hidden lg:flex items-center gap-2">
    <span className="text-[11px] font-bold text-neutral-text/60">{t('categories.columns.label')}</span>
    <div className="inline-flex rounded-xl border border-muted-border/40 p-0.5 bg-canvas" role="group" aria-label={t('categories.columns.aria')}>
      {GRID_COLUMN_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          aria-label={t('categories.columns.optionAria', { count: option })}
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
};

export const CategoriesSection: React.FC = () => {
  const { can, showToast, confirmDelete } = useAdmin();
  const { t } = useAdminT();
  const canManage = can('manageProjects');
  const [view, setView] = usePersistentState<ViewMode>(CATEGORIES_VIEW_STORAGE_KEY, 'grid', isViewMode);
  const [columns, setColumns] = usePersistentState<GridColumns>('ajda.admin.categories.columns', 3, isGridColumns);
  const categories = useAsyncData<CategoryItem[]>(
    useCallback((signal) => AdminStorage.listCategories(signal), []),
    [],
    []
  );
  const [dialog, setDialog] = useState<{ category: CategoryItem | null } | null>(null);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});

  const saveTags = async (category: CategoryItem, tags: string[]) => {
    const previousTags = category.tags;
    const setTags = (next: string[]) =>
      categories.setData((current) => current.map((c) => (c.id === category.id ? { ...c, tags: next } : c)));
    setTags(tags);
    try {
      await AdminStorage.updateCategory(category.id, {
        nameAr: category.nameAr,
        nameEn: category.nameEn,
        type: category.type,
        tags,
      });
      return true;
    } catch (error) {
      // Revert only this category's tags.
      setTags(previousTags);
      showToast(getErrorMessage(error, t('categories.toast.tagsError')));
      return false;
    }
  };

  const addTag = async (category: CategoryItem) => {
    const tag = (tagDrafts[category.id] ?? '').trim();
    if (!tag) return;
    if (category.tags.includes(tag)) {
      showToast(t('categories.toast.tagExists'));
      return;
    }
    if (await saveTags(category, [...category.tags, tag])) {
      setTagDrafts((d) => ({ ...d, [category.id]: '' }));
    }
  };

  const deleteCategory = async (category: CategoryItem) => {
    const ok = await confirmDelete({
      title: t('categories.delete.confirmTitle', { name: category.nameAr }),
      message: t('categories.delete.confirmMessage'),
      confirmLabel: t('categories.delete.confirmLabel'),
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteCategory(category.id);
      await categories.reload();
      showToast(t('categories.delete.success'));
    } catch (error) {
      showToast(getErrorMessage(error, t('categories.delete.error')));
    }
  };

  const handlers: CategoryHandlers = {
    edit: (category) => setDialog({ category }),
    remove: (category) => void deleteCategory(category),
    addTag: (category) => void addTag(category),
    removeTag: (category, tag) =>
      void (async () => {
        const ok = await confirmDelete({
          title: t('categories.removeTag.confirmTitle', { tag, name: category.nameAr }),
          confirmLabel: t('categories.removeTag.confirmLabel'),
        });
        if (ok) await saveTags(category, category.tags.filter((t) => t !== tag));
      })(),
    setDraft: (categoryId, draft) => setTagDrafts((d) => ({ ...d, [categoryId]: draft })),
  };

  const header = (
    <AdminHeaderActions>
      <ViewSwitcher value={view} onChange={setView} modes={['table', 'list', 'grid']} />
      {canManage && (
        <button
          onClick={() => setDialog({ category: null })}
          className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('categories.new')}</span>
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
        <SectionLoading variant="cards" label={t('categories.loading')} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {categories.data.length === 0 ? (
        <EmptyState icon={Tags} title={t('categories.emptyTitle')} description={t('categories.emptyDescription')} />
      ) : (
        <>
          {view === 'grid' && <ColumnSwitcher value={columns} onChange={setColumns} />}
          {view === 'grid' && <CategoriesGrid categories={categories.data} columns={columns} canManage={canManage} drafts={tagDrafts} handlers={handlers} />}
          {view === 'list' && <CategoriesList categories={categories.data} canManage={canManage} drafts={tagDrafts} handlers={handlers} />}
          {view === 'table' && <CategoriesTable categories={categories.data} canManage={canManage} handlers={handlers} />}
        </>
      )}
      {dialogNode}
    </div>
  );
};
