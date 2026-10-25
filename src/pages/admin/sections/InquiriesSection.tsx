// Registers every admin string area first: module-scope translateAdmin calls below need them.
import '../../../i18n/admin';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CheckCheck,
  Download,
  ExternalLink,
  Inbox,
  Lock,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  SearchX,
  StickyNote,
  Trash2,
  User,
  X,
} from 'lucide-react';
import type { CustomerInquiry } from '../../../types/property';
import type { InquiryStatus } from '../../../services/inquiryService';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { DataTable } from '../../../components/admin/common/DataTable';
import { ViewSwitcher } from '../../../components/admin/common/ViewSwitcher';
import type { BulkAction, Column } from '../../../components/admin/common/dataTableTypes';
import { isViewMode, type ViewMode } from '../../../components/admin/common/viewModes';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { InquiryStatusSelect, NotesEditor, WhatsAppLink } from './inquiryUi';
import { formatAdminDateTime } from '../adminFormat';

const STATUS_FILTERS: { key: 'all' | InquiryStatus; label: string }[] = [
  { key: 'all', label: translateAdmin('ar', 'inquiries.status.all') },
  { key: 'new', label: translateAdmin('ar', 'inquiries.status.new') },
  { key: 'contacted', label: translateAdmin('ar', 'inquiries.status.contacted') },
  { key: 'closed', label: translateAdmin('ar', 'inquiries.status.closed') },
];

const STATUS_OPTIONS = STATUS_FILTERS.filter((filter) => filter.key !== 'all').map((filter) => ({
  value: filter.key,
  label: filter.label,
}));

const VIEW_MODES: readonly ViewMode[] = ['table', 'list'];

const VIEW_STORAGE_KEY = 'ajda.admin.inquiries.view';
const TABLE_STORAGE_KEY = 'ajda.admin.inquiries';

/** Below `md` the table has to scroll sideways, so phones always get the cards. */
const PHONE_QUERY = '(max-width: 767px)';

import { translateAdmin } from '../../../i18n/admin/core';
const GENERAL_PROJECT = translateAdmin('ar', 'inquiries.generalProject');

/** Mirrors the server export: same columns, same order, same line endings. */
const CSV_HEADERS = [
  'createdAt',
  'name',
  'phone',
  'email',
  'projectTitle',
  'unitNumber',
  'interestTypeAr',
  'status',
  'message',
  'notes',
] as const;

const statusLabel = (status: InquiryStatus): string =>
  STATUS_FILTERS.find((filter) => filter.key === status)?.label ?? status;

const projectLabel = (inquiry: CustomerInquiry): string => inquiry.projectTitle?.trim() || GENERAL_PROJECT;

const getInquiryId = (inquiry: CustomerInquiry): string => inquiry.id;

/** One haystack for the table's search box; `null` fields never leak the word "null". */
const inquirySearchText = (inquiry: CustomerInquiry): string =>
  [
    inquiry.name,
    inquiry.phone,
    inquiry.email,
    inquiry.projectTitle,
    inquiry.unitNumber,
    inquiry.message,
    inquiry.notes,
  ]
    .filter(Boolean)
    .join(' ');

/** CSV/formula-injection defense + RFC 4180 quoting, same rules as server/src/services/csv.ts. */
const escapeCsvCell = (value: string | null | undefined): string => {
  if (value == null) return '';
  let cell = String(value);
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) cell = `"${cell.replace(/"/g, '""')}"`;
  return cell;
};

/** Client-side export of an explicit selection; the header button still uses the server file. */
function downloadSelectedInquiries(rows: CustomerInquiry[]): void {
  const dataLines = rows.map((inquiry) =>
    [
      inquiry.createdAt,
      inquiry.name,
      inquiry.phone ?? null,
      inquiry.email ?? null,
      inquiry.projectTitle ?? null,
      inquiry.unitNumber ?? null,
      inquiry.interestTypeAr,
      inquiry.statusAr || statusLabel(inquiry.status),
      inquiry.message ?? null,
      inquiry.notes ?? null,
    ]
      .map(escapeCsvCell)
      .join(',')
  );
  const csv = '\uFEFF' + [CSV_HEADERS.join(','), ...dataLines].join('\r\n') + '\r\n';

  const objectUrl = window.URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `inquiries-selected-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking in the same tick can cancel the download in some browsers.
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsPhone(event.matches);
    setIsPhone(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isPhone;
}

export const InquiriesSection: React.FC = () => {
  const { inquiries, can, isSuperAdmin, showToast, confirmDelete, navigate } = useAdmin();
  const { t } = useAdminT();
  const [view, setView] = usePersistentState<ViewMode>(VIEW_STORAGE_KEY, 'table', isViewMode);
  const isPhone = useIsPhone();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const counts = useMemo(() => {
    const result: Record<string, number> = { all: inquiries.data.length };
    for (const inq of inquiries.data) result[inq.status] = (result[inq.status] ?? 0) + 1;
    return result;
  }, [inquiries.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return inquiries.data.filter((inq) => {
      if (statusFilter !== 'all' && inq.status !== statusFilter) return false;
      if (!query) return true;
      return [inq.name, inq.phone, inq.email, inq.projectTitle, inq.unitNumber, inq.message, inq.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [inquiries.data, search, statusFilter]);

  const showTable = !isPhone && view === 'table';

  // The table brings its own search box, so a query typed in the cards view would keep
  // narrowing the rows with no visible cause.
  useEffect(() => {
    if (showTable) setSearch('');
  }, [showTable]);

  /** Filter options come from the status-filtered set the table actually receives. */
  const projectOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const inq of filtered) titles.add(projectLabel(inq));
    return [...titles]
      .sort((a, b) => a.localeCompare(b, 'ar'))
      .map((value) => ({ value, label: value }));
  }, [filtered]);

  const interestOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const inq of filtered) labels.add(inq.interestTypeAr);
    return [...labels]
      .sort((a, b) => a.localeCompare(b, 'ar'))
      .map((value) => ({ value, label: value }));
  }, [filtered]);

  const bulkSetStatus = useCallback(
    async (rows: CustomerInquiry[], status: InquiryStatus) => {
      const targetIds = new Set(rows.map((inq) => inq.id));
      const snapshot = inquiries.data;
      const statusAr = statusLabel(status);
      inquiries.setData((current) =>
        current.map((item) => (targetIds.has(item.id) ? { ...item, status, statusAr } : item))
      );

      const failed = new Set<string>();
      for (const row of rows) {
        try {
          await AdminStorage.updateInquiryStatus(row.id, status);
        } catch {
          failed.add(row.id);
        }
      }

      if (failed.size > 0) {
        // Only the rows the server rejected go back to the value they had before the batch.
        inquiries.setData((current) =>
          current.map((item) => {
            if (!failed.has(item.id)) return item;
            return snapshot.find((previous) => previous.id === item.id) ?? item;
          })
        );
      }

      const updated = rows.length - failed.size;
      showToast(
        failed.size === 0
          ? t('inquiries.bulk.statusAll', { count: rows.length })
          : t('inquiries.bulk.statusPartial', { updated, total: rows.length })
      );
    },
    [inquiries, showToast, t]
  );

  const bulkDelete = useCallback(
    async (rows: CustomerInquiry[]) => {
      const ok = await confirmDelete({
        title: t('inquiries.bulk.deleteTitle', { count: rows.length }),
        message: t('inquiries.bulk.deleteMessage'),
        confirmLabel: t('inquiries.bulk.deleteLabel'),
      });
      if (!ok) return;

      const deleted = new Set<string>();
      for (const row of rows) {
        try {
          await AdminStorage.deleteInquiry(row.id);
          deleted.add(row.id);
        } catch {
          // Left in the list so the admin can retry just the rows that failed.
        }
      }
      if (deleted.size > 0) {
        inquiries.setData((current) => current.filter((item) => !deleted.has(item.id)));
      }

      showToast(
        deleted.size === rows.length
          ? t('inquiries.bulk.deletedAll', { count: deleted.size })
          : t('inquiries.bulk.deletedPartial', { deleted: deleted.size, total: rows.length })
      );
    },
    [confirmDelete, inquiries, showToast, t]
  );

  const bulkActions = useMemo<BulkAction<CustomerInquiry>[]>(
    () => [
      {
        id: 'contacted',
        label: t('inquiries.bulk.markContacted'),
        icon: CheckCheck,
        onRun: (rows) => bulkSetStatus(rows, 'contacted'),
      },
      { id: 'closed', label: t('inquiries.bulk.markClosed'), icon: Lock, onRun: (rows) => bulkSetStatus(rows, 'closed') },
      ...(isSuperAdmin
        ? [{ id: 'delete', label: t('common.action.delete'), icon: Trash2, danger: true, onRun: bulkDelete }]
        : []),
      { id: 'export', label: t('inquiries.bulk.exportSelected'), icon: Download, onRun: downloadSelectedInquiries },
    ],
    [bulkDelete, bulkSetStatus, isSuperAdmin, t]
  );

  const columns = useMemo<Column<CustomerInquiry>[]>(
    () => [
      {
        id: 'customer',
        header: t('inquiries.table.client'),
        width: '170px',
        sortValue: (inq) => inq.name,
        filter: { type: 'text', value: (inq) => [inq.name, inq.phone, inq.email].filter(Boolean).join(' ') },
        cell: (inq) => (
          <div className="min-w-0">
            <div className="font-bold text-heading truncate">{inq.name}</div>
            {inq.phone && (
              <div className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">
                {inq.phone}
              </div>
            )}
            {inq.email && (
              <div className="text-[10px] text-neutral-text/50 font-mono truncate" dir="ltr">
                {inq.email}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'project',
        header: t('inquiries.table.projectUnit'),
        width: '180px',
        sortValue: (inq) => inq.projectTitle ?? null,
        filter: { type: 'select', options: projectOptions, value: projectLabel },
        cell: (inq) => (
          <div className="min-w-0">
            <span className="font-bold text-heading block truncate">{projectLabel(inq)}</span>
            {inq.unitNumber && (
              <span className="text-[10px] text-accent block font-bold truncate">{inq.unitNumber}</span>
            )}
          </div>
        ),
      },
      {
        id: 'interest',
        header: t('inquiries.table.interestType'),
        width: '130px',
        filter: { type: 'select', options: interestOptions, value: (inq) => inq.interestTypeAr },
        cell: (inq) => (
          <span className="inline-block px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px] border border-accent/20 whitespace-nowrap">
            {inq.interestTypeAr}
          </span>
        ),
      },
      {
        id: 'message',
        header: t('inquiries.table.message'),
        // No `sortValue`: the table only auto-truncates cells that declare one.
        cell: (inq) => (
          <div className="min-w-0 space-y-1.5">
            <p className="text-[11px] text-neutral-text/75 leading-relaxed max-w-[20rem] truncate" title={inq.message}>
              {inq.message || '—'}
            </p>
            {inq.notes && editingNotesId !== inq.id && (
              <p
                className="p-2 rounded-lg bg-gold/10 text-[10px] text-heading max-w-[20rem] truncate"
                title={inq.notes}
              >
                <span className="font-black text-gold">{t('inquiries.table.noteLabel')}: </span>
                {inq.notes}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'createdAt',
        header: t('inquiries.table.date'),
        width: '150px',
        sortValue: (inq) => new Date(inq.createdAt),
        cell: (inq) => (
          <span className="text-[10px] text-neutral-text/60 whitespace-nowrap">{formatAdminDateTime(inq.createdAt)}</span>
        ),
      },
      {
        id: 'status',
        header: t('inquiries.table.status'),
        width: '120px',
        sortValue: (inq) => inq.status,
        filter: { type: 'select', options: STATUS_OPTIONS, value: (inq) => inq.status },
        cell: (inq) => (
           <div onClick={(e) => e.stopPropagation()}>
             <InquiryStatusSelect inquiry={inq} />
           </div>
         ),      },
    ],
    [editingNotesId, interestOptions, projectOptions, t]
  );

  if (!can('viewInquiries')) return <NoAccess />;

  const editingInquiry = inquiries.data.find((inq) => inq.id === editingNotesId) ?? null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await AdminStorage.exportInquiriesCsv(statusFilter === 'all' ? {} : { status: statusFilter });
    } catch (error) {
      showToast(getErrorMessage(error, t('inquiries.exportError')));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (inquiry: CustomerInquiry) => {
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
    } catch (error) {
      showToast(getErrorMessage(error, t('inquiries.delete.error')));
    }
  };

  const rowActions = (inq: CustomerInquiry) => (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => navigate({ section: 'inquiry', inquiryId: inq.id })}
        className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition inline-flex items-center justify-center cursor-pointer"
        title={t('inquiries.action.openPage')}
        aria-label={t('inquiries.action.openPage')}
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
      <WhatsAppLink phone={inq.phone} />
      {inq.phone && (
        <a
          href={`tel:${inq.phone}`}
          className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition inline-flex items-center justify-center"
          title={t('inquiries.action.call')}
          aria-label={t('inquiries.action.call')}
        >
          <Phone className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={() => setEditingNotesId(editingNotesId === inq.id ? null : inq.id)}
        className={`p-2 rounded-xl transition inline-flex items-center justify-center cursor-pointer ${
          inq.notes ? 'bg-gold/15 text-gold hover:bg-gold/25' : 'bg-canvas border border-muted-border/40 text-neutral-text/60 hover:text-heading'
        }`}
        title={inq.notes ? t('inquiries.action.editNotes') : t('inquiries.action.addNotes')}
        aria-label={t('inquiries.action.notes')}
      >
        <StickyNote className="w-3.5 h-3.5" />
      </button>
      {isSuperAdmin && (
        <button
          type="button"
          onClick={() => void handleDelete(inq)}
          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition inline-flex items-center justify-center cursor-pointer"
          title={t('inquiries.action.delete')}
          aria-label={t('inquiries.action.delete')}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  const renderExpandedInquiry = (inq: CustomerInquiry) => (
    <div className="space-y-4 p-3 sm:p-4 text-xs bg-canvas/60 rounded-2xl border border-muted-border/30">
      {/* Header bar with actions & direct navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-muted-border/30">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black text-heading text-xs">
            {t('inquiries.expanded.fullDetails')}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surface text-neutral-text/60 border border-muted-border/30" dir="ltr">
            ID: {inq.id}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px] border border-accent/20">
            {inq.interestTypeAr}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate({ section: 'inquiry', inquiryId: inq.id })}
            className="brand-fill text-canvas font-bold text-xs px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-xs hover:opacity-95 transition"
            title={t('inquiries.action.openPage')}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>{t('inquiries.action.openPage')}</span>
          </button>
        </div>
      </div>

      {/* Grid of full inquiry details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Customer Information */}
        <div className="p-3.5 rounded-xl bg-surface border border-muted-border/30 space-y-2">
          <div className="text-[10px] font-bold text-neutral-text/50 uppercase tracking-wider flex items-center gap-1">
            <User className="w-3 h-3 text-accent" />
            <span>{t('inquiries.detail.name')}</span>
          </div>
          <div className="font-bold text-heading text-sm">{inq.name}</div>
          <div className="space-y-1.5 pt-1 text-[11px]">
            {inq.phone && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-text/70 font-mono text-xs" dir="ltr">{inq.phone}</span>
                <div className="flex items-center gap-1">
                  <WhatsAppLink phone={inq.phone} />
                  <a
                    href={`tel:${inq.phone}`}
                    className="p-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition inline-flex items-center"
                    title={t('inquiries.action.call')}
                  >
                    <Phone className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
            {inq.email && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-text/70 font-mono text-xs truncate" dir="ltr">{inq.email}</span>
                <a
                  href={`mailto:${inq.email}`}
                  className="p-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition inline-flex items-center"
                  title="البريد الإلكتروني"
                >
                  <Mail className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Property & Context */}
        <div className="p-3.5 rounded-xl bg-surface border border-muted-border/30 space-y-2">
          <div className="text-[10px] font-bold text-neutral-text/50 uppercase tracking-wider flex items-center gap-1">
            <Building2 className="w-3 h-3 text-accent" />
            <span>{t('inquiries.detail.project')}</span>
          </div>
          <div className="font-bold text-heading text-sm">{projectLabel(inq)}</div>
          {inq.unitNumber && (
            <div className="text-xs text-accent font-bold">
              <span>{t('inquiries.detail.unit')}: </span>
              <span>{inq.unitNumber}</span>
            </div>
          )}
          <div className="pt-1 flex items-center gap-1.5 text-[10px] text-neutral-text/60">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatAdminDateTime(inq.createdAt)}</span>
          </div>
        </div>

        {/* Status & Notes Quick Trigger */}
        <div className="p-3.5 rounded-xl bg-surface border border-muted-border/30 space-y-2">
          <div className="text-[10px] font-bold text-neutral-text/50 uppercase tracking-wider">
            {t('inquiries.detail.status')}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <InquiryStatusSelect inquiry={inq} />
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setEditingNotesId(editingNotesId === inq.id ? null : inq.id)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-bold transition inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                inq.notes
                  ? 'bg-gold/15 text-gold hover:bg-gold/25'
                  : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>{inq.notes ? t('inquiries.action.editNotes') : t('inquiries.action.addNotes')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Message Block - completely un-truncated */}
      <div className="p-3.5 rounded-xl bg-surface border border-muted-border/30 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-heading">
          <span className="inline-flex items-center gap-1.5 text-accent">
            <MessageSquare className="w-4 h-4" />
            <span>{t('inquiries.expanded.fullMessage')}</span>
          </span>
          {inq.message && (
            <span className="text-[10px] text-neutral-text/50 font-normal">
              {inq.message.length} حرف
            </span>
          )}
        </div>
        <div className="p-3.5 rounded-xl bg-canvas/80 border border-muted-border/20 text-xs text-heading leading-relaxed whitespace-pre-wrap select-text">
          {inq.message || (
            <span className="text-neutral-text/40 italic">{t('inquiries.expanded.noMessage')}</span>
          )}
        </div>
      </div>

      {/* Internal Notes */}
      {inq.notes && editingNotesId !== inq.id && (
        <div className="p-3.5 rounded-xl bg-gold/10 border border-gold/25 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-heading">
            <span className="inline-flex items-center gap-1.5 text-gold">
              <StickyNote className="w-3.5 h-3.5" />
              <span>{t('inquiries.table.noteLabel')}</span>
            </span>
            <button
              type="button"
              onClick={() => setEditingNotesId(inq.id)}
              className="text-[10px] font-bold text-gold hover:underline cursor-pointer"
            >
              {t('inquiries.action.editNotes')}
            </button>
          </div>
          <p className="text-xs text-heading leading-relaxed whitespace-pre-wrap select-text">
            {inq.notes}
          </p>
        </div>
      )}

      {/* Inline Notes Editor when active */}
      {editingNotesId === inq.id && (
        <div className="p-3.5 rounded-xl bg-surface border border-accent/40 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs font-black text-heading">
            <span>{t('inquiries.notes.editorTitle', { name: inq.name })}</span>
            <button
              type="button"
              onClick={() => setEditingNotesId(null)}
              className="text-neutral-text/50 hover:text-heading cursor-pointer p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <NotesEditor inquiry={inq} onDone={() => setEditingNotesId(null)} />
        </div>
      )}
    </div>
  );

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const noMatches = (
    <EmptyState
      icon={SearchX}
      title={t('inquiries.empty.noMatch')}
      action={
        <button onClick={clearFilters} className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
          {t('inquiries.empty.clearFilters')}
        </button>
      }
    />
  );

  const header = (
    <AdminHeaderActions>
      {/* Phones always render the cards, so offering the choice there would be a lie. */}
      <div className="hidden md:block">
        <ViewSwitcher value={view} onChange={setView} modes={VIEW_MODES} />
      </div>
      {can('exportData') && (
        <button
          onClick={() => void handleExport()}
          disabled={exporting || inquiries.data.length === 0}
          className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title={statusFilter === 'all' ? t('inquiries.export.all') : t('inquiries.export.filtered')}
        >
          {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{t('inquiries.export.csv')}</span>
        </button>
      )}
    </AdminHeaderActions>
  );

  if (inquiries.error) {
    return (
      <>
        {header}
        <SectionError message={inquiries.error} onRetry={() => void inquiries.reload()} />
      </>
    );
  }
  if (inquiries.loading && inquiries.data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label={t('inquiries.loading')} />
      </>
    );
  }
  if (inquiries.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Inbox}
          title={t('inquiries.empty.title')}
          description={t('inquiries.empty.description')}
        />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* The table brings its own search box, so the standalone one is for the cards only. */}
        {!showTable && (
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
            <input
              type="search"
              placeholder={t('inquiries.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full ps-10 pe-4 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
            />
          </div>
        )}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setStatusFilter(filter.key)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
                statusFilter === filter.key
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
              }`}
            >
              {filter.label} <span className="opacity-70">({counts[filter.key] ?? 0})</span>
            </button>
          ))}
        </div>
      </div>

      {showTable ? (
        <>
          {/* `DataTable` has no row expansion, so the open editor docks above the table. */}
          {editingInquiry && (
            <div className="rounded-2xl bg-surface border border-accent/30 shadow-xs p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-heading truncate">{t('inquiries.notes.editorTitle', { name: editingInquiry.name })}</p>
                  <p className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">
                    {editingInquiry.phone || editingInquiry.email || '—'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingNotesId(null)}
                  aria-label={t('inquiries.notes.closeEditor')}
                  className="p-1.5 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <NotesEditor
                key={editingInquiry.id}
                inquiry={editingInquiry}
                onDone={() => setEditingNotesId(null)}
              />
            </div>
          )}

          <DataTable
            storageKey={TABLE_STORAGE_KEY}
            rows={filtered}
            getRowId={getInquiryId}
            columns={columns}
            searchText={inquirySearchText}
            initialSort={{ columnId: 'createdAt', direction: 'desc' }}
            selectable
            bulkActions={bulkActions}
            rowActions={rowActions}
            renderExpandedRow={renderExpandedInquiry}
            expandOnRowClick
            emptyState={noMatches}
          />
        </>
      ) : filtered.length === 0 ? (
        noMatches
      ) : (
        <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden divide-y divide-muted-border/20">
          {filtered.map((inq) => (
            <div
              key={inq.id}
              className="p-4 space-y-3 text-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate({ section: 'inquiry', inquiryId: inq.id })}
                    className="font-bold text-heading text-start hover:text-accent transition flex items-center gap-1 cursor-pointer"
                  >
                    <span>{inq.name}</span>
                    <ExternalLink className="w-3 h-3 text-accent" />
                  </button>
                  <div className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">
                    {inq.phone || inq.email || '—'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => navigate({ section: 'inquiry', inquiryId: inq.id })}
                    className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition cursor-pointer"
                    title={t('inquiries.action.openPage')}
                    aria-label={t('inquiries.action.openPage')}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <InquiryStatusSelect inquiry={inq} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-heading">{projectLabel(inq)}</span>
                {inq.unitNumber && <span className="text-accent font-bold">{inq.unitNumber}</span>}
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px]">{inq.interestTypeAr}</span>
                <span className="text-neutral-text/50 text-[10px]">{formatAdminDateTime(inq.createdAt)}</span>
              </div>
              {inq.message && (
                <div className="p-3 rounded-xl bg-canvas/70 border border-muted-border/20 text-xs text-heading leading-relaxed whitespace-pre-wrap select-text">
                  <div className="text-[10px] text-accent font-bold mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{t('inquiries.expanded.fullMessage')}</span>
                  </div>
                  {inq.message}
                </div>
              )}
              {inq.notes && editingNotesId !== inq.id && (
                <div className="p-2.5 rounded-lg bg-gold/10 text-[10px] text-heading whitespace-pre-wrap select-text">
                  <span className="font-black text-gold">{t('inquiries.table.noteLabel')}: </span>
                  {inq.notes}
                </div>
              )}
              {editingNotesId === inq.id ? (
                <NotesEditor inquiry={inq} onDone={() => setEditingNotesId(null)} />
              ) : (
                rowActions(inq)
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
