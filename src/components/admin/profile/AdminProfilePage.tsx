import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Save,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  RotateCw,
  X,
} from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useLanguage } from '../../../hooks/useLanguage';
import { passwordPolicyError } from '../users/usersModel';
import { ConfirmChoicesCard } from './ConfirmChoicesCard';
import { AuthenticatorTotpCard } from './AuthenticatorTotpCard';

export const AdminProfilePage: React.FC = () => {
  const { currentUser, setCurrentUser, refreshUser, showToast } = useAdmin();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  /* -------------------------- Card 1: Details -------------------------- */
  const [name, setName] = useState(currentUser?.name ?? '');
  const [email, setEmail] = useState(currentUser?.email ?? '');
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setPhone(currentUser.phone ?? '');
    }
  }, [currentUser]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setDetailsError(isAr ? 'يرجى إدخال الاسم' : 'Please enter your name');
      return;
    }

    if (!trimmedEmail) {
      setDetailsError(isAr ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter your email');
      return;
    }

    setDetailsSaving(true);
    try {
      const updatedUser = await AdminStorage.updateProfile({
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone || null,
      });
      setCurrentUser(updatedUser);
      void refreshUser();
      showToast(isAr ? 'تم حفظ التعديلات بنجاح' : 'Profile updated successfully');
    } catch (caught) {
      setDetailsError(getErrorMessage(caught, isAr ? 'تعذر حفظ البيانات' : 'Could not save profile details'));
    } finally {
      setDetailsSaving(false);
    }
  };

  /* ---------------------- Card 2: Change Password ---------------------- */
  /*
   * Super admins change their password in one step. Every other role must pass
   * a second step: the server emails a 6-digit code tied to a `challengeId`,
   * and the password is only replaced once that code is confirmed.
   */
  const isSuperAdmin = currentUser?.role === 'super_admin';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [passwordStep, setPasswordStep] = useState<'password' | 'code'>('password');
  const [challengeId, setChallengeId] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [code, setCode] = useState('');
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  // Waiting on the emailed code: the password fields stay editable, but the
  // pending challenge must not be re-issued by a repeated submit.
  const awaitingCode = !isSuperAdmin && passwordStep === 'code';

  // Only the second step needs a ticking timer; it is never mounted for super admins.
  useEffect(() => {
    if (!isSuperAdmin && passwordStep === 'code' && cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuperAdmin, passwordStep, cooldown]);

  const resetCodeStep = () => {
    setPasswordStep('password');
    setChallengeId('');
    setEmailHint('');
    setCode('');
    setCodeError(null);
    setCooldown(60);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError(isAr ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter your current password');
      return;
    }

    const policyErr = passwordPolicyError(newPassword, isAr);
    if (policyErr) {
      setPasswordError(policyErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(isAr ? 'كلمتا المرور الجديدتان غير متطابقتين' : 'New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    try {
      if (isSuperAdmin) {
        await AdminStorage.changePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast(isAr ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
      } else {
        // A resubmission while already waiting for a code is meaningless.
        if (passwordStep === 'password') {
          const challenge = await AdminStorage.requestPasswordChange(currentPassword, newPassword);
          setChallengeId(challenge.challengeId);
          setEmailHint(challenge.emailHint);
          setCode('');
          setCodeError(null);
          setCooldown(60);
          setPasswordStep('code');
        }
      }
    } catch (caught) {
      setPasswordError(getErrorMessage(caught, isAr ? 'تعذر تغيير كلمة المرور' : 'Could not change password'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleConfirmCodeChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);

    if (!challengeId) {
      setPasswordStep('password');
      return;
    }

    if (code.length < 6) {
      setCodeError(isAr ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام' : 'Please enter the 6-digit verification code');
      return;
    }

    setCodeSaving(true);
    try {
      await AdminStorage.changePassword(currentPassword, newPassword, { challengeId, code });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      resetCodeStep();
      showToast(isAr ? 'تم تغيير كلمة المرور بنجاح' : 'Password changed successfully');
    } catch (caught) {
      setCodeError(
        getErrorMessage(
          caught,
          isAr ? 'رمز التحقق غير صحيح أو منتهي الصلاحية' : 'Invalid or expired verification code'
        )
      );
    } finally {
      setCodeSaving(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || resending || passwordSaving) return;
    setResending(true);
    try {
      // Reissuing the code also rotates the challenge the old code was bound to.
      const challenge = await AdminStorage.requestPasswordChange(currentPassword, newPassword);
      setChallengeId(challenge.challengeId);
      setEmailHint(challenge.emailHint);
      setCodeError(null);
      setCooldown(60);
    } catch (caught) {
      setCodeError(
        getErrorMessage(caught, isAr ? 'تعذر إعادة إرسال الرمز، يرجى الانتظار قليلاً' : 'Could not resend code, please wait')
      );
    } finally {
      setResending(false);
    }
  };

  const handleBackToPasswordStep = () => {
    // Leaves the password values untouched: they are still needed to re-issue the code.
    setCodeError(null);
    setPasswordStep('password');
  };

  /**
   * Editing any password field invalidates the pending challenge: the code was
   * issued for the previous pair, so the second step has to start over.
   */
  const invalidatePendingChallenge = () => {
    if (!isSuperAdmin && passwordStep === 'code') {
      resetCodeStep();
    }
  };

  /* -------------------- Card 3: Two-Step Login OTP -------------------- */
  const otpEnabled = Boolean(currentUser?.loginOtpEnabled);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [dialogPassword, setDialogPassword] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const handleOpenOtpDialog = () => {
    setDialogPassword('');
    setDialogError(null);
    setOtpDialogOpen(true);
  };

  const handleConfirmOtpToggle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogPassword) {
      setDialogError(isAr ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter your current password');
      return;
    }

    setDialogLoading(true);
    setDialogError(null);

    const targetState = !otpEnabled;

    try {
      const result = await AdminStorage.setLoginOtp(targetState, dialogPassword);
      if (currentUser) {
        setCurrentUser({ ...currentUser, loginOtpEnabled: result.loginOtpEnabled });
      }
      void refreshUser();
      setOtpDialogOpen(false);
      setDialogPassword('');
      showToast(
        targetState
          ? isAr
            ? 'تم تفعيل التحقق بخطوتين بنجاح'
            : 'Two-step verification enabled successfully'
          : isAr
          ? 'تم تعطيل التحقق بخطوتين بنجاح'
          : 'Two-step verification disabled successfully'
      );
    } catch (caught) {
      setDialogError(
        getErrorMessage(
          caught,
          isAr ? 'تعذر تعديل إعدادات التحقق بخطوتين' : 'Could not update two-step verification settings'
        )
      );
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ------------------------- Card 1: Details ------------------------- */}
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-muted-border/30">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-heading">
              {isAr ? 'البيانات الشخصية' : 'Personal Details'}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {isAr ? 'تعديل اسم الحساب والبريد الإلكتروني ورقم الجوال' : 'Update your account name, email and phone'}
            </p>
          </div>
        </div>

        {detailsError && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{detailsError}</span>
          </div>
        )}

        <form onSubmit={handleSaveDetails} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'الاسم الكامل' : 'Full Name'}
              </label>
              <div className="relative flex items-center">
                <User className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={isAr ? 'الاسم' : 'Name'}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
              {isAr ? 'رقم الجوال (اختياري)' : 'Phone Number (Optional)'}
            </label>
            <div className="relative flex items-center">
              <Phone className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+966 5X XXX XXXX"
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={detailsSaving}
              className="brand-btn-primary font-black px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm text-xs disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{detailsSaving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ التعديلات' : 'Save Details'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* --------------------- Card 2: Change Password --------------------- */}
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-muted-border/30">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-heading">
              {isAr ? 'تغيير كلمة المرور' : 'Change Password'}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {isAr ? 'تحديث كلمة المرور الخاصة بحسابك (10 أحرف على الأقل)' : 'Update your account password (at least 10 characters)'}
            </p>
          </div>
        </div>

        {passwordError && (
          <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
              {isAr ? 'كلمة المرور الحالية' : 'Current Password'}
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
              <input
                type="password"
                required
                dir="ltr"
                value={currentPassword}
                onChange={(e) => { invalidatePendingChallenge(); setCurrentPassword(e.target.value); }}
                placeholder="••••••••"
                className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'كلمة المرور الجديدة (8 أحرف كحد أدنى)' : 'New Password (min 8 chars)'}
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                <input
                  type="password"
                  required
                  dir="ltr"
                  value={newPassword}
                  onChange={(e) => { invalidatePendingChallenge(); setNewPassword(e.target.value); }}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                <input
                  type="password"
                  required
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(e) => { invalidatePendingChallenge(); setConfirmPassword(e.target.value); }}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={passwordSaving || awaitingCode || !currentPassword || !newPassword || !confirmPassword}
              className="brand-btn-primary font-black px-5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm text-xs disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>
                {passwordSaving
                  ? isAr
                    ? 'جاري الإرسال...'
                    : 'Sending...'
                  : awaitingCode
                    ? isAr
                      ? 'بانتظار رمز التحقق...'
                      : 'Awaiting code...'
                    : isSuperAdmin
                      ? isAr
                        ? 'تحديث كلمة المرور'
                        : 'Update Password'
                      : isAr
                        ? 'إرسال رمز التحقق'
                        : 'Send Verification Code'}
              </span>
            </button>
          </div>
        </form>

        {/* Second step: confirm the emailed code (super admins never reach it) */}
        {awaitingCode && (
          <div className="mt-5 pt-5 border-t border-muted-border/30 space-y-4">
            <p className="text-xs text-neutral-text/70 leading-relaxed">
              {isAr ? `أدخل الرمز المرسل إلى ` : `Enter the code sent to `}
              <span className="font-mono font-bold text-heading inline-block" dir="ltr">{emailHint}</span>
            </p>

            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
                {isAr ? 'رمز التحقق (6 أرقام)' : 'Verification Code (6 digits)'}
              </label>
              <input
                type="text"
                required
                autoFocus
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full py-3.5 px-4 rounded-xl bg-canvas border border-muted-border/50 text-xl font-mono text-center tracking-[0.5em] text-heading outline-none focus:border-accent"
              />
            </div>

            {codeError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{codeError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleConfirmCodeChange}
              disabled={codeSaving || code.length < 6}
              className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{codeSaving ? (isAr ? 'جاري التأكيد...' : 'Confirming...') : isAr ? 'تأكيد وتغيير كلمة المرور' : 'Confirm & Change Password'}</span>
            </button>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={handleBackToPasswordStep}
                className="text-neutral-text/60 hover:text-heading font-bold cursor-pointer transition-colors"
              >
                {isAr ? 'رجوع' : 'Back'}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || resending || passwordSaving}
                className="text-accent hover:underline disabled:text-neutral-text/40 disabled:no-underline font-bold cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? (
                  <span>{isAr ? `إعادة الإرسال بعد ${cooldown} ثانية` : `Resend code in ${cooldown}s`}</span>
                ) : (
                  <span>{isAr ? 'إعادة إرسال الرمز' : 'Resend Code'}</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* -------------------- Card 3: Two-Step Login OTP ------------------- */}
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-muted-border/30">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-heading">
              {isAr ? 'التحقق بخطوتين (رمز البريد الإلكتروني)' : 'Two-Step Verification (Email Code)'}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {isAr
                ? 'تعزيز أمان الحساب بطلب رمز تحقق مؤقت يُرسل للبريد عند تسجيل الدخول'
                : 'Enhance account security by requiring a one-time email code on sign-in'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-canvas border border-muted-border/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                otpEnabled
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                  : 'bg-neutral-text/10 text-neutral-text/60 border border-muted-border/30'
              }`}
            >
              {otpEnabled ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-heading">
                  {isAr ? 'حالة التحقق بخطوتين:' : 'Two-Step Status:'}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    otpEnabled
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  }`}
                >
                  {otpEnabled ? (isAr ? 'مفعل' : 'Enabled') : isAr ? 'معطل' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/60 mt-0.5">
                {otpEnabled
                  ? isAr
                    ? 'يتم إرسال رمز تحقق مؤقت إلى بريدك الإلكتروني عند كل عملية تسجيل دخول.'
                    : 'A 6-digit verification code is sent to your email on each login attempt.'
                  : isAr
                  ? 'تسجيل الدخول يتم بكلمة المرور فقط دون طلب رمز تأكيد.'
                  : 'Login requires only your password without an additional verification code.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenOtpDialog}
            className={`cursor-pointer text-xs font-bold px-4 py-2 rounded-xl transition-all shrink-0 ${
              otpEnabled
                ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
                : 'brand-btn-primary shadow-sm'
            }`}
          >
            {otpEnabled ? (isAr ? 'إلغاء التفعيل' : 'Disable') : isAr ? 'تفعيل الآن' : 'Enable Now'}
          </button>
        </div>
      </div>

      {/* --------------- Card 4: Two-Step Authenticator App --------------- */}
      <AuthenticatorTotpCard isAr={isAr} />

      <ConfirmChoicesCard isAr={isAr} />

      {/* ---------------- Password Confirmation Dialog ---------------- */}
      {otpDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <h3 className="text-sm font-black text-heading">
                {otpEnabled
                  ? isAr
                    ? 'إلغاء تفعيل التحقق بخطوتين'
                    : 'Disable Two-Step Verification'
                  : isAr
                  ? 'تفعيل التحقق بخطوتين'
                  : 'Enable Two-Step Verification'}
              </h3>
              <button
                type="button"
                onClick={() => setOtpDialogOpen(false)}
                className="p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-text/70 leading-relaxed">
              {isAr
                ? 'لأسباب أمنية، يرجى إدخال كلمة المرور الحالية لتأكيد هذا الإجراء:'
                : 'For security reasons, please enter your current password to confirm this action:'}
            </p>

            {dialogError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{dialogError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmOtpToggle} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                  {isAr ? 'كلمة المرور الحالية' : 'Current Password'}
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                  <input
                    type="password"
                    required
                    autoFocus
                    dir="ltr"
                    value={dialogPassword}
                    onChange={(e) => setDialogPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setOtpDialogOpen(false)}
                  className="px-4 py-2 rounded-xl border border-muted-border/40 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={dialogLoading || !dialogPassword}
                  className={`px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm disabled:opacity-50 ${
                    otpEnabled
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'brand-btn-primary'
                  }`}
                >
                  {dialogLoading
                    ? isAr
                      ? 'جاري التحقق...'
                      : 'Verifying...'
                    : otpEnabled
                    ? isAr
                      ? 'تأكيد الإلغاء'
                      : 'Confirm Disable'
                    : isAr
                    ? 'تأكيد التفعيل'
                    : 'Confirm Enable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
