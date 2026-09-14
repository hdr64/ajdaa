import React, { useState } from 'react';
import type { Property, PropertyUnit } from '../../types/property';
import { AdminStorage } from '../../services/adminStorage';
import { PropertyCard } from '../common/PropertyCard';
import { CheckCircle2, ArrowRight, ArrowLeft, Sparkles, Send, MapPin } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface InterestRegistrationViewProps {
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
  onSuccessToast: (msg: string) => void;
  initialUnit?: PropertyUnit | null;
}

export const InterestRegistrationView: React.FC<InterestRegistrationViewProps> = ({
  selectedProperty,
  onSelectProperty,
  onSuccessToast,
  initialUnit,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const allProjects = AdminStorage.getAllProjects();

  const [step, setStep] = useState<number>(selectedProperty ? 2 : 1);
  const [filter, setFilter] = useState<string>('all');
  const [selectedUnit] = useState<PropertyUnit | null>(initialUnit || null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    interestType: 'rent' as 'rent' | 'buy' | 'invest' | 'general',
    message: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const filtered = filter === 'all' ? allProjects : allProjects.filter((p) => p.type === filter);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      onSuccessToast(isAr ? 'يرجى إدخال اسمك' : 'Please enter your name');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      AdminStorage.addInquiry({
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        projectId: selectedProperty?.id,
        projectTitle: selectedProperty?.title,
        unitId: selectedUnit?.id,
        unitNumber: selectedUnit?.unitNumber,
        interestType: formData.interestType,
        interestTypeAr:
          formData.interestType === 'buy'
            ? 'شراء'
            : formData.interestType === 'rent'
            ? 'استئجار'
            : formData.interestType === 'invest'
            ? 'استثمار'
            : 'استفسار عام',
        message: formData.message.trim() || undefined,
      });

      setSubmitting(false);
      setStep(3);
      onSuccessToast(
        isAr ? 'تم تسجيل اهتمامك بنجاح! سيتواصل معك فريقنا قريباً.' : 'Your interest has been submitted successfully!'
      );
    }, 500);
  };

  const steps = isAr
    ? [
        { num: 1, label: 'اختيار المشروع' },
        { num: 2, label: 'تسجيل الاهتمام' },
        { num: 3, label: 'تأكيد التسجيل' },
      ]
    : [
        { num: 1, label: 'Select Project' },
        { num: 2, label: 'Express Interest' },
        { num: 3, label: 'Confirmation' },
      ];

  const filterOptions = isAr
    ? [
        { key: 'all', label: 'كافة المشاريع' },
        { key: 'commercial', label: 'مراكز ومحلات تجارية' },
        { key: 'office', label: 'مكاتب ومراكز أعمال' },
        { key: 'logistics', label: 'مستودعات لوجستية' },
      ]
    : [
        { key: 'all', label: 'All Projects' },
        { key: 'commercial', label: 'Commercial & Retail' },
        { key: 'office', label: 'Offices & Business Hubs' },
        { key: 'logistics', label: 'Logistics Warehouses' },
      ];

  return (
    <div className="pt-28 sm:pt-36 pb-24 max-w-5xl mx-auto px-4 sm:px-6">
      {/* Title Header */}
      <div className="text-center mb-10">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-1.5 rounded-full mb-3">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          {isAr ? 'تسجيل الاهتمام بالمشاريع' : 'Register Project Interest'}
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3">
          {isAr ? 'سجّل ' : 'Register Your '}
          <span className="brand-gradient-text">
            {isAr ? 'اهتمامك بالمشروع' : 'Interest in Our Projects'}
          </span>
        </h1>
        <p className="text-neutral-text/65 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
          {isAr
            ? 'اختر المشروع أو الوحدة التي تناسب تطلعاتك وسيقوم فريق الاستثمار والتطوير بالتواصل معك وتقديم كافة التفاصيل والعروض.'
            : 'Select your preferred development or commercial unit and our real estate advisory team will get in touch with all offerings.'}
        </p>
      </div>

      {/* Modern Stepper Indicator */}
      <div className="flex items-center justify-center max-w-md mx-auto mb-10 px-4">
        {steps.map((st, idx) => (
          <React.Fragment key={st.num}>
            <div className="flex flex-col items-center gap-1.5 z-10">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  step === st.num
                    ? 'brand-fill text-canvas ring-4 ring-accent/20 scale-105'
                    : step > st.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-surface border border-muted-border/50 text-neutral-text/40'
                }`}
              >
                {step > st.num ? <CheckCircle2 className="w-4 h-4" /> : st.num}
              </div>
              <span className={`text-[11px] font-bold ${step >= st.num ? 'text-heading' : 'text-neutral-text/40'}`}>
                {st.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 -mt-5 transition-colors duration-300 ${
                  step > idx + 1 ? 'bg-emerald-500' : 'bg-muted-border/40'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Select Project */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 justify-start sm:justify-center">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  filter === opt.key
                    ? 'brand-btn-primary'
                    : 'bg-surface border border-muted-border/40 text-neutral-text/70 hover:border-accent/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((prop) => (
              <div
                key={prop.id}
                onClick={() => {
                  onSelectProperty(prop);
                  setStep(2);
                }}
                className="cursor-pointer group"
              >
                <PropertyCard
                  property={prop}
                  onSelect={(p) => {
                    onSelectProperty(p);
                    setStep(2);
                  }}
                  onQuickView={(p) => {
                    onSelectProperty(p);
                    setStep(2);
                  }}
                  onFavToast={onSuccessToast}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Register Interest Form */}
      {step === 2 && selectedProperty && (
        <div className="max-w-2xl mx-auto rounded-3xl bg-surface/90 border border-muted-border/40 p-6 sm:p-10 shadow-sm">
          {/* Selected Project Pill */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-canvas/70 border border-muted-border/40 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={selectedProperty.image}
                alt=""
                className="w-14 h-14 rounded-xl object-cover"
              />
              <div>
                <span className="text-[10px] font-bold text-accent block">{selectedProperty.typeAr}</span>
                <h4 className="text-sm font-black text-heading">{selectedProperty.title}</h4>
                <div className="flex items-center gap-2 text-[11px] text-neutral-text/60 mt-0.5">
                  <MapPin className="w-3 h-3 text-accent" />
                  <span>{selectedProperty.city}</span>
                  {selectedUnit && (
                    <span className="font-bold text-accent">({selectedUnit.unitNumber})</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep(1)}
              className="text-xs text-accent font-bold hover:underline cursor-pointer shrink-0"
            >
              {isAr ? 'تغيير' : 'Change'}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'الاسم الكامل *' : 'Full Name *'}
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isAr ? 'أدخل اسمك الكريم' : 'Enter your full name'}
                className="w-full px-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
              />
            </div>

            {/* Phone & Email (both optional as instructed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
                  {isAr ? 'رقم الجوال (اختياري)' : 'Mobile Phone (Optional)'}
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+966 5X XXX XXXX"
                  className="w-full px-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
                  {isAr ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)'}
                </label>
                <input
                  type="email"
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@domain.com"
                  className="w-full px-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
                />
              </div>
            </div>

            {/* Interest Type */}
            <div>
              <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'طبيعة الاهتمام بالفرصة' : 'Nature of Interest'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'rent', labelAr: 'استئجار', labelEn: 'Lease / Rent' },
                  { key: 'buy', labelAr: 'شراء / تملك', labelEn: 'Purchase' },
                  { key: 'invest', labelAr: 'استثمار', labelEn: 'Investment' },
                  { key: 'general', labelAr: 'استفسار عام', labelEn: 'General Inquiry' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFormData({ ...formData, interestType: item.key as any })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      formData.interestType === item.key
                        ? 'brand-fill text-canvas border-accent'
                        : 'bg-canvas border-muted-border/40 text-neutral-text/70 hover:border-accent/40'
                    }`}
                  >
                    {isAr ? item.labelAr : item.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-xs font-bold text-neutral-text/70 mb-1.5">
                {isAr ? 'تفاصيل إضافية أو استفسار' : 'Additional Message or Inquiry'}
              </label>
              <textarea
                rows={3}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder={
                  isAr
                    ? 'اذكر أي تفاصيل إضافية مثل المساحة المطلوبة، النشاط التجاري، أو رغبتك في دور معين...'
                    : 'Mention any required area, commercial activity, or floor preference...'
                }
                className="w-full px-4 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-none"
              />
            </div>

            <div className="flex items-center justify-between gap-4 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="brand-btn-secondary text-xs font-bold px-5 py-3 rounded-xl cursor-pointer"
              >
                {isAr ? 'رجوع' : 'Back'}
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="brand-btn-primary font-black text-xs px-8 py-3.5 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? (isAr ? 'جاري الإرسال...' : 'Submitting...') : (isAr ? 'تأكيد تسجيل الاهتمام' : 'Submit Interest')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Step 3: Success Confirmation */}
      {step === 3 && (
        <div className="max-w-xl mx-auto rounded-3xl bg-surface/90 border border-muted-border/40 p-8 sm:p-12 text-center shadow-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-2xl font-black text-heading mb-2">
            {isAr ? 'تم تسجيل اهتمامك بنجاح!' : 'Interest Registered Successfully!'}
          </h3>

          <p className="text-xs sm:text-sm text-neutral-text/70 leading-relaxed max-w-md mx-auto mb-8">
            {isAr
              ? `شكراً لتواصلك مع أجدا العقارية بخصوص ${selectedProperty?.title || 'المشروع'}. تم استلام طلبك وسيتواصل معك مستشار التطوير العقاري في أقرب وقت.`
              : `Thank you for your interest in ${selectedProperty?.title || 'the project'}. Our development team will review your inquiry and contact you shortly.`}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setStep(1);
                setFormData({ name: '', phone: '', email: '', interestType: 'rent', message: '' });
              }}
              className="w-full sm:w-auto brand-btn-secondary font-bold text-xs px-6 py-3 rounded-xl cursor-pointer"
            >
              {isAr ? 'تسجيل اهتمام بمشروع آخر' : 'Explore Another Project'}
            </button>
            <a
              href="https://wa.me/966580484528"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto brand-btn-primary font-bold text-xs px-6 py-3 rounded-xl flex items-center justify-center gap-2"
            >
              <span>{isAr ? 'محادثة فورية عبر واتساب' : 'WhatsApp Support'}</span>
              <ArrowIcon className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
