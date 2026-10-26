import React, { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { securitySettingsApi, type SecuritySettings } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { SectionError, SectionLoading } from '../common/SectionState';
import { useAdminT } from '../../../i18n/admin';

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
  const { t } = useAdminT();
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
          {effective ? t('settings.security.mandatory') : t('settings.security.optional')}
        </span>
      </div>

      {isForced ? (
        <p className="p-3 rounded-xl bg-accent/5 border border-accent/30 text-xs text-heading">
          {t('settings.security.forced', { env: policy.forcedByEnv ?? '' })}
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
          {effective ? t('settings.security.release') : enableLabel}
        </button>
      )}
    </div>
  );
};

/** Login policy for every admin. Super admin only. */
export const SecurityPanel: React.FC = () => {
  const { t } = useAdminT();
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
        if (!controller.signal.aborted) setError(getErrorMessage(caught, t('settings.security.loadError')));
      });
    return () => controller.abort();
  }, [reloadToken, t]);

  if (error) return <SectionError message={error} onRetry={() => setReloadToken((n) => n + 1)} />;
  if (!settings) return <SectionLoading variant="form" label={t('settings.security.loading')} />;

  const save = async (input: { loginOtpRequired?: boolean; totpRequiredForAll?: boolean }, successMessage: string) => {
    setSaving(true);
    try {
      setSettings(await securitySettingsApi.update(input));
      showToast(successMessage);
    } catch (caught) {
      showToast(getErrorMessage(caught, t('settings.security.saveError')));
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
      title: next ? options.title : t('settings.security.cancelTitle', { title: options.title }),
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
        title={t('settings.security.emailOtp.title')}
        description={t('settings.security.emailOtp.desc')}
        policy={{
          value: settings.loginOtpRequired,
          forcedByEnv: settings.loginOtpForcedByEnv ? 'LOGIN_OTP_REQUIRED' : null,
        }}
        saving={saving}
        enableLabel={t('settings.security.emailOtp.enableLabel')}
        onToggle={() =>
          void toggle({
            title: t('settings.security.emailOtp.confirmTitle'),
            enforceMessage: t('settings.security.emailOtp.confirmMessage'),
            releaseMessage: t('settings.security.emailOtp.releaseMessage'),
            confirmLabel: t('settings.security.emailOtp.confirmBtn'),
            successMessage: t('settings.security.emailOtp.success'),
            releaseSuccessMessage: t('settings.security.emailOtp.releaseSuccess'),
            field: 'loginOtpRequired',
          })
        }
      />

      <SwitchCard
        icon={<KeyRound className="w-4 h-4 text-accent" />}
        title={t('settings.security.totp.title')}
        description={t('settings.security.totp.desc')}
        policy={{
          value: settings.totpRequiredForAll,
          forcedByEnv: settings.totpForcedByEnv ? 'TOTP_REQUIRED' : null,
        }}
        saving={saving}
        enableLabel={t('settings.security.totp.enableLabel')}
        onToggle={() =>
          void toggle({
            title: t('settings.security.totp.confirmTitle'),
            enforceMessage: t('settings.security.totp.confirmMessage'),
            releaseMessage: t('settings.security.totp.releaseMessage'),
            confirmLabel: t('settings.security.totp.confirmBtn'),
            successMessage: t('settings.security.totp.success'),
            releaseSuccessMessage: t('settings.security.totp.releaseSuccess'),
            field: 'totpRequiredForAll',
          })
        }
      />
    </div>
  );
};
