/**
 * Table layout: one row per department with its Arabic and English names and how
 * many members it holds. Deletion is offered only on an empty department, with
 * the reason on the disabled button.
 */
import React, { useMemo } from 'react';
import { Building, Pencil, Trash2, Users } from 'lucide-react';
import type { Department } from '../../../types/admin';
import { DataTable } from '../common/DataTable';
import type { Column } from '../common/dataTableTypes';
import { EmptyState } from '../common/EmptyState';
import { ActionButton, ICON_BUTTON_ACCENT, ICON_BUTTON_DANGER } from './ActionButton';
import { useAdminT } from '../../../i18n/admin/useAdminT';

export const DEPARTMENTS_TABLE_STORAGE_KEY = 'ajda.admin.departments';

const userCountOf = (department: Department): number => department.userCount ?? 0;

interface DepartmentsTableProps {
  departments: Department[];
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
  onCreate: () => void;
}

export const DepartmentsTable: React.FC<DepartmentsTableProps> = ({
  departments,
  onEdit,
  onDelete,
  onCreate,
}) => {
  const { t, isEn } = useAdminT();

  const inUseHint = (department: Department): string | null => {
    const count = userCountOf(department);
    return count > 0 ? t('departments.inUseHint', { count }) : null;
  };

  const columns = useMemo<Column<Department>[]>(
    () => [
      {
        id: 'nameAr',
        header: t('departments.colNameAr'),
        width: '240px',
        sortValue: (department) => department.nameAr,
        filter: { type: 'text', value: (department) => department.nameAr },
        cell: (department) => <span className="font-bold text-heading">{department.nameAr}</span>,
      },
      {
        id: 'nameEn',
        header: t('departments.colNameEn'),
        width: '200px',
        sortValue: (department) => department.nameEn ?? '',
        cell: (department) =>
          department.nameEn ? (
            <span dir="ltr" className="text-neutral-text/70">
              {department.nameEn}
            </span>
          ) : (
            <span className="text-neutral-text/40">—</span>
          ),
      },
      {
        id: 'users',
        header: t('departments.colUsers'),
        width: '130px',
        align: 'end',
        sortValue: (department) => userCountOf(department),
        cell: (department) => {
          const count = userCountOf(department);
          return (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                count > 0 ? 'text-accent' : 'text-neutral-text/45'
              }`}
            >
              <Users className="w-3 h-3" />
              <span className="tabular-nums">{count}</span>
            </span>
          );
        },
      },
    ],
    [t]
  );

  return (
    <DataTable
      storageKey={DEPARTMENTS_TABLE_STORAGE_KEY}
      rows={departments}
      getRowId={(department) => department.id}
      columns={columns}
      searchText={(department) => `${department.nameAr} ${department.nameEn ?? ''}`}
      initialSort={{ columnId: 'nameAr', direction: 'asc' }}
      emptyState={
        // While a search or filter is active DataTable explains the empty result
        // itself, so the "no departments yet" invite is reserved for a real empty list.
        departments.length === 0 ? (
          <EmptyState
            icon={Building}
            compact
            title={t('departments.emptyTitle')}
            description={t('departments.emptyDescription')}
            action={
              <button
                type="button"
                onClick={onCreate}
                className="brand-btn-primary px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                {t('departments.createFirst')}
              </button>
            }
          />
        ) : undefined
      }
      rowActions={(department) => {
        const hint = inUseHint(department);
        const name = isEn && department.nameEn ? department.nameEn : department.nameAr;
        return (
          <div className="flex items-center justify-end gap-1.5">
            <ActionButton
              label={t('departments.editDepartmentName', { name })}
              lockedReason={null}
              hint={t('departments.editDepartment')}
              onClick={() => onEdit(department)}
              icon={<Pencil className="w-3 h-3" />}
              className={ICON_BUTTON_ACCENT}
            />
            <ActionButton
              label={t('departments.deleteDepartmentName', { name })}
              lockedReason={hint}
              hint={t('departments.deleteDepartment')}
              onClick={() => onDelete(department)}
              icon={<Trash2 className="w-3 h-3" />}
              className={ICON_BUTTON_DANGER}
            />
          </div>
        );
      }}
    />
  );
};
