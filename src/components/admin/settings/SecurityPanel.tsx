import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { securitySettingsApi, type SecuritySettings } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { SectionError, SectionLoading } from '../common/SectionState';

/** Login policy for every admin. Super admin only. */
export const SecurityPanel: React.FC = () => {
  const { showToast, confirm } = useAdmin();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    securitySettingsApi
      .get(controller.signal)
      .then(setSettings)
      .catch((caught) => {
        if (!controller.signal.aborted) setError(getErrorMessage(caught, 'تعذر تحميل إعدادات الأمان'));
      });
    return () => controller.abort();
  }, [reloadToken]);

  if (error) return <SectionError message={error} onRetry={() => setReloadToken((n) => n + 1)} />;
  if (!settings) return <SectionLoading label="جاري تحميل إعدادات الأمان..." />;

  const effective = settings.loginOtpRequired || settings.loginOtpForcedByEnv;

  const toggle = async () => {
    const next = !settings.loginOtpRequired;
    const ok = await confirm({
      title: next ? 'إلزام كل المسؤولين برمز الدخول؟' : 'إلغاء إلزام رمز الدخول للجميع؟',
      message: next
        ? 'سيُطلب من كل مسؤول رمز يصل إلى بريده عند كل تسجيل دخول. تأكد أولاً أن إرسال البريد يعمل (تبويب البريد ← إرسال بريد تجريبي)، وإلا لن يتمكن أحد من الدخول.'
        : 'سيعود كل مسؤول إلى إعداده الشخصي في صفحة الملف الشخصي.',
      confirmLabel: next ? 'إلزام الرمز' : 'إلغاء الإلزام',
      danger: !next,
    });
    if (!ok) return;
    setSaving(true);
    try {
      setSettings(await securitySettingsApi.update(next));
      showToast(next ? 'أصبح رمز الدخول إلزامياً لكل المسؤولين' : 'أُلغي الإلزام العام لرمز الدخول');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ إعدادات الأمان'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-heading flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-accent" />
            رمز الدخول عبر البريد لكل المسؤولين
          </h3>
          <p className="text-[11px] text-neutral-text/60 leading-relaxed">
            عند التفعيل يُطلب من كل مسؤول رمز من 6 أرقام يصل إلى بريده بعد كلمة المرور، بغض النظر عن إعداده الشخصي.
          </p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            effective ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-canvas border-muted-border/40 text-neutral-text/60'
          }`}
        >
          {effective ? 'إلزامي' : 'اختياري لكل مسؤول'}
        </span>
      </div>

      {settings.loginOtpForcedByEnv ? (
        <p className="p-3 rounded-xl bg-accent/5 border border-accent/30 text-xs text-heading">
          مفروض من إعداد الخادم (<span dir="ltr" className="font-mono">LOGIN_OTP_REQUIRED</span>)، ولا يمكن إلغاؤه من هنا.
        </p>
      ) : (
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={saving}
          className={`font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50 ${
            settings.loginOtpRequired ? 'brand-btn-secondary' : 'brand-btn-primary'
          }`}
        >
          {settings.loginOtpRequired ? 'إلغاء الإلزام' : 'إلزام الجميع برمز الدخول'}
        </button>
      )}
    </div>
  );
};
