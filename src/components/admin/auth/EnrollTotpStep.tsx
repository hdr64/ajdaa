import React, { useEffect, useState } from 'react';
import { AlertCircle, Check, Copy, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react';
import { getErrorMessage } from '../../../services/api';
import { TotpQrCode } from '../common/TotpQrCode';

interface EnrollTotpStepProps {
  /** Fetches the pending secret and `otpauth://` URI for the enrollment token. */
  onLoad: () => Promise<{ otpauthUri: string; secret: string }>;
  /** Confirms a live code, switches TOTP on, and signs the admin in. */
  onVerify: (code: string) => Promise<void>;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  isAr: boolean;
  ArrowIcon: LucideIcon;
}

/**
 * Mandatory authenticator enrollment shown at login when the global switch is
 * on and the admin has not set TOTP up yet. Two sub-steps: scan the QR, then
 * prove the app works before a session is handed out.
 */
export const EnrollTotpStep: React.FC<EnrollTotpStepProps> = ({
  onLoad,
  onVerify,
  onBack,
  loading,
  error,
  isAr,
  ArrowIcon,
}) => {
  const [setup, setSetup] = useState<{ otpauthUri: string; secret: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadError(null);
    onLoad()
      .then((result) => {
        if (active) setSetup(result);
      })
      .catch((caught) => {
        if (active) setLoadError(getErrorMessage(caught, isAr ? 'تعذر بدء الإعداد' : 'Could not start setup'));
      });
    return () => {
      active = false;
    };
    // `onLoad` is stable for the lifetime of this step; re-running would mint a
    // fresh secret and invalidate the QR already on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copySecret = async () => {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret.replace(/\s/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || loading) return;
    await onVerify(code);
  };

  const shownError = error ?? loadError;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-3">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-heading">
          {isAr ? 'تفعيل التحقق بتطبيق المصادقة' : 'Set Up Authenticator Verification'}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1 leading-relaxed">
          {isAr
            ? 'هذا الحساب يتطلب التحقق بخطوتين. امسح الرمز بتطبيق مصادقة (Google Authenticator أو ما شابه) ثم أدخل الرمز الظاهر.'
            : 'This account requires two-step verification. Scan the code with an authenticator app (Google Authenticator or similar), then enter the code it shows.'}
        </p>
      </div>

      {shownError && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{shownError}</span>
        </div>
      )}

      {!setup && !loadError && (
        <p className="text-center text-xs text-neutral-text/60">{isAr ? 'جاري تحضير الرمز...' : 'Preparing the code...'}</p>
      )}

      {setup && (
        <>
          <div className="flex justify-center">
            <TotpQrCode
              uri={setup.otpauthUri}
              alt={isAr ? 'رمز QR لإعداد تطبيق المصادقة' : 'QR code to set up the authenticator app'}
            />
          </div>

          <div className="rounded-xl bg-canvas border border-muted-border/40 p-3 space-y-2">
            <p className="text-[11px] font-bold text-neutral-text/70 text-center">
              {isAr ? 'أو أدخل المفتاح يدوياً في التطبيق' : 'Or enter this key manually in the app'}
            </p>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 text-center text-xs font-mono font-bold text-heading break-all">
                {setup.secret}
              </code>
              <button
                type="button"
                onClick={() => void copySecret()}
                className="shrink-0 p-2 rounded-lg bg-surface border border-muted-border/40 text-neutral-text/70 hover:text-heading cursor-pointer"
                title={isAr ? 'نسخ المفتاح' : 'Copy key'}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
                {isAr ? 'رمز التطبيق (6 أرقام)' : 'App code (6 digits)'}
              </label>
              <input
                type="text"
                required
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
              disabled={loading || code.length !== 6}
              className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <span>{isAr ? 'جاري التفعيل...' : 'Enabling...'}</span>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{isAr ? 'تفعيل والمتابعة' : 'Enable and Continue'}</span>
                  <ArrowIcon className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </>
      )}

      <div className="pt-2 text-center text-xs">
        <button
          type="button"
          onClick={onBack}
          className="text-neutral-text/60 hover:text-heading font-bold cursor-pointer transition-colors"
        >
          {isAr ? '← العودة لتسجيل الدخول' : '← Back to Login'}
        </button>
      </div>
    </div>
  );
};
