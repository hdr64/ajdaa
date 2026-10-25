/**
 * Roles & permissions: the roles the team accounts are built from, each with the
 * permission set it grants. The cards are the default view; the table is there for
 * scanning and filtering a long list, and the choice is remembered.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import type { PermissionDef, Role } from '../../../types/admin';
import { AdminStorage } from '../../../services/adminStorage';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { AdminHeaderActions } from '../../../components/admin/layout/AdminHeaderActions';
import { ViewSwitcher } from '../../../components/admin/common/ViewSwitcher';
import { isViewMode, type ViewMode } from '../../../components/admin/common/viewModes';
import { EmptyState } from '../../../components/admin/common/EmptyState';
import { SectionError, SectionLoading } from '../../../components/admin/common/SectionState';
import { RoleCard } from '../../../components/admin/hr/RoleCard';
import { RolesTable } from '../../../components/admin/hr/RolesTable';
import { RoleFormDialog } from '../../../components/admin/hr/RoleFormDialog';
import {
  ROLE_DELETE_ERROR,
  getRoleRights,
  hrErrorMessage,
  permissionLabelsOf,
} from '../../../components/admin/hr/rolesModel';

const VIEW_MODES: readonly ViewMode[] = ['grid', 'table'];
const VIEW_STORAGE_KEY = 'ajda.admin.roles.view';

const NEW_ROLE_BUTTON =
  'brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs';

export const RolesSection: React.FC = () => {
  const { isSuperAdmin, showToast, confirmDelete } = useAdmin();
  const { t } = useAdminT();
  const [view, setView] = usePersistentState<ViewMode>(VIEW_STORAGE_KEY, 'grid', isViewMode);

  const roles = useAsyncData<Role[]>(useCallback((signal) => AdminStorage.listRoles(signal), []), [], []);
  const permissions = useAsyncData<PermissionDef[]>(
    useCallback((signal) => AdminStorage.listPermissions(signal), []),
    [],
    []
  );

  /** `null` closes the dialog; `{ role: null }` creates, `{ role }` edits. */
  const [dialog, setDialog] = useState<{ role: Role | null } | null>(null);

  const labels = useMemo(() => permissionLabelsOf(permissions.data), [permissions.data]);

  const deleteRole = useCallback(
    async (role: Role) => {
      const ok = await confirmDelete({
        title: t('roles.section.deleteConfirmTitle', { name: role.nameAr }),
        message: t('roles.section.deleteConfirmMessage'),
        confirmLabel: t('roles.section.deleteConfirmLabel'),
      });
      if (!ok) return;
      try {
        await AdminStorage.deleteRole(role.id);
        await roles.reload();
        showToast(t('roles.section.deleteSuccess', { name: role.nameAr }));
      } catch (error) {
        showToast(hrErrorMessage(error, t('roles.section.deleteError'), ROLE_DELETE_ERROR));
      }
    },
    [confirmDelete, roles, showToast, t]
  );

  const header = (
    <AdminHeaderActions>
      <ViewSwitcher value={view} onChange={setView} modes={VIEW_MODES} />
      <button type="button" onClick={() => setDialog({ role: null })} className={NEW_ROLE_BUTTON}>
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">{t('roles.section.newRole')}</span>
      </button>
    </AdminHeaderActions>
  );

  const dialogNode = dialog && (
    <RoleFormDialog
      role={dialog.role}
      permissions={permissions.data}
      permissionsLoading={permissions.loading && permissions.data.length === 0}
      permissionsError={permissions.error}
      onRetryPermissions={() => void permissions.reload()}
      isSuperAdmin={isSuperAdmin}
      showToast={showToast}
      onClose={() => setDialog(null)}
      onSaved={roles.reload}
    />
  );

  if (roles.error && roles.data.length === 0) {
    return (
      <>
        {header}
        <SectionError message={roles.error} onRetry={() => void roles.reload()} />
      </>
    );
  }
  if (roles.loading && roles.data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label={t('roles.section.loading')} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {roles.data.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title={t('roles.section.emptyTitle')}
          description={t('roles.section.emptyDescription')}
          action={
            <button type="button" onClick={() => setDialog({ role: null })} className={`${NEW_ROLE_BUTTON} px-5`}>
              <Plus className="w-4 h-4" />
              {t('roles.section.createFirst')}
            </button>
          }
        />
      ) : view === 'table' ? (
        <RolesTable
          roles={roles.data}
          labels={labels}
          isSuperAdmin={isSuperAdmin}
          onEdit={(role) => setDialog({ role })}
          onDelete={(role) => void deleteRole(role)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roles.data.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              labels={labels}
              rights={getRoleRights(role, isSuperAdmin)}
              onEdit={(target) => setDialog({ role: target })}
              onDelete={(target) => void deleteRole(target)}
            />
          ))}
        </div>
      )}

      {dialogNode}
    </div>
  );
};
