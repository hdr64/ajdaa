import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Property, CustomerInquiry } from '../../types/property';
import type { AdminUser } from '../../types/admin';
import { AdminStorage } from '../../services/adminStorage';
import { preferencesService, type ConfirmAction } from '../../services/authService';
import { getErrorMessage } from '../../services/api';
import { useAsyncData } from '../../hooks/useAsyncData';
import { applyUnitStatus, removeUnit, useRealtimeUnits } from '../../hooks/useRealtimeUnits';
import { AdminSidebar } from '../../components/admin/layout/AdminSidebar';
import { AdminPageHeader } from '../../components/admin/layout/AdminPageHeader';
import { newInquiryMessage, showDesktopNotification } from '../../components/admin/layout/inquiryNotifications';
import { ConfirmDialog } from '../../components/admin/common/ConfirmDialog';
import { NoAccess } from '../../components/admin/common/SectionState';
import {
  AdminContext,
  HeaderActionsSlotContext,
  type AdminContextValue,
  type AdminPermission,
  type ConfirmOptions,
  type DeleteConfirmOptions,
} from './adminContextDef';
import { buildAdminPath, parseAdminPath, type AdminLocation, type AdminSection } from './adminRoutes';
import { OverviewSection } from './sections/OverviewSection';
import { ProjectsSection } from './sections/ProjectsSection';
import { UnitsSection } from './sections/UnitsSection';
import { InquiriesSection } from './sections/InquiriesSection';
import { CategoriesSection } from './sections/CategoriesSection';
import { RolesSection } from './sections/RolesSection';
import { DepartmentsSection } from './sections/DepartmentsSection';
import { NewsletterSection } from './sections/NewsletterSection';
import { SettingsSection } from './sections/SettingsSection';
import { CmsSection } from './sections/CmsSection';
import { ProjectShowSection } from './sections/ProjectShowSection';
import { ProjectEditSection } from './sections/ProjectEditSection';
import { UsersPermissionsManager } from '../../components/admin/UsersPermissionsManager';
import { AdminProfilePage } from '../../components/admin/profile/AdminProfilePage';
import { AdminFeedbackPet } from '../../components/admin/feedback/AdminFeedbackPet';

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
  roles: {
    title: 'الأدوار والصلاحيات',
    subtitle: 'أدوار الفريق ومجموعات الصلاحيات الممنوحة لكل دور',
    permission: 'manageUsers',
  },
  departments: {
    title: 'الأقسام والإدارات',
    subtitle: 'تنظيم أعضاء الفريق في أقسام العمل',
    permission: 'manageUsers',
  },
  newsletter: {
    title: 'مشتركو النشرة البريدية',
    subtitle: 'العناوين المسجلة من نموذج الاشتراك في الموقع',
    permission: 'exportData',
  },
  settings: {
    title: 'الإعدادات',
    subtitle: 'معلومات التواصل في الموقع، الإشعارات، وخادم البريد',
    // Super admins pass `can` too; each tab narrows access further.
    permission: 'manageNotifications',
  },
  cms: {
    title: 'إدارة محتوى الموقع',
    subtitle: 'التحكم في كافة نصوص الموقع، الأقسام، الشركاء، القائمة والتذييل',
  },
  profile: {
    title: 'الملف الشخصي والحساب',
    subtitle: 'إدارة البيانات الشخصية، كلمة المرور وخيارات الأمان',
  },
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

  const refreshUser = useCallback(async () => {
    try {
      const user = await AdminStorage.getCurrentUser();
      setCurrentUser(user);
    } catch {
      // Handled by api.ts
    }
  }, []);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const can = useCallback(
    (permission: AdminPermission) => {
      if (!currentUser) return false;
      if (isSuperAdmin) return true;
      if (currentUser.permissions[permission] !== undefined) {
        return Boolean(currentUser.permissions[permission]);
      }
      if (
        permission === 'createProject' ||
        permission === 'editProject' ||
        permission === 'deleteProject' ||
        permission === 'publishProject' ||
        permission === 'viewProjects'
      ) {
        return Boolean(currentUser.permissions.manageProjects);
      }
      if (permission === 'manageClients') {
        return Boolean(currentUser.permissions.manageCms);
      }
      return false;
    },
    [currentUser, isSuperAdmin]
  );
  const canViewInquiries = can('viewInquiries');

  /* -------------------------------- Data -------------------------------- */

  const projects = useAsyncData<Property[]>(
    // Admin scope: drafts and hidden projects too (the public read returns published only).
    useCallback((signal) => AdminStorage.getAdminProjects(signal), []),
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
    onInquiryCreated: useCallback(
      (payload: unknown) => {
        if (!canViewInquiries) return;
        void reloadInquiries();
        showToast(newInquiryMessage(payload));
        showDesktopNotification(payload, () => navigate({ section: 'inquiries' }));
      },
      [canViewInquiries, reloadInquiries, showToast, navigate]
    ),
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

  // "Don't ask again" choices follow the admin across browsers (stored server-side).
  const [skipConfirm, setSkipConfirmState] = useState<ConfirmAction[]>([]);
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    preferencesService
      .get(controller.signal)
      .then((preferences) => setSkipConfirmState(preferences.skipConfirm))
      .catch(() => {
        // Without preferences every confirm simply asks, which is the safe default.
      });
    return () => controller.abort();
  }, [currentUserId]);

  const setSkipConfirm = useCallback(async (actions: ConfirmAction[]) => {
    const saved = await preferencesService.save({ skipConfirm: actions });
    setSkipConfirmState(saved.skipConfirm);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => {
      if (options.rememberKey && skipConfirm.includes(options.rememberKey)) return Promise.resolve(true);
      return new Promise<boolean>((resolve) => setPendingConfirm({ options, resolve }));
    },
    [skipConfirm]
  );
  const confirmDelete = useCallback(
    (options: DeleteConfirmOptions) =>
      confirm({
        title: options.title,
        message: options.message ?? 'لا يمكن التراجع عن هذا الإجراء.',
        confirmLabel: options.confirmLabel ?? 'حذف',
        danger: true,
      }),
    [confirm]
  );
  const resolveConfirm = useCallback(
    (value: boolean, remember: boolean) => {
      const key = pendingConfirm?.options.rememberKey;
      pendingConfirm?.resolve(value);
      setPendingConfirm(null);
      if (value && remember && key && !skipConfirm.includes(key)) {
        setSkipConfirm([...skipConfirm, key]).catch((error) =>
          showToast(getErrorMessage(error, 'تعذر حفظ اختيار «لا تسألني مرة أخرى»'))
        );
      }
    },
    [pendingConfirm, skipConfirm, setSkipConfirm, showToast]
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
  const allowed =
    location.section === 'cms'
      ? can('manageCms') || can('manageClients')
      : !meta.permission || can(meta.permission);

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
      confirmDelete,
      skipConfirm,
      setSkipConfirm,
      refreshAll,
      refreshUser,
      setCurrentUser,
    }),
    [currentUser, can, isSuperAdmin, projects, inquiries, realtimeConnected, location, navigate, showToast, confirm, confirmDelete, skipConfirm, setSkipConfirm, refreshAll, refreshUser]
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
      case 'roles':
        return <RolesSection />;
      case 'departments':
        return <DepartmentsSection />;
      case 'profile':
        return <AdminProfilePage />;
      case 'newsletter':
        return <NewsletterSection />;
      case 'settings':
        return <SettingsSection />;
      case 'cms':
        return <CmsSection />;
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

          <AdminFeedbackPet currentSection={location.section} />
        </div>

        {pendingConfirm && <ConfirmDialog options={pendingConfirm.options} onResolve={resolveConfirm} />}
      </HeaderActionsSlotContext.Provider>
    </AdminContext.Provider>
  );
};
