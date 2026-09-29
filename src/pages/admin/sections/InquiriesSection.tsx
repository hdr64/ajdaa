import React, { useMemo, useState } from 'react';
import { Download, Inbox, Phone, Search, SearchX, StickyNote, Trash2, RefreshCw } from 'lucide-react';
import type { CustomerInquiry } from '../../../types/property';
import type { InquiryStatus } from '../../../services/inquiryService';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { NoAccess, SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { InquiryStatusSelect, WhatsAppLink } from './inquiryUi';
import { formatAdminDateTime } from '../adminFormat';

const STATUS_FILTERS: { key: 'all' | InquiryStatus; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: 'جديد' },
  { key: 'contacted', label: 'تم التواصل' },
  { key: 'closed', label: 'مغلق' },
];

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

  if (!can('viewInquiries')) return <NoAccess />;

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

  const header = can('exportData') && (
    <AdminHeaderActions>
      <button
        onClick={() => void handleExport()}
        disabled={exporting || inquiries.data.length === 0}
        className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        title={statusFilter === 'all' ? 'تصدير كل الطلبات' : 'تصدير الطلبات بالحالة المحددة'}
      >
        {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        <span className="hidden sm:inline">تصدير CSV</span>
      </button>
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

  return (
    <div className="space-y-5">
      {header}

      <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="لا توجد طلبات مطابقة"
          action={
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
            >
              مسح عوامل التصفية
            </button>
          }
        />
      ) : (
        <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden">
          {/* Desktop table */}
          <table className="w-full text-start border-collapse hidden lg:table">
            <thead>
              <tr className="border-b border-muted-border/30 text-neutral-text/50 text-[11px]">
                <th className="px-5 py-3 text-start font-bold">العميل</th>
                <th className="px-3 py-3 text-start font-bold">المشروع / الوحدة</th>
                <th className="px-3 py-3 text-start font-bold">نوع الاهتمام</th>
                <th className="px-3 py-3 text-start font-bold">الرسالة</th>
                <th className="px-3 py-3 text-start font-bold whitespace-nowrap">تاريخ التسجيل</th>
                <th className="px-3 py-3 text-start font-bold">الحالة</th>
                <th className="px-5 py-3 text-end font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted-border/20 text-xs">
              {filtered.map((inq) => (
                <React.Fragment key={inq.id}>
                  <tr className="hover:bg-surface-hover/60 transition-colors align-top">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-heading">{inq.name}</div>
                      {inq.phone && <div className="text-[10px] text-neutral-text/60 font-mono" dir="ltr">{inq.phone}</div>}
                      {inq.email && <div className="text-[10px] text-neutral-text/50 font-mono" dir="ltr">{inq.email}</div>}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="font-bold text-heading">{inq.projectTitle || 'استفسار عام'}</span>
                      {inq.unitNumber && <span className="text-[10px] text-accent block font-bold">{inq.unitNumber}</span>}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="px-2.5 py-1 rounded-full bg-accent/10 text-accent font-bold text-[10px] border border-accent/20 whitespace-nowrap">
                        {inq.interestTypeAr}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-[11px] text-neutral-text/75 max-w-xs leading-relaxed">
                      {inq.message || '—'}
                      {inq.notes && editingNotesId !== inq.id && (
                        <div className="mt-1.5 p-2 rounded-lg bg-gold/10 text-[10px] text-heading">
                          <span className="font-black text-gold">ملاحظة: </span>
                          {inq.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-[10px] text-neutral-text/60 whitespace-nowrap">
                      {formatAdminDateTime(inq.createdAt)}
                    </td>
                    <td className="px-3 py-3.5">
                      <InquiryStatusSelect inquiry={inq} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end">{rowActions(inq)}</div>
                    </td>
                  </tr>
                  {editingNotesId === inq.id && (
                    <tr>
                      <td colSpan={7} className="px-5 pb-4">
                        <NotesEditor inquiry={inq} onDone={() => setEditingNotesId(null)} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Mobile / tablet cards */}
          <div className="lg:hidden divide-y divide-muted-border/20">
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
                  <span className="font-bold text-heading">{inq.projectTitle || 'استفسار عام'}</span>
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
        </div>
      )}
    </div>
  );
};
