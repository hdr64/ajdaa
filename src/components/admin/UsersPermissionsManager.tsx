import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, SearchX, UserPlus, Users as UsersIcon, X } from 'lucide-react';
import type { AdminPermissions, AdminStatus, AdminUser } from '../../types/admin';
import { useAdmin } from '../../pages/admin/adminContextDef';
import { usePersistentState } from '../../hooks/usePersistentState';
import { AdminHeaderActions } from './layout/AdminHeaderActions';
import { GridColumnsSwitcher, ViewSwitcher } from './common/ViewSwitcher';
import { isGridColumns, isViewMode, type GridColumns, type ViewMode } from './common/viewModes';
import { EmptyState } from './common/EmptyState';
import { SectionError, SectionLoading } from './common/SectionState';
import { useUsersDirectory } from './users/useUsersDirectory';
import { UsersTable } from './users/UsersTable';
import { UsersGrid } from './users/UsersGrid';
import { UsersList } from './users/UsersList';
import { UserFormDialog } from './users/UserFormDialog';
import { PERMISSION_LABELS, STATUS_LABELS, userSearchText } from './users/usersModel';

interface UsersPermissionsManagerProps {
  onShowToast: (msg: string) => void;
}

const VIEW_MODES: readonly ViewMode[] = ['table', 'grid', 'list'];

const VIEW_STORAGE_KEY = 'ajda.admin.users.view';
const COLUMNS_STORAGE_KEY = 'ajda.admin.users.gridColumns';

type StatusFilter = 'all' | AdminStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: STATUS_LABELS.active },
  { key: 'suspended', label: STATUS_LABELS.suspended },
];

const NEW_USER_BUTTON =
  'brand-btn-primary font-black px-3 sm:px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer shadow-md text-xs';

export const UsersPermissionsManager: React.FC<UsersPermissionsManagerProps> = ({ onShowToast }) => {
  const { isSuperAdmin } = useAdmin();
  const [view, setView] = usePersistentState<ViewMode>(VIEW_STORAGE_KEY, 'table', isViewMode);
  const [gridColumns, setGridColumns] = usePersistentState<GridColumns>(COLUMNS_STORAGE_KEY, 3, isGridColumns);

  // The table owns its own search box and filters, so a query typed for the cards
  // must not keep narrowing rows once the table takes over.
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  useEffect(() => {
    if (view === 'table') {
      setSearch('');
      setStatusFilter('all');
    }
  }, [view]);

  /** `null` means closed; `user: null` means the create form is open. */
  const [dialog, setDialog] = useState<{ user: AdminUser | null } | null>(null);

  const { users, reference, rightsById, setStatus, setManyStatus, remove } = useUsersDirectory(onShowToast);

  /** Server catalogue first, built-in labels as the offline fallback. */
  const permissionLabels = useMemo(() => {
    const labels: Record<keyof AdminPermissions, string> = { ...PERMISSION_LABELS };
    for (const definition of reference.data.permissions) labels[definition.key] = definition.labelAr;
    return labels;
  }, [reference.data.permissions]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: users.data.length, active: 0, suspended: 0 };
    for (const user of users.data) counts[user.status] += 1;
    return counts;
  }, [users.data]);

  const visibleUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return users.data.filter((user) => {
      if (statusFilter !== 'all' && user.status !== statusFilter) return false;
      if (needle === '') return true;
      return userSearchText(user).toLowerCase().includes(needle);
    });
  }, [users.data, search, statusFilter]);

  const openCreate = useCallback(() => setDialog({ user: null }), []);
  const openEdit = useCallback((user: AdminUser) => setDialog({ user }), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const toggleStatus = useCallback(
    (user: AdminUser) => void setStatus(user, user.status === 'active' ? 'suspended' : 'active'),
    [setStatus]
  );
  const deleteUser = useCallback((user: AdminUser) => void remove(user), [remove]);
  const bulkStatus = useCallback(
    (rows: AdminUser[], status: AdminStatus) => void setManyStatus(rows, status),
    [setManyStatus]
  );

  const header = (
    <AdminHeaderActions>
      <ViewSwitcher value={view} onChange={setView} modes={VIEW_MODES} />
      <button type="button" onClick={openCreate} className={NEW_USER_BUTTON}>
        <UserPlus className="w-4 h-4" />
        <span className="hidden sm:inline">مستخدم جديد</span>
      </button>
    </AdminHeaderActions>
  );

  if (users.error && users.data.length === 0) {
    return (
      <>
        {header}
        <SectionError message={users.error} onRetry={() => void users.reload()} />
      </>
    );
  }
  if (users.loading && users.data.length === 0) {
    return (
      <>
        {header}
        <SectionLoading label="جاري تحميل المستخدمين..." />
      </>
    );
  }
  if (users.data.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={UsersIcon}
          title="لا يوجد مستخدمون مسجلون"
          description="ابدأ بإضافة عضو جديد إلى فريق العمل، ثم خصّص له الدور والقسم والصلاحيات."
          action={
            <button type="button" onClick={openCreate} className={`${NEW_USER_BUTTON} px-5`}>
              <UserPlus className="w-4 h-4" />
              إضافة أول مستخدم
            </button>
          }
        />
      </>
    );
  }

  const actionProps = {
    rightsById,
    onEdit: openEdit,
    onToggleStatus: toggleStatus,
    onDelete: deleteUser,
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
  };

  const noMatches = (
    <EmptyState
      icon={SearchX}
      title="لا توجد حسابات مطابقة"
      action={
        <button
          type="button"
          onClick={clearFilters}
          className="brand-btn-secondary font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
        >
          مسح عوامل التصفية
        </button>
      }
    />
  );

  /** Cards and rows have no toolbar of their own, so this bar replaces the table's. */
  const cardToolbar = (
    <div className="p-4 rounded-2xl bg-surface border border-muted-border/40 flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="relative flex-1 lg:max-w-md">
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-text/40" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث بالاسم، البريد الإلكتروني أو القسم..."
          aria-label="بحث في المستخدمين"
          className="w-full ps-10 pe-9 py-2 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
        />
        {search !== '' && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="مسح البحث"
            className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.key}
            type="button"
            onClick={() => setStatusFilter(filter.key)}
            aria-pressed={statusFilter === filter.key}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap ${
              statusFilter === filter.key
                ? 'brand-fill text-canvas shadow-xs'
                : 'bg-canvas border border-muted-border/40 text-neutral-text/70 hover:text-heading'
            }`}
          >
            {filter.label} <span className="opacity-70">({statusCounts[filter.key]})</span>
          </button>
        ))}
      </div>

      {view === 'grid' && <GridColumnsSwitcher value={gridColumns} onChange={setGridColumns} options={[2, 3, 4]} />}
    </div>
  );

  return (
    <div className="space-y-5">
      {header}

      {view === 'table' ? (
        <UsersTable
          {...actionProps}
          users={users.data}
          roles={reference.data.roles}
          departments={reference.data.departments}
          onBulkStatus={bulkStatus}
        />
      ) : (
        <>
          {cardToolbar}
          {visibleUsers.length === 0 ? (
            noMatches
          ) : view === 'grid' ? (
            <UsersGrid
              {...actionProps}
              permissionLabels={permissionLabels}
              users={visibleUsers}
              roles={reference.data.roles}
              columns={gridColumns}
            />
          ) : (
            <UsersList {...actionProps} users={visibleUsers} roles={reference.data.roles} />
          )}
        </>
      )}

      {dialog !== null && (
        <UserFormDialog
          user={dialog.user}
          rights={dialog.user ? (rightsById.get(dialog.user.id) ?? null) : null}
          roles={reference.data.roles}
          departments={reference.data.departments}
          permissions={reference.data.permissions}
          referenceLoading={reference.loading && reference.data.permissions.length === 0}
          referenceError={reference.error}
          onRetryReference={() => void reference.reload()}
          canAssignSuperAdmin={isSuperAdmin}
          showToast={onShowToast}
          onClose={closeDialog}
          onSaved={users.reload}
        />
      )}
    </div>
  );
};
