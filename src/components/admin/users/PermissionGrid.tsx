/**
 * Advanced permission grid for customizing permissions beyond the role defaults.
 * Features:
 * - Header-level expand/collapse toggle with zero layout shift / blank space
 * - Compact collapsed summary showing active count and category breakdown
 * - Group-level checkboxes with indeterminate states and (x/y) counts
 * - Parent-child cascading dependencies
 * - Sensitive permission indicators
 * - Granular diff badges (+X added, -Y removed from role)
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  RotateCcw,
  AlertCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { PermissionDef, AdminPermissions, Role } from '../../../types/admin';
import {
  PERMISSION_KEYS,
  groupPermissions,
  isSensitivePermission,
  PERMISSION_DEPENDENCIES,
  calculatePermissionDiff,
  summarizePermissions,
} from './usersModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface PermissionGridProps {
  permissions: AdminPermissions;
  onChange: (permissions: AdminPermissions) => void;
  role: Role | null;
  allPermissions: PermissionDef[];
  accessLocked: boolean;
  lockReason?: string | null;
  showModifiedTag?: boolean;
  onRestoreRolePermissions: () => void;
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  disabled,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel}
      className="w-3.5 h-3.5 rounded accent-accent shrink-0 cursor-pointer disabled:cursor-not-allowed"
    />
  );
}

export const PermissionGrid: React.FC<PermissionGridProps> = ({
  permissions,
  onChange,
  role,
  allPermissions,
  accessLocked,
  lockReason,
  onRestoreRolePermissions,
}) => {
  const { t, language } = useAdminT();
  const isEn = language === 'en';
  const [isExpanded, setIsExpanded] = useState(false);

  const groups = useMemo(() => groupPermissions(allPermissions), [allPermissions]);
  const allChecked = useMemo(() => PERMISSION_KEYS.every((key) => permissions[key]), [permissions]);
  const isSuperAdminRole = role?.key === 'super_admin';

  const diff = useMemo(() => calculatePermissionDiff(permissions, role), [permissions, role]);
  const summary = useMemo(
    () => summarizePermissions(permissions, allPermissions, isEn),
    [permissions, allPermissions, isEn]
  );

  const togglePermission = (key: keyof AdminPermissions, checked: boolean) => {
    const next: AdminPermissions = { ...permissions, [key]: checked };

    // Parent -> Child cascade:
    if (checked && PERMISSION_DEPENDENCIES[key]) {
      for (const child of PERMISSION_DEPENDENCIES[key]!) {
        next[child] = true;
      }
    }

    // Child -> Parent requirement:
    if (checked) {
      if (key === 'editProject' || key === 'deleteProject' || key === 'publishProject' || key === 'createProject') {
        next.viewProjects = true;
      }
      if (key === 'manageApplications') {
        next.viewApplications = true;
      }
      if (key === 'rollbackCms' || key === 'manageClients' || key === 'managePastProjects') {
        next.manageCms = true;
      }
    }

    onChange(next);
  };

  const toggleGroup = (groupKeys: (keyof AdminPermissions)[], targetChecked: boolean) => {
    const next: AdminPermissions = { ...permissions };
    for (const key of groupKeys) {
      next[key] = targetChecked;
      if (targetChecked && PERMISSION_DEPENDENCIES[key]) {
        for (const child of PERMISSION_DEPENDENCIES[key]!) {
          next[child] = true;
        }
      }
    }
    onChange(next);
  };

  const toggleAll = () => {
    if (!allChecked) {
      const confirmMsg = isEn
        ? 'Granting all permissions gives sensitive rights (deleting projects, exporting data, managing users). Are you sure?'
        : 'منح كافة الصلاحيات يمنح المستخدم حقوقاً حساسة (حذف المشاريع، تصدير البيانات، إدارة المستخدمين). هل أنت متأكد؟';
      if (!window.confirm(confirmMsg)) {
        return;
      }
    }
    const next: AdminPermissions = { ...permissions };
    const target = !allChecked;
    for (const key of PERMISSION_KEYS) next[key] = target;
    onChange(next);
  };

  if (!role) {
    return (
      <div className="pt-2 border-t border-muted-border/30">
        <div className="p-4 rounded-2xl bg-canvas/50 border border-dashed border-muted-border/60 flex items-center gap-3 text-neutral-text/60">
          <div className="w-8 h-8 rounded-xl bg-surface flex items-center justify-center shrink-0 border border-muted-border/40">
            <SlidersHorizontal className="w-4 h-4 text-neutral-text/40" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-heading">
              {t('users.customPermissions')}
            </h4>
            <p className="text-[11px] text-neutral-text/60 mt-0.5">
              {isEn
                ? 'Select a job role above to view and customize its permissions'
                : 'اختر دوراً وظيفياً أعلاه لعرض الصلاحيات الممنوحة وإمكانية تخصيصها'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isSuperAdminRole) {
    return (
      <div className="pt-2 border-t border-muted-border/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-xs font-black text-heading">{t('users.customPermissions')}</h4>
            <p className="text-[10px] text-neutral-text/60 mt-0.5">
              {t('users.superAdminPermsNotice')}
            </p>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 text-[11px] text-amber-600 font-bold">
            <Shield className="w-4 h-4 shrink-0" />
            <span>{t('users.superAdminAllPerms')}</span>
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
    <div className="pt-2 border-t border-muted-border/30 space-y-3">
      {/* Header with inline Controls & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-xs font-black text-heading">{t('users.customPermissions')}</h4>
            {diff.isModified && (
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/30">
                {diff.added.length > 0 && <span className="text-emerald-600">+{diff.added.length}</span>}
                {diff.removed.length > 0 && <span className="text-amber-600">-{diff.removed.length}</span>}
                <span>{isEn ? 'customized' : 'معدل عن الدور'}</span>
              </span>
            )}
          </div>
          <p className="text-[10px] text-neutral-text/60 mt-0.5">
            {t('users.customPermissionsDesc')}
          </p>
        </div>

        {!accessLocked && (
          <div className="flex items-center gap-2 flex-wrap">
            {isExpanded && (
              <>
                {diff.isModified && (
                  <button
                    type="button"
                    onClick={onRestoreRolePermissions}
                    disabled={!role}
                    title={isEn ? 'Reset to role defaults' : 'استعادة صلاحيات الدور الافتراضية'}
                    className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[10px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{isEn ? 'Reset to role' : 'استعادة الافتراضي'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggleAll}
                  className="px-2.5 py-1.5 rounded-xl brand-btn-secondary text-[10px] font-bold cursor-pointer"
                >
                  {allChecked ? t('users.deselectAll') : t('users.selectAll')}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="px-3 py-1.5 rounded-xl brand-btn-secondary text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent" />
              <span>
                {isExpanded
                  ? (isEn ? 'Collapse' : 'طي الصلاحيات')
                  : (isEn ? 'Customize' : 'تخصيص الصلاحيات')}
              </span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Collapsed State Summary Card */}
      {!isExpanded && (
        <div
          onClick={() => !accessLocked && setIsExpanded(true)}
          className={`p-3 rounded-2xl bg-canvas/60 border border-muted-border/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
            !accessLocked ? 'cursor-pointer hover:border-accent/40 hover:bg-accent/5 transition-all' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-heading">
                  {isEn
                    ? `${summary.totalCount} of ${PERMISSION_KEYS.length} permissions active`
                    : `${summary.totalCount} من ${PERMISSION_KEYS.length} صلاحية مفعلة`}
                </span>
                {diff.isModified && (
                  <span className="text-[10px] font-bold text-amber-600">
                    ({diff.added.length > 0 ? `+${diff.added.length}` : ''}{diff.removed.length > 0 ? ` -${diff.removed.length}` : ''})
                  </span>
                )}
              </div>
              <p className="text-[10px] text-neutral-text/60 mt-0.5 truncate max-w-lg">
                {summary.categoryBreakdown}
              </p>
            </div>
          </div>

          {!accessLocked && (
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-surface border border-muted-border/40 text-neutral-text/70 shrink-0 ms-auto">
              {isEn ? 'Click to customize' : 'انقر للتخصيص'}
            </span>
          )}
        </div>
      )}

      {/* Expanded Grid */}
      {isExpanded && (
        <>
          {groups.length === 0 ? (
            <p className="text-[11px] text-neutral-text/55 text-center py-4">
              {t('users.loadPermsError')}
            </p>
          ) : (
            <div className="space-y-3 animate-in fade-in duration-200">
              {groups.map((group) => {
                const groupKeys = group.items.map((i) => i.key as keyof AdminPermissions);
                const checkedCount = groupKeys.filter((k) => permissions[k]).length;
                const isGroupAllChecked = checkedCount === groupKeys.length;
                const isGroupIndeterminate = checkedCount > 0 && checkedCount < groupKeys.length;

                return (
                  <fieldset
                    key={group.key}
                    disabled={accessLocked}
                    className="p-3.5 rounded-2xl bg-canvas/70 border border-muted-border/30 disabled:opacity-70 space-y-2.5"
                  >
                    {/* Group Header Checkbox */}
                    <legend className="px-1.5 flex items-center gap-2 text-xs font-black text-heading float-none w-auto">
                      <IndeterminateCheckbox
                        checked={isGroupAllChecked}
                        indeterminate={isGroupIndeterminate}
                        disabled={accessLocked}
                        aria-label={group.label}
                        onChange={(e) => toggleGroup(groupKeys, e.target.checked)}
                      />
                      <span>{group.label}</span>
                      <span className="text-[10px] font-bold text-neutral-text/60 bg-surface px-2 py-0.5 rounded-md border border-muted-border/30 tabular-nums">
                        {checkedCount}/{groupKeys.length}
                      </span>
                    </legend>

                    {/* Permissions in this group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {group.items.map((permission) => {
                        const key = permission.key as keyof AdminPermissions;
                        const isChecked = Boolean(permissions[key]);
                        const isSensitive = isSensitivePermission(key);
                        const labelText = isEn && permission.labelEn ? permission.labelEn : permission.labelAr;

                        return (
                          <label
                            key={permission.key}
                            className={`flex items-start gap-2.5 p-2 rounded-xl transition-all cursor-pointer border ${
                              isChecked
                                ? 'bg-surface border-accent/30 shadow-xs'
                                : 'bg-canvas/40 border-transparent hover:bg-surface hover:border-muted-border/30'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) => togglePermission(key, event.target.checked)}
                              className="mt-0.5 w-3.5 h-3.5 rounded accent-accent shrink-0 disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-[11px] text-heading leading-tight">
                                  {labelText}
                                </span>
                                {isSensitive && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-500/10 text-red-600 border border-red-500/20">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>{isEn ? 'Sensitive' : 'حساس'}</span>
                                  </span>
                                )}
                              </div>
                              {permission.description &&
                                permission.description.trim() !== labelText.trim() && (
                                  <p className="text-[10px] text-neutral-text/60 mt-0.5 leading-snug">
                                    {permission.description}
                                  </p>
                                )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}
        </>
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