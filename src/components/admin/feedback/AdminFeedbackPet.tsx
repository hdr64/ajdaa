import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquarePlus,
  X,
  Image as ImageIcon,
  Send,
  Sparkles,
  CheckCircle2,
  Trash2,
  Loader2,
  Power,
} from 'lucide-react';
import { uploadMedia } from '../../../services/mediaService';
import { AdminStorage } from '../../../services/adminStorage';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useLanguage } from '../../../hooks/useLanguage';
import type { AdminSection } from '../../../pages/admin/adminRoutes';

interface AdminFeedbackPetProps {
  currentSection: AdminSection;
}

const SECTION_LABELS: Record<AdminSection, { ar: string; en: string }> = {
  overview: { ar: 'لوحة التحكم والمؤشرات', en: 'Dashboard & Overview' },
  projects: { ar: 'المشاريع العقارية', en: 'Real Estate Projects' },
  project: { ar: 'تفاصيل المشروع', en: 'Project Details' },
  projectEdit: { ar: 'تعديل بيانات المشروع', en: 'Edit Project' },
  units: { ar: 'المخطط البصري للأدوار والوحدات', en: 'Floor & Units Visualizer' },
  inquiries: { ar: 'طلبات الاهتمام والعملاء', en: 'Customer Inquiries' },
  categories: { ar: 'التصنيفات والوسوم', en: 'Categories & Tags' },
  users: { ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions' },
  roles: { ar: 'الأدوار والصلاحيات', en: 'Roles & Rights' },
  departments: { ar: 'الأقسام والإدارات', en: 'Departments' },
  newsletter: { ar: 'النشرة البريدية', en: 'Newsletter Subscribers' },
  settings: { ar: 'الإعدادات العامة', en: 'System Settings' },
  cms: { ar: 'إدارة محتوى الموقع', en: 'Site CMS' },
  profile: { ar: 'الملف الشخصي والحساب', en: 'Profile & Security' },
};

const STORAGE_KEY_ENABLED = 'ajda.feedback_pet.enabled';
const STORAGE_KEY_POSITION = 'ajda.feedback_pet.position';

interface Position {
  x: number;
  y: number;
}

export const AdminFeedbackPet: React.FC<AdminFeedbackPetProps> = ({ currentSection }) => {
  const { currentUser, showToast } = useAdmin();
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  // Enable/Disable toggle (persisted)
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_ENABLED);
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  // Drag position (persisted, or null for default RTL/LTR corner)
  const [position, setPosition] = useState<Position | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_POSITION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return null;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);
  const dragMovedRef = useRef<boolean>(false);
  const petContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Dropdown menu state
  const [menuOpen, setMenuOpen] = useState(false);

  // Modal dialog form states
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [section, setSection] = useState<string>(
    SECTION_LABELS[currentSection] ? (isAr ? SECTION_LABELS[currentSection].ar : SECTION_LABELS[currentSection].en) : currentSection
  );
  const [body, setBody] = useState('');
  const [solution, setSolution] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync section label when section or language changes
  useEffect(() => {
    const meta = SECTION_LABELS[currentSection];
    if (meta) {
      setSection(isAr ? meta.ar : meta.en);
    } else {
      setSection(currentSection);
    }
  }, [currentSection, isAr]);

  // Click outside to close dropdown
  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (
        petContainerRef.current &&
        !petContainerRef.current.contains(e.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, String(next));
      } catch {
        // ignore
      }
      showToast(next ? (isAr ? 'تم تفعيل المساعد الذكي' : 'Assistant pet enabled') : (isAr ? 'تم إغلاق المساعد' : 'Assistant pet closed'));
      return next;
    });
  }, [isAr, showToast]);

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-dropdown]')) {
      return;
    }

    const rect = petContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: rect.left,
      startY: rect.top,
    };
    dragMovedRef.current = false;
    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragMovedRef.current = true;
      }

      const nextX = Math.max(12, Math.min(window.innerWidth - 72, dragStartRef.current.startX + dx));
      const nextY = Math.max(12, Math.min(window.innerHeight - 72, dragStartRef.current.startY + dy));

      setPosition({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      // Save position if user dragged it
      if (dragMovedRef.current) {
        setPosition((current) => {
          if (current) {
            try {
              localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(current));
            } catch {
              // ignore
            }
          }
          return current;
        });
      }
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const handlePetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If the mouse was dragged, do not toggle the dropdown
    if (dragMovedRef.current) return;
    setMenuOpen((prev) => !prev);
  };

  // Clipboard paste listener to attach screenshots
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
            showToast(isAr ? 'تم التقاط لقطة الشاشة من الحافظة' : 'Screenshot attached from clipboard');
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, isAr, showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast(isAr ? 'يرجى اختيار ملف صورة صالح' : 'Please select a valid image');
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
      showToast(isAr ? 'يرجى كتابة عنوان الملاحظة' : 'Please provide a title');
      return;
    }
    if (!body.trim()) {
      showToast(isAr ? 'يرجى كتابة تفاصيل المشكلة أو الاقتراح' : 'Please describe the problem or suggestion');
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

      await AdminStorage.addInquiry({
        name: `[مطور] ${title.trim()}`,
        email: currentUser?.email,
        phone: currentUser?.phone ?? undefined,
        interestType: 'general',
        message: fullMessage,
      });

      setSubmitted(true);
      showToast(isAr ? 'تم إرسال ملاحظتك للمطور بنجاح! شكراً لمساعدتك.' : 'Feedback sent to developer successfully!');
    } catch {
      showToast(isAr ? 'حدث خطأ أثناء إرسال الملاحظة، يرجى المحاولة لاحقاً' : 'Could not submit feedback, please try again');
    } finally {
      setSubmitting(false);
    }
  };

  // When disabled: render tiny bottom-corner toggle to turn it back on anytime
  if (!enabled) {
    const disabledPositionStyle: React.CSSProperties = position
      ? { left: `${position.x}px`, top: `${position.y}px` }
      : isRTL
      ? { left: '16px', bottom: '16px' }
      : { right: '16px', bottom: '16px' };

    return (
      <aside aria-label="تفعيل صندوق اقتراحات المطور" className="fixed z-40" style={disabledPositionStyle}>
        <button
          type="button"
          onClick={toggleEnabled}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/90 hover:bg-surface border border-muted-border/60 text-neutral-text/60 hover:text-heading shadow-sm hover:shadow-md text-[11px] font-bold cursor-pointer transition-all opacity-60 hover:opacity-100"
          title={isAr ? 'انقر لتفعيل مساعد المطور' : 'Click to enable assistant pet'}
        >
          <Sparkles className="w-3.5 h-3.5 text-accent animate-pulse" />
          <span>{isAr ? 'إظهار مساعد المطور' : 'Show assistant'}</span>
        </button>
      </aside>
    );
  }

  // Positioning:
  // - If dragged: use absolute px (left, top)
  // - If default:
  //   - Arabic (RTL): Bottom-Left (left: 20px, bottom: 20px)
  //   - English (LTR): Bottom-Right (right: 20px, bottom: 20px)
  const containerStyle: React.CSSProperties = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : isRTL
    ? { left: '20px', bottom: '20px' }
    : { right: '20px', bottom: '20px' };

  const isLeftAnchored = position
    ? position.x < (typeof window !== 'undefined' ? window.innerWidth / 2 : 500)
    : isRTL;

  const isTopAnchored = position ? position.y < 220 : false;
  const horizontalAlignClass = isLeftAnchored ? 'left-0' : 'right-0';
  const verticalAlignClass = isTopAnchored ? 'top-full mt-3' : 'bottom-full mb-3';

  return (
    <>
      {/* Floating Draggable Pet Container */}
      <aside
        ref={petContainerRef}
        aria-label="مساعد المطور"
        onPointerDown={handlePointerDown}
        style={containerStyle}
        className={`fixed z-40 select-none touch-none transition-opacity duration-300 ${
          isDragging ? 'opacity-100 cursor-grabbing scale-105' : 'opacity-60 hover:opacity-100 cursor-grab'
        }`}
      >
        <div className="relative">
          {/* Dropdown Popup Menu (Above Pet on Click) */}
          {menuOpen && (
            <div
              ref={dropdownRef}
              data-dropdown="true"
              className={`absolute ${verticalAlignClass} ${horizontalAlignClass} z-50 w-60 rounded-2xl bg-surface/95 backdrop-blur-md border border-muted-border/60 shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150`}
            >
              {/* Option 1: Send message to developer */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setOpen(true);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-hover text-heading text-xs font-bold transition text-start cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MessageSquarePlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate">{isAr ? 'إرسال رسالة للمطور' : 'Send message to developer'}</span>
                  <span className="block text-[10px] text-neutral-text/60 font-normal truncate">
                    {isAr ? 'اقتراح أو إبلاغ عن مشكلة' : 'Suggest or report issue'}
                  </span>
                </div>
              </button>

              <div className="h-px bg-muted-border/30 my-1" />

              {/* Option 2: Close assistant */}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  toggleEnabled();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-500/10 text-red-500 text-xs font-bold transition text-start cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/15 text-red-500 flex items-center justify-center shrink-0">
                  <Power className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate">{isAr ? 'إغلاق المساعد' : 'Close assistant'}</span>
                  <span className="block text-[10px] text-neutral-text/50 font-normal truncate">
                    {isAr ? 'إخفاء المساعد من الشاشة' : 'Hide from screen'}
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Pet Mascot Avatar */}
          <div
            onClick={handlePetClick}
            className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-accent via-sky-500 to-indigo-600 text-white shadow-xl hover:shadow-accent/40 transition-transform transform active:scale-95 ring-4 ring-white/20 p-1"
            role="button"
            tabIndex={0}
            aria-label={isAr ? 'فتح قائمة مساعد المطور' : 'Open developer assistant menu'}
          >
            {/* Animated Pet Graphic */}
            <div className="w-full h-full rounded-full flex items-center justify-center pointer-events-none">
              <svg width="34" height="34" viewBox="0 0 40 40" fill="none" className="drop-shadow-md">
                {/* Cat / Robot Ears */}
                <path d="M10 14L5 4L16 9" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M30 14L35 4L24 9" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M9 12L6 6L14 10" fill="#f43f5e" opacity="0.65" />
                <path d="M31 12L34 6L26 10" fill="#f43f5e" opacity="0.65" />

                {/* Main Head Base */}
                <rect x="6" y="9" width="28" height="25" rx="12" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />

                {/* Dark Visor / Face Screen */}
                <rect x="8.5" y="12" width="23" height="18" rx="8" fill="#020617" />

                {/* Glowing Blue Eyes */}
                <circle cx="15" cy="19" r="2.8" fill="#38bdf8" />
                <circle cx="25" cy="19" r="2.8" fill="#38bdf8" />
                <circle cx="16.2" cy="17.8" r="1.1" fill="#ffffff" />
                <circle cx="26.2" cy="17.8" r="1.1" fill="#ffffff" />

                {/* Blushing Cheeks */}
                <circle cx="11.5" cy="24" r="2" fill="#f43f5e" opacity="0.85" />
                <circle cx="28.5" cy="24" r="2" fill="#f43f5e" opacity="0.85" />

                {/* Cute Smile */}
                <path d="M18 23.5C18.8 25 21.2 25 22 23.5" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" />

                {/* Sparkle on top */}
                <circle cx="20" cy="5" r="1.5" fill="#facc15" />
              </svg>
            </div>

            {/* Online notification badge */}
            <span className="absolute -top-0.5 -end-0.5 flex h-3.5 w-3.5 pointer-events-none">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
            </span>
          </div>
        </div>
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
                    {isAr ? 'صندوق الملاحظات والاقتراحات للمطور' : 'Developer Feedback & Suggestions'}
                  </h3>
                  <p className="text-[11px] text-neutral-text/65 mt-0.5">
                    {isAr
                      ? 'أرسل طلب تحديث أو أبلغ عن مشكلة مباشرة إلى مطور النظام'
                      : 'Send an update request or report an issue directly to the developer'}
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
                aria-label={isAr ? 'إغلاق' : 'Close'}
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
                  <h4 className="text-sm font-black text-heading">
                    {isAr ? 'تم إرسال الملاحظة بنجاح' : 'Feedback Sent Successfully'}
                  </h4>
                  <p className="text-xs text-neutral-text/70 max-w-sm mx-auto leading-relaxed">
                    {isAr
                      ? 'شكراً لك! تم توثيق الملاحظة وإرسالها للمطور لمراجعتها والعمل عليها.'
                      : 'Thank you! Your feedback has been recorded and submitted to the development team.'}
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
                      {isAr ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                </div>
              ) : (
                <form id="feedback-form" onSubmit={handleSubmit} className="space-y-4">
                  {/* Topic / Page */}
                  <div>
                    <label htmlFor="fb-section" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      {isAr ? 'الصفحة أو الموضوع المتعلق بالمشكلة' : 'Related Page / Topic'}
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
                      {isAr ? 'عنوان الملاحظة أو المشكلة *' : 'Feedback / Issue Title *'}
                    </label>
                    <input
                      id="fb-title"
                      type="text"
                      required
                      placeholder={isAr ? 'مثال: زر الحفظ لا يستجيب في صفحة المشاريع' : 'e.g., Save button not responding'}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                    />
                  </div>

                  {/* Problem Description */}
                  <div>
                    <label htmlFor="fb-body" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      {isAr ? 'تفاصيل المشكلة أو التعديل المطلوب *' : 'Description of Issue or Request *'}
                    </label>
                    <textarea
                      id="fb-body"
                      required
                      rows={4}
                      placeholder={isAr ? 'صف بالتفصيل ما الذي حدث وما الذي تتوقع أن يحدث...' : 'Describe what happened...'}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-y"
                    />
                  </div>

                  {/* Proposed Solution (Optional) */}
                  <div>
                    <label htmlFor="fb-solution" className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      {isAr ? 'الحل المقترح (اختياري)' : 'Suggested Solution (Optional)'}
                    </label>
                    <textarea
                      id="fb-solution"
                      rows={2}
                      placeholder={isAr ? 'إذا كان لديك فكرة أو حل مفضل...' : 'Any ideas or preferred fix...'}
                      value={solution}
                      onChange={(e) => setSolution(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-y"
                    />
                  </div>

                  {/* Screenshot Attachment / Clipboard paste */}
                  <div>
                    <span className="block text-[11px] font-bold text-neutral-text/70 mb-1">
                      {isAr ? 'لقطة الشاشة (اختياري - يمكنك أيضاً لصق الصورة مباشرة بـ Ctrl+V)' : 'Screenshot (Optional - or paste with Ctrl+V)'}
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
                              {screenshotFile?.name || (isAr ? 'لقطة شاشة ملصقة' : 'Pasted Screenshot')}
                            </span>
                            <span className="text-[10px] text-neutral-text/60">
                              {isAr ? 'جاهز للإرسال' : 'Ready to attach'}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={removeScreenshot}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer shrink-0"
                          title={isAr ? 'حذف الصورة' : 'Remove image'}
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
                        <span>{isAr ? 'انقر لاختيار لقطة شاشة أو الصقها مباشرة (Ctrl+V)' : 'Click to upload screenshot or paste (Ctrl+V)'}</span>
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
                  {isAr ? 'إلغاء' : 'Cancel'}
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
                      <span>{isAr ? 'جاري الإرسال...' : 'Sending...'}</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{isAr ? 'إرسال للمطور' : 'Send to Developer'}</span>
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
