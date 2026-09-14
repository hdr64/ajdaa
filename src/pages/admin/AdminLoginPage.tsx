import React, { useState } from 'react';
import { AdminStorage } from '../../services/adminStorage';
import { ShieldCheck, Lock, Mail, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface AdminLoginPageProps {
  onLoginSuccess: () => void;
  onNavigateHome: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onLoginSuccess,
  onNavigateHome,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const [email, setEmail] = useState('admin@ajdaa.sa');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    setTimeout(() => {
      const ok = AdminStorage.login(email, password);
      setLoading(false);
      if (ok) {
        onLoginSuccess();
      } else {
        setError(isAr ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة' : 'Invalid email or password');
      }
    }, 400);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 relative bg-canvas">
      {/* Ambient background glows */}
      <div
        aria-hidden
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-accent/8 blur-[130px] rounded-full pointer-events-none"
      />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl brand-fill text-canvas shadow-lg mb-4">
            <ShieldCheck className="w-7 h-7 text-inherit" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-heading">
            {isAr ? 'بوابة إدارة أجدا العقارية' : 'Ajda Real Estate Admin'}
          </h1>
          <p className="text-xs text-neutral-text/60 mt-1.5">
            {isAr ? 'نظام إدارة المشاريع، الوحدات، وطلبات الاهتمام' : 'Real Estate Portfolio & Customer Inquiries Management'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-3xl bg-surface/90 border border-muted-border/40 p-6 sm:p-8 shadow-xl backdrop-blur-xl">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
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
              onClick={onNavigateHome}
              className="text-xs font-bold text-neutral-text/60 hover:text-accent transition cursor-pointer"
            >
              {isAr ? '← العودة للموقع الرئيسي' : '← Return to Main Website'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
