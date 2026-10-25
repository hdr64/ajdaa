import React, { useState } from 'react';
import {
  KeyRound,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  Laptop,
} from 'lucide-react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { authService } from '../../../services/authService';
import { getErrorMessage } from '../../../services/api';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import type { AdminUser } from '../../../types/admin';
import { PasswordInput } from './PasswordInput';

interface SuggestPasskeyStepProps {
  user: AdminUser;
  password: string;
  onContinue: () => void;
}

export const SuggestPasskeyStep: React.FC<SuggestPasskeyStepProps> = ({
  user,
  password,
  onContinue,
}) => {
  const { t, language } = useAdminT();
  const isAr = language === 'ar';

  const defaultDeviceName = `${isAr ? 'جهاز' : 'Device'} (${new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-US')})`;
  const [name, setName] = useState(defaultDeviceName);
  const [enteredPassword, setEnteredPassword] = useState(password);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleDismiss = (neverAgain = true) => {
    if (neverAgain && user.id) {
      localStorage.setItem(`ajda_passkey_prompt_dismissed_${user.id}`, 'true');
    }
    onContinue();
  };

  const handleCreatePasskey = async () => {
    if (!browserSupportsWebAuthn()) {
      setError(t('auth.passkeyUnsupported'));
      return;
    }

    const currentPwd = enteredPassword || password;
    if (!currentPwd) {
      setError(isAr ? 'يرجى إدخال كلمة المرور لتفعيل المفتاح' : 'Please enter your password to enable the passkey');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { options } = await authService.getPasskeyRegisterOptions(currentPwd);

      let regResponse;
      try {
        regResponse = await startRegistration({ optionsJSON: options });
      } catch (promptError: unknown) {
        if (
          promptError instanceof Error &&
          (promptError.name === 'NotAllowedError' || promptError.message.includes('cancel'))
        ) {
          setError(t('auth.passkeyCancelled'));
          setLoading(false);
          return;
        }
        throw promptError;
      }

      await authService.verifyPasskeyRegister(regResponse, name.trim() || defaultDeviceName);
      if (user.id) {
        localStorage.setItem(`ajda_passkey_prompt_dismissed_${user.id}`, 'true');
      }
      setSuccess(true);
      setTimeout(() => {
        onContinue();
      }, 1500);
    } catch (caught: unknown) {
      setError(getErrorMessage(caught, isAr ? 'تعذر إنشاء مفتاح المرور' : 'Failed to create passkey'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Header icon and greeting */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/15 border border-accent/30 text-accent mb-1 shadow-inner">
          <KeyRound className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-heading">
          {t('auth.suggestPasskeyTitle')}
        </h2>
        <p className="text-xs text-neutral-text/70 leading-relaxed max-w-sm mx-auto">
          {t('auth.suggestPasskeySubtitle')}
        </p>
      </div>

      {/* Success banner */}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{t('auth.passkeyCreatedSuccess')}</span>
        </div>
      )}

      {/* Error banner */}
      {error && !success && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Benefits list */}
      <div className="p-4 rounded-2xl bg-canvas/60 border border-muted-border/40 space-y-2.5">
        <div className="flex items-start gap-2.5 text-xs text-heading/90">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <span>{t('auth.suggestPasskeyBenefit1')}</span>
        </div>
        <div className="flex items-start gap-2.5 text-xs text-heading/90">
          <ShieldCheck className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <span>{t('auth.suggestPasskeyBenefit2')}</span>
        </div>
        <div className="flex items-start gap-2.5 text-xs text-heading/90">
          <Laptop className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
          <span>{t('auth.suggestPasskeyBenefit3')}</span>
        </div>
      </div>

      {/* Passkey Name Field */}
      {!success && (
        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {t('auth.suggestPasskeyNameLabel')}
          </label>
          <div className="relative flex items-center">
            <Smartphone className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.suggestPasskeyNamePlaceholder')}
              className="w-full ps-10 pe-4 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            />
          </div>
        </div>
      )}

      {!success && !password && (
        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {t('auth.suggestPasskeyPasswordLabel')}
          </label>
          <PasswordInput
            value={enteredPassword}
            onChange={setEnteredPassword}
            placeholder={t('auth.suggestPasskeyPasswordPlaceholder')}
            required
            isAr={isAr}
          />
        </div>
      )}

      {!success && password && (
        <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 flex items-center gap-2 text-[11px] text-accent font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-accent" />
          <span>{t('auth.passkeyDirectSetupTip')}</span>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2.5 pt-2">
        {!success ? (
          <>
            <button
              type="button"
              onClick={handleCreatePasskey}
              disabled={loading}
              className="w-full brand-btn-primary font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <LoaderCircle className="w-4 h-4 animate-spin" />
                  <span>{t('auth.creatingPasskey')}</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>{t('auth.createPasskeyBtn')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleDismiss(true)}
              disabled={loading}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-neutral-text/60 hover:text-heading transition-colors cursor-pointer"
            >
              {t('auth.skipForNow')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onContinue}
            className="w-full brand-btn-primary font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{t('auth.continueToDashboard')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
