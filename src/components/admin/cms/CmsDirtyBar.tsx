import React from 'react';
import { Save, Undo2 } from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface CmsDirtyBarProps {
  dirty: boolean;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/** Sticky bar shown only while a CMS panel has unsaved edits. */
export const CmsDirtyBar: React.FC<CmsDirtyBarProps> = ({ dirty, saving, canSave, onSave, onDiscard }) => {
  const { confirm } = useAdmin();
  const { t } = useAdminT();
  if (!dirty) return null;

  const handleDiscard = async () => {
    const ok = await confirm({
      title: t('cms.dirty.discardConfirmTitle'),
      message: t('cms.dirty.discardConfirmMessage'),
      confirmLabel: t('cms.dirty.discard'),
      danger: true,
    });
    if (ok) onDiscard();
  };

  return (
    <div
      role="status"
      className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-surface px-4 py-3 shadow-lg"
    >
      <span className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
        {t('cms.dirty.label')}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleDiscard()}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl border border-muted-border/40 px-3.5 py-2 text-xs font-semibold text-neutral-text transition hover:bg-canvas hover:text-heading disabled:opacity-50 cursor-pointer"
        >
          <Undo2 className="h-4 w-4" />
          {t('cms.dirty.discard')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !canSave}
          className="flex items-center gap-2 rounded-xl brand-fill px-4 py-2 text-xs font-bold text-canvas shadow-xs transition hover:opacity-95 disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          {saving ? t('cms.common.saving') : t('cms.common.saveChanges')}
        </button>
      </div>
    </div>
  );
};
