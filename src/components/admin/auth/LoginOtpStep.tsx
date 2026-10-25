import React, { useState, useEffect } from 'react';
import { KeyRound, AlertCircle, RotateCw, type LucideIcon } from 'lucide-react';

interface LoginOtpStepProps {
  emailHint: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  isAr: boolean;
  ArrowIcon: LucideIcon;
}

export const LoginOtpStep: React.FC<LoginOtpStepProps> = ({
  emailHint,
  onVerify,
  onResend,
  onBack,
  loading,
  error,
  isAr,
  ArrowIcon,
}) => {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(60);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;
    await onVerify(code.trim());
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending || loading) return;
    setResending(true);
    try {
      await onResend();
      setCooldown(60);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-heading">
          {isAr ? 'التحقق بخطوتين' : 'Two-Step Verification'}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1 leading-relaxed">
          {isAr
            ? `تم إرسال رمز التحقق المكون من 6 أرقام إلى `
            : `We sent a 6-digit verification code to `}
          <span className="font-mono font-bold text-heading inline-block" dir="ltr">{emailHint}</span>
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <button
          type="submit"
          disabled={loading || code.length < 6}
          className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
        >
          {loading ? (
            <span>{isAr ? 'جاري التحقق من الرمز...' : 'Verifying code...'}</span>
          ) : (
            <>
              <span>{isAr ? 'تأكيد الرمز والمتابعة' : 'Verify and Continue'}</span>
              <ArrowIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="flex items-center justify-between gap-2 pt-2 text-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-neutral-text/60 hover:text-heading font-bold cursor-pointer transition-colors"
        >
          {isAr ? '← العودة لتسجيل الدخول' : '← Back to Login'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending || loading}
          className="text-accent hover:underline disabled:text-neutral-text/40 disabled:no-underline font-bold cursor-pointer disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
        >
          <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
          {cooldown > 0 ? (
            <span>
              {isAr ? `إعادة الإرسال بعد ${cooldown} ثانية` : `Resend code in ${cooldown}s`}
            </span>
          ) : (
            <span>{isAr ? 'إعادة إرسال الرمز' : 'Resend Code'}</span>
          )}
        </button>
      </div>
    </div>
  );
};
