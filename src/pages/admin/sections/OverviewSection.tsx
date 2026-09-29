import React, { useMemo } from 'react';
import { Building2, TrendingUp, Users, Layers, ArrowUpRight, Inbox } from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { InquiryStatusSelect, WhatsAppLink } from './inquiryUi';
import { formatAdminDate } from '../adminFormat';

const TYPE_LABEL_AR: Record<string, string> = {
  commercial: 'تجاري',
  office: 'إداري',
  logistics: 'لوجستي',
  residential: 'سكني',
  hotel: 'فندقي',
};

export const OverviewSection: React.FC = () => {
  const { projects, inquiries, can, navigate } = useAdmin();
  const canViewInquiries = can('viewInquiries');

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let reserved = 0;
    let rented = 0;
    let sold = 0;
    let area = 0;
    const typeCounts = new Map<string, number>();

    for (const project of projects.data) {
      area += project.area || 0;
      typeCounts.set(project.type, (typeCounts.get(project.type) ?? 0) + 1);
      for (const floor of project.floors ?? []) {
        for (const unit of floor.units) {
          total += 1;
          if (unit.status === 'available') available += 1;
          else if (unit.status === 'reserved') reserved += 1;
          else if (unit.status === 'rented') rented += 1;
          else if (unit.status === 'sold') sold += 1;
        }
      }
    }

    const occupancy = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
    const typeSummary = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${count} ${TYPE_LABEL_AR[type] ?? type}`)
      .join(' · ');

    return { total, available, reserved, rented, sold, area, occupancy, typeSummary };
  }, [projects.data]);

  const newInquiries = inquiries.data.filter((i) => i.status === 'new').length;
  const contactedInquiries = inquiries.data.filter((i) => i.status === 'contacted').length;

  if (projects.error) return <SectionError message={projects.error} onRetry={() => void projects.reload()} />;
  if (projects.loading && projects.data.length === 0) return <SectionLoading label="جاري تحميل بيانات الأصول العقارية..." />;

  const cardClass =
    'p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs hover:border-accent/40 transition-all flex flex-col justify-between';

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${canViewInquiries ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
        <div className={cardClass}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-text/60 font-bold text-xs">إجمالي المحفظة العقارية</span>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-heading tracking-tight">{projects.data.length}</div>
            <div className="text-[11px] font-bold text-accent mt-1">
              {stats.area.toLocaleString('en-US')} م² <span className="text-neutral-text/50 text-[10px]">مساحة إجمالية</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-muted-border/20 text-[10px] text-neutral-text/60 truncate" title={stats.typeSummary}>
            {stats.typeSummary || '—'}
          </div>
        </div>

        <div className={cardClass}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-text/60 font-bold text-xs">معدل الإشغال الكلي</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-emerald-500 tracking-tight">{stats.occupancy}%</div>
            <div className="w-full bg-canvas rounded-full h-2 mt-2 overflow-hidden border border-muted-border/30">
              <div
                className="bg-gradient-to-l from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
                style={{ width: `${stats.occupancy}%` }}
              />
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-muted-border/20 grid grid-cols-4 gap-1 text-[10px] text-center">
            <span className="text-emerald-500 font-bold">{stats.available} متاح</span>
            <span className="text-amber-500 font-bold">{stats.reserved} محجوز</span>
            <span className="text-sky-500 font-bold">{stats.rented} مؤجر</span>
            <span className="text-neutral-text/60 font-bold">{stats.sold} مباع</span>
          </div>
        </div>

        {canViewInquiries && (
          <div className={cardClass}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-text/60 font-bold text-xs">طلبات الاهتمام الواردة</span>
                <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center text-gold">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-black text-heading tracking-tight">{inquiries.data.length}</div>
              <div className="text-[11px] font-bold text-emerald-500 mt-1">{newInquiries} طلبات جديدة</div>
            </div>
            <div className="mt-3 pt-3 border-t border-muted-border/20 text-[10px] text-neutral-text/60">
              {contactedInquiries} قيد المتابعة · {inquiries.data.length - newInquiries - contactedInquiries} مغلق
            </div>
          </div>
        )}

        <div className={cardClass}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-text/60 font-bold text-xs">الوحدات العقارية</span>
              <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-heading tracking-tight">{stats.total}</div>
            <div className="text-[11px] font-bold text-neutral-text/70 mt-1">
              موزعة على {projects.data.reduce((sum, p) => sum + (p.floors?.length ?? 0), 0)} دور
            </div>
          </div>
          <button
            onClick={() => navigate({ section: 'units' })}
            className="mt-3 pt-3 border-t border-muted-border/20 text-[10px] text-accent font-bold text-start hover:underline cursor-pointer"
          >
            فتح المخطط البصري للأدوار
          </button>
        </div>
      </div>

      {canViewInquiries && (
        <div className="rounded-2xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-muted-border/30">
            <div>
              <h3 className="text-sm font-black text-heading">أحدث استفسارات المستثمرين والعملاء</h3>
              <p className="text-[11px] text-neutral-text/60 mt-0.5">آخر 6 طلبات مسجلة عبر الموقع</p>
            </div>
            <button
              onClick={() => navigate({ section: 'inquiries' })}
              className="brand-btn-secondary px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <span>عرض كل الطلبات ({inquiries.data.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {inquiries.error ? (
            <SectionError message={inquiries.error} onRetry={() => void inquiries.reload()} />
          ) : inquiries.data.length === 0 ? (
            <EmptyState
              compact
              icon={Inbox}
              title={inquiries.loading ? 'جاري تحميل الطلبات...' : 'لا توجد طلبات اهتمام بعد'}
              description={inquiries.loading ? undefined : 'ستظهر هنا الطلبات فور تسجيلها من صفحة "سجل اهتمامك" في الموقع.'}
            />
          ) : (
            <div className="divide-y divide-muted-border/15">
              {inquiries.data.slice(0, 6).map((inq) => (
                <div key={inq.id} className="py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1 basis-48">
                    <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent font-black text-xs flex items-center justify-center shrink-0">
                      {inq.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-heading text-xs truncate">{inq.name}</div>
                      <div className="text-[10px] text-neutral-text/60 font-mono truncate" dir="ltr">
                        {inq.phone || inq.email || '—'}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 basis-40 text-xs">
                    <span className="font-bold text-heading block truncate">{inq.projectTitle || 'استفسار عام'}</span>
                    <span className="text-[10px] text-neutral-text/60">
                      {inq.interestTypeAr} · {formatAdminDate(inq.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <InquiryStatusSelect inquiry={inq} />
                    <WhatsAppLink phone={inq.phone} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
