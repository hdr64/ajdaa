import { useState } from 'react';
import type { Property, PublishStatus } from '../../../types/property';
import { AdminStorage } from '../../../services/adminStorage';
import { getErrorMessage } from '../../../services/api';
import { useAdmin } from '../adminContextDef';
import { completenessIssues } from '../projectLabels';

/**
 * Publish / hide a project, shared by the projects list and the project page.
 * Publishing asks first and lists what is still missing; hiding asks because
 * the project disappears from the public site immediately.
 */
export function usePublishProject() {
  const { projects, confirm, showToast } = useAdmin();
  const [busyId, setBusyId] = useState<number | null>(null);

  const apply = async (project: Property, status: PublishStatus, message: string) => {
    setBusyId(project.id);
    try {
      const updated = await AdminStorage.setProjectPublishStatus(project.id, status);
      projects.setData((list) => list.map((p) => (p.id === project.id ? { ...p, ...updated, floors: p.floors } : p)));
      showToast(message);
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر تغيير حالة النشر'));
    } finally {
      setBusyId(null);
    }
  };

  const publish = async (project: Property) => {
    const issues = completenessIssues(project);
    const ok = await confirm({
      title: `نشر "${project.title}" في الموقع؟`,
      message: issues.length
        ? `سيظهر المشروع للزوار فوراً، لكن تنقصه بيانات: ${issues.join('، ')}.`
        : 'سيظهر المشروع للزوار في قائمة المشاريع والخريطة فوراً.',
      confirmLabel: issues.length ? 'نشر رغم النواقص' : 'نشر المشروع',
      rememberKey: 'project.publish',
    });
    if (ok) await apply(project, 'published', 'تم نشر المشروع');
  };

  const hide = async (project: Property) => {
    const ok = await confirm({
      title: `إخفاء "${project.title}" من الموقع؟`,
      message: 'سيختفي المشروع من الموقع والخريطة فوراً، ويبقى متاحاً للتعديل هنا. يمكنك نشره مرة أخرى في أي وقت.',
      confirmLabel: 'إخفاء المشروع',
      danger: true,
      rememberKey: 'project.publish',
    });
    if (ok) await apply(project, 'hidden', 'تم إخفاء المشروع من الموقع');
  };

  return { publish, hide, busyId };
}
