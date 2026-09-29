/**
 * Create / edit dialog for a role.
 *
 * The form mirrors the guards in `server/src/routes/roles.routes.ts`: the key is
 * immutable after create, a system role keeps its permissions, and `manageUsers`
 * can only be granted by a super admin. Anything the current admin may not use
 * stays visible but disabled with the reason on screen, so the form never looks
 * broken or silently drops a permission.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, LoaderCircle, Lock, RefreshCw, X } from 'lucide-react';
import type { PermissionDef, Role } from '../../../types/admin';
import { AdminStorage, type RoleInput } from '../../../services/adminStorage';
import {
  MANAGE_USERS_HINT,
  MANAGE_USERS_KEY,
  ROLE_KEY_HINT,
  ROLE_SAVE_ERROR,
  getRoleRights,
  hrErrorMessage,
  normalizeRoleKey,
  roleUserCount,
  validateRoleKey,
  type PermissionKey,
} from './rolesModel';
import { groupPermissions, type PermissionGroup } from '../users/usersModel';

const INPUT =
  'w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed';

const inputTone = (invalid: boolean): string => (invalid ? `${INPUT} border-red-500/60` : `${INPUT} border-muted-border/50`);

interface RoleFormDialogProps {
  /** `null` creates a new role. */
  role: Role | null;
  permissions: PermissionDef[];
  permissionsLoading: boolean;
  permissionsError: string | null;
  onRetryPermissions: () => void;
  isSuperAdmin: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export const RoleFormDialog: React.FC<RoleFormDialogProps> = ({
  role,
  permissions,
  permissionsLoading,
  permissionsError,
  onRetryPermissions,
  isSuperAdmin,
  showToast,
  onClose,
  onSaved,
}) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = role ? `تعديل الدور: ${role.nameAr}` : 'إنشاء دور جديد';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-3xl my-4 bg-surface rounded-3xl border border-muted-border/40 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-muted-border/30">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-heading truncate">{title}</h3>
            <p className="text-[10px] text-neutral-text/60 mt-0.5">
              {role ? 'الاسم والوصف والصلاحيات' : 'مفتاح فريد لا يُغيَّر بعد الإنشاء'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-7 h-7 rounded-full border border-muted-border/40 flex items-center justify-center text-heading hover:text-accent cursor-pointer shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {permissionsLoading ? (
          <div className="px-6 py-14 flex flex-col items-center gap-3 text-neutral-text/60">
            <LoaderCircle className="w-6 h-6 animate-spin text-accent" />
            <p className="text-xs font-bold">جاري تحميل قائمة الصلاحيات...</p>
          </div>
        ) : permissionsError ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-7 h-7 text-red-400" />
            <p className="text-xs font-bold text-heading">تعذر تحميل قائمة الصلاحيات</p>
            <p className="text-[11px] text-neutral-text/60 max-w-sm">{permissionsError}</p>
            <button
              type="button"
              onClick={onRetryPermissions}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <RoleForm
            role={role}
            permissions={permissions}
            isSuperAdmin={isSuperAdmin}
            showToast={showToast}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ *
 * The form itself
 * ------------------------------------------------------------------ */

interface RoleFormProps {
  role: Role | null;
  permissions: PermissionDef[];
  isSuperAdmin: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface RoleFormState {
  key: string;
  nameAr: string;
  nameEn: string;
  description: string;
  selected: PermissionKey[];
  applyToUsers: boolean;
}

type FormErrors = Partial<Record<'key' | 'nameAr' | 'nameEn', string>>;

interface RoleFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + the one line of feedback that belongs to it. */
const RoleField: React.FC<RoleFieldProps> = ({ label, required, error, hint, className = '', children }) => (
  <div className={className}>
    <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </span>
    {children}
    {error ? (
      <p role="alert" className="mt-1 text-[10px] font-bold text-red-500">
        {error}
      </p>
    ) : (
      hint && <p className="mt-1 text-[10px] text-neutral-text/55 leading-relaxed">{hint}</p>
    )}
  </div>
);

/** Order the payload follows the catalogue, not the order boxes were ticked. */
function orderByCatalogue(selected: PermissionKey[], catalogue: PermissionDef[]): PermissionKey[] {
  const chosen = new Set(selected);
  return catalogue.filter((definition) => chosen.has(definition.key)).map((definition) => definition.key);
}

const RoleForm: React.FC<RoleFormProps> = ({ role, permissions, isSuperAdmin, showToast, onClose, onSaved }) => {
  const isCreate = role === null;
  const rights = useMemo(() => (role ? getRoleRights(role, isSuperAdmin) : null), [role, isSuperAdmin]);
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const userCount = role ? roleUserCount(role) : 0;

  const [form, setForm] = useState<RoleFormState>(() => ({
    key: '',
    nameAr: role?.nameAr ?? '',
    nameEn: role?.nameEn ?? '',
    description: role?.description ?? '',
    selected: role?.permissions ?? [],
    applyToUsers: true,
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  /* --------------------------- Permission locks --------------------------- */

  const permissionsLocked = rights ? !rights.permissionsEditable : false;
  const lockReason = rights?.permissionHint ?? null;
  // manageUsers is the one permission that escalates: only a super admin grants it.
  const isLocked = (key: PermissionKey): boolean => permissionsLocked || (key === MANAGE_USERS_KEY && !isSuperAdmin);
  const lockHint = (key: PermissionKey): string | null =>
    permissionsLocked ? lockReason : key === MANAGE_USERS_KEY && !isSuperAdmin ? MANAGE_USERS_HINT : null;

  const togglePermission = (key: PermissionKey, checked: boolean) => {
    if (isLocked(key)) return;
    setForm((current) => ({
      ...current,
      selected: checked
        ? [...current.selected, key]
        : current.selected.filter((existing) => existing !== key),
    }));
  };

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    setForm((current) => {
      const groupKeys = group.items.map((item) => item.key);
      const next = new Set(current.selected);
      for (const key of groupKeys) {
        if (isLocked(key)) continue;
        if (checked) next.add(key);
        else next.delete(key);
      }
      return { ...current, selected: [...next] };
    });
  };

  /* -------------------------------- Submit -------------------------------- */

  const validate = (): FormErrors => {
    const found: FormErrors = {};
    if (isCreate) {
      const keyError = validateRoleKey(form.key);
      if (keyError) found.key = keyError;
    }
    if (form.nameAr.trim() === '') found.nameAr = 'الاسم بالعربية مطلوب';
    if (form.nameEn.trim() === '') found.nameEn = 'الاسم بالإنجليزية مطلوب';
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const description = form.description.trim();
    const selected = orderByCatalogue(form.selected, permissions);

    setSaving(true);
    try {
      if (role) {
        const changes: Partial<RoleInput> = {
          nameAr: form.nameAr.trim(),
          nameEn: form.nameEn.trim(),
          description: description === '' ? null : description,
          applyToUsers: form.applyToUsers,
        };
        // A system role keeps its permissions, so they are not sent at all.
        if (rights?.permissionsEditable) changes.permissions = selected;
        await AdminStorage.updateRole(role.id, changes);
        showToast(`تم تحديث الدور ${form.nameAr.trim()}`);
      } else {
        const input: RoleInput = {
          key: normalizeRoleKey(form.key),
          nameAr: form.nameAr.trim(),
          nameEn: form.nameEn.trim(),
          description: description === '' ? null : description,
          permissions: selected,
        };
        await AdminStorage.createRole(input);
        showToast(`تم إنشاء الدور ${input.nameAr}`);
      }
      await onSaved();
      onClose();
    } catch (error) {
      showToast(hrErrorMessage(error, 'تعذر حفظ بيانات الدور', ROLE_SAVE_ERROR));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col max-h-[88vh]">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {role ? (
          <div className="p-3 rounded-xl bg-canvas/60 border border-muted-border/30 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-neutral-text/60">مفتاح الدور (ثابت):</span>
            <span dir="ltr" className="font-mono text-[11px] text-heading">
              {role.key}
            </span>
            <span className="text-[10px] text-neutral-text/50">لا يمكن تعديل المفتاح بعد الإنشاء.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <RoleField
              label="مفتاح الدور"
              required
              error={errors.key}
              hint={errors.key ? undefined : `${ROLE_KEY_HINT} — لا يمكن تغييره بعد الإنشاء`}
            >
              <input
                type="text"
                dir="ltr"
                autoFocus
                value={form.key}
                aria-invalid={Boolean(errors.key)}
                onChange={(event) => setForm({ ...form, key: event.target.value })}
                placeholder="sales_agent"
                className={`${inputTone(Boolean(errors.key))} font-mono text-start`}
              />
            </RoleField>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <RoleField label="الاسم بالعربية" required error={errors.nameAr}>
            <input
              type="text"
              autoFocus={!isCreate}
              value={form.nameAr}
              aria-invalid={Boolean(errors.nameAr)}
              onChange={(event) => setForm({ ...form, nameAr: event.target.value })}
              placeholder="مثال: مسؤول تأجير"
              className={inputTone(Boolean(errors.nameAr))}
            />
          </RoleField>
          <RoleField label="الاسم بالإنجليزية" required error={errors.nameEn}>
            <input
              type="text"
              dir="ltr"
              value={form.nameEn}
              aria-invalid={Boolean(errors.nameEn)}
              onChange={(event) => setForm({ ...form, nameEn: event.target.value })}
              placeholder="Sales Agent"
              className={`${inputTone(Boolean(errors.nameEn))} text-start`}
            />
          </RoleField>
        </div>

        <RoleField label="الوصف" hint="يوضّح متى يُمنح هذا الدور، ويظهر لأعضاء الفريق.">
          <textarea
            rows={2}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="مثال: يتابع محفظة المشاريع وطلبات العملاء دون تعديل البيانات."
            className={`${inputTone(false)} resize-none`}
          />
        </RoleField>

        <div className="pt-1 border-t border-muted-border/30 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-xs font-black text-heading">صلاحيات الدور</h4>
              <p className="text-[10px] text-neutral-text/60 mt-0.5">
                ({form.selected.length} من {permissions.length} صلاحية محددة)
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    selected: permissionsLocked
                      ? current.selected
                      : permissions.filter((definition) => !isLocked(definition.key)).map((definition) => definition.key),
                  }))
                }
                disabled={permissionsLocked}
                title={lockReason ?? (isSuperAdmin ? 'تحديد كل الصلاحيات' : 'تحديد كل الصلاحيات المتاحة لك')}
                className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                تحديد الكل
              </button>
              <button
                type="button"
                onClick={() => setForm((current) => ({ ...current, selected: [] }))}
                disabled={permissionsLocked}
                title={lockReason ?? 'إلغاء تحديد الكل'}
                className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold cursor-pointer disabled:opacity-50"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>

          {lockReason && (
            <p className="flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{lockReason}</span>
            </p>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {groups.map((group) => (
              <PermissionGroupFieldset
                key={group.key}
                group={group}
                selected={form.selected}
                isLocked={isLocked}
                lockHint={lockHint}
                onToggle={togglePermission}
                onToggleGroup={(checked) => toggleGroup(group, checked)}
              />
            ))}
          </div>
        </div>

        {!isCreate && rights?.permissionsEditable && userCount > 0 && (
          <label
            title="عند الإيقاف تبقى صلاحيات المستخدمين الحاليين كما هي حتى تُحدّثها من قسم المستخدمين."
            className="flex items-start gap-2 p-3 rounded-xl bg-canvas/60 border border-muted-border/30 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={form.applyToUsers}
              onChange={(event) => setForm({ ...form, applyToUsers: event.target.checked })}
              className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0"
            />
            <span className="min-w-0">
              <span className="block text-[11px] font-bold text-heading">
                تطبيق الصلاحيات على كل المستخدمين بهذا الدور ({userCount})
              </span>
              <span className="block text-[10px] text-neutral-text/60 leading-relaxed">
                عند الإيقاف تبقى صلاحيات المستخدمين الحاليين كما هي حتى تُحدّثها من قسم المستخدمين.
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-border/30">
        <p className="text-[10px] text-neutral-text/55 hidden sm:block">
          {isCreate
            ? 'يُنشأ الدور بلا أعضاء؛ أسنده إلى المستخدمين من قسم المستخدمين.'
            : role?.isSystem
              ? 'يُحدَّث الاسم والوصف فقط؛ صلاحيات الدور النظامي ثابتة.'
              : 'تُحفظ التغييرات فوراً ويسجّل النظام من قام بها.'}
        </p>
        <div className="flex items-center gap-2 ms-auto">
          <button
            type="button"
            onClick={onClose}
            className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving}
            className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            {isCreate ? 'إنشاء الدور' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </form>
  );
};

/* ------------------------------------------------------------------ *
 * One permission group
 * ------------------------------------------------------------------ */

interface PermissionGroupFieldsetProps {
  group: PermissionGroup;
  selected: PermissionKey[];
  isLocked: (key: PermissionKey) => boolean;
  lockHint: (key: PermissionKey) => string | null;
  onToggle: (key: PermissionKey, checked: boolean) => void;
  onToggleGroup: (checked: boolean) => void;
}

const PermissionGroupFieldset: React.FC<PermissionGroupFieldsetProps> = ({
  group,
  selected,
  isLocked,
  lockHint,
  onToggle,
  onToggleGroup,
}) => {
  const groupCheckboxRef = useRef<HTMLInputElement>(null);
  const editableKeys = group.items.map((item) => item.key).filter((key) => !isLocked(key));
  const selectedCount = editableKeys.filter((key) => selected.includes(key)).length;
  const allSelected = editableKeys.length > 0 && selectedCount === editableKeys.length;
  const someSelected = selectedCount > 0 && !allSelected;

  useEffect(() => {
    if (groupCheckboxRef.current) groupCheckboxRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <fieldset className="p-3 rounded-xl bg-canvas/60 border border-muted-border/30">
      <legend className="px-1 text-[11px] font-black text-heading flex items-center gap-2">
        <span>{group.label}</span>
        {editableKeys.length > 0 && (
          <label
            title={allSelected ? 'إلغاء تحديد مجموعة الصلاحيات' : 'تحديد مجموعة الصلاحيات'}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-text/60 hover:text-accent cursor-pointer"
          >
            <input
              ref={groupCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={(event) => onToggleGroup(event.target.checked)}
              className="w-3.5 h-3.5 rounded accent-accent cursor-pointer"
            />
            تحديد الكل
          </label>
        )}
      </legend>

      <div className="space-y-2">
        {group.items.map((permission) => {
          const hint = lockHint(permission.key);
          return (
            <label
              key={permission.key}
              title={hint ?? undefined}
              className={`flex items-start gap-2 ${hint ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={selected.includes(permission.key)}
                disabled={Boolean(hint)}
                onChange={(event) => onToggle(permission.key, event.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0 disabled:cursor-not-allowed"
              />
              <span className="min-w-0">
                <span className="block font-bold text-heading">
                  {permission.labelAr}
                  {hint && <Lock className="w-2.5 h-2.5 inline-block ms-1 align-text-bottom text-amber-500" />}
                </span>
                <span className="block text-[10px] text-neutral-text/60 leading-relaxed">
                  {permission.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
