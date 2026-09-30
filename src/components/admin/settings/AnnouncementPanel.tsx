import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Save, Wrench } from 'lucide-react';
import { siteSettingsApi, type Announcement, type Maintenance, type SiteSettings } from '../../../services/settingsService';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { SectionError, SectionLoading } from '../common/SectionState';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent';

function problemIn(announcement: Announcement, maintenance: Maintenance): string | null {
  if (announcement.enabled && !announcement.textAr.trim() && !announcement.textEn.trim()) {
    return 'أدخل نص الإعلان قبل تفعيله';
  }
  if (announcement.link && !announcement.link.startsWith('https://')) return 'رابط الإعلان يجب أن يبدأ بـ https://';
  if (!maintenance.messageAr.trim() || !maintenance.messageEn.trim()) return 'رسالة الصيانة مطلوبة بالعربية والإنجليزية';
  return null;
}

/** Announcement strip and maintenance mode for the public site. Super admin only. */
export const AnnouncementPanel: React.FC = () => {
  const { showToast, confirm } = useAdmin();
  const { setSettings } = useSiteSettings();
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [maintenance, setMaintenance] = useState<Maintenance | null>(null);
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
        setAnnouncement(settings.announcement);
        setMaintenance(settings.maintenance);
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setError(getErrorMessage(caught, 'تعذر تحميل إعدادات الإعلان والصيانة'));
      });
    return () => controller.abort();
  }, [reloadToken]);

  const dirty = useMemo(
    () =>
      saved !== null &&
      (JSON.stringify(announcement) !== JSON.stringify(saved.announcement) ||
        JSON.stringify(maintenance) !== JSON.stringify(saved.maintenance)),
    [announcement, maintenance, saved]
  );

  if (error) return <SectionError message={error} onRetry={() => setReloadToken((n) => n + 1)} />;
  if (!saved || !announcement || !maintenance) return <SectionLoading label="جاري التحميل..." />;

  const save = async () => {
    const problem = problemIn(announcement, maintenance);
    if (problem) return showToast(problem);
    if (maintenance.enabled && !saved.maintenance.enabled) {
      const ok = await confirm({
        title: 'تفعيل وضع الصيانة؟',
        message: 'سيرى زوار الموقع صفحة الصيانة بدلاً من الموقع حتى تُلغي التفعيل. لوحة التحكم تبقى متاحة.',
        confirmLabel: 'تفعيل الصيانة',
        danger: true,
      });
      if (!ok) return;
    }
    setSaving(true);
    try {
      // Fetch the latest first so a concurrent save of the contact tab is not overwritten.
      const latest = await siteSettingsApi.get();
      const updated = await siteSettingsApi.update({ ...latest, announcement, maintenance });
      setSaved(updated);
      setAnnouncement(updated.announcement);
      setMaintenance(updated.maintenance);
      setSettings(updated);
      showToast('تم الحفظ وتحديث الموقع');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر الحفظ'));
    } finally {
      setSaving(false);
    }
  };

  const setA = <K extends keyof Announcement>(key: K, value: Announcement[K]) =>
    setAnnouncement((prev) => (prev ? { ...prev, [key]: value } : prev));
  const setM = <K extends keyof Maintenance>(key: K, value: Maintenance[K]) =>
    setMaintenance((prev) => (prev ? { ...prev, [key]: value } : prev));

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-heading flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-accent" />
            شريط الإعلان
          </h3>
          <label className="flex items-center gap-2 text-xs font-bold text-heading cursor-pointer">
            <input type="checkbox" checked={announcement.enabled} onChange={(e) => setA('enabled', e.target.checked)} className="w-4 h-4 cursor-pointer" />
            مفعّل
          </label>
        </div>
        <p className="text-[11px] text-neutral-text/60">شريط رفيع أعلى كل صفحات الموقع، يمكن للزائر إخفاؤه.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="ann-ar" className="block text-xs font-bold text-neutral-text/70">النص (عربي)</label>
            <input id="ann-ar" value={announcement.textAr} onChange={(e) => setA('textAr', e.target.value)} maxLength={200} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ann-en" className="block text-xs font-bold text-neutral-text/70">النص (إنجليزي)</label>
            <input id="ann-en" value={announcement.textEn} onChange={(e) => setA('textEn', e.target.value)} maxLength={200} dir="ltr" className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ann-tone" className="block text-xs font-bold text-neutral-text/70">النمط</label>
            <select id="ann-tone" value={announcement.tone} onChange={(e) => setA('tone', e.target.value as Announcement['tone'])} className={`${inputClass} cursor-pointer`}>
              <option value="info">معلومة (ألوان الموقع)</option>
              <option value="warning">تنبيه (كهرماني)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ann-link" className="block text-xs font-bold text-neutral-text/70">رابط (اختياري)</label>
            <input id="ann-link" value={announcement.link} onChange={(e) => setA('link', e.target.value.trim())} placeholder="https://" dir="ltr" className={inputClass} />
          </div>
        </div>
      </div>

      <div
        className={`rounded-2xl bg-surface border p-5 space-y-4 ${maintenance.enabled ? 'border-amber-500/50' : 'border-muted-border/40'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-heading flex items-center gap-2">
            <Wrench className="w-4 h-4 text-amber-500" />
            وضع الصيانة
          </h3>
          <label className="flex items-center gap-2 text-xs font-bold text-heading cursor-pointer">
            <input type="checkbox" checked={maintenance.enabled} onChange={(e) => setM('enabled', e.target.checked)} className="w-4 h-4 cursor-pointer" />
            مفعّل
          </label>
        </div>
        <p className="text-[11px] text-neutral-text/60">
          يرى الزوار صفحة صيانة بدلاً من الموقع. لوحة التحكم وتسجيل الدخول يبقيان متاحين، والمسؤول المسجّل يرى الموقع مع تنبيه.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="mnt-ar" className="block text-xs font-bold text-neutral-text/70">الرسالة (عربي)</label>
            <textarea id="mnt-ar" rows={3} value={maintenance.messageAr} onChange={(e) => setM('messageAr', e.target.value)} maxLength={500} className={inputClass} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="mnt-en" className="block text-xs font-bold text-neutral-text/70">الرسالة (إنجليزي)</label>
            <textarea id="mnt-en" rows={3} value={maintenance.messageEn} onChange={(e) => setM('messageEn', e.target.value)} maxLength={500} dir="ltr" className={inputClass} />
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="brand-btn-primary font-black px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Save className="w-4 h-4" />
        {saving ? 'جاري الحفظ...' : 'حفظ'}
      </button>
    </div>
  );
};
