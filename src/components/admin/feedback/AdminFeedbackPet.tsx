import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquarePlus,
  X,
  Image as ImageIcon,
  Send,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  Minimize2,
} from 'lucide-react';
import { uploadMedia } from '../../../services/mediaService';
import { AdminStorage } from '../../../services/adminStorage';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import type { AdminSection } from '../../../pages/admin/adminRoutes';

interface AdminFeedbackPetProps {
  currentSection: AdminSection;
}

const SECTION_LABELS: Record<AdminSection, string> = {
  overview: 'لوحة التحكم والمؤشرات',
  projects: 'المشاريع العقارية',
  project: 'تفاصيل المشروع',
  projectEdit: 'تعديل بيانات المشروع',
  units: 'المخطط البصري للأدوار والوحدات',
  inquiries: 'طلبات الاهتمام والعملاء',
  categories: 'التصنيفات والوسوم',
  users: 'المستخدمون والصلاحيات',
  roles: 'الأدوار والصلاحيات',
  departments: 'الأقسام والإدارات',
  newsletter: 'النشرة البريدية',
  settings: 'الإعدادات العامة',
  profile: 'الملف الشخصي والحساب',
};

const STORAGE_KEY_MINIMIZED = 'ajda.feedback_pet.minimized';

export const AdminFeedbackPet: React.FC<AdminFeedbackPetProps> = ({ currentSection }) => {
  const { currentUser, showToast } = useAdmin();

  const [minimized, setMinimized] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY_MINIMIZED) === 'true';
    } catch {
      return false;
    }
  });

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [section, setSection] = useState<string>(SECTION_LABELS[currentSection] ?? currentSection);
  const [body, setBody] = useState('');
  const [solution, setSolution] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync section when route changes
  useEffect(() => {
    setSection(SECTION_LABELS[currentSection] ?? currentSection);
  }, [currentSection]);

  const toggleMinimize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !minimized;
    setMinimized(next);
    try {
      sessionStorage.setItem(STORAGE_KEY_MINIMIZED, String(next));
    } catch {
      // ignore
    }
  };

  // Clipboard paste listener to easily attach screenshots
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            setScreenshotFile(file);
            const objectUrl = URL.createObjectURL(file);
            setScreenshotPreview(objectUrl);
            showToast('تم التقاط لقطة الشاشة من الحافظة');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('يرجى اختيار ملف صورة صالح');
        return;
      }
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const removeScreenshot = () => {
    setScreenshotFile(null);
    if (screenshotPreview) {
      URL.revokeObjectURL(screenshotPreview);
      setScreenshotPreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setTitle('');
    setBody('');
    setSolution('');
    removeScreenshot();
    setSubmitted(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast('يرجى كتابة عنوان الملاحظة');
      return;
    }
    if (!body.trim()) {
      showToast('يرجى كتابة تفاصيل المشكلة أو الاقتراح');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedScreenshotUrl = '';

      if (screenshotFile) {
        const res = await uploadMedia(screenshotFile);
        uploadedScreenshotUrl = res.url;
      }

      // Format feedback message for developer
      const fullMessage = [
        `[ملاحظة موجهة للمطور]`,
        `الصفحة: ${section}`,
        `المرسل: ${currentUser?.name ?? 'مسؤول النظام'} (${currentUser?.email ?? 'بدون بريد'})`,
        `\nتفاصيل المشكلة / الملاحظة:`,
        body.trim(),
        solution.trim() ? `\nالحل المقترح:\n${solution.trim()}` : '',
        uploadedScreenshotUrl ? `\nلقطة الشاشة:\n${uploadedScreenshotUrl}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      // Submit as internal general inquiry so it's recorded in CRM & notifications
      await AdminStorage.addInquiry({
        name: `[مطور] ${title.trim()}`,
        email: currentUser?.email,
        phone: currentUser?.phone ?? undefined,
        interestType: 'general',
        message: fullMessage,
      });

      setSubmitted(true);
      showToast('تم إرسال ملاحظتك للمطور بنجاح! شكراً لمساعدتك في التحسين.');
    } catch {
      showToast('حدث خطأ أثناء إرسال الملاحظة، يرجى المحاولة لاحقاً');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Pet Avatar Trigger (Bottom Left / Start) */}
      <aside aria-label="صندوق اقتراحات المطور" className="fixed bottom-4 start-4 z-40 flex items-end gap-2 select-none">
        {minimized ? (
          <button
            type="button"
            onClick={toggleMinimize}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface/95 backdrop-blur-md border border-accent/40 shadow-lg text-heading hover:border-accent text-xs font-bold cursor-pointer transition hover:scale-105"
            title="إظهار صندوق اقتراحات المطور"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
            <span>اقتراحات المطور</span>
          </button>
        ) : (
          <div className="relative group">
            {/* Tooltip speech bubble */}
            <div className="absolute bottom-full start-0 mb-2 hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <div className="bg-heading text-canvas text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-accent" />
                <span>لديك مشكلة أو اقتراح للمطور؟</span>
              </div>
            </div>

            {/* Pet Container */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-accent/90 to-accent text-white shadow-xl hover:shadow-accent/30 transition-all transform hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-white/20"
                aria-label="فتح صندوق اقتراحات وملاحظات المطور"
              >
                {/* Pet Animated Character Graphic */}
                <div className="flex flex-col items-center justify-center animate-bounce duration-1000">
                  <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="drop-shadow-sm">
                    {/* Pet Body */}
                    <rect x="4" y="6" width="24" height="20" rx="8" fill="currentColor" fillOpacity="0.95" />
                    {/* Ears */}
                    <path d="M7 6L4 2H10L8 6" fill="currentColor" />
                    <path d="M25 6L28 2H22L24 6" fill="currentColor" />
                    {/* Screen / Face */}
                    <rect x="7" y="9" width="18" height="13" rx="4" fill="#0d1620" />
                    {/* Cheeks */}
                    <circle cx="9" cy="18" r="1.5" fill="#f43f5e" opacity="0.8" />
                    <circle cx="23" cy="18" r="1.5" fill="#f43f5e" opacity="0.8" />
                    {/* Eyes */}
                    <circle cx="12" cy="14" r="2" fill="#38bdf8" />
                    <circle cx="20" cy="14" r="2" fill="#38bdf8" />
                    <circle cx="13" cy="13.5" r="0.7" fill="#ffffff" />
                    <circle cx="21" cy="13.5" r="0.7" fill="#ffffff" />
                    {/* Smile */}
                    <path d="M14 17.5C14.5 18.5 17.5 18.5 18 17.5" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                {/* Badge indicator */}
                <span className="absolute -top-1 -end-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white" />
                </span>
              </button>

              {/* Hide / Minimize button */}
              <button
                type="button"
                onClick={toggleMinimize}
                className="absolute -top-1.5 -start-1.5 w-5 h-5 rounded-full bg-surface border border-muted-border/60 text-neutral-text hover:text-heading flex items-center justify-center shadow-md cursor-pointer transition"
                title="تصغير"
                aria-label="تصغير المساعد"
              >
                <Minimize2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Modal Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-3xl bg-surface border border-muted-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            role="dialog"
            aria-labelledby="feedback-dialog-title"
          >
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-muted-border/40 flex items-center justify-between bg-canvas/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="feedback-dialog-title" className="text-sm font-black text-heading">
                    صندوق الملاحظات والاقتراحات للمطور
                  </h3>
                  <p className="text-[11px] text-neutral-text/65 mt-0.5">
                    أرسل طلب تحديث أو أبلغ عن مشكلة مباشرة إلى مطور النظام
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (submitted) resetForm();
                }}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-neutral-text hover:text-heading cursor-pointer transition"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {submitted ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="text-sm font-black text-heading">تم إرسال الملاحظة بنجاح</h4>
                  <p className="text-xs text-neutral-text/70 max-w-sm mx-auto leading-relaxed">
                    شكراً لك! تم توثيق الملاحظة وإرسالها للمطور لمراجعتها والعمل عليها في التحديث القادم.
                  </p>
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setOpen(false);
                      }}
                      className="brand-btn-primary px-6 py-2.5 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              ) : (
                <form id="feedback-form" onSubmit={handleSubmit} className="space-y-4">
                  {/* Topic / Page */}
                  <div>
                    <label htmlFor="fb-section" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      الصفحة أو الموضوع المتعلق بالمشكلة
                    </label>
                    <input
                      id="fb-section"
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                    />
                  </div>

                  {/* Title */}
                  <div>
                    <label htmlFor="fb-title" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      عنوان الملاحظة أو المشكلة *
                    </label>
                    <input
                      id="fb-title"
                      type="text"
                      required
                      placeholder="مثال: زر الحفظ لا يستجيب في صفحة المستخدمين"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                    />
                  </div>

                  {/* Problem Description */}
                  <div>
                    <label htmlFor="fb-body" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      تفاصيل المشكلة أو التعديل المطلوب *
                    </label>
                    <textarea
                      id="fb-body"
                      required
                      rows={4}
                      placeholder="صف بالتفصيل ما الذي حدث وما الذي تتوقع أن يحدث..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-y"
                    />
                  </div>

                  {/* Proposed Solution (Optional) */}
                  <div>
                    <label htmlFor="fb-solution" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      الحل المقترح (اختياري)
                    </label>
                    <textarea
                      id="fb-solution"
                      rows={2}
                      placeholder="إذا كان لديك فكرة أو حل مفضل..."
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-y"
                    />
                  </div>

                  {/* Screenshot Attachment / Clipboard paste */}
                  <div>
                    <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      لقطة الشاشة (اختياري - يمكنك أيضاً لصق الصورة مباشرة بـ Ctrl+V)
                    </span>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {screenshotPreview ? (
                      <div className="relative rounded-2xl border border-muted-border/50 overflow-hidden bg-canvas p-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={screenshotPreview}
                            alt="معاينة لقطة الشاشة"
                            className="w-14 h-14 rounded-xl object-cover border border-muted-border/40 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-[11px] font-bold text-heading truncate block">
                              {screenshotFile?.name || 'لقطة شاشة ملصقة'}
                            </span>
                            <span className="text-[10px] text-neutral-text/60">جاهز للإرسال</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeScreenshot}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer shrink-0"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-4 rounded-2xl border border-dashed border-muted-border/50 hover:border-accent/60 text-neutral-text/60 hover:text-accent flex items-center justify-center gap-2 transition cursor-pointer bg-canvas/30 text-xs font-bold"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>انقر لاختيار لقطة شاشة أو الصقها مباشرة (Ctrl+V)</span>
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>

            {/* Footer Actions */}
            {!submitted && (
              <div className="p-4 sm:p-5 border-t border-muted-border/40 flex items-center justify-between bg-canvas/40 gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                  className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  form="feedback-form"
                  disabled={submitting}
                  className="brand-btn-primary px-5 py-2 rounded-xl text-xs font-black shadow-md cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال للمطور</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
