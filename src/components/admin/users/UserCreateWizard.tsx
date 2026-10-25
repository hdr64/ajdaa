/**
 * 3-step wizard for creating a new user account.
 * Step 1: Account (name, email, phone)
 * Step 2: Role & permissions (role cards, department, permission summary, advanced grid)
 * Step 3: Password & review (password field, generator, policy checklist, status, review card)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { LoaderCircle, AlertCircle, User, ChevronLeft } from 'lucide-react';
import type { Role, Department, PermissionDef, AdminStatus, AdminPermissions } from '../../../types/admin';
import { AdminStorage, type AdminUserInput } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import {
  EMAIL_PATTERN,
  DEFAULT_ROLE_KEY,
  toAdminRole,
  ROLE_AR_LABELS,
  NO_DEPARTMENT,
  NO_DEPARTMENT_LABEL,
  PERMISSION_KEYS,
  emptyPermissions,
  permissionsFromRole,
  passwordPolicyError,
  generateSecurePassword,
} from './usersModel';
import { Stepper, type WizardStep } from './Stepper';
import { RoleCards } from './RoleCards';
import { PermissionSummary } from './PermissionSummary';
import { PermissionGrid } from './PermissionGrid';
import { PasswordField } from './PasswordField';

interface UserCreateWizardProps {
  roles: Role[];
  departments: Department[];
  permissions: PermissionDef[];
  canAssignSuperAdmin: boolean;
  showToast: (message: string) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

/** Step 1 choice: invite the user to pick their own password, or set one now. */
const MODE_OPTIONS: Array<{ value: 'invite' | 'create'; title: string; hint: string }> = [
  {
    value: 'invite',
    title: 'دعوة مستخدم',
    hint: 'يختار المستخدم كلمة مروره عبر رابط يُرسل إلى بريده',
  },
  {
    value: 'create',
    title: 'إنشاء مستخدم بكلمة مرور',
    hint: 'تحدد كلمة مرور الآن، ويؤكد المستخدم بريده لاحقاً',
  },
];

export const UserCreateWizard: React.FC<UserCreateWizardProps> = ({
  roles,
  departments,
  permissions,
  canAssignSuperAdmin,
  showToast,
  onClose,
  onSaved,
}) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set());
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverErrorStep, setServerErrorStep] = useState<WizardStep | null>(null);
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  // 'invite' lets the user choose their own password from an emailed link; 'create' keeps the admin-set-password flow.
  const [mode, setMode] = useState<'invite' | 'create'>('create');
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

  // Derived state
  const selectedRole = roles.find((r) => r.id === form.roleId) ?? null;
  const selectedDepartment = departments.find((d) => d.id === form.departmentId) ?? null;
  // Only super-admin accounts can be created active immediately; every other role starts pending.
  const selectedRoleIsSuperAdmin = selectedRole?.key === 'super_admin';
  const accountStatusLabel = selectedRoleIsSuperAdmin
    ? (form.status === 'active' ? 'نشط' : 'معطل')
    : 'بانتظار التفعيل';

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

  // Validation per step
  const validateStep = useCallback((stepToValidate: WizardStep): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (stepToValidate === 1) {
      if (form.name.trim() === '') errors.name = 'الاسم الكامل مطلوب';
      if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'أدخل بريداً إلكترونياً صحيحاً';
    }

    if (stepToValidate === 2) {
      if (!form.roleId) errors.roleId = 'يجب اختيار دور';
    }

    if (stepToValidate === 3) {
      // Invite mode has no admin-set password: the user picks one from the emailed link.
      if (mode === 'create') {
        const policyError = passwordPolicyError(form.password);
        if (policyError) errors.password = policyError;
      }
    }

    return errors;
  }, [form, mode]);

  // Check if step is valid
  const isStepValid = useCallback((stepToCheck: WizardStep): boolean => {
    return Object.keys(validateStep(stepToCheck)).length === 0;
  }, [validateStep]);

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
    const role = roles.find((r) => r.id === roleId) ?? null;
    setForm((prev) => ({
      ...prev,
      roleId,
      permissions: role ? permissionsFromRole(role) : prev.permissions,
    }));
  }, [roles]);

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
        // sent for invite mode or for a super-admin target (no mail goes to them).
        sendPasswordInEmail:
          mode === 'create' && !selectedRoleIsSuperAdmin ? form.sendPasswordInEmail : false,
        // Status is only meaningful for super admins; everyone else starts pending.
        ...(selectedRoleIsSuperAdmin ? { status: form.status } : {}),
      };

      const { mailSent } = await AdminStorage.createUser(input);

      if (mailSent === false) {
        await onSaved();
        onClose();
        showToast(
          mode === 'invite'
            ? 'تم إنشاء الحساب، لكن تعذّر إرسال بريد الدعوة. يمكنك إعادة الإرسال من قائمة المستخدمين'
            : 'تم إنشاء الحساب، لكن تعذّر إرسال بريد التفعيل. يمكنك إعادة الإرسال من قائمة المستخدمين'
        );
      } else {
        showToast(`تمت إضافة المستخدم ${form.name.trim()} بنجاح`);
        await onSaved();
        onClose();
      }
    } catch (error) {
      const message = getErrorMessage(error, 'تعذر حفظ بيانات المستخدم');
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
        if (hasInput && !window.confirm('لديك بيانات غير محفوظة. هل تريد إغلاق النافذة دون إنشاء الحساب؟')) {
          return;
        }
        onClose();
      }
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        if (!event.shiftKey && step < 3) {
          event.preventDefault();
          goNext();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [form, step, onClose, goNext]);

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
        <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">طريقة الإضافة</span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-label="طريقة الإضافة">
          {MODE_OPTIONS.map((option) => {
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
            الاسم الكامل <span className="text-red-500">*</span>
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
            placeholder="مثال: خالد المنصور"
            className={`w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition ${
              touchedFields.name && !form.name.trim() ? 'border-red-500/60' : 'border-muted-border/50 focus:border-accent'
            }`}
          />
          {touchedFields.name && !form.name.trim() && (
            <p id="name-error" role="alert" className="mt-1 text-[10px] font-bold text-red-500">
              الاسم الكامل مطلوب
            </p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
            البريد الإلكتروني <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            type="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            onBlur={() => setTouchedFields((prev) => ({ ...prev, email: true }))}
            aria-invalid={Boolean(touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()))}
            aria-describedby={touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()) ? 'email-error' : undefined}
            placeholder="name@ajdaa.sa"
            className={`w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition text-start ${
              touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()) ? 'border-red-500/60' : 'border-muted-border/50 focus:border-accent'
            }`}
          />
          {touchedFields.email && !EMAIL_PATTERN.test(form.email.trim()) && (
            <p id="email-error" role="alert" className="mt-1 text-[10px] font-bold text-red-500">
              أدخل بريداً إلكترونياً صحيحاً
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
          رقم الهاتف (اختياري)
        </label>
        <input
          id="phone"
          type="tel"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="+966 5X XXX XXXX"
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
        roles={roles}
        selectedRoleId={form.roleId}
        onSelect={handleRoleSelect}
        canAssignSuperAdmin={canAssignSuperAdmin}
      />

      <div>
        <label htmlFor="department" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
          القسم / الإدارة
        </label>
        <select
          id="department"
          value={form.departmentId}
          onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
          className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent cursor-pointer"
        >
          {departments.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.nameAr}
            </option>
          ))}
          <option value={NO_DEPARTMENT}>{NO_DEPARTMENT_LABEL}</option>
        </select>
        <p className="mt-1 text-[10px] text-neutral-text/55">«بدون قسم» للأعضاء غير المرتبطين بإدارة.</p>
      </div>

      <PermissionSummary role={selectedRole} permissions={permissions} />

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

  // Step 3: Password & Review
  const renderStep3 = () => (
    <div className="space-y-5" role="tabpanel" aria-labelledby="step3-label">
      {mode === 'invite' ? (
        <p className="text-[11px] text-neutral-text/60">
          سيصل المستخدم رابط دعوة على بريده ليختار كلمة مروره
        </p>
      ) : (
        <PasswordField
          value={form.password}
          onChange={(value) => setForm({ ...form, password: value })}
          error={serverErrorStep === 3 ? serverError ?? undefined : undefined}
          showPolicyChecklist={true}
          onGenerate={handleGeneratePassword}
          generatedPassword={form.generatedPassword}
          hint={<>14 حرفاً على الأقل، مع حرف ورقم، تُستخدم عند أول دخول للحساب.</>}
        />
      )}

      {mode === 'create' && !selectedRoleIsSuperAdmin && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendPasswordInEmail}
              onChange={(e) => setForm({ ...form, sendPasswordInEmail: e.target.checked })}
              className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0"
            />
            <span className="min-w-0 leading-relaxed">
              <span className="block font-bold text-heading">إرسال كلمة المرور في البريد الإلكتروني</span>
              <span className="block text-[10px] text-neutral-text/60">
                يُرسل كلمة المرور التي حددتها داخل بريد التفعيل. البريد ليس قناة آمنة — على المستخدم
                تغيير كلمة المرور بعد أول دخول.
              </span>
            </span>
          </label>
        </div>
      )}

      {/* حالة الحساب تُعرض لمدير عام فقط: هو الوحيد الذي يُنشأ نشطاً فوراً، وباقي الأدوار تبدأ بانتظار التفعيل. */}
      {selectedRoleIsSuperAdmin && (
        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1">حالة الحساب</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as AdminStatus })}
            className="w-full px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent cursor-pointer"
          >
            <option value="active">نشط</option>
            <option value="suspended">معطل</option>
          </select>
          <p className="mt-1 text-[10px] text-neutral-text/55">تُنشأ الحسابات الجديدة بحالة نشطة افتراضياً.</p>
        </div>
      )}

      {/* Review Card */}
      <div className="p-4 rounded-xl bg-canvas/60 border border-muted-border/30 space-y-3">
        <h4 className="text-xs font-black text-heading flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" />
          مراجعة الحساب
        </h4>
        <div className="space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-neutral-text/60">الاسم الكامل</span>
            <span className="font-bold text-heading">{form.name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">البريد الإلكتروني</span>
            <span className="font-bold text-heading text-start" dir="ltr">{form.email || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">الهاتف</span>
            <span className="font-bold text-heading text-start" dir="ltr">{form.phone || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">الدور</span>
            <span className="font-bold text-heading">{selectedRole?.nameAr || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">القسم</span>
            <span className="font-bold text-heading">{selectedDepartment?.nameAr || NO_DEPARTMENT_LABEL}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">عدد الصلاحيات</span>
            <span className="font-bold text-heading">
              {PERMISSION_KEYS.filter((k) => form.permissions[k]).length} من {PERMISSION_KEYS.length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-text/60">الحالة</span>
            <span className="font-bold text-heading">{accountStatusLabel}</span>
          </div>
        </div>
      </div>

      {!selectedRoleIsSuperAdmin && (
        <p className="text-[10px] text-neutral-text/55">
          {mode === 'invite'
            ? 'سيصل المستخدم رابط دعوة على بريده ليختار كلمة مروره.'
            : 'سيُفعَّل الحساب بعد أن يؤكد المستخدم بريده.'}
        </p>
      )}

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
        disabledSteps={new Set(
          [1, 2, 3].filter((s) => s > step && !completedSteps.has(s as WizardStep)) as WizardStep[]
        )}
      />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {currentStepContent}
      </div>

      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-muted-border/30 bg-surface rounded-b-3xl">
        <p className="text-[10px] text-neutral-text/55 hidden sm:block">
          سيتم إنشاء الحساب نشطاً بكلمة المرور المحددة.
        </p>
        <div className="flex items-center gap-2 ms-auto">
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={saving}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              رجوع
            </button>
          )}
          <button
            type={step === 3 ? 'submit' : 'button'}
            onClick={step < 3 ? goNext : undefined}
            disabled={saving || (step < 3 && !isStepValid(step))}
            className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
            {step === 3 ? 'إنشاء الحساب' : 'التالي'}
            {step < 3 && <ChevronLeft className="w-3.5 h-3.5" />}
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
