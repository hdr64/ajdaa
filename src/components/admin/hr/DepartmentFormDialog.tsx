/**
 * Create / edit dialog for a department. Small by design: a department is an
 * Arabic name and an optional English one, and the server keeps the members'
 * free-text department in step with a rename.
 */
import React, { useEffect, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import type { Department } from '../../../types/admin';
import { AdminStorage } from '../../../services/adminStorage';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { DEPARTMENT_SAVE_ERROR, hrErrorMessage } from './rolesModel';

const INPUT =
  'w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition focus:border-accent';

const inputTone = (invalid: boolean): string =>
  invalid ? `${INPUT} border-red-500/60` : `${INPUT} border-muted-border/50`;

interface DepartmentFormDialogProps {
  /** `null` creates a new department. */
  department: Department | null;
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export const DepartmentFormDialog: React.FC<DepartmentFormDialogProps> = ({
  department,
  showToast,
  onClose,
  onSaved,
}) => {
  const { t, isEn } = useAdminT();
  const isCreate = department === null;
  const [nameAr, setNameAr] = useState(department?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(department?.nameEn ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = isEn && department?.nameEn ? department.nameEn : department?.nameAr;
  const title = isCreate
    ? t('departments.dialogCreateTitle')
    : t('departments.dialogEditTitle', { name: displayName ?? '' });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (nameAr.trim() === '') {
      setError(t('departments.nameArRequired'));
      return;
    }
    setError(null);

    const payload = { nameAr: nameAr.trim(), nameEn: nameEn.trim() === '' ? null : nameEn.trim() };

    setSaving(true);
    try {
      if (department) {
        await AdminStorage.updateDepartment(department.id, payload);
        const name = isEn && payload.nameEn ? payload.nameEn : payload.nameAr;
        showToast(t('departments.toastUpdated', { name }));
      } else {
        await AdminStorage.createDepartment(payload);
        const name = isEn && payload.nameEn ? payload.nameEn : payload.nameAr;
        showToast(t('departments.toastCreated', { name }));
      }
      await onSaved();
      onClose();
    } catch (caught) {
      showToast(hrErrorMessage(caught, t('departments.toastSaveError'), DEPARTMENT_SAVE_ERROR));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md bg-surface rounded-3xl border border-muted-border/40 shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-heading">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('users.close')}
            className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="block">
          <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            {t('departments.nameArLabel')}<span className="text-red-500"> *</span>
          </span>
          <input
            type="text"
            required
            autoFocus
            value={nameAr}
            aria-invalid={Boolean(error)}
            onChange={(event) => setNameAr(event.target.value)}
            placeholder={t('departments.nameArPlaceholder')}
            className={inputTone(Boolean(error))}
          />
          {error ? (
            <p role="alert" className="mt-1 text-[10px] font-bold text-red-500">
              {error}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-neutral-text/55 leading-relaxed">
              {t('departments.nameArHint')}
            </p>
          )}
        </label>

        <label className="block">
          <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            {t('departments.nameEnLabel')}
          </span>
          <input
            type="text"
            dir="ltr"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
            placeholder={t('departments.nameEnPlaceholder')}
            className={`${inputTone(false)} text-start`}
          />
        </label>

        {!isCreate && (department?.userCount ?? 0) > 0 && (
          <p className="text-[10px] text-neutral-text/55 leading-relaxed">
            {t('departments.updateNote')}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-muted-border/30">
          <button
            type="button"
            onClick={onClose}
            className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            {t('departments.cancelBtn')}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            {isCreate ? t('departments.createBtn') : t('departments.saveBtn')}
          </button>
        </div>
      </form>
    </div>
  );
};
