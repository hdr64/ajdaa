import React, { useEffect, useState } from 'react';
import { ShieldCheck, MailCheck, AlertCircle, Loader2, LogIn } from 'lucide-react';
import { AdminStorage } from '../../services/adminStorage';
import { useLanguage } from '../../hooks/useLanguage';

type VerifyStatus = 'verifying' | 'success' | 'error';

/**
 * Public email-verification landing page. Reads the one-shot `token` from the
 * query string, strips it from the address bar so it does not linger in
 * history, and reports the outcome. Deliberately says nothing about whether an
 * account exists — that detail is reserved for the signed-in screens.
 */
export const VerifyEmailPage: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  // Read once, before `replaceState` wipes the query: the request needs the
  // token, but the address bar must not keep it afterwards.
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') ?? ''
  );
  const [status, setStatus] = useState<VerifyStatus>(token ? 'verifying' : 'error');

  useEffect(() => {
    // Drop the token from the address bar: it is one-shot and must not be
    // shared again from the URL bar, bookmarks or the tab history.
    window.history.replaceState({}, '', window.location.pathname);

    if (!token) return;

    let active = true;

    AdminStorage.verifyEmail(token)
      .then((result) => {
        if (active) setStatus(result.verified ? 'success' : 'error');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [token]);

  const goToLogin = () => {
    window.location.assign('/admin/login');
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
          {status === 'verifying' && (
            <div className="text-center space-y-4" role="status" aria-live="polite">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 text-accent">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <h2 className="text-lg font-black text-heading">
                {isAr ? 'جاري تأكيد بريدك الإلكتروني...' : 'Verifying your email...'}
              </h2>
              <p className="text-xs text-neutral-text/60 leading-relaxed">
                {isAr ? 'لحظات قليلة وننتهي من التحقق من الرابط.' : 'Just a moment while we validate your link.'}
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-500">
                <MailCheck className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-heading">
                {isAr ? 'تم تأكيد بريدك الإلكتروني' : 'Email verified'}
              </h2>
              <p className="text-xs text-neutral-text/60 leading-relaxed">
                {isAr ? 'تم تفعيل حسابك. يمكنك الآن تسجيل الدخول.' : 'Your account is active. You can sign in now.'}
              </p>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 text-red-400">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-black text-heading">
                {isAr ? 'تعذّر تأكيد البريد' : 'Could not verify email'}
              </h2>

              <div role="alert" className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2 text-start">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? 'الرابط غير صالح أو منتهي الصلاحية. اطلب من المسؤول إعادة إرسال الرابط.'
                    : 'The link is invalid or expired. Ask an admin to resend it.'}
                </span>
              </div>

              <p className="text-xs text-neutral-text/60 leading-relaxed">
                {isAr ? 'إذا كان لديك حساب، يمكنك المتابعة لتسجيل الدخول.' : 'If you already have an account, you can continue to sign in.'}
              </p>

              <button
                type="button"
                onClick={goToLogin}
                className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg mt-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
