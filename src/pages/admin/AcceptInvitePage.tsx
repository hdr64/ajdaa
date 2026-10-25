import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { AdminStorage } from '../../services/adminStorage';
import { getErrorMessage } from '../../services/api';
import { MIN_PASSWORD_LENGTH, passwordPolicyError } from '../../components/admin/users/usersModel';
import { useLanguage } from '../../hooks/useLanguage';

type InviteStatus = 'form' | 'submitting' | 'success';

interface PolicyCheck {
  labelAr: string;
  labelEn: string;
  passed: (value: string) => boolean;
}

/** The same three rules `PasswordField` renders, so both screens agree. */
const POLICY_CHECKS: readonly PolicyCheck[] = [
  {
    labelAr: `${MIN_PASSWORD_LENGTH} أحرف على الأقل`,
    labelEn: `At least ${MIN_PASSWORD_LENGTH} characters`,
    passed: (value) => value.length >= MIN_PASSWORD_LENGTH,
  },
  {
    labelAr: 'حرف واحد على الأقل',
    labelEn: 'At least one letter',
    passed: (value) => /\p{L}/u.test(value),
  },
  {
    labelAr: 'رقم واحد على الأقل',
    labelEn: 'At least one digit',
    passed: (value) => /\d/.test(value),
  },
];

/**
 * Public invite-acceptance page. The one-shot `token` arrives in the query
 * string, is stripped from the address bar immediately, and then buys the
 * visitor exactly one password. No session is created here: the owner signs in
 * by hand on the login screen.
 */
export const AcceptInvitePage: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  // Read once: `replaceState` wipes the query, so a re-render must not ask again.
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') ?? ''
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState<InviteStatus>('form');
  const [error, setError] = useState<string | null>(null);
  /** Inline field errors stay quiet until the visitor tries to submit. */
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  useEffect(() => {
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const policyError = password.length > 0 ? passwordPolicyError(password) : null;
  const policyErrorLabel = policyError
    ? isAr
      ? policyError
      : `Password must be at least ${MIN_PASSWORD_LENGTH} characters and contain a letter and a digit`
    : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setShowFieldErrors(true);
    setError(null);

    if (policyError || mismatch || password !== confirmPassword) return;

    setStatus('submitting');
    try {
      await AdminStorage.acceptInvite(token, password);
      setStatus('success');
      setPassword('');
      setConfirmPassword('');
    } catch (caught) {
      setStatus('form');
      setError(
        getErrorMessage(
          caught,
          isAr ? 'تعذّر تفعيل الحساب، قد يكون الرابط منتهي الصلاحية' : 'Could not activate the account, the link may have expired'
        )
      );
    }
  };

  const goToLogin = () => {
    window.location.assign('/admin/login');
  };

  /* --------------------------- No usable token --------------------------- */

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-canvas">
        <div
          aria-hidden
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-accent/8 blur-[130px] rounded-full pointer-events-none"
        />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl brand-fill text-canvas shadow-lg mb-4">
              <ShieldCheck className="w-7 h-7 text-inherit" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-heading">
              {isAr ? 'بوابة إدارة أجدا العقارية' : 'Ajda Real Estate Admin'}
            </h1>
            <p className="text-xs text-neutral-text/60 mt-1.5">
              {isAr ? 'نظام إدارة المشاريع، الوحدات، وطلبات الاهتمام' : 'Real Estate Portfolio & Customer Inquiries Management'}
            </p>
          </div>

          <div className="rounded-3xl bg-surface/90 border border-muted-border/40 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 text-red-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-heading">
                {isAr ? 'رابط الدعوة غير صالح أو منتهي الصلاحية.' : 'This invite link is invalid or has expired.'}
              </h2>

              <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2 text-start">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? 'اطلب من المسؤول إعادة إرسال الدعوة إلى بريدك الإلكتروني.'
                    : 'Ask an admin to send the invitation to your email again.'}
                </span>
              </div>

              <button
                type="button"
                onClick={goToLogin}
                className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg mt-2"
              >
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------ Invite form ----------------------------- */

  if (status === 'success') {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-canvas">
        <div
          aria-hidden
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-accent/8 blur-[130px] rounded-full pointer-events-none"
        />

        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl brand-fill text-canvas shadow-lg mb-4">
              <ShieldCheck className="w-7 h-7 text-inherit" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-heading">
              {isAr ? 'بوابة إدارة أجدا العقارية' : 'Ajda Real Estate Admin'}
            </h1>
            <p className="text-xs text-neutral-text/60 mt-1.5">
              {isAr ? 'نظام إدارة المشاريع، الوحدات، وطلبات الاهتمام' : 'Real Estate Portfolio & Customer Inquiries Management'}
            </p>
          </div>

          <div className="rounded-3xl bg-surface/90 border border-muted-border/40 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500">
                <UserCheck className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-heading">
                {isAr ? 'تم تفعيل حسابك' : 'Account activated'}
              </h2>
              <p className="text-xs text-neutral-text/60 leading-relaxed">
                {isAr ? 'تم تعيين كلمة المرور. يمكنك الآن تسجيل الدخول.' : 'Password set. You can sign in now.'}
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg mt-2"
              >
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-canvas">
      <div
        aria-hidden
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-accent/8 blur-[130px] rounded-full pointer-events-none"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl brand-fill text-canvas shadow-lg mb-4">
            <ShieldCheck className="w-7 h-7 text-inherit" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-heading">
            {isAr ? 'بوابة إدارة أجدا العقارية' : 'Ajda Real Estate Admin'}
          </h1>
          <p className="text-xs text-neutral-text/60 mt-1.5">
            {isAr ? 'نظام إدارة المشاريع، الوحدات، وطلبات الاهتمام' : 'Real Estate Portfolio & Customer Inquiries Management'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-surface/90 border border-muted-border/40 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          <div className="text-center mb-5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-heading">
              {isAr ? 'إعداد كلمة المرور' : 'Set your password'}
            </h2>
            <p className="text-xs text-neutral-text/60 mt-1 leading-relaxed">
              {isAr
                ? 'أكمل تفعيل حسابك باختيار كلمة مرور جديدة.'
                : 'Finish activating your account by choosing a new password.'}
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label htmlFor="invite-password" className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'كلمة المرور الجديدة' : 'New password'}
              </label>
              <div className="relative flex items-center">
                <input
                  id="invite-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  dir="ltr"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={Boolean(showFieldErrors && policyErrorLabel)}
                  className={`w-full ps-4 pe-10 py-3 rounded-xl bg-canvas border text-xs text-heading outline-none transition ${
                    showFieldErrors && policyErrorLabel ? 'border-red-500/60' : 'border-muted-border/50 focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? (isAr ? 'إخفاء كلمة المرور' : 'Hide password') : isAr ? 'إظهار كلمة المرور' : 'Show password'}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showFieldErrors && policyErrorLabel && (
                <p role="alert" className="text-[10px] font-bold text-red-500 pt-1.5">
                  {policyErrorLabel}
                </p>
              )}

              {/* Live policy checklist */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] font-bold text-neutral-text/70">
                  {isAr ? 'سياسة كلمة المرور:' : 'Password policy:'}
                </p>
                {POLICY_CHECKS.map((check) => {
                  const passed = check.passed(password);
                  return (
                    <div key={check.labelEn} className="flex items-center gap-1.5 text-[10px]">
                      {passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className={passed ? 'text-emerald-600' : 'text-red-500'}>
                        {isAr ? check.labelAr : check.labelEn}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="invite-confirm-password" className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'تأكيد كلمة المرور' : 'Confirm password'}
              </label>
              <div className="relative flex items-center">
                <input
                  id="invite-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  dir="ltr"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  aria-invalid={Boolean(showFieldErrors && mismatch)}
                  className={`w-full ps-4 pe-10 py-3 rounded-xl bg-canvas border text-xs text-heading outline-none transition ${
                    showFieldErrors && mismatch ? 'border-red-500/60' : 'border-muted-border/50 focus:border-accent'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={
                    showConfirmPassword
                      ? isAr
                        ? 'إخفاء كلمة المرور'
                        : 'Hide password'
                      : isAr
                        ? 'إظهار كلمة المرور'
                        : 'Show password'
                  }
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {showFieldErrors && mismatch && (
                <p role="alert" className="text-[10px] font-bold text-red-500 pt-1.5">
                  {isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={status === 'submitting'}
              className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50 mt-2"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isAr ? 'جاري التفعيل...' : 'Activating...'}</span>
                </>
              ) : (
                <span>{isAr ? 'تفعيل الحساب' : 'Activate account'}</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
