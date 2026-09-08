import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2, Zap, ShieldCheck, Headphones, MessageCircleMore } from 'lucide-react';
import { Reveal } from '../common/Reveal';

interface ContactPageProps {
  onSuccessToast?: (msg: string) => void;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  subject: string;
  message: string;
}

const initialForm: FormState = { name: '', phone: '', email: '', subject: 'استفسار عام', message: '' };

const contactItems = [
  { icon: MapPin, label: 'العنوان', value: 'الرياض، طريق الملك فهد', dir: 'rtl' as const },
  {
    icon: Phone,
    label: 'واتساب والمحادثة المباشرة',
    value: '+966 58 048 4528',
    dir: 'ltr' as const,
    href: 'https://wa.me/966580484528',
    isExternal: true,
  },
  { icon: Mail, label: 'البريد الإلكتروني', value: 'info@ajdaa.sa', dir: 'ltr' as const, href: 'mailto:info@ajdaa.sa' },
  { icon: Clock, label: 'ساعات العمل', value: 'الأحد – الخميس، 8ص – 4م', dir: 'rtl' as const },
];

const socialLinks = [
  {
    label: 'X (Twitter)',
    href: 'https://x.com/Ajdaa_RS',
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/ajdaa_rs',
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@ajdaa_rs',
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1.01-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.24 1.17 2.22 2.39 2.47.78.17 1.6.09 2.33-.24.78-.34 1.41-.97 1.74-1.74.24-.54.34-1.13.34-1.72V0h2.09l.11.02Z',
  },
  {
    label: 'Snapchat',
    href: 'https://snapchat.com/t/sVxEBu75',
    path: 'M12.002 2.002c-4.07 0-6.73 3.03-6.73 6.38 0 1.29.38 2.58.98 3.51.2.31.28.63.22.95-.1.52-.57.85-1.07 1.01-.48.15-1.05.2-1.35.47-.2.18-.28.46-.17.7.15.33.61.53 1.1.66.86.23 1.83.18 2.56.7.4.29.61.73.66 1.17.06.51-.09.99-.44 1.37-.47.51-1.21.84-1.93 1.16-.62.27-.79.62-.64 1.04.14.39.63.63 1.22.75.9.18 1.91.13 2.76.62.58.33.91.86 1.29 1.39.56.77 1.35 1.13 2.73 1.13s2.17-.36 2.73-1.13c.38-.53.71-1.06 1.29-1.39.85-.49 1.86-.44 2.76-.62.59-.12 1.08-.36 1.22-.75.15-.42-.02-.77-.64-1.04-.72-.32-1.46-.65-1.93-1.16-.35-.38-.5-.86-.44-1.37.05-.44.26-.88.66-1.17.73-.52 1.7-.47 2.56-.7.49-.13.95-.33 1.1-.66.11-.24.03-.52-.17-.7-.3-.27-.87-.32-1.35-.47-.5-.16-.97-.49-1.07-1.01-.06-.32.02-.64.22-.95.6-.93.98-2.22.98-3.51 0-3.35-2.66-6.38-6.73-6.38z',
  },
];

const highlights = [
  { icon: Zap, text: 'رد سريع خلال 24 ساعة' },
  { icon: ShieldCheck, text: 'خصوصية وأمان لبياناتك' },
  { icon: Headphones, text: 'دعم استشاري واستثماري مستمر' },
];

const subjects = [
  'استفسار عام',
  'حجز / استفسار عن مستودع لوجستي',
  'حجز / استفسار عن محل أو معرض تجاري',
  'استفسار عن مكاتب إدارية',
  'فرص استثمار وشراكات'
];

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, error, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-neutral-text/60 mb-1.5">{label}</label>
    {children}
    {error && <p className="text-[11px] text-red-400 mt-1.5">{error}</p>}
  </div>
);

export const ContactPage: React.FC<ContactPageProps> = ({ onSuccessToast }) => {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'يرجى إدخال الاسم';
    if (!form.phone.trim()) next.phone = 'يرجى إدخال رقم الجوال';
    else if (!/^[0-9+()\s-]{7,}$/.test(form.phone.trim())) next.phone = 'رقم الجوال غير صالح';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'البريد الإلكتروني غير صالح';
    if (form.message.trim().length < 10) next.message = 'اكتب رسالة لا تقل عن 10 أحرف';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSent(true);
      onSuccessToast?.('تم إرسال رسالتك بنجاح');
    }, 900);
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setSent(false);
  };

  return (
    <div className="relative pt-32 pb-24 max-w-7xl mx-auto px-6 overflow-hidden">
      <div aria-hidden className="absolute top-40 right-1/4 w-[480px] h-[320px] bg-gold/8 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div aria-hidden className="absolute top-[640px] -left-32 w-[460px] h-[380px] bg-accent/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11rem] md:text-[15rem] font-black text-heading/[0.015] select-none pointer-events-none leading-none">
        تواصل
      </div>

      <div className="relative text-center mb-14 stagger-anim" style={{ animationDelay: '80ms' }}>
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <MessageCircleMore className="w-3.5 h-3.5 text-accent-light" />
          تواصل معنا
        </span>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          نحن هنا <span className="brand-gradient-text">لخدمتك</span>
        </h1>
        <p className="text-sm md:text-base text-neutral-text/60 max-w-xl mx-auto mt-4 leading-relaxed">
          فريقنا جاهز للإجابة على استفساراتك وتقديم الاستشارة العقارية المناسبة لاحتياجاتك
        </p>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <Reveal direction="right" className="lg:col-span-2">
          <div className="glass-card h-full rounded-3xl p-8 flex flex-col">
            <h3 className="text-lg font-black text-heading mb-6">معلومات التواصل</h3>

            <div className="flex flex-col gap-4 mb-8">
              {contactItems.map((item) => {
                const Icon = item.icon;
                const Content = (
                  <>
                    <div className="w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-accent/25 via-accent/10 to-transparent border border-accent/30 flex items-center justify-center text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-canvas">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-neutral-text/50 mb-0.5">{item.label}</div>
                      <div dir={item.dir} className="text-sm font-bold text-heading truncate group-hover:text-accent transition-colors">{item.value}</div>
                    </div>
                  </>
                );

                if (item.href) {
                  return (
                    <a
                      key={item.label}
                      href={item.href}
                      target={item.isExternal ? '_blank' : undefined}
                      rel={item.isExternal ? 'noopener noreferrer' : undefined}
                      className="flex items-center gap-4 group transition-transform hover:translate-x-1"
                    >
                      {Content}
                    </a>
                  );
                }

                return (
                  <div key={item.label} className="flex items-center gap-4 group">
                    {Content}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-muted-border/20 pt-6 mt-auto">
              <div className="mb-6">
                <span className="text-[11px] font-bold text-neutral-text/60 block mb-2.5">تابعنا على منصات التواصل:</span>
                <div className="flex items-center gap-2">
                  {socialLinks.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={s.label}
                      aria-label={s.label}
                      className="w-10 h-10 rounded-xl border border-muted-border/40 bg-surface/60 flex items-center justify-center text-neutral-text/70 hover:text-accent hover:border-accent/80 hover:bg-accent/15 transition-all hover:scale-105"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                        <path d={s.path} />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.text} className="flex items-center gap-2.5 text-xs text-neutral-text/75">
                      <Icon className="w-4 h-4 text-gold shrink-0" />
                      {item.text}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal direction="left" className="lg:col-span-3">
          <div className="glass-card rounded-3xl p-8 md:p-10 h-full relative overflow-hidden">
            <div aria-hidden className="absolute -top-20 -right-20 w-56 h-56 bg-accent/8 blur-[90px] rounded-full pointer-events-none" />

            {sent ? (
              <div className="relative h-full min-h-[420px] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-success/15 border border-success/40 flex items-center justify-center mb-7 pop-in">
                  <CheckCircle2 className="w-10 h-10 text-success" />
                </div>
                <h3 className="text-2xl font-black text-heading mb-3">تم إرسال رسالتك بنجاح</h3>
                <p className="text-sm text-neutral-text/60 max-w-sm leading-relaxed mb-8">
                  شكراً لتواصلك معنا، سيتواصل معك أحد مستشارينا في أقرب وقت ممكن
                </p>
                <button
                  onClick={resetForm}
                  className="brand-btn-secondary text-xs font-bold px-6 py-2.5 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                >
                  إرسال رسالة أخرى
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="relative grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="الاسم الكامل" error={errors.name}>
                  <div className={`field-shell ${errors.name ? '!border-red-400/70' : ''}`}>
                    <input
                      value={form.name}
                      onChange={set('name')}
                      placeholder="مثال: أحمد محمد"
                      className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40"
                    />
                  </div>
                </Field>

                <Field label="رقم الجوال" error={errors.phone}>
                  <div className={`field-shell ${errors.phone ? '!border-red-400/70' : ''}`}>
                    <input
                      type="tel"
                      dir="ltr"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+966 5X XXX XXXX"
                      className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40"
                    />
                  </div>
                </Field>

                <Field label="البريد الإلكتروني (اختياري)" error={errors.email}>
                  <div className={`field-shell ${errors.email ? '!border-red-400/70' : ''}`}>
                    <input
                      type="email"
                      dir="ltr"
                      value={form.email}
                      onChange={set('email')}
                      placeholder="name@email.com"
                      className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40"
                    />
                  </div>
                </Field>

                <Field label="الموضوع">
                  <div className="field-shell">
                    <select value={form.subject} onChange={set('subject')} className="field-select">
                      {subjects.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </Field>

                <div className="sm:col-span-2">
                  <Field label="الرسالة" error={errors.message}>
                    <div className={`field-shell ${errors.message ? '!border-red-400/70' : ''}`}>
                      <textarea
                        rows={4}
                        value={form.message}
                        onChange={set('message')}
                        placeholder="اكتب رسالتك هنا..."
                        className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40 resize-none"
                      />
                    </div>
                  </Field>
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                  <p className="text-[11px] text-neutral-text/45">
                    بالضغط على إرسال أنت توافق على سياسة الخصوصية الخاصة بنا
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="brand-btn-primary flex items-center gap-2 font-bold text-sm px-8 py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        إرسال الرسالة
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
};
