/**
 * Presentational fragments shared by the three users layouts, so a card, a list
 * row and a table row all describe an account the same way (same avatar, same
 * status colours, same action guards).
 */
import React from 'react';
import { CheckCircle2, Lock, LogIn, LogOut, Pencil, Trash2 } from 'lucide-react';
import type { AdminPermissions, AdminStatus, AdminUser } from '../../../types/admin';
import {
  PERMISSION_KEYS,
  STATUS_LABELS,
  countPermissions,
} from './usersModel';
import type { UserRights } from './usersModel';

export const UserAvatar: React.FC<{ user: AdminUser }> = ({ user }) => (
  <div className="w-10 h-10 rounded-xl brand-fill text-canvas font-black flex items-center justify-center text-sm shrink-0">
    {user.name.slice(0, 1)}
  </div>
);

const CHIP_BASE =
  'text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap inline-flex items-center gap-1';

const CHIP_TONE: Record<AdminStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export const StatusChip: React.FC<{ status: AdminStatus; className?: string }> = ({ status, className = '' }) => (
  <span className={`${CHIP_BASE} ${CHIP_TONE[status]} ${className}`}>{STATUS_LABELS[status]}</span>
);

export const RolePill: React.FC<{ label: string }> = ({ label }) => (
  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 whitespace-nowrap inline-block">
    {label}
  </span>
);

/** The permission pills the cards are known for; the count feeds the compact views. */
export const PermissionPills: React.FC<{
  permissions: AdminPermissions;
  labels: Record<keyof AdminPermissions, string>;
  isSuperAdmin: boolean;
}> = ({ permissions, labels, isSuperAdmin }) => {
  const granted = PERMISSION_KEYS.filter((key) => permissions[key]);
  if (granted.length === 0) {
    return (
      <span className="text-[10px] text-neutral-text/50">
        {isSuperAdmin ? 'يملك كل الصلاحيات بحكم الدور' : 'لا توجد صلاحيات — عرض فقط'}
      </span>
    );
  }
  return (
    <>
      {granted.map((key) => (
        <span
          key={key}
          className="text-[9px] font-bold px-2 py-0.5 rounded bg-surface border border-muted-border/40 text-heading flex items-center gap-1"
        >
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
          {labels[key]}
        </span>
      ))}
    </>
  );
};

export const PermissionCount: React.FC<{ permissions: AdminPermissions }> = ({ permissions }) => {
  const count = countPermissions(permissions);
  if (count === 0) return <span className="text-neutral-text/45">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-heading">
      <span className="font-bold tabular-nums">{count}</span>
      <span className="text-[10px] text-neutral-text/50">من {PERMISSION_KEYS.length}</span>
    </span>
  );
};

interface UserActionsProps {
  user: AdminUser;
  rights: UserRights;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  /** `labels` for cards, `icons` for the dense table and list rows. */
  variant: 'labels' | 'icons';
}

const ICON_BUTTON =
  'p-1.5 rounded-lg border border-muted-border/40 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

const LABEL_BUTTON =
  'flex-1 py-1.5 rounded-lg border font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Edit / activate-suspend / delete with the server's guards baked in: a blocked
 * action stays visible but disabled, and its title says why.
 */
export const UserActions: React.FC<UserActionsProps> = ({
  user,
  rights,
  onEdit,
  onToggleStatus,
  onDelete,
  variant,
}) => {
  const suspending = user.status === 'active';
  const toggleLabel = suspending ? 'تعطيل الحساب' : 'تنشيط الحساب';
  const labelled = variant === 'labels';

  const editButton = (
    <button
      type="button"
      onClick={() => onEdit(user)}
      disabled={!rights.canEdit}
      title={rights.editHint ?? 'تعديل البيانات والصلاحيات'}
      aria-label={`تعديل ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-muted-border/40 hover:border-accent text-neutral-text/70 hover:text-accent bg-surface/50`
          : `${ICON_BUTTON} text-neutral-text/60 hover:text-accent hover:bg-accent/10`
      }
    >
      <Pencil className="w-3 h-3" />
      {labelled && <span>تعديل</span>}
    </button>
  );

  const toggleButton = (
    <button
      type="button"
      onClick={() => onToggleStatus(user)}
      disabled={!rights.canToggleStatus}
      title={rights.toggleHint ?? toggleLabel}
      aria-label={`${toggleLabel}: ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} ${
              suspending
                ? 'border-red-500/30 text-red-500 hover:bg-red-500/10'
                : 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10'
            }`
          : suspending
            ? `${ICON_BUTTON} text-neutral-text/60 hover:text-red-400 hover:bg-red-500/10`
            : `${ICON_BUTTON} text-emerald-500/80 hover:text-emerald-500 hover:bg-emerald-500/10`
      }
    >
      {suspending ? <LogOut className="w-3 h-3" /> : <LogIn className="w-3 h-3" />}
      {labelled && <span>{suspending ? 'تعطيل' : 'تنشيط'}</span>}
    </button>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={() => onDelete(user)}
      disabled={!rights.canDelete}
      title={rights.deleteHint ?? 'حذف الحساب'}
      aria-label={`حذف ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-red-500/30 text-red-500 hover:bg-red-500/10`
          : `${ICON_BUTTON} text-neutral-text/40 hover:text-red-400 hover:bg-red-500/10`
      }
    >
      <Trash2 className="w-3 h-3" />
      {labelled && <span>حذف</span>}
    </button>
  );

  if (labelled) {
    return (
      <div className="flex items-center gap-2">
        {editButton}
        {toggleButton}
        {deleteButton}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {editButton}
      {toggleButton}
      {deleteButton}
    </div>
  );
};

/** Amber note explaining why the account is read-only, shown instead of a lock icon. */
export const LockNote: React.FC<{ reason: string }> = ({ reason }) => (
  <p className="mt-1.5 flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
    <Lock className="w-3 h-3 mt-px shrink-0" />
    <span>{reason}</span>
  </p>
);
