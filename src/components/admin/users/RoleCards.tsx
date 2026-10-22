/**
 * Role cards for selecting a role in the wizard/edit dialog.
 * Shows role name, one-line description (from role.description), and permission count.
 * Super-admin role is only shown when canAssignSuperAdmin is true.
 */
import React from 'react';
import { Check, Shield } from 'lucide-react';
import type { Role } from '../../../types/admin';
import { PERMISSION_KEYS, SUPER_ADMIN_ROLE_KEY } from './usersModel';

interface RoleCardsProps {
  roles: Role[];
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
  canAssignSuperAdmin: boolean;
  disabled?: boolean;
}

export const RoleCards: React.FC<RoleCardsProps> = ({
  roles,
  selectedRoleId,
  onSelect,
  canAssignSuperAdmin,
  disabled = false,
}) => {
  const filteredRoles = roles.filter((role) => {
    if (role.key === SUPER_ADMIN_ROLE_KEY && !canAssignSuperAdmin) return false;
    return true;
  });

  const getPermissionCount = (role: Role): number => {
    return PERMISSION_KEYS.filter((key) => role.permissions.includes(key)).length;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="radiogroup" aria-label="اختر الدور الوظيفي">
      {filteredRoles.map((role) => {
        const isSelected = selectedRoleId === role.id;
        const permissionCount = getPermissionCount(role);
        const isSuperAdmin = role.key === SUPER_ADMIN_ROLE_KEY;

        return (
          <button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={role.nameAr}
            onClick={() => !disabled && onSelect(role.id)}
            disabled={disabled}
            className={`
              relative p-3 rounded-xl border-2 transition-all text-start
              ${isSelected
                ? 'border-accent bg-accent/5 shadow-sm shadow-accent/10'
                : 'border-muted-border/40 bg-surface hover:border-accent/40 hover:bg-accent/5'}
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isSelected && (
              <div className="absolute top-2 end-2">
                <Check className="w-4 h-4 text-accent" />
              </div>
            )}
            <div className="flex items-start gap-2">
              <div
                className={`
                  flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
                  ${isSuperAdmin
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-accent/10 text-accent border border-accent/20'}
                `}
              >
                {isSuperAdmin ? (
                  <Shield className="w-4.5 h-4.5" />
                ) : (
                  <span className="text-xs font-black">{role.nameAr.slice(0, 1)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black text-heading truncate">{role.nameAr}</h4>
                {role.description && (
                  <p className="text-[10px] text-neutral-text/60 mt-0.5 line-clamp-1 truncate">
                    {role.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-bold text-neutral-text/70">
                    {permissionCount} صلاحيات
                  </span>
                  {isSuperAdmin && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                      كل الصلاحيات
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};