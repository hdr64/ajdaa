/**
 * Role cards for selecting a role in the wizard/edit dialog.
 * Shows distinct role icons, wrapped names, role description, permission count,
 * and a clear summary of what the role can and cannot do.
 */
import React from 'react';
import {
  Check,
  ShieldCheck,
  Building2,
  TrendingUp,
  BarChart3,
  UserCheck,
} from 'lucide-react';
import type { Role } from '../../../types/admin';
import { PERMISSION_KEYS, SUPER_ADMIN_ROLE_KEY } from './usersModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface RoleCardsProps {
  roles: Role[];
  selectedRoleId: string;
  onSelect: (roleId: string) => void;
  canAssignSuperAdmin: boolean;
  disabled?: boolean;
}

function getRoleBadge(roleKey: string, isSuperAdmin: boolean) {
  if (isSuperAdmin || roleKey === 'super_admin') {
    return {
      icon: <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0" />,
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-500',
    };
  }
  if (roleKey === 'project_manager') {
    return {
      icon: <Building2 className="w-5 h-5 text-blue-500 shrink-0" />,
      bg: 'bg-blue-500/15 border-blue-500/30 text-blue-500',
    };
  }
  if (roleKey === 'sales_agent') {
    return {
      icon: <TrendingUp className="w-5 h-5 text-emerald-500 shrink-0" />,
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500',
    };
  }
  if (roleKey === 'viewer') {
    return {
      icon: <BarChart3 className="w-5 h-5 text-purple-500 shrink-0" />,
      bg: 'bg-purple-500/15 border-purple-500/30 text-purple-500',
    };
  }
  return {
    icon: <UserCheck className="w-5 h-5 text-accent shrink-0" />,
    bg: 'bg-accent/15 border-accent/30 text-accent',
  };
}

function getRoleHighlights(roleKey: string, isEn: boolean): { can: string; cant?: string } {
  if (roleKey === 'super_admin') {
    return {
      can: isEn ? 'Full unrestricted access to all data and system settings' : 'صلاحيات كاملة وغير محدودة للنظام والإعدادات',
    };
  }
  if (roleKey === 'project_manager') {
    return {
      can: isEn ? 'Create, edit & manage projects and units' : 'إضافة وتعديل المشاريع والوحدات والأدوار',
      cant: isEn ? 'Cannot manage users or system security' : 'لا يمكنه إدارة المستخدمين أو أمان النظام',
    };
  }
  if (roleKey === 'sales_agent') {
    return {
      can: isEn ? 'View inquiries, track leads & update unit status' : 'متابعة طلبات العملاء وتحديث حالة الوحدات',
      cant: isEn ? 'Cannot delete projects or edit website content' : 'لا يمكنه حذف المشاريع أو تعديل الموقع',
    };
  }
  if (roleKey === 'viewer') {
    return {
      can: isEn ? 'Read-only access to projects and reports' : 'استعراض المشاريع والتقارير (قراءة فقط)',
      cant: isEn ? 'Cannot edit or modify any system data' : 'لا يملك أي صلاحيات تعديل أو إضافة',
    };
  }
  return {
    can: isEn ? 'Standard role permissions' : 'الصلاحيات المحددة للدور',
  };
}

export const RoleCards: React.FC<RoleCardsProps> = ({
  roles,
  selectedRoleId,
  onSelect,
  canAssignSuperAdmin,
  disabled = false,
}) => {
  const { t, language } = useAdminT();
  const isEn = language === 'en';

  const filteredRoles = roles.filter((role) => {
    if (role.key === SUPER_ADMIN_ROLE_KEY && !canAssignSuperAdmin) return false;
    return true;
  });

  const getPermissionCount = (role: Role): number => {
    return PERMISSION_KEYS.filter((key) => role.permissions.includes(key)).length;
  };

  const handleSelectRole = (role: Role) => {
    if (disabled) return;
    if (role.key === SUPER_ADMIN_ROLE_KEY && selectedRoleId !== role.id) {
      const msg = isEn
        ? 'Super Admin grants full, unrestricted access to the entire system. Are you sure you want to select this role?'
        : 'دور مدير عام النظام يمنح صلاحيات كاملة وشاملة للنظام بأكمله. هل تؤكد اختيار هذا الدور؟';
      if (!window.confirm(msg)) {
        return;
      }
    }
    onSelect(role.id);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5" role="radiogroup" aria-label={t('users.selectRoleAria')}>
      {filteredRoles.map((role) => {
        const isSelected = selectedRoleId === role.id;
        const isSuperAdmin = role.key === SUPER_ADMIN_ROLE_KEY;
        const permissionCount = isSuperAdmin ? PERMISSION_KEYS.length : getPermissionCount(role);
        const roleDisplayName = isEn && role.nameEn ? role.nameEn : role.nameAr;
        const badge = getRoleBadge(role.key, isSuperAdmin);
        const highlights = getRoleHighlights(role.key, isEn);

        return (
          <button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={roleDisplayName}
            onClick={() => handleSelectRole(role)}
            disabled={disabled}
            className={`
              relative p-3.5 rounded-2xl border-2 transition-all text-start flex flex-col justify-between
              ${isSelected
                ? 'border-accent bg-accent/5 shadow-sm shadow-accent/10 ring-2 ring-accent/20'
                : 'border-muted-border/40 bg-surface hover:border-accent/40 hover:bg-accent/5'}
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {isSelected && (
              <div className="absolute top-3 end-3 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}

            <div>
              <div className="flex items-start gap-3">
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center border shrink-0
                    ${badge.bg}
                  `}
                >
                  {badge.icon}
                </div>

                <div className="min-w-0 flex-1 pe-5">
                  <h4 className="text-sm font-black text-heading leading-snug">
                    {roleDisplayName}
                  </h4>
                  {role.description && (
                    <p className="text-[11px] text-neutral-text/70 mt-1 line-clamp-2 leading-relaxed">
                      {role.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Role Highlights (Can / Cannot do) */}
              <div className="mt-3 text-[10px] space-y-1 bg-canvas/60 p-2.5 rounded-xl border border-muted-border/30">
                <div className="text-emerald-700 dark:text-emerald-400 font-medium flex items-start gap-1.5">
                  <span className="font-bold text-emerald-600">✓</span>
                  <span className="leading-snug">{highlights.can}</span>
                </div>
                {highlights.cant && (
                  <div className="text-neutral-text/60 font-medium flex items-start gap-1.5 pt-0.5">
                    <span className="font-bold text-amber-600">✕</span>
                    <span className="leading-snug">{highlights.cant}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Permission count footer */}
            <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-muted-border/25 text-[11px]">
              <span className="font-bold text-neutral-text/80 whitespace-nowrap">
                {isSuperAdmin
                  ? (isEn ? `All ${PERMISSION_KEYS.length} permissions` : `كل الـ ${PERMISSION_KEYS.length} صلاحية`)
                  : t('users.permissionsCountOf', { count: permissionCount, total: PERMISSION_KEYS.length })}
              </span>
              {isSuperAdmin && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 border border-amber-500/30 whitespace-nowrap">
                  {t('users.allPermissionsRole')}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};