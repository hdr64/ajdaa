import React, { useEffect } from 'react';
import { Layers } from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { BuildingVisualizer } from '../../../components/admin/BuildingVisualizer';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';

export const UnitsSection: React.FC = () => {
  const { projects, location, navigate, showToast, can } = useAdmin();

  const selected = projects.data.find((p) => p.id === location.projectId) ?? null;

  // Without a (valid) project in the URL, pin the first project into it so the
  // address always says what is on screen.
  useEffect(() => {
    if (projects.loading || projects.data.length === 0) return;
    if (!selected) navigate({ section: 'units', projectId: projects.data[0].id }, { replace: true });
  }, [projects.loading, projects.data, selected, navigate]);

  const picker = projects.data.length > 0 && (
    <AdminHeaderActions>
      <select
        value={selected?.id ?? ''}
        onChange={(e) => navigate({ section: 'units', projectId: Number(e.target.value) })}
        aria-label="اختيار المشروع"
        className="max-w-[11rem] sm:max-w-xs px-3 py-2.5 rounded-xl bg-canvas border border-muted-border/50 font-bold text-xs text-heading outline-none cursor-pointer focus:border-accent"
      >
        {projects.data.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </AdminHeaderActions>
  );

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

  return (
    <div className="space-y-6">
      {picker}
      {selected ? (
        <BuildingVisualizer
          project={selected}
          onProjectUpdate={async () => {
            await projects.reload();
          }}
          onShowToast={showToast}
          canEdit={can('manageUnits')}
        />
      ) : (
        <SectionLoading />
      )}
    </div>
  );
};
