import React, { useCallback, useState } from 'react';
import { Plus, Pencil, Trash2, ImageIcon } from 'lucide-react';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionErrorBanner, SectionLoading } from '../../../components/admin/common/SectionState';
import { PastProjectFormDialog } from '../../../components/admin/pastProjects/PastProjectFormDialog';
import type { PastProject } from '../../../services/adminStorage';

export const PastProjectsSection: React.FC = () => {
  const { can, showToast, confirmDelete } = useAdmin();
  const { t } = useAdminT();
  const canManage = can('managePastProjects');
  const projects = useAsyncData<PastProject[]>(
    useCallback((signal) => AdminStorage.listPastProjects(signal), []),
    [],
    []
  );
  const [dialog, setDialog] = useState<{ project: PastProject | null } | null>(null);

  const handleDelete = async (project: PastProject) => {
    const ok = await confirmDelete({
      title: t('pastProjects.delete.confirmTitle', { title: project.title }),
      message: t('pastProjects.delete.confirmMessage'),
      confirmLabel: t('pastProjects.delete.confirmLabel'),
    });
    if (!ok) return;
    try {
      await AdminStorage.deletePastProject(project.id);
      await projects.reload();
      showToast(t('pastProjects.delete.success'));
    } catch (error) {
      showToast(getErrorMessage(error, t('pastProjects.delete.error')));
    }
  };

  const handleTogglePublished = async (project: PastProject) => {
    try {
      await AdminStorage.setPastProjectPublished(project.id, !project.published);
      await projects.reload();
      showToast(t('pastProjects.toggle.success'));
    } catch (error) {
      showToast(getErrorMessage(error, t('pastProjects.toggle.error')));
    }
  };

  const header = (
    <AdminHeaderActions>
      {canManage && (
        <button
          onClick={() => setDialog({ project: null })}
          className="brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">{t('pastProjects.new')}</span>
        </button>
      )}
    </AdminHeaderActions>
  );

  if (projects.error && projects.data.length === 0) {
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
        <SectionLoading variant="cards" label={t('pastProjects.loading')} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      {projects.error && <SectionErrorBanner message={projects.error} onRetry={() => void projects.reload()} />}
      {projects.data.length === 0 ? (
        <EmptyState icon={ImageIcon} title={t('pastProjects.emptyTitle')} description={t('pastProjects.emptyDescription')} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-muted-border/40 bg-surface">
          <table className="w-full text-xs">
            <thead className="bg-canvas/60 text-neutral-text/70">
              <tr>
                <th className="text-start p-3 font-bold">{t('pastProjects.table.image')}</th>
                <th className="text-start p-3 font-bold">{t('pastProjects.table.title')}</th>
                <th className="text-start p-3 font-bold">{t('pastProjects.table.category')}</th>
                <th className="text-start p-3 font-bold">{t('pastProjects.table.order')}</th>
                <th className="text-start p-3 font-bold">{t('pastProjects.table.status')}</th>
                <th className="text-start p-3 font-bold">{t('pastProjects.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {projects.data.map((project) => (
                <tr key={project.id} className="border-t border-muted-border/30">
                  <td className="p-3">
                    <img src={project.image} alt={project.title} className="w-16 h-12 object-cover rounded-lg" />
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-heading">{project.title}</div>
                    {project.titleEn && <div className="text-[10px] text-accent" dir="ltr">{project.titleEn}</div>}
                  </td>
                  <td className="p-3 text-neutral-text/80">{project.category ?? '—'}</td>
                  <td className="p-3 tabular-nums">{project.sortOrder}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => void handleTogglePublished(project)}
                      disabled={!canManage}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer ${
                        project.published ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted-border/30 text-neutral-text/60'
                      }`}
                    >
                      {project.published ? t('pastProjects.status.published') : t('pastProjects.status.draft')}
                    </button>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => setDialog({ project })}
                            className="p-1.5 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-accent/10 cursor-pointer"
                            aria-label={t('pastProjects.action.edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(project)}
                            className="p-1.5 rounded-lg text-neutral-text/60 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                            aria-label={t('pastProjects.action.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && (
        <PastProjectFormDialog
          initial={dialog.project}
          onClose={() => setDialog(null)}
          onSaved={projects.reload}
        />
      )}
    </div>
  );
};