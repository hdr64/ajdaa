import React, { useEffect, useState } from 'react';
import { Save, History, Archive, Search } from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import type { CmsPastWorksPageContent, CmsSeoMeta } from '../../../types/cms';
import { DEFAULT_PAST_WORKS_PAGE } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';

export const CmsPastWorksPanel: React.FC = () => {
  const { showToast, can } = useAdmin();
  const { t } = useAdminT();
  const [data, setData] = useState<CmsPastWorksPageContent>(DEFAULT_PAST_WORKS_PAGE);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');

  const fetchPastWorks = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ key: string; content: CmsPastWorksPageContent; version: number }>(
        '/cms/content/pastWorks'
      );
      if (res && res.content) {
        setData({
          ...DEFAULT_PAST_WORKS_PAGE,
          ...res.content,
          seo: res.content.seo ?? {},
        });
        setVersion(res.version);
      }
    } catch {
      setData(DEFAULT_PAST_WORKS_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api
      .get<{ key: string; content: CmsPastWorksPageContent; version: number }>(
        '/cms/content/pastWorks'
      )
      .then((res) => {
        if (!active) return;
        if (res && res.content) {
          setData({
            ...DEFAULT_PAST_WORKS_PAGE,
            ...res.content,
            seo: res.content.seo ?? {},
          });
          setVersion(res.version);
        }
      })
      .catch(() => {
        if (!active) return;
        setData(DEFAULT_PAST_WORKS_PAGE);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    if (!canManage) {
      showToast(t('cms.pastWorks.noPermission'));
      return;
    }

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/pastWorks',
        data
      );
      setVersion(res.version);
      showToast(t('cms.pastWorks.saveSuccess'));
    } catch (caught) {
      showToast(getErrorMessage(caught, t('cms.pastWorks.saveError')));
    } finally {
      setSaving(false);
    }
  };

  const updateSeo = (patch: Partial<CmsSeoMeta>) => {
    setData((prev) => ({
      ...prev,
      seo: { ...prev.seo, ...patch },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-text/60">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
        {t('cms.pastWorks.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl brand-fill text-canvas flex items-center justify-center shadow-xs shrink-0">
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-heading">{t('cms.pastWorks.title')}</h3>
            <p className="text-xs text-neutral-text/70">{t('cms.pastWorks.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVersionModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-muted-border/40 hover:bg-canvas text-neutral-text hover:text-heading transition cursor-pointer"
          >
            <History className="w-4 h-4" />
            {t('cms.common.historyButton', { version })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canManage}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl brand-fill text-canvas shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                {t('cms.common.saving')}
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                {t('cms.common.saveChanges')}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Form */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-muted-border/30 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Badge */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.badgeAr')}
            </label>
            <input
              type="text"
              value={data.badgeAr}
              maxLength={100}
              onChange={(e) => setData((prev) => ({ ...prev, badgeAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.badgeEn')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.badgeEn}
              maxLength={100}
              onChange={(e) => setData((prev) => ({ ...prev, badgeEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>

          {/* Heading */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.headingAr')}
            </label>
            <input
              type="text"
              value={data.titleAr}
              maxLength={150}
              onChange={(e) => setData((prev) => ({ ...prev, titleAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.headingEn')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.titleEn}
              maxLength={150}
              onChange={(e) => setData((prev) => ({ ...prev, titleEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.subtitleAr')}
            </label>
            <textarea
              rows={3}
              value={data.subtitleAr}
              maxLength={500}
              onChange={(e) => setData((prev) => ({ ...prev, subtitleAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.subtitleEn')}
            </label>
            <textarea
              rows={3}
              dir="ltr"
              value={data.subtitleEn}
              maxLength={500}
              onChange={(e) => setData((prev) => ({ ...prev, subtitleEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>

          {/* Empty Text */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.emptyTextAr')}
            </label>
            <input
              type="text"
              value={data.emptyTextAr}
              maxLength={200}
              onChange={(e) => setData((prev) => ({ ...prev, emptyTextAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.pastWorks.emptyTextEn')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.emptyTextEn}
              maxLength={200}
              onChange={(e) => setData((prev) => ({ ...prev, emptyTextEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
        </div>
      </div>

      {/* SEO Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-surface border border-muted-border/30 space-y-6">
        <div className="flex items-center gap-3 pb-3 border-b border-muted-border/30">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-heading">{t('cms.seo.sectionTitle')}</h4>
            <p className="text-[11px] text-neutral-text/60">{t('cms.seo.sectionSubtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.seo.metaTitleAr')}
            </label>
            <input
              type="text"
              value={data.seo?.metaTitleAr ?? ''}
              maxLength={70}
              onChange={(e) => updateSeo({ metaTitleAr: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.seo.metaTitleEn')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.seo?.metaTitleEn ?? ''}
              maxLength={70}
              onChange={(e) => updateSeo({ metaTitleEn: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.seo.metaDescriptionAr')}
            </label>
            <textarea
              rows={2}
              value={data.seo?.metaDescriptionAr ?? ''}
              maxLength={160}
              onChange={(e) => updateSeo({ metaDescriptionAr: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.seo.metaDescriptionEn')}
            </label>
            <textarea
              rows={2}
              dir="ltr"
              value={data.seo?.metaDescriptionEn ?? ''}
              maxLength={160}
              onChange={(e) => updateSeo({ metaDescriptionEn: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.seo.keywordsAr')}
            </label>
            <input
              type="text"
              value={data.seo?.keywordsAr ?? ''}
              maxLength={300}
              onChange={(e) => updateSeo({ keywordsAr: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.seo.keywordsEn')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.seo?.keywordsEn ?? ''}
              maxLength={300}
              onChange={(e) => updateSeo({ keywordsEn: e.target.value })}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
        </div>
      </div>

      {/* Version History Modal */}
      <CmsVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        sectionKey="pastWorks"
        sectionTitle={t('cms.pastWorks.title')}
        currentVersion={version}
        onRollbackSuccess={fetchPastWorks}
      />
    </div>
  );
};
