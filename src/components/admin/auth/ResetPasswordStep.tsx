import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, Info, type LucideIcon } from 'lucide-react';

interface ResetPasswordStepProps {
  email: string;
  onReset: (code: string, newPassword: string) => Promise<void>;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  notice: string | null;
  isAr: boolean;
  ArrowIcon: LucideIcon;
}

export const ResetPasswordStep: React.FC<ResetPasswordStepProps> = ({
  email,
  onReset,
  onBack,
  loading,
  error,
  notice,
  isAr,
  ArrowIcon,
}) => {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [clientError, setClientError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientError(null);

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setClientError(isAr ? 'يرجى إدخال رمز التحقق' : 'Please enter the verification code');
      return;
    }

    if (newPassword.length < 8) {
      setClientError(isAr ? 'كلمة المرور يجب أن لا تقل عن 8 أحرف' : 'Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setClientError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    await onReset(trimmedCode, newPassword);
  };

  const displayError = clientError || error;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-heading">
          {isAr ? 'تعيين كلمة المرور الجديدة' : 'Set New Password'}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1 leading-relaxed">
          {isAr
            ? `أدخل رمز التحقق المرسل للحساب `
            : `Enter the verification code sent to `}
          <span className="font-mono font-bold text-heading inline-block" dir="ltr">{email}</span>
        </p>
      </div>

      {notice && (
        <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {displayError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {isAr ? 'رمز التحقق (6 أرقام)' : 'Verification Code (6 digits)'}
          </label>
          <div className="relative flex items-center">
            <KeyRound className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
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
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono tracking-wider"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {isAr ? 'كلمة المرور الجديدة (8 أحرف على الأقل)' : 'New Password (min 8 chars)'}
          </label>
          <div className="relative flex items-center">
            <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
            <input
              type="password"
              required
              dir="ltr"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || code.length < 6 || !newPassword || !confirmPassword}
          className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
        >
          {loading ? (
            <span>{isAr ? 'جاري تعيين كلمة المرور...' : 'Resetting password...'}</span>
          ) : (
            <>
              <span>{isAr ? 'تأكيد تغيير كلمة المرور' : 'Confirm Password Reset'}</span>
              <ArrowIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-neutral-text/60 hover:text-heading cursor-pointer transition-colors"
        >
          {isAr ? '← إلغاء والعودة لتسجيل الدخول' : '← Cancel and Back to Sign In'}
        </button>
      </div>
    </div>
  );
};
