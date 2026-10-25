/**
 * Table layout: one row per role with client-side search, filtering and sorting
 * over the already-loaded list — the component fetches nothing.
 */
import React, { useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { Role } from '../../../types/admin';
import { DataTable } from '../common/DataTable';
import type { Column } from '../common/dataTableTypes';
import { getRoleRights, roleUserCount, type PermissionKey, type RoleRights } from './rolesModel';
import { RoleKeyText, RolePermissionChips, RoleTypeBadge, RoleUserCount } from './rolesUi';
import { ActionButton, ICON_BUTTON_ACCENT, ICON_BUTTON_DANGER } from './ActionButton';

export const ROLES_TABLE_STORAGE_KEY = 'ajda.admin.roles';

const TYPE_OPTIONS = [
  { value: 'system', label: 'أدوار نظامية' },
  { value: 'custom', label: 'أدوار مخصصة' },
] as const;

const typeValue = (role: Role): string => (role.isSystem ? 'system' : 'custom');

interface RolesTableProps {
  roles: Role[];
  labels: Record<PermissionKey, string>;
  isSuperAdmin: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export const RolesTable: React.FC<RolesTableProps> = ({ roles, labels, isSuperAdmin, onEdit, onDelete }) => {
  const columns = useMemo<Column<Role>[]>(
    () => [
      {
        id: 'name',
        header: 'الدور',
        width: '220px',
        sortValue: (role) => role.nameAr,
        filter: { type: 'text', value: (role) => `${role.nameAr} ${role.nameEn}` },
        cell: (role) => (
          <div className="min-w-0">
            <span className="font-bold text-heading block truncate">{role.nameAr}</span>
            <span dir="ltr" className="text-[10px] text-neutral-text/60 block truncate">
              {role.nameEn}
            </span>
          </div>
        ),
      },
      {
        id: 'key',
        header: 'المفتاح',
        width: '150px',
        sortValue: (role) => role.key,
        cell: (role) => <RoleKeyText roleKey={role.key} />,
      },
      {
        id: 'type',
        header: 'النوع',
        width: '120px',
        sortValue: typeValue,
        filter: { type: 'select', options: TYPE_OPTIONS, value: typeValue },
        cell: (role) => <RoleTypeBadge isSystem={role.isSystem} />,
      },
      {
        id: 'users',
        header: 'المستخدمون',
        width: '120px',
        align: 'end',
        sortValue: (role) => roleUserCount(role),
        cell: (role) => <RoleUserCount role={role} />,
      },
      {
        id: 'permissions',
        header: 'الصلاحيات',
        width: '280px',
        sortValue: (role) => role.permissions.length,
        cell: (role) => (
          <div className="flex flex-wrap gap-1">
            <RolePermissionChips role={role} labels={labels} compact />
          </div>
        ),
      },
    ],
    [labels]
  );

  return (
    <DataTable
      storageKey={ROLES_TABLE_STORAGE_KEY}
      rows={roles}
      getRowId={(role) => role.id}
      columns={columns}
      searchText={(role) => `${role.nameAr} ${role.nameEn} ${role.key} ${role.description ?? ''}`}
      initialSort={{ columnId: 'name', direction: 'asc' }}
      rowActions={(role) => (
        <RoleRowActions role={role} isSuperAdmin={isSuperAdmin} onEdit={onEdit} onDelete={onDelete} />
      )}
    />
  );
};

interface RoleRowActionsProps {
  role: Role;
  isSuperAdmin: boolean;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

const RoleRowActions: React.FC<RoleRowActionsProps> = ({ role, isSuperAdmin, onEdit, onDelete }) => {
  const rights: RoleRights = getRoleRights(role, isSuperAdmin);
  return (
    <div className="flex items-center justify-end gap-1.5">
      <ActionButton
        label={`تعديل دور ${role.nameAr}`}
        lockedReason={rights.editHint}
        hint="تعديل الدور"
        onClick={() => onEdit(role)}
        icon={<Pencil className="w-3 h-3" />}
        className={ICON_BUTTON_ACCENT}
      />
      <ActionButton
        label={`حذف دور ${role.nameAr}`}
        lockedReason={rights.deleteHint}
        hint="حذف الدور"
        onClick={() => onDelete(role)}
        icon={<Trash2 className="w-3 h-3" />}
        className={ICON_BUTTON_DANGER}
      />
    </div>
  );
};
