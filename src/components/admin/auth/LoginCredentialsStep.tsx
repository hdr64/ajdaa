import React from 'react';
import { Mail, Lock, AlertCircle, CheckCircle2, type LucideIcon } from 'lucide-react';

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
  isAr: boolean;
  ArrowIcon: LucideIcon;
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
  isAr,
  ArrowIcon,
}) => {
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
            {isAr ? 'البريد الإلكتروني للإدارة' : 'Admin Email'}
          </label>
          <div className="relative flex items-center">
            <Mail className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ajdaa.sa"
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-neutral-text/70 mb-1.5">
            {isAr ? 'كلمة المرور' : 'Password'}
          </label>
          <div className="relative flex items-center">
            <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
            <input
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            />
          </div>
          <div className="flex justify-end pt-1.5">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[11px] font-bold text-accent hover:underline cursor-pointer transition-colors"
            >
              {isAr ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
            </button>
          </div>
        </div>

        {/* Helper credentials note */}
        <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 text-[11px] text-neutral-text/70 flex items-center justify-between font-mono">
          <span>user: admin@ajdaa.sa</span>
          <span>pass: password</span>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span>{isAr ? 'جاري التحقق...' : 'Signing in...'}</span>
          ) : (
            <>
              <span>{isAr ? 'تسجيل الدخول إلى النظام' : 'Sign In to Dashboard'}</span>
              <ArrowIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-muted-border/30 text-center">
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-xs font-bold text-neutral-text/60 hover:text-accent transition cursor-pointer"
        >
          {isAr ? '← العودة للموقع الرئيسي' : '← Return to Main Website'}
        </button>
      </div>
    </>
  );
};
