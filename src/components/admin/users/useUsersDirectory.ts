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
import type { AdminStatus, Department, PermissionDef, Role } from '../../../types/admin';
import { getErrorMessage } from '../../../services/api';
import { useAsyncData, type AsyncResource } from '../../../hooks/useAsyncData';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { getUserRights, type RightsContext, type UserRights } from './usersModel';

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
  setStatus: (user: AdminUser, status: AdminStatus) => Promise<void>;
  setManyStatus: (users: AdminUser[], status: AdminStatus) => Promise<void>;
  remove: (user: AdminUser) => Promise<void>;
}

interface StatusCopy {
  /** Verb used in the single-account confirm title. */
  label: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
}

const STATUS_COPY: Record<AdminStatus, StatusCopy> = {
  active: {
    label: 'تنشيط',
    message: 'سيتمكن من الدخول إلى لوحة التحكم فوراً بجميع صلاحياته.',
    confirmLabel: 'تنشيط الحساب',
    danger: false,
  },
  suspended: {
    label: 'تعطيل',
    message: 'سيتم تسجيل خروجه فوراً ولن يتمكن من الدخول حتى إعادة التنشيط.',
    confirmLabel: 'تعطيل الحساب',
    danger: true,
  },
};

const DELETE_CONFIRM = {
  title: (name: string) => `حذف المستخدم "${name}"؟`,
  message: 'سيفقد هذا الحساب الوصول إلى لوحة التحكم نهائياً، وسيُحذف من النظام ولا يمكن التراجع عن ذلك.',
  confirmLabel: 'حذف المستخدم',
};

export function useUsersDirectory(showToast: (message: string) => void): UsersDirectory {
  const { currentUser, isSuperAdmin, confirm } = useAdmin();

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
    () => ({ currentUserId: currentUser?.id ?? null, isSuperAdmin, activeSuperAdminCount }),
    [currentUser?.id, isSuperAdmin, activeSuperAdminCount]
  );

  const rightsById = useMemo(
    () => new Map(users.data.map((user) => [user.id, getUserRights(user, rightsContext)] as const)),
    [users.data, rightsContext]
  );

  const setStatus = useCallback(
    async (user: AdminUser, status: AdminStatus) => {
      const copy = STATUS_COPY[status];
      const ok = await confirm({
        title: `${copy.label} حساب "${user.name}"؟`,
        message: copy.message,
        confirmLabel: copy.confirmLabel,
        danger: copy.danger,
      });
      if (!ok) return;
      try {
        await AdminStorage.setUserStatus(user.id, status);
        await reloadUsers();
        showToast(`تم ${copy.label} حساب ${user.name}`);
      } catch (error) {
        showToast(getErrorMessage(error, 'تعذر تغيير حالة الحساب'));
      }
    },
    [confirm, reloadUsers, showToast]
  );

  /**
   * Bulk activate/suspend. Accounts the server would reject — the admin's own,
   * protected super admins — are skipped instead of failed, and the toast reports
   * how many were left out so the result never reads as a full success.
   */
  const setManyStatus = useCallback(
    async (selected: AdminUser[], status: AdminStatus) => {
      if (selected.length === 0) return;
      const copy = STATUS_COPY[status];
      const targets = selected.filter((user) => {
        const rights = getUserRights(user, rightsContext);
        return !rights.accessLocked && user.status !== status;
      });
      const skipped = selected.length - targets.length;
      if (targets.length === 0) {
        showToast('لا توجد حسابات مؤهلة لهذا الإجراء');
        return;
      }

      const ok = await confirm({
        title: `${copy.label} ${targets.length} من الحسابات المحددة؟`,
        message: `${copy.message} ${
          skipped > 0
            ? `سيتم تجاوز ${skipped} حساب محمي أو موجود في الحالة المطلوبة أصلاً.`
            : 'سيتم تطبيق الإجراء على الحسابات المحددة فقط.'
        }`,
        confirmLabel: copy.confirmLabel,
        danger: copy.danger,
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
      let message = `تم ${copy.label} ${succeeded} من ${selected.length} حساب`;
      if (skipped > 0) message += ` (تم تجاوز ${skipped} غير مؤهل)`;
      if (failures > 0) message += `، وتعذر تنفيذ ${failures} منها`;
      showToast(message);
    },
    [confirm, rightsContext, reloadUsers, showToast]
  );

  const remove = useCallback(
    async (user: AdminUser) => {
      const ok = await confirm({
        title: DELETE_CONFIRM.title(user.name),
        message: DELETE_CONFIRM.message,
        confirmLabel: DELETE_CONFIRM.confirmLabel,
        danger: true,
      });
      if (!ok) return;
      try {
        await AdminStorage.deleteUser(user.id);
        await reloadUsers();
        showToast(`تم حذف المستخدم ${user.name}`);
      } catch (error) {
        showToast(getErrorMessage(error, 'تعذر حذف المستخدم'));
      }
    },
    [confirm, reloadUsers, showToast]
  );

  return { users, reference, rightsById, setStatus, setManyStatus, remove };
}
