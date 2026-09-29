import React from 'react';
import { Mail, KeyRound, AlertCircle, type LucideIcon } from 'lucide-react';

interface ForgotPasswordStepProps {
  email: string;
  setEmail: (email: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
  isAr: boolean;
  ArrowIcon: LucideIcon;
}

export const ForgotPasswordStep: React.FC<ForgotPasswordStepProps> = ({
  email,
  setEmail,
  onSubmit,
  onBack,
  loading,
  error,
  isAr,
  ArrowIcon,
}) => {
  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 text-accent mb-3">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-heading">
          {isAr ? 'استعادة كلمة المرور' : 'Reset Password'}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1 leading-relaxed">
          {isAr
            ? 'أدخل بريدك الإلكتروني لإرسال رمز استعادة كلمة المرور'
            : 'Enter your admin email address to receive a verification code'}
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
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
              autoFocus
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ajdaa.sa"
              className="w-full ps-10 pe-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent font-mono"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full brand-btn-primary font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:shadow-lg disabled:opacity-50"
        >
          {loading ? (
            <span>{isAr ? 'جاري الإرسال...' : 'Sending code...'}</span>
          ) : (
            <>
              <span>{isAr ? 'إرسال رمز الاستعادة' : 'Send Reset Code'}</span>
              <ArrowIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-neutral-text/60 hover:text-heading cursor-pointer transition-colors"
        >
          {isAr ? '← العودة لتسجيل الدخول' : '← Back to Sign In'}
        </button>
      </div>
    </div>
  );
};
