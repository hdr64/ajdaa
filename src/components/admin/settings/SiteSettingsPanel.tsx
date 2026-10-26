import React, { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { siteSettingsApi, SOCIAL_KEYS, type SiteSettings, type SocialKey } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { SectionError, SectionLoading } from '../common/SectionState';
import { useAdminT } from '../../../i18n/admin';

const SOCIAL_LABELS: Record<SocialKey, string> = {
  x: 'X (Twitter)',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  snapchat: 'Snapchat',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: SiteSettings, t: (key: any, params?: any) => string): string | null {
  if (form.whatsapp && !/^\d{8,15}$/.test(form.whatsapp)) {
    return t('settings.site.whatsappError');
  }
  if (form.email && !EMAIL_REGEX.test(form.email)) return t('settings.site.emailError');
  const badSocial = SOCIAL_KEYS.find((key) => form.socials[key] && !form.socials[key].startsWith('https://'));
  if (badSocial) return t('settings.site.socialError', { network: SOCIAL_LABELS[badSocial] });
  return null;
}

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  dir?: 'ltr' | 'rtl';
  placeholder?: string;
  hint?: string;
}

const Field: React.FC<FieldProps> = ({ id, label, value, onChange, dir, placeholder, hint }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-xs font-bold text-neutral-text/70">
      {label}
    </label>
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir={dir}
      placeholder={placeholder}
      className={inputClass}
    />
    {hint && <p className="text-[10px] text-neutral-text/50">{hint}</p>}
  </div>
);

/** Contact details and social links shown across the public site. Super admin only. */
export const SiteSettingsPanel: React.FC = () => {
  const { t } = useAdminT();
  const { showToast } = useAdmin();
  const { setSettings } = useSiteSettings();
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);
    siteSettingsApi
      .get(controller.signal)
      .then((settings) => {
        setSaved(settings);
        setForm(settings);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(getErrorMessage(caught, t('settings.site.loadError')));
      });
    return () => controller.abort();
  }, [reloadToken, t]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  if (error) return <SectionError message={error} onRetry={() => setReloadToken((n) => n + 1)} />;
  if (!form) return <SectionLoading variant="form" label={t('settings.site.loading')} />;

  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  const setSocial = (key: SocialKey, value: string) =>
    setForm((prev) => (prev ? { ...prev, socials: { ...prev.socials, [key]: value.trim() } } : prev));

  const save = async () => {
    const trimmed: SiteSettings = {
      ...form,
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
    };
    const problem = validate(trimmed, t);
    if (problem) return showToast(problem);
    setSaving(true);
    try {
      // Only the contact fields belong to this tab; the announcement tab owns the rest.
      const latest = await siteSettingsApi.get();
      const updated = await siteSettingsApi.update({
        ...latest,
        phone: trimmed.phone,
        whatsapp: trimmed.whatsapp,
        email: trimmed.email,
        addressAr: trimmed.addressAr,
        addressEn: trimmed.addressEn,
        hoursAr: trimmed.hoursAr,
        hoursEn: trimmed.hoursEn,
        socials: trimmed.socials,
      });
      setSaved(updated);
      setForm(updated);
      setSettings(updated);
      showToast(t('settings.site.saveSuccess'));
    } catch (caught) {
      showToast(getErrorMessage(caught, t('settings.site.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
        <h3 className="text-sm font-black text-heading">{t('settings.site.contactData')}</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field id="site-phone" label={t('settings.site.phoneLabel')} value={form.phone} onChange={(v) => set('phone', v)} dir="ltr" placeholder="+966 58 048 4528" />
          <Field
            id="site-whatsapp"
            label={t('settings.site.whatsappLabel')}
            value={form.whatsapp}
            onChange={(v) => set('whatsapp', v)}
            dir="ltr"
            placeholder="966580484528"
            hint={t('settings.site.whatsappHint')}
          />
          <Field id="site-email" label={t('settings.site.emailLabel')} value={form.email} onChange={(v) => set('email', v)} dir="ltr" placeholder="info@example.com" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field id="site-address-ar" label={t('settings.site.addressArLabel')} value={form.addressAr} onChange={(v) => set('addressAr', v)} />
          <Field id="site-address-en" label={t('settings.site.addressEnLabel')} value={form.addressEn} onChange={(v) => set('addressEn', v)} dir="ltr" />
          <Field id="site-hours-ar" label={t('settings.site.hoursArLabel')} value={form.hoursAr} onChange={(v) => set('hoursAr', v)} />
          <Field id="site-hours-en" label={t('settings.site.hoursEnLabel')} value={form.hoursEn} onChange={(v) => set('hoursEn', v)} dir="ltr" />
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-black text-heading">{t('settings.site.socialTitle')}</h3>
          <p className="text-[11px] text-neutral-text/60 mt-1">{t('settings.site.socialHint')}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {SOCIAL_KEYS.map((key) => (
            <Field
              key={key}
              id={`site-social-${key}`}
              label={SOCIAL_LABELS[key]}
              value={form.socials[key]}
              onChange={(v) => setSocial(key, v)}
              dir="ltr"
              placeholder="https://"
            />
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4" />
        {saving ? t('settings.site.saving') : t('settings.site.saveBtn')}
      </button>
    </div>
  );
};
