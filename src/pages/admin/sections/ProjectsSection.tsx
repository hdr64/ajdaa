import React, { useMemo, useState } from 'react';
import { Building2, Eye, EyeOff, FileClock, Layers, MapPin, Pencil, Plus, Search, SearchX, Trash2, X as CloseIcon } from 'lucide-react';
import type { Property, PublishStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { ProjectCreateModal } from '../../../components/admin/ProjectCreateModal';
import { PUBLISH_STATUS_LABELS_AR, publishStatusOf } from '../projectLabels';
import { usePublishProject } from './usePublishProject';
import { ViewSwitcher } from '../../../components/admin/common/ViewSwitcher';
import { isViewMode, type ViewMode } from '../../../components/admin/common/viewModes';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { ProjectsTable } from '../../../components/admin/projects/ProjectsTable';
import { ProjectsList } from '../../../components/admin/projects/ProjectsList';

const TYPE_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'commercial', label: 'تجاري' },
  { key: 'office', label: 'إداري ومكتبي' },
  { key: 'logistics', label: 'لوجستي' },
  { key: 'residential', label: 'سكني' },
  { key: 'hotel', label: 'فنادق' },
];

/** Image with a neutral placeholder instead of the browser's broken-image icon. */
const ProjectImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-accent/10 text-accent/60">
        <Building2 className="w-10 h-10" />
        <span className="text-[10px] font-bold">{src ? 'تعذر تحميل الصورة' : 'لا توجد صورة'}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
};

function unitCounts(project: Property) {
  let total = 0;
  let available = 0;
  for (const floor of project.floors ?? []) {
    for (const unit of floor.units) {
      total += 1;
      if (unit.status === 'available') available += 1;
    }
  }
  return { total, available };
}

export const ProjectsSection: React.FC = () => {
  const { projects, can, navigate, showToast, confirm } = useAdmin();
  const canManage = can('manageProjects');

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PublishStatus>('all');
  const [draftBannerDismissed, setDraftBannerDismissed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [view, setView] = usePersistentState<ViewMode>('ajda.admin.projects.view', 'grid', isViewMode);
  const { publish, hide, busyId } = usePublishProject();

  const statusCounts = useMemo(() => {
    const counts: Record<'all' | PublishStatus, number> = { all: projects.data.length, draft: 0, published: 0, hidden: 0 };
    for (const project of projects.data) counts[publishStatusOf(project)] += 1;
    return counts;
  }, [projects.data]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: projects.data.length };
    for (const project of projects.data) counts[project.type] = (counts[project.type] ?? 0) + 1;
    return counts;
  }, [projects.data]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.data.filter((p) => {
      if (typeFilter !== 'all' && p.type !== typeFilter) return false;
      if (statusFilter !== 'all' && publishStatusOf(p) !== statusFilter) return false;
      if (!query) return true;
      return [p.title, p.titleEn, p.city, p.cityEn, p.typeAr]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [projects.data, search, typeFilter, statusFilter]);

  const handleDelete = async (project: Property) => {
    const ok = await confirm({
      title: `حذف المشروع "${project.title}"؟`,
      message: 'سيتم حذف جميع الأدوار والوحدات التابعة له نهائياً. طلبات الاهتمام المرتبطة تبقى دون ربط بالمشروع.',
      confirmLabel: 'حذف المشروع',
      danger: true,
    });
    if (!ok) return;
    try {
      await AdminStorage.deleteProject(project.id);
      await projects.reload();
      showToast('تم حذف المشروع');
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر حذف المشروع'));
    }
  };

  const header = (
    <AdminHeaderActions>
      <ViewSwitcher value={view} onChange={setView} modes={['table', 'list', 'grid']} />
      {canManage && (
        <button
          onClick={() => setCreating(true)}
          className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">مشروع جديد</span>
        </button>
      )}
    </AdminHeaderActions>
  );

  const modals = (
    <>
      {creating && (
        <ProjectCreateModal
          onClose={() => setCreating(false)}
          onShowToast={showToast}
          onCreated={async (created) => {
            setCreating(false);
            await projects.reload();
            // Straight to the full editor to add location, video and English copy.
            navigate({ section: 'projectEdit', projectId: created.id });
          }}
        />
      )}
    </>
  );

  if (projects.error) {
    return (
      <>
        {header}
        <SectionError message={projects.error} onRetry={() => void projects.reload()} />
      </>
    );
  }

  if (projects.loading && projects.data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label="جاري تحميل المشاريع..." />
      </>
    );
  }

  if (projects.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={Building2}
          title="لا توجد مشاريع مسجلة بعد"
          description="ابدأ بإضافة أول مشروع عقاري إلى المحفظة."
          action={
            canManage && (
              <button
                onClick={() => setCreating(true)}
                className="brand-btn-primary font-bold text-xs px-5 py-2.5 rounded-xl inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                مشروع جديد
              </button>
            )
          }
        />
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {statusCounts.draft > 0 && !draftBannerDismissed && statusFilter !== 'draft' && (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs">
          <FileClock className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold text-heading">
            {statusCounts.draft === 1 ? 'مشروع واحد في وضع المسودة' : `${statusCounts.draft} مشاريع في وضع المسودة`}
            <span className="font-normal text-neutral-text/65"> — غير ظاهرة في الموقع حتى تُنشر.</span>
          </span>
          <button type="button" onClick={() => setStatusFilter('draft')} className="font-bold text-accent hover:underline cursor-pointer">
            عرض المسودات
          </button>
          <button
            type="button"
            onClick={() => setDraftBannerDismissed(true)}
            className="ms-auto p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
            aria-label="إخفاء التنبيه"
          >
            <CloseIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto" role="group" aria-label="حالة النشر">
        {(['all', 'published', 'draft', 'hidden'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            aria-pressed={statusFilter === key}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === key ? 'brand-fill text-canvas shadow-xs' : 'bg-surface border border-muted-border/40 text-neutral-text/70 hover:text-heading'
            }`}
          >
            {key === 'all' ? 'كل الحالات' : PUBLISH_STATUS_LABELS_AR[key]} <span className="opacity-70">({statusCounts[key]})</span>
          </button>
        ))}
      </div>

      <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
          <input
            type="search"
            placeholder="ابحث باسم المشروع أو المدينة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {TYPE_FILTERS.map((filter) => {
            const count = typeCounts[filter.key] ?? 0;
            if (filter.key !== 'all' && count === 0) return null;
            const active = typeFilter === filter.key;
            return (
              <button
                key={filter.key}
                onClick={() => setTypeFilter(filter.key)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
                  active
                    ? 'brand-fill text-canvas shadow-xs'
                    : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
                }`}
              >
                {filter.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="لا توجد مشاريع مطابقة"
          description="جرّب كلمة بحث أخرى أو اختر تصنيفاً مختلفاً."
          action={
            <button
              onClick={() => {
                setSearch('');
                setTypeFilter('all');
              }}
              className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
            >
              مسح عوامل التصفية
            </button>
          }
        />
      ) : view === 'table' ? (
        <ProjectsTable
          projects={filtered}
          canManage={canManage}
          busyId={busyId}
          onOpen={(p) => navigate({ section: 'project', projectId: p.id })}
          onManageUnits={(p) => navigate({ section: 'units', projectId: p.id })}
          onPublish={(p) => void publish(p)}
          onHide={(p) => void hide(p)}
          onEdit={(p) => navigate({ section: 'projectEdit', projectId: p.id })}
          onDelete={(p) => void handleDelete(p)}
        />
      ) : view === 'list' ? (
        <ProjectsList
          projects={filtered}
          canManage={canManage}
          busyId={busyId}
          onOpen={(p) => navigate({ section: 'project', projectId: p.id })}
          onManageUnits={(p) => navigate({ section: 'units', projectId: p.id })}
          onPublish={(p) => void publish(p)}
          onHide={(p) => void hide(p)}
          onEdit={(p) => navigate({ section: 'projectEdit', projectId: p.id })}
          onDelete={(p) => void handleDelete(p)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((project) => {
            const { total, available } = unitCounts(project);
            const occupancy = total > 0 ? Math.round(((total - available) / total) * 100) : 0;

            return (
              <article
                key={project.id}
                className="rounded-3xl bg-surface border border-muted-border/40 overflow-hidden shadow-xs hover:shadow-md hover:border-accent/40 transition-all flex flex-col justify-between group"
              >
                <div>
                  <button
                    type="button"
                    onClick={() => navigate({ section: 'project', projectId: project.id })}
                    className="block relative aspect-[16/9] w-full overflow-hidden bg-neutral-900 cursor-pointer text-start"
                    aria-label={`عرض تفاصيل ${project.title}`}
                  >
                    <ProjectImage src={project.image} alt={project.title} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-neutral-950/80 backdrop-blur-md text-white border border-white/20 truncate">
                        {project.typeAr}
                      </span>
                      {publishStatusOf(project) !== 'published' && (
                        <span
                          className={`ms-auto me-1.5 text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs shrink-0 ${
                            publishStatusOf(project) === 'draft' ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-white border border-white/20'
                          }`}
                        >
                          {PUBLISH_STATUS_LABELS_AR[publishStatusOf(project)]}
                        </span>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gold text-neutral-950 shadow-xs shrink-0">
                        {project.priceType}
                      </span>
                    </div>
                    <div className="absolute bottom-3 inset-x-3 flex items-center gap-1.5 text-white/90 text-xs font-bold">
                      <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                      <span className="truncate">{project.city}</span>
                      {project.lat == null && (
                        <span className="ms-auto text-[9px] px-1.5 py-0.5 rounded bg-amber-500/80 text-neutral-950 font-black">
                          بلا موقع على الخريطة
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="p-5">
                    <h4 className="text-sm font-black text-heading mb-1.5 line-clamp-1" title={project.title}>
                      <button
                        type="button"
                        onClick={() => navigate({ section: 'project', projectId: project.id })}
                        className="hover:text-accent cursor-pointer text-start"
                      >
                        {project.title}
                      </button>
                    </h4>
                    <p className="text-[11px] text-neutral-text/60 line-clamp-2 mb-4 leading-relaxed min-h-[2.5em]">
                      {project.description || '—'}
                    </p>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-canvas/70 border border-muted-border/30 text-[11px] mb-4 text-center">
                      <div>
                        <span className="text-neutral-text/50 block text-[10px]">المساحة</span>
                        <span className="font-bold text-heading">{project.area.toLocaleString('en-US')} م²</span>
                      </div>
                      <div>
                        <span className="text-neutral-text/50 block text-[10px]">الأدوار</span>
                        <span className="font-bold text-heading">{project.floors?.length ?? 0}</span>
                      </div>
                      <div>
                        <span className="text-neutral-text/50 block text-[10px]">الوحدات</span>
                        <span className="font-bold text-heading">{total}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-bold">
                        <span className="text-neutral-text/60">نسبة الإشغال</span>
                        <span className="text-emerald-500">
                          {total > 0 ? `${occupancy}% (${total - available}/${total})` : 'لا توجد وحدات'}
                        </span>
                      </div>
                      <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-muted-border/30">
                        <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${occupancy}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 flex items-center gap-2">
                  <button
                    onClick={() => navigate({ section: 'units', projectId: project.id })}
                    className="flex-1 brand-btn-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>إدارة الوحدات</span>
                  </button>
                  {canManage && (
                    <>
                      {publishStatusOf(project) === 'published' ? (
                        <button
                          onClick={() => void hide(project)}
                          disabled={busyId === project.id}
                          title="إخفاء من الموقع"
                          aria-label={`إخفاء ${project.title} من الموقع`}
                          className="p-2.5 rounded-xl bg-canvas border border-muted-border/40 hover:border-accent text-neutral-text/70 hover:text-heading transition cursor-pointer disabled:opacity-50"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => void publish(project)}
                          disabled={busyId === project.id}
                          title="نشر في الموقع"
                          aria-label={`نشر ${project.title} في الموقع`}
                          className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition cursor-pointer disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => navigate({ section: 'projectEdit', projectId: project.id })}
                        title="تعديل المشروع"
                        aria-label={`تعديل المشروع ${project.title}`}
                        className="p-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => void handleDelete(project)}
                        title="حذف المشروع"
                        aria-label={`حذف المشروع ${project.title}`}
                        className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {modals}
    </div>
  );
};
