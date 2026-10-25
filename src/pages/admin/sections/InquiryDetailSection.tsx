// Registers every admin string area first: module-scope translateAdmin calls below need them.
import '../../../i18n/admin';
import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, SearchX, Trash2 } from 'lucide-react';
import type { CustomerInquiry } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { formatAdminDateTime } from '../adminFormat';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { InquiryStatusSelect, NotesEditor, WhatsAppLink } from './inquiryUi';

export const InquiryDetailSection: React.FC = () => {
  const { location, navigate, showToast, confirmDelete, can, isSuperAdmin, inquiries } = useAdmin();
  const { t } = useAdminT();
  const id = location.inquiryId ?? '';
  const [editingNotes, setEditingNotes] = useState(false);

  const fallback = inquiries.data.find((inq) => inq.id === id) ?? null;

  const resource = useAsyncData<CustomerInquiry | null>(
    useCallback((signal) => AdminStorage.getInquiry(id, signal), [id]),
    [id],
    fallback
  );

  // Keep the detail view in sync with the shared inquiries collection (status/notes edits).
  const { setData } = resource;
  useEffect(() => {
    const match = inquiries.data.find((inq) => inq.id === id);
    if (match) setData(match);
  }, [inquiries.data, id, setData]);

  if (!can('viewInquiries')) return <NoAccess />;
  if (!id) return <NoAccess />;

  const inquiry = resource.data ?? fallback;

  if (resource.loading && !inquiry) {
    return <SectionLoading variant="detail" label={t('inquiries.loading')} />;
  }

  if (!inquiry) {
    if (resource.error && !resource.error.toLowerCase().includes('not found')) {
      return <SectionError message={resource.error} onRetry={() => void resource.reload()} />;
    }
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => navigate({ section: 'inquiries' })}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-text/70 hover:text-heading cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          {t('inquiries.detail.back')}
        </button>
        <EmptyState
          icon={SearchX}
          title={t('inquiries.detail.notFound.title')}
          description={t('inquiries.detail.notFound.description')}
        />
      </div>
    );
  }

  const handleDelete = async () => {
    const ok = await confirmDelete({
      title: t('inquiries.delete.confirmTitle', { name: inquiry.name }),
      message: t('inquiries.delete.confirmMessage'),
      confirmLabel: t('inquiries.delete.confirmLabel'),
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteInquiry(inquiry.id);
      inquiries.setData((current) => current.filter((item) => item.id !== inquiry.id));
      showToast(t('inquiries.delete.success'));
      navigate({ section: 'inquiries' });
    } catch (error) {
      showToast(getErrorMessage(error, t('inquiries.delete.error')));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate({ section: 'inquiries' })}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-text/70 hover:text-heading cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
          {t('inquiries.detail.back')}
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('inquiries.action.delete')}
          </button>
        )}
      </div>

      <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs p-5 space-y-4">
        <h2 className="text-sm font-black text-heading">{inquiry.name}</h2>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.phone')}</dt>
            <dd className="mt-1">
              {inquiry.phone ? (
                <div className="flex items-center gap-2">
                  <a
                    href={`tel:${inquiry.phone}`}
                    className="text-accent font-mono font-bold"
                    dir="ltr"
                  >
                    {inquiry.phone}
                  </a>
                  <WhatsAppLink phone={inquiry.phone} />
                </div>
              ) : (
                <span className="text-neutral-text/50">—</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.email')}</dt>
            <dd className="mt-1">
              {inquiry.email ? (
                <a
                  href={`mailto:${inquiry.email}`}
                  className="text-accent font-mono font-bold break-all"
                  dir="ltr"
                >
                  {inquiry.email}
                </a>
              ) : (
                <span className="text-neutral-text/50">—</span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.project')}</dt>
            <dd className="mt-1 font-bold text-heading">
              {inquiry.projectTitle?.trim() || t('inquiries.generalProject')}
              {inquiry.unitNumber ? (
                <span className="ms-2 text-accent font-bold">{inquiry.unitNumber}</span>
              ) : null}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.interestType')}</dt>
            <dd className="mt-1">
              <span className="inline-block px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px] border border-accent/20">
                {inquiry.interestTypeAr}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.status')}</dt>
            <dd className="mt-1">
              <InquiryStatusSelect inquiry={inquiry} />
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.createdAt')}</dt>
            <dd className="mt-1 text-neutral-text/70">{formatAdminDateTime(inquiry.createdAt)}</dd>
          </div>
        </dl>

        <div>
          <dt className="text-[11px] font-bold text-neutral-text/60">{t('inquiries.detail.message')}</dt>
          <dd className="mt-1 text-[11px] text-neutral-text/75 leading-relaxed whitespace-pre-wrap">
            {inquiry.message || '—'}
          </dd>
        </div>
      </div>

      <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black text-heading">{t('inquiries.detail.notes')}</h3>
          {!editingNotes && (
            <button
              type="button"
              onClick={() => setEditingNotes(true)}
              className="text-[11px] font-bold text-accent hover:underline cursor-pointer"
            >
              {inquiry.notes ? t('inquiries.action.editNotes') : t('inquiries.action.addNotes')}
            </button>
          )}
        </div>
        {editingNotes ? (
          <NotesEditor inquiry={inquiry} onDone={() => setEditingNotes(false)} />
        ) : (
          <p className="text-xs text-neutral-text/75 whitespace-pre-wrap">{inquiry.notes || '—'}</p>
        )}
      </div>
    </div>
  );
};