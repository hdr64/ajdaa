import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  Inbox,
  Layers,
  MapPin,
  Pencil,
  SearchX,
  Trash2,
} from 'lucide-react';
import type { Property, UnitStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { InquiryStatusSelect } from './inquiryUi';
import { formatAdminDate } from '../adminFormat';
import { publicProjectUrl, UNIT_STATUS_LABELS_AR } from '../projectLabels';

const STATUS_COLOR: Record<UnitStatus, string> = {
  available: 'bg-emerald-500',
  reserved: 'bg-amber-500',
  rented: 'bg-sky-500',
  sold: 'bg-neutral-400',
};

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-surface border border-muted-border/40 p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-black text-heading">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, dir }: { label: string; value?: React.ReactNode; dir?: 'ltr' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-muted-border/15 last:border-0 text-xs">
      <span className="text-neutral-text/55 shrink-0">{label}</span>
      <span className="font-bold text-heading text-end min-w-0 break-words" dir={dir}>
        {value || <span className="text-neutral-text/35 font-normal">—</span>}
      </span>
    </div>
  );
}

/** What is missing for the project to look complete on the public site. */
function completenessIssues(project: Property): string[] {
  const issues: string[] = [];
  if (!project.titleEn) issues.push('لا يوجد اسم بالإنجليزية');
  if (!project.descriptionEn) issues.push('لا يوجد وصف بالإنجليزية');
  if (project.lat == null || project.lng == null) issues.push('لا توجد إحداثيات — المشروع لا يظهر على الخريطة');
  if ((project.gallery ?? []).length < 2) issues.push('معرض الصور يحتوي أقل من صورتين');
  if (!project.videoUrl) issues.push('لا يوجد فيديو');
  if (!(project.features ?? []).length) issues.push('لا توجد مزايا مدرجة');
  if (!(project.floors ?? []).some((f) => f.units.length > 0)) issues.push('لا توجد وحدات مسجلة');
  return issues;
}

const ProjectDetails: React.FC<{ project: Property }> = ({ project }) => {
  const { can, navigate, showToast, confirm, projects, inquiries } = useAdmin();
  const canManage = can('manageProjects');
  const [activeImage, setActiveImage] = useState(project.image);

  const images = useMemo(() => {
    const all = [project.image, ...(project.gallery ?? [])].filter(Boolean);
    return [...new Set(all)];
  }, [project.image, project.gallery]);

  const unitStats = useMemo(() => {
    const counts: Record<UnitStatus, number> = { available: 0, reserved: 0, rented: 0, sold: 0 };
    let total = 0;
    for (const floor of project.floors ?? []) {
      for (const unit of floor.units) {
        total += 1;
        counts[unit.status] = (counts[unit.status] ?? 0) + 1;
      }
    }
    return { counts, total };
  }, [project.floors]);

  const projectInquiries = useMemo(
    () => inquiries.data.filter((inq) => inq.projectId === project.id),
    [inquiries.data, project.id]
  );

  const issues = completenessIssues(project);

  const handleDelete = async () => {
    const ok = await confirm({
      title: `حذف المشروع "${project.title}"؟`,
      message: 'سيتم حذف جميع الأدوار والوحدات التابعة له نهائياً.',
      confirmLabel: 'حذف المشروع',
      danger: true,
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteProject(project.id);
      showToast('تم حذف المشروع');
      navigate({ section: 'projects' });
      await projects.reload();
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حذف المشروع'));
    }
  };

  return (
    <div className="space-y-5">
      <AdminHeaderActions>
        <a
          href={publicProjectUrl(project.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:inline-flex p-2.5 rounded-xl border border-muted-border/40 hover:border-accent hover:text-accent text-neutral-text/70 bg-surface"
          title="عرض في الموقع"
          aria-label="عرض في الموقع"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        {canManage && (
          <button
            onClick={() => navigate({ section: 'projectEdit', projectId: project.id })}
            className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs"
          >
            <Pencil className="w-4 h-4" />
            <span className="hidden sm:inline">تعديل المشروع</span>
          </button>
        )}
      </AdminHeaderActions>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate({ section: 'projects' })}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-text/60 hover:text-accent cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5 ltr:rotate-180" />
          كل المشاريع
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate({ section: 'units', projectId: project.id })}
            className="brand-btn-secondary text-xs font-bold px-4 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            إدارة الأدوار والوحدات
          </button>
          {canManage && (
            <button
              onClick={() => void handleDelete()}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 cursor-pointer"
              title="حذف المشروع"
              aria-label="حذف المشروع"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
        {/* Main column */}
        <div className="xl:col-span-2 space-y-5">
          <section className="rounded-3xl bg-surface border border-muted-border/40 overflow-hidden shadow-xs">
            <div className="relative aspect-[16/8] bg-neutral-900">
              {activeImage ? (
                <img src={activeImage} alt={project.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-accent/50">
                  <Building2 className="w-14 h-14" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 inset-x-5 text-white">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-neutral-950/80 border border-white/20">{project.typeAr}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold text-neutral-950">{project.priceType}</span>
                  {project.badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/80 text-canvas">{project.badge}</span>}
                </div>
                <h2 className="text-xl sm:text-2xl font-black leading-tight">{project.title}</h2>
                {project.titleEn && (
                  <p className="text-xs text-white/70 mt-0.5" dir="ltr">
                    {project.titleEn}
                  </p>
                )}
              </div>
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 p-3 overflow-x-auto">
                {images.map((src) => (
                  <button
                    key={src}
                    onClick={() => setActiveImage(src)}
                    className={`shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${
                      src === activeImage ? 'border-accent' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </section>

          <Panel title="الوصف">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <p className="text-xs text-neutral-text/80 leading-relaxed whitespace-pre-line">
                {project.description || <span className="text-neutral-text/40">لا يوجد وصف بالعربية.</span>}
              </p>
              <p className="text-xs text-neutral-text/80 leading-relaxed whitespace-pre-line" dir="ltr">
                {project.descriptionEn || <span className="text-neutral-text/40">No English description.</span>}
              </p>
            </div>
          </Panel>

          {((project.features ?? []).length > 0 || (project.featuresEn ?? []).length > 0) && (
            <Panel title="المزايا">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <ul className="space-y-1.5">
                  {(project.features ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-heading">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <ul className="space-y-1.5" dir="ltr">
                  {(project.featuresEn ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-heading">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
          )}

          {project.videoUrl && (
            <Panel title="الفيديو">
              <div className="aspect-video w-full overflow-hidden rounded-2xl border border-muted-border/50 bg-neutral-950">
                <iframe src={project.videoUrl} title="فيديو المشروع" allow="encrypted-media; picture-in-picture" allowFullScreen className="w-full h-full" loading="lazy" />
              </div>
            </Panel>
          )}

          {can('viewInquiries') && (
            <Panel
              title={`طلبات الاهتمام بهذا المشروع (${projectInquiries.length})`}
              action={
                projectInquiries.length > 0 && (
                  <button onClick={() => navigate({ section: 'inquiries' })} className="text-[11px] font-bold text-accent hover:underline cursor-pointer">
                    كل الطلبات
                  </button>
                )
              }
            >
              {projectInquiries.length === 0 ? (
                <EmptyState compact icon={Inbox} title="لا توجد طلبات لهذا المشروع بعد" />
              ) : (
                <div className="divide-y divide-muted-border/15">
                  {projectInquiries.slice(0, 8).map((inq) => (
                    <div key={inq.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-heading">{inq.name}</div>
                        <div className="text-[10px] text-neutral-text/55">
                          {inq.interestTypeAr}
                          {inq.unitNumber ? ` · ${inq.unitNumber}` : ''} · {formatAdminDate(inq.createdAt)}
                        </div>
                      </div>
                      <InquiryStatusSelect inquiry={inq} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-5">
          {issues.length > 0 && canManage && (
            <section className="rounded-3xl bg-amber-500/5 border border-amber-500/25 p-5">
              <h3 className="text-xs font-black text-amber-600 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4" />
                بيانات ناقصة ({issues.length})
              </h3>
              <ul className="space-y-1.5 text-[11px] text-heading list-disc ps-4">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
              <button
                onClick={() => navigate({ section: 'projectEdit', projectId: project.id })}
                className="mt-4 text-[11px] font-bold text-accent hover:underline cursor-pointer"
              >
                استكمال البيانات
              </button>
            </section>
          )}

          <Panel title="الوحدات">
            {unitStats.total === 0 ? (
              <EmptyState compact icon={Layers} title="لا توجد وحدات بعد" />
            ) : (
              <>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-canvas mb-3">
                  {(Object.keys(unitStats.counts) as UnitStatus[]).map((status) =>
                    unitStats.counts[status] > 0 ? (
                      <div
                        key={status}
                        className={STATUS_COLOR[status]}
                        style={{ width: `${(unitStats.counts[status] / unitStats.total) * 100}%` }}
                        title={`${UNIT_STATUS_LABELS_AR[status]}: ${unitStats.counts[status]}`}
                      />
                    ) : null
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {(Object.keys(unitStats.counts) as UnitStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[status]}`} />
                      <span className="text-neutral-text/60">{UNIT_STATUS_LABELS_AR[status]}</span>
                      <span className="font-black text-heading ms-auto">{unitStats.counts[status]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-muted-border/20 space-y-1.5">
                  {(project.floors ?? []).map((floor) => (
                    <div key={floor.id ?? floor.floorNumber} className="flex items-center justify-between text-[11px]">
                      <span className="text-heading font-bold truncate">{floor.floorNameAr}</span>
                      <span className="text-neutral-text/55 shrink-0">
                        {floor.units.length} وحدة · {floor.units.filter((u) => u.status === 'available').length} متاح
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>

          <Panel title="المعلومات">
            <Fact label="المدينة" value={[project.city, project.cityEn].filter(Boolean).join(' · ')} />
            <Fact label="المساحة" value={`${project.area.toLocaleString('en-US')} م²`} />
            <Fact label="الحالة" value={project.status} />
            <Fact label="عدد الأدوار" value={project.floors?.length ?? 0} />
            <Fact label="الجولة الافتراضية" value={project.virtualTour3dAvailable ? 'متوفرة' : 'غير متوفرة'} />
            <Fact
              label="الكتيّب"
              value={
                project.brochureUrl ? (
                  <a href={project.brochureUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                    <FileText className="w-3.5 h-3.5" />
                    عرض PDF
                  </a>
                ) : undefined
              }
            />
            <Fact label="رقم المشروع" value={project.id} dir="ltr" />
          </Panel>

          <Panel title="الموقع">
            {project.lat != null && project.lng != null ? (
              <>
                <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-muted-border/50">
                  <iframe
                    title="موقع المشروع"
                    src={`https://maps.google.com/maps?q=${project.lat},${project.lng}&z=15&output=embed`}
                    className="w-full h-full"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
                <a
                  href={`https://www.google.com/maps?q=${project.lat},${project.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-accent hover:underline"
                  dir="ltr"
                >
                  <MapPin className="w-3 h-3" />
                  {project.lat}, {project.lng}
                </a>
              </>
            ) : (
              <p className="text-[11px] text-neutral-text/50">لم تُحدد إحداثيات لهذا المشروع.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export const ProjectShowSection: React.FC = () => {
  const { projects, location, navigate } = useAdmin();
  const project = projects.data.find((p) => p.id === location.projectId);

  if (projects.error) return <SectionError message={projects.error} onRetry={() => void projects.reload()} />;
  if (!project && projects.loading) return <SectionLoading label="جاري تحميل المشروع..." />;
  if (!project) {
    return (
      <EmptyState
        icon={SearchX}
        title="المشروع غير موجود"
        description="ربما تم حذفه أو أن الرابط غير صحيح."
        action={
          <button onClick={() => navigate({ section: 'projects' })} className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer">
            العودة إلى المشاريع
          </button>
        }
      />
    );
  }
  return <ProjectDetails key={project.id} project={project} />;
};
