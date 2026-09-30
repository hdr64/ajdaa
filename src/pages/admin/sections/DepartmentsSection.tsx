/**
 * Departments: the HR structure the user accounts belong to. A department is
 * referenced by every account that carries it, so deletion is only offered while
 * it is empty and the server enforces the same rule.
 */
import React, { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import type { Department } from '../../../types/admin';
import { AdminStorage } from '../../../services/adminStorage';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { useAdmin } from '../adminContextDef';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { DepartmentsTable } from '../../../components/admin/hr/DepartmentsTable';
import { DepartmentFormDialog } from '../../../components/admin/hr/DepartmentFormDialog';
import { DEPARTMENT_DELETE_ERROR, hrErrorMessage } from '../../../components/admin/hr/rolesModel';

const NEW_DEPARTMENT_BUTTON =
  'brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs';

export const DepartmentsSection: React.FC = () => {
  const { showToast, confirmDelete } = useAdmin();

  const departments = useAsyncData<Department[]>(
    useCallback((signal) => AdminStorage.listDepartments(signal), []),
    [],
    []
  );

  /** `null` closes the dialog; `{ department: null }` creates, `{ department }` edits. */
  const [dialog, setDialog] = useState<{ department: Department | null } | null>(null);

  const deleteDepartment = useCallback(
    async (department: Department) => {
      const ok = await confirmDelete({
        title: `حذف القسم "${department.nameAr}"؟`,
        message: 'لن يظهر هذا القسم في قائمة أقسام المستخدمين بعد الآن. لا يمكن التراجع عن ذلك.',
        confirmLabel: 'حذف القسم',
      });
      if (!ok) return;
      try {
        await AdminStorage.deleteDepartment(department.id);
        await departments.reload();
        showToast(`تم حذف القسم ${department.nameAr}`);
      } catch (error) {
        showToast(hrErrorMessage(error, 'تعذر حذف القسم', DEPARTMENT_DELETE_ERROR));
      }
    },
    [confirmDelete, departments, showToast]
  );

  const header = (
    <AdminHeaderActions>
      <button type="button" onClick={() => setDialog({ department: null })} className={NEW_DEPARTMENT_BUTTON}>
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">قسم جديد</span>
      </button>
    </AdminHeaderActions>
  );

  const dialogNode = dialog && (
    <DepartmentFormDialog
      department={dialog.department}
      showToast={showToast}
      onClose={() => setDialog(null)}
      onSaved={departments.reload}
    />
  );

  if (departments.error && departments.data.length === 0) {
    return (
      <>
        {header}
        <SectionError message={departments.error} onRetry={() => void departments.reload()} />
      </>
    );
  }
  if (departments.loading && departments.data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label="جاري تحميل الأقسام..." />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}
      <DepartmentsTable
        departments={departments.data}
        onEdit={(department) => setDialog({ department })}
        onDelete={(department) => void deleteDepartment(department)}
        onCreate={() => setDialog({ department: null })}
      />
      {dialogNode}
    </div>
  );
};
