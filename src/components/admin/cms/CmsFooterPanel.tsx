import React, { useEffect, useState } from 'react';
import {
  Save,
  History,
  Phone,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Share2,
  Building2,
} from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { CmsFooterSection, CmsSocialItem, CmsSocialIcon } from '../../../types/cms';
import { DEFAULT_FOOTER } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';

const SOCIAL_ICONS = [
  { value: 'x', label: 'X (تويتر)' },
  { value: 'instagram', label: 'إنستغرام' },
  { value: 'tiktok', label: 'تيك توك' },
  { value: 'snapchat', label: 'سناب شات' },
  { value: 'linkedin', label: 'لينكدإن' },
  { value: 'youtube', label: 'يوتيوب' },
  { value: 'facebook', label: 'فيسبوك' },
  { value: 'whatsapp', label: 'واتساب' },
  { value: 'telegram', label: 'تيليجرام' },
  { value: 'globe', label: 'موقع إلكتروني' },
];

export const CmsFooterPanel: React.FC = () => {
  const { showToast, confirm, can } = useAdmin();
  const [data, setData] = useState<CmsFooterSection>(DEFAULT_FOOTER);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');

  const fetchFooter = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ key: string; content: CmsFooterSection; version: number }>(
        '/cms/content/footer'
      );
      if (res && res.content) {
        setData(res.content);
        setVersion(res.version);
      }
    } catch {
      setData(DEFAULT_FOOTER);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFooter();
  }, []);

  const handleSave = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل محتوى التذييل');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/footer',
        data
      );
      setVersion(res.version);
      showToast('تم حفظ إعدادات الهوية والتذييل بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ بيانات التذييل'));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSocial = () => {
    const newSocial: CmsSocialItem = {
      id: `soc-${Date.now()}`,
      name: 'منصة جديدة',
      icon: 'x',
      url: 'https://',
      enabled: true,
      order: (data.socials?.length || 0) + 1,
    };
    setData((prev) => ({
      ...prev,
      socials: [...(prev.socials || []), newSocial],
    }));
  };

  const handleUpdateSocial = (index: number, patch: Partial<CmsSocialItem>) => {
    setData((prev) => {
      const copy = [...(prev.socials || [])];
      copy[index] = { ...copy[index], ...patch };
      return { ...prev, socials: copy };
    });
  };

  const handleDeleteSocial = async (index: number) => {
    const item = data.socials[index];
    const ok = await confirm({
      title: 'حذف المنصة',
      message: `هل أنت متأكد من حذف منصة التواصل "${item.name}"؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    setData((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }));
  };

  const handleMoveSocial = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (!data.socials || target < 0 || target >= data.socials.length) return;
    const copy = [...data.socials];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setData((prev) => ({
      ...prev,
      socials: copy.map((it, idx) => ({ ...it, order: idx + 1 })),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-text/60">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
        جاري تحميل بيانات التذييل...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
        <div>
          <h3 className="text-base font-bold text-heading">الهوية وبيانات التواصل والتذييل (Footer)</h3>
          <p className="text-xs text-neutral-text/70">
            تعديل النبذة التعريفية، أرقام التواصل والعناوين، النشرة البريدية وروابط شبكات التواصل الاجتماعي.
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Brand Summary */}
        <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <Building2 className="w-4 h-4 text-primary" />
            نبذة العلامة التجارية (أسفل الشعار)
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              النبذة بالعربية
            </label>
            <textarea
              rows={3}
              value={data.brandDescAr}
              onChange={(e) => setData({ ...data, brandDescAr: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              placeholder="اكتب نبذة مختصرة تظهر تحت الشعار في التذييل..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              النبذة بالإنجليزية
            </label>
            <textarea
              rows={3}
              dir="ltr"
              value={data.brandDescEn}
              onChange={(e) => setData({ ...data, brandDescEn: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              placeholder="English brand summary under logo..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                حقوق النشر (عربي)
              </label>
              <input
                type="text"
                value={data.copyrightAr}
                onChange={(e) => setData({ ...data, copyrightAr: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                حقوق النشر (إنجليزي)
              </label>
              <input
                type="text"
                dir="ltr"
                value={data.copyrightEn}
                onChange={(e) => setData({ ...data, copyrightEn: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Contact Points */}
        <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <Phone className="w-4 h-4 text-primary" />
            بيانات الاتصال والعناوين مع خيارات التفعيل
          </div>

          {/* Phone */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                رقم الهاتف المباشر
              </label>
              <input
                type="text"
                dir="ltr"
                value={data.phone}
                onChange={(e) => setData({ ...data, phone: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={data.phoneEnabled}
                  onChange={(e) => setData({ ...data, phoneEnabled: e.target.checked })}
                  className="rounded text-primary focus:ring-0"
                />
                <span className="text-neutral-text text-[11px]">مفعل</span>
              </label>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                رقم الواتساب (أرقام فقط بدون +)
              </label>
              <input
                type="text"
                dir="ltr"
                value={data.whatsapp}
                onChange={(e) => setData({ ...data, whatsapp: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                placeholder="966580484528"
              />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={data.whatsappEnabled}
                  onChange={(e) => setData({ ...data, whatsappEnabled: e.target.checked })}
                  className="rounded text-primary focus:ring-0"
                />
                <span className="text-neutral-text text-[11px]">مفعل</span>
              </label>
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                البريد الإلكتروني الرسمي
              </label>
              <input
                type="email"
                dir="ltr"
                value={data.email}
                onChange={(e) => setData({ ...data, email: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              />
            </div>
            <div className="pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={data.emailEnabled}
                  onChange={(e) => setData({ ...data, emailEnabled: e.target.checked })}
                  className="rounded text-primary focus:ring-0"
                />
                <span className="text-neutral-text text-[11px]">مفعل</span>
              </label>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-2 pt-1 border-t border-muted-border/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-text/70">
                العنوان والمقر الرئيسي
              </span>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={data.addressEnabled}
                  onChange={(e) => setData({ ...data, addressEnabled: e.target.checked })}
                  className="rounded text-primary focus:ring-0"
                />
                <span className="text-neutral-text text-[11px]">إظهار العنوان</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={data.addressAr}
                onChange={(e) => setData({ ...data, addressAr: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                placeholder="العنوان بالعربية"
              />
              <input
                type="text"
                dir="ltr"
                value={data.addressEn}
                onChange={(e) => setData({ ...data, addressEn: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                placeholder="Address in English"
              />
            </div>
          </div>

          {/* Hours */}
          <div className="space-y-2 pt-1 border-t border-muted-border/20">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-text/70">ساعات العمل</span>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={data.hoursEnabled}
                  onChange={(e) => setData({ ...data, hoursEnabled: e.target.checked })}
                  className="rounded text-primary focus:ring-0"
                />
                <span className="text-neutral-text text-[11px]">إظهار ساعات العمل</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={data.hoursAr}
                onChange={(e) => setData({ ...data, hoursAr: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                placeholder="الأحد – الخميس، 8ص – 4م"
              />
              <input
                type="text"
                dir="ltr"
                value={data.hoursEn}
                onChange={(e) => setData({ ...data, hoursEn: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                placeholder="Sun – Thu, 8:00 AM – 4:00 PM"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Social Links Manager */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <Share2 className="w-4 h-4 text-primary" />
            شبكات وقنوات التواصل الاجتماعي (Social Links)
          </div>
          <button
            type="button"
            onClick={handleAddSocial}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/50 hover:border-primary/50 text-heading transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            إضافة منصة
          </button>
        </div>

        <div className="space-y-3">
          {data.socials?.map((social, index) => (
            <div
              key={social.id}
              className={`p-3 rounded-xl border flex flex-wrap items-center gap-3 transition ${
                social.enabled
                  ? 'bg-canvas border-muted-border/40'
                  : 'bg-canvas/50 border-dashed border-muted-border/20 opacity-60'
              }`}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveSocial(index, 'up')}
                  className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === (data.socials?.length || 0) - 1}
                  onClick={() => handleMoveSocial(index, 'down')}
                  className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              {/* Name */}
              <div className="w-36">
                <input
                  type="text"
                  value={social.name}
                  onChange={(e) => handleUpdateSocial(index, { name: e.target.value })}
                  placeholder="اسم المنصة"
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>

              {/* Icon selector */}
              <div className="w-36">
                <select
                  value={social.icon}
                  onChange={(e) =>
                    handleUpdateSocial(index, { icon: e.target.value as CmsSocialIcon })
                  }
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                >
                  {SOCIAL_ICONS.map((ic) => (
                    <option key={ic.value} value={ic.value}>
                      {ic.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* URL */}
              <div className="flex-1 min-w-[200px]">
                <input
                  type="url"
                  dir="ltr"
                  value={social.url}
                  onChange={(e) => handleUpdateSocial(index, { url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-2.5 py-1 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
              </div>

              {/* Toggle & delete */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={social.enabled}
                    onChange={(e) => handleUpdateSocial(index, { enabled: e.target.checked })}
                    className="rounded text-primary focus:ring-0"
                  />
                  <span className="text-neutral-text text-[11px]">مفعل</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleDeleteSocial(index)}
                  className="p-1.5 rounded-lg text-neutral-text/50 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CmsVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        sectionKey="footer"
        sectionTitle="الهوية والتذييل (Footer)"
        currentVersion={version}
        onRollbackSuccess={fetchFooter}
      />
    </div>
  );
};
