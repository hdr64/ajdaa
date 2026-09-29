/**
 * Table layout: one row per account with server-side-free filtering, sorting,
 * selection and bulk status changes. All of it runs on the already-loaded list —
 * the component fetches nothing.
 */
import React, { useMemo } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import type { AdminStatus, AdminUser, Department, Role } from '../../../types/admin';
import { DataTable } from '../common/DataTable';
import type { BulkAction, Column } from '../common/dataTableTypes';
import {
  STATUS_OPTIONS,
  buildDepartmentIndex,
  buildRoleIndex,
  countPermissions,
  lastActiveLabel,
  userRoleLabel,
  userSearchText,
} from './usersModel';
import type { UserRights } from './usersModel';
import { PermissionCount, RolePill, StatusChip, UserActions } from './usersUi';

export const USERS_TABLE_STORAGE_KEY = 'ajda.admin.users';

/** A row can only be missing from the index if it arrived with the last refresh. */
const FALLBACK_RIGHTS: UserRights = {
  canEdit: false,
  editHint: 'بيانات الحساب غير متاحة',
  accessLocked: true,
  lockReason: null,
  canToggleStatus: false,
  toggleHint: 'بيانات الحساب غير متاحة',
  canDelete: false,
  deleteHint: 'بيانات الحساب غير متاحة',
  isSelf: false,
};

interface UsersTableProps {
  users: AdminUser[];
  roles: Role[];
  departments: Department[];
  rightsById: Map<string, UserRights>;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onBulkStatus: (users: AdminUser[], status: AdminStatus) => void;
}

export const UsersTable: React.FC<UsersTableProps> = ({
  users,
  roles,
  departments,
  rightsById,
  onEdit,
  onToggleStatus,
  onDelete,
  onBulkStatus,
}) => {
  const roleIndex = useMemo(() => buildRoleIndex(users, roles), [users, roles]);
  const departmentIndex = useMemo(() => buildDepartmentIndex(users, departments), [users, departments]);

  const columns = useMemo<Column<AdminUser>[]>(
    () => [
      {
        id: 'user',
        header: 'المستخدم',
        width: '210px',
        sortValue: (user) => user.name,
        cell: (user) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[10px] font-black text-heading truncate">{user.name}</span>
              {rightsById.get(user.id)?.isSelf && (
                <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 rounded-full px-1.5 py-px shrink-0">
                  أنت
                </span>
              )}
            </div>
            <span className="text-[10px] text-neutral-text/60 font-mono block truncate" dir="ltr">
              {user.email}
            </span>
          </div>
        ),
      },
      {
        id: 'role',
        header: 'الدور',
        width: '170px',
        sortValue: (user) => userRoleLabel(user, roles),
        filter: { type: 'select', options: roleIndex.options, value: (user) => roleIndex.keyByUserId.get(user.id) ?? '' },
        cell: (user) => <RolePill label={userRoleLabel(user, roles)} />,
      },
      {
        id: 'department',
        header: 'القسم',
        width: '150px',
        sortValue: (user) => user.departmentName || user.department || '',
        filter: {
          type: 'select',
          options: departmentIndex.options,
          value: (user) => departmentIndex.keyByUserId.get(user.id) ?? '',
        },
        cell: (user) => (
          <span className="text-[11px] font-bold text-heading">{user.departmentName || user.department || '—'}</span>
        ),
      },
      {
        id: 'status',
        header: 'الحالة',
        width: '110px',
        sortValue: (user) => user.status,
        filter: { type: 'select', options: STATUS_OPTIONS, value: (user) => user.status },
        cell: (user) => <StatusChip status={user.status} />,
      },
      {
        id: 'permissions',
        header: 'الصلاحيات',
        width: '110px',
        sortValue: (user) => countPermissions(user.permissions),
        cell: (user) => <PermissionCount permissions={user.permissions} />,
      },
      {
        id: 'lastActive',
        header: 'آخر نشاط',
        width: '150px',
        sortValue: (user) => (user.lastLogin ? new Date(user.lastLogin) : null),
        cell: (user) => <span className="text-[10px] text-neutral-text/60 whitespace-nowrap">{lastActiveLabel(user)}</span>,
      },
    ],
    [rightsById, roleIndex, departmentIndex, roles]
  );

  const bulkActions = useMemo<BulkAction<AdminUser>[]>(
    () => [
      {
        id: 'activate',
        label: 'تنشيط',
        icon: LogIn,
        onRun: (rows) => onBulkStatus(rows, 'active'),
      },
      {
        id: 'suspend',
        label: 'تعطيل',
        icon: LogOut,
        danger: true,
        onRun: (rows) => onBulkStatus(rows, 'suspended'),
      },
    ],
    [onBulkStatus]
  );

  return (
    <DataTable
      storageKey={USERS_TABLE_STORAGE_KEY}
      rows={users}
      getRowId={(user) => user.id}
      columns={columns}
      searchText={userSearchText}
      initialSort={{ columnId: 'lastActive', direction: 'desc' }}
      selectable
      bulkActions={bulkActions}
      rowActions={(user) => (
        <UserActions
          user={user}
          rights={rightsById.get(user.id) ?? FALLBACK_RIGHTS}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
          variant="icons"
        />
      )}
    />
  );
};
