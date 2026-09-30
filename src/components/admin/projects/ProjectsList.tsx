import React from 'react';
import { Copy, Eye, EyeOff, Layers, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Property } from '../../../types/property';
import { publishStatusOf } from '../../../pages/admin/projectLabels';
import { unitStats } from './projectsModel';
import { ProjectImage, ProjectStatusBadge } from './projectsUi';

interface ProjectsListProps {
  projects: Property[];
  canManage: boolean;
  busyId: number | null;
  onOpen: (project: Property) => void;
  onManageUnits: (project: Property) => void;
  onPublish: (project: Property) => void;
  onHide: (project: Property) => void;
  onEdit: (project: Property) => void;
  onDuplicate: (project: Property) => void;
  onDelete: (project: Property) => void;
}

export const ProjectsList: React.FC<ProjectsListProps> = ({
  projects,
  canManage,
  busyId,
  onOpen,
  onManageUnits,
  onPublish,
  onHide,
  onEdit,
  onDuplicate,
  onDelete,
}) => {
  return (
    <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden divide-y divide-muted-border/20">
      {projects.map((project) => {
        const { total, available, sold } = unitStats(project);
        const occupancy = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
        const status = publishStatusOf(project);

        return (
          <article
            key={project.id}
            className="p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-surface-hover/40 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 xl:w-80 shrink-0">
              <button
                type="button"
                onClick={() => onOpen(project)}
                className="w-16 h-12 sm:w-20 sm:h-14 rounded-xl overflow-hidden bg-neutral-900 shrink-0 relative cursor-pointer group"
                aria-label={`عرض تفاصيل ${project.title}`}
              >
                <ProjectImage src={project.image} alt={project.title} />
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpen(project)}
                  className="text-xs sm:text-sm font-black text-heading hover:text-accent truncate block text-start cursor-pointer transition-colors"
                  title={project.title}
                >
                  {project.title}
                </button>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 shrink-0 truncate">
                    {project.typeAr || project.type}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-neutral-text/60 truncate">
                    <MapPin className="w-3 h-3 text-gold shrink-0" />
                    {project.city}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1 min-w-0 text-xs text-neutral-text/70">
              <ProjectStatusBadge status={status} />

              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-text/50">المساحة:</span>
                <span className="font-bold text-heading">{project.area.toLocaleString('en-US')} م²</span>
              </div>

              <div
                className="flex items-center gap-1.5 tabular-nums"
                title={`إجمالي: ${total} | متاح: ${available} | مباع/مؤجر: ${sold}`}
              >
                <span className="text-[10px] text-neutral-text/50">الوحدات:</span>
                <span className="font-bold text-heading">{total}</span>
                <span className="text-neutral-text/40">/</span>
                <span className="text-emerald-500 font-bold">{available} متاح</span>
                <span className="text-neutral-text/40">/</span>
                <span className="text-neutral-text/60">{sold} مباع</span>
              </div>

              {total > 0 && (
                <div className="flex items-center gap-2 min-w-[120px]">
                  <span className="text-[10px] text-neutral-text/50">الإشغال:</span>
                  <div className="flex-1 bg-canvas h-1.5 rounded-full overflow-hidden border border-muted-border/30 max-w-[70px]">
                    <div className="bg-accent h-full rounded-full transition-all" style={{ width: `${occupancy}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-500">{occupancy}%</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 xl:shrink-0">
              <button
                onClick={() => onManageUnits(project)}
                className="brand-btn-primary text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>إدارة الوحدات</span>
              </button>
              {canManage && (
                <div className="flex items-center gap-1">
                  {status === 'published' ? (
                    <button
                      onClick={() => onHide(project)}
                      disabled={busyId === project.id}
                      className="p-2 rounded-xl bg-canvas border border-muted-border/40 hover:border-accent text-neutral-text/70 hover:text-heading transition cursor-pointer disabled:opacity-50"
                      title="إخفاء من الموقع"
                      aria-label={`إخفاء ${project.title} من الموقع`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => onPublish(project)}
                      disabled={busyId === project.id}
                      className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 transition cursor-pointer disabled:opacity-50"
                      title="نشر في الموقع"
                      aria-label={`نشر ${project.title} في الموقع`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(project)}
                    className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition cursor-pointer"
                    title="تعديل المشروع"
                    aria-label={`تعديل ${project.title}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDuplicate(project)}
                    disabled={busyId === project.id}
                    className="p-2 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent transition cursor-pointer disabled:opacity-50"
                    title="نسخ المشروع"
                    aria-label="نسخ المشروع"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(project)}
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                    title="حذف المشروع"
                    aria-label={`حذف ${project.title}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
