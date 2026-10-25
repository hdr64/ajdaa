import React, { useState } from 'react';
import { KeyRound, AlertCircle, Smartphone, LifeBuoy, type LucideIcon } from 'lucide-react';

interface LoginTotpStepProps {
  emailHint: string;
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  /** Called when the app/recovery toggle flips, so the parent can drop the old error. */
  onModeChange: () => void;
  loading: boolean;
  error: string | null;
  isAr: boolean;
  ArrowIcon: LucideIcon;
}

/**
 * The authenticator-app step of a login. One field serves both the rotating
 * 6-digit code and a saved recovery code (the server tells them apart), with a
 * toggle that only changes the hint, keyboard and validation shape.
 */
export const LoginTotpStep: React.FC<LoginTotpStepProps> = ({
  emailHint,
  onVerify,
  onBack,
  onModeChange,
  loading,
  error,
  isAr,
  ArrowIcon,
}) => {
  const [mode, setMode] = useState<'app' | 'recovery'>('app');
  const [code, setCode] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value || loading) return;
    await onVerify(value);
  };

  const canSubmit = mode === 'app' ? code.length === 6 : code.replace(/[^A-Z0-9]/gi, '').length >= 10;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-heading">
          {isAr ? 'التحقق بتطبيق المصادقة' : 'Authenticator App Verification'}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1 leading-relaxed">
          {isAr ? 'أدخل الرمز الظاهر في تطبيق المصادقة لحساب ' : 'Enter the code shown in your authenticator app for '}
          <span className="font-mono font-bold text-heading inline-block" dir="ltr">{emailHint}</span>
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {mode === 'app' ? (
          <div>
            <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
              {isAr ? 'رمز التطبيق (6 أرقام)' : 'App Code (6 digits)'}
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
        ) : (
          <div>
            <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
              {isAr ? 'رمز الاسترداد' : 'Recovery Code'}
            </label>
            <input
              type="text"
              required
              autoFocus
              dir="ltr"
              autoComplete="one-time-code"
              maxLength={11}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
              placeholder="XXXXX-XXXXX"
              className="w-full py-3.5 px-4 rounded-xl bg-canvas border border-muted-border/50 text-lg font-mono text-center tracking-[0.2em] text-heading outline-none focus:border-accent"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
        >
          {loading ? (
            <span>{isAr ? 'جاري التحقق...' : 'Verifying...'}</span>
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
          onClick={() => {
            setMode((prev) => (prev === 'app' ? 'recovery' : 'app'));
            setCode('');
            onModeChange();
          }}
          className="text-accent hover:underline font-bold cursor-pointer transition-colors flex items-center gap-1.5"
        >
          {mode === 'app' ? <LifeBuoy className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          <span>
            {mode === 'app'
              ? isAr
                ? 'استخدام رمز استرداد'
                : 'Use a recovery code'
              : isAr
                ? 'استخدام رمز التطبيق'
                : 'Use the app code'}
          </span>
        </button>
      </div>
    </div>
  );
};
