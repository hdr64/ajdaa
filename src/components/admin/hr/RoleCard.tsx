/**
 * Card layout: one role per card, the view the section defaults to. Shows the
 * same facts as the table row — Arabic and English names, the immutable key, the
 * system badge, the user count and the permission chips — with the server's
 * guards baked into the action buttons.
 */
import React from 'react';
import { KeyRound, Pencil, Trash2 } from 'lucide-react';
import type { Role } from '../../../types/admin';
import type { PermissionKey, RoleRights } from './rolesModel';
import { RoleKeyText, RolePermissionChips, RoleTypeBadge, RoleUserCount } from './rolesUi';
import { ActionButton, ICON_BUTTON_ACCENT, ICON_BUTTON_DANGER } from './ActionButton';

interface RoleCardProps {
  role: Role;
  labels: Record<PermissionKey, string>;
  rights: RoleRights;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export const RoleCard: React.FC<RoleCardProps> = ({ role, labels, rights, onEdit, onDelete }) => (
  <article className="p-5 rounded-2xl bg-surface border border-muted-border/40 shadow-xs flex flex-col hover:border-accent/40 transition-colors">
    <div className="flex items-start justify-between gap-2 mb-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-accent/12 text-accent border border-accent/20 flex items-center justify-center shrink-0">
          <KeyRound className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0">
          <h4 className="text-xs font-black text-heading truncate">{role.nameAr}</h4>
          <span dir="ltr" className="text-[10px] text-neutral-text/60 block truncate">
            {role.nameEn}
          </span>
        </div>
      </div>
      <RoleTypeBadge isSystem={role.isSystem} />
    </div>

    <div className="flex items-center gap-2 flex-wrap mb-3">
      <RoleKeyText roleKey={role.key} />
      <RoleUserCount role={role} />
    </div>

    {role.description && (
      <p className="text-[11px] text-neutral-text/65 leading-relaxed mb-3 line-clamp-2">{role.description}</p>
    )}

    <div className="border-t border-muted-border/20 pt-3 flex-1">
      <span className="text-[10px] font-bold text-neutral-text/50 block mb-2">
        الصلاحيات الممنوحة ({role.permissions.length})
      </span>
      <div className="flex flex-wrap gap-1.5">
        <RolePermissionChips role={role} labels={labels} />
      </div>
      {role.isSystem && (
        <p className="mt-2 text-[10px] text-neutral-text/50">الصلاحيات ثابتة لهذا الدور ولا يمكن تعديلها.</p>
      )}
    </div>

    <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-muted-border/20">
      <span className="text-[10px] text-neutral-text/45">ترتيب العرض: {role.sortOrder}</span>
      <div className="flex items-center gap-1.5">
        <ActionButton
          label={`تعديل دور ${role.nameAr}`}
          lockedReason={rights.editHint}
          hint="تعديل الدور"
          onClick={() => onEdit(role)}
          icon={<Pencil className="w-3.5 h-3.5" />}
          className={ICON_BUTTON_ACCENT}
        />
        <ActionButton
          label={`حذف دور ${role.nameAr}`}
          lockedReason={rights.deleteHint}
          hint="حذف الدور"
          onClick={() => onDelete(role)}
          icon={<Trash2 className="w-3.5 h-3.5" />}
          className={ICON_BUTTON_DANGER}
        />
      </div>
    </div>
  </article>
);
