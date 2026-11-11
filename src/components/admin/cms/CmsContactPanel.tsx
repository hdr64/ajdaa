import React, { useEffect, useState } from 'react';
import {
  Save,
  History,
  Mail,
  ListPlus,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ShieldCheck,
} from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import type { CmsContactPageContent, CmsTrustItem } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';
import { useCmsDirty } from './cmsDirtyContext';
import { CmsDirtyBar } from './CmsDirtyBar';

const DEFAULT_CONTACT: CmsContactPageContent = {
  badgeAr: 'تواصل مع أجدا',
  badgeEn: 'Contact Ajda',
  titleAr: 'نسعد دائماً بالتواصل معكم والإجابة على استفساراتكم',
  titleEn: 'We Are Delighted to Connect and Answer Your Inquiries',
  subtitleAr:
    'سواء كنت مهتماً بالاستثمار أو حجز مساحة أو طلب استشارة، مستشارونا مستعدون لخدمتك.',
  subtitleEn:
    'Whether you are inquiring about investment, booking commercial space, or seeking guidance, we are here to assist you.',
  formTitleAr: 'أرسل لنا استفسارك',
  formTitleEn: 'Send Us Your Inquiry',
  subjectsAr: [
    'استفسار عن المشاريع التجارية',
    'حجز مساحات لوجستية ومستودعات',
    'استثمار وشراكات استراتيجية',
    'استفسارات عامة وخدمة عملاء',
  ],
  subjectsEn: [
    'Commercial Projects Inquiry',
    'Logistics & Warehousing Spaces',
    'Investment & Strategic Partnerships',
    'General Inquiry & Customer Care',
  ],
  trustEnabled: true,
  trustItems: [
    { id: 'trust-response', textAr: 'رد سريع خلال 24 ساعة', textEn: 'Prompt response within 24 hours' },
    { id: 'trust-privacy', textAr: 'خصوصية وأمان لبياناتك', textEn: 'Data privacy & security guaranteed' },
    { id: 'trust-support', textAr: 'دعم استشاري واستثماري مستمر', textEn: 'Continuous advisory & investment support' },
  ],
};

/** Max items the server accepts (`cmsTrustItemSchema`), mirrored here for the UI. */
const MAX_TRUST_ITEMS = 6;
const MAX_TRUST_TEXT = 120;

interface SubjectPair {
  id: string;
  ar: string;
  en: string;
}

/** Same shape as `SubjectPair`; separate alias keeps the two editors independent. */
type TrustPair = SubjectPair;

/** Zips the stored bilingual trust list into the editable pair shape. */
function toTrustPairs(items: CmsTrustItem[] | undefined): TrustPair[] {
  return (items ?? []).map((item, index) => ({
    id: item.id || `trust-${index}`,
    ar: item.textAr,
    en: item.textEn,
  }));
}

export const CmsContactPanel: React.FC = () => {
  const { showToast, confirm, can } = useAdmin();
  const { t } = useAdminT();
  const [data, setData] = useState<CmsContactPageContent>(DEFAULT_CONTACT);
  const [subjectPairs, setSubjectPairs] = useState<SubjectPair[]>([]);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [trustEnabled, setTrustEnabled] = useState(true);
  const [trustPairs, setTrustPairs] = useState<TrustPair[]>([]);
  const [trustError, setTrustError] = useState<string | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');
  const { dirty, markSaved, savedValue } = useCmsDirty(
    'contact',
    { data, subjectPairs, trustEnabled, trustPairs },
    loading,
  );
  const handleDiscard = () => {
    const saved = savedValue();
    if (!saved) return;
    setData(saved.data);
    setSubjectPairs(saved.subjectPairs);
    setTrustEnabled(saved.trustEnabled);
    setTrustPairs(saved.trustPairs);
  };

  const fetchContact = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ key: string; content: CmsContactPageContent; version: number }>(
        '/cms/content/contact'
      );
      if (res && res.content) {
        setData(res.content);
        setVersion(res.version);

        // Map arrays to pairs
        const pairs: SubjectPair[] = [];
        const arList = res.content.subjectsAr || [];
        const enList = res.content.subjectsEn || [];
        const maxLen = Math.max(arList.length, enList.length);
        for (let i = 0; i < maxLen; i++) {
          pairs.push({
            id: `subj-${i}`,
            ar: arList[i] || '',
            en: enList[i] || '',
          });
        }
        setSubjectPairs(pairs);
        setTrustEnabled(res.content.trustEnabled ?? DEFAULT_CONTACT.trustEnabled ?? true);
        setTrustPairs(toTrustPairs(res.content.trustItems ?? DEFAULT_CONTACT.trustItems));
      }
    } catch {
      setData(DEFAULT_CONTACT);
      setSubjectPairs(
        DEFAULT_CONTACT.subjectsAr.map((ar, i) => ({
          id: `subj-${i}`,
          ar,
          en: DEFAULT_CONTACT.subjectsEn[i] || '',
        }))
      );
      setTrustEnabled(DEFAULT_CONTACT.trustEnabled ?? true);
      setTrustPairs(toTrustPairs(DEFAULT_CONTACT.trustItems));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchContact();
  }, []);

  const handleAddSubject = () => {
    setSubjectPairs((prev) => [
      ...prev,
      { id: `subj-${Date.now()}`, ar: 'موضوع جديد', en: 'New Subject' },
    ]);
  };

  const handleUpdateSubject = (index: number, patch: Partial<SubjectPair>) => {
    setSubjectError(null);
    setSubjectPairs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleDeleteSubject = async (index: number) => {
    const pair = subjectPairs[index];
    const ok = await confirm({
      title: 'حذف موضوع الاستفسار',
      message: `هل أنت متأكد من حذف "${pair.ar}" من قائمة خيارات الاستفسار؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;
    setSubjectPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveSubject = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= subjectPairs.length) return;
    const copy = [...subjectPairs];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setSubjectPairs(copy);
  };

  const handleAddTrust = () => {
    if (trustPairs.length >= MAX_TRUST_ITEMS) {
      const msg = t('cms.contact.trustMaxReached');
      setTrustError(msg);
      showToast(msg, 'error');
      return;
    }
    setTrustError(null);
    setTrustPairs((prev) => [
      ...prev,
      { id: `trust-${Date.now()}`, ar: 'عنصر ثقة جديد', en: 'New trust bullet' },
    ]);
  };

  const handleUpdateTrust = (index: number, patch: Partial<TrustPair>) => {
    setTrustError(null);
    setTrustPairs((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleDeleteTrust = async (index: number) => {
    const pair = trustPairs[index];
    const ok = await confirm({
      title: t('cms.contact.trustDeleteTitle'),
      message: t('cms.contact.trustDeleteMessage', { text: pair.ar || pair.en }),
      confirmLabel: t('cms.contact.trustDeleteConfirm'),
      danger: true,
    });
    if (!ok) return;
    setTrustPairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveTrust = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= trustPairs.length) return;
    const copy = [...trustPairs];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setTrustPairs(copy);
  };

  const handleSave = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل محتوى صفحة التواصل');
      return;
    }

    const trimmedPairs = subjectPairs.map((p) => ({
      ...p,
      ar: p.ar.trim(),
      en: p.en.trim(),
    }));

    // Drop a pair only when both sides are empty
    const survivingPairs = trimmedPairs.filter((p) => p.ar.length > 0 || p.en.length > 0);

    // If exactly one side of a pair is empty, block save with a field error
    const hasIncompletePair = survivingPairs.some((p) => !p.ar || !p.en);
    if (hasIncompletePair) {
      const msg = t('cms.contact.subjectPairIncomplete');
      setSubjectError(msg);
      showToast(msg, 'error');
      return;
    }

    setSubjectError(null);

    // Trust bullets follow the subjects' bilingual rule (drop only when both
    // sides are empty, block a one-sided pair) plus the server's item cap.
    const trimmedTrust = trustPairs.map((p) => ({ ...p, ar: p.ar.trim(), en: p.en.trim() }));
    const survivingTrust = trimmedTrust.filter((p) => p.ar.length > 0 || p.en.length > 0);

    if (survivingTrust.length > MAX_TRUST_ITEMS) {
      const msg = t('cms.contact.trustMaxReached');
      setTrustError(msg);
      showToast(msg, 'error');
      return;
    }
    if (survivingTrust.some((p) => !p.ar || !p.en)) {
      const msg = t('cms.contact.trustPairIncomplete');
      setTrustError(msg);
      showToast(msg, 'error');
      return;
    }

    setTrustError(null);

    const payload: CmsContactPageContent = {
      ...data,
      subjectsAr: survivingPairs.map((p) => p.ar),
      subjectsEn: survivingPairs.map((p) => p.en),
      trustEnabled,
      trustItems: survivingTrust.map((p) => ({ id: p.id, textAr: p.ar, textEn: p.en })),
    };

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/contact',
        payload
      );
      setVersion(res.version);
      markSaved();
      showToast('تم حفظ محتوى صفحة التواصل بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ بيانات التواصل'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-text/60">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
        جاري تحميل بيانات صفحة التواصل...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
        <div>
          <h3 className="text-base font-bold text-heading">صفحة التواصل (Contact Page)</h3>
          <p className="text-xs text-neutral-text/70">
            تخصيص العناوين والنصوص وقائمة مواضيع الاستفسار المنسدلة في نموذج الاتصال.
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

      {/* Header and Form Headings */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center gap-2 text-heading font-bold text-sm">
          <Mail className="w-4 h-4 text-primary" />
          النصوص الافتتاحية وعنوان النموذج
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              شارة الصفحة (عربي)
            </label>
            <input
              type="text"
              value={data.badgeAr}
              onChange={(e) => setData({ ...data, badgeAr: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              placeholder="تواصل مع أجدا"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              شارة الصفحة (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.badgeEn}
              onChange={(e) => setData({ ...data, badgeEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
              placeholder="Contact Ajda"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              العنوان الرئيسي (عربي)
            </label>
            <input
              type="text"
              value={data.titleAr}
              onChange={(e) => setData({ ...data, titleAr: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              العنوان الرئيسي (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.titleEn}
              onChange={(e) => setData({ ...data, titleEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              الوصف والنبذة (عربي)
            </label>
            <textarea
              rows={2}
              value={data.subtitleAr}
              onChange={(e) => setData({ ...data, subtitleAr: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              الوصف والنبذة (إنجليزي)
            </label>
            <textarea
              rows={2}
              dir="ltr"
              value={data.subtitleEn}
              onChange={(e) => setData({ ...data, subtitleEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              عنوان نموذج المراسلة (عربي)
            </label>
            <input
              type="text"
              value={data.formTitleAr}
              onChange={(e) => setData({ ...data, formTitleAr: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              عنوان نموذج المراسلة (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.formTitleEn}
              onChange={(e) => setData({ ...data, formTitleEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Inquiry Subjects Dropdown Manager */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <ListPlus className="w-4 h-4 text-primary" />
            خيارات موضوع الاستفسار
          </div>
          <button
            type="button"
            onClick={handleAddSubject}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/50 hover:border-primary/50 text-heading transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            إضافة خيار استفسار
          </button>
        </div>

        <p className="text-xs text-neutral-text/70">
          تظهر هذه القائمة في القائمة المنسدلة لنموذج التواصل ليختار العميل نوع الاستفسار المناسب.
        </p>

        <div className="space-y-3">
          {subjectPairs.map((pair, index) => (
            <div
              key={pair.id}
              className="p-3 rounded-xl border bg-canvas border-muted-border/40 flex items-center gap-3"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveSubject(index, 'up')}
                  className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === subjectPairs.length - 1}
                  onClick={() => handleMoveSubject(index, 'down')}
                  className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <div className="w-7 h-7 rounded-lg bg-surface text-neutral-text/70 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                {index + 1}
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    value={pair.ar}
                    onChange={(e) => handleUpdateSubject(index, { ar: e.target.value })}
                    placeholder="نص الموضوع بالعربية"
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border focus:border-primary focus:outline-hidden ${
                      subjectError && !pair.ar.trim() && pair.en.trim()
                        ? 'border-red-500/60'
                        : 'border-muted-border/40'
                    }`}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    dir="ltr"
                    value={pair.en}
                    onChange={(e) => handleUpdateSubject(index, { en: e.target.value })}
                    placeholder="Subject in English"
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border focus:border-primary focus:outline-hidden ${
                      subjectError && pair.ar.trim() && !pair.en.trim()
                        ? 'border-red-500/60'
                        : 'border-muted-border/40'
                    }`}
                  />
                </div>
                {subjectError && (!pair.ar.trim() !== !pair.en.trim()) && (
                  <p role="alert" className="text-[11px] text-red-500 font-medium col-span-1 sm:col-span-2">
                    {subjectError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteSubject(index)}
                className="p-1.5 rounded-lg text-neutral-text/50 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Trust Bullets Manager */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {t('cms.contact.trustTitle')}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-neutral-text">
              <input
                type="checkbox"
                checked={trustEnabled}
                onChange={(e) => setTrustEnabled(e.target.checked)}
                className="rounded text-primary focus:ring-0"
              />
              {t('cms.contact.trustEnabled')}
            </label>
            <button
              type="button"
              onClick={handleAddTrust}
              disabled={trustPairs.length >= MAX_TRUST_ITEMS}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/50 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              {t('cms.contact.trustAdd')}
            </button>
          </div>
        </div>

        <p className="text-xs text-neutral-text/70">{t('cms.contact.trustSubtitle')}</p>

        <div className="space-y-3">
          {trustPairs.map((pair, index) => (
            <div
              key={pair.id}
              className="p-3 rounded-xl border bg-canvas border-muted-border/40 flex items-center gap-3"
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => handleMoveTrust(index, 'up')}
                  className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  disabled={index === trustPairs.length - 1}
                  onClick={() => handleMoveTrust(index, 'down')}
                  className="p-1 text-neutral-text hover:text-heading disabled:opacity-20 cursor-pointer"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>

              <div className="w-7 h-7 rounded-lg bg-surface text-neutral-text/70 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                {index + 1}
              </div>

              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    type="text"
                    value={pair.ar}
                    maxLength={MAX_TRUST_TEXT}
                    onChange={(e) => handleUpdateTrust(index, { ar: e.target.value })}
                    placeholder={t('cms.contact.trustArPlaceholder')}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border focus:border-primary focus:outline-hidden ${
                      trustError && !pair.ar.trim() && pair.en.trim()
                        ? 'border-red-500/60'
                        : 'border-muted-border/40'
                    }`}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    dir="ltr"
                    value={pair.en}
                    maxLength={MAX_TRUST_TEXT}
                    onChange={(e) => handleUpdateTrust(index, { en: e.target.value })}
                    placeholder={t('cms.contact.trustEnPlaceholder')}
                    className={`w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border focus:border-primary focus:outline-hidden ${
                      trustError && pair.ar.trim() && !pair.en.trim()
                        ? 'border-red-500/60'
                        : 'border-muted-border/40'
                    }`}
                  />
                </div>
                {trustError && (!pair.ar.trim() !== !pair.en.trim()) && (
                  <p role="alert" className="text-[11px] text-red-500 font-medium col-span-1 sm:col-span-2">
                    {trustError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDeleteTrust(index)}
                className="p-1.5 rounded-lg text-neutral-text/50 hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <CmsDirtyBar dirty={dirty} saving={saving} canSave={canManage} onSave={() => void handleSave()} onDiscard={handleDiscard} />

      <CmsVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        sectionKey="contact"
        sectionTitle="صفحة التواصل (Contact Page)"
        currentVersion={version}
        onRollbackSuccess={fetchContact}
      />
    </div>
  );
};
