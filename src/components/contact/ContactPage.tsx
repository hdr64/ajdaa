import React, { useState } from 'react';
import { Phone, Mail, MapPin, Clock, Send, CheckCircle2, Zap, ShieldCheck, Headphones, MessageCircleMore } from 'lucide-react';
import { Reveal } from '../common/Reveal';
import { AdminStorage } from '../../services/adminStorage';
import { getErrorMessage } from '../../services/api';
import { useLanguage } from '../../hooks/useLanguage';
import { useSiteSettings, whatsappUrl } from '../../hooks/useSiteSettings';
import { SOCIAL_KEYS } from '../../services/settingsService';
import { SOCIAL_ICONS } from '../common/socialIcons';

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

const subjects = [
  { value: 'استفسار عام', labelAr: 'استفسار عام', labelEn: 'General Inquiry' },
  { value: 'حجز / استفسار عن مستودع لوجستي', labelAr: 'حجز / استفسار عن مستودع لوجستي', labelEn: 'Inquiry / Booking: Logistics Warehouse' },
  { value: 'حجز / استفسار عن محل أو معرض تجاري', labelAr: 'حجز / استفسار عن محل أو معرض تجاري', labelEn: 'Inquiry / Booking: Retail Store or Showroom' },
  { value: 'استفسار عن مكاتب إدارية', labelAr: 'استفسار عن مكاتب إدارية', labelEn: 'Inquiry about Administrative Offices' },
  { value: 'فرص استثمار وشراكات', labelAr: 'فرص استثمار وشراكات', labelEn: 'Investment Opportunities & Partnerships' },
];

/** Maps the form subject to the CRM interest type. */
const SUBJECT_INTEREST: Record<string, 'rent' | 'buy' | 'invest' | 'general'> = {
  'استفسار عام': 'general',
  'حجز / استفسار عن مستودع لوجستي': 'rent',
  'حجز / استفسار عن محل أو معرض تجاري': 'rent',
  'استفسار عن مكاتب إدارية': 'rent',
  'فرص استثمار وشراكات': 'invest',
};

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
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Spam protection state
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [website, setWebsite] = useState('');

  const { settings } = useSiteSettings();
  const address = isAr ? settings.addressAr : settings.addressEn;
  const hours = isAr ? settings.hoursAr : settings.hoursEn;
  const whatsappHref = whatsappUrl(settings.whatsapp);
  const phoneDisplay = settings.phone || (settings.whatsapp ? `+${settings.whatsapp}` : '');

  const activeSocials = SOCIAL_KEYS.map((key) => {
    const href = settings.socials[key];
    const icon = SOCIAL_ICONS[key];
    return { key, href, label: icon.label, path: icon.path };
  }).filter((s) => Boolean(s.href && s.href.trim()));

  const contactItems = [
    address
      ? {
          icon: MapPin,
          label: isAr ? 'العنوان' : 'Address',
          value: address,
          dir: (isAr ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
        }
      : null,
    whatsappHref && phoneDisplay
      ? {
          icon: Phone,
          label: isAr ? 'واتساب والمحادثة المباشرة' : 'WhatsApp & Live Chat',
          value: phoneDisplay,
          dir: 'ltr' as const,
          href: whatsappHref,
          isExternal: true,
        }
      : null,
    settings.email
      ? {
          icon: Mail,
          label: isAr ? 'البريد الإلكتروني' : 'Email Address',
          value: settings.email,
          dir: 'ltr' as const,
          href: `mailto:${settings.email}`,
        }
      : null,
    hours
      ? {
          icon: Clock,
          label: isAr ? 'ساعات العمل' : 'Working Hours',
          value: hours,
          dir: (isAr ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const highlights = [
    { icon: Zap, text: isAr ? 'رد سريع خلال 24 ساعة' : 'Prompt response within 24 hours' },
    { icon: ShieldCheck, text: isAr ? 'خصوصية وأمان لبياناتك' : 'Data privacy & security guaranteed' },
    { icon: Headphones, text: isAr ? 'دعم استشاري واستثماري مستمر' : 'Continuous advisory & investment support' },
  ];

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) {
      next.name = isAr ? 'يرجى إدخال الاسم' : 'Please enter your name';
    }
    if (!form.phone.trim()) {
      next.phone = isAr ? 'يرجى إدخال رقم الجوال' : 'Please enter your mobile phone number';
    } else if (!/^[0-9+()\s-]{7,}$/.test(form.phone.trim())) {
      next.phone = isAr ? 'رقم الجوال غير صالح' : 'Invalid phone number';
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = isAr ? 'البريد الإلكتروني غير صالح' : 'Invalid email address';
    }
    if (form.message.trim().length < 10) {
      next.message = isAr ? 'اكتب رسالة لا تقل عن 10 أحرف' : 'Please write a message of at least 10 characters';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Contact messages land in the admin inquiries list (one inbox for the team).
  // The subject is kept at the top of the message so it stays visible there.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Spam protection check (honeypot or submission faster than 2 seconds)
    const isHoneypot = Boolean(website && website.trim().length > 0);
    const isTooFast = Date.now() - startedAt < 2000;
    if (isHoneypot || isTooFast) {
      setSent(true);
      onSuccessToast?.(isAr ? 'تم إرسال رسالتك بنجاح' : 'Your message has been sent successfully');
      return;
    }

    setSubmitting(true);
    try {
      await AdminStorage.addInquiry({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        interestType: SUBJECT_INTEREST[form.subject] ?? 'general',
        message: `[${form.subject}] ${form.message.trim()}`,
        website,
        elapsedMs: Date.now() - startedAt,
      });
      setSent(true);
      onSuccessToast?.(isAr ? 'تم إرسال رسالتك بنجاح' : 'Your message has been sent successfully');
    } catch (caught) {
      onSuccessToast?.(
        getErrorMessage(
          caught,
          isAr
            ? 'تعذر إرسال الرسالة، يرجى المحاولة مرة أخرى أو التواصل عبر واتساب'
            : 'Could not send the message. Please try again or contact us via WhatsApp'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setSent(false);
    setWebsite('');
    setStartedAt(Date.now());
  };

  return (
    <div className="relative pt-32 pb-24 max-w-7xl mx-auto px-6 overflow-hidden">
      <div aria-hidden className="absolute top-40 right-1/4 w-[480px] h-[320px] bg-gold/8 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div aria-hidden className="absolute top-[640px] -left-32 w-[460px] h-[380px] bg-accent/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11rem] md:text-[15rem] font-black text-heading/[0.015] select-none pointer-events-none leading-none">
        {isAr ? 'تواصل' : 'Contact'}
      </div>

      <div className="relative text-center mb-14 stagger-anim" style={{ animationDelay: '80ms' }}>
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full">
          <MessageCircleMore className="w-3.5 h-3.5 text-accent-light" />
          {isAr ? 'تواصل معنا' : 'Contact Us'}
        </span>
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-black mt-6">
          {isAr ? 'نحن هنا ' : 'We Are Here to '}
          <span className="brand-gradient-text">{isAr ? 'لخدمتك' : 'Serve You'}</span>
        </h1>
        <p className="text-sm md:text-base text-neutral-text/60 max-w-xl mx-auto mt-4 leading-relaxed">
          {isAr
            ? 'فريقنا جاهز للإجابة على استفساراتك وتقديم الاستشارة العقارية المناسبة لاحتياجاتك'
            : 'Our team is ready to answer your inquiries and provide tailored real estate consultation for your needs'}
        </p>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
        <Reveal direction="right" className="lg:col-span-2">
          <div className="glass-card h-full rounded-3xl p-8 flex flex-col">
            <h3 className="text-lg font-black text-heading mb-6">
              {isAr ? 'معلومات التواصل' : 'Contact Information'}
            </h3>

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
                      <div dir={item.dir} className="text-sm font-bold text-heading truncate group-hover:text-accent transition-colors">
                        {item.value}
                      </div>
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
              {activeSocials.length > 0 && (
                <div className="mb-6">
                  <span className="text-[11px] font-bold text-neutral-text/60 block mb-2.5">
                    {isAr ? 'تابعنا على منصات التواصل:' : 'Follow us on social platforms:'}
                  </span>
                  <div className="flex items-center gap-2">
                    {activeSocials.map((s) => (
                      <a
                        key={s.key}
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
              )}

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
                <h3 className="text-2xl font-black text-heading mb-3">
                  {isAr ? 'تم إرسال رسالتك بنجاح' : 'Your message has been sent successfully'}
                </h3>
                <p className="text-sm text-neutral-text/60 max-w-sm leading-relaxed mb-8">
                  {isAr
                    ? 'شكراً لتواصلك معنا، سيتواصل معك أحد مستشارينا في أقرب وقت ممكن'
                    : 'Thank you for reaching out to us. One of our consultants will contact you as soon as possible.'}
                </p>
                <button
                  onClick={resetForm}
                  className="brand-btn-secondary text-xs font-bold px-6 py-2.5 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                >
                  {isAr ? 'إرسال رسالة أخرى' : 'Send Another Message'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="relative grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Honeypot field for bot spam prevention */}
                <div
                  className="absolute -left-[9999px] -top-[9999px] opacity-0 pointer-events-none"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <label htmlFor="contact-website">Website</label>
                  <input
                    id="contact-website"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </div>

                <Field label={isAr ? 'الاسم الكامل' : 'Full Name'} error={errors.name}>
                  <div className={`field-shell ${errors.name ? '!border-red-400/70' : ''}`}>
                    <input
                      value={form.name}
                      onChange={set('name')}
                      placeholder={isAr ? 'مثال: أحمد محمد' : 'e.g. Ahmed Mohammed'}
                      className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40"
                    />
                  </div>
                </Field>

                <Field label={isAr ? 'رقم الجوال' : 'Mobile Phone'} error={errors.phone}>
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

                <Field label={isAr ? 'البريد الإلكتروني (اختياري)' : 'Email (Optional)'} error={errors.email}>
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

                <Field label={isAr ? 'الموضوع' : 'Subject'}>
                  <div className="field-shell">
                    <select value={form.subject} onChange={set('subject')} className="field-select">
                      {subjects.map((s) => (
                        <option key={s.value} value={s.value}>
                          {isAr ? s.labelAr : s.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>
                </Field>

                <div className="sm:col-span-2">
                  <Field label={isAr ? 'الرسالة' : 'Message'} error={errors.message}>
                    <div className={`field-shell ${errors.message ? '!border-red-400/70' : ''}`}>
                      <textarea
                        rows={4}
                        value={form.message}
                        onChange={set('message')}
                        placeholder={isAr ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
                        className="w-full min-w-0 bg-transparent text-sm text-heading outline-none placeholder:text-neutral-text/40 resize-none"
                      />
                    </div>
                  </Field>
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                  <p className="text-[11px] text-neutral-text/45">
                    {isAr
                      ? 'بالضغط على إرسال أنت توافق على سياسة الخصوصية الخاصة بنا'
                      : 'By clicking submit, you agree to our privacy policy'}
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="brand-btn-primary flex items-center gap-2 font-bold text-sm px-8 py-3 rounded-full hover:-translate-y-0.5 transition-all duration-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                  >
                    {submitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin" />
                        {isAr ? 'جاري الإرسال...' : 'Sending...'}
                      </>
                    ) : (
                      <>
                        {isAr ? 'إرسال الرسالة' : 'Send Message'}
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

