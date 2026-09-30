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
} from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { CmsContactPageContent } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';

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
};

interface SubjectPair {
  id: string;
  ar: string;
  en: string;
}

export const CmsContactPanel: React.FC = () => {
  const { showToast, confirm, can } = useAdmin();
  const [data, setData] = useState<CmsContactPageContent>(DEFAULT_CONTACT);
  const [subjectPairs, setSubjectPairs] = useState<SubjectPair[]>([]);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');

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
            id: `subj-${i}-${Date.now()}`,
            ar: arList[i] || '',
            en: enList[i] || '',
          });
        }
        setSubjectPairs(pairs);
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

  const handleSave = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل محتوى صفحة التواصل');
      return;
    }

    const payload: CmsContactPageContent = {
      ...data,
      subjectsAr: subjectPairs.map((p) => p.ar.trim()).filter(Boolean),
      subjectsEn: subjectPairs.map((p) => p.en.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/contact',
        payload
      );
      setVersion(res.version);
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
            خيارات موضوع الاستفسار (Dropdown Subjects)
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
                <input
                  type="text"
                  value={pair.ar}
                  onChange={(e) => handleUpdateSubject(index, { ar: e.target.value })}
                  placeholder="نص الموضوع بالعربية"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={pair.en}
                  onChange={(e) => handleUpdateSubject(index, { en: e.target.value })}
                  placeholder="Subject in English"
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                />
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
