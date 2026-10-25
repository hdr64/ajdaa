import { useState } from 'react';
import type { Property, PublishStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { completenessIssues } from '../projectLabels';

/**
 * Publish / hide a project, shared by the projects list and the project page.
 * Publishing asks first and lists what is still missing; hiding asks because
 * the project disappears from the public site immediately.
 */
export function usePublishProject() {
  const { projects, confirm, showToast } = useAdmin();
  const { t } = useAdminT();
  const [busyId, setBusyId] = useState<number | null>(null);

  const apply = async (project: Property, status: PublishStatus, message: string) => {
    setBusyId(project.id);
    try {
      const updated = await AdminStorage.setProjectPublishStatus(project.id, status);
      projects.setData((list) => list.map((p) => (p.id === project.id ? { ...p, ...updated, floors: p.floors } : p)));
      showToast(message);
    } catch (error) {
      showToast(getErrorMessage(error, t('projects.publish.changeError')));
    } finally {
      setBusyId(null);
    }
  };

  const publish = async (project: Property) => {
    const issues = completenessIssues(project, t);
    const ok = await confirm({
      title: t('projects.publish.confirmTitle', { title: project.title }),
      message: issues.length
        ? t('projects.publish.confirmMessageWithIssues', { issues: issues.join(', ') })
        : t('projects.publish.confirmMessage'),
      confirmLabel: issues.length ? t('projects.publish.confirmLabelWithIssues') : t('projects.publish.confirmLabel'),
      rememberKey: 'project.publish',
    });
    if (ok) await apply(project, 'published', t('projects.publish.success'));
  };

  const hide = async (project: Property) => {
    const ok = await confirm({
      title: t('projects.publish.hideTitle', { title: project.title }),
      message: t('projects.publish.hideMessage'),
      confirmLabel: t('projects.publish.hideLabel'),
      danger: true,
    });
    if (ok) await apply(project, 'hidden', t('projects.publish.hiddenSuccess'));
  };

  return { publish, hide, busyId };
}
