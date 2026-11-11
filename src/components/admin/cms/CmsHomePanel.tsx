import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Video,
  Plus,
  Trash2,
} from 'lucide-react';
import { api, getErrorMessage } from '../../../services/api';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { CmsHomePageContent } from '../../../types/cms';
import { DEFAULT_HOME_PAGE } from '../../../types/cms';
import { CmsVersionModal } from './CmsVersionModal';
import { useCmsDirty, useCmsToolbar } from './cmsDirtyContext';
import { CMS_FOCUS_SECTION_EVENT } from '../../../utils/cmsPreviewProtocol';

export const CmsHomePanel: React.FC = () => {
  const { showToast, can } = useAdmin();
  const [data, setData] = useState<CmsHomePageContent>(DEFAULT_HOME_PAGE);
  const [version, setVersion] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionModalOpen, setVersionModalOpen] = useState(false);

  // Active accordion section
  const [activeSection, setActiveSection] = useState<string>('hero');

  // Opening a section also scrolls the live preview to it.
  const toggleSection = (key: string) => {
    const opening = activeSection !== key;
    setActiveSection(opening ? key : '');
    if (opening) {
      window.dispatchEvent(new CustomEvent<string>(CMS_FOCUS_SECTION_EVENT, { detail: key }));
    }
  };

  const canManage = can('manageCms');
  const { dirty, markSaved, savedValue } = useCmsDirty('home', data, loading, (v) => v);
  const handleDiscard = () => {
    const saved = savedValue();
    if (saved) setData(saved);
  };

  const fetchHome = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ key: string; content: CmsHomePageContent; version: number }>(
        '/cms/content/home'
      );
      if (res && res.content) {
        setData(res.content);
        setVersion(res.version);
      }
    } catch {
      setData(DEFAULT_HOME_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHome();
  }, []);

  const handleSave = async () => {
    if (!canManage) {
      showToast('ليس لديك صلاحية لتعديل محتوى الصفحة الرئيسية');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; version: number }>(
        '/cms/content/home',
        data
      );
      setVersion(res.version);
      markSaved();
      showToast('تم حفظ إعدادات الصفحة الرئيسية بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'تعذر حفظ محتوى الصفحة الرئيسية'));
    } finally {
      setSaving(false);
    }
  };

  useCmsToolbar('home', {
    dirty,
    saving,
    canSave: canManage,
    version,
    onSave: () => void handleSave(),
    onDiscard: handleDiscard,
    onHistory: () => setVersionModalOpen(true),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-neutral-text/60">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin ml-2" />
        جاري تحميل بيانات الصفحة الرئيسية...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Accordion List of Sections */}
      <div className="space-y-3">
        {/* 1. HERO */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('hero')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.hero?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >1. البانر الرئيسي</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.hero?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.hero?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.hero?.enabled ?? true}
                  onChange={(e) =>
                    setData({ ...data, hero: { ...data.hero, enabled: e.target.checked } })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'hero' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'hero' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    شارة البانر (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.hero?.badgeAr || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, badgeAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    شارة البانر (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.hero?.badgeEn || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, badgeEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان البانر - السطر 1 (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.hero?.titleLine1Ar || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, titleLine1Ar: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان البانر - السطر 1 (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.hero?.titleLine1En || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, titleLine1En: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان البانر - السطر 2 (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.hero?.titleLine2Ar || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, titleLine2Ar: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان البانر - السطر 2 (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.hero?.titleLine2En || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, titleLine2En: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الكلمة الملونة المميزة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.hero?.highlightWordAr || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, highlightWordAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden font-bold text-primary"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الكلمة الملونة المميزة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.hero?.highlightWordEn || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, highlightWordEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden font-bold text-primary"
                  />
                </div>

                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الوصف الفرعي (عربي)
                  </label>
                  <textarea
                    rows={2}
                    value={data.hero?.subtitleAr || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, subtitleAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الوصف الفرعي (إنجليزي)
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={data.hero?.subtitleEn || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, subtitleEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص زر الاستكشاف الأول (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.hero?.exploreBtnTextAr || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, exploreBtnTextAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص زر الاستكشاف الأول (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.hero?.exploreBtnTextEn || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, exploreBtnTextEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص زر حجز المعاينة الثاني (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.hero?.consultBtnTextAr || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, consultBtnTextAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص زر حجز المعاينة الثاني (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.hero?.consultBtnTextEn || ''}
                    onChange={(e) =>
                      setData({ ...data, hero: { ...data.hero, consultBtnTextEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. MARQUEE */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('marquee')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.marquee?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >2. شريط المدن المتحرك (Marquee)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.marquee?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.marquee?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.marquee?.enabled ?? true}
                  onChange={(e) =>
                    setData({ ...data, marquee: { ...data.marquee, enabled: e.target.checked } })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'marquee' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'marquee' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-heading">قائمة المدن المعروضة بالشريط</span>
                <button
                  type="button"
                  onClick={() => {
                    const newCity = {
                      id: `city-${Date.now()}`,
                      nameAr: 'مدينة جديدة',
                      nameEn: 'New City',
                    };
                    setData({
                      ...data,
                      marquee: {
                        ...data.marquee,
                        cities: [...(data.marquee?.cities || []), newCity],
                      },
                    });
                  }}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-lg bg-surface border border-muted-border/40 hover:border-primary/50 text-heading cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  إضافة مدينة
                </button>
              </div>

              <div className="grid grid-cols-1 cw-sm:grid-cols-2 cw-lg:grid-cols-3 gap-3">
                {data.marquee?.cities?.map((city, cIdx) => (
                  <div
                    key={city.id || cIdx}
                    className="p-3 rounded-xl bg-surface border border-muted-border/30 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={city.nameAr}
                      onChange={(e) => {
                        const copy = [...(data.marquee?.cities || [])];
                        copy[cIdx] = { ...copy[cIdx], nameAr: e.target.value };
                        setData({ ...data, marquee: { ...data.marquee, cities: copy } });
                      }}
                      className="w-1/2 px-2 py-1 text-xs rounded-lg bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                      placeholder="عربي"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={city.nameEn}
                      onChange={(e) => {
                        const copy = [...(data.marquee?.cities || [])];
                        copy[cIdx] = { ...copy[cIdx], nameEn: e.target.value };
                        setData({ ...data, marquee: { ...data.marquee, cities: copy } });
                      }}
                      className="w-1/2 px-2 py-1 text-xs rounded-lg bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                      placeholder="EN"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const copy = data.marquee.cities.filter((_, i) => i !== cIdx);
                        setData({ ...data, marquee: { ...data.marquee, cities: copy } });
                      }}
                      className="p-1 text-neutral-text/50 hover:text-red-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 3. MAP SECTION */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('mapSection')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.mapSection?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >3. قسم الخريطة التفاعلية</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.mapSection?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.mapSection?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.mapSection?.enabled ?? true}
                  onChange={(e) =>
                    setData({
                      ...data,
                      mapSection: { ...data.mapSection, enabled: e.target.checked },
                    })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'mapSection' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'mapSection' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.mapSection?.badgeAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, badgeAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.mapSection?.badgeEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, badgeEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.mapSection?.titleAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, titleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.mapSection?.titleEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, titleEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الكلمة البارزة بالعنوان (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.mapSection?.titleHighlightAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, titleHighlightAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden text-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الكلمة البارزة بالعنوان (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.mapSection?.titleHighlightEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, titleHighlightEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden text-primary font-bold"
                  />
                </div>

                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الوصف (عربي)
                  </label>
                  <textarea
                    rows={2}
                    value={data.mapSection?.descAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, descAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الوصف (إنجليزي)
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={data.mapSection?.descEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        mapSection: { ...data.mapSection, descEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. ABOUT, VIDEO, VISION & VALUES */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('about')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.about?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >
                4. عن أجدا، الفيديو والرؤية والقيم (About & Values)
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.about?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.about?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.about?.enabled ?? true}
                  onChange={(e) =>
                    setData({ ...data, about: { ...data.about, enabled: e.target.checked } })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'about' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'about' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              {/* Video URL */}
              <div className="p-4 rounded-xl bg-surface border border-muted-border/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-heading">
                    <Video className="w-4 h-4 text-primary" />
                    عرض الفيديو التعريفي
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={data.about?.videoShowcaseEnabled ?? true}
                      onChange={(e) =>
                        setData({
                          ...data,
                          about: { ...data.about, videoShowcaseEnabled: e.target.checked },
                        })
                      }
                      className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                    />
                    <span className="text-neutral-text text-[11px]">تفعيل مشغل الفيديو</span>
                  </label>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    رابط فيديو يوتيوب (https://www.youtube.com/watch?v=...)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={data.about?.videoUrl || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, videoUrl: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-canvas border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Vision and Mission */}
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان الرؤية (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.about?.visionTitleAr || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, visionTitleAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان الرؤية (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.about?.visionTitleEn || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, visionTitleEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص الرؤية (عربي)
                  </label>
                  <textarea
                    rows={2}
                    value={data.about?.visionDescAr || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, visionDescAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص الرؤية (إنجليزي)
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={data.about?.visionDescEn || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, visionDescEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان الرسالة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.about?.missionTitleAr || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, missionTitleAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان الرسالة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.about?.missionTitleEn || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, missionTitleEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص الرسالة (عربي)
                  </label>
                  <textarea
                    rows={2}
                    value={data.about?.missionDescAr || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, missionDescAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    نص الرسالة (إنجليزي)
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={data.about?.missionDescEn || ''}
                    onChange={(e) =>
                      setData({ ...data, about: { ...data.about, missionDescEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 5. SERVICES */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('services')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.services?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >5. الخدمات والتخصصات</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.services?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.services?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.services?.enabled ?? true}
                  onChange={(e) =>
                    setData({ ...data, services: { ...data.services, enabled: e.target.checked } })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'services' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'services' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.services?.badgeAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        services: { ...data.services, badgeAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.services?.badgeEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        services: { ...data.services, badgeEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.services?.titleAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        services: { ...data.services, titleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.services?.titleEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        services: { ...data.services, titleEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. PROCESS STEPS */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('process')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.process?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >6. مراحل وسير العمل (Process)</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.process?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.process?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.process?.enabled ?? true}
                  onChange={(e) =>
                    setData({ ...data, process: { ...data.process, enabled: e.target.checked } })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'process' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'process' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.process?.badgeAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        process: { ...data.process, badgeAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.process?.badgeEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        process: { ...data.process, badgeEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.process?.titleAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        process: { ...data.process, titleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.process?.titleEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        process: { ...data.process, titleEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 7. PORTFOLIO SECTION */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('portfolioSection')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.portfolioSection?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >7. قسم محفظة المشاريع</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.portfolioSection?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.portfolioSection?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.portfolioSection?.enabled ?? true}
                  onChange={(e) =>
                    setData({
                      ...data,
                      portfolioSection: { ...data.portfolioSection, enabled: e.target.checked },
                    })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'portfolioSection' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'portfolioSection' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.portfolioSection?.badgeAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        portfolioSection: { ...data.portfolioSection, badgeAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.portfolioSection?.badgeEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        portfolioSection: { ...data.portfolioSection, badgeEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.portfolioSection?.titleAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        portfolioSection: { ...data.portfolioSection, titleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.portfolioSection?.titleEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        portfolioSection: { ...data.portfolioSection, titleEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 8. CLIENTS SECTION IN HOME */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('clientsSection')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.clientsSection?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >
                8. قسم الشركاء في الرئيسية
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.clientsSection?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.clientsSection?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.clientsSection?.enabled ?? true}
                  onChange={(e) =>
                    setData({
                      ...data,
                      clientsSection: { ...data.clientsSection, enabled: e.target.checked },
                    })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'clientsSection' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'clientsSection' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.clientsSection?.badgeAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        clientsSection: { ...data.clientsSection, badgeAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الشارة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.clientsSection?.badgeEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        clientsSection: { ...data.clientsSection, badgeEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.clientsSection?.titleAr || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        clientsSection: { ...data.clientsSection, titleAr: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    العنوان (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.clientsSection?.titleEn || ''}
                    onChange={(e) =>
                      setData({
                        ...data,
                        clientsSection: { ...data.clientsSection, titleEn: e.target.value },
                      })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 9. CTA BANNER */}
        <div className="border border-muted-border/30 rounded-2xl overflow-hidden bg-surface transition">
          <div
            className="flex items-center justify-between p-4 cursor-pointer select-none bg-surface hover:bg-canvas/50"
            onClick={() => toggleSection('cta')}
          >
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-bold transition-colors ${
                  data.cta?.enabled ? "text-heading" : "text-neutral-text/50"
                }`}
              >9. بانر الدعوة لإجراء</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  data.cta?.enabled
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : 'bg-neutral-text/10 text-neutral-text/60'
                }`}
              >
                {data.cta?.enabled ? 'مفعل' : 'معطل'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-1.5 cursor-pointer text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={data.cta?.enabled ?? true}
                  onChange={(e) =>
                    setData({ ...data, cta: { ...data.cta, enabled: e.target.checked } })
                  }
                  aria-label="تفعيل القسم"
                  title="تفعيل القسم"
                  className="h-4 w-4 cursor-pointer rounded border-muted-border accent-primary focus:ring-0"
                />
              </label>
              {activeSection === 'cta' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>

          {activeSection === 'cta' && (
            <div className="p-5 border-t border-muted-border/20 bg-canvas/30 space-y-4">
              <div className="grid grid-cols-1 cw-md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان البانر (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.cta?.titleAr || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, titleAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    عنوان البانر (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.cta?.titleEn || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, titleEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الكلمة البارزة (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.cta?.titleHighlightAr || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, titleHighlightAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden text-primary font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الكلمة البارزة (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.cta?.titleHighlightEn || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, titleHighlightEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden text-primary font-bold"
                  />
                </div>

                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الوصف (عربي)
                  </label>
                  <textarea
                    rows={2}
                    value={data.cta?.descAr || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, descAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div className="cw-md:col-span-2">
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    الوصف (إنجليزي)
                  </label>
                  <textarea
                    rows={2}
                    dir="ltr"
                    value={data.cta?.descEn || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, descEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    زر الإجراء الأول (عربي)
                  </label>
                  <input
                    type="text"
                    value={data.cta?.primaryBtnTextAr || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, primaryBtnTextAr: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-neutral-text/70 mb-1">
                    زر الإجراء الأول (إنجليزي)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={data.cta?.primaryBtnTextEn || ''}
                    onChange={(e) =>
                      setData({ ...data, cta: { ...data.cta, primaryBtnTextEn: e.target.value } })
                    }
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-surface border border-muted-border/40 focus:border-primary focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <CmsVersionModal
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        sectionKey="home"
        sectionTitle="الصفحة الرئيسية"
        currentVersion={version}
        onRollbackSuccess={fetchHome}
      />
    </div>
  );
};
