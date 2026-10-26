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
  Fingerprint,
  Smartphone,
  Copy,
  Check,
} from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { passwordPolicyError } from '../users/usersModel';
import { ConfirmChoicesCard } from './ConfirmChoicesCard';
import { AuthenticatorTotpCard } from './AuthenticatorTotpCard';
import { PasskeysCard } from './PasskeysCard';

type ProfileTab = 'profile' | 'security' | 'preferences';

function initialsOf(name?: string): string {
  if (!name) return '…';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '…';
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`;
}

/**
 * Returns a clean, bidirectional-safe label for the user's role.
 * Avoids mixing English parentheses into Arabic text to eliminate bi-directional rendering glitches.
 */
function getRoleLabel(role?: string, roleAr?: string, isAr?: boolean): string {
  if (role === 'super_admin') {
    return isAr ? 'مدير عام النظام' : 'Super Admin';
  }
  if (role === 'project_manager') {
    return isAr ? 'مدير التطوير والمشاريع' : 'Project & Development Manager';
  }
  if (role === 'sales_agent') {
    return isAr ? 'مسؤول المبيعات' : 'Sales Agent';
  }
  if (role === 'viewer') {
    return isAr ? 'مشاهد فقط' : 'Viewer';
  }
  if (isAr) {
    if (roleAr) {
      // Strip any English in parentheses like " (Super Admin)"
      const cleanAr = roleAr.replace(/\s*\([^)]*\)/g, '').trim();
      return cleanAr || roleAr;
    }
    return role || '—';
  }
  return role ? role.replace(/_/g, ' ') : (roleAr || '—');
}

export const AdminProfilePage: React.FC = () => {
  const { currentUser, setCurrentUser, refreshUser, showToast } = useAdmin();
  const { t, isAr } = useAdminT();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [copiedId, setCopiedId] = useState(false);

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

  const handleCopyId = () => {
    if (!currentUser?.id) return;
    void navigator.clipboard.writeText(currentUser.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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

  const awaitingCode = !isSuperAdmin && passwordStep === 'code';

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
    setCodeError(null);
    setPasswordStep('password');
  };

  const invalidatePendingChallenge = () => {
    if (!isSuperAdmin && passwordStep === 'code') {
      resetCodeStep();
    }
  };

  /* -------------------- Card 3: Two-Step Login OTP -------------------- */
  const otpEnabled = Boolean(currentUser?.loginOtpEnabled);
  const totpEnabled = Boolean(currentUser?.totpEnabled);
  const passkeyCount = currentUser?.passkeyCount ?? 0;
  const isHighSecurity = otpEnabled || totpEnabled || passkeyCount > 0;

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'password' | 'code'>('password');
  const [dialogPassword, setDialogPassword] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState('');
  const [otpEmailHint, setOtpEmailHint] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [otpCooldown, setOtpCooldown] = useState(60);
  const [otpResending, setOtpResending] = useState(false);

  useEffect(() => {
    if (otpDialogOpen && otpStep === 'code' && otpCooldown > 0) {
      const timer = setInterval(() => {
        setOtpCooldown((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [otpDialogOpen, otpStep, otpCooldown]);

  const handleOpenOtpDialog = () => {
    setDialogPassword('');
    setOtpCode('');
    setOtpChallengeId('');
    setOtpEmailHint('');
    setDialogError(null);
    setOtpStep('password');
    setOtpCooldown(60);
    setOtpDialogOpen(true);
  };

  const handleCloseOtpDialog = () => {
    setOtpDialogOpen(false);
    setDialogPassword('');
    setOtpCode('');
    setOtpChallengeId('');
    setOtpEmailHint('');
    setDialogError(null);
    setOtpStep('password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogPassword) {
      setDialogError(t('profile.password.currentRequired'));
      return;
    }

    setDialogLoading(true);
    setDialogError(null);

    if (otpEnabled) {
      try {
        const result = await AdminStorage.disableLoginOtp(dialogPassword);
        if (currentUser) {
          setCurrentUser({ ...currentUser, loginOtpEnabled: result.loginOtpEnabled });
        }
        void refreshUser();
        handleCloseOtpDialog();
        showToast(t('profile.otp.disableSuccess'));
      } catch (caught) {
        setDialogError(getErrorMessage(caught, t('profile.otp.error')));
      } finally {
        setDialogLoading(false);
      }
      return;
    }

    try {
      const challenge = await AdminStorage.requestLoginOtpSetup(dialogPassword);
      setOtpChallengeId(challenge.challengeId);
      setOtpEmailHint(challenge.emailHint);
      setOtpCode('');
      setOtpCooldown(60);
      setOtpStep('code');
    } catch (caught) {
      setDialogError(getErrorMessage(caught, t('profile.otp.error')));
    } finally {
      setDialogLoading(false);
    }
  };

  const handleVerifyOtpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setDialogError(null);

    if (otpCode.length < 6) {
      setDialogError(t('profile.otp.step2CodeRequired'));
      return;
    }

    setDialogLoading(true);
    try {
      const result = await AdminStorage.verifyLoginOtpSetup(otpChallengeId, otpCode);
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          loginOtpEnabled: result.loginOtpEnabled,
          emailVerifiedAt: currentUser.emailVerifiedAt ?? new Date().toISOString(),
        });
      }
      void refreshUser();
      handleCloseOtpDialog();
      showToast(t('profile.otp.enableSuccess'));
    } catch (caught) {
      setDialogError(getErrorMessage(caught, t('profile.otp.error')));
    } finally {
      setDialogLoading(false);
    }
  };

  const handleResendOtpCode = async () => {
    if (otpCooldown > 0 || otpResending || dialogLoading) return;
    setOtpResending(true);
    setDialogError(null);
    try {
      await AdminStorage.resendLoginOtpSetup(otpChallengeId);
      setOtpCooldown(60);
      showToast(t('profile.otp.step2ResendSuccess'));
    } catch (caught) {
      setDialogError(getErrorMessage(caught, t('profile.password.resendError')));
    } finally {
      setOtpResending(false);
    }
  };

  const roleCleanLabel = getRoleLabel(currentUser?.role, currentUser?.roleAr, isAr);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ----------------- Hero Card: Profile Banner & Avatar ----------------- */}
      <div className="rounded-3xl bg-surface border border-muted-border/40 overflow-hidden shadow-sm relative transition-all duration-300">
        {/* Ambient Decorative Banner */}
        <div className="h-32 sm:h-44 bg-gradient-to-r from-accent/25 via-accent/15 to-gold/20 relative border-b border-muted-border/30 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_1px_1px,var(--color-accent,currentColor)_1px,transparent_0)] [background-size:20px_20px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent pointer-events-none" />

          {/* Active Account Pill */}
          <div className="absolute top-4 end-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-surface/90 backdrop-blur-md border border-muted-border/50 text-heading shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t('profile.activeAccount')}</span>
            </span>
          </div>
        </div>

        {/* Content Row: Avatar, Identity & Quick Actions */}
        <div className="px-5 sm:px-8 pb-7 pt-0 relative">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6 -mt-16 sm:-mt-20 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5 w-full md:w-auto">
              {/* Avatar Container with Squircle & Ring */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-surface ring-4 ring-surface shadow-xl flex items-center justify-center relative transition-transform duration-300 group-hover:scale-[1.02]">
                  {currentUser?.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full brand-fill text-canvas font-black flex items-center justify-center text-3xl sm:text-4xl shadow-inner select-none">
                      {initialsOf(currentUser?.name)}
                    </div>
                  )}

                  {/* Uploading Overlay */}
                  {avatarUploading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs gap-1.5 z-10">
                      <RotateCw className="w-6 h-6 animate-spin text-accent" />
                      <span className="font-bold">{t('profile.avatarUploading')}</span>
                    </div>
                  )}

                  {/* Hover Overlay Button */}
                  {!avatarUploading && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label={t('profile.changeAvatar')}
                      className="absolute inset-0 bg-black/55 backdrop-blur-[2px] text-white opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 cursor-pointer z-10"
                    >
                      <Camera className="w-6 h-6" />
                      <span className="text-[11px] font-bold">
                        {t('profile.changeAvatar')}
                      </span>
                    </button>
                  )}
                </div>

                {/* Floating Corner Trigger */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  aria-label={t('profile.uploadAvatar')}
                  title={t('profile.changeAvatar')}
                  className="absolute bottom-1 end-1 p-2.5 rounded-2xl bg-accent text-canvas shadow-lg hover:scale-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 z-20 border-2 border-surface"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>

              {/* Profile Name & Badges */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black text-heading tracking-tight">
                    {currentUser?.name ?? '—'}
                  </h1>

                  {/* Clean Role Badge with Directional Isolation */}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-accent/15 text-accent border border-accent/25 shadow-xs">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <bdi dir={isAr ? 'rtl' : 'ltr'}>{roleCleanLabel}</bdi>
                  </span>

                  {/* Department Badge if available */}
                  {(currentUser?.departmentName || currentUser?.department) && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-muted-border/30 text-neutral-text/90 border border-muted-border/50">
                      <Building2 className="w-3.5 h-3.5 text-neutral-text/60" />
                      <span>{currentUser.departmentName || currentUser.department}</span>
                    </span>
                  )}
                </div>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-neutral-text/70">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Mail className="w-3.5 h-3.5 text-neutral-text/50" />
                    <span dir="ltr">{currentUser?.email}</span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{t('profile.verifiedEmailBadge')}</span>
                    </span>
                  </div>

                  {currentUser?.phone && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-neutral-text/50" />
                      <span dir="ltr">{currentUser.phone}</span>
                    </div>
                  )}

                  {currentUser?.lastLogin && (
                    <div className="flex items-center gap-1.5 text-neutral-text/60">
                      <Clock className="w-3.5 h-3.5 text-neutral-text/40" />
                      <span>
                        {t('profile.lastLoginLabel', { time: formatLastLogin(currentUser.lastLogin) })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Avatar Controls */}
            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="px-4 py-2.5 rounded-xl text-xs font-black bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
              >
                <Upload className="w-4 h-4" />
                <span>{t('profile.uploadAvatar')}</span>
              </button>

              {currentUser?.avatar && (
                <button
                  type="button"
                  onClick={handleDeleteAvatar}
                  disabled={avatarUploading}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-500/10 border border-red-500/30 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  title={t('profile.removeAvatar')}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('profile.removeAvatar')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Avatar Error Banner if any */}
          {avatarError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{avatarError}</span>
            </div>
          )}

          {/* Interactive Security Quick-Tiles Strip */}
          <div className="pt-4 border-t border-muted-border/30 grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Tile 1: Email 2FA */}
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="p-3.5 rounded-2xl bg-canvas hover:bg-surface-hover/80 border border-muted-border/40 hover:border-accent/40 transition-all text-start group cursor-pointer shadow-xs"
            >
              <div className="text-[11px] text-neutral-text/70 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                  {t('profile.statEmailOtp')}
                </span>
                <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <div className="font-black text-xs text-heading flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    otpEnabled ? 'bg-emerald-500 shadow-xs' : 'bg-neutral-text/30'
                  }`}
                />
                <span>{otpEnabled ? t('profile.enabled') : t('profile.disabled')}</span>
              </div>
            </button>

            {/* Tile 2: TOTP App */}
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="p-3.5 rounded-2xl bg-canvas hover:bg-surface-hover/80 border border-muted-border/40 hover:border-accent/40 transition-all text-start group cursor-pointer shadow-xs"
            >
              <div className="text-[11px] text-neutral-text/70 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <Smartphone className="w-3.5 h-3.5 text-accent" />
                  {t('profile.statTotp')}
                </span>
                <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <div className="font-black text-xs text-heading flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    totpEnabled ? 'bg-emerald-500 shadow-xs' : 'bg-neutral-text/30'
                  }`}
                />
                <span>{totpEnabled ? t('profile.enabled') : t('profile.disabled')}</span>
              </div>
            </button>

            {/* Tile 3: Passkeys */}
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="p-3.5 rounded-2xl bg-canvas hover:bg-surface-hover/80 border border-muted-border/40 hover:border-accent/40 transition-all text-start group cursor-pointer shadow-xs"
            >
              <div className="text-[11px] text-neutral-text/70 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <Fingerprint className="w-3.5 h-3.5 text-amber-500" />
                  {t('profile.statPasskeys')}
                </span>
                <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <div className="font-black text-xs text-heading flex items-center gap-1.5">
                <span>{passkeyCount}</span>
                <span className="text-[10px] text-neutral-text/60 font-normal">
                  {t('profile.passkeysRegistered')}
                </span>
              </div>
            </button>

            {/* Tile 4: Role & Permissions */}
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className="p-3.5 rounded-2xl bg-canvas hover:bg-surface-hover/80 border border-muted-border/40 hover:border-accent/40 transition-all text-start group cursor-pointer shadow-xs"
            >
              <div className="text-[11px] text-neutral-text/70 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  {t('profile.statRole')}
                </span>
                <span className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
              <div className="font-black text-xs text-heading truncate">
                <bdi dir={isAr ? 'rtl' : 'ltr'}>{roleCleanLabel}</bdi>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------- Segmented Tab Switcher ------------------- */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
            activeTab === 'profile'
              ? 'bg-canvas text-accent shadow-sm border border-muted-border/40'
              : 'text-neutral-text/70 hover:text-heading hover:bg-canvas/50'
          }`}
        >
          <User className="w-4 h-4 shrink-0" />
          <span>{t('profile.tabProfile')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
            activeTab === 'security'
              ? 'bg-canvas text-accent shadow-sm border border-muted-border/40'
              : 'text-neutral-text/70 hover:text-heading hover:bg-canvas/50'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{t('profile.tabSecurity')}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isHighSecurity ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all ${
            activeTab === 'preferences'
              ? 'bg-canvas text-accent shadow-sm border border-muted-border/40'
              : 'text-neutral-text/70 hover:text-heading hover:bg-canvas/50'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{t('profile.tabPreferences')}</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* -------------------- TAB 1: PERSONAL PROFILE -------------------- */}
      {/* =================================================================== */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Details Form (Col 1-7) */}
          <div className="lg:col-span-7 rounded-3xl bg-surface border border-muted-border/40 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center gap-3.5 pb-5 border-b border-muted-border/30">
              <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0 border border-accent/20">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-heading">
                  {t('profile.details.title')}
                </h2>
                <p className="text-xs text-neutral-text/60 mt-0.5">
                  {t('profile.details.subtitle')}
                </p>
              </div>
            </div>

            {detailsError && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{detailsError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDetails} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-text/80">
                  {t('profile.details.name')}
                </label>
                <div className="relative flex items-center">
                  <User className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('profile.details.namePlaceholder')}
                    className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-text/80">
                    {t('profile.details.email')}
                  </label>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('profile.verifiedEmailBadge')}</span>
                  </span>
                </div>
                <div className="relative flex items-center">
                  <Mail className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                  <input
                    type="email"
                    required
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 font-mono transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-text/80">
                  {t('profile.details.phone')}
                </label>
                <div className="relative flex items-center">
                  <Phone className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                  <input
                    type="tel"
                    dir="ltr"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+966 5X XXX XXXX"
                    className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 font-mono transition-all"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={detailsSaving}
                  className="brand-btn-primary font-black px-6 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm disabled:opacity-50 active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {detailsSaving ? t('profile.details.saving') : t('profile.details.save')}
                  </span>
                </button>
              </div>
            </form>
          </div>

          {/* Account & System Identity Summary (Col 8-12) */}
          <div className="lg:col-span-5 rounded-3xl bg-surface border border-muted-border/40 p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-3 pb-4 border-b border-muted-border/30">
              <div className="w-10 h-10 rounded-2xl bg-gold/15 text-gold flex items-center justify-center shrink-0 border border-gold/30">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-heading">
                  {t('profile.accountDetailsTitle')}
                </h3>
                <p className="text-[11px] text-neutral-text/60">
                  {t('profile.statRole')}
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Account ID with copy */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-muted-border/40 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-neutral-text/60 font-medium">
                    {t('profile.accountIdLabel')}
                  </div>
                  <div className="font-mono font-bold text-heading mt-0.5" dir="ltr">
                    {currentUser?.id ? `${currentUser.id.slice(0, 12)}…` : '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="p-2 rounded-xl text-neutral-text/60 hover:text-heading hover:bg-surface border border-transparent hover:border-muted-border/40 cursor-pointer transition-all"
                  title="Copy ID"
                >
                  {copiedId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Role */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-muted-border/40">
                <div className="text-[11px] text-neutral-text/60 font-medium">
                  {t('profile.accountRoleLabel')}
                </div>
                <div className="font-black text-heading mt-1 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  <bdi dir={isAr ? 'rtl' : 'ltr'}>{roleCleanLabel}</bdi>
                </div>
              </div>

              {/* Department */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-muted-border/40">
                <div className="text-[11px] text-neutral-text/60 font-medium">
                  {t('profile.accountDepartmentLabel')}
                </div>
                <div className="font-bold text-heading mt-1 flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-neutral-text/50" />
                  <span>{currentUser?.departmentName || currentUser?.department || '—'}</span>
                </div>
              </div>

              {/* Account Status */}
              <div className="p-3.5 rounded-2xl bg-canvas border border-muted-border/40 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-neutral-text/60 font-medium">
                    {t('profile.accountStatusLabel')}
                  </div>
                  <div className="font-bold text-heading mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{t('profile.activeAccount')}</span>
                  </div>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {t('profile.enabled')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* -------------------- TAB 2: SECURITY & ACCESS ------------------- */}
      {/* =================================================================== */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Security Health Status Overview Banner */}
          <div
            className={`rounded-3xl border p-5 sm:p-6 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs ${
              isHighSecurity
                ? 'bg-emerald-500/5 border-emerald-500/30'
                : 'bg-amber-500/5 border-amber-500/30'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  isHighSecurity
                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                }`}
              >
                {isHighSecurity ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-heading">
                  {isHighSecurity
                    ? t('profile.securityHealthGood')
                    : t('profile.securityHealthAlert')}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-neutral-text/70">
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        otpEnabled ? 'bg-emerald-500' : 'bg-neutral-text/30'
                      }`}
                    />
                    <span>{t('profile.statEmailOtp')}</span>
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        totpEnabled ? 'bg-emerald-500' : 'bg-neutral-text/30'
                      }`}
                    />
                    <span>{t('profile.statTotp')}</span>
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        passkeyCount > 0 ? 'bg-emerald-500' : 'bg-neutral-text/30'
                      }`}
                    />
                    <span>{t('profile.statPasskeys')} ({passkeyCount})</span>
                  </span>
                </div>
              </div>
            </div>

            {!otpEnabled && (
              <button
                type="button"
                onClick={handleOpenOtpDialog}
                className="brand-btn-primary font-black text-xs px-5 py-2.5 rounded-xl cursor-pointer shadow-sm shrink-0"
              >
                {t('profile.otp.enableBtn')}
              </button>
            )}
          </div>

          {/* Card 1: Two-Step Login OTP (Email) */}
          <div className="rounded-3xl bg-surface border border-muted-border/40 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-muted-border/30">
              <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0 border border-accent/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-heading">
                  {t('profile.otp.title')}
                </h2>
                <p className="text-xs text-neutral-text/60 mt-0.5">
                  {t('profile.otp.subtitle')}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-canvas border border-muted-border/40">
              <div className="flex items-center gap-3.5">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    otpEnabled
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-neutral-text/10 text-neutral-text/60 border border-muted-border/30'
                  }`}
                >
                  {otpEnabled ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-black text-heading">
                      {t('profile.otp.statusLabel')}
                    </span>
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        otpEnabled
                          ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                      }`}
                    >
                      {otpEnabled ? t('profile.enabled') : t('profile.disabled')}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-text/60 mt-1 max-w-xl">
                    {otpEnabled ? t('profile.otp.enabledDesc') : t('profile.otp.disabledDesc')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenOtpDialog}
                className={`cursor-pointer text-xs font-black px-5 py-2.5 rounded-xl transition-all shrink-0 active:scale-95 ${
                  otpEnabled
                    ? 'border border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'brand-btn-primary shadow-sm'
                }`}
              >
                {otpEnabled ? t('profile.otp.disableBtn') : t('profile.otp.enableBtn')}
              </button>
            </div>
          </div>

          {/* Card 2: Authenticator App (TOTP) */}
          <AuthenticatorTotpCard isAr={isAr} />

          {/* Card 3: Passkeys (WebAuthn) */}
          <PasskeysCard isAr={isAr} />

          {/* Card 4: Change Password */}
          <div className="rounded-3xl bg-surface border border-muted-border/40 p-6 sm:p-7 shadow-xs">
            <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-muted-border/30">
              <div className="w-11 h-11 rounded-2xl bg-accent/10 text-accent flex items-center justify-center shrink-0 border border-accent/20">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-heading">
                  {t('profile.password.title')}
                </h2>
                <p className="text-xs text-neutral-text/60 mt-0.5">
                  {t('profile.password.subtitle')}
                </p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-text/80 mb-1.5">
                  {t('profile.password.current')}
                </label>
                <div className="relative flex items-center">
                  <KeyRound className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                  <input
                    type="password"
                    required
                    dir="ltr"
                    value={currentPassword}
                    onChange={(e) => {
                      invalidatePendingChallenge();
                      setCurrentPassword(e.target.value);
                    }}
                    placeholder="••••••••"
                    className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-text/80 mb-1.5">
                    {t('profile.password.new')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                    <input
                      type="password"
                      required
                      dir="ltr"
                      value={newPassword}
                      onChange={(e) => {
                        invalidatePendingChallenge();
                        setNewPassword(e.target.value);
                      }}
                      placeholder="••••••••"
                      className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-text/80 mb-1.5">
                    {t('profile.password.confirm')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                    <input
                      type="password"
                      required
                      dir="ltr"
                      value={confirmPassword}
                      onChange={(e) => {
                        invalidatePendingChallenge();
                        setConfirmPassword(e.target.value);
                      }}
                      placeholder="••••••••"
                      className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={
                    passwordSaving ||
                    awaitingCode ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                  }
                  className="brand-btn-primary font-black px-6 py-3 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs sm:text-sm disabled:opacity-50 active:scale-95 transition-all"
                >
                  <Lock className="w-4 h-4" />
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

            {/* Step 2: Confirm emailed code for staff */}
            {awaitingCode && (
              <div className="mt-6 pt-6 border-t border-muted-border/30 space-y-4">
                <p className="text-xs text-neutral-text/80 leading-relaxed bg-accent/5 p-4 rounded-2xl border border-accent/20">
                  {t('profile.password.codeNotice', { emailHint })}
                </p>

                <div>
                  <label className="block text-xs font-bold text-neutral-text/80 mb-1.5 text-center">
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
                    className="w-full py-4 px-4 rounded-2xl bg-canvas border border-muted-border/50 text-2xl font-mono text-center tracking-[0.5em] text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                {codeError && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{codeError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleConfirmCodeChange}
                  disabled={codeSaving || code.length < 6}
                  className="w-full brand-btn-primary font-black text-xs sm:text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {codeSaving
                      ? t('profile.password.verifying')
                      : t('profile.password.confirmCode')}
                  </span>
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
        </div>
      )}

      {/* =================================================================== */}
      {/* -------------------- TAB 3: PREFERENCES ------------------------- */}
      {/* =================================================================== */}
      {activeTab === 'preferences' && (
        <div className="space-y-6">
          <ConfirmChoicesCard isAr={isAr} />
        </div>
      )}

      {/* ---------------- Password Confirmation / Email Verification Dialog ---------------- */}
      {otpDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl bg-surface border border-muted-border/50 p-6 sm:p-7 shadow-2xl space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-muted-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm sm:text-base font-black text-heading">
                  {otpEnabled
                    ? t('profile.otp.dialogDisableTitle')
                    : otpStep === 'code'
                    ? t('profile.otp.step2Title')
                    : t('profile.otp.dialogEnableTitle')}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseOtpDialog}
                className="p-1.5 rounded-xl text-neutral-text/50 hover:text-heading hover:bg-canvas cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Description */}
            <p className="text-xs text-neutral-text/75 leading-relaxed">
              {otpEnabled
                ? t('profile.otp.dialogPrompt')
                : otpStep === 'code'
                ? t('profile.otp.step2Prompt', { emailHint: otpEmailHint })
                : t('profile.otp.step1Prompt')}
            </p>

            {dialogError && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{dialogError}</span>
              </div>
            )}

            {otpStep === 'password' ? (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-text/80 mb-1.5">
                    {t('profile.otp.dialogCurrentPassword')}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute start-4 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                    <input
                      type="password"
                      required
                      autoFocus
                      dir="ltr"
                      value={dialogPassword}
                      onChange={(e) => setDialogPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full ps-11 pe-4 py-3 rounded-2xl bg-canvas border border-muted-border/50 text-xs sm:text-sm text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseOtpDialog}
                    className="px-4 py-2.5 rounded-xl border border-muted-border/50 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                  >
                    {t('profile.otp.dialogCancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={dialogLoading || !dialogPassword}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer shadow-sm disabled:opacity-50 active:scale-95 transition-all ${
                      otpEnabled
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'brand-btn-primary'
                    }`}
                  >
                    {dialogLoading
                      ? t('profile.password.verifying')
                      : otpEnabled
                      ? t('profile.otp.dialogConfirmDisable')
                      : t('profile.otp.step1Submit')}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtpCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-text/80 mb-1.5 text-center">
                    {t('profile.otp.step2CodeLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full py-4 px-4 rounded-2xl bg-canvas border border-muted-border/50 text-2xl font-mono text-center tracking-[0.5em] text-heading outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                  />
                </div>

                <button
                  type="submit"
                  disabled={dialogLoading || otpCode.length < 6}
                  className="w-full brand-btn-primary font-black text-xs sm:text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {dialogLoading
                      ? t('profile.password.verifying')
                      : t('profile.otp.step2Confirm')}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setDialogError(null);
                      setOtpStep('password');
                    }}
                    className="text-neutral-text/60 hover:text-heading font-bold cursor-pointer transition-colors"
                  >
                    {t('profile.otp.step2Back')}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtpCode}
                    disabled={otpCooldown > 0 || otpResending || dialogLoading}
                    className="text-accent hover:underline disabled:text-neutral-text/40 disabled:no-underline font-bold cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${otpResending ? 'animate-spin' : ''}`} />
                    {otpCooldown > 0 ? (
                      <span>{t('profile.otp.step2ResendIn', { seconds: String(otpCooldown) })}</span>
                    ) : (
                      <span>{t('profile.otp.step2Resend')}</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
