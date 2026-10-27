/**
 * 3-step wizard for creating a new user account.
 * Step 1: Account (name, email, phone)
 * Step 2: Role & permissions (role cards, department, permission summary, advanced grid)
 * Step 3: Password & review (password field, generator, policy checklist, status, review card)
 */
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { LoaderCircle, AlertCircle, User, ChevronLeft, Briefcase, Mail, KeyRound, Check } from 'lucide-react';
import type { Role, Department, PermissionDef, AdminStatus, AdminPermissions } from '../../../types/admin';
import { AdminStorage, type AdminUserInput } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import {
  EMAIL_PATTERN,
  DEFAULT_ROLE_KEY,
  toAdminRole,
  ROLE_AR_LABELS,
  NO_DEPARTMENT,
  PERMISSION_KEYS,
  emptyPermissions,
  permissionsFromRole,
  passwordPolicyError,
  generateSecurePassword,
} from './usersModel';
import { Stepper, type WizardStep } from './Stepper';
import { RoleCards } from './RoleCards';
import { PermissionGrid } from './PermissionGrid';
import { PasswordField } from './PasswordField';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface UserCreateWizardProps {
  roles: Role[];
  departments: Department[];
  permissions: PermissionDef[];
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export const UserCreateWizard: React.FC<UserCreateWizardProps> = ({
  roles,
  departments,
  permissions,
  showToast,
  onClose,
  onSaved,
}) => {
  const { t, language } = useAdminT();
  const isEn = language === 'en';
  const isAr = language === 'ar';

  const modeOptions: Array<{ value: 'invite' | 'create'; title: string; hint: string }> = [
    {
      value: 'invite',
      title: t('users.modeInviteTitle'),
      hint: t('users.modeInviteHint'),
    },
    {
      value: 'create',
      title: t('users.modeCreateTitle'),
      hint: t('users.modeCreateHint'),
    },
  ];

  const [step, setStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverErrorStep, setServerErrorStep] = useState<WizardStep | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  // Default to 'invite' (safer default: user sets own password from emailed link)
  const [mode, setMode] = useState<'invite' | 'create'>('invite');
  const [duplicateEmailError, setDuplicateEmailError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [form, setForm] = useState<{
    name: string;
    email: string;
    phone: string;
    roleId: string;
    departmentId: string;
    password: string;
    generatedPassword: string;
    status: AdminStatus;
    permissions: AdminPermissions;
    sendPasswordInEmail: boolean;
  }>({
    name: '',
    email: '',
    phone: '',
    roleId: '',
    departmentId: NO_DEPARTMENT,
    password: '',
    generatedPassword: '',
    status: 'active',
    permissions: emptyPermissions(),
    sendPasswordInEmail: false,
  });

  // No one can create new super admin accounts
  const assignableRoles = useMemo(() => {
    return roles.filter((r) => r.key !== 'super_admin');
  }, [roles]);

  // Derived state
  const selectedRole = assignableRoles.find((r) => r.id === form.roleId) ?? null;
  const selectedDepartment = departments.find((d) => d.id === form.departmentId) ?? null;
  const accountStatusLabel = t('users.statusPending');

  // Focus first input on step change
  useEffect(() => {
    firstInputRef.current?.focus();
  }, [step]);

  // Update completed steps
  useEffect(() => {
    const newCompleted = new Set<WizardStep>();
    if (step > 1) newCompleted.add(1);
    if (step > 2) newCompleted.add(2);
    setCompletedSteps(newCompleted);
  }, [step]);

  // Check email uniqueness on blur
  const handleEmailBlur = async () => {
    setTouchedFields((prev) => ({ ...prev, email: true }));
    const trimmed = form.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setDuplicateEmailError(null);
      return;
    }
    try {
      const allUsers = await AdminStorage.getUsers();
      const exists = allUsers.some((u) => u.email.toLowerCase() === trimmed);
      if (exists) {
        setDuplicateEmailError(
          isEn
            ? 'This email address is already registered to another user.'
            : 'هذا البريد الإلكتروني مسجل مسبقاً لمستخدم آخر.'
        );
      } else {
        setDuplicateEmailError(null);
      }
    } catch {
      // Ignore background check failure
    }
  };

  // Validation per step
  const validateStep = useCallback((stepToValidate: WizardStep): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (stepToValidate === 1) {
      if (form.name.trim() === '') errors.name = t('users.valNameRequired');
      if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = t('users.valEmailInvalid');
      else if (duplicateEmailError) errors.email = duplicateEmailError;
    }

    if (stepToValidate === 2) {
      if (!form.roleId) errors.roleId = t('users.valRoleRequired');
      else if (selectedRole?.key === 'super_admin') {
        errors.roleId = isEn ? 'Super Admin accounts cannot be created' : 'لا يمكن إنشاء حساب مدير عام جديد';
      }
    }

    if (stepToValidate === 3) {
      // Invite mode has no admin-set password: the user picks one from the emailed link.
      if (mode === 'create') {
        const policyError = passwordPolicyError(form.password, isAr);
        if (policyError) errors.password = policyError;
      }
    }

    return errors;
  }, [form, mode, isAr, isEn, selectedRole?.key, t, duplicateEmailError]);

  // Check if step is valid
  const isStepValid = useCallback((stepToCheck: WizardStep): boolean => {
    return Object.keys(validateStep(stepToCheck)).length === 0;
  }, [validateStep]);

  // Dynamic helper text for footer
  const stepHint = useMemo(() => {
    if (step === 1) {
      if (!form.name.trim()) return isEn ? 'Enter the full name to continue' : 'أدخل الاسم الثلاثي للمتابعة';
      if (!EMAIL_PATTERN.test(form.email.trim())) return isEn ? 'Enter a valid email address to continue' : 'أدخل بريداً إلكترونياً صحيحاً للمتابعة';
      if (duplicateEmailError) return duplicateEmailError;
      return isEn ? 'Step 1 of 3: Account information' : 'الخطوة 1 من 3: البيانات الأساسية للحساب';
    }
    if (step === 2) {
      if (!form.roleId) return isEn ? 'Choose a role to continue' : 'اختر دوراً وظيفياً للمتابعة';
      return isEn ? 'Step 2 of 3: Role & permissions' : 'الخطوة 2 من 3: الدور الوظيفي والصلاحيات';
    }
    if (step === 3) {
      if (mode === 'create' && !form.password) return isEn ? 'Enter a password meeting policy' : 'أدخل كلمة مرور مطابقة لسياسة الأمان';
      return mode === 'invite'
        ? (isEn ? 'Review details and click Send Invitation' : 'راجع البيانات ثم انقر على إرسال رابط الدعوة')
        : (isEn ? 'Review details and click Create Account' : 'راجع البيانات ثم انقر على إنشاء الحساب');
    }
    return '';
  }, [step, form.name, form.email, form.roleId, form.password, mode, duplicateEmailError, isEn]);

  // Handle next/back
  const goNext = useCallback(() => {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      // Mark fields as touched to show errors
      Object.keys(errors).forEach((key) => setTouchedFields((prev) => ({ ...prev, [key]: true })));
      return;
    }
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  }, [step, validateStep]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }, [step]);

  const goToStep = (targetStep: WizardStep) => {
    if (targetStep <= step || completedSteps.has(targetStep)) {
      setStep(targetStep);
    }
  };

  // Handle role selection
  const handleRoleSelect = useCallback((roleId: string) => {
    const role = assignableRoles.find((r) => r.id === roleId) ?? null;
    if (!role || role.key === 'super_admin') return;
    setForm((prev) => ({
      ...prev,
      roleId,
      permissions: permissionsFromRole(role),
    }));
  }, [assignableRoles]);

  // Handle permission change
  const handlePermissionChange = useCallback((newPermissions: AdminPermissions) => {
    setForm((prev) => ({ ...prev, permissions: newPermissions }));
  }, []);

  // Handle restore role permissions
  const handleRestoreRolePermissions = useCallback(() => {
    if (selectedRole) {
      setForm((prev) => ({
        ...prev,
        permissions: permissionsFromRole(selectedRole),
      }));
    }
  }, [selectedRole]);

  // Handle password generation
  const handleGeneratePassword = useCallback(() => {
    const generated = generateSecurePassword();
    setForm((prev) => ({ ...prev, password: generated, generatedPassword: generated }));
  }, []);

  // Submit handler
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // STRICT GUARD: Must be on Step 3 to create a user!
    // If Enter was pressed or continue was clicked while on Step 1 or 2, advance to next step only.
    if (step < 3) {
      goNext();
      return;
    }

    // Validate all steps
    const allErrors: Record<string, string> = {};
    for (let s = 1; s <= 3; s++) {
      Object.assign(allErrors, validateStep(s as WizardStep));
    }
    if (Object.keys(allErrors).length > 0) {
      // Go to first invalid step
      for (let s = 1; s <= 3; s++) {
        if (Object.keys(validateStep(s as WizardStep)).length > 0) {
          setStep(s as WizardStep);
          break;
        }
      }
      return;
    }

    setSaving(true);
    setServerError(null);
    setServerErrorStep(null);

    try {
      const roleKey = toAdminRole(selectedRole?.key, DEFAULT_ROLE_KEY);
      const roleAr = selectedRole?.nameAr ?? ROLE_AR_LABELS[roleKey];
      const selectedRoleId = selectedRole?.id ?? null;

      const departmentOption =
        departments.find((option) => option.id === form.departmentId) ?? null;
      const departmentId = departmentOption && departmentOption.id !== NO_DEPARTMENT ? departmentOption.id : null;
      const departmentName =
        departmentId === null ? null : departments.find((d) => d.id === departmentId)?.nameAr ?? departmentOption?.nameAr ?? null;

      const input: AdminUserInput = {
        name: form.name.trim(),
        email: form.email.trim(),
        // 'invite' sends no password: the emailed link lets the user choose one.
        mode,
        password: mode === 'invite' ? undefined : form.password,
        phone: form.phone.trim() || null,
        role: roleKey,
        roleAr,
        roleId: selectedRoleId,
        department: departmentName,
        departmentId,
        permissions: form.permissions,
        // Create mode only: email the typed password in a separated block. Never
        // sent for invite mode.
        sendPasswordInEmail: mode === 'create' ? form.sendPasswordInEmail : false,
      };

      const { mailSent } = await AdminStorage.createUser(input);

      if (mailSent === false) {
        await onSaved();
        onClose();
        showToast(
          mode === 'invite'
            ? t('users.mailSentFailedInvite')
            : t('users.mailSentFailedActivation')
        );
      } else {
        showToast(t('users.createdSuccess', { name: form.name.trim() }));
        await onSaved();
        onClose();
      }
    } catch (error) {
      const message = getErrorMessage(error, t('users.toastSaveError'));
      showToast(message);

      // Map server errors to steps
      const errorStr = error instanceof Error ? error.message : String(error);
      let targetStep: WizardStep = 1;
      if (errorStr.includes('email') || errorStr.includes('بريد') || errorStr.includes('already exists') || errorStr.includes('موجود')) {
        targetStep = 1;
      } else if (errorStr.includes('password') || errorStr.includes('كلمة مرور') || errorStr.includes('weak') || errorStr.includes('ضعيف')) {
        targetStep = 3;
      }
      setServerError(message);
      setServerErrorStep(targetStep);
      setStep(targetStep);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Check if user typed something
        const hasInput = form.name || form.email || form.phone || form.password;
        if (hasInput && !window.confirm(t('users.confirmUnsaved'))) {
          return;
        }
        onClose();
      }
      if (event.key === 'Enter') {
        // Prevent accidental form submission on enter key
        if (step < 3) {
          event.preventDefault();
          goNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form, step, onClose, goNext, t]);

  // Clear password on close
  useEffect(() => {
    return () => {
      // Password is only in state, not persisted
    };
  }, []);

  // Step 1: Account
  const renderStep1 = () => (
    <div className="space-y-5" role="tabpanel" aria-labelledby="step1-label">
      <div>
        <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">
          {t('users.creationMethod')}
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label={t('users.creationMethod')}>
          {modeOptions.map((option) => {
            const isActive = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => setMode(option.value)}
                className={`p-3 rounded-xl border-2 text-start transition-all cursor-pointer ${
                  isActive
                    ? 'border-accent bg-accent/5 shadow-sm shadow-accent/10'
                    : 'border-muted-border/40 bg-surface hover:border-accent/40 hover:bg-accent/5'
                }`}
              >
                <span className="block text-xs font-black text-heading">{option.title}</span>
                <span className="block text-[10px] text-neutral-text/60 mt-0.5">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            {t('users.fieldName')} <span className="text-red-500">*</span>
          </label>
          <input
            ref={firstInputRef}
            id="name"
            type="text"
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => setTouchedFields((prev) => ({ ...prev, name: true }))}
            aria-invalid={Boolean(touchedFields.name && !form.name.trim())}
            aria-describedby={touchedFields.name && !form.name.trim() ? 'name-error' : undefined}
            placeholder={t('users.fieldNamePlaceholder')}
            className={`w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition ${
              touchedFields.name && !form.name.trim() ? 'border-red-500/60' : 'border-muted-border/50 focus:border-accent'
            }`}
          />
          {touchedFields.name && !form.name.trim() && (
            <p id="name-error" role="alert" className="mt-1 text-[10px] font-bold text-red-500">
              {t('users.valNameRequired')}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            {t('users.fieldEmail')} <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => {
              setForm({ ...form, email: e.target.value });
              if (duplicateEmailError) setDuplicateEmailError(null);
            }}
            onBlur={handleEmailBlur}
            aria-invalid={Boolean((touchedFields.email && !EMAIL_PATTERN.test(form.email.trim())) || duplicateEmailError)}
            aria-describedby={
              (touchedFields.email && !EMAIL_PATTERN.test(form.email.trim())) || duplicateEmailError
                ? 'email-error'
                : undefined
            }
            placeholder={t('users.fieldEmailPlaceholder')}
            className={`w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition text-start ${
              (touchedFields.email && !EMAIL_PATTERN.test(form.email.trim())) || duplicateEmailError
                ? 'border-red-500/60'
                : 'border-muted-border/50 focus:border-accent'
            }`}
          />
          {((touchedFields.email && !EMAIL_PATTERN.test(form.email.trim())) || duplicateEmailError) && (
            <p id="email-error" role="alert" className="mt-1 text-[10px] font-bold text-red-500">
              {duplicateEmailError || t('users.valEmailInvalid')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
          {t('users.fieldPhone')}
        </label>
        <input
          id="phone"
          type="tel"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder={t('users.fieldPhonePlaceholder')}
          className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent text-start"
        />
      </div>

      {serverErrorStep === 1 && serverError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}
    </div>
  );

  // Step 2: Role & Permissions
  const renderStep2 = () => (
    <div className="space-y-5" role="tabpanel" aria-labelledby="step2-label">
      <RoleCards
        roles={assignableRoles}
        selectedRoleId={form.roleId}
        onSelect={handleRoleSelect}
        canAssignSuperAdmin={false}
      />

      {/* Department Selector Card */}
      <div className="p-3.5 rounded-2xl bg-canvas/60 border border-muted-border/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent shrink-0" />
            <label htmlFor="department" className="text-xs font-black text-heading">
              {t('users.fieldDepartment')}
            </label>
          </div>
          <p className="text-[10px] text-neutral-text/60 mt-0.5">
            {t('users.noDeptHint')}
          </p>
        </div>
        <div className="sm:w-64 shrink-0">
          <select
            id="department"
            value={form.departmentId}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-surface border border-muted-border/50 text-xs font-bold text-heading outline-none focus:border-accent cursor-pointer transition-all shadow-xs"
          >
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {isEn && dept.nameEn ? dept.nameEn : dept.nameAr}
              </option>
            ))}
            <option value={NO_DEPARTMENT}>{t('users.noDepartment')}</option>
          </select>
        </div>
      </div>

      <PermissionGrid
        permissions={form.permissions}
        onChange={handlePermissionChange}
        role={selectedRole}
        allPermissions={permissions}
        accessLocked={false}
        showModifiedTag={selectedRole ? !isPermissionsEqual(form.permissions, permissionsFromRole(selectedRole)) : false}
        onRestoreRolePermissions={handleRestoreRolePermissions}
      />

      {serverErrorStep === 2 && serverError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}
    </div>
  );

  // Step 3: Password / Invite & Review
  const renderStep3 = () => (
    <div className="space-y-5" role="tabpanel" aria-labelledby="step3-label">
      {/* Account Setup Method Switcher: Send Invitation vs Set Password */}
      <div>
        <label className="block text-xs font-black text-heading mb-2">
          {isEn ? 'Account Setup & Access Method' : 'طريقة إعداد الحساب وتسجيل الدخول'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t('users.creationMethod')}>
          {modeOptions.map((option) => {
            const isActive = mode === option.value;
            const Icon = option.value === 'invite' ? Mail : KeyRound;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setMode(option.value)}
                className={`p-3.5 rounded-2xl border-2 text-start transition-all cursor-pointer flex items-start gap-3 ${
                  isActive
                    ? 'border-accent bg-accent/5 shadow-sm shadow-accent/10 ring-2 ring-accent/20'
                    : 'border-muted-border/40 bg-surface hover:border-accent/40 hover:bg-accent/5'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    isActive ? 'bg-accent/15 border-accent/30 text-accent' : 'bg-canvas border-muted-border/30 text-neutral-text/60'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-black text-heading">{option.title}</span>
                    {isActive && (
                      <span className="w-4 h-4 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="block text-[10px] text-neutral-text/60 mt-1 leading-relaxed">{option.hint}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'invite' ? (
        <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-3 text-sky-700 dark:text-sky-300">
          <Mail className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold block">
              {isEn ? 'Invitation link will be emailed to the user' : 'سيتم إرسال رابط دعوة إلى بريد المستخدم'}
            </span>
            <span className="text-sky-700/80 dark:text-sky-300/80 text-[10px] mt-0.5 block">
              {isEn
                ? `An invitation will be sent to "${form.email || 'the user'}". They will click the link to choose and set their password upon first login.`
                : `سيتم إرسال رابط دعوة فوري إلى «${form.email || 'بريد المستخدم'}»، ليقوم باختيار وتعيين كلمة مروره بنفسه عند أول تسجيل دخول.`}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-3.5 rounded-2xl bg-canvas/60 border border-muted-border/30 space-y-3">
          <h4 className="text-xs font-black text-heading flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-accent" />
            {isEn ? 'Set Account Password' : 'تعيين كلمة مرور الحساب'}
          </h4>
          <PasswordField
            value={form.password}
            onChange={(value) => setForm({ ...form, password: value })}
            error={serverErrorStep === 3 ? serverError ?? undefined : undefined}
            showPolicyChecklist={true}
            onGenerate={handleGeneratePassword}
            generatedPassword={form.generatedPassword}
            hint={<>{t('users.newPasswordHint')}</>}
          />
        </div>
      )}

      {mode === 'create' && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendPasswordInEmail}
              onChange={(e) => setForm({ ...form, sendPasswordInEmail: e.target.checked })}
              className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0"
            />
            <span className="min-w-0 leading-relaxed">
              <span className="block font-bold text-heading">{t('users.sendPasswordEmail')}</span>
              <span className="block text-[10px] text-neutral-text/60">
                {t('users.sendPasswordEmailNotice')}
              </span>
            </span>
          </label>
        </div>
      )}

      {/* Review Card */}
      <div className="p-4 rounded-xl bg-canvas/60 border border-muted-border/30 space-y-3">
        <h4 className="text-xs font-black text-heading flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          {t('users.accountReview')}
        </h4>
        <div className="space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.fieldName')}</span>
            <span className="font-bold text-heading">{form.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.fieldEmail')}</span>
            <span className="font-bold text-heading text-start" dir="ltr">{form.email || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.fieldPhone')}</span>
            <span className="font-bold text-heading text-start" dir="ltr">{form.phone || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.creationMethod')}</span>
            <span className="font-bold text-heading">
              {mode === 'invite' ? t('users.modeInviteTitle') : t('users.modeCreateTitle')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.fieldRole')}</span>
            <span className="font-bold text-heading">
              {(isEn && selectedRole?.nameEn ? selectedRole.nameEn : selectedRole?.nameAr) || '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.fieldDepartment')}</span>
            <span className="font-bold text-heading">
              {(isEn && selectedDepartment?.nameEn ? selectedDepartment.nameEn : selectedDepartment?.nameAr) || t('users.noDepartment')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.colPermissions')}</span>
            <span className="font-bold text-heading">
              {t('users.permissionsCountOf', {
                count: PERMISSION_KEYS.filter((k) => form.permissions[k]).length,
                total: PERMISSION_KEYS.length,
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">{t('users.colStatus')}</span>
            <span className="font-bold text-heading">{accountStatusLabel}</span>
          </div>
        </div>
      </div>

      {serverErrorStep === 3 && serverError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}
    </div>
  );

  const currentStepContent = step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
      <Stepper
        currentStep={step}
        completedSteps={completedSteps}
        onStepClick={goToStep}
        step3Label={
          mode === 'invite'
            ? (isEn ? 'Review & Invite' : 'مراجعة وإرسال الدعوة')
            : (isEn ? 'Password & Review' : 'كلمة المرور والمراجعة')
        }
        disabledSteps={new Set(
          [1, 2, 3].filter((s) => s > step && !completedSteps.has(s as WizardStep)) as WizardStep[]
        )}
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {currentStepContent}
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-border/30 bg-surface rounded-b-3xl">
        <div className={`text-[11px] font-medium hidden sm:flex items-center gap-1.5 ${!isStepValid(step) ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-neutral-text/60'}`}>
          {!isStepValid(step) && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          <span>{stepHint}</span>
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {t('users.back')}
            </button>
          )}
          <button
            type={step === 3 ? 'submit' : 'button'}
            onClick={step < 3 ? goNext : undefined}
            disabled={saving || (step < 3 && !isStepValid(step))}
            className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            {step === 3
              ? (mode === 'invite'
                  ? (isEn ? 'Send Invitation & Create Account' : 'إرسال رابط الدعوة وإنشاء الحساب')
                  : (isEn ? 'Create Account with Password' : 'إنشاء الحساب بكلمة المرور'))
              : t('users.next')}
            {step < 3 && <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />}
          </button>
        </div>
      </div>
    </form>
  );
};

// Helper to compare permissions
function isPermissionsEqual(a: AdminPermissions, b: AdminPermissions): boolean {
  return PERMISSION_KEYS.every((key) => a[key] === b[key]);
}
