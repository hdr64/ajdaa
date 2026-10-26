import React from 'react';
import { Mail, AlertCircle, CheckCircle2, KeyRound, type LucideIcon } from 'lucide-react';
import { useAdminT } from '../../../i18n/admin';
import { PasswordInput } from './PasswordInput';

interface LoginCredentialsStepProps {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
  onNavigateHome: () => void;
  loading: boolean;
  error: string | null;
  notice: string | null;
  isAr?: boolean;
  ArrowIcon: LucideIcon;
  supportsPasskeys?: boolean;
  passkeyLoading?: boolean;
  onPasskeyLogin?: () => void;
}

export const LoginCredentialsStep: React.FC<LoginCredentialsStepProps> = ({
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  onForgotPassword,
  onNavigateHome,
  loading,
  error,
  notice,
  ArrowIcon,
  supportsPasskeys = false,
  passkeyLoading = false,
  onPasskeyLogin,
}) => {
  const { t } = useAdminT();

  return (
    <>
      {notice && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {t('auth.emailLabel')}
          </label>
          <div className="relative flex items-center">
            <Mail className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {t('auth.passwordLabel')}
          </label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
          />
          <div className="flex justify-end pt-1.5">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[11px] font-bold text-accent hover:underline cursor-pointer transition-colors"
            >
              {t('auth.forgotPasswordBtn')}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || passkeyLoading}
          className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>{t('auth.signingIn')}</span>
          ) : (
            <>
              <span>{t('auth.signInToDashboard')}</span>
              <ArrowIcon className="w-4 h-4" />
            </>
          )}
        </button>

        {supportsPasskeys && (
          <button
            type="button"
            onClick={onPasskeyLogin}
            disabled={loading || passkeyLoading}
            className="w-full brand-btn-secondary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:bg-accent/10 disabled:opacity-50 mt-2"
          >
            <KeyRound className="w-4 h-4 text-accent" />
            <span>
              {passkeyLoading
                ? t('auth.passkeySigningIn')
                : t('auth.loginWithPasskey')}
            </span>
          </button>
        )}
      </form>

      <div className="mt-6 pt-5 border-t border-muted-border/30 text-center">
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-xs font-bold text-neutral-text/60 hover:text-accent transition cursor-pointer"
        >
          {t('auth.returnToMainWebsite')}
        </button>
      </div>
    </>
  );
};
