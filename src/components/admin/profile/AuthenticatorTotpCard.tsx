import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  LifeBuoy,
  Lock,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { todayStamp } from '../../../services/download';
import { TotpQrCode } from '../common/TotpQrCode';

/** Which dialog is open; the enable flow has its own multi-step body. */
type DialogKind = 'enable' | 'regenerate' | 'disable' | null;
type EnableStep = 'password' | 'verify' | 'codes';

interface AuthenticatorTotpCardProps {
  isAr: boolean;
}

/**
 * Authenticator-app (TOTP) two-factor card for the signed-in admin's profile:
 * enroll with a QR + confirm code + one-time recovery codes, regenerate those
 * codes, or disable the factor with the password and a live code.
 */
export const AuthenticatorTotpCard: React.FC<AuthenticatorTotpCardProps> = ({ isAr }) => {
  const { currentUser, refreshUser, showToast } = useAdmin();

  const enabled = Boolean(currentUser?.totpEnabled);
  const codesLeft = currentUser?.recoveryCodesLeft ?? 0;

  const [dialog, setDialog] = useState<DialogKind>(null);
  const [step, setStep] = useState<EnableStep>('password');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ otpauthUri: string; secret: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [codesCopied, setCodesCopied] = useState(false);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDialog = () => {
    setPassword('');
    setCode('');
    setSetup(null);
    setCodes(null);
    setSecretCopied(false);
    setCodesCopied(false);
    setSavedConfirmed(false);
    setError(null);
  };

  const open = (kind: DialogKind) => {
    resetDialog();
    setStep('password');
    setDialog(kind);
  };

  const close = () => {
    setDialog(null);
    resetDialog();
  };

  /** Bilingual copy in one value, so callers never hand-roll `isAr ?…:…` again. */
  const text = (ar: string, en: string) => (isAr ? ar : en);

  /** Copies text, reporting success so a small tick can replace the icon. */
  const copy = async (text: string, onDone: (ok: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onDone(true);
      setTimeout(() => onDone(false), 2000);
    } catch {
      onDone(false);
    }
  };

  /** Saves the one-time codes as a plain-text file, since they are shown only once. */
  const downloadCodes = () => {
    if (!codes) return;
    const header = isAr ? 'أجدا العقارية — رموز استرداد التحقق بخطوتين' : 'Ajda Real Estate — two-step verification recovery codes';
    const body = [
      header,
      '',
      ...codes,
      '',
      isAr
        ? 'كل رمز يُستخدم مرة واحدة. احفظ هذا الملف في مكان آمن.'
        : 'Each code works once. Keep this file somewhere safe.',
    ].join('\r\n');
    const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `ajda-recovery-codes-${todayStamp()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
  };

  /* ------------------------------- Actions ------------------------------- */

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (dialog === 'enable') {
        setSetup(await AdminStorage.totpSetup(password));
        setStep('verify');
      } else if (dialog === 'regenerate') {
        const result = await AdminStorage.regenerateRecoveryCodes(password, code);
        setCodes(result.recoveryCodes);
        setStep('codes');
      } else if (dialog === 'disable') {
        await AdminStorage.totpDisable(password, code);
        close();
        void refreshUser();
        showToast(text('تم تعطيل التحقق بتطبيق المصادقة', 'Authenticator verification disabled'));
      }
    } catch (caught) {
      setError(
        getErrorMessage(caught, text('تعذر إكمال العملية، تحقق من البيانات', 'Could not complete the action, check your input'))
      );
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await AdminStorage.totpEnable(code);
      setCodes(result.recoveryCodes);
      setStep('codes');
    } catch (caught) {
      setError(
        getErrorMessage(caught, text('الرمز غير صحيح، حاول مرة أخرى', 'Invalid code, please try again'))
      );
    } finally {
      setBusy(false);
    }
  };

  const finishCodes = () => {
    const regenerated = dialog === 'regenerate';
    close();
    void refreshUser();
    showToast(
      text(
        regenerated ? 'تم إنشاء رموز استرداد جديدة' : 'تم تفعيل التحقق بتطبيق المصادقة',
        regenerated ? 'New recovery codes generated' : 'Authenticator verification enabled'
      )
    );
  };

  /* -------------------------------- Markup ------------------------------- */

  /** Title per dialog kind, so a new kind needs a row here rather than another branch. */
  const DIALOG_TITLES: Record<Exclude<DialogKind, null>, { ar: string; en: string }> = {
    enable: { ar: 'تفعيل التحقق بتطبيق المصادقة', en: 'Enable Authenticator Verification' },
    regenerate: { ar: 'إعادة إنشاء رموز الاسترداد', en: 'Regenerate Recovery Codes' },
    disable: { ar: 'تعطيل التحقق بتطبيق المصادقة', en: 'Disable Authenticator Verification' },
  };
  const dialogTitle = dialog && DIALOG_TITLES[dialog];

  return (
    <>
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-muted-border/30">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-heading">
              {isAr ? 'التحقق بخطوتين (تطبيق المصادقة)' : 'Two-Step Verification (Authenticator App)'}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {isAr
                ? 'رمز متغير كل 30 ثانية من تطبيق مثل Google Authenticator، بديلاً عن رمز البريد'
                : 'A 30-second rotating code from an app such as Google Authenticator, instead of the email code'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-canvas border border-muted-border/40">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                enabled
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25'
                  : 'bg-neutral-text/10 text-neutral-text/60 border border-muted-border/30'
              }`}
            >
              {enabled ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-heading">
                  {isAr ? 'حالة التطبيق:' : 'App status:'}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    enabled
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  }`}
                >
                  {enabled ? (isAr ? 'مفعل' : 'Enabled') : isAr ? 'معطل' : 'Disabled'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/60 mt-0.5">
                {enabled
                  ? isAr
                    ? `يُطلب رمز التطبيق عند كل تسجيل دخول، ويتبقى ${codesLeft} من رموز الاسترداد.`
                    : `The app code is required on each sign-in; ${codesLeft} recovery codes remain.`
                  : isAr
                    ? 'لم يتم ربط تطبيق مصادقة بهذا الحساب بعد.'
                    : 'No authenticator app is linked to this account yet.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {enabled ? (
              <>
                <button
                  type="button"
                  onClick={() => open('regenerate')}
                  className="cursor-pointer text-xs font-bold px-4 py-2 rounded-xl border border-muted-border/40 text-neutral-text/70 hover:bg-surface-hover transition-all"
                >
                  <RotateCw className="w-3.5 h-3.5 inline-block me-1.5" />
                  {isAr ? 'رموز جديدة' : 'New codes'}
                </button>
                <button
                  type="button"
                  onClick={() => open('disable')}
                  className="cursor-pointer text-xs font-bold px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  {isAr ? 'إلغاء التفعيل' : 'Turn off'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => open('enable')}
                className="cursor-pointer text-xs font-bold px-4 py-2 rounded-xl brand-btn-primary shadow-sm transition-all"
              >
                {isAr ? 'تفعيل الآن' : 'Enable now'}
              </button>
            )}
          </div>
        </div>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <h3 className="text-sm font-black text-heading flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                {dialogTitle && (isAr ? dialogTitle.ar : dialogTitle.en)}
              </h3>
              <button
                type="button"
                onClick={close}
                className="p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1 — prove identity with the password (and a code when disabling). */}
            {step === 'password' && (
              <form onSubmit={submitPassword} className="space-y-4">
                <p className="text-xs text-neutral-text/70 leading-relaxed">
                  {dialog === 'disable'
                    ? isAr
                      ? 'أدخل كلمة المرور الحالية ورمز التطبيق (أو رمز استرداد) لإلغاء التفعيل.'
                      : 'Enter your current password and an app code (or a recovery code) to turn it off.'
                    : isAr
                      ? 'لأسباب أمنية، أدخل كلمة المرور الحالية للمتابعة.'
                      : 'For security, enter your current password to continue.'}
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                    {isAr ? 'كلمة المرور الحالية' : 'Current password'}
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                    <input
                      type="password"
                      required
                      autoFocus
                      dir="ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                    />
                  </div>
                </div>

                {dialog === 'disable' && (
                  <div>
                    <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                      {isAr ? 'رمز التطبيق أو رمز الاسترداد' : 'App code or recovery code'}
                    </label>
                    <div className="relative flex items-center">
                      <LifeBuoy className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
                      <input
                        type="text"
                        required
                        dir="ltr"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11))}
                        placeholder="000000"
                        className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs font-mono text-heading outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-xl border border-muted-border/40 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !password}
                    className={`px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm disabled:opacity-50 ${
                      dialog === 'disable' ? 'bg-red-500 hover:bg-red-600 text-white' : 'brand-btn-primary'
                    }`}
                  >
                    {busy ? (isAr ? 'جاري التحقق...' : 'Verifying...') : isAr ? 'متابعة' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2 (enable) — scan the QR, then prove a live code. */}
            {step === 'verify' && setup && (
              <form onSubmit={submitCode} className="space-y-4">
                <p className="text-xs text-neutral-text/70 leading-relaxed">
                  {isAr
                    ? 'امسح الرمز بتطبيق المصادقة، أو أدخل المفتاح يدوياً، ثم أدخل الرمز المكوّن من 6 أرقام.'
                    : 'Scan the code with your authenticator app, or enter the key by hand, then type the 6-digit code.'}
                </p>

                <div className="flex justify-center">
                  <TotpQrCode uri={setup.otpauthUri} alt={isAr ? 'رمز QR' : 'QR code'} />
                </div>

                <div className="rounded-xl bg-canvas border border-muted-border/40 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-neutral-text/70 text-center">
                    {isAr ? 'المفتاح (للإدخال اليدوي)' : 'Key (for manual entry)'}
                  </p>
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="flex-1 text-center text-xs font-mono font-bold text-heading break-all">
                      {setup.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(setup.secret.replace(/\s/g, ''), setSecretCopied)}
                      className="shrink-0 p-2 rounded-lg bg-surface border border-muted-border/40 text-neutral-text/70 hover:text-heading cursor-pointer"
                      title={isAr ? 'نسخ المفتاح' : 'Copy key'}
                    >
                      {secretCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
                    {isAr ? 'رمز التطبيق (6 أرقام)' : 'App code (6 digits)'}
                  </label>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full py-3 px-4 rounded-xl bg-canvas border border-muted-border/50 text-lg font-mono text-center tracking-[0.4em] text-heading outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    className="px-4 py-2 rounded-xl border border-muted-border/40 text-xs font-bold text-neutral-text/70 hover:bg-surface-hover cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm brand-btn-primary disabled:opacity-50"
                  >
                    {busy ? (isAr ? 'جاري التفعيل...' : 'Enabling...') : isAr ? 'تأكيد التفعيل' : 'Confirm'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3 — the one-time recovery codes, shown exactly once. */}
            {step === 'codes' && codes && (
              <div className="space-y-4">
                <p className="text-xs text-neutral-text/70 leading-relaxed">
                  {isAr
                    ? 'احفظ رموز الاسترداد الآن. كل رمز يُستخدم مرة واحدة للدخول إذا فقدت هاتفك، ولن تُعرض مرة أخرى.'
                    : 'Save these recovery codes now. Each works once if you lose your phone, and they are never shown again.'}
                </p>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-canvas border border-muted-border/40">
                  {codes.map((value) => (
                    <code key={value} dir="ltr" className="text-xs font-mono font-bold text-heading text-center">
                      {value}
                    </code>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copy(codes.join('\n'), setCodesCopied)}
                    className="cursor-pointer text-xs font-bold px-3.5 py-2 rounded-xl border border-muted-border/40 text-neutral-text/70 hover:bg-surface-hover flex items-center gap-1.5"
                  >
                    {codesCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {isAr ? 'نسخ الكل' : 'Copy all'}
                  </button>
                  <button
                    type="button"
                    onClick={downloadCodes}
                    className="cursor-pointer text-xs font-bold px-3.5 py-2 rounded-xl border border-muted-border/40 text-neutral-text/70 hover:bg-surface-hover flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {isAr ? 'تنزيل ملف' : 'Download .txt'}
                  </button>
                </div>

                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={savedConfirmed}
                    onChange={(e) => setSavedConfirmed(e.target.checked)}
                    className="mt-0.5 accent-amber-500"
                  />
                  <span className="text-[11px] font-bold text-heading leading-relaxed">
                    {isAr
                      ? 'أؤكد أنني حفظت رموز الاسترداد في مكان آمن.'
                      : 'I confirm that I saved the recovery codes somewhere safe.'}
                  </span>
                </label>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={finishCodes}
                    disabled={!savedConfirmed}
                    className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm brand-btn-primary disabled:opacity-50"
                  >
                    {isAr ? 'تم' : 'Done'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
