import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { getErrorMessage } from '../../../services/api';
import type { ConfirmAction } from '../../../services/authService';

const ACTION_LABELS: Record<ConfirmAction, { ar: string; en: string }> = {
  'user.status': { ar: 'تفعيل وتعطيل حسابات المستخدمين', en: 'Activate / suspend user accounts' },
  'project.publish': { ar: 'نشر المشاريع وإخفاؤها', en: 'Publish / hide projects' },
  'inquiry.status': { ar: 'تغيير حالة طلبات الاهتمام', en: 'Change inquiry status' },
  'listener.enabled': { ar: 'تفعيل وإيقاف مستمعات الإشعارات', en: 'Enable / disable notification listeners' },
};

/** Lists the actions this admin chose "don't ask again" for, and brings the confirmations back. */
export const ConfirmChoicesCard: React.FC<{ isAr: boolean }> = ({ isAr }) => {
  const { skipConfirm, setSkipConfirm, showToast } = useAdmin();
  const [busy, setBusy] = useState(false);

  const update = async (actions: ConfirmAction[]) => {
    setBusy(true);
    try {
      await setSkipConfirm(actions);
      showToast(isAr ? 'ستظهر رسائل التأكيد مجدداً' : 'Confirmations will be shown again');
    } catch (error) {
      showToast(getErrorMessage(error, isAr ? 'تعذر حفظ الاختيار' : 'Could not save the choice'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-7 shadow-xs space-y-4">
      <div>
        <h2 className="text-base font-black text-heading">
          {isAr ? 'اختيارات «لا تسألني مرة أخرى»' : '"Don\'t ask again" choices'}
        </h2>
        <p className="text-xs text-neutral-text/60 mt-1">
          {isAr
            ? 'الإجراءات التي اخترت تنفيذها دون رسالة تأكيد. الحذف يطلب التأكيد دائماً.'
            : 'Actions you chose to run without a confirmation. Deleting always asks.'}
        </p>
      </div>

      {skipConfirm.length === 0 ? (
        <p className="text-xs text-neutral-text/60">
          {isAr ? 'كل الإجراءات تطلب التأكيد حالياً.' : 'Every action currently asks for confirmation.'}
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {skipConfirm.map((action) => (
              <li
                key={action}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-canvas border border-muted-border/30 text-xs"
              >
                <span className="text-heading">{isAr ? ACTION_LABELS[action].ar : ACTION_LABELS[action].en}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void update(skipConfirm.filter((item) => item !== action))}
                  className="text-accent font-bold hover:underline cursor-pointer disabled:opacity-50"
                >
                  {isAr ? 'اسألني مجدداً' : 'Ask again'}
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
            {isAr ? 'إعادة تعيين الكل' : 'Reset all'}
          </button>
        </>
      )}
    </div>
  );
};
