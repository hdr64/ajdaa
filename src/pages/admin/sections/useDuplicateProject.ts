import { useState } from 'react';
import type { Property } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';

/**
 * Duplicate a project, shared by the projects list and the project page.
 * The server does the copy: the new project is a draft, so nothing reaches the
 * public site until an admin publishes it. It is always asked for, never
 * remembered, because each copy needs a fresh name and the original is untouched.
 */
export function useDuplicateProject() {
  const { projects, confirm, showToast, navigate } = useAdmin();
  const { t } = useAdminT();
  const [busyId, setBusyId] = useState<number | null>(null);

  const duplicate = async (project: Property) => {
    const ok = await confirm({
      title: t('projects.duplicate.confirmTitle', { title: project.title }),
      message: t('projects.duplicate.confirmMessage'),
      confirmLabel: t('projects.duplicate.confirmLabel'),
    });
    if (!ok) return;

    setBusyId(project.id);
    try {
      const created = await AdminStorage.duplicateProject(project.id);
      projects.setData((list) => [...list, created]);
      showToast(t('projects.duplicate.success'));
      // Straight to the editor so the "(copy)" title can be renamed right away.
      navigate({ section: 'projectEdit', projectId: created.id });
    } catch (error) {
      showToast(getErrorMessage(error, t('projects.duplicate.error')));
    } finally {
      setBusyId(null);
    }
  };

  return { duplicate, busyId };
}
