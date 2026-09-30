import React, { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  History,
} from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { CmsNavItem } from '../../../types/cms';
import { DEFAULT_NAV_ITEMS } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';

export const CmsNavPanel: React.FC = () => {
  const { showToast, confirm, can } = useAdmin();
  const [items, setItems] = useState<CmsNavItem[]>([]);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');

  const fetchNav = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ key: string; content: CmsNavItem[]; version: number }>(
        '/cms/content/nav'
      );
      if (res && Array.isArray(res.content)) {
        setItems(res.content);
        setVersion(res.version);
      } else {
        setItems(DEFAULT_NAV_ITEMS);
      }
    } catch {
      setItems(DEFAULT_NAV_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNav();
  }, []);

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    // Update order indices
    setItems(updated.map((item, idx) => ({ ...item, order: idx + 1 })));
  };

  const handleUpdateItem = (index: number, patch: Partial<CmsNavItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleAddItem = () => {
    const newItem: CmsNavItem = {
      id: `nav-${Date.now()}`,
      labelAr: 'رابط جديد',
      labelEn: 'New Link',
      page: 'custom',
      url: 'https://',
      order: items.length + 1,
      enabled: true,
      isCta: false,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleDeleteItem = async (index: number) => {
    const item = items[index];
    const ok = await confirm({
      title: 'حذف الرابط',
      message: `هل أنت متأكد من حذف الرابط "${item.labelAr}" من القائمة؟`,
      confirmLabel: 'حذف الرابط',
      danger: true,
    });
    if (!ok) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل محتوى القائمة');
      return;
    }

    // Validation
    for (const it of items) {
      if (!it.labelAr.trim() || !it.labelEn.trim()) {
        showToast('يرجى ملء جميع عناوين الروابط باللغتين العربية والإنجليزية');
        return;
      }
      if (it.page === 'custom' && it.url && !it.url.startsWith('https://')) {
        showToast(`الرابط الخارجي لـ "${it.labelAr}" يجب أن يبدأ بـ https://`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>('/cms/content/nav', items);
      setVersion(res.version);
      showToast('تم حفظ تغييرات القائمة العلوية بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ القائمة العلوية'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-text/60">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
        جاري تحميل عناصر القائمة...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
        <div>
          <h3 className="text-base font-bold text-heading">عناصر شريط التنقل (Navbar)</h3>
          <p className="text-xs text-neutral-text/70">
            تحكم في الروابط المعروضة وترتيبها والوجهات الموجهة إليها وزر الإجراء الرئيسي.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVersionModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-muted-border/40 hover:bg-canvas text-neutral-text hover:text-heading transition cursor-pointer"
          >
            <History className="w-4 h-4" />
            السجل (الإصدار #{version})
          </button>
          <button
            type="button"
            onClick={handleAddItem}
            disabled={!canManage}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/50 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4 text-primary" />
            إضافة رابط جديد
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !canManage}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl brand-fill text-canvas shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            حفظ التغييرات
          </button>
        </div>
      </div>

      {/* Nav Items List */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border transition ${
              item.enabled
                ? 'bg-surface border-muted-border/30 hover:border-muted-border/60'
                : 'bg-surface/50 border-dashed border-muted-border/20 opacity-70'
            }`}
          >
            <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 justify-between">
              {/* Reorder and status */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    title="تحريك لأعلى"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="p-1 rounded-md hover:bg-canvas text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="تحريك لأسفل"
                    disabled={index === items.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="p-1 rounded-md hover:bg-canvas text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-7 h-7 rounded-lg bg-canvas text-neutral-text/70 flex items-center justify-center text-xs font-mono font-bold">
                  {index + 1}
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 flex-1 w-full">
                {/* Arabic Label */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان بالعربية
                  </label>
                  <input
                    type="text"
                    value={item.labelAr}
                    onChange={(e) => handleUpdateItem(index, { labelAr: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="مثال: الرئيسية"
                  />
                </div>

                {/* English Label */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان بالإنجليزية
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={item.labelEn}
                    onChange={(e) => handleUpdateItem(index, { labelEn: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                    placeholder="e.g. Home"
                  />
                </div>

                {/* Page Destination */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    وجهة الرابط
                  </label>
                  <select
                    value={item.page}
                    onChange={(e) =>
                      handleUpdateItem(index, {
                        page: e.target.value as CmsNavItem['page'],
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  >
                    <option value="home">الصفحة الرئيسية (/)</option>
                    <option value="works">صفحة المشاريع (/works)</option>
                    <option value="clients">العملاء والشركاء (/clients)</option>
                    <option value="booking">حجز معاينة (/booking)</option>
                    <option value="contact">تواصل معنا (/contact)</option>
                    <option value="custom">رابط خارجي مخصص</option>
                  </select>
                </div>

                {/* Custom URL if custom */}
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    {item.page === 'custom' ? 'الرابط المباشر (https://)' : 'الحالة والإجراء'}
                  </label>
                  {item.page === 'custom' ? (
                    <input
                      type="url"
                      dir="ltr"
                      value={item.url || ''}
                      onChange={(e) => handleUpdateItem(index, { url: e.target.value })}
                      className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                      placeholder="https://example.com"
                    />
                  ) : (
                    <div className="flex items-center gap-3 pt-1">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.isCta || false}
                          onChange={(e) => handleUpdateItem(index, { isCta: e.target.checked })}
                          className="rounded text-primary focus:ring-0"
                        />
                        <span className="text-neutral-text">زر مميز (CTA)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Toggles & Delete */}
              <div className="flex items-center gap-3 shrink-0 self-end lg:self-center">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={(e) => handleUpdateItem(index, { enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-muted-border/40 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary relative" />
                  <span className="text-neutral-text text-[11px]">
                    {item.enabled ? 'مفعل' : 'معطل'}
                  </span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(index)}
                  className="p-1.5 rounded-xl text-neutral-text/50 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                  title="حذف هذا الرابط"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CmsVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        sectionKey="nav"
        sectionTitle="شريط التنقل (Navbar)"
        currentVersion={version}
        onRollbackSuccess={fetchNav}
      />
    </div>
  );
};
