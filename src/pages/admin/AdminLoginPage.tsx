import React, { useState } from 'react';
import { AdminStorage } from '../../services/adminStorage';
import { ApiError, getErrorMessage } from '../../services/api';
import { ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { LoginCredentialsStep } from '../../components/admin/auth/LoginCredentialsStep';
import { LoginOtpStep } from '../../components/admin/auth/LoginOtpStep';
import { LoginTotpStep } from '../../components/admin/auth/LoginTotpStep';
import { EnrollTotpStep } from '../../components/admin/auth/EnrollTotpStep';
import { VerifyEmailCodeStep } from '../../components/admin/auth/VerifyEmailCodeStep';
import { ForgotPasswordStep } from '../../components/admin/auth/ForgotPasswordStep';
import { ResetPasswordStep } from '../../components/admin/auth/ResetPasswordStep';
import { SuggestPasskeyStep } from '../../components/admin/auth/SuggestPasskeyStep';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { authService, type LoginResult } from '../../services/authService';
import { useAdminT } from '../../i18n/admin/useAdminT';
import type { AdminUser } from '../../types/admin';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateHome: () => void;
}

type AuthStep =
  | 'credentials'
  | 'otp'
  | 'totp'
  | 'enrollTotp'
  | 'verifyCode'
  | 'forgot'
  | 'reset'
  | 'suggestPasskey';

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
}) => {
  const { language, isRTL } = useLanguage();
  const { t } = useAdminT();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [step, setStep] = useState<AuthStep>('credentials');
  // Empty by default: a prefilled address tells an unauthenticated visitor
  // which account to attack, and it is a default credential on a public page.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [enrollToken, setEnrollToken] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [sessionUser, setSessionUser] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Checks if user has no passkeys on a supported device and offers the suggestion.
   * Returns true if suggestion was triggered.
   */
  const checkPasskeySuggestion = (user: AdminUser): boolean => {
    const hasPasskeys = (user.passkeyCount ?? 0) > 0;
    const supports = typeof window !== 'undefined' && browserSupportsWebAuthn();
    const dismissed =
      typeof window !== 'undefined' &&
      localStorage.getItem(`ajda_passkey_prompt_dismissed_${user.id}`);
    if (!hasPasskeys && supports && !dismissed) {
      setSessionUser(user);
      setStep('suggestPasskey');
      return true;
    }
    return false;
  };

  /**
   * Routes a login response to its next screen and reports whether a session
   * was issued. Shared by the credentials step and the post-verification
   * re-login so the second-factor branches live in exactly one place.
   */
  const advanceLogin = (result: LoginResult): boolean => {
    switch (result.kind) {
      case 'session':
        if (checkPasskeySuggestion(result.user)) return false;
        return true;
      case 'otp':
        setChallengeId(result.challengeId);
        setEmailHint(result.emailHint);
        setStep('otp');
        return false;
      case 'totp':
        setChallengeId(result.challengeId);
        setEmailHint(result.emailHint);
        setStep('totp');
        return false;
      case 'totpEnroll':
        setEnrollToken(result.enrollToken);
        setEmailHint(result.emailHint);
        setStep('enrollTotp');
        return false;
    }
  };

  /* ---------------------- Credentials Login ---------------------- */

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const result = await AdminStorage.startLogin(email, password);
      if (advanceLogin(result)) onLoginSuccess();
    } catch (caught) {
      // Correct credentials on an unverified account are a 403, not a login
      // failure: the address must be confirmed before a session can be issued.
      const details = (caught as { details?: unknown }).details;
      if (
        caught instanceof ApiError &&
        details &&
        typeof details === 'object' &&
        (details as { code?: unknown }).code === 'EMAIL_NOT_VERIFIED'
      ) {
        // Correct credentials on an unverified create-mode account: offer the
        // emailed code step instead of a dead end, keeping the credentials in
        // page state only.
        setError(null);
        setNotice(null);
        setStep('verifyCode');
        return;
      }
      setError(
        getErrorMessage(
          caught,
          isAr ? 'تعذر تسجيل الدخول. حاول مرة أخرى.' : 'Unable to sign in. Please try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------- Passkey Login -------------------------- */

  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const supportsPasskeys = typeof window !== 'undefined' && browserSupportsWebAuthn();

  const handlePasskeyLogin = async () => {
    setError(null);
    setNotice(null);
    setPasskeyLoading(true);

    try {
      const { options, challengeId } = await authService.getPasskeyLoginOptions();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const result = await authService.verifyPasskeyLogin(challengeId, authResponse);
      if (advanceLogin(result)) onLoginSuccess();
    } catch (caught: unknown) {
      if (caught instanceof Error && caught.name === 'NotAllowedError') {
        // User cancelled the prompt - silent
        return;
      }
      setError(
        isAr
          ? 'تعذّر الدخول بمفتاح المرور. جرّب كلمة المرور.'
          : 'Could not sign in with passkey. Please try with your password.'
      );
    } finally {
      setPasskeyLoading(false);
    }
  };

  /* -------------------------- Login OTP -------------------------- */

  const handleVerifyOtp = async (code: string) => {
    setError(null);
    setLoading(true);

    try {
      const session = await AdminStorage.verifyLoginOtp(challengeId, code);
      if (checkPasskeySuggestion(session.user)) return;
      onLoginSuccess();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 410 || caught.status === 404)) {
        setStep('credentials');
        setError(
          isAr
            ? 'انتهت صلاحية جلسة التحقق، يرجى إعادة تسجيل الدخول'
            : 'Verification session has expired. Please sign in again.'
        );
      } else {
        setError(
          getErrorMessage(
            caught,
            isAr ? 'رمز التحقق غير صحيح أو منتهي الصلاحية' : 'Invalid or expired verification code'
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(null);
    try {
      await AdminStorage.resendLoginOtp(challengeId);
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 410 || caught.status === 404)) {
        setStep('credentials');
        setError(
          isAr
            ? 'انتهت صلاحية جلسة التحقق، يرجى إعادة تسجيل الدخول'
            : 'Verification session has expired. Please sign in again.'
        );
      } else {
        setError(
          getErrorMessage(
            caught,
            isAr ? 'تعذر إعادة إرسال الرمز، يرجى الانتظار قليلاً' : 'Could not resend code, please wait'
          )
        );
      }
    }
  };

  /* ------------------ Authenticator app (TOTP) ------------------ */

  const handleVerifyTotp = async (code: string) => {
    setError(null);
    setLoading(true);

    try {
      const session = await AdminStorage.verifyLoginTotp(challengeId, code);
      if (checkPasskeySuggestion(session.user)) return;
      onLoginSuccess();
    } catch (caught) {
      if (caught instanceof ApiError && (caught.status === 410 || caught.status === 404)) {
        setStep('credentials');
        setError(
          isAr
            ? 'انتهت صلاحية جلسة التحقق، يرجى إعادة تسجيل الدخول'
            : 'Verification session has expired. Please sign in again.'
        );
      } else {
        setError(
          getErrorMessage(
            caught,
            isAr ? 'الرمز غير صحيح أو منتهي الصلاحية' : 'Invalid or expired code'
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  /** Loads the pending secret for the enrollment token (QR + manual key). */
  const handleEnrollTotpLoad = () => AdminStorage.enrollTotpSetup(enrollToken);

  /** Confirms the first app code; a session comes back with the recovery codes. */
  const handleEnrollTotpVerify = async (code: string) => {
    setError(null);
    setLoading(true);
    try {
      const session = await AdminStorage.enrollTotpVerify(enrollToken, code);
      if (checkPasskeySuggestion(session.user)) return;
      onLoginSuccess();
    } catch (caught) {
      setError(
        getErrorMessage(
          caught,
          isAr ? 'تعذر تفعيل تطبيق المصادقة، تحقق من الرمز' : 'Could not enable the app, check the code'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  /* -------------------- Verify email code -------------------- */

  const handleVerifyEmailCode = async (code: string) => {
    setError(null);
    setLoading(true);
    try {
      await AdminStorage.verifyEmailCode(email, password, code);

      // The account is now active. Sign the user in automatically by
      // re-submitting the original login so they do not type credentials again.
      // A second factor may still be required (app code or first-time setup).
      const result = await AdminStorage.startLogin(email, password);
      if (advanceLogin(result)) {
        setNotice(
          isAr
            ? 'تم تأكيد البريد الإلكتروني وتسجيل الدخول بنجاح.'
            : 'Email confirmed and you are signed in.'
        );
        onLoginSuccess();
      }
    } catch (caught) {
      // A wrong code answers 400 with `attemptsLeft`; the server's message is
      // already bilingual.
      setError(
        caught instanceof ApiError
          ? caught.message
          : getErrorMessage(
              caught,
              isAr ? 'تعذر تأكيد البريد الإلكتروني' : 'Could not verify email'
            )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerificationCode = async () => {
    setError(null);
    try {
      await AdminStorage.resendVerificationCode(email, password);
    } catch (caught) {
      setError(
        getErrorMessage(
          caught,
          isAr ? 'تعذر إعادة إرسال الرمز، يرجى الانتظار قليلاً' : 'Could not resend code, please wait'
        )
      );
    }
  };

  /* ----------------------- Forgot Password ----------------------- */

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      await AdminStorage.forgotPassword(email);
      setStep('reset');
      setNotice(
        isAr
          ? 'إذا كان الحساب مسجلاً، فقد تم إرسال رمز التحقق إلى بريدك الإلكتروني'
          : 'If an account exists with this email, a verification code was sent.'
      );
    } catch (caught) {
      setError(
        getErrorMessage(
          caught,
          isAr ? 'تعذر إرسال طلب الاستعادة' : 'Could not process password reset request'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------ Reset Password ----------------------- */

  const handleResetPassword = async (code: string, newPassword: string) => {
    setError(null);
    setLoading(true);

    try {
      await AdminStorage.resetPassword(email, code, newPassword);
      setStep('credentials');
      setPassword('');
      setNotice(
        isAr
          ? 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.'
          : 'Password reset successfully. You can now sign in.'
      );
    } catch (caught) {
      setError(
        getErrorMessage(
          caught,
          isAr ? 'تعذر تغيير كلمة المرور. تحقق من صحة الرمز.' : 'Could not reset password. Check the code and try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setError(null);
    setNotice(null);
    setStep('credentials');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-canvas">
      {/* Ambient background glows */}
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
            {t('auth.portalTitle')}
          </h1>
          <p className="text-xs text-neutral-text/60 mt-1.5">
            {t('auth.portalSubtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-surface/90 border border-muted-border/40 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          {step === 'credentials' && (
            <LoginCredentialsStep
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              onSubmit={handleCredentialsSubmit}
              onForgotPassword={() => {
                setError(null);
                setNotice(null);
                setStep('forgot');
              }}
              onNavigateHome={onNavigateHome}
              loading={loading}
              error={error}
              notice={notice}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
              supportsPasskeys={supportsPasskeys}
              passkeyLoading={passkeyLoading}
              onPasskeyLogin={handlePasskeyLogin}
            />
          )}

          {step === 'suggestPasskey' && sessionUser && (
            <SuggestPasskeyStep
              user={sessionUser}
              password={password}
              onContinue={onLoginSuccess}
            />
          )}

          {step === 'otp' && (
            <LoginOtpStep
              emailHint={emailHint}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onBack={handleBackToCredentials}
              loading={loading}
              error={error}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
            />
          )}

          {step === 'totp' && (
            <LoginTotpStep
              emailHint={emailHint}
              onVerify={handleVerifyTotp}
              onBack={handleBackToCredentials}
              onModeChange={() => setError(null)}
              loading={loading}
              error={error}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
            />
          )}

          {step === 'enrollTotp' && (
            <EnrollTotpStep
              onLoad={handleEnrollTotpLoad}
              onVerify={handleEnrollTotpVerify}
              onBack={handleBackToCredentials}
              loading={loading}
              error={error}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
            />
          )}

          {step === 'verifyCode' && (
            <VerifyEmailCodeStep
              onVerify={handleVerifyEmailCode}
              onResend={handleResendVerificationCode}
              onBack={handleBackToCredentials}
              loading={loading}
              error={error}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
            />
          )}

          {step === 'forgot' && (
            <ForgotPasswordStep
              email={email}
              setEmail={setEmail}
              onSubmit={handleForgotPasswordSubmit}
              onBack={handleBackToCredentials}
              loading={loading}
              error={error}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
            />
          )}

          {step === 'reset' && (
            <ResetPasswordStep
              email={email}
              onReset={handleResetPassword}
              onBack={handleBackToCredentials}
              loading={loading}
              error={error}
              notice={notice}
              isAr={isAr}
              ArrowIcon={ArrowIcon}
            />
          )}
        </div>
      </div>
    </div>
  );
};


