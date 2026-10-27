// Registers every admin string area first: module-scope translateAdmin calls below need them.
import '../../../i18n/admin';
import React, { useState } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import type { CustomerInquiry } from '../../../types/property';
import type { InquiryStatus } from '../../../services/inquiryService';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { toWhatsAppNumber } from '../adminFormat';

import { translateAdmin } from '../../../i18n/admin/core';
const STATUS_AR: Record<InquiryStatus, string> = {
  new: translateAdmin('ar', 'inquiries.status.new'),
  contacted: translateAdmin('ar', 'inquiries.status.contacted'),
  closed: translateAdmin('ar', 'inquiries.status.closed'),
};

const STATUS_CLASS: Record<InquiryStatus, string> = {
  new: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
  contacted: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
  closed: 'bg-neutral-500/10 border-neutral-500/30 text-neutral-400',
};

/** Status dropdown with an optimistic update, rolled back if the server rejects it. */
export const InquiryStatusSelect: React.FC<{ inquiry: CustomerInquiry }> = ({ inquiry }) => {
  const { inquiries, showToast, confirm } = useAdmin();
  const { t } = useAdminT();

  const change = async (status: InquiryStatus) => {
    const ok = await confirm({
      title: t('inquiries.status.changeConfirmTitle', { name: inquiry.name, status: t(`inquiries.status.${status}` as 'inquiries.status.new' | 'inquiries.status.contacted' | 'inquiries.status.closed') }),
      confirmLabel: t('inquiries.status.changeConfirmLabel'),
      rememberKey: 'inquiry.status',
    });
    if (!ok) return;
    const previousStatus = inquiry.status as InquiryStatus;
    const applyStatus = (next: InquiryStatus) =>
      inquiries.setData((current) =>
        current.map((item) => (item.id === inquiry.id ? { ...item, status: next, statusAr: STATUS_AR[next] } : item))
      );
    applyStatus(status);
    try {
      await AdminStorage.updateInquiryStatus(inquiry.id, status);
      showToast(t('inquiries.status.changed'));
    } catch (error) {
      // Revert only this row: realtime updates may have changed others meanwhile.
      applyStatus(previousStatus);
      showToast(getErrorMessage(error, t('inquiries.status.changeError')));
    }
  };

  const status = inquiry.status as InquiryStatus;
  return (
    <select
      value={status}
      onChange={(e) => void change(e.target.value as InquiryStatus)}
      aria-label={t('inquiries.status.aria')}
      className={`text-[11px] font-bold px-2.5 py-1 rounded-xl border outline-none cursor-pointer ${STATUS_CLASS[status] ?? ''}`}
    >
      <option value="new">{t('inquiries.status.new')}</option>
      <option value="contacted">{t('inquiries.status.contacted')}</option>
      <option value="closed">{t('inquiries.status.closed')}</option>
    </select>
  );
};

/** Inline notes editor; saves on demand, not on every keystroke. */
export const NotesEditor: React.FC<{ inquiry: CustomerInquiry; onDone: () => void }> = ({ inquiry, onDone }) => {
  const { inquiries, showToast } = useAdmin();
  const { t } = useAdminT();
  const [value, setValue] = useState(inquiry.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const notes = value.trim() || null;
      await AdminStorage.updateInquiry(inquiry.id, { notes });
      inquiries.setData((current) => current.map((item) => (item.id === inquiry.id ? { ...item, notes } : item)));
      showToast(t('inquiries.notes.saved'));
      onDone();
    } catch (error) {
      showToast(getErrorMessage(error, t('inquiries.notes.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        rows={3}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t('inquiries.notes.placeholder')}
        className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-y"
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onDone} className="brand-btn-secondary px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
          {t('inquiries.notes.cancel')}
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="brand-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
        >
          {saving ? t('inquiries.notes.saving') : t('inquiries.notes.save')}
        </button>
      </div>
    </div>
  );
};

export const WhatsAppLink: React.FC<{ phone?: string | null }> = ({ phone }) => {
  const { t } = useAdminT();
  if (!phone) return null;
  return (
    <a
      href={`https://wa.me/${toWhatsAppNumber(phone)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition inline-flex items-center justify-center"
      title={t('inquiries.whatsapp.title')}
      aria-label={t('inquiries.whatsapp.aria')}
    >
      <MessageCircle className="w-3.5 h-3.5" />
    </a>
  );
};

export const PhoneCallLink: React.FC<{ phone?: string | null }> = ({ phone }) => {
  const { t } = useAdminT();
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  return (
    <a
      href={`tel:${cleanPhone}`}
      className="p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition inline-flex items-center justify-center"
      title={t('inquiries.action.call')}
      aria-label={t('inquiries.action.call')}
    >
      <Phone className="w-3.5 h-3.5" />
    </a>
  );
};
