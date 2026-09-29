import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Property, CustomerInquiry } from '../../types/property';
import type { AdminUser } from '../../types/admin';
import { AdminStorage } from '../../services/adminStorage';
import { getErrorMessage } from '../../services/api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { applyUnitStatus, removeUnit, useRealtimeUnits } from '../../hooks/useRealtimeUnits';
import { AdminSidebar } from '../../components/admin/layout/AdminSidebar';
import { AdminPageHeader } from '../../components/admin/layout/AdminPageHeader';
import { ConfirmDialog } from '../../components/admin/common/ConfirmDialog';
import { NoAccess } from '../../components/admin/common/SectionState';
import {
  AdminContext,
  HeaderActionsSlotContext,
  type AdminContextValue,
  type AdminPermission,
  type ConfirmOptions,
} from './adminContextDef';
import { buildAdminPath, parseAdminPath, type AdminLocation, type AdminSection } from './adminRoutes';
import { OverviewSection } from './sections/OverviewSection';
import { ProjectsSection } from './sections/ProjectsSection';
import { UnitsSection } from './sections/UnitsSection';
import { InquiriesSection } from './sections/InquiriesSection';
import { CategoriesSection } from './sections/CategoriesSection';
import { ProjectShowSection } from './sections/ProjectShowSection';
import { ProjectEditSection } from './sections/ProjectEditSection';
import { UsersPermissionsManager } from '../../components/admin/UsersPermissionsManager';

interface AdminDashboardPageProps {
  /** Path after `/admin/`, e.g. "projects" or "projects/206/units". */
  adminPath?: string;
  onAdminNavigate: (adminPath: string, options?: { replace?: boolean }) => void;
  onLogout: () => void;
  /** Kept for App compatibility; the sidebar now opens the site in a new tab. */
  onNavigateHome?: () => void;
  onShowToast: (msg: string) => void;
}

const SECTION_META: Record<AdminSection, { title: string; subtitle: string; permission?: AdminPermission }> = {
  overview: { title: 'لوحة التحكم والمؤشرات', subtitle: 'متابعة المحفظة العقارية، نسب الإشغال وطلبات العملاء' },
  projects: { title: 'المشاريع العقارية', subtitle: 'إضافة المشاريع وتعديل بياناتها وصورها ومواقعها' },
  project: { title: 'تفاصيل المشروع', subtitle: 'بيانات المشروع ووحداته وطلبات الاهتمام به' },
  projectEdit: { title: 'تعديل المشروع', subtitle: 'تعديل بيانات العرض العامة للمشروع', permission: 'manageProjects' },
  units: { title: 'المخطط البصري للأدوار', subtitle: 'إدارة الأدوار والوحدات وحالاتها لحظياً' },
  inquiries: {
    title: 'طلبات الاهتمام والعملاء',
    subtitle: 'متابعة الطلبات الواردة من الموقع وتحديث حالاتها',
    permission: 'viewInquiries',
  },
  categories: { title: 'التصنيفات والوسوم', subtitle: 'تصنيفات المشاريع والوسوم المعتمدة' },
  users: { title: 'المستخدمون والصلاحيات', subtitle: 'أعضاء الفريق وأذونات الوصول', permission: 'manageUsers' },
};

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  adminPath,
  onAdminNavigate,
  onLogout,
  onShowToast,
}) => {
  const location = useMemo(() => parseAdminPath(adminPath), [adminPath]);

  // Stable callbacks: App re-creates its handlers on every render.
  const onAdminNavigateRef = useRef(onAdminNavigate);
  onAdminNavigateRef.current = onAdminNavigate;
  const navigate = useCallback((next: AdminLocation, options?: { replace?: boolean }) => {
    onAdminNavigateRef.current(buildAdminPath(next), options);
  }, []);

  const showToastRef = useRef(onShowToast);
  showToastRef.current = onShowToast;
  const showToast = useCallback((message: string) => showToastRef.current(message), []);

  /* ------------------------------ Identity ------------------------------ */

  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);
  useEffect(() => {
    let cancelled = false;
    AdminStorage.getCurrentUser()
      .then((user) => {
        if (!cancelled) setCurrentUser(user);
      })
      .catch(() => {
        // api.ts clears the token and App redirects to the login portal on 401.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const can = useCallback(
    (permission: AdminPermission) => Boolean(currentUser && (isSuperAdmin || currentUser.permissions[permission])),
    [currentUser, isSuperAdmin]
  );
  const canViewInquiries = can('viewInquiries');

  /* -------------------------------- Data -------------------------------- */

  const projects = useAsyncData<Property[]>(
    useCallback((signal) => AdminStorage.getAllProjects({}, signal), []),
    [],
    []
  );

  // Only fetched when permitted: a 403 here used to blank the whole dashboard.
  const inquiries = useAsyncData<CustomerInquiry[]>(
    useCallback(
      (signal) => (canViewInquiries ? AdminStorage.getInquiries({}, signal) : Promise.resolve([])),
      [canViewInquiries]
    ),
    [canViewInquiries],
    []
  );

  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const setProjects = projects.setData;
  const reloadInquiries = inquiries.reload;
  useRealtimeUnits({
    onUnitStatus: useCallback((event) => setProjects((current) => applyUnitStatus(current, event)), [setProjects]),
    onUnitRemoved: useCallback((event) => setProjects((current) => removeUnit(current, event)), [setProjects]),
    onInquiryCreated: useCallback(() => {
      if (canViewInquiries) void reloadInquiries();
    }, [canViewInquiries, reloadInquiries]),
    onConnectionChange: useCallback((connected) => setRealtimeConnected(connected), []),
  });

  const reloadProjects = projects.reload;
  const refreshAll = useCallback(async () => {
    try {
      await Promise.all([reloadProjects(), canViewInquiries ? reloadInquiries() : Promise.resolve()]);
      showToast('تم تحديث البيانات');
    } catch (error) {
      showToast(getErrorMessage(error, 'تعذر تحديث البيانات'));
    }
  }, [reloadProjects, reloadInquiries, canViewInquiries, showToast]);

  /* ------------------------------- Confirm ------------------------------ */

  const [pendingConfirm, setPendingConfirm] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPendingConfirm({ options, resolve })),
    []
  );
  const resolveConfirm = useCallback(
    (value: boolean) => {
      pendingConfirm?.resolve(value);
      setPendingConfirm(null);
    },
    [pendingConfirm]
  );

  /* ------------------------------- Layout ------------------------------- */

  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const meta = SECTION_META[location.section];
  // Project pages show the project's own name as the title.
  const currentProject =
    location.section === 'project' || location.section === 'projectEdit'
      ? projects.data.find((p) => p.id === location.projectId)
      : undefined;
  const pageTitle = currentProject
    ? location.section === 'projectEdit'
      ? `تعديل: ${currentProject.title}`
      : currentProject.title
    : meta.title;
  const allowed = !meta.permission || can(meta.permission);

  // Canonicalise the URL (bare /admin, unknown sections) without a new history
  // entry. The units section pins its own project id.
  useEffect(() => {
    if (location.section === 'units') return;
    const canonical = buildAdminPath(location);
    if ((adminPath ?? '') !== canonical) navigate(location, { replace: true });
  }, [adminPath, location, navigate]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    document.title = `${pageTitle} | لوحة تحكم أجدا`;
  }, [location.section, pageTitle]);

  const contextValue = useMemo<AdminContextValue>(
    () => ({
      currentUser,
      can,
      isSuperAdmin,
      projects,
      inquiries,
      realtimeConnected,
      location,
      navigate,
      showToast,
      confirm,
      refreshAll,
    }),
    [currentUser, can, isSuperAdmin, projects, inquiries, realtimeConnected, location, navigate, showToast, confirm, refreshAll]
  );

  const renderSection = () => {
    // Wait for the identity before declaring a permission-gated section forbidden.
    if (meta.permission && !currentUser) return null;
    if (!allowed) return <NoAccess />;

    switch (location.section) {
      case 'overview':
        return <OverviewSection />;
      case 'projects':
        return <ProjectsSection />;
      case 'project':
        return <ProjectShowSection />;
      case 'projectEdit':
        return <ProjectEditSection />;
      case 'units':
        return <UnitsSection />;
      case 'inquiries':
        return <InquiriesSection />;
      case 'categories':
        return <CategoriesSection />;
      case 'users':
        return <UsersPermissionsManager onShowToast={showToast} />;
    }
  };

  return (
    <AdminContext.Provider value={contextValue}>
      <HeaderActionsSlotContext.Provider value={actionsSlot}>
        <div className="min-h-screen bg-canvas flex text-xs selection:bg-accent selection:text-white">
          <AdminSidebar
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onLogout={onLogout}
          />

          <main ref={mainRef} className="flex-1 min-w-0 h-screen overflow-y-auto flex flex-col">
            <AdminPageHeader
              title={pageTitle}
              subtitle={meta.subtitle}
              onOpenMenu={() => setMenuOpen(true)}
              actionsSlotRef={setActionsSlot}
            />
            <div className="p-4 sm:p-6 flex-1">{renderSection()}</div>
          </main>
        </div>

        {pendingConfirm && <ConfirmDialog options={pendingConfirm.options} onResolve={resolveConfirm} />}
      </HeaderActionsSlotContext.Provider>
    </AdminContext.Provider>
  );
};
