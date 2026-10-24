import React, { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, Upload } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { careersService, type CareersFormConfig } from '../services/careersService';
import { ApiError, getErrorMessage } from '../services/api';

interface CareersPageProps {
  onNavigate: (page: any) => void;
}

export const CareersPage: React.FC<CareersPageProps> = () => {
  const { language } = useLanguage();
  const ar = language === 'ar';

  const [config, setConfig] = useState<CareersFormConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [message, setMessage] = useState('');
  const [cv, setCv] = useState<File | null>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [website, setWebsite] = useState(''); // honeypot

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoadingConfig(true);
    careersService.getFormConfig()
      .then((c) => { if (!cancelled) setConfig(c); })
      .catch((e) => { if (!cancelled) setConfigError(getErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoadingConfig(false); });
    return () => { cancelled = true; };
  }, []);

  const required = config?.required ?? { name: true, email: true, phone: true, jobTitle: true, message: false, cv: false };

  const validateClient = (): boolean => {
    const next: Record<string, string> = {};
    if (required.name && !name.trim()) next.name = ar ? 'الاسم مطلوب' : 'Name is required';
    if (name.trim() && name.trim().length > 120) next.name = ar ? 'الاسم طويل جداً' : 'Name too long';
    if (required.email && !email.trim()) next.email = ar ? 'البريد مطلوب' : 'Email is required';
    if (email.trim() && (email.trim().length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) next.email = ar ? 'بريد غير صالح' : 'Invalid email';
    if (required.phone && !phone.trim()) next.phone = ar ? 'الجوال مطلوب' : 'Phone is required';
    if (phone.trim() && (phone.trim().length < 7 || phone.trim().length > 20 || !/^[0-9\s+\-()]+$/.test(phone.trim()))) next.phone = ar ? 'جوال غير صالح' : 'Invalid phone';
    if (required.jobTitle && !jobTitle.trim()) next.jobTitle = ar ? 'المسمى مطلوب' : 'Job title is required';
    if (jobTitle.trim() && jobTitle.trim().length > 150) next.jobTitle = ar ? 'المسمى طويل جداً' : 'Job title too long';
    if (required.message && !message.trim()) next.message = ar ? 'الرسالة مطلوبة' : 'Message is required';
    if (message.trim() && message.trim().length > 3000) next.message = ar ? 'الرسالة طويلة جداً' : 'Message too long';
    if (required.cv && !cv) next.cv = ar ? 'السيرة الذاتية مطلوبة' : 'CV is required';
    if (cv) {
      if (cv.type !== 'application/pdf') next.cv = ar ? 'يجب أن يكون PDF' : 'Must be PDF';
      if (cv.size > 5 * 1024 * 1024) next.cv = ar ? 'الحجم يتجاوز 5MB' : 'Exceeds 5MB';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateClient()) return;
    setSubmitting(true);
    setErrors({});
    try {
      const fd = new FormData();
      fd.append('name', name.trim());
      fd.append('email', email.trim());
      fd.append('phone', phone.trim());
      fd.append('jobTitle', jobTitle.trim());
      fd.append('message', message.trim());
      fd.append('website', website);
      if (cv) fd.append('cv', cv);
      await careersService.submitApplication(fd);
      setSuccess(true);
    } catch (e) {
      const msg = getErrorMessage(e, ar ? 'تعذر إرسال الطلب' : 'Failed to submit');
      // The server names the offending field as `{ error, field }`.
      const field = e instanceof ApiError ? (e.details as { field?: unknown } | undefined)?.field : undefined;
      if (typeof field === 'string') {
        setErrors({ [field]: msg });
      } else {
        setErrors({ form: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingConfig) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (configError) {
    return <div className="min-h-[50vh] flex items-center justify-center text-red-500">{configError}</div>;
  }

  if (success) {
    return (
      <div className="pt-28 sm:pt-36 pb-24 min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-black text-heading">{ar ? 'تم إرسال طلبك بنجاح' : 'Application submitted successfully'}</h2>
          <p className="text-sm text-neutral-text/70">{ar ? 'سنتواصل معك قريباً' : 'We will contact you soon'}</p>
        </div>
      </div>
    );
  }

  const inputClass = 'w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-sm text-heading outline-none focus:border-accent';

  const label = (field: string, text: string) => (
    <label className="block text-xs font-bold text-neutral-text/70 mb-1">
      {text} {required[field as keyof typeof required] && <span className="text-red-500">*</span>}
    </label>
  );

  return (
    <div className="pt-28 sm:pt-36 pb-24 min-h-screen">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-black text-heading mb-6 text-center">
          {ar ? 'قدّم على وظيفة' : 'Apply for a job'}
        </h1>
        <p className="mt-4 text-sm sm:text-base text-neutral-text/75 leading-relaxed text-center">
          {ar
            ? 'نسعد بانضمامك إلى فريق أجدا. أرسل بياناتك وسيراجعها فريقنا.'
            : "We'd be glad to have you on the Ajda team. Send your details and our team will review them."}
        </p>

        {errors.form && <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-500 text-xs">{errors.form}</div>}

        <form onSubmit={handleSubmit} className="space-y-4 bg-surface border border-muted-border/40 rounded-2xl p-5">
          {/* honeypot */}
          <div className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none" aria-hidden="true" tabIndex={-1}>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <div>
            {label('name', ar ? 'الاسم' : 'Name')}
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            {label('email', ar ? 'البريد الإلكتروني' : 'Email')}
            <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} dir="ltr" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            {label('phone', ar ? 'الجوال' : 'Phone')}
            <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} dir="ltr" />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            {label('jobTitle', ar ? 'المسمى الوظيفي' : 'Job title')}
            <input className={inputClass} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={150} />
            {errors.jobTitle && <p className="text-xs text-red-500 mt-1">{errors.jobTitle}</p>}
          </div>

          <div>
            {label('message', ar ? 'رسالة / وصف' : 'Message')}
            <textarea rows={4} className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={3000} />
            {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
          </div>

          <div>
            {label('cv', ar ? 'السيرة الذاتية (PDF)' : 'CV (PDF)')}
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={cvInputRef}
                type="file"
                accept="application/pdf"
                id="cv-input"
                className="peer sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setCv(file);
                  if (file) {
                    const next = { ...errors };
                    delete next.cv;
                    setErrors(next);
                  }
                }}
              />
              <label
                htmlFor="cv-input"
                className="brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl cursor-pointer inline-flex items-center gap-2 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2"
              >
                <Upload className="w-3.5 h-3.5" />
                {cv
                  ? ar
                    ? 'تم اختيار ملف'
                    : 'File chosen'
                  : ar
                    ? 'اختر السيرة الذاتية (PDF)'
                    : 'Choose CV (PDF)'}
              </label>
              {cv && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-xs text-neutral-text/60 truncate max-w-[200px]"
                    dir="ltr"
                    title={cv.name}
                  >
                    {cv.name.length > 40 ? cv.name.slice(0, 40) + '…' : cv.name}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setCv(null);
                      const next = { ...errors };
                      delete next.cv;
                      setErrors(next);
                      if (cvInputRef.current) cvInputRef.current.value = '';
                    }}
                    aria-label={ar ? 'إزالة الملف' : 'Remove file'}
                    className="text-xs text-red-500 hover:text-red-700 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            {/* CV_MAX_BYTES = 5 * 1024 * 1024 in server/src/routes/careers.routes.ts */}
            <p className="text-xs text-neutral-text/60 mt-1">
              {ar ? 'ملف PDF فقط، بحد أقصى 5 ميجابايت' : 'PDF only, up to 5 MB'}
            </p>
            {errors.cv && <p className="text-xs text-red-500 mt-1">{errors.cv}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full brand-btn-primary font-black py-3 rounded-xl text-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {ar ? 'إرسال الطلب' : 'Submit application'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CareersPage;