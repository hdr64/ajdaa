/**
 * List ("stack") layout: one full-width row per account, read top to bottom.
 * Everything is inline on wide screens so the eye can compare accounts without
 * moving between cards, and it collapses to a stacked block on phones.
 */
import React from 'react';
import type { Role } from '../../../types/admin';
import { lastActiveLabel, userDepartmentLabel, userRoleLabel } from './usersModel';
import type { UserViewProps } from './usersModel';
import {
  LockNote,
  PermissionCount,
  RolePill,
  StatusChip,
  UserActions,
  UserAvatar,
} from './usersUi';

interface UsersListProps extends UserViewProps {
  roles: Role[];
}

const META_LABEL = 'text-[10px] text-neutral-text/50 shrink-0';

export const UsersList: React.FC<UsersListProps> = ({
  users,
  roles,
  rightsById,
  onEdit,
  onToggleStatus,
  onDelete,
}) => (
  <div className="rounded-2xl bg-surface border border-muted-border/40 shadow-xs overflow-hidden divide-y divide-muted-border/20">
    {users.map((user) => {
      const rights = rightsById.get(user.id);
      return (
        <article key={user.id} className="p-4 flex flex-col xl:flex-row xl:items-center gap-3 xl:gap-4 hover:bg-surface-hover/40 transition-colors">
          <div className="flex items-center gap-3 min-w-0 xl:w-64">
            <UserAvatar user={user} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h4 className="text-xs font-black text-heading truncate">{user.name}</h4>
                {rights?.isSelf && (
                  <span className="text-[9px] font-bold text-accent bg-accent/10 border border-accent/20 rounded-full px-1.5 py-px shrink-0">
                    أنت
                  </span>
                )}
              </div>
              <span className="text-[10px] text-neutral-text/60 font-mono block truncate" dir="ltr">
                {user.email}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 flex-1 min-w-0 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={META_LABEL}>الدور:</span>
              <RolePill label={userRoleLabel(user, roles)} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={META_LABEL}>القسم:</span>
              <span className="font-bold text-heading truncate">{userDepartmentLabel(user)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={META_LABEL}>الصلاحيات:</span>
              <PermissionCount permissions={user.permissions} />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={META_LABEL}>آخر نشاط:</span>
              <span className="text-neutral-text/60 truncate">{lastActiveLabel(user)}</span>
            </div>
            {rights?.lockReason && <LockNote reason={rights.lockReason} />}
          </div>

          <div className="flex items-center gap-2 xl:shrink-0">
            <StatusChip status={user.status} />
            {rights && (
              <UserActions
                user={user}
                rights={rights}
                onEdit={onEdit}
                onToggleStatus={onToggleStatus}
                onDelete={onDelete}
                variant="icons"
              />
            )}
          </div>
        </article>
      );
    })}
  </div>
);
