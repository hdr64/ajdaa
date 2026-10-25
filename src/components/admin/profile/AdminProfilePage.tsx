import React, { useState, useEffect, useRef } from 'react';
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
  Camera,
  Trash2,
  Upload,
  Building2,
  Clock,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { passwordPolicyError } from '../users/usersModel';
import { ConfirmChoicesCard } from './ConfirmChoicesCard';
import { AuthenticatorTotpCard } from './AuthenticatorTotpCard';
import { PasskeysCard } from './PasskeysCard';

function initialsOf(name?: string): string {
  if (!name) return '…';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '…';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`;
}

export const AdminProfilePage: React.FC = () => {
  const { currentUser, setCurrentUser, refreshUser, showToast } = useAdmin();
  const { t, isAr } = useAdminT();

  /* -------------------------- Card 0: Avatar --------------------------- */
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError(t('profile.avatarErrorInvalid'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(t('profile.avatarErrorSize'));
      return;
    }

    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const updatedUser = await AdminStorage.uploadAvatar(file);
      setCurrentUser(updatedUser);
      void refreshUser();
      showToast(t('profile.avatarSuccess'));
    } catch (caught) {
      setAvatarError(getErrorMessage(caught, t('profile.avatarErrorUpload')));
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!currentUser?.avatar) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const updatedUser = await AdminStorage.deleteAvatar();
      setCurrentUser(updatedUser);
      void refreshUser();
      showToast(t('profile.avatarRemoved'));
    } catch (caught) {
      setAvatarError(getErrorMessage(caught, t('profile.avatarErrorRemove')));
    } finally {
      setAvatarUploading(false);
    }
  };

  const formatLastLogin = (dateStr?: string) => {
    if (!dateStr) return t('profile.neverLoggedIn');
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat(isAr ? 'ar-SA' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
    } catch {
      return dateStr;
    }
  };

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
      setDetailsError(t('profile.details.nameRequired'));
      return;
    }

    if (!trimmedEmail) {
      setDetailsError(t('profile.details.emailRequired'));
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
      showToast(t('profile.details.success'));
    } catch (caught) {
      setDetailsError(getErrorMessage(caught, t('profile.details.error')));
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
      setPasswordError(t('profile.password.currentRequired'));
      return;
    }

    const policyErr = passwordPolicyError(newPassword, isAr);
    if (policyErr) {
      setPasswordError(policyErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.password.mismatch'));
      return;
    }

    setPasswordSaving(true);
    try {
      if (isSuperAdmin) {
        await AdminStorage.changePassword(currentPassword, newPassword);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        showToast(t('profile.password.success'));
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
      setPasswordError(getErrorMessage(caught, t('profile.password.error')));
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
      setCodeError(t('profile.password.codeLengthError'));
      return;
    }

    setCodeSaving(true);
    try {
      await AdminStorage.changePassword(currentPassword, newPassword, { challengeId, code });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      resetCodeStep();
      showToast(t('profile.password.success'));
    } catch (caught) {
      setCodeError(getErrorMessage(caught, t('profile.password.codeInvalid')));
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
      setCodeError(getErrorMessage(caught, t('profile.password.resendError')));
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
      setDialogError(t('profile.password.currentRequired'));
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
      showToast(targetState ? t('profile.otp.enableSuccess') : t('profile.otp.disableSuccess'));
    } catch (caught) {
      setDialogError(getErrorMessage(caught, t('profile.otp.error')));
    } finally {
      setDialogLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ----------------- Card 0: Profile Hero & Avatar ----------------- */}
      <div className="rounded-3xl bg-surface border border-muted-border/40 overflow-hidden shadow-xs relative">
        {/* Subtle decorative banner header */}
        <div className="h-28 sm:h-36 bg-gradient-to-r from-accent/25 via-accent/10 to-transparent relative border-b border-muted-border/30 overflow-hidden">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute top-4 end-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface/85 backdrop-blur-xs border border-muted-border/50 text-heading shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t('profile.activeAccount')}
            </span>
          </div>
        </div>

        {/* Content row overlapping banner */}
        <div className="px-5 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 -mt-14 sm:-mt-16 mb-5">
            {/* Avatar container with hover overlay and upload */}
            <div className="relative group shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl overflow-hidden bg-surface border-4 border-surface shadow-md flex items-center justify-center relative">
                {currentUser?.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full brand-fill text-canvas font-black flex items-center justify-center text-3xl sm:text-4xl">
                    {initialsOf(currentUser?.name)}
                  </div>
                )}

                {/* Uploading spinner overlay */}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs gap-1">
                    <RotateCw className="w-6 h-6 animate-spin text-accent" />
                    <span>{t('profile.avatarUploading')}</span>
                  </div>
                )}

                {/* Hover trigger overlay button */}
                {!avatarUploading && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t('profile.changeAvatar')}
                    className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer"
                  >
                    <Camera className="w-6 h-6" />
                    <span className="text-[10px] font-bold">
                      {t('profile.changeAvatar')}
                    </span>
                  </button>
                )}
              </div>

              {/* Camera badge trigger on corner */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                aria-label={t('profile.uploadAvatar')}
                title={t('profile.changeAvatar')}
                className="absolute bottom-1 end-1 p-2 rounded-xl bg-accent text-canvas shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Profile text & badges */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-heading truncate">
                  {currentUser?.name ?? '—'}
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">
                  {currentUser?.roleAr ?? currentUser?.role ?? '—'}
                </span>
                {(currentUser?.departmentName || currentUser?.department) && (
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-muted-border/30 text-neutral-text/80 border border-muted-border/50 inline-flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-neutral-text/50" />
                    <span>{currentUser.departmentName || currentUser.department}</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-text/70">
                <div className="flex items-center gap-1.5 font-mono">
                  <Mail className="w-3.5 h-3.5 text-neutral-text/40" />
                  <span>{currentUser?.email}</span>
                </div>
                {currentUser?.phone && (
                  <div className="flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-neutral-text/40" />
                    <span dir="ltr">{currentUser.phone}</span>
                  </div>
                )}
                {currentUser?.lastLogin && (
                  <div className="flex items-center gap-1.5 text-neutral-text/50">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {t('profile.lastLoginLabel', { time: formatLastLogin(currentUser.lastLogin) })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Avatar management buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{t('profile.uploadAvatar')}</span>
              </button>

              {currentUser?.avatar && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  disabled={avatarUploading}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title={t('profile.removeAvatar')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('profile.removeAvatar')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Avatar upload error if any */}
          {avatarError && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}

          {/* Quick Security Status Strip */}
          <div className="mt-4 pt-4 border-t border-muted-border/30 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-canvas border border-muted-border/40">
              <div className="text-[10px] text-neutral-text/60 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                <span>{t('profile.statEmailOtp')}</span>
              </div>
              <div className="font-bold text-heading flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentUser?.loginOtpEnabled ? 'bg-emerald-500' : 'bg-neutral-text/30'
                  }`}
                />
                <span>
                  {currentUser?.loginOtpEnabled
                    ? t('profile.enabled')
                    : t('profile.disabled')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-canvas border border-muted-border/40">
              <div className="text-[10px] text-neutral-text/60 mb-1 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-accent" />
                <span>{t('profile.statTotp')}</span>
              </div>
              <div className="font-bold text-heading flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    currentUser?.totpEnabled ? 'bg-emerald-500' : 'bg-neutral-text/30'
                  }`}
                />
                <span>
                  {currentUser?.totpEnabled
                    ? t('profile.enabled')
                    : t('profile.disabled')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-canvas border border-muted-border/40">
              <div className="text-[10px] text-neutral-text/60 mb-1 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('profile.statPasskeys')}</span>
              </div>
              <div className="font-bold text-heading">
                {currentUser?.passkeyCount ?? 0}{' '}
                <span className="text-[10px] text-neutral-text/60 font-normal">
                  {t('profile.passkeysRegistered')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-canvas border border-muted-border/40">
              <div className="text-[10px] text-neutral-text/60 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent" />
                <span>{t('profile.statRole')}</span>
              </div>
              <div className="font-bold text-heading truncate">
                {currentUser?.roleAr ?? currentUser?.role ?? '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------- Card 1: Details ------------------------- */}
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-muted-border/30">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-heading">
              {t('profile.details.title')}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {t('profile.details.subtitle')}
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
                {t('profile.details.name')}
              </label>
              <div className="relative flex items-center">
                <User className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('profile.details.namePlaceholder')}
                  className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {t('profile.details.email')}
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
              {t('profile.details.phone')}
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
              <span>{detailsSaving ? t('profile.details.saving') : t('profile.details.save')}</span>
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
              {t('profile.password.title')}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {t('profile.password.subtitle')}
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
              {t('profile.password.current')}
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
                {t('profile.password.new')}
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
                {t('profile.password.confirm')}
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
                  ? t('profile.password.sending')
                  : awaitingCode
                    ? t('profile.password.awaitingCode')
                    : isSuperAdmin
                      ? t('profile.password.submit')
                      : t('profile.password.sendCode')}
              </span>
            </button>
          </div>
        </form>

        {/* Second step: confirm the emailed code (super admins never reach it) */}
        {awaitingCode && (
          <div className="mt-5 pt-5 border-t border-muted-border/30 space-y-4">
            <p className="text-xs text-neutral-text/70 leading-relaxed">
              {t('profile.password.codeNotice', { emailHint })}
            </p>

            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
                {t('profile.password.codeLabel')}
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
              <span>{codeSaving ? t('profile.password.verifying') : t('profile.password.confirmCode')}</span>
            </button>

            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <button
                type="button"
                onClick={handleBackToPasswordStep}
                className="text-neutral-text/60 hover:text-heading font-bold cursor-pointer transition-colors"
              >
                {t('profile.password.back')}
              </button>

              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || resending || passwordSaving}
                className="text-accent hover:underline disabled:text-neutral-text/40 disabled:no-underline font-bold cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? (
                  <span>{t('profile.password.resendIn', { seconds: String(cooldown) })}</span>
                ) : (
                  <span>{t('profile.password.resend')}</span>
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
              {t('profile.otp.title')}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {t('profile.otp.subtitle')}
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
                  {t('profile.otp.statusLabel')}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    otpEnabled
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  }`}
                >
                  {otpEnabled ? t('profile.enabled') : t('profile.disabled')}
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/60 mt-0.5">
                {otpEnabled ? t('profile.otp.enabledDesc') : t('profile.otp.disabledDesc')}
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
            {otpEnabled ? t('profile.otp.disableBtn') : t('profile.otp.enableBtn')}
          </button>
        </div>
      </div>

      {/* --------------- Card 4: Two-Step Authenticator App --------------- */}
      <AuthenticatorTotpCard isAr={isAr} />

      {/* --------------- Card 5: Passkeys (WebAuthn) --------------- */}
      <PasskeysCard isAr={isAr} />

      <ConfirmChoicesCard isAr={isAr} />

      {/* ---------------- Password Confirmation Dialog ---------------- */}
      {otpDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <h3 className="text-sm font-black text-heading">
                {otpEnabled ? t('profile.otp.dialogDisableTitle') : t('profile.otp.dialogEnableTitle')}
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
              {t('profile.otp.dialogPrompt')}
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
                  {t('profile.otp.dialogCurrentPassword')}
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
                  {t('profile.otp.dialogCancel')}
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
                    ? t('profile.password.verifying')
                    : otpEnabled
                    ? t('profile.otp.dialogConfirmDisable')
                    : t('profile.otp.dialogConfirmEnable')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
