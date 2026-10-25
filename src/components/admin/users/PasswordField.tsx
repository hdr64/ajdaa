/**
 * Password field with show/hide, generator, copy button, and live policy checklist.
 * Uses crypto.getRandomValues for secure generation.
 */
import React, { useState, useCallback } from 'react';
import { Eye, EyeOff, Copy, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { MIN_PASSWORD_LENGTH, generateSecurePassword } from './usersModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface PasswordPolicyCheck {
  label: string;
  passed: boolean;
}

export const PasswordField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  error?: string;
  label?: string;
  hint?: React.ReactNode;
  showPolicyChecklist?: boolean;
  onGenerate?: () => void;
  generatedPassword?: string;
}> = ({
  value,
  onChange,
  error,
  hint,
  showPolicyChecklist = true,
  onGenerate,
  generatedPassword,
}) => {
  const { t, language } = useAdminT();
  const isEn = language === 'en';
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  const checks: PasswordPolicyCheck[] = [
    { label: t('users.policyLength', { count: MIN_PASSWORD_LENGTH }), passed: value.length >= MIN_PASSWORD_LENGTH },
    { label: t('users.policyLetter'), passed: /\p{L}/u.test(value) },
    { label: t('users.policyDigit'), passed: /\d/.test(value) },
  ];

  const allPassed = checks.every((c) => c.passed);

  const handleGenerate = useCallback(() => {
    const generated = generateSecurePassword();
    onChange(generated);
    onGenerate?.();
  }, [onChange, onGenerate]);

  const handleCopy = useCallback(async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedPassword]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          placeholder="••••••••"
          className={`w-full px-3 py-2.5 rounded-xl bg-canvas border text-xs text-heading outline-none transition ${
            error ? 'border-red-500/60' : 'border-muted-border/50 focus:border-accent'
          } pe-10 text-start`}
        />
        <button
          type="button"
          onClick={() => setShowPassword((visible) => !visible)}
          aria-label={showPassword ? (isEn ? 'Hide password' : 'إخفاء كلمة المرور') : (isEn ? 'Show password' : 'إظهار كلمة المرور')}
          className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
        >
          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleGenerate}
          className="px-3 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('users.generatePassword')}
        </button>

        {generatedPassword && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? t('users.copied') : t('users.copyPassword')}
            className="px-3 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">{t('users.copied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                {isEn ? 'Copy' : 'نسخ'}
              </>
            )}
          </button>
        )}
      </div>

      {generatedPassword && (
        <div className="p-2 rounded-lg bg-canvas/60 border border-muted-border/30 font-mono text-[10px] text-heading break-all select-all">
          {generatedPassword}
        </div>
      )}

      {showPolicyChecklist && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-bold text-neutral-text/70">
            {isEn ? 'Password policy:' : 'سياسة كلمة المرور:'}
          </p>
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-1.5 text-[10px]">
              {check.passed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              )}
              <span className={check.passed ? 'text-emerald-600' : 'text-red-500'}>
                {check.label}
              </span>
            </div>
          ))}
          {allPassed && value.length > 0 && (
            <p className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isEn ? 'Password satisfies policy' : 'كلمة المرور تفي بالسياسة'}
            </p>
          )}
        </div>
      )}

      {hint && !error && <p className="text-[10px] text-neutral-text/55 leading-relaxed">{hint}</p>}
      {error && <p role="alert" className="text-[10px] font-bold text-red-500">{error}</p>}
    </div>
  );
};