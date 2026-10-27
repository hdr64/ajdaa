/**
 * Role cards for selecting a role in the wizard/edit dialog.
 * Redesigned as sleek, minimal, expandable cards:
 * - Default/collapsed state shows minimal data: radio indicator, role icon,
 *   concise title, 1-line summary tagline, permission count pill, and expand toggle.
 * - Hidden details (full description, symmetrical highlights, scope) are tucked
 *   inside and smoothly revealed upon expanding.
 */
import React, { useState } from 'react';
import {
  Check,
  ShieldCheck,
  Building2,
  TrendingUp,
  BarChart3,
  UserCheck,
  ChevronDown,
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

const ROLE_TITLES: Record<string, { ar: string; en: string }> = {
  super_admin: {
    ar: 'مدير عام النظام',
    en: 'Super Admin',
  },
  project_manager: {
    ar: 'مدير التطوير والمشاريع',
    en: 'Development & Projects Manager',
  },
  sales_agent: {
    ar: 'مسؤول تأجير ومبيعات',
    en: 'Sales & Leasing Agent',
  },
  viewer: {
    ar: 'محلل استثماري ومتابع',
    en: 'Investment & Reports Analyst',
  },
};

const ROLE_SUBTITLES: Record<string, { ar: string; en: string }> = {
  super_admin: {
    ar: 'صلاحيات كاملة وشاملة للنظام',
    en: 'Full unrestricted system access',
  },
  project_manager: {
    ar: 'إدارة المشاريع والمخططات والوحدات',
    en: 'Manage projects, floors & units',
  },
  sales_agent: {
    ar: 'متابعة الطلبات وتحديث حالات الوحدات',
    en: 'Handle inquiries & unit statuses',
  },
  viewer: {
    ar: 'استعراض المشاريع والتقارير (قراءة فقط)',
    en: 'Read-only access to projects & reports',
  },
};

const ROLE_DESCRIPTIONS: Record<string, { ar: string; en: string }> = {
  super_admin: {
    ar: 'صلاحيات كاملة وشاملة لإدارة النظام والإعدادات والمستخدمين',
    en: 'Full unrestricted access to system settings, users, and audit logs',
  },
  project_manager: {
    ar: 'إدارة دورة حياة المشاريع والمخططات المعمارية والوحدات العقارية',
    en: 'Manage development projects, floor plans, and real estate units',
  },
  sales_agent: {
    ar: 'متابعة وتحديث حالات الوحدات والتعامل مع طلبات واستفسارات العملاء',
    en: 'Handle inquiries, track leads, and update leasing or sale statuses',
  },
  viewer: {
    ar: 'استعراض المشاريع ومتابعة التقارير ومؤشرات الأداء دون تعديل',
    en: 'Read-only access to view projects, analytics, and performance reports',
  },
};

function getRoleBadge(roleKey: string, isSuperAdmin: boolean) {
  if (isSuperAdmin || roleKey === 'super_admin') {
    return {
      icon: <ShieldCheck className="w-4.5 h-4.5 text-amber-500 shrink-0" />,
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-500',
    };
  }
  if (roleKey === 'project_manager') {
    return {
      icon: <Building2 className="w-4.5 h-4.5 text-blue-500 shrink-0" />,
      bg: 'bg-blue-500/15 border-blue-500/30 text-blue-500',
    };
  }
  if (roleKey === 'sales_agent') {
    return {
      icon: <TrendingUp className="w-4.5 h-4.5 text-emerald-500 shrink-0" />,
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500',
    };
  }
  if (roleKey === 'viewer') {
    return {
      icon: <BarChart3 className="w-4.5 h-4.5 text-purple-500 shrink-0" />,
      bg: 'bg-purple-500/15 border-purple-500/30 text-purple-500',
    };
  }
  return {
    icon: <UserCheck className="w-4.5 h-4.5 text-accent shrink-0" />,
    bg: 'bg-accent/15 border-accent/30 text-accent',
  };
}

function getRoleHighlights(roleKey: string, isEn: boolean): { can: string; cant: string; isPositiveSecond?: boolean } {
  if (roleKey === 'super_admin') {
    return {
      can: isEn ? 'Full unrestricted access to all data and system settings' : 'صلاحيات كاملة وغير محدودة للنظام والإعدادات',
      cant: isEn ? 'No restrictions or permission limits applied' : 'لا توجد أي قيود أو حدود لصلاحيات هذا الدور',
      isPositiveSecond: true,
    };
  }
  if (roleKey === 'project_manager') {
    return {
      can: isEn ? 'Create, edit & manage projects, units and floors' : 'إضافة وتعديل المشاريع والوحدات والأدوار',
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
      can: isEn ? 'Read-only access to projects and analytical reports' : 'استعراض المشاريع والتقارير (قراءة فقط)',
      cant: isEn ? 'Cannot edit or modify any system data' : 'لا يملك أي صلاحيات تعديل أو إضافة',
    };
  }
  return {
    can: isEn ? 'Standard role permissions' : 'الصلاحيات المحددة للدور',
    cant: isEn ? 'Limited to assigned role' : 'محدود بمهام الدور المحدد',
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
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

  const toggleExpand = (roleId: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  };

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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t('users.selectRoleAria')}>
      {filteredRoles.map((role) => {
        const isSelected = selectedRoleId === role.id;
        const isSuperAdmin = role.key === SUPER_ADMIN_ROLE_KEY;
        const isExpanded = expandedCardIds.has(role.id);
        const permissionCount = isSuperAdmin ? PERMISSION_KEYS.length : getPermissionCount(role);

        // Clean role title without parenthetical text
        const roleDisplayName = ROLE_TITLES[role.key]
          ? (isEn ? ROLE_TITLES[role.key].en : ROLE_TITLES[role.key].ar)
          : (isEn && role.nameEn ? role.nameEn : role.nameAr.replace(/\s*\([^)]*\)/g, ''));

        // One-line subtitle for minimal view
        const roleSubtitle = ROLE_SUBTITLES[role.key]
          ? (isEn ? ROLE_SUBTITLES[role.key].en : ROLE_SUBTITLES[role.key].ar)
          : null;

        // Localized detailed description for expanded view
        const roleDescription = ROLE_DESCRIPTIONS[role.key]
          ? (isEn ? ROLE_DESCRIPTIONS[role.key].en : ROLE_DESCRIPTIONS[role.key].ar)
          : role.description;

        const badge = getRoleBadge(role.key, isSuperAdmin);
        const highlights = getRoleHighlights(role.key, isEn);

        return (
          <div
            key={role.id}
            role="radio"
            aria-checked={isSelected}
            aria-label={roleDisplayName}
            aria-expanded={isExpanded}
            onClick={() => handleSelectRole(role)}
            className={`
              group relative p-3 sm:p-3.5 rounded-2xl border-2 transition-all text-start flex flex-col justify-between
              ${isSelected
                ? 'border-accent bg-accent/5 shadow-xs ring-2 ring-accent/20'
                : 'border-muted-border/40 bg-surface hover:border-accent/40 hover:bg-accent/5'}
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {/* Minimal Surface Row */}
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Radio Circle Indicator */}
                <div className="shrink-0">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-muted-border/50 group-hover:border-accent/50 transition-colors" />
                  )}
                </div>

                {/* Role Icon */}
                <div
                  className={`
                    w-8 h-8 rounded-xl flex items-center justify-center border shrink-0
                    ${badge.bg}
                  `}
                >
                  {badge.icon}
                </div>

                {/* Title & Short Subtitle */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-black text-heading leading-tight truncate">
                    {roleDisplayName}
                  </h4>
                  {roleSubtitle && (
                    <p className="text-[10px] text-neutral-text/60 truncate mt-0.5">
                      {roleSubtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* End side: Permission Badge + Expand Chevron */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${
                    isSuperAdmin
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                      : 'bg-canvas text-neutral-text/60 border-muted-border/30'
                  }`}
                >
                  {isSuperAdmin
                    ? t('users.allPermissionsShort')
                    : `${permissionCount} / ${PERMISSION_KEYS.length}`}
                </span>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(role.id);
                  }}
                  title={isExpanded ? (isEn ? 'Hide details' : 'إخفاء التفاصيل') : (isEn ? 'Show details' : 'عرض التفاصيل')}
                  aria-label={isExpanded ? (isEn ? 'Hide details' : 'إخفاء التفاصيل') : (isEn ? 'Show details' : 'عرض التفاصيل')}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    isExpanded
                      ? 'bg-accent/10 border-accent/30 text-accent'
                      : 'bg-canvas/60 border-muted-border/40 text-neutral-text/60 hover:text-heading hover:bg-canvas'
                  }`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Hidden Details (Smoothly revealed when expanded) */}
            {isExpanded && (
              <div
                className="mt-3 pt-2.5 border-t border-muted-border/30 space-y-2.5 animate-in fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {roleDescription && (
                  <p className="text-[11px] text-neutral-text/75 leading-relaxed">
                    {roleDescription}
                  </p>
                )}

                {/* Symmetrical Role Highlights */}
                <div className="text-[10px] space-y-1.5 bg-canvas/60 p-2.5 rounded-xl border border-muted-border/30">
                  <div className="text-emerald-700 dark:text-emerald-400 font-medium flex items-start gap-1.5">
                    <span className="font-bold text-emerald-600 shrink-0">✓</span>
                    <span className="leading-snug">{highlights.can}</span>
                  </div>
                  <div
                    className={`font-medium flex items-start gap-1.5 ${
                      highlights.isPositiveSecond
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-neutral-text/60'
                    }`}
                  >
                    <span
                      className={`font-bold shrink-0 ${
                        highlights.isPositiveSecond ? 'text-emerald-600' : 'text-amber-600'
                      }`}
                    >
                      {highlights.isPositiveSecond ? '✓' : '✕'}
                    </span>
                    <span className="leading-snug">{highlights.cant}</span>
                  </div>
                </div>

                {/* Expanded Scope Footer */}
                <div className="flex items-center justify-between text-[10px] text-neutral-text/60 pt-0.5">
                  <span>
                    {isSuperAdmin
                      ? (isEn ? 'Full unrestricted access' : 'صلاحيات كاملة غير مقيدة')
                      : (isEn ? `${permissionCount} assigned permissions` : `${permissionCount} صلاحية معتمدة للدور`)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(role.id);
                    }}
                    className="text-accent font-bold hover:underline cursor-pointer"
                  >
                    {isEn ? 'Collapse' : 'طي التفاصيل'}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};