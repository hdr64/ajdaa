/**
 * Presentational fragments shared by the three users layouts, so a card, a list
 * row and a table row all describe an account the same way (same avatar, same
 * status colours, same action guards).
 */
import React from 'react';
import { CheckCircle2, KeyRound, Lock, LogIn, LogOut, MailCheck, Pencil, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import type { AdminPermissions, AdminStatus, AdminUser } from '../../../types/admin';
import {
  PERMISSION_KEYS,
  countPermissions,
  userStatusLabel,
} from './usersModel';
import type { UserRights } from './usersModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

export const UserAvatar: React.FC<{
  user: { name: string; avatar?: string | null };
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}> = ({ user, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-10 h-10 rounded-xl text-sm',
    lg: 'w-14 h-14 rounded-2xl text-base',
    xl: 'w-24 h-24 rounded-3xl text-2xl',
  }[size];

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        className={`${sizeClasses} object-cover shrink-0 border border-muted-border/40 shadow-xs ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} brand-fill text-canvas font-black flex items-center justify-center shrink-0 shadow-xs ${className}`}
    >
      {user.name.slice(0, 1)}
    </div>
  );
};

const CHIP_BASE =
  'text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap inline-flex items-center gap-1';

const CHIP_TONE: Record<AdminStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  suspended: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export const StatusChip: React.FC<{ status: AdminStatus; className?: string }> = ({ status, className = '' }) => (
  <span className={`${CHIP_BASE} ${CHIP_TONE[status]} ${className}`}>{userStatusLabel(status)}</span>
);

/** Shown next to the status chip when the account has authenticator-app 2FA on. */
export const TotpChip: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useAdminT();
  return (
    <span className={`${CHIP_BASE} bg-accent/10 text-accent border-accent/20 ${className}`}>
      <ShieldCheck className="w-3 h-3" />
      {t('users.totpChip')}
    </span>
  );
};

/** Shown next to the status chip when the account has passkeys registered. */
export const PasskeyChip: React.FC<{ count?: number; className?: string }> = ({ count, className = '' }) => {
  const { t } = useAdminT();
  return (
    <span
      className={`${CHIP_BASE} bg-amber-500/10 text-amber-500 border-amber-500/20 ${className}`}
      title={t('users.passkeyChipTitle', { count: count || 1 })}
    >
      <KeyRound className="w-3 h-3" />
      <span>{count && count > 1 ? t('users.passkeyChipCount', { count }) : t('users.passkeyChipSingle')}</span>
    </span>
  );
};

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
  const { t } = useAdminT();
  const granted = PERMISSION_KEYS.filter((key) => permissions[key]);
  if (granted.length === 0) {
    return (
      <span className="text-[10px] text-neutral-text/50">
        {isSuperAdmin ? t('users.allPermissionsRole') : t('users.noPermissionsReadOnly')}
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
  const { t } = useAdminT();
  const count = countPermissions(permissions);
  if (count === 0) return <span className="text-neutral-text/45">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-heading">
      <span className="font-bold tabular-nums">{count}</span>
      <span className="text-[10px] text-neutral-text/50">
        {t('users.permissionsCountOf', { count: '', total: PERMISSION_KEYS.length }).trim()}
      </span>
    </span>
  );
};

interface UserActionsProps {
  user: AdminUser;
  rights: UserRights;
  onEdit: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
  onResendVerification: (user: AdminUser) => void;
  onMarkVerified: (user: AdminUser) => void;
  onResetTotp: (user: AdminUser) => void;
  onResetPasskeys: (user: AdminUser) => void;
  /** `labels` for cards, `icons` for the dense table and list rows. */
  variant: 'labels' | 'icons';
}

const ICON_BUTTON =
  'p-1.5 rounded-lg border border-muted-border/40 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

const LABEL_BUTTON =
  'flex-1 py-1.5 rounded-lg border font-bold text-[11px] transition flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * Edit / activate-suspend / delete with the server's guards baked in: a blocked
 * action stays visible but disabled, and its title says why. Pending accounts
 * also get a resend-verification action — they cannot be activated from here,
 * because the server only accepts activation through the emailed link.
 */
export const UserActions: React.FC<UserActionsProps> = ({
  user,
  rights,
  onEdit,
  onToggleStatus,
  onDelete,
  onResendVerification,
  onMarkVerified,
  onResetTotp,
  onResetPasskeys,
  variant,
}) => {
  const { t } = useAdminT();
  const suspending = user.status === 'active';
  const toggleLabel = suspending ? t('users.suspendAccount') : t('users.activateAccount');
  const labelled = variant === 'labels';

  const editButton = (
    <button
      type="button"
      onClick={() => onEdit(user)}
      disabled={!rights.canEdit}
      title={rights.editHint ?? t('users.editHint')}
      aria-label={`${t('users.edit')} ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-muted-border/40 hover:border-accent text-neutral-text/70 hover:text-accent bg-surface/50`
          : `${ICON_BUTTON} text-neutral-text/60 hover:text-accent hover:bg-accent/10`
      }
    >
      <Pencil className="w-3 h-3" />
      {labelled && <span>{t('users.edit')}</span>}
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
      {labelled && <span>{suspending ? t('users.suspend') : t('users.activate')}</span>}
    </button>
  );

  /** A pending account can only be activated through the emailed link it never used. */
  const resendButton = (
    <button
      type="button"
      onClick={() => onResendVerification(user)}
      title={t('users.resendVerificationHint')}
      aria-label={t('users.resendVerificationHint')}
      className={
        labelled
          ? `${LABEL_BUTTON} border-muted-border/40 hover:border-accent text-neutral-text/70 hover:text-accent bg-surface/50`
          : `${ICON_BUTTON} text-neutral-text/60 hover:text-accent hover:bg-accent/10`
      }
    >
      <MailCheck className="w-3 h-3" />
      {labelled && <span>{t('users.resendVerification')}</span>}
    </button>
  );

  /** Skips the email proof and marks a pending account as verified directly. */
  const markVerifiedButton = (
    <button
      type="button"
      onClick={() => onMarkVerified(user)}
      disabled={!rights.canMarkVerified}
      title={rights.markVerifiedHint ?? t('users.markVerifiedHint')}
      aria-label={`${t('users.markVerified')}: ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-accent/30 text-accent hover:bg-accent/10`
          : `${ICON_BUTTON} text-accent hover:bg-accent/10`
      }
    >
      <CheckCircle2 className="w-3 h-3" />
      {labelled && <span>{t('users.markVerified')}</span>}
    </button>
  );

  /** Clears the account's authenticator-app 2FA, for a lost or replaced phone. */
  const resetTotpButton = (
    <button
      type="button"
      onClick={() => onResetTotp(user)}
      disabled={!rights.canResetTotp}
      title={rights.resetTotpHint ?? t('users.resetTotpHint')}
      aria-label={`${t('users.resetTotpHint')}: ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-amber-500/30 text-amber-600 hover:bg-amber-500/10`
          : `${ICON_BUTTON} text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10`
      }
    >
      <ShieldOff className="w-3 h-3" />
      {labelled && <span>{t('users.resetTotp')}</span>}
    </button>
  );

  /** Clears the account's passkeys for lost devices. */
  const resetPasskeysButton = (
    <button
      type="button"
      onClick={() => onResetPasskeys(user)}
      disabled={!rights.canResetPasskeys}
      title={rights.resetPasskeysHint ?? t('users.resetPasskeysHint')}
      aria-label={`${t('users.resetPasskeysHint')}: ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-amber-500/30 text-amber-600 hover:bg-amber-500/10`
          : `${ICON_BUTTON} text-amber-500/80 hover:text-amber-500 hover:bg-amber-500/10`
      }
    >
      <KeyRound className="w-3 h-3" />
      {labelled && <span>{t('users.resetPasskeys')}</span>}
    </button>
  );

  const deleteButton = (
    <button
      type="button"
      onClick={() => onDelete(user)}
      disabled={!rights.canDelete}
      title={rights.deleteHint ?? t('users.deleteHint')}
      aria-label={`${t('users.delete')} ${user.name}`}
      className={
        labelled
          ? `${LABEL_BUTTON} border-red-500/30 text-red-500 hover:bg-red-500/10`
          : `${ICON_BUTTON} text-neutral-text/40 hover:text-red-400 hover:bg-red-500/10`
      }
    >
      <Trash2 className="w-3 h-3" />
      {labelled && <span>{t('users.delete')}</span>}
    </button>
  );

  if (labelled) {
    return (
      <div className="flex items-center gap-2">
        {editButton}
        {user.status === 'pending' && rights.canMarkVerified && markVerifiedButton}
        {user.status === 'pending' && resendButton}
        {user.totpEnabled && resetTotpButton}
        {Boolean(user.passkeyCount && user.passkeyCount > 0) && resetPasskeysButton}
        {toggleButton}
        {deleteButton}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {editButton}
      {user.status === 'pending' && rights.canMarkVerified && markVerifiedButton}
      {user.status === 'pending' && resendButton}
      {user.totpEnabled && resetTotpButton}
      {Boolean(user.passkeyCount && user.passkeyCount > 0) && resetPasskeysButton}
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
