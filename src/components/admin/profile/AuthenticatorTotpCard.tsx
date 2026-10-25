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
import { useAdminT } from '../../../i18n/admin';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { todayStamp } from '../../../services/download';
import { TotpQrCode } from '../common/TotpQrCode';

/** Which dialog is open; the enable flow has its own multi-step body. */
type DialogKind = 'enable' | 'regenerate' | 'disable' | null;
type EnableStep = 'password' | 'verify' | 'codes';

interface AuthenticatorTotpCardProps {
  isAr?: boolean;
}

/**
 * Authenticator-app (TOTP) two-factor card for the signed-in admin's profile:
 * enroll with a QR + confirm code + one-time recovery codes, regenerate those
 * codes, or disable the factor with the password and a live code.
 */
export const AuthenticatorTotpCard: React.FC<AuthenticatorTotpCardProps> = () => {
  const { currentUser, refreshUser, showToast } = useAdmin();
  const { t } = useAdminT();

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

  /** Copies text, reporting success so a small tick can replace the icon. */
  const copy = async (textToCopy: string, onDone: (ok: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      onDone(true);
      setTimeout(() => onDone(false), 2000);
    } catch {
      onDone(false);
    }
  };

  /** Saves the one-time codes as a plain-text file, since they are shown only once. */
  const downloadCodes = () => {
    if (!codes) return;
    const header = t('profile.totp.downloadHeader');
    const body = [
      header,
      '',
      ...codes,
      '',
      t('profile.totp.downloadNote'),
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
        showToast(t('profile.totp.disableSuccess'));
      }
    } catch (caught) {
      setError(
        getErrorMessage(caught, t('profile.totp.actionError'))
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
        getErrorMessage(caught, t('profile.totp.codeInvalid'))
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
      regenerated ? t('profile.totp.regenerateSuccess') : t('profile.totp.enableSuccess')
    );
  };

  /* -------------------------------- Markup ------------------------------- */

  const DIALOG_TITLE_KEYS: Record<Exclude<DialogKind, null>, 'profile.totp.dialogEnableTitle' | 'profile.totp.dialogRegenerateTitle' | 'profile.totp.dialogDisableTitle'> = {
    enable: 'profile.totp.dialogEnableTitle',
    regenerate: 'profile.totp.dialogRegenerateTitle',
    disable: 'profile.totp.dialogDisableTitle',
  };
  const dialogTitle = dialog && t(DIALOG_TITLE_KEYS[dialog]);

  return (
    <>
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-muted-border/30">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-heading">
              {t('profile.totp.title')}
            </h2>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {t('profile.totp.subtitle')}
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
                  {t('profile.totp.statusLabel')}
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    enabled
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                  }`}
                >
                  {enabled ? t('profile.enabled') : t('profile.disabled')}
                </span>
              </div>
              <p className="text-[11px] text-neutral-text/60 mt-0.5">
                {enabled
                  ? t('profile.totp.enabledDesc', { count: codesLeft })
                  : t('profile.totp.disabledDesc')}
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
                  {t('profile.totp.regenerateBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => open('disable')}
                  className="cursor-pointer text-xs font-bold px-4 py-2 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                >
                  {t('profile.totp.disableBtn')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => open('enable')}
                className="cursor-pointer text-xs font-bold px-4 py-2 rounded-xl brand-btn-primary shadow-sm transition-all"
              >
                {t('profile.totp.enableBtn')}
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
                {dialogTitle}
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
                    ? t('profile.totp.disableNotice')
                    : t('profile.totp.step1Password')}
                </p>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
                    {t('profile.otp.dialogCurrentPassword')}
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
                      {t('profile.totp.codeOrRecovery')}
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
                    {t('profile.totp.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy || !password}
                    className={`px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm disabled:opacity-50 ${
                      dialog === 'disable' ? 'bg-red-500 hover:bg-red-600 text-white' : 'brand-btn-primary'
                    }`}
                  >
                    {busy ? t('profile.password.verifying') : dialog === 'disable' ? t('profile.totp.confirmDisable') : t('profile.totp.next')}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2 (enable) — scan the QR, then prove a live code. */}
            {step === 'verify' && setup && (
              <form onSubmit={submitCode} className="space-y-4">
                <p className="text-xs text-neutral-text/70 leading-relaxed">
                  {t('profile.totp.step2Scan')}
                </p>

                <div className="flex justify-center">
                  <TotpQrCode uri={setup.otpauthUri} alt="QR code" />
                </div>

                <div className="rounded-xl bg-canvas border border-muted-border/40 p-3 space-y-2">
                  <p className="text-[11px] font-bold text-neutral-text/70 text-center">
                    {t('profile.totp.manualKey')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code dir="ltr" className="flex-1 text-center text-xs font-mono font-bold text-heading break-all">
                      {setup.secret}
                    </code>
                    <button
                      type="button"
                      onClick={() => void copy(setup.secret.replace(/\s/g, ''), setSecretCopied)}
                      className="shrink-0 p-2 rounded-lg bg-surface border border-muted-border/40 text-neutral-text/70 hover:text-heading cursor-pointer"
                      title={t('profile.totp.copyKey')}
                    >
                      {secretCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5 text-center">
                    {t('profile.totp.step2CodePrompt')}
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
                    {t('profile.totp.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busy || code.length !== 6}
                    className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm brand-btn-primary disabled:opacity-50"
                  >
                    {busy ? t('profile.password.verifying') : t('profile.totp.finish')}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3 — the one-time recovery codes, shown exactly once. */}
            {step === 'codes' && codes && (
              <div className="space-y-4">
                <p className="text-xs text-neutral-text/70 leading-relaxed">
                  {t('profile.totp.step3CodesNotice')}
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
                    {t('profile.totp.copyCodes')}
                  </button>
                  <button
                    type="button"
                    onClick={downloadCodes}
                    className="cursor-pointer text-xs font-bold px-3.5 py-2 rounded-xl border border-muted-border/40 text-neutral-text/70 hover:bg-surface-hover flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {t('profile.totp.downloadCodes')}
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
                    {t('profile.totp.confirmSaved')}
                  </span>
                </label>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={finishCodes}
                    disabled={!savedConfirmed}
                    className="px-5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm brand-btn-primary disabled:opacity-50"
                  >
                    {t('profile.totp.finish')}
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
