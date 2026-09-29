import React from 'react';
import { MessageCircle } from 'lucide-react';
import type { CustomerInquiry } from '../../../types/property';
import type { InquiryStatus } from '../../../services/inquiryService';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { toWhatsAppNumber } from '../adminFormat';

const STATUS_AR: Record<InquiryStatus, string> = { new: 'جديد', contacted: 'تم التواصل', closed: 'مغلق' };

const STATUS_CLASS: Record<InquiryStatus, string> = {
  new: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  contacted: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
  closed: 'bg-neutral-500/10 border-neutral-500/30 text-neutral-400',
};

/** Status dropdown with an optimistic update, rolled back if the server rejects it. */
export const InquiryStatusSelect: React.FC<{ inquiry: CustomerInquiry }> = ({ inquiry }) => {
  const { inquiries, showToast, confirm } = useAdmin();

  const change = async (status: InquiryStatus) => {
    const ok = await confirm({
      title: `تغيير حالة طلب "${inquiry.name}" إلى «${STATUS_AR[status]}»؟`,
      confirmLabel: 'تغيير الحالة',
      rememberKey: 'inquiry.status',
    });
    if (!ok) return;
    const previous = inquiries.data;
    inquiries.setData((current) =>
      current.map((item) => (item.id === inquiry.id ? { ...item, status, statusAr: STATUS_AR[status] } : item))
    );
    try {
      await AdminStorage.updateInquiryStatus(inquiry.id, status);
      showToast('تم تحديث حالة الطلب');
    } catch (error) {
      inquiries.setData(previous);
      showToast(getErrorMessage(error, 'تعذر تحديث الحالة'));
    }
  };

  const status = inquiry.status as InquiryStatus;
  return (
    <select
      value={status}
      onChange={(e) => void change(e.target.value as InquiryStatus)}
      aria-label="حالة الطلب"
      className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border outline-none cursor-pointer ${STATUS_CLASS[status] ?? ''}`}
    >
      <option value="new">جديد</option>
      <option value="contacted">تم التواصل</option>
      <option value="closed">مغلق</option>
    </select>
  );
};

export const WhatsAppLink: React.FC<{ phone?: string | null }> = ({ phone }) => {
  if (!phone) return null;
  return (
    <a
      href={`https://wa.me/${toWhatsAppNumber(phone)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition inline-flex items-center justify-center"
      title="مراسلة عبر واتساب"
      aria-label="مراسلة عبر واتساب"
    >
      <MessageCircle className="w-3.5 h-3.5" />
    </a>
  );
};
