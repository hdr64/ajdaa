import React, { useEffect, useState } from 'react';
import { Briefcase, Save } from 'lucide-react';
import { siteSettingsApi, type CareersVisibility, type SiteSettings } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { SectionError, SectionLoading } from '../common/SectionState';

/** Which public links lead to the Jobs page: the footer item and the floating button. */
export const CareersVisibilityPanel: React.FC = () => {
  const { showToast } = useAdmin();
  const { t } = useAdminT();
  const { setSettings } = useSiteSettings();
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [careers, setCareers] = useState<CareersVisibility | null>(null);
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
        setCareers(settings.careers);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(getErrorMessage(caught, t('settings.careers.loadFailed')));
      });
    return () => controller.abort();
  }, [reloadToken, t]);

  if (error) return <SectionError message={error} onRetry={() => setReloadToken((n) => n + 1)} />;
  if (!saved || !careers) return <SectionLoading label={t('settings.careers.loading')} />;

  const dirty =
    careers.showFooterLink !== saved.careers.showFooterLink ||
    careers.showFloatingButton !== saved.careers.showFloatingButton;

  const save = async () => {
    setSaving(true);
    try {
      // Latest first, so a concurrent save of another tab is not overwritten.
      const latest = await siteSettingsApi.get();
      const updated = await siteSettingsApi.update({ ...latest, careers });
      setSaved(updated);
      setCareers(updated.careers);
      setSettings(updated);
      showToast(t('settings.careers.saved'));
    } catch (caught) {
      showToast(getErrorMessage(caught, t('settings.careers.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof CareersVisibility, value: boolean) => setCareers({ ...careers, [key]: value });

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
      <h3 className="text-sm font-black text-heading flex items-center gap-2">
        <Briefcase className="w-4 h-4 text-accent" />
        {t('settings.careers.title')}
      </h3>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-bold text-heading cursor-pointer">
          <input
            type="checkbox"
            checked={careers.showFooterLink}
            onChange={(e) => set('showFooterLink', e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          {t('settings.careers.footerLabel')}
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-heading cursor-pointer">
          <input
            type="checkbox"
            checked={careers.showFloatingButton}
            onChange={(e) => set('showFloatingButton', e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          {t('settings.careers.buttonLabel')}
        </label>
      </div>
      <p className="text-[11px] text-neutral-text/60">{t('settings.careers.help')}</p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4" />
        {t('settings.careers.save')}
      </button>
    </div>
  );
};
