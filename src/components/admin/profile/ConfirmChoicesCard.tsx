import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin';
import { getErrorMessage } from '../../../services/api';
import type { ConfirmAction } from '../../../services/authService';

const ACTION_KEY_MAP: Record<ConfirmAction, 'profile.confirm.actionUserStatus' | 'profile.confirm.actionProjectPublish' | 'profile.confirm.actionInquiryStatus' | 'profile.confirm.actionListenerEnabled'> = {
  'user.status': 'profile.confirm.actionUserStatus',
  'project.publish': 'profile.confirm.actionProjectPublish',
  'inquiry.status': 'profile.confirm.actionInquiryStatus',
  'listener.enabled': 'profile.confirm.actionListenerEnabled',
};

/** Lists the actions this admin chose "don't ask again" for, and brings the confirmations back. */
export const ConfirmChoicesCard: React.FC<{ isAr: boolean }> = () => {
  const { skipConfirm, setSkipConfirm, showToast } = useAdmin();
  const { t } = useAdminT();
  const [busy, setBusy] = useState(false);

  const update = async (actions: ConfirmAction[]) => {
    setBusy(true);
    try {
      await setSkipConfirm(actions);
      showToast(t('profile.confirm.success'));
    } catch (error) {
      showToast(getErrorMessage(error, t('profile.confirm.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-black text-heading">
          {t('profile.confirm.title')}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1">
          {t('profile.confirm.subtitle')}
        </p>
      </div>

      {skipConfirm.length === 0 ? (
        <p className="text-xs text-neutral-text/60">
          {t('profile.confirm.empty')}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {skipConfirm.map((action) => (
              <li
                key={action}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-canvas border border-muted-border/30 text-xs"
              >
                <span className="text-heading">{t(ACTION_KEY_MAP[action])}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void update(skipConfirm.filter((item) => item !== action))}
                  className="text-accent font-bold hover:underline cursor-pointer disabled:opacity-50"
                >
                  {t('profile.confirm.askAgain')}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void update([])}
            className="brand-btn-secondary font-bold px-4 py-2 rounded-xl text-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t('profile.confirm.resetAll')}
          </button>
        </>
      )}
    </div>
  );
};

