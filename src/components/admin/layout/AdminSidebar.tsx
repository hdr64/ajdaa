import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  Building2,
  Layers,
  Tags,
  Users,
  LogOut,
  ExternalLink,
  ShieldCheck,
  KeyRound,
  Building,
  Mail,
  Settings,
  Globe,
  Archive,
  X as CloseIcon,
  Moon,
  Sun,
  Sparkles,
  PanelRightClose,
  PanelRightOpen,
  type LucideIcon,
} from 'lucide-react';
import { useAdmin, type AdminPermission } from '../../../pages/admin/adminContextDef';
import { navSectionOf, type AdminSection } from '../../../pages/admin/adminRoutes';
import { publicSiteUrl } from '../../../pages/admin/projectLabels';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { useTheme } from '../../../hooks/useTheme';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { AdminLanguageToggle } from './AdminLanguageToggle';

interface NavItem {
  section: AdminSection;
  label: string;
  icon: LucideIcon;
  /** Hidden unless the admin holds this permission. */
  permission?: AdminPermission;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Navigation groups, re-built when the language changes so every label follows it. */
function navGroups(t: (key: any) => string): NavGroup[] {
  return [
    { label: t('layout.nav.group.main'), items: [{ section: 'overview', label: t('layout.nav.overview'), icon: LayoutDashboard }] },
    {
      label: t('layout.nav.group.portfolio'),
      items: [
        { section: 'projects', label: t('layout.nav.projects'), icon: Building2 },
        { section: 'units', label: t('layout.nav.units'), icon: Layers },
        { section: 'categories', label: t('layout.nav.categories'), icon: Tags },
      ],
    },
    {
      label: t('layout.nav.group.content'),
      items: [
        { section: 'cms', label: t('layout.nav.cms'), icon: Globe, permission: 'manageCms' },
        { section: 'pastProjects', label: t('layout.nav.pastProjects'), icon: Archive, permission: 'managePastProjects' },
      ],
    },
    {
      label: t('layout.nav.group.customers'),
      items: [
        { section: 'inquiries', label: t('layout.nav.inquiries'), icon: Users, permission: 'viewInquiries' },
        { section: 'applications', label: t('layout.nav.applications'), icon: Users, permission: 'viewApplications' },
        { section: 'newsletter', label: t('layout.nav.newsletter'), icon: Mail, permission: 'exportData' },
      ],
    },
    {
      label: t('layout.nav.group.management'),
      items: [
        { section: 'users', label: t('layout.nav.users'), icon: ShieldCheck, permission: 'manageUsers' },
        { section: 'roles', label: t('layout.nav.roles'), icon: KeyRound, permission: 'manageUsers' },
        { section: 'departments', label: t('layout.nav.departments'), icon: Building, permission: 'manageUsers' },
        { section: 'settings', label: t('layout.nav.settings'), icon: Settings, permission: 'manageNotifications' },
      ],
    },
  ];
}

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

/**
 * First letter only: Arabic surnames usually start with "ال", so two-word
 * initials render as "سا" for "سلطان المقرن".
 */
function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '…';
}

const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ open, onClose, onLogout }) => {
  const { t } = useAdminT();
  const { can, currentUser, location, navigate, projects, inquiries } = useAdmin();
  const { theme, toggleTheme, variant, toggleVariant } = useTheme();
  // Desktop only: an icon rail that leaves more room for wide tables and the floor plan.
  const [collapsed, setCollapsed] = usePersistentState<boolean>('ajda.admin.sidebar.collapsed', false, isBoolean);
  const rail = collapsed && !open;

  const groups = useMemo(
    () =>
      navGroups(t).map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.permission || can(item.permission)),
      })).filter((group) => group.items.length > 0),
    [can, t]
  );

  const totalUnits = useMemo(
    () => projects.data.reduce((sum, p) => sum + (p.floors ?? []).reduce((s, f) => s + f.units.length, 0), 0),
    [projects.data]
  );
  const drafts = useMemo(() => projects.data.filter((p) => p.publishStatus === 'draft').length, [projects.data]);
  const newInquiries = useMemo(() => inquiries.data.filter((i) => i.status === 'new').length, [inquiries.data]);

  /** A number shown next to the label; `alert` ones are coloured and survive in rail mode as a dot. */
  const badgeFor = (section: AdminSection): { value: number; alert?: boolean; title?: string } | null => {
    if (section === 'projects') {
      return drafts > 0
        ? { value: drafts, alert: true, title: t('layout.badge.drafts', { count: drafts }) }
        : { value: projects.data.length, title: `${projects.data.length} ${t('layout.nav.projects')}` };
    }
    if (section === 'units') {
      return totalUnits ? { value: totalUnits, title: `${totalUnits} ${t('layout.nav.units')}` } : null;
    }
    if (section === 'inquiries') {
      return newInquiries
        ? { value: newInquiries, alert: true, title: t('layout.badge.newInquiries', { count: newInquiries }) }
        : null;
    }
    return null;
  };

  const activeNav = navSectionOf(location.section);

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed md:sticky top-0 z-50 md:z-auto h-screen shrink-0 bg-surface border-e border-muted-border/40 flex flex-col transition-[width,transform] duration-300 start-0 ${
          rail ? 'md:w-[76px] w-72' : 'w-72'
        } ${open ? 'translate-x-0' : 'max-md:ltr:-translate-x-full max-md:rtl:translate-x-full'}`}
        aria-label={t('layout.sidebar.aria')}
      >
        {/* Brand */}
        <div className={`flex items-center gap-3 border-b border-muted-border/30 ${rail ? 'md:justify-center md:px-2 px-4' : 'px-4'} h-16 sm:h-20 shrink-0`}>
          <div className="w-10 h-10 rounded-xl brand-fill text-canvas flex items-center justify-center font-black text-sm shadow-md shrink-0">
            {t('layout.brand.short')}
          </div>
          <div className={`min-w-0 flex-1 ${rail ? 'md:hidden' : ''}`}>
            <div className="text-xs font-black text-heading truncate">{t('layout.brand.name')}</div>
            <div className="text-[10px] text-accent font-bold">{t('layout.brand.dashboard')}</div>
          </div>
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
            aria-label={t('layout.sidebar.close')}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <div className={`px-3 mb-1.5 text-[10px] font-black uppercase tracking-wide text-neutral-text/40 ${rail ? 'md:hidden' : ''}`}>
                {group.label}
              </div>
              {rail && <div className="hidden md:block mx-3 mb-2 border-t border-muted-border/30" aria-hidden="true" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeNav === item.section;
                  const badge = badgeFor(item.section);
                  const Icon = item.icon;
                  return (
                    <li key={item.section}>
                      <button
                        onClick={() => {
                          navigate({ section: item.section });
                          onClose();
                        }}
                        aria-current={active ? 'page' : undefined}
                        title={rail ? `${item.label}${badge?.title ? ` · ${badge.title}` : ''}` : badge?.title}
                        className={`relative w-full flex items-center gap-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                          rail ? 'md:justify-center md:px-0 md:py-2.5 px-3 py-2.5' : 'px-3 py-2.5'
                        } ${
                          active
                            ? 'bg-accent/12 text-accent'
                            : 'text-neutral-text/70 hover:bg-surface-hover hover:text-heading'
                        }`}
                      >
                        {/* Active marker on the inline-start edge */}
                        {active && <span className="absolute inset-y-2 start-0 w-1 rounded-e-full bg-accent" aria-hidden="true" />}
                        <Icon className="w-[18px] h-[18px] shrink-0" />
                        <span className={`flex-1 text-start truncate ${rail ? 'md:hidden' : ''}`}>{item.label}</span>
                        {badge && (
                          <span
                            title={badge.title}
                            className={`${rail ? 'md:hidden' : ''} min-w-6 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums text-center ${
                              badge.alert ? 'bg-amber-500 text-neutral-950 ring-1 ring-amber-400' : 'bg-canvas border border-muted-border/40 text-neutral-text/75 font-bold'
                            }`}
                          >
                            {badge.value}
                          </span>
                        )}
                        {rail && badge?.alert && (
                          <span className="hidden md:block absolute top-1.5 end-3 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-surface" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: user card + quick actions */}
        <div className="border-t border-muted-border/30 p-3 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              navigate({ section: 'profile' });
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 p-2 rounded-xl border transition text-start cursor-pointer group ${
              location.section === 'profile'
                ? 'bg-accent/10 border-accent/40 text-accent'
                : 'bg-canvas/70 border-transparent hover:bg-surface-hover hover:border-muted-border/40'
            } ${rail ? 'md:justify-center' : ''}`}
            title={rail ? `${currentUser?.name ?? ''} · ${t('common.entity.profile')}` : undefined}
          >
            {currentUser?.avatar ? (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-9 h-9 rounded-xl object-cover shrink-0 border border-muted-border/40 shadow-xs"
              />
            ) : (
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border transition ${
                  location.section === 'profile'
                    ? 'bg-accent text-canvas border-accent'
                    : 'bg-accent/15 text-accent border-accent/25 group-hover:bg-accent group-hover:text-canvas'
                }`}
              >
                {currentUser ? initialsOf(currentUser.name) : '…'}
              </div>
            )}
            <div className={`min-w-0 flex-1 ${rail ? 'md:hidden' : ''}`}>
              <div className="text-xs font-bold text-heading truncate">{currentUser?.name ?? '…'}</div>
              <div className="text-[10px] text-neutral-text/55 truncate">
                {currentUser?.roleAr ?? '…'} · {t('common.entity.profile')}
              </div>
            </div>
          </button>

          <AdminLanguageToggle />
          <div className={`grid gap-1 ${rail ? 'md:grid-cols-1 grid-cols-5' : 'grid-cols-5'}`}>
            {[
              {
                key: 'theme',
                label: theme === 'dark' ? t('layout.theme.toLight') : t('layout.theme.toDark'),
                icon: theme === 'dark' ? Sun : Moon,
                onClick: toggleTheme,
              },
              {
                key: 'variant',
                label: variant === 'prime' ? t('layout.variant.classic') : t('layout.variant.prime'),
                icon: Sparkles,
                onClick: toggleVariant,
              },
              {
                key: 'collapse',
                label: collapsed ? t('layout.sidebar.expand') : t('layout.sidebar.collapse'),
                icon: collapsed ? PanelRightOpen : PanelRightClose,
                onClick: () => setCollapsed(!collapsed),
                desktopOnly: true,
              },
            ].map(({ key, label, icon: Icon, onClick, desktopOnly }) => (
              <button
                key={key}
                type="button"
                onClick={onClick}
                title={label}
                aria-label={label}
                className={`${desktopOnly ? 'hidden md:flex' : 'flex'} items-center justify-center p-2 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-surface-hover cursor-pointer`}
              >
                <Icon className="w-4 h-4 ltr:rotate-180" />
              </button>
            ))}
            {/* New tab: the admin session and any unsaved edit stay open. */}
            <a
              href={publicSiteUrl()}
              target="_blank"
              rel="noopener noreferrer"
              title={t('layout.action.openSite')}
              aria-label={t('layout.action.openSite')}
              className="flex items-center justify-center p-2 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-surface-hover"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={onLogout}
              title={t('layout.action.logout')}
              aria-label={t('layout.action.logout')}
              className="flex items-center justify-center p-2 rounded-lg text-red-500/80 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4 ltr:rotate-180" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
