/**
 * Read-only summary of permissions granted by the selected role.
 * Shows grouped chips using the catalogue labels.
 */
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { Role, PermissionDef } from '../../../types/admin';
import { PERMISSION_KEYS, PERMISSION_LABELS, PERMISSION_EN_LABELS } from './usersModel';
import { useAdminT } from '../../../i18n/admin/useAdminT';

interface PermissionSummaryProps {
  role: Role | null;
  permissions: PermissionDef[];
}

const GROUP_AR_LABELS: Record<string, string> = {
  projects: 'المشاريع',
  units: 'الوحدات والأدوار',
  inquiries: 'طلبات الاهتمام',
  reports: 'التقارير',
  users: 'المستخدمون',
  settings: 'الإعدادات',
  cms: 'محتوى الموقع (CMS)',
};

const GROUP_EN_LABELS: Record<string, string> = {
  projects: 'Projects',
  units: 'Units & Floors',
  inquiries: 'Inquiries',
  reports: 'Reports',
  users: 'Users',
  settings: 'Settings',
  cms: 'Website Content (CMS)',
};

export const PermissionSummary: React.FC<PermissionSummaryProps> = ({ role, permissions }) => {
  const { t, language } = useAdminT();
  const isEn = language === 'en';

  if (!role) return null;

  // Group permissions by the group from the catalogue
  const groups = new Map<string, { key: string; label: string; items: PermissionDef[] }>();

  for (const def of permissions) {
    const existing = groups.get(def.group);
    if (existing) {
      existing.items.push(def);
    } else {
      groups.set(def.group, {
        key: def.group,
        label: def.group,
        items: [def],
      });
    }
  }

  const groupLabels = isEn ? GROUP_EN_LABELS : GROUP_AR_LABELS;
  const grantedKeys = new Set(role.permissions);

  if (grantedKeys.size === 0) {
    return (
      <div className="p-3 rounded-xl bg-canvas/60 border border-muted-border/30">
        <p className="text-[11px] text-neutral-text/55 text-center">
          {t('users.noDefaultPermsForRole')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold text-neutral-text/70">
        {t('users.rolePermissionsCount', { count: grantedKeys.size, total: PERMISSION_KEYS.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {[...groups.values()]
          .filter((group) => group.items.some((item) => grantedKeys.has(item.key)))
          .map((group) => (
            <div key={group.key} className="flex flex-wrap gap-1.5">
              <span className="text-[10px] font-bold text-neutral-text/50 px-2 py-0.5">
                {groupLabels[group.key] ?? group.key}
              </span>
              {group.items
                .filter((item) => grantedKeys.has(item.key))
                .map((item) => {
                  const label = isEn
                    ? (PERMISSION_EN_LABELS[item.key] ?? item.labelEn ?? item.labelAr)
                    : (PERMISSION_LABELS[item.key] ?? item.labelAr);
                  return (
                    <span
                      key={item.key}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/30"
                    >
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {label}
                    </span>
                  );
                })}
            </div>
          ))}
      </div>
    </div>
  );
};