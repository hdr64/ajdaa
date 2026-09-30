import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronLeft, ChevronRight, Download, ExternalLink, Layers, RefreshCw, Search } from 'lucide-react';
import type { Property } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { BuildingVisualizer } from '../../../components/admin/BuildingVisualizer';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';

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

/** Horizontal project picker: every project visible at a glance, the current one highlighted. */
const ProjectStrip: React.FC<{ projects: Property[]; selectedId?: number; onSelect: (id: number) => void }> = ({
  projects,
  selectedId,
  onSelect,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => [p.title, p.titleEn, p.city].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))) : projects;
  }, [projects, query]);

  // Keep the selected project in view (deep links, picking from far along the strip).
  useEffect(() => {
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-project-id="${selectedId}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId]);

  const scrollBy = (direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // "Next" moves toward the inline end: left in RTL, right in LTR.
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollBy({ left: direction * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="rounded-3xl bg-surface border border-muted-border/40 p-3 sm:p-4 shadow-xs">
      <div className="flex items-center justify-between gap-3 mb-3 px-1">
        <span className="text-xs font-black text-heading">المشاريع ({projects.length})</span>
        <div className="flex items-center gap-1.5">
          {projects.length > 6 && (
            <div className="relative">
              <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-text/40" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث..."
                aria-label="بحث في المشاريع"
                className="w-32 sm:w-44 ps-8 pe-2 py-1.5 rounded-lg bg-canvas border border-muted-border/50 text-[11px] text-heading outline-none focus:border-accent"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-muted-border/40 text-neutral-text/60 hover:text-accent cursor-pointer"
            aria-label="السابق"
          >
            <ChevronRight className="w-4 h-4 ltr:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-muted-border/40 text-neutral-text/60 hover:text-accent cursor-pointer"
            aria-label="التالي"
          >
            <ChevronLeft className="w-4 h-4 ltr:rotate-180" />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex gap-2.5 overflow-x-auto snap-x pb-1" role="listbox" aria-label="اختيار المشروع">
        {visible.length === 0 && <p className="text-[11px] text-neutral-text/50 px-2 py-3">لا توجد مشاريع مطابقة.</p>}
        {visible.map((project) => {
          const selected = project.id === selectedId;
          const { total, available } = unitCounts(project);
          return (
            <button
              key={project.id}
              type="button"
              role="option"
              aria-selected={selected}
              data-project-id={project.id}
              onClick={() => onSelect(project.id)}
              className={`snap-start shrink-0 w-56 flex items-center gap-2.5 p-2 rounded-2xl border text-start cursor-pointer transition ${
                selected ? 'border-accent bg-accent/10 ring-2 ring-accent/25' : 'border-muted-border/40 bg-canvas/60 hover:border-accent/40'
              }`}
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-neutral-900 shrink-0">
                {project.image ? (
                  <img src={project.image} alt="" loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-accent/50">
                    <Building2 className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-black truncate ${selected ? 'text-accent' : 'text-heading'}`}>{project.title}</div>
                <div className="text-[10px] text-neutral-text/55 truncate">{project.city}</div>
                <div className="text-[10px] text-neutral-text/65 mt-0.5">
                  {project.floors?.length ?? 0} أدوار · <span className="font-bold text-heading">{available}</span>/{total} متاح
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const UnitsSection: React.FC = () => {
  const { projects, location, navigate, showToast, can } = useAdmin();
  const [exporting, setExporting] = useState(false);

  const selected = projects.data.find((p) => p.id === location.projectId) ?? null;

  // Without a (valid) project in the URL, pin the first project into it so the
  // address always says what is on screen.
  useEffect(() => {
    if (projects.loading || projects.data.length === 0) return;
    if (!selected) navigate({ section: 'units', projectId: projects.data[0].id }, { replace: true });
  }, [projects.loading, projects.data, selected, navigate]);

  if (projects.error) return <SectionError message={projects.error} onRetry={() => void projects.reload()} />;
  if (projects.loading && projects.data.length === 0) return <SectionLoading label="جاري تحميل المشاريع..." />;
  if (projects.data.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="لا توجد مشاريع بعد"
        description="أضف مشروعاً من صفحة المشاريع لإدارة أدواره ووحداته."
        action={
          <button
            onClick={() => navigate({ section: 'projects' })}
            className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
          >
            الانتقال إلى المشاريع
          </button>
        }
      />
    );
  }

  const handleExport = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      await AdminStorage.exportUnitsCsv(selected.id);
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر تصدير الملف'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      {selected && (
        <AdminHeaderActions>
          <button
            onClick={() => navigate({ section: 'project', projectId: selected.id })}
            className="brand-btn-secondary font-bold px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer text-xs"
            title="صفحة المشروع"
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">صفحة المشروع</span>
          </button>
          {can('exportData') && (
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting || unitCounts(selected).total === 0}
              className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              title="تصدير وحدات هذا المشروع"
            >
              {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">تصدير CSV</span>
            </button>
          )}
        </AdminHeaderActions>
      )}

      <ProjectStrip
        projects={projects.data}
        selectedId={selected?.id}
        onSelect={(projectId) => navigate({ section: 'units', projectId })}
      />

      {selected ? (
        <BuildingVisualizer
          key={selected.id}
          project={selected}
          onProjectUpdate={async () => {
            await projects.reload();
          }}
          onShowToast={showToast}
          canEdit={can('manageUnits')}
          canEditFloors={can('manageProjects')}
        />
      ) : (
        <SectionLoading />
      )}
    </div>
  );
};
