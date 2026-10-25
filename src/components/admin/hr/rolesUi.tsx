/**
 * Presentational fragments shared by the roles card and the roles table, so a
 * card and a row describe the same role the same way (same key typography, same
 * system badge, same permission chips).
 */
import React from 'react';
import { ShieldCheck, Sparkles, Users } from 'lucide-react';
import type { Role } from '../../../types/admin';
import { roleUserCount, type PermissionKey } from './rolesModel';

const CHIP =
  'text-[9px] font-bold px-2 py-0.5 rounded inline-flex items-center gap-1 border whitespace-nowrap';

export const RoleKeyText: React.FC<{ roleKey: string }> = ({ roleKey }) => (
  <span dir="ltr" className="font-mono text-[10px] text-neutral-text/60 bg-canvas/70 border border-muted-border/30 rounded-md px-1.5 py-0.5">
    {roleKey}
  </span>
);

/** A built-in role can be renamed but never re-scoped, which the badge states up front. */
export const RoleTypeBadge: React.FC<{ isSystem: boolean }> = ({ isSystem }) =>
  isSystem ? (
    <span
      title="دور نظامي مدمج في النظام"
      className={`${CHIP} bg-slate-500/10 text-slate-500 border-slate-500/25`}
    >
      <ShieldCheck className="w-2.5 h-2.5" />
      نظامي
    </span>
  ) : (
    <span title="دور أنشأه فريق الإدارة" className={`${CHIP} bg-accent/10 text-accent border-accent/20`}>
      <Sparkles className="w-2.5 h-2.5" />
      مخصص
    </span>
  );

export const RoleUserCount: React.FC<{ role: Role }> = ({ role }) => {
  const count = roleUserCount(role);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-text/60">
      <Users className="w-3 h-3" />
      <span className="tabular-nums text-heading">{count}</span>
      <span>مستخدم</span>
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
  if (role.permissions.length === 0) {
    return <span className="text-[10px] text-neutral-text/50">لا توجد صلاحيات — دور عرض فقط</span>;
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
