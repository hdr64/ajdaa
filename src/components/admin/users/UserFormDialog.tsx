/**
 * Create / edit dialog for an admin account.
 *
 * Create mode: 3-step wizard (UserCreateWizard).
 * Edit mode: tabbed dialog with 3 tabs (Account, Role & Access, Security).
 *
 * The dialog is fed `rights` (per-target rules incl. `lockReason`), `roles`,
 * `departments`, `permissions` (the server catalogue), `canAssignSuperAdmin`,
 * `referenceLoading/Error`, `onSaved`, `showToast`. All of these props and the
 * existing save logic (create vs update payloads, `changes` diff on edit,
 * `normalizePermissions` flow, error mapping from the server) must keep
 * working unchanged.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertCircle, LoaderCircle, RefreshCw, X, User, Shield, Lock, Key, CheckCircle2 } from 'lucide-react';
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
  STATUS_LABELS,
  STATUS_OPTIONS,
  SUPER_ADMIN_ROLE_KEY,
  passwordPolicyError,
  permissionsFromRole,
  toAdminRole,
} from './usersModel';
import type { UserRights } from './usersModel';
import { UserCreateWizard } from './UserCreateWizard';
import { RoleCards } from './RoleCards';
import { PermissionGrid } from './PermissionGrid';
import { PasswordField } from './PasswordField';
import { generateSecurePassword } from './usersModel';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const INPUT =
  'w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition focus:border-accent disabled:opacity-60 disabled:cursor-not-allowed';

const inputTone = (invalid: boolean): string =>
  invalid ? `${INPUT} border-red-500/60` : `${INPUT} border-muted-border/50`;

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
        className="relative w-full max-w-xl my-4 bg-surface rounded-3xl border border-muted-border/40 shadow-2xl"
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
        ) : user ? (
          <UserEditTabs
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
        ) : (
          <UserCreateWizard
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
 * Edit mode: tabbed dialog
 * ------------------------------------------------------------------ */

interface UserEditTabsProps {
  user: AdminUser;
  rights: UserRights | null;
  roles: Role[];
  departments: Department[];
  permissions: PermissionDef[];
  canAssignSuperAdmin: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type EditTab = 'account' | 'role' | 'security';

const TAB_CONFIG: { id: EditTab; label: string; icon: React.ReactNode }[] = [
  { id: 'account', label: 'الحساب', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'role', label: 'الدور والصلاحيات', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'security', label: 'الأمان', icon: <Lock className="w-3.5 h-3.5" /> },
];

const UserEditTabs: React.FC<UserEditTabsProps> = ({
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
  const accessLocked = rights?.accessLocked ?? false;
  const lockReason = rights?.lockReason ?? null;

  const { roleOptions, initialRoleId, defaultRole } = useMemo(() => {
    const idByKey = new Map(roles.map((role) => [role.key, role.id]));
    const options: { value: string; label: string; role: Role | null }[] = roles.map((role) => ({
      value: role.id,
      label: role.nameAr,
      role,
    }));
    const known = new Set(options.map((option) => option.value));
    const currentRoleId = user.roleId ?? idByKey.get(user.role) ?? user.role;
    if (!known.has(currentRoleId)) {
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
    const options: { value: string; label: string }[] = [
      ...departments.map((department) => ({ value: department.id, label: department.nameAr })),
      { value: NO_DEPARTMENT, label: NO_DEPARTMENT_LABEL },
    ];
    const known = new Set(options.map((option) => option.value));
    const current = user.departmentId ?? idByName.get((user.departmentName ?? user.department ?? '').trim()) ?? NO_DEPARTMENT;
    if (!known.has(current)) {
      options.splice(options.length - 1, 0, { value: current, label: user.departmentName || user.department });
    }
    return { departmentOptions: options, initialDepartmentId: current };
  }, [departments, user]);

  const [activeTab, setActiveTab] = useState<EditTab>('account');
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    roleId: string;
    departmentId: string;
    status: AdminStatus;
    permissions: AdminPermissions;
    password: string;
    replacePassword: boolean;
    generatedPassword: string;
  }>(() => ({
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    roleId: initialRoleId || (defaultRole?.id ?? ''),
    departmentId: initialDepartmentId,
    status: user.status,
    permissions: { ...user.permissions },
    password: '',
    replacePassword: false,
    generatedPassword: '',
  }));
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password', string>>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverErrorTab, setServerErrorTab] = useState<EditTab | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  // Track if form has changed
  const hasChanges = useMemo(() => {
    return (
      form.name !== user.name ||
      form.email !== user.email ||
      form.phone !== (user.phone ?? '') ||
      form.roleId !== initialRoleId ||
      form.departmentId !== initialDepartmentId ||
      form.status !== user.status ||
      form.replacePassword ||
      PERMISSION_KEYS.some((key) => form.permissions[key] !== user.permissions[key])
    );
  }, [form, user, initialRoleId, initialDepartmentId]);

  const selectedRoleOption = roleOptions.find((option) => option.value === form.roleId) ?? null;
  const selectedRole = selectedRoleOption?.role ?? null;

  const pickRole = (roleId: string) => {
    if (roleId === form.roleId) return;
    const role = roleOptions.find((option) => option.value === roleId)?.role ?? null;
    setForm((current) => ({
      ...current,
      roleId,
      permissions: role ? permissionsFromRole(role) : current.permissions,
    }));
  };

  const handleRestoreRolePermissions = () => {
    if (selectedRole) {
      setForm((current) => ({
        ...current,
        permissions: permissionsFromRole(selectedRole),
      }));
    }
  };

  const handleGeneratePassword = () => {
    const generated = generateSecurePassword();
    setForm((prev) => ({ ...prev, password: generated, generatedPassword: generated }));
  };

  const validate = (): Partial<Record<'name' | 'email' | 'password', string>> => {
    const found: Partial<Record<'name' | 'email' | 'password', string>> = {};
    if (form.name.trim() === '') found.name = 'الاسم الكامل مطلوب';
    if (!EMAIL_PATTERN.test(form.email.trim())) found.email = 'أدخل بريداً إلكترونياً صحيحاً';
    if (form.replacePassword) {
      const policyError = passwordPolicyError(form.password);
      if (policyError) found.password = policyError;
    }
    return found;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Switch to tab with error
      if (found.name || found.email) setActiveTab('account');
      else if (found.password) setActiveTab('security');
      return;
    }

    const roleKey: AdminRole = toAdminRole(
      selectedRole?.key ?? selectedRoleOption?.value,
      toAdminRole(user.role)
    );
    const roleAr =
      selectedRole?.nameAr ?? selectedRoleOption?.label ?? user.roleAr ?? ROLE_AR_LABELS[roleKey];
    const selectedRoleId = selectedRoleOption ? (selectedRole?.id ?? selectedRoleOption.value) : null;

    const departmentOption =
      departmentOptions.find((option) => option.value === form.departmentId) ?? null;
    const departmentId = departmentOption && departmentOption.value !== NO_DEPARTMENT ? departmentOption.value : null;
    const departmentName =
      departmentId === null ? null : departments.find((d) => d.id === departmentId)?.nameAr ?? departmentOption?.label ?? null;

    setSaving(true);
    setServerError(null);
    setServerErrorTab(null);

    try {
      const changes: Partial<AdminUserInput> = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        department: departmentName,
        departmentId,
      };

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
      await onSaved();
      onClose();
    } catch (error) {
      const message = getErrorMessage(error, 'تعذر حفظ بيانات المستخدم');
      showToast(message);

      // Map server errors to tabs
      const errorStr = error instanceof Error ? error.message : String(error);
      let targetTab: EditTab = 'account';
      if (errorStr.includes('email') || errorStr.includes('بريد') || errorStr.includes('already exists') || errorStr.includes('موجود')) {
        targetTab = 'account';
      } else if (errorStr.includes('password') || errorStr.includes('كلمة مرور') || errorStr.includes('weak') || errorStr.includes('ضعيف')) {
        targetTab = 'security';
      } else if (errorStr.includes('role') || errorStr.includes('دور') || errorStr.includes('permission') || errorStr.includes('صلاحية')) {
        targetTab = 'role';
      }
      setServerError(message);
      setServerErrorTab(targetTab);
      setActiveTab(targetTab);
    } finally {
      setSaving(false);
    }
  };

  // Unsaved changes guard
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('لديك تغييرات غير محفوظة. هل تريد إغلاق النافذة دون حفظ؟')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Keyboard: Escape to close (with guard)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const tabContent = activeTab === 'account' ? renderAccountTab() : activeTab === 'role' ? renderRoleTab() : renderSecurityTab();

  return (
    <form onSubmit={submit} className="flex flex-col max-h-[88vh]">
      {/* Tab bar */}
      <div className="flex border-b border-muted-border/30 px-6" role="tablist">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`${tab.id}-panel`}
            id={`${tab.id}-tab`}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-px
              ${activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral-text/60 hover:text-heading hover:border-muted-border/40'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5" role="tabpanel" id={`${activeTab}-panel`} aria-labelledby={`${activeTab}-tab`}>
        {tabContent}
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-border/30 bg-surface rounded-b-3xl">
        <p className="text-[10px] text-neutral-text/55 hidden sm:block">
          {accessLocked
            ? 'لن تتغير الصلاحيات أو الدور أو الحالة على هذا الحساب.'
            : 'تُحفظ التغييرات فوراً ويسجّل النظام من قام بها.'}
        </p>
        <div className="flex items-center gap-2 ms-auto">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={saving || !hasChanges || accessLocked}
            className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            حفظ التعديلات
          </button>
        </div>
      </div>
    </form>
  );

  function renderAccountTab() {
    return (
      <div className="space-y-5">
        {serverErrorTab === 'account' && serverError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-name" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
              الاسم الكامل <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => setTouchedFields((prev) => ({ ...prev, name: true }))}
              aria-invalid={Boolean(touchedFields.name && !form.name.trim())}
              placeholder="مثال: خالد المنصور"
              className={inputTone(touchedFields.name && !form.name.trim())}
            />
            {touchedFields.name && !form.name.trim() && (
              <p role="alert" className="mt-1 text-[10px] font-bold text-red-500">الاسم الكامل مطلوب</p>
            )}
          </div>

          <div>
            <label htmlFor="edit-email" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
              البريد الإلكتروني <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-email"
              type="email"
              dir="ltr"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouchedFields((prev) => ({ ...prev, email: true }))}
              aria-invalid={Boolean(touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()))}
              placeholder="name@ajdaa.sa"
              className={`${inputTone(touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()))} text-start`}
            />
            {touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()) && (
              <p role="alert" className="mt-1 text-[10px] font-bold text-red-500">أدخل بريداً إلكترونياً صحيحاً</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="edit-phone" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            رقم الهاتف
          </label>
          <input
            id="edit-phone"
            type="tel"
            dir="ltr"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+966 5X XXX XXXX"
            className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent text-start"
          />
        </div>
      </div>
    );
  }

  function renderRoleTab() {
    return (
      <div className="space-y-5">
        {serverErrorTab === 'role' && serverError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <RoleCards
          roles={roles}
          selectedRoleId={form.roleId}
          onSelect={pickRole}
          canAssignSuperAdmin={canAssignSuperAdmin}
          disabled={accessLocked}
        />

        <div>
          <label htmlFor="edit-department" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            القسم / الإدارة
          </label>
          <select
            id="edit-department"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            disabled={accessLocked}
            className={`${inputTone(false)} cursor-pointer disabled:cursor-not-allowed`}
          >
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {accessLocked && lockReason && (
            <p className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{lockReason}</span>
            </p>
          )}
        </div>

        <PermissionGrid
          permissions={form.permissions}
          onChange={(newPermissions) => setForm((prev) => ({ ...prev, permissions: newPermissions }))}
          role={selectedRole}
          allPermissions={permissions}
          accessLocked={accessLocked}
          lockReason={lockReason}
          showModifiedTag={selectedRole ? !isPermissionsEqual(form.permissions, permissionsFromRole(selectedRole)) : false}
          onRestoreRolePermissions={handleRestoreRolePermissions}
        />

        {accessLocked && lockReason && (
          <p className="flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{lockReason}</span>
          </p>
        )}
      </div>
    );
  }

  function renderSecurityTab() {
    const policyChecks = [
      { label: `${MIN_PASSWORD_LENGTH} أحرف على الأقل`, passed: form.password.length >= MIN_PASSWORD_LENGTH },
      { label: 'حرف واحد على الأقل', passed: /\p{L}/u.test(form.password) },
      { label: 'رقم واحد على الأقل', passed: /\d/.test(form.password) },
    ];
    const allPolicyPassed = policyChecks.every((c) => c.passed);

    return (
      <div className="space-y-5">
        {serverErrorTab === 'security' && serverError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{serverError}</span>
          </div>
        )}

        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">حالة الحساب</label>
          {user.status === 'pending' ? (
            <>
              {/* A pending account cannot be activated from here: it leaves
                  `pending` only by confirming the emailed link. */}
              <output className={`${inputTone(false)} flex items-center justify-between cursor-default`}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                  {STATUS_LABELS.pending}
                </span>
              </output>
              <p className="mt-1.5 text-[10px] text-amber-500 leading-relaxed">
                يُفعَّل الحساب تلقائياً بعد أن يؤكد المستخدم بريده الإلكتروني من الرابط المُرسل إليه.
              </p>
            </>
          ) : (
            <>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as AdminStatus })}
                disabled={accessLocked}
                className={`${inputTone(false)} cursor-pointer disabled:cursor-not-allowed`}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {accessLocked && lockReason && (
                <p className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{lockReason}</span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="pt-3 border-t border-muted-border/30">
          <label className="flex items-center gap-2 text-[11px] font-bold text-neutral-text/70 cursor-pointer">
            <input
              type="checkbox"
              checked={form.replacePassword}
              onChange={(e) => setForm({ ...form, replacePassword: e.target.checked })}
              className="w-3.5 h-3.5 rounded accent-accent"
            />
            تغيير كلمة المرور
          </label>
        </div>

        {form.replacePassword && (
          <PasswordField
            value={form.password}
            onChange={(value) => setForm({ ...form, password: value })}
            error={errors.password}
            showPolicyChecklist={true}
            onGenerate={handleGeneratePassword}
            generatedPassword={form.generatedPassword}
            hint={<>كلمة مرور جديدة بـ 14 حرفاً على الأقل، مع حرف ورقم.</>}
          />
        )}

        <div className="p-4 rounded-xl bg-canvas/60 border border-muted-border/30 space-y-3">
          <h4 className="text-xs font-black text-heading flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" />
            سياسة كلمة المرور
          </h4>
          <div className="space-y-1.5">
            {policyChecks.map((check) => (
              <div key={check.label} className="flex items-center gap-1.5 text-[10px]">
                {check.passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className={check.passed ? 'text-emerald-600' : 'text-neutral-text/60'}>
                  {check.label}
                </span>
              </div>
            ))}
            {form.replacePassword && form.password.length > 0 && allPolicyPassed && (
              <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                كلمة المرور تفي بالسياسة
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
};

// Helper to compare permissions
function isPermissionsEqual(a: AdminPermissions, b: AdminPermissions): boolean {
  return PERMISSION_KEYS.every((key) => a[key] === b[key]);
}