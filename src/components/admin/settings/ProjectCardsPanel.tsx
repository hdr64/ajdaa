import React, { useEffect, useState } from 'react';
import { Box, Save } from 'lucide-react';
import { siteSettingsApi, type ProjectCardsSettings, type SiteSettings } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { SectionError, SectionLoading } from '../common/SectionState';

/** Whether home-page project cards show a 3D button for projects that have a 3D model, video or page. */
export const ProjectCardsPanel: React.FC = () => {
  const { showToast } = useAdmin();
  const { t } = useAdminT();
  const { setSettings } = useSiteSettings();
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [projectCards, setProjectCards] = useState<ProjectCardsSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    siteSettingsApi
      .get(controller.signal)
      .then((settings) => {
        setSaved(settings);
        setProjectCards(settings.projectCards);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(getErrorMessage(caught, t('settings.projectCards.loadFailed')));
      });
    return () => controller.abort();
  }, [reloadToken, t]);

  if (error) return <SectionError message={error} onRetry={() => {
          setError(null);
          setReloadToken((n) => n + 1);
        }} />;
  if (!saved || !projectCards) return <SectionLoading variant="form" label={t('settings.projectCards.loading')} />;

  const dirty = projectCards.show3d !== saved.projectCards.show3d;

  const save = async () => {
    setSaving(true);
    try {
      // Latest first, so a concurrent save of another tab is not overwritten.
      const latest = await siteSettingsApi.get();
      const updated = await siteSettingsApi.update({ ...latest, projectCards });
      setSaved(updated);
      setProjectCards(updated.projectCards);
      setSettings(updated);
      showToast(t('settings.projectCards.saved'));
    } catch (caught) {
      showToast(getErrorMessage(caught, t('settings.projectCards.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
      <h3 className="text-sm font-black text-heading flex items-center gap-2">
        <Box className="w-4 h-4 text-accent" />
        {t('settings.projectCards.title')}
      </h3>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-bold text-heading cursor-pointer">
          <input
            type="checkbox"
            checked={projectCards.show3d}
            onChange={(e) => setProjectCards({ ...projectCards, show3d: e.target.checked })}
            className="w-4 h-4 cursor-pointer"
          />
          {t('settings.projectCards.show3dLabel')}
        </label>
        <p className="text-[11px] text-neutral-text/60">{t('settings.projectCards.hint')}</p>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4" />
        {t('settings.projectCards.save')}
      </button>
    </div>
  );
};
