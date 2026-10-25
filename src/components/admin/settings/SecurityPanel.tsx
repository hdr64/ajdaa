import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { securitySettingsApi, type SecuritySettings } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { SectionError, SectionLoading } from '../common/SectionState';

/** Which server setting holds the value, and how this policy names it. */
interface PolicyField {
  /** Whether the rule is in force, before any server-side override. */
  value: boolean;
  /** The env var that forces the rule on, or `null` when nothing forces it. */
  forcedByEnv: string | null;
}

interface SwitchCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  policy: PolicyField;
  saving: boolean;
  enableLabel: string;
  onToggle: () => void;
}

/** One "require this for every admin" switch. Both policy cards share this shell. */
const SwitchCard: React.FC<SwitchCardProps> = ({
  icon,
  title,
  description,
  policy,
  saving,
  enableLabel,
  onToggle,
}) => {
  const isForced = policy.forcedByEnv !== null;
  const effective = policy.value || isForced;

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-black text-heading flex items-center gap-2">
            {icon}
            {title}
          </h3>
          <p className="text-[11px] text-neutral-text/60 leading-relaxed">{description}</p>
        </div>
        <span
          className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
            effective ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-canvas border-muted-border/40 text-neutral-text/60'
          }`}
        >
          {effective ? 'إلزامي' : 'اختياري لكل مسؤول'}
        </span>
      </div>

      {isForced ? (
        <p className="p-3 rounded-xl bg-accent/5 border border-accent/30 text-xs text-heading">
          مفروض من إعداد الخادم (<span dir="ltr" className="font-mono">{policy.forcedByEnv}</span>)، ولا يمكن إلغاؤه من هنا.
        </p>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          disabled={saving}
          className={`font-black px-4 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50 ${
            effective ? 'brand-btn-secondary' : 'brand-btn-primary'
          }`}
        >
          {effective ? 'إلغاء الإلزام' : enableLabel}
        </button>
      )}
    </div>
  );
};

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

  const save = async (input: { loginOtpRequired?: boolean; totpRequiredForAll?: boolean }, successMessage: string) => {
    setSaving(true);
    try {
      setSettings(await securitySettingsApi.update(input));
      showToast(successMessage);
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ إعدادات الأمان'));
    } finally {
      setSaving(false);
    }
  };

  /** Both switches ask the same question — enable for everyone, or hand it back to each admin. */
  const toggle = async (options: {
    title: string;
    enforceMessage: string;
    releaseMessage: string;
    confirmLabel: string;
    successMessage: string;
    releaseSuccessMessage: string;
    field: 'loginOtpRequired' | 'totpRequiredForAll';
  }) => {
    const next = !settings[options.field];
    const ok = await confirm({
      title: next ? options.title : `إلغاء ${options.title}`,
      message: next ? options.enforceMessage : options.releaseMessage,
      confirmLabel: options.confirmLabel,
      danger: !next,
    });
    if (!ok) return;
    await save({ [options.field]: next }, next ? options.successMessage : options.releaseSuccessMessage);
  };

  return (
    <div className="space-y-4">
      <SwitchCard
        icon={<ShieldCheck className="w-4 h-4 text-accent" />}
        title="رمز الدخول عبر البريد لكل المسؤولين"
        description="عند التفعيل يُطلب من كل مسؤول رمز من 6 أرقام يصل إلى بريده بعد كلمة المرور، بغض النظر عن إعداده الشخصي."
        policy={{
          value: settings.loginOtpRequired,
          forcedByEnv: settings.loginOtpForcedByEnv ? 'LOGIN_OTP_REQUIRED' : null,
        }}
        saving={saving}
        enableLabel="إلزام الجميع برمز الدخول"
        onToggle={() =>
          void toggle({
            title: 'إلزام كل المسؤولين برمز الدخول',
            enforceMessage:
              'سيُطلب من كل مسؤول رمز يصل إلى بريده عند كل تسجيل دخول. تأكد أولاً أن إرسال البريد يعمل (تبويب البريد ← إرسال بريد تجريبي)، وإلا لن يتمكن أحد من الدخول.',
            releaseMessage: 'سيعود كل مسؤول إلى إعداده الشخصي في صفحة الملف الشخصي.',
            confirmLabel: 'إلزام الرمز',
            successMessage: 'أصبح رمز الدخول إلزامياً لكل المسؤولين',
            releaseSuccessMessage: 'أُلغي الإلزام العام لرمز الدخول',
            field: 'loginOtpRequired',
          })
        }
      />

      <SwitchCard
        icon={<KeyRound className="w-4 h-4 text-accent" />}
        title="تطبيق المصادقة (التحقق بخطوتين) لكل المسؤولين"
        description="عند التفعيل يجب على كل مسؤول – بمن فيهم المدير العام – ربط تطبيق مصادقة قبل الدخول، ويُوجَّه غير المُفعَّل إلى شاشة إعداد فورية."
        policy={{
          value: settings.totpRequiredForAll,
          forcedByEnv: settings.totpForcedByEnv ? 'TOTP_REQUIRED' : null,
        }}
        saving={saving}
        enableLabel="إلزام الجميع بتطبيق المصادقة"
        onToggle={() =>
          void toggle({
            title: 'إلزام كل المسؤولين بتطبيق المصادقة',
            enforceMessage:
              'سيُطلب من كل مسؤول – بمن فيهم المدير العام – إعداد تطبيق مصادقة (مثل Google Authenticator) قبل الدخول. من لا يملك الطلب سيُوجَّه إلى شاشة الإعداد عند أول تسجيل دخول.',
            releaseMessage:
              'سيعود التحقق بتطبيق المصادقة اختيارياً لكل مسؤول، ويمكنه تعطيله من صفحة الملف الشخصي.',
            confirmLabel: 'إلزام التطبيق',
            successMessage: 'أصبح تطبيق المصادقة إلزامياً لكل المسؤولين',
            releaseSuccessMessage: 'أُلغي الإلزام العام لتطبيق المصادقة',
            field: 'totpRequiredForAll',
          })
        }
      />
    </div>
  );
};
