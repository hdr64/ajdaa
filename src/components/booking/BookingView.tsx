import React, { useState } from 'react';
import type { Property, BookingFormData } from '../../types/property';
import { properties, getPropertyDisplay } from '../../data/properties';
import { PropertyCard } from '../common/PropertyCard';
import { CheckCircle2, ArrowRight, ArrowLeft, Clock, Video, UserCheck, MapPin, Sparkles } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';

interface BookingViewProps {
  selectedProperty: Property | null;
  onSelectProperty: (property: Property) => void;
  onSuccessToast: (msg: string) => void;
}

export const BookingView: React.FC<BookingViewProps> = ({
  selectedProperty,
  onSelectProperty,
  onSuccessToast,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const timeSlots = isAr
    ? ['10:00 صباحاً', '02:00 ظهراً', '05:00 مساءً', '08:00 مساءً']
    : ['10:00 AM', '02:00 PM', '05:00 PM', '08:00 PM'];

  const [step, setStep] = useState<number>(selectedProperty ? 2 : 1);
  const [filter, setFilter] = useState<string>('all');
  const [visitMode, setVisitMode] = useState<'in_person' | 'virtual'>('in_person');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>(timeSlots[2]);
  const [formData, setFormData] = useState<BookingFormData>({
    name: '',
    phone: '',
    email: '',
    bookingType: 'visit',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const filtered = filter === 'all' ? properties : properties.filter((p) => p.type === filter);

  const selectedDisplay = selectedProperty ? getPropertyDisplay(selectedProperty, language) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setStep(3);
    onSuccessToast(
      isAr
        ? 'تم تأكيد موعد حجز المعاينة بنجاح!'
        : 'Viewing appointment confirmed successfully!'
    );
  };

  const steps = isAr
    ? [
        { num: 1, label: 'اختيار العقار' },
        { num: 2, label: 'تفاصيل الموعد' },
        { num: 3, label: 'تأكيد الحجز' },
      ]
    : [
        { num: 1, label: 'Select Property' },
        { num: 2, label: 'Schedule Details' },
        { num: 3, label: 'Confirmation' },
      ];

  const filterOptions = isAr
    ? [
        { key: 'all', label: 'الكل' },
        { key: 'logistics', label: 'مستودعات لوجستية' },
        { key: 'commercial', label: 'محلات ومجمعات تجارية' },
        { key: 'office', label: 'مكاتب ومباني إدارية' },
      ]
    : [
        { key: 'all', label: 'All' },
        { key: 'logistics', label: 'Logistics Warehouses' },
        { key: 'commercial', label: 'Commercial & Retail' },
        { key: 'office', label: 'Office Buildings' },
      ];

  return (
    <div className="pt-32 pb-24 max-w-6xl mx-auto px-6">
      {/* Title Header */}
      <div className="text-center mb-12">
        <span className="inline-flex items-center gap-2 text-xs font-semibold brand-badge px-4 py-2 rounded-full mb-4">
          <Sparkles className="w-3.5 h-3.5 text-accent-light" />
          {isAr ? 'خدمة حجز المعاينة' : 'Viewing Booking Service'}
        </span>
        <h1
          className="text-3xl md:text-5xl font-black mb-3 stagger-anim"
          style={{ animationDelay: '80ms' }}
        >
          {isAr ? 'حجز موعد ' : 'Book a '}
          <span className="brand-gradient-text">
            {isAr ? 'معاينة العقار' : 'Property Viewing'}
          </span>
        </h1>
        <p className="text-neutral-text/60 text-sm max-w-md mx-auto stagger-anim leading-relaxed" style={{ animationDelay: '160ms' }}>
          {isAr
            ? 'حدد العقار المناسب لك واختر موعد المعاينة الحضورية أو الجولة الافتراضية'
            : 'Select your preferred property and schedule an in-person viewing or a 3D virtual tour'}
        </p>
      </div>

      {/* Steps Progress Indicator */}
      <div
        className="flex items-center justify-center gap-4 mb-16 max-w-md mx-auto stagger-anim"
        style={{ animationDelay: '240ms' }}
      >
        {steps.map((item) => (
          <React.Fragment key={item.num}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all duration-500 ${
                  step >= item.num
                    ? 'brand-fill shadow-lg shadow-accent/25'
                    : 'bg-surface text-neutral-text/40 border border-muted-border/30'
                } ${item.num === step ? 'step-ring scale-105' : ''}`}
              >
                {item.num}
              </div>
              <span
                className={`text-[11px] font-bold ${
                  step >= item.num ? 'text-accent' : 'text-neutral-text/40'
                }`}
              >
                {item.label}
              </span>
            </div>
            {item.num < 3 && (
              <div
                className={`flex-1 h-1 rounded-full transition-colors duration-500 mb-5 ${
                  step > item.num ? 'bg-gradient-to-r from-accent to-gold' : 'bg-muted-border/30'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div key={step} className="panel-in">
        {/* Step 1: Select Property */}
        {step === 1 && (
          <div>
            <div className="flex justify-center gap-2 mb-8 flex-wrap">
              {filterOptions.map(({ key: type, label }) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-5 py-2 text-xs rounded-full border transition cursor-pointer font-bold ${
                    filter === type
                      ? 'brand-fill border-accent/60 shadow-md'
                      : 'border-muted-border/40 text-neutral-text/70 hover:border-accent hover:text-heading'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((prop, idx) => (
                <div
                  key={prop.id}
                  className="stagger-anim"
                  style={{ animationDelay: `${150 + (idx % 3) * 80}ms` }}
                >
                  <PropertyCard
                    property={prop}
                    onSelect={(p) => {
                      onSelectProperty(p);
                      setStep(2);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Appointment & User Form */}
        {step === 2 && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Selected Property Preview Header */}
            {selectedProperty && (
              <div className="glass-card border border-accent/40 p-4 sm:p-5 rounded-3xl flex items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedProperty.image}
                    alt={selectedDisplay?.title || selectedProperty.title}
                    className="w-24 h-20 object-cover rounded-2xl border border-muted-border/30"
                  />
                  <div>
                    <div className="flex items-center gap-2 text-xs text-neutral-text/60 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-accent" />
                      {selectedDisplay?.city} · {selectedDisplay?.type}
                    </div>
                    <h3 className="font-extrabold text-base text-heading">
                      {selectedDisplay?.title}
                    </h3>
                    <div className="text-sm font-black brand-gradient-text mt-1">
                      {selectedDisplay?.status || selectedDisplay?.badge || (isAr ? 'متاح للاستثمار والتأجير' : 'Available for Investment & Leasing')}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl shrink-0 cursor-pointer"
                >
                  {isAr ? 'تغيير العقار' : 'Change Property'}
                </button>
              </div>
            )}

            {/* Booking Form */}
            <form
              onSubmit={handleSubmit}
              className="glass-card border border-muted-border/30 p-6 sm:p-8 rounded-3xl space-y-6"
            >
              {/* Visit Type Picker */}
              <div>
                <label className="block text-xs font-bold text-neutral-text/70 mb-3">
                  {isAr ? 'طريقة المعاينة المطلوبة' : 'Preferred Viewing Mode'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setVisitMode('in_person')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                      visitMode === 'in_person'
                        ? 'bg-accent/15 border-accent text-heading font-bold shadow-md'
                        : 'bg-surface/50 border-muted-border/30 text-neutral-text/60 hover:border-accent/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-heading">
                        {isAr ? 'حضور شخصي للموقع' : 'In-Person Site Visit'}
                      </div>
                      <div className="text-[10px] text-neutral-text/50">
                        {isAr ? 'لقاء مستشار عقاري في موقع العقار' : 'Meet an advisor at the site'}
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setVisitMode('virtual')}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-3 ${
                      visitMode === 'virtual'
                        ? 'bg-accent/15 border-accent text-heading font-bold shadow-md'
                        : 'bg-surface/50 border-muted-border/30 text-neutral-text/60 hover:border-accent/40'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center text-gold">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black text-heading">
                        {isAr ? 'جولة افتراضية 3D' : '3D Virtual Tour'}
                      </div>
                      <div className="text-[10px] text-neutral-text/50">
                        {isAr ? 'بث مباشر وافتراضي مع المستشار' : 'Live interactive tour with an advisor'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Slots */}
              <div>
                <label className="block text-xs font-bold text-neutral-text/70 mb-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  {isAr ? 'الفترة الزمنية المفضلة' : 'Preferred Time Slot'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {timeSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        selectedTimeSlot === slot
                          ? 'brand-fill text-canvas shadow-md border-accent'
                          : 'bg-surface/50 border-muted-border/30 text-neutral-text/70 hover:border-accent/50'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-text/70 mb-2">
                    {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={isAr ? 'مثال: عبدالملك السالم' : 'e.g. Abdulmalik Al-Salem'}
                    className="w-full bg-canvas border border-muted-border/40 text-neutral-text rounded-xl px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-text/70 mb-2">
                    {isAr ? 'رقم الجوال *' : 'Phone Number *'}
                  </label>
                  <input
                    required
                    dir="ltr"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+966 50 000 0000"
                    className="w-full bg-canvas border border-muted-border/40 text-neutral-text rounded-xl px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-text/70 mb-2">
                    {isAr ? 'تاريخ المعاينة' : 'Viewing Date'}
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-canvas border border-muted-border/40 text-neutral-text rounded-xl px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-text/70 mb-2">
                    {isAr ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)'}
                  </label>
                  <input
                    dir="ltr"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@domain.com"
                    className="w-full bg-canvas border border-muted-border/40 text-neutral-text rounded-xl px-4 py-3 text-sm outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-text/70 mb-2">
                  {isAr ? 'ملاحظات أو طلبات خاصة (اختياري)' : 'Notes or Special Requests (Optional)'}
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={isAr ? 'أي معلومات إضافية ترغب في مشاركتها...' : 'Any additional details or questions...'}
                  className="w-full bg-canvas border border-muted-border/40 text-neutral-text rounded-xl p-4 text-sm outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-muted-border/20">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="brand-btn-secondary font-bold text-xs px-6 py-3 rounded-full cursor-pointer"
                >
                  {isAr ? 'الرجوع' : 'Back'}
                </button>

                <button
                  type="submit"
                  className="brand-btn-primary font-black text-sm px-8 py-3.5 rounded-full hover:scale-105 transition cursor-pointer shadow-lg shadow-accent/30 inline-flex items-center gap-2"
                >
                  {isAr ? 'تأكيد موعد المعاينة' : 'Confirm Viewing Appointment'}
                  {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 3: Confirmation Receipt */}
        {step === 3 && (
          <div className="max-w-xl mx-auto glass-card rounded-3xl p-8 sm:p-10 text-center border border-accent/40 shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-success/20 border border-success/50 flex items-center justify-center mx-auto mb-6 pop-in">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>

            <h2 className="text-2xl font-black text-heading mb-2">
              {isAr ? 'تم تأكيد طلب المعاينة بنجاح!' : 'Viewing Request Submitted Successfully!'}
            </h2>
            <p className="text-xs text-neutral-text/60 max-w-sm mx-auto mb-8 leading-relaxed">
              {isAr
                ? 'سيتواصل معك المستشار العقاري المخصص لتأكيد الموعد وإرسال تفاصيل اللقاء أو التغطية.'
                : 'Our dedicated real estate consultant will contact you promptly to confirm the appointment details.'}
            </p>

            <div className="bg-surface/60 rounded-2xl p-5 border border-muted-border/30 text-start space-y-3 mb-8 text-xs">
              <div className="flex justify-between border-b border-muted-border/20 pb-2">
                <span className="text-neutral-text/50">{isAr ? 'العقار:' : 'Property:'}</span>
                <span className="font-bold text-heading">{selectedDisplay?.title || (isAr ? 'عقار مختار' : 'Selected Property')}</span>
              </div>
              <div className="flex justify-between border-b border-muted-border/20 pb-2">
                <span className="text-neutral-text/50">{isAr ? 'الاسم:' : 'Name:'}</span>
                <span className="font-bold text-heading">{formData.name}</span>
              </div>
              <div className="flex justify-between border-b border-muted-border/20 pb-2">
                <span className="text-neutral-text/50">{isAr ? 'رقم الجوال:' : 'Phone:'}</span>
                <span className="font-bold text-heading" dir="ltr">{formData.phone}</span>
              </div>
              <div className="flex justify-between border-b border-muted-border/20 pb-2">
                <span className="text-neutral-text/50">{isAr ? 'نوع المعاينة:' : 'Viewing Mode:'}</span>
                <span className="font-bold text-accent">
                  {visitMode === 'in_person'
                    ? isAr
                      ? 'حضور شخصي'
                      : 'In-Person'
                    : isAr
                    ? 'جولة افتراضية 3D'
                    : '3D Virtual Tour'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-text/50">{isAr ? 'التاريخ والوقت:' : 'Date & Time:'}</span>
                <span className="font-bold text-gold">{formData.date} - {selectedTimeSlot}</span>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              className="brand-btn-primary font-extrabold text-xs px-8 py-3.5 rounded-full cursor-pointer"
            >
              {isAr ? 'حجز معاينة جديدة' : 'Book Another Viewing'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
