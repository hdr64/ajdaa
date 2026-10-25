/**
 * Presentational fragments shared by the roles card and the roles table, so a
 * card and a row describe the same role the same way (same key typography, same
 * system badge, same permission chips).
 */
import React from 'react';
import { ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { Role } from '../../../types/admin';
import { roleUserCount, type PermissionKey } from './rolesModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

const CHIP =
  'text-[9px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 border whitespace-nowrap';

export const RoleKeyText: React.FC<{ roleKey: string }> = ({ roleKey }) => (
  <span dir="ltr" className="font-mono text-[10px] text-neutral-text/60 bg-canvas/70 border border-muted-border/30 rounded-md px-1.5 py-0.5">
    {roleKey}
  </span>
);

/** A built-in role can be renamed but never re-scoped, which the badge states up front. */
export const RoleTypeBadge: React.FC<{ isSystem: boolean }> = ({ isSystem }) => {
  const { t } = useAdminT();
  return isSystem ? (
    <span
      title={t('roles.systemTitle')}
      className={`${CHIP} bg-slate-500/10 text-slate-500 border-slate-500/25`}
    >
      <ShieldCheck className="w-2.5 h-2.5" />
      {t('roles.typeSystem')}
    </span>
  ) : (
    <span title={t('roles.customTitle')} className={`${CHIP} bg-accent/10 text-accent border-accent/20`}>
      <Sparkles className="w-2.5 h-2.5" />
      {t('roles.typeCustom')}
    </span>
  );
};

export const RoleUserCount: React.FC<{ role: Role }> = ({ role }) => {
  const { t, isEn } = useAdminT();
  const count = roleUserCount(role);
  const userUnit = isEn && count > 1 ? t('roles.userCountPlural') : t('roles.userCountLabel');
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-text/60">
      <Users className="w-3 h-3" />
      <span className="tabular-nums text-heading">{count}</span>
      <span>{userUnit}</span>
    </span>
  );
};

interface RolePermissionChipsProps {
  role: Role;
  labels: Record<PermissionKey, string>;
  /** Compact drops the padding for the dense table cell. */
  compact?: boolean;
}

export const RolePermissionChips: React.FC<RolePermissionChipsProps> = ({ role, labels, compact = false }) => {
  const { t } = useAdminT();
  if (role.permissions.length === 0) {
    return <span className="text-[10px] text-neutral-text/50">{t('roles.noPermissionsRole')}</span>;
  }
  return (
    <>
      {role.permissions.map((key) => (
        <span key={key} className={`${CHIP} bg-surface border-muted-border/40 text-heading ${compact ? 'px-1.5' : ''}`}>
          {labels[key] ?? key}
        </span>
      ))}
    </>
  );
};
