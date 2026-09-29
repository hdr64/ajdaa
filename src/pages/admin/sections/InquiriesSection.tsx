import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, Download, Inbox, Lock, Phone, RefreshCw, Search, SearchX, StickyNote, Trash2, X } from 'lucide-react';
import type { CustomerInquiry } from '../../../types/property';
import type { InquiryStatus } from '../../../services/inquiryService';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { DataTable } from '../../../components/admin/common/DataTable';
import { ViewSwitcher } from '../../../components/admin/common/ViewSwitcher';
import type { BulkAction, Column } from '../../../components/admin/common/dataTableTypes';
import { isViewMode, type ViewMode } from '../../../components/admin/common/viewModes';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { InquiryStatusSelect, WhatsAppLink } from './inquiryUi';
import { formatAdminDateTime } from '../adminFormat';

const STATUS_FILTERS: { key: 'all' | InquiryStatus; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: 'جديد' },
  { key: 'contacted', label: 'تم التواصل' },
  { key: 'closed', label: 'مغلق' },
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

const GENERAL_PROJECT = 'استفسار عام';

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

/** Inline notes editor; saves on demand, not on every keystroke. */
const NotesEditor: React.FC<{ inquiry: CustomerInquiry; onDone: () => void }> = ({ inquiry, onDone }) => {
  const { inquiries, showToast } = useAdmin();
  const [value, setValue] = useState(inquiry.notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const notes = value.trim() || null;
      await AdminStorage.updateInquiry(inquiry.id, { notes });
      inquiries.setData((current) => current.map((item) => (item.id === inquiry.id ? { ...item, notes } : item)));
      showToast('تم حفظ الملاحظات');
      onDone();
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حفظ الملاحظات'));
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
        placeholder="ملاحظات داخلية للفريق (لا تظهر للعميل)..."
        className="w-full px-3 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent resize-y"
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onDone} className="brand-btn-secondary px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
          إلغاء
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="brand-btn-primary px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
        >
          {saving ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
        </button>
      </div>
    </div>
  );
};

export const InquiriesSection: React.FC = () => {
  const { inquiries, can, isSuperAdmin, showToast, confirm } = useAdmin();
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
          ? `تم تحديث حالة ${rows.length} من الطلبات`
          : `تم تحديث ${updated} من ${rows.length} طلبات، وتعذر تحديث الباقي`
      );
    },
    [inquiries, showToast]
  );

  const bulkDelete = useCallback(
    async (rows: CustomerInquiry[]) => {
      const ok = await confirm({
        title: `حذف ${rows.length} من الطلبات؟`,
        message: 'سيتم حذف بيانات العملاء نهائياً ولا يمكن التراجع عن ذلك.',
        confirmLabel: 'حذف الطلبات',
        danger: true,
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
          ? `تم حذف ${deleted.size} من الطلبات`
          : `تم حذف ${deleted.size} من ${rows.length} طلبات، وتعذر حذف الباقي`
      );
    },
    [confirm, inquiries, showToast]
  );

  const bulkActions = useMemo<BulkAction<CustomerInquiry>[]>(
    () => [
      {
        id: 'contacted',
        label: 'تحديد كـ تم التواصل',
        icon: CheckCheck,
        onRun: (rows) => bulkSetStatus(rows, 'contacted'),
      },
      { id: 'closed', label: 'تحديد كـ مغلق', icon: Lock, onRun: (rows) => bulkSetStatus(rows, 'closed') },
      ...(isSuperAdmin
        ? [{ id: 'delete', label: 'حذف', icon: Trash2, danger: true, onRun: bulkDelete }]
        : []),
      { id: 'export', label: 'تصدير المحدد', icon: Download, onRun: downloadSelectedInquiries },
    ],
    [bulkDelete, bulkSetStatus, isSuperAdmin]
  );

  const columns = useMemo<Column<CustomerInquiry>[]>(
    () => [
      {
        id: 'customer',
        header: 'العميل',
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
        header: 'المشروع / الوحدة',
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
        header: 'نوع الاهتمام',
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
        header: 'الرسالة',
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
                <span className="font-black text-gold">ملاحظة: </span>
                {inq.notes}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'createdAt',
        header: 'تاريخ التسجيل',
        width: '150px',
        sortValue: (inq) => new Date(inq.createdAt),
        cell: (inq) => (
          <span className="text-[10px] text-neutral-text/60 whitespace-nowrap">{formatAdminDateTime(inq.createdAt)}</span>
        ),
      },
      {
        id: 'status',
        header: 'الحالة',
        width: '120px',
        sortValue: (inq) => inq.status,
        filter: { type: 'select', options: STATUS_OPTIONS, value: (inq) => inq.status },
        cell: (inq) => <InquiryStatusSelect inquiry={inq} />,
      },
    ],
    [editingNotesId, interestOptions, projectOptions]
  );

  if (!can('viewInquiries')) return <NoAccess />;

  const editingInquiry = inquiries.data.find((inq) => inq.id === editingNotesId) ?? null;

  const handleExport = async () => {
    setExporting(true);
    try {
      await AdminStorage.exportInquiriesCsv(statusFilter === 'all' ? {} : { status: statusFilter });
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر تصدير الملف'));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (inquiry: CustomerInquiry) => {
    const ok = await confirm({
      title: `حذف طلب "${inquiry.name}"؟`,
      message: 'سيتم حذف بيانات العميل نهائياً ولا يمكن التراجع عن ذلك.',
      confirmLabel: 'حذف الطلب',
      danger: true,
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteInquiry(inquiry.id);
      inquiries.setData((current) => current.filter((item) => item.id !== inquiry.id));
      showToast('تم حذف الطلب');
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حذف الطلب'));
    }
  };

  const rowActions = (inq: CustomerInquiry) => (
    <div className="flex items-center gap-1.5">
      <WhatsAppLink phone={inq.phone} />
      {inq.phone && (
        <a
          href={`tel:${inq.phone}`}
          className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition inline-flex items-center justify-center"
          title="اتصال هاتفي"
          aria-label="اتصال هاتفي"
        >
          <Phone className="w-3.5 h-3.5" />
        </a>
      )}
      <button
        onClick={() => setEditingNotesId(editingNotesId === inq.id ? null : inq.id)}
        className={`p-2 rounded-xl transition inline-flex items-center justify-center cursor-pointer ${
          inq.notes ? 'bg-gold/15 text-gold hover:bg-gold/25' : 'bg-canvas border border-muted-border/40 text-neutral-text/60 hover:text-heading'
        }`}
        title={inq.notes ? 'تعديل الملاحظات' : 'إضافة ملاحظة'}
        aria-label="ملاحظات"
      >
        <StickyNote className="w-3.5 h-3.5" />
      </button>
      {isSuperAdmin && (
        <button
          onClick={() => void handleDelete(inq)}
          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition inline-flex items-center justify-center cursor-pointer"
          title="حذف الطلب"
          aria-label="حذف الطلب"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
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
      title="لا توجد طلبات مطابقة"
      action={
        <button onClick={clearFilters} className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
          مسح عوامل التصفية
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
          title={statusFilter === 'all' ? 'تصدير كل الطلبات' : 'تصدير الطلبات بالحالة المحددة'}
        >
          {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">تصدير CSV</span>
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
        <SectionLoading label="جاري تحميل الطلبات..." />
      </>
    );
  }
  if (inquiries.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Inbox}
          title="لا توجد طلبات اهتمام بعد"
          description='ستظهر هنا الطلبات المسجلة من صفحات المشاريع ونموذج "سجل اهتمامك".'
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
              placeholder="ابحث بالاسم، الجوال، البريد، المشروع أو الملاحظات..."
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
                  <p className="text-xs font-black text-heading truncate">ملاحظات الطلب: {editingInquiry.name}</p>
                  <p className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">
                    {editingInquiry.phone || editingInquiry.email || '—'}
                  </p>
                </div>
                <button
                  onClick={() => setEditingNotesId(null)}
                  aria-label="إغلاق محرر الملاحظات"
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
            emptyState={noMatches}
          />
        </>
      ) : filtered.length === 0 ? (
        noMatches
      ) : (
        <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden divide-y divide-muted-border/20">
          {filtered.map((inq) => (
            <div key={inq.id} className="p-4 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-heading">{inq.name}</div>
                  <div className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">
                    {inq.phone || inq.email || '—'}
                  </div>
                </div>
                <InquiryStatusSelect inquiry={inq} />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-heading">{projectLabel(inq)}</span>
                {inq.unitNumber && <span className="text-accent font-bold">{inq.unitNumber}</span>}
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px]">{inq.interestTypeAr}</span>
                <span className="text-neutral-text/50 text-[10px]">{formatAdminDateTime(inq.createdAt)}</span>
              </div>
              {inq.message && <p className="text-[11px] text-neutral-text/75 leading-relaxed">{inq.message}</p>}
              {inq.notes && editingNotesId !== inq.id && (
                <div className="p-2 rounded-lg bg-gold/10 text-[10px] text-heading">
                  <span className="font-black text-gold">ملاحظة: </span>
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
