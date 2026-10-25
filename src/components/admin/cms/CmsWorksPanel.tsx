import React, { useEffect, useState } from 'react';
import {
  Save,
  History,
  Building,
  Star,
  Search,
  MessageSquare,
} from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { propertyService } from '../../../services/propertyService';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { CmsWorksPageContent } from '../../../types/cms';
import type { Property } from '../../../types/property';
import { CmsVersionModal } from './CmsVersionModal';

const DEFAULT_WORKS: CmsWorksPageContent = {
  badgeAr: 'المحفظة العقارية',
  badgeEn: 'Property Portfolio',
  titleAr: 'مشاريعنا العقارية والاستثمارية',
  titleEn: 'Our Real Estate & Investment Projects',
  subtitleAr:
    'استكشف باقتنا المتنوعة من المستودعات اللوجستية، المحلات والمجمعات التجارية، والمكاتب الإدارية الحديثة بالمملكة.',
  subtitleEn:
    'Explore our premier selection of logistics warehouses, retail showrooms, and modern business towers across Saudi Arabia.',
  featuredBannerEnabled: true,
  emptyState: {
    titleAr: 'لا توجد نتائج مطابقة للبحث',
    titleEn: 'No properties match your criteria',
    descAr: 'جرّب تعديل الكلمات الدالة أو إعادة تعيين الفلاتر للعثور على العقار المناسب.',
    descEn: 'Try adjusting search terms or resetting filters to discover available properties.',
    resetBtnTextAr: 'إعادة تعيين الفلاتر',
    resetBtnTextEn: 'Reset Filters',
  },
  ctaEnabled: true,
  ctaTitleAr: 'هل تبحث عن مساحة مخصصة لنشاطك المؤسسي؟',
  ctaTitleEn: 'Looking for a Tailored Space for Your Business Enterprise?',
  ctaDescAr:
    'فريقنا الاستشاري مستعد لتقديم حلول عقارية مرنة تواكب متطلبات نشاطك وتطلعاتك الاستثمارية.',
  ctaDescEn:
    'Our specialized corporate advisors are ready to craft flexible real estate solutions aligned with your ambitions.',
};

export const CmsWorksPanel: React.FC = () => {
  const { showToast, can } = useAdmin();
  const [data, setData] = useState<CmsWorksPageContent>(DEFAULT_WORKS);
  const [projects, setProjects] = useState<Property[]>([]);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  const canManage = can('manageCms');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resWorks, resProjects] = await Promise.allSettled([
        api.get<{ key: string; content: CmsWorksPageContent; version: number }>(
          '/cms/content/works'
        ),
        propertyService.list(),
      ]);

      if (resWorks.status === 'fulfilled' && resWorks.value?.content) {
        setData(resWorks.value.content);
        setVersion(resWorks.value.version);
      }
      if (resProjects.status === 'fulfilled') {
        setProjects(resProjects.value);
      }
    } catch {
      setData(DEFAULT_WORKS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleSave = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل محتوى صفحة المشاريع');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/works',
        data
      );
      setVersion(res.version);
      showToast('تم حفظ محتوى صفحة المشاريع بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ محتوى المشاريع'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-text/60">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
        جاري تحميل إعدادات صفحة المشاريع...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface border border-muted-border/30">
        <div>
          <h3 className="text-base font-bold text-heading">صفحة المشاريع (Works Page)</h3>
          <p className="text-xs text-neutral-text/70">
            تخصيص العناوين الترحيبية، البانر المميز للمشروع المختار، وحالة عدم وجود نتائج والبانر الختامي.
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

      {/* Header Copy */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center gap-2 text-heading font-bold text-sm">
          <Building className="w-4 h-4 text-primary" />
          النصوص الافتتاحية للصفحة (Header Hero)
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
              placeholder="المحفظة العقارية"
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
              placeholder="Property Portfolio"
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
              الوصف والنبذة الفرعية (عربي)
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
              الوصف والنبذة الفرعية (إنجليزي)
            </label>
            <textarea
              rows={2}
              dir="ltr"
              value={data.subtitleEn}
              onChange={(e) => setData({ ...data, subtitleEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Featured Project Banner */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <Star className="w-4 h-4 text-amber-500" />
            البانر المميز للمشروع (Featured Project Banner)
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={data.featuredBannerEnabled}
              onChange={(e) => setData({ ...data, featuredBannerEnabled: e.target.checked })}
              className="rounded text-primary focus:ring-0"
            />
            <span className="text-neutral-text text-[11px]">تفعيل البانر المميز</span>
          </label>
        </div>

        <p className="text-xs text-neutral-text/70">
          اختر مشروعاً من المشاريع المنشورة ليظهر كبانر عريض بارز في أعلى صفحة المشاريع.
        </p>

        <div>
          <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
            المشروع المميز المختار
          </label>
          <select
            value={data.featuredProjectId ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
              setData({ ...data, featuredProjectId: val });
            }}
            disabled={!data.featuredBannerEnabled}
            className="w-full max-w-md px-3 py-2 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden disabled:opacity-50"
          >
            <option value="">-- العرض التلقائي (أحدث مشروع مميز) --</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                #{proj.id} - {proj.title} ({proj.city})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Empty State Customizer */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center gap-2 text-heading font-bold text-sm">
          <Search className="w-4 h-4 text-primary" />
          رسالة عدم وجود نتائج (Empty State)
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              عنوان الحالة الفارغة (عربي)
            </label>
            <input
              type="text"
              value={data.emptyState.titleAr}
              onChange={(e) =>
                setData({
                  ...data,
                  emptyState: { ...data.emptyState, titleAr: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              عنوان الحالة الفارغة (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.emptyState.titleEn}
              onChange={(e) =>
                setData({
                  ...data,
                  emptyState: { ...data.emptyState, titleEn: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              نص التوجيه (عربي)
            </label>
            <input
              type="text"
              value={data.emptyState.descAr}
              onChange={(e) =>
                setData({
                  ...data,
                  emptyState: { ...data.emptyState, descAr: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              نص التوجيه (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.emptyState.descEn}
              onChange={(e) =>
                setData({
                  ...data,
                  emptyState: { ...data.emptyState, descEn: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              زر إعادة تعيين الفلاتر (عربي)
            </label>
            <input
              type="text"
              value={data.emptyState.resetBtnTextAr}
              onChange={(e) =>
                setData({
                  ...data,
                  emptyState: { ...data.emptyState, resetBtnTextAr: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              زر إعادة تعيين الفلاتر (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.emptyState.resetBtnTextEn}
              onChange={(e) =>
                setData({
                  ...data,
                  emptyState: { ...data.emptyState, resetBtnTextEn: e.target.value },
                })
              }
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="p-5 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-heading font-bold text-sm">
            <MessageSquare className="w-4 h-4 text-primary" />
            البانر السفلي للدعوة إلى اتخاذ إجراء (CTA)
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={data.ctaEnabled}
              onChange={(e) => setData({ ...data, ctaEnabled: e.target.checked })}
              className="rounded text-primary focus:ring-0"
            />
            <span className="text-neutral-text text-[11px]">تفعيل البانر</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              عنوان البانر (عربي)
            </label>
            <input
              type="text"
              value={data.ctaTitleAr}
              onChange={(e) => setData({ ...data, ctaTitleAr: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              عنوان البانر (إنجليزي)
            </label>
            <input
              type="text"
              dir="ltr"
              value={data.ctaTitleEn}
              onChange={(e) => setData({ ...data, ctaTitleEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              وصف البانر (عربي)
            </label>
            <textarea
              rows={2}
              value={data.ctaDescAr}
              onChange={(e) => setData({ ...data, ctaDescAr: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
              وصف البانر (إنجليزي)
            </label>
            <textarea
              rows={2}
              dir="ltr"
              value={data.ctaDescEn}
              onChange={(e) => setData({ ...data, ctaDescEn: e.target.value })}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      <CmsVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        sectionKey="works"
        sectionTitle="صفحة المشاريع (Works Page)"
        currentVersion={version}
        onRollbackSuccess={fetchData}
      />
    </div>
  );
};
