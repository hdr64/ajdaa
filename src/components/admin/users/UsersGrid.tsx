/**
 * Grid layout: the card design the section is known for, laid out in 2/3/4
 * columns. Identical content to the other views, so a card reads exactly like the
 * matching table row.
 */
import React from 'react';
import type { AdminPermissions, Role } from '../../../types/admin';
import type { GridColumns } from '../common/viewModes';
import { gridColumnsClass } from '../common/viewModes';
import { lastActiveLabel, userDepartmentLabel, userRoleLabel, isSuperAdminAccount } from './usersModel';
import type { UserViewProps } from './usersModel';
import { LockNote, PermissionPills, StatusChip, UserActions, UserAvatar } from './usersUi';

interface UsersGridProps extends UserViewProps {
  roles: Role[];
  columns: GridColumns;
  permissionLabels: Record<keyof AdminPermissions, string>;
}

export const UsersGrid: React.FC<UsersGridProps> = ({
  users,
  roles,
  columns,
  rightsById,
  permissionLabels,
  onEdit,
  onToggleStatus,
  onDelete,
}) => (
  <div className={`grid gap-4 ${gridColumnsClass(columns)}`}>
    {users.map((user) => {
      const rights = rightsById.get(user.id);
      return (
        <div
          key={user.id}
          className="p-5 rounded-2xl bg-surface border border-muted-border/40 flex flex-col justify-between hover:border-accent/40 transition-all shadow-xs"
        >
          <div>
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar user={user} />
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-heading truncate flex items-center gap-1.5">
                    {user.name}
                    {rights?.isSelf && (
                      <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 rounded-full px-1.5 py-px shrink-0">
                        أنت
                      </span>
                    )}
                  </h4>
                  <span className="text-[10px] text-neutral-text/60 font-mono block truncate" dir="ltr">
                    {user.email}
                  </span>
                </div>
              </div>

              <StatusChip status={user.status} className="shrink-0" />
            </div>

            <div className="text-[11px] p-2.5 rounded-xl bg-canvas/60 border border-muted-border/30 space-y-1 mb-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-text/50 text-[10px]">الدور:</span>
                <span className="font-bold text-accent truncate">{userRoleLabel(user, roles)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-text/50 text-[10px]">القسم:</span>
                <span className="font-bold text-heading truncate">{userDepartmentLabel(user)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-neutral-text/50 text-[10px]">آخر نشاط:</span>
                <span className="text-neutral-text/60 truncate">{lastActiveLabel(user)}</span>
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <span className="text-[10px] font-bold text-neutral-text/50 block">الصلاحيات الممنوحة:</span>
              <div className="flex flex-wrap gap-1">
                <PermissionPills
                  permissions={user.permissions}
                  labels={permissionLabels}
                  isSuperAdmin={isSuperAdminAccount(user)}
                />
              </div>
            </div>

            {rights?.lockReason && <LockNote reason={rights.lockReason} />}
          </div>

          {rights && (
            <div className="flex items-center gap-2 pt-3 border-t border-muted-border/20 mt-3">
              <UserActions
                user={user}
                rights={rights}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                variant="labels"
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);
