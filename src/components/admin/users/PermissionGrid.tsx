/**
 * Advanced permission grid for customizing permissions beyond the role defaults.
 * Shows grouped checkboxes with "معدّل عن الدور" tag and "استعادة صلاحيات الدور" button.
 */
import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Shield } from 'lucide-react';
import type { PermissionDef, AdminPermissions, Role } from '../../../types/admin';
import { PERMISSION_KEYS, groupPermissions } from './usersModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface PermissionGridProps {
  permissions: AdminPermissions;
  onChange: (permissions: AdminPermissions) => void;
  role: Role | null;
  allPermissions: PermissionDef[];
  accessLocked: boolean;
  lockReason?: string | null;
  showModifiedTag: boolean;
  onRestoreRolePermissions: () => void;
}

export const PermissionGrid: React.FC<PermissionGridProps> = ({
  permissions,
  onChange,
  role,
  allPermissions,
  accessLocked,
  lockReason,
  showModifiedTag,
  onRestoreRolePermissions,
}) => {
  const { t, language } = useAdminT();
  const isEn = language === 'en';
  const [isExpanded, setIsExpanded] = useState(false);
  const groups = groupPermissions(allPermissions);
  const allChecked = PERMISSION_KEYS.every((key) => permissions[key]);
  const isSuperAdminRole = role?.key === 'super_admin';

  const togglePermission = (key: keyof AdminPermissions, checked: boolean) => {
    const next = { ...permissions, [key]: checked };
    onChange(next);
  };

  const toggleAll = () => {
    const next = { ...permissions };
    const target = !allChecked;
    for (const key of PERMISSION_KEYS) next[key] = target;
    onChange(next);
  };

  if (isSuperAdminRole) {
    return (
      <div className="pt-1 border-t border-muted-border/30 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-black text-heading">{t('users.customPermissions')}</h4>
            <p className="text-[10px] text-neutral-text/60 mt-0.5">
              {isEn ? 'Super admin accounts effectively have all permissions.' : 'حساب المدير العام يملك كل الصلاحيات فعلياً.'}
            </p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 text-[11px] text-amber-600">
            <Shield className="w-4 h-4 shrink-0" />
            <span className="font-bold">{t('users.superAdminAllPerms')}</span>
          </div>
        </div>
        {accessLocked && lockReason && (
          <p className="flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{lockReason}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="pt-1 border-t border-muted-border/30 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-black text-heading">{t('users.customPermissions')}</h4>
          <p className="text-[10px] text-neutral-text/60 mt-0.5">
            {t('users.customPermissionsDesc')}
          </p>
        </div>
        {!accessLocked && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {showModifiedTag && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
                {t('users.modifiedFromRole')}
              </span>
            )}
            <button
              type="button"
              onClick={onRestoreRolePermissions}
              disabled={!role}
              title={role ? t('users.restoreRolePermissions') : (isEn ? 'Select a role first' : 'اختر دوراً أولاً')}
              className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {isEn ? 'Match role' : 'مطابقة الدور'}
            </button>
            <button
              type="button"
              onClick={toggleAll}
              className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold cursor-pointer"
            >
              {allChecked
                ? (isEn ? 'Deselect All' : 'إلغاء تحديد الكل')
                : (isEn ? 'Select All' : 'تحديد الكل')}
            </button>
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-[11px] text-neutral-text/55 text-center py-4">
          {isEn
            ? 'Could not load permissions list; role defaults will be used.'
            : 'تعذر تحميل قائمة الصلاحيات، سيتم اعتماد صلاحيات الدور.'}
        </p>
      ) : (
        <div className={`
          grid grid-cols-1 lg:grid-cols-2 gap-3 transition-all duration-200
          ${isExpanded ? 'opacity-100 max-h-[600px]' : 'opacity-0 max-h-0 pointer-events-none'}
        `}>
          {groups.map((group) => (
            <fieldset
              key={group.key}
              disabled={accessLocked}
              className="p-3 rounded-xl bg-canvas/60 border border-muted-border/30 disabled:opacity-70"
            >
              <legend className="px-1 text-[11px] font-black text-heading">
                {group.label}
              </legend>
              <div className="space-y-2">
                {group.items.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex items-start gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={permissions[permission.key]}
                      onChange={(event) => togglePermission(permission.key, event.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0 disabled:cursor-not-allowed"
                    />
                    <span className="min-w-0">
                      <span className="block font-bold text-heading">
                        {isEn && permission.labelEn ? permission.labelEn : permission.labelAr}
                      </span>
                      {permission.description && (
                        <span className="block text-[10px] text-neutral-text/60 leading-relaxed">
                          {permission.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}

      {!accessLocked && (
        <button
          type="button"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="w-full px-3 py-2 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          {isExpanded
            ? (isEn ? 'Collapse custom permissions (Advanced)' : 'طي تخصيص الصلاحيات (متقدم)')
            : (isEn ? 'Customize permissions (Advanced)' : 'تخصيص الصلاحيات (متقدم)')}
        </button>
      )}

      {accessLocked && lockReason && (
        <p className="flex items-start gap-1 text-[10px] text-amber-500 leading-relaxed">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{lockReason}</span>
        </p>
      )}
    </div>
  );
};