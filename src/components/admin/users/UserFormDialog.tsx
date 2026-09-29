/**
 * Create / edit dialog for an admin account.
 *
 * The form talks to the same references the server does (`/api/roles`,
 * `/api/departments`, `/api/permissions`), so a role always arrives with its own
 * permission set: picking a role fills the checkboxes, which the admin may then
 * customise. Options and fields the current admin may not use are disabled with
 * the reason on screen rather than hidden, and a locked account sends only the
 * fields the server would accept.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Eye, EyeOff, LoaderCircle, RefreshCw, X } from 'lucide-react';
import type {
  AdminPermissions,
  AdminRole,
  AdminStatus,
  AdminUser,
  Department,
  PermissionDef,
  Role,
} from '../../../types/admin';
import { AdminStorage, type AdminUserInput } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import {
  DEFAULT_ROLE_KEY,
  MIN_PASSWORD_LENGTH,
  NO_DEPARTMENT,
  NO_DEPARTMENT_LABEL,
  PERMISSION_KEYS,
  ROLE_AR_LABELS,
  STATUS_OPTIONS,
  SUPER_ADMIN_ROLE_KEY,
  emptyPermissions,
  groupPermissions,
  permissionsFromRole,
  toAdminRole,
} from './usersModel';
import type { UserRights } from './usersModel';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const INPUT =
  'w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed';

const inputTone = (invalid: boolean): string => (invalid ? `${INPUT} border-red-500/60` : `${INPUT} border-muted-border/50`);

interface UserFormDialogProps {
  /** `null` creates a new account. */
  user: AdminUser | null;
  rights: UserRights | null;
  roles: Role[];
  departments: Department[];
  permissions: PermissionDef[];
  referenceLoading: boolean;
  referenceError: string | null;
  onRetryReference: () => void;
  /** Only a super admin may hand out the super admin role. */
  canAssignSuperAdmin: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  user,
  rights,
  roles,
  departments,
  permissions,
  referenceLoading,
  referenceError,
  onRetryReference,
  canAssignSuperAdmin,
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
        aria-label={user ? `تعديل حساب ${user.name}` : 'إضافة مستخدم جديد'}
        className="relative w-full max-w-3xl my-4 bg-surface rounded-3xl border border-muted-border/40 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-muted-border/30">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-heading">
              {user ? `تعديل حساب: ${user.name}` : 'إضافة مستخدم جديد'}
            </h3>
            <p className="text-[10px] text-neutral-text/60 mt-0.5 truncate">
              {user ? user.email : 'حدّد الدور والقسم أولاً، ثم خصّص الصلاحيات'}
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

        {referenceLoading ? (
          <div className="px-6 py-14 flex flex-col items-center gap-3 text-neutral-text/60">
            <LoaderCircle className="w-6 h-6 animate-spin text-accent" />
            <p className="text-xs font-bold">جاري تحميل الأدوار والأقسام...</p>
          </div>
        ) : referenceError ? (
          <div className="px-6 py-12 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-7 h-7 text-red-400" />
            <p className="text-xs font-bold text-heading">تعذر تحميل بيانات الأدوار والأقسام</p>
            <p className="text-[11px] text-neutral-text/60 max-w-sm">{referenceError}</p>
            <button
              type="button"
              onClick={onRetryReference}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <UserForm
            user={user}
            rights={rights}
            roles={roles}
            departments={departments}
            permissions={permissions}
            canAssignSuperAdmin={canAssignSuperAdmin}
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

type UserFormProps = Omit<
  UserFormDialogProps,
  'referenceLoading' | 'referenceError' | 'onRetryReference'
>;

interface RoleOption {
  value: string;
  label: string;
  /** `null` for an account whose role record is gone — the label is kept as-is. */
  role: Role | null;
}

interface DepartmentOption {
  value: string;
  label: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  replacePassword: boolean;
  roleId: string;
  departmentId: string;
  status: AdminStatus;
  permissions: AdminPermissions;
}

type FormErrors = Partial<Record<'name' | 'email' | 'password', string>>;

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, hint, error, className = '', children }) => (
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

const UserForm: React.FC<UserFormProps> = ({
  user,
  rights,
  roles,
  departments,
  permissions,
  canAssignSuperAdmin,
  showToast,
  onClose,
  onSaved,
}) => {
  const isCreate = user === null;
  const accessLocked = rights?.accessLocked ?? false;

  /* ------------------------- Roles & departments ------------------------- */

  const { roleOptions, initialRoleId, defaultRole } = useMemo(() => {
    const idByKey = new Map(roles.map((role) => [role.key, role.id]));
    const options: RoleOption[] = roles.map((role) => ({ value: role.id, label: role.nameAr, role }));
    const known = new Set(options.map((option) => option.value));
    // An account created before the roles table existed only carries its role key.
    const currentRoleId = user ? (user.roleId ?? idByKey.get(user.role) ?? user.role) : '';
    if (user && !known.has(currentRoleId)) {
      options.unshift({ value: currentRoleId, label: user.roleAr, role: null });
    }
    return {
      roleOptions: options,
      initialRoleId: currentRoleId,
      defaultRole: roles.find((role) => role.key === DEFAULT_ROLE_KEY) ?? roles.find((role) => role.key !== SUPER_ADMIN_ROLE_KEY) ?? roles[0] ?? null,
    };
  }, [roles, user]);

  const { departmentOptions, initialDepartmentId } = useMemo(() => {
    const idByName = new Map(departments.map((department) => [department.nameAr.trim(), department.id]));
    const options: DepartmentOption[] = [
      ...departments.map((department) => ({ value: department.id, label: department.nameAr })),
      { value: NO_DEPARTMENT, label: NO_DEPARTMENT_LABEL },
    ];
    const known = new Set(options.map((option) => option.value));
    const current = user
      ? (user.departmentId ?? idByName.get((user.departmentName ?? user.department ?? '').trim()) ?? NO_DEPARTMENT)
      : NO_DEPARTMENT;
    if (user && !known.has(current)) {
      options.splice(options.length - 1, 0, { value: current, label: user.departmentName || user.department });
    }
    return { departmentOptions: options, initialDepartmentId: current };
  }, [departments, user]);

  /* -------------------------------- Form -------------------------------- */

  const [form, setForm] = useState<UserFormState>(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    password: '',
    replacePassword: false,
    roleId: initialRoleId || (defaultRole?.id ?? ''),
    departmentId: initialDepartmentId,
    status: user?.status ?? 'active',
    permissions: user ? { ...user.permissions } : permissionsFromRole(defaultRole),
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRoleOption = roleOptions.find((option) => option.value === form.roleId) ?? null;
  const selectedRole = selectedRoleOption?.role ?? null;
  const groups = useMemo(() => groupPermissions(permissions), [permissions]);
  const allPermissionsChecked = PERMISSION_KEYS.every((key) => form.permissions[key]);

  const pickRole = (roleId: string) => {
    const role = roleOptions.find((option) => option.value === roleId)?.role ?? null;
    setForm((current) => ({
      ...current,
      roleId,
      // Picking a role fills its own permissions; the admin customises from there.
      permissions: role ? permissionsFromRole(role) : current.permissions,
    }));
  };

  const togglePermission = (key: keyof AdminPermissions, checked: boolean) => {
    setForm((current) => ({ ...current, permissions: { ...current.permissions, [key]: checked } }));
  };

  const setAllPermissions = (checked: boolean) => {
    const next = emptyPermissions();
    for (const key of PERMISSION_KEYS) next[key] = checked;
    setForm((current) => ({ ...current, permissions: next }));
  };

  /* ------------------------------- Submit ------------------------------- */

  const validate = (): FormErrors => {
    const found: FormErrors = {};
    if (form.name.trim() === '') found.name = 'الاسم الكامل مطلوب';
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = 'أدخل بريداً إلكترونياً صحيحاً';
    if (isCreate || form.replacePassword) {
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        found.password = `كلمة المرور ${MIN_PASSWORD_LENGTH} أحرف على الأقل`;
      }
    }
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const roleKey: AdminRole = toAdminRole(
      selectedRole?.key ?? selectedRoleOption?.value,
      user ? toAdminRole(user.role) : DEFAULT_ROLE_KEY
    );
    const roleAr =
      selectedRole?.nameAr ?? selectedRoleOption?.label ?? user?.roleAr ?? ROLE_AR_LABELS[roleKey];
    const selectedRoleId = selectedRoleOption ? (selectedRole?.id ?? selectedRoleOption.value) : null;

    const departmentOption =
      departmentOptions.find((option) => option.value === form.departmentId) ?? null;
    const departmentId = departmentOption && departmentOption.value !== NO_DEPARTMENT ? departmentOption.value : null;
    const departmentName =
      departmentId === null ? null : departments.find((d) => d.id === departmentId)?.nameAr ?? departmentOption?.label ?? null;

    setSaving(true);
    try {
      if (user) {
        const changes: Partial<AdminUserInput> = {
          name: form.name.trim(),
          email: form.email.trim(),
          department: departmentName,
          departmentId,
        };
        // A locked account only sends what the server will accept for it.
        if (!accessLocked) {
          changes.role = roleKey;
          changes.roleAr = roleAr;
          changes.roleId = selectedRoleId;
          changes.permissions = form.permissions;
          if (form.status !== user.status) changes.status = form.status;
        }
        if (form.replacePassword && form.password) changes.password = form.password;

        await AdminStorage.updateUser(user.id, changes);
        showToast(`تم تحديث حساب ${form.name.trim()}`);
      } else {
        const input: AdminUserInput = {
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: roleKey,
          roleAr,
          roleId: selectedRoleId,
          department: departmentName,
          departmentId,
          permissions: form.permissions,
        };
        await AdminStorage.createUser(input);
        showToast(`تمت إضافة المستخدم ${form.name.trim()} بنجاح`);
      }
      await onSaved();
      onClose();
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حفظ بيانات المستخدم'));
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdminRoleSelected = selectedRole?.key === SUPER_ADMIN_ROLE_KEY;

  return (
    <form onSubmit={submit} className="flex flex-col max-h-[88vh]">
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="الاسم الكامل" required error={errors.name}>
            <input
              type="text"
              autoFocus
              value={form.name}
              aria-invalid={Boolean(errors.name)}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="مثال: خالد المنصور"
              className={inputTone(Boolean(errors.name))}
            />
          </Field>

          <Field label="البريد الإلكتروني" required error={errors.email}>
            <input
              type="email"
              dir="ltr"
              value={form.email}
              aria-invalid={Boolean(errors.email)}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="name@ajdaa.sa"
              className={`${inputTone(Boolean(errors.email))} text-start`}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {!isCreate && (
            <label className="flex items-center gap-2 text-[11px] font-bold text-neutral-text/70 cursor-pointer self-end pb-2.5">
              <input
                type="checkbox"
                checked={form.replacePassword}
                onChange={(event) => setForm({ ...form, replacePassword: event.target.checked })}
                className="w-3.5 h-3.5 rounded accent-accent"
              />
              تعيين كلمة مرور جديدة
            </label>
          )}

          {(isCreate || form.replacePassword) && (
            <Field
              label="كلمة المرور"
              required={isCreate}
              error={errors.password}
              hint={
                isCreate ? `${MIN_PASSWORD_LENGTH} أحرف على الأقل، تُستخدم عند أول دخول للحساب.` : undefined
              }
              className={isCreate ? '' : 'sm:col-start-2 sm:row-start-1'}
            >
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  aria-invalid={Boolean(errors.password)}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  placeholder="••••••••"
                  className={`${inputTone(Boolean(errors.password))} pe-10 text-start`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
          <Field label="الدور الوظيفي" hint={isSuperAdminRoleSelected ? 'حساب المدير العام يملك كل الصلاحيات فعلياً.' : undefined}>
            <select
              value={form.roleId}
              disabled={accessLocked}
              onChange={(event) => pickRole(event.target.value)}
              title={rights?.lockReason ?? 'دور المستخدم'}
              className={`${inputTone(false)} cursor-pointer disabled:cursor-not-allowed`}
            >
              {roleOptions.map((option) => {
                const isSuperAdminOption = option.role?.key === SUPER_ADMIN_ROLE_KEY;
                const blocked = isSuperAdminOption && !canAssignSuperAdmin;
                return (
                  <option key={option.value} value={option.value} disabled={blocked}>
                    {option.label}
                    {blocked ? ' — متاح لمدير عام فقط' : ''}
                  </option>
                );
              })}
            </select>
          </Field>

          <Field label="القسم / الإدارة" hint="«بدون قسم» للأعضاء غير المرتبطين بإدارة.">
            <select
              value={form.departmentId}
              onChange={(event) => setForm({ ...form, departmentId: event.target.value })}
              className={`${inputTone(false)} cursor-pointer`}
            >
              {departmentOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="حالة الحساب"
            hint={
              isCreate
                ? 'تُنشأ الحسابات الجديدة بحالة نشطة.'
                : user.status === 'active'
                  ? 'الحساب نشط الآن.'
                  : 'الحساب معطل ولا يستطيع الدخول.'
            }
          >
            <select
              value={form.status}
              disabled={isCreate || accessLocked}
              onChange={(event) => setForm({ ...form, status: event.target.value as AdminStatus })}
              title={rights?.lockReason ?? 'حالة الحساب'}
              className={`${inputTone(false)} cursor-pointer disabled:cursor-not-allowed`}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="pt-1 border-t border-muted-border/30 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-xs font-black text-heading">تخصيص الصلاحيات</h4>
              <p className="text-[10px] text-neutral-text/60 mt-0.5">
                اختيار الدور يعبّئ صلاحياته، ويمكنك تخصيصها بعد ذلك.
              </p>
            </div>
            {!accessLocked && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, permissions: permissionsFromRole(selectedRole) })}
                  disabled={!selectedRole}
                  title={selectedRole ? 'استعادة صلاحيات الدور' : 'اختر دوراً أولاً'}
                  className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  مطابقة الدور
                </button>
                <button
                  type="button"
                  onClick={() => setAllPermissions(!allPermissionsChecked)}
                  className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold cursor-pointer"
                >
                  {allPermissionsChecked ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </button>
              </div>
            )}
          </div>

          {groups.length === 0 ? (
            <p className="text-[11px] text-neutral-text/55">تعذر تحميل قائمة الصلاحيات، سيتم اعتماد صلاحيات الدور.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {groups.map((group) => (
                <fieldset
                  key={group.key}
                  disabled={accessLocked}
                  className="p-3 rounded-xl bg-canvas/60 border border-muted-border/30 disabled:opacity-70"
                >
                  <legend className="px-1 text-[11px] font-black text-heading">{group.label}</legend>
                  <div className="space-y-2">
                    {group.items.map((permission) => (
                      <label key={permission.key} className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.permissions[permission.key]}
                          onChange={(event) => togglePermission(permission.key, event.target.checked)}
                          className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0 disabled:cursor-not-allowed"
                        />
                        <span className="min-w-0">
                          <span className="block font-bold text-heading">{permission.labelAr}</span>
                          <span className="block text-[10px] text-neutral-text/60 leading-relaxed">
                            {permission.description}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )}

          {accessLocked && (
            <p className="flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{rights?.lockReason}</span>
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-border/30 bg-surface rounded-b-3xl">
        <p className="text-[10px] text-neutral-text/55 hidden sm:block">
          {isCreate
            ? 'سيتم إنشاء الحساب نشطاً بكلمة المرور المحددة.'
            : accessLocked
              ? 'لن تتغير الصلاحيات أو الدور أو الحالة على هذا الحساب.'
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
            {isCreate ? 'إضافة المستخدم' : 'حفظ التعديلات'}
          </button>
        </div>
      </div>
    </form>
  );
};
