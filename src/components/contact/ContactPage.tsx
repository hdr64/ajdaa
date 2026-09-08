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
  { icon: Clock, label: 'ساعات العمل', value: 'السبت – الخميس، 9ص – 6م', dir: 'rtl' as const },
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
