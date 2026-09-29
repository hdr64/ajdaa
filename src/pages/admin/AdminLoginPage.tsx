import React, { useState } from 'react';
import { AdminStorage } from '../../services/adminStorage';
import { ApiError, getErrorMessage } from '../../services/api';
import { ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { LoginCredentialsStep } from '../../components/admin/auth/LoginCredentialsStep';
import { LoginOtpStep } from '../../components/admin/auth/LoginOtpStep';
import { ForgotPasswordStep } from '../../components/admin/auth/ForgotPasswordStep';
import { ResetPasswordStep } from '../../components/admin/auth/ResetPasswordStep';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateHome: () => void;
}

type AuthStep = 'credentials' | 'otp' | 'forgot' | 'reset';

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('admin@ajdaa.sa');
  const [password, setPassword] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---------------------- Credentials Login ---------------------- */

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      const result = await AdminStorage.startLogin(email, password);
      if (result.kind === 'session') {
        onLoginSuccess();
      } else {
        setChallengeId(result.challengeId);
        setEmailHint(result.emailHint);
        setStep('otp');
      }
    } catch (caught) {
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

  /* -------------------------- Login OTP -------------------------- */

  const handleVerifyOtp = async (code: string) => {
    setError(null);
    setLoading(true);

    try {
      await AdminStorage.verifyLoginOtp(challengeId, code);
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
            {isAr ? 'بوابة إدارة أجدا العقارية' : 'Ajda Real Estate Admin'}
          </h1>
          <p className="text-xs text-neutral-text/60 mt-1.5">
            {isAr ? 'نظام إدارة المشاريع، الوحدات، وطلبات الاهتمام' : 'Real Estate Portfolio & Customer Inquiries Management'}
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

