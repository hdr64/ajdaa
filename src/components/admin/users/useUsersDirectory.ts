/**
 * Data + mutations behind the users section: the account list, the reference
 * data the form needs (roles, departments, permission catalogue) and the three
 * guarded actions the UI exposes — activate, suspend, delete.
 *
 * Every state change goes through `useAdmin().confirm()` with the consequence
 * spelled out, then the list is reloaded so the shown data matches the server.
 */
import { useCallback, useMemo } from 'react';
import { AdminStorage, type AdminUser } from '../../../services/adminStorage';
import type { Department, PermissionDef, Role } from '../../../types/admin';
import { ApiError, getErrorMessage } from '../../../services/api';
import { useAsyncData, type AsyncResource } from '../../../hooks/useAsyncData';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { getUserRights, type RightsContext, type ToggleableAdminStatus, type UserRights } from './usersModel';

export interface DirectoryReference {
  roles: Role[];
  departments: Department[];
  permissions: PermissionDef[];
}

const EMPTY_REFERENCE: DirectoryReference = { roles: [], departments: [], permissions: [] };

export interface UsersDirectory {
  users: AsyncResource<AdminUser[]>;
  reference: AsyncResource<DirectoryReference>;
  rightsById: Map<string, UserRights>;
  setStatus: (user: AdminUser, status: ToggleableAdminStatus) => Promise<void>;
  setManyStatus: (users: AdminUser[], status: ToggleableAdminStatus) => Promise<void>;
  remove: (user: AdminUser) => Promise<void>;
  resendVerification: (user: AdminUser) => Promise<void>;
  markVerified: (user: AdminUser) => Promise<void>;
  resetTotp: (user: AdminUser) => Promise<void>;
  resetPasskeys: (user: AdminUser) => Promise<void>;
}

export function useUsersDirectory(showToast: (message: string) => void): UsersDirectory {
  const { currentUser, isSuperAdmin, can, confirm, confirmDelete } = useAdmin();
  const { t } = useAdminT();

  const users = useAsyncData<AdminUser[]>(useCallback((signal) => AdminStorage.getUsers(signal), []), [], []);
  const reloadUsers = users.reload;

  const reference = useAsyncData<DirectoryReference>(
    useCallback(async (signal) => {
      const [roles, departments, permissions] = await Promise.all([
        AdminStorage.listRoles(signal),
        AdminStorage.listDepartments(signal),
        AdminStorage.listPermissions(signal),
      ]);
      return { roles, departments, permissions };
    }, []),
    [],
    EMPTY_REFERENCE
  );

  const activeSuperAdminCount = useMemo(
    () => users.data.filter((user) => user.role === 'super_admin' && user.status === 'active').length,
    [users.data]
  );

  const rightsContext = useMemo<RightsContext>(
    () => ({
      currentUserId: currentUser?.id ?? null,
      isSuperAdmin,
      canVerifyUsers: isSuperAdmin || can('verifyUsers'),
      canManageUsers: isSuperAdmin || can('manageUsers'),
      activeSuperAdminCount,
    }),
    [currentUser?.id, isSuperAdmin, can, activeSuperAdminCount]
  );

  const rightsById = useMemo(
    () => new Map(users.data.map((user) => [user.id, getUserRights(user, rightsContext)] as const)),
    [users.data, rightsContext]
  );

  const setStatus = useCallback(
    async (user: AdminUser, status: ToggleableAdminStatus) => {
      const isAct = status === 'active';
      const ok = await confirm({
        title: isAct ? t('users.confirmActivateTitle', { name: user.name }) : t('users.confirmSuspendTitle', { name: user.name }),
        message: isAct ? t('users.confirmActivateMessage') : t('users.confirmSuspendMessage'),
        confirmLabel: isAct ? t('users.activateAccount') : t('users.suspendAccount'),
        danger: !isAct,
        rememberKey: 'user.status',
      });
      if (!ok) return;
      try {
        await AdminStorage.setUserStatus(user.id, status);
        await reloadUsers();
        showToast(isAct ? t('users.toastActivated', { name: user.name }) : t('users.toastSuspended', { name: user.name }));
      } catch (error) {
        showToast(getErrorMessage(error, t('users.toastStatusError')));
      }
    },
    [confirm, reloadUsers, showToast, t]
  );

  /**
   * Bulk activate/suspend. Accounts the server would reject — the admin's own,
   * protected super admins — are skipped instead of failed, and the toast reports
   * how many were left out so the result never reads as a full success.
   */
  const setManyStatus = useCallback(
    async (selected: AdminUser[], status: ToggleableAdminStatus) => {
      if (selected.length === 0) return;
      const isAct = status === 'active';
      const label = isAct ? t('users.activate') : t('users.suspend');
      const targets = selected.filter((user) => {
        const rights = getUserRights(user, rightsContext);
        return !rights.accessLocked && user.status !== status;
      });
      const skipped = selected.length - targets.length;
      if (targets.length === 0) {
        showToast(t('users.bulkNoEligible'));
        return;
      }

      const baseMessage = isAct ? t('users.confirmActivateMessage') : t('users.confirmSuspendMessage');
      const detail = skipped > 0 ? t('users.bulkSkipNotice', { count: skipped }) : t('users.bulkOnlySelectedNotice');
      const ok = await confirm({
        title: t('users.confirmBulkTitle', { action: label, count: targets.length }),
        message: `${baseMessage} ${detail}`,
        confirmLabel: isAct ? t('users.activateAccount') : t('users.suspendAccount'),
        danger: !isAct,
      });
      if (!ok) return;

      let failures = 0;
      for (const user of targets) {
        try {
          await AdminStorage.setUserStatus(user.id, status);
        } catch {
          failures += 1;
        }
      }
      await reloadUsers();

      const succeeded = targets.length - failures;
      showToast(t('users.toastBulkSuccess', { action: label, count: succeeded, total: selected.length }));
    },
    [confirm, rightsContext, reloadUsers, showToast, t]
  );

  const remove = useCallback(
    async (user: AdminUser) => {
      const ok = await confirmDelete({
        title: t('users.confirmDeleteTitle', { name: user.name }),
        message: t('users.confirmDeleteMessage'),
        confirmLabel: t('users.confirmDeleteBtn'),
      });
      if (!ok) return;
      try {
        await AdminStorage.deleteUser(user.id);
        await reloadUsers();
        showToast(t('users.toastDeleted', { name: user.name }));
      } catch (error) {
        showToast(getErrorMessage(error, t('users.toastDeleteError')));
      }
    },
    [confirmDelete, reloadUsers, showToast, t]
  );

  /**
   * Sends a fresh activation link for an account the server still holds as
   * pending. No confirm dialog: the action is cheap, repeatable and harmless,
   * and only a throttled request (429) has something worth stating verbatim.
   */
  const resendVerification = useCallback(
    async (user: AdminUser) => {
      try {
        await AdminStorage.resendVerification(user.id);
        await reloadUsers();
        showToast(t('users.toastResent', { name: user.name }));
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) showToast(error.message);
        else showToast(getErrorMessage(error, t('users.toastResendError')));
      }
    },
    [reloadUsers, showToast, t]
  );

  /**
   * Marks a pending account as verified without the emailed link or code.
   * Needs `verifyUsers` (server-enforced); the confirm dialog explains the
   * email check is being skipped. A verified invite account still needs a
   * password via "Forgot password".
   */
  const markVerified = useCallback(
    async (user: AdminUser) => {
      const ok = await confirm({
        title: t('users.confirmMarkVerifiedTitle'),
        message: t('users.confirmMarkVerifiedMessage', { name: user.name }),
        confirmLabel: t('users.markVerified'),
        danger: false,
      });
      if (!ok) return;
      try {
        const result = await AdminStorage.markVerified(user.id);
        await reloadUsers();
        if (result.needsPassword) {
          showToast(t('users.toastMarkVerifiedNeedsPassword', { name: user.name }));
        } else {
          showToast(t('users.toastMarkVerifiedSuccess', { name: user.name }));
        }
      } catch (error) {
        showToast(getErrorMessage(error, t('users.toastMarkVerifiedError')));
      }
    },
    [confirm, reloadUsers, showToast, t]
  );

  /**
   * Clears an account's authenticator-app 2FA after a lost or replaced phone.
   * The server guards who may do this; the UI pre-filters with rights.
   */
  const resetTotp = useCallback(
    async (user: AdminUser) => {
      const ok = await confirm({
        title: t('users.confirmResetTotpTitle'),
        message: t('users.confirmResetTotpMessage', { name: user.name }),
        confirmLabel: t('users.resetTotp'),
        danger: true,
      });
      if (!ok) return;
      try {
        await AdminStorage.resetUserTotp(user.id);
        await reloadUsers();
        showToast(t('users.toastResetTotpSuccess', { name: user.name }));
      } catch (error) {
        showToast(getErrorMessage(error, t('users.toastResetTotpError')));
      }
    },
    [confirm, reloadUsers, showToast, t]
  );

  /**
   * Clears an account's passkeys after a lost or replaced device.
   * The server guards who may do this; the UI pre-filters with rights.
   */
  const resetPasskeys = useCallback(
    async (user: AdminUser) => {
      const ok = await confirm({
        title: t('users.confirmResetPasskeysTitle'),
        message: t('users.confirmResetPasskeysMessage', { name: user.name }),
        confirmLabel: t('users.resetPasskeys'),
        danger: true,
      });
      if (!ok) return;
      try {
        await AdminStorage.resetUserPasskeys(user.id);
        await reloadUsers();
        showToast(t('users.toastResetPasskeysSuccess', { name: user.name }));
      } catch (error) {
        showToast(getErrorMessage(error, t('users.toastResetPasskeysError')));
      }
    },
    [confirm, reloadUsers, showToast, t]
  );

  return {
    users,
    reference,
    rightsById,
    setStatus,
    setManyStatus,
    remove,
    resendVerification,
    markVerified,
    resetTotp,
    resetPasskeys,
  };
}
