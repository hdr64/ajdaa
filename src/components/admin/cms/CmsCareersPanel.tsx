import React, { useEffect, useState } from 'react';
import { Save, History, Briefcase, Search } from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import type { CmsCareersPageContent, CmsSeoMeta } from '../../../types/cms';
import { DEFAULT_CAREERS_PAGE } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';

export const CmsCareersPanel: React.FC = () => {
  const { showToast, can } = useAdmin();
  const { t } = useAdminT();
  const [data, setData] = useState<CmsCareersPageContent>(DEFAULT_CAREERS_PAGE);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');

  const fetchCareers = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ key: string; content: CmsCareersPageContent; version: number }>(
        '/cms/content/careers'
      );
      if (res && res.content) {
        setData({
          ...DEFAULT_CAREERS_PAGE,
          ...res.content,
          seo: res.content.seo ?? {},
        });
        setVersion(res.version);
      }
    } catch {
      setData(DEFAULT_CAREERS_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    api
      .get<{ key: string; content: CmsCareersPageContent; version: number }>(
        '/cms/content/careers'
      )
      .then((res) => {
        if (!active) return;
        if (res && res.content) {
          setData({
            ...DEFAULT_CAREERS_PAGE,
            ...res.content,
            seo: res.content.seo ?? {},
          });
          setVersion(res.version);
        }
      })
      .catch(() => {
        if (!active) return;
        setData(DEFAULT_CAREERS_PAGE);
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
      showToast(t('cms.careers.noPermission'));
      return;
    }

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/careers',
        data
      );
      setVersion(res.version);
      showToast(t('cms.careers.saveSuccess'));
    } catch (caught) {
      showToast(getErrorMessage(caught, t('cms.careers.saveError')));
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
        {t('cms.careers.loading')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl brand-fill text-canvas flex items-center justify-center shadow-xs shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-heading">{t('cms.careers.title')}</h3>
            <p className="text-xs text-neutral-text/70">{t('cms.careers.subtitle')}</p>
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
          {/* Form Title */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.formTitleAr')}
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
              {t('cms.careers.formTitleEn')}
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

          {/* Intro Text */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.introAr')}
            </label>
            <textarea
              rows={3}
              value={data.introAr}
              maxLength={1000}
              onChange={(e) => setData((prev) => ({ ...prev, introAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.introEn')}
            </label>
            <textarea
              rows={3}
              dir="ltr"
              value={data.introEn}
              maxLength={1000}
              onChange={(e) => setData((prev) => ({ ...prev, introEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>

          {/* Success Title */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.successTitleAr')}
            </label>
            <input
              type="text"
              value={data.successTitleAr}
              maxLength={150}
              onChange={(e) => setData((prev) => ({ ...prev, successTitleAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.successTitleEn')}
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.successTitleEn}
              maxLength={150}
              onChange={(e) => setData((prev) => ({ ...prev, successTitleEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition"
            />
          </div>

          {/* Success Text */}
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.successTextAr')}
            </label>
            <textarea
              rows={2}
              value={data.successTextAr}
              maxLength={500}
              onChange={(e) => setData((prev) => ({ ...prev, successTextAr: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
              {t('cms.careers.successTextEn')}
            </label>
            <textarea
              rows={2}
              dir="ltr"
              value={data.successTextEn}
              maxLength={500}
              onChange={(e) => setData((prev) => ({ ...prev, successTextEn: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl bg-canvas border border-muted-border/40 text-sm text-heading outline-none focus:border-primary/60 transition resize-none"
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
        sectionKey="careers"
        sectionTitle={t('cms.careers.title')}
        currentVersion={version}
        onRollbackSuccess={fetchCareers}
      />
    </div>
  );
};
