import React, { useMemo } from 'react';
import { Eye, EyeOff, Layers, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { Property } from '../../../types/property';
import { DataTable } from '../common/DataTable';
import type { Column } from '../common/dataTableTypes';
import { formatAdminDate } from '../../../pages/admin/adminFormat';
import { publishStatusOf } from '../../../pages/admin/projectLabels';
import { projectSearchText, unitStats } from './projectsModel';
import { ProjectImage, ProjectStatusBadge } from './projectsUi';

export const PROJECTS_TABLE_STORAGE_KEY = 'ajda.admin.projects';

interface ProjectsTableProps {
  projects: Property[];
  canManage: boolean;
  busyId: number | null;
  onOpen: (project: Property) => void;
  onManageUnits: (project: Property) => void;
  onPublish: (project: Property) => void;
  onHide: (project: Property) => void;
  onEdit: (project: Property) => void;
  onDelete: (project: Property) => void;
}

export const ProjectsTable: React.FC<ProjectsTableProps> = ({
  projects,
  canManage,
  busyId,
  onOpen,
  onManageUnits,
  onPublish,
  onHide,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<Column<Property>[]>(
    () => [
      {
        id: 'project',
        header: 'المشروع',
        width: '260px',
        sortValue: (project) => project.title,
        cell: (project) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-9 rounded-lg overflow-hidden bg-neutral-900 shrink-0 relative">
              <ProjectImage src={project.image} alt={project.title} />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs text-heading truncate block group-hover:text-accent transition-colors" title={project.title}>
                {project.title}
              </span>
              {project.titleEn && (
                <span className="text-[10px] text-neutral-text/50 font-mono block truncate" dir="ltr">
                  {project.titleEn}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'التصنيف',
        width: '140px',
        sortValue: (project) => project.typeAr || project.type,
        cell: (project) => (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 truncate">
            {project.typeAr || project.type}
          </span>
        ),
      },
      {
        id: 'city',
        header: 'المدينة / الموقع',
        width: '150px',
        sortValue: (project) => project.city,
        cell: (project) => (
          <div className="flex items-center gap-1.5 text-xs text-heading">
            <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
            <span className="truncate">{project.city}</span>
            {project.lat == null && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 font-bold shrink-0">
                بلا خريطة
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'الحالة',
        width: '110px',
        sortValue: (project) => publishStatusOf(project),
        cell: (project) => <ProjectStatusBadge status={publishStatusOf(project)} />,
      },
      {
        id: 'units',
        header: 'الوحدات (إجمالي / متاح / مباع)',
        width: '180px',
        sortValue: (project) => unitStats(project).total,
        cell: (project) => {
          const { total, available, sold } = unitStats(project);
          return (
            <div className="flex items-center gap-1.5 text-xs tabular-nums" title={`إجمالي: ${total} | متاح: ${available} | مباع أو مؤجر: ${sold}`}>
              <span className="font-bold text-heading">{total}</span>
              <span className="text-neutral-text/40">/</span>
              <span className="text-emerald-500 font-bold">{available}</span>
              <span className="text-neutral-text/40">/</span>
              <span className="text-neutral-text/60">{sold}</span>
            </div>
          );
        },
      },
      {
        id: 'area',
        header: 'المساحة',
        width: '120px',
        sortValue: (project) => project.area,
        cell: (project) => (
          <span className="text-xs tabular-nums font-bold text-heading">
            {project.area.toLocaleString('en-US')} م²
          </span>
        ),
      },
      {
        id: 'updatedAt',
        header: 'آخر تحديث',
        width: '130px',
        sortValue: (project) => ((project as unknown as { updatedAt?: string }).updatedAt ?? project.publishedAt ?? ''),
        cell: (project) => {
          const dateStr = (project as unknown as { updatedAt?: string }).updatedAt ?? project.publishedAt;
          return <span className="text-[10px] text-neutral-text/60 whitespace-nowrap">{formatAdminDate(dateStr)}</span>;
        },
      },
    ],
    []
  );

  return (
    <DataTable
      storageKey={PROJECTS_TABLE_STORAGE_KEY}
      rows={projects}
      getRowId={(project) => String(project.id)}
      columns={columns}
      searchText={projectSearchText}
      initialSort={{ columnId: 'project', direction: 'asc' }}
      onRowClick={onOpen}
      rowActions={(project) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onManageUnits(project)}
            className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition cursor-pointer"
            title="إدارة الوحدات"
            aria-label={`إدارة وحدات ${project.title}`}
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          {canManage && (
            <>
              {publishStatusOf(project) === 'published' ? (
                <button
                  onClick={() => onHide(project)}
                  disabled={busyId === project.id}
                  className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-surface transition cursor-pointer disabled:opacity-50"
                  title="إخفاء من الموقع"
                  aria-label={`إخفاء ${project.title} من الموقع`}
                >
                  <EyeOff className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => onPublish(project)}
                  disabled={busyId === project.id}
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition cursor-pointer disabled:opacity-50"
                  title="نشر في الموقع"
                  aria-label={`نشر ${project.title} في الموقع`}
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onEdit(project)}
                className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition cursor-pointer"
                title="تعديل المشروع"
                aria-label={`تعديل ${project.title}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(project)}
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                title="حذف المشروع"
                aria-label={`حذف ${project.title}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    />
  );
};
