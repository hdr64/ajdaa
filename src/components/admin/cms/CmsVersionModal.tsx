import React, { useEffect, useState } from 'react';
import { History, RotateCcw, X, Clock } from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';

interface VersionItem {
  id: string;
  version: number;
  createdAt: string;
  createdById?: string;
  content: unknown;
}

interface CmsVersionModalProps {
  sectionKey: string;
  sectionTitle: string;
  currentVersion?: number;
  open: boolean;
  onClose: () => void;
  onRollbackSuccess: () => void;
}

export const CmsVersionModal: React.FC<CmsVersionModalProps> = ({
  sectionKey,
  sectionTitle,
  currentVersion,
  open,
  onClose,
  onRollbackSuccess,
}) => {
  const { showToast, confirm } = useAdmin();
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<VersionItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get<VersionItem[]>(`/cms/content/${sectionKey}/versions`)
      .then((items) => {
        setVersions(items);
        if (items.length > 0) setSelectedVersion(items[0]);
      })
      .catch((err) => {
        showToast(getErrorMessage(err, 'تعذر تحميل سجل التعديلات'));
      })
      .finally(() => setLoading(false));
  }, [open, sectionKey, showToast]);

  if (!open) return null;

  const handleRollback = async (ver: VersionItem) => {
    const ok = await confirm({
      title: `استعادة الإصدار #${ver.version}`,
      message: `هل أنت متأكد من استرجاع هذا الإصدار السابق؟ سيتم تطبيق التغييرات فوراً على الموقع المباشر.`,
      confirmLabel: 'استعادة الإصدار',
      danger: true,
    });
    if (!ok) return;

    setRollingBack(true);
    try {
      await api.post(`/cms/content/${sectionKey}/rollback/${ver.version}`);
      showToast(`تم استعادة الإصدار #${ver.version} بنجاح`);
      onRollbackSuccess();
      onClose();
    } catch (err) {
      showToast(getErrorMessage(err, 'تعذر استعادة الإصدار'));
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-4xl bg-surface border border-muted-border/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-muted-border/30 bg-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl brand-fill text-canvas flex items-center justify-center shadow-xs">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-heading">سجل تعديلات وإصدارات: {sectionTitle}</h3>
              <p className="text-[11px] text-neutral-text/60">
                استعراض اللقطات السابقة مع إمكانية التراجع اللحظي بضغطة زر
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-neutral-text/60 hover:text-heading hover:bg-canvas transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-muted-border/30">
          {/* Versions List */}
          <div className="p-4 overflow-y-auto max-h-[400px] md:max-h-[600px] space-y-2">
            <div className="text-[11px] font-bold text-neutral-text/60 px-1 mb-2">
              النسخ المحفوظة ({versions.length})
            </div>
            {loading ? (
              <div className="text-center py-10 text-xs text-neutral-text/50">جاري تحميل السجل...</div>
            ) : versions.length === 0 ? (
              <div className="text-center py-10 text-xs text-neutral-text/50">لا توجد إصدارات سابقة بعد</div>
            ) : (
              versions.map((item) => {
                const isCurrent = currentVersion === item.version;
                const isSelected = selectedVersion?.version === item.version;
                const formattedDate = new Date(item.createdAt).toLocaleString('ar-SA', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                });
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedVersion(item)}
                    className={`w-full text-start p-3 rounded-2xl transition border cursor-pointer ${
                      isSelected
                        ? 'bg-canvas border-accent/40 shadow-xs'
                        : 'bg-surface/50 border-muted-border/20 hover:border-muted-border/40 hover:bg-canvas/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-black text-xs text-heading">إصدار #{item.version}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full brand-fill text-canvas">
                          النسخة الحالية
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-text/60">
                      <Clock className="w-3 h-3 text-accent" />
                      <span>{formattedDate}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Version Preview */}
          <div className="col-span-2 p-5 overflow-y-auto max-h-[400px] md:max-h-[600px] flex flex-col justify-between">
            {selectedVersion ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-muted-border/20">
                  <div>
                    <span className="text-xs font-black text-heading">
                      محتوى الإصدار #{selectedVersion.version}
                    </span>
                    <span className="text-[11px] text-neutral-text/50 block">
                      بتاريخ: {new Date(selectedVersion.createdAt).toLocaleString('ar-SA')}
                    </span>
                  </div>
                  {currentVersion !== selectedVersion.version && (
                    <button
                      onClick={() => handleRollback(selectedVersion)}
                      disabled={rollingBack}
                      className="brand-btn-primary font-black px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {rollingBack ? 'جاري الاستعادة...' : 'استعادة هذه النسخة'}
                    </button>
                  )}
                </div>

                <div className="rounded-2xl bg-canvas border border-muted-border/40 p-4 font-mono text-[11px] text-heading max-h-[420px] overflow-y-auto dir-ltr">
                  <pre>{JSON.stringify(selectedVersion.content, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-neutral-text/50">
                اختر إصداراً من القائمة الجانبية للاستعراض
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
