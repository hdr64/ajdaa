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
  X as CloseIcon,
  type LucideIcon,
} from 'lucide-react';
import { useAdmin, type AdminPermission } from '../../../pages/admin/adminContextDef';
import { navSectionOf, type AdminSection } from '../../../pages/admin/adminRoutes';

interface NavItem {
  section: AdminSection;
  label: string;
  icon: LucideIcon;
  /** Hidden unless the admin holds this permission. */
  permission?: AdminPermission;
}

const NAV_ITEMS: NavItem[] = [
  { section: 'overview', label: 'نظرة عامة ومؤشرات الأداء', icon: LayoutDashboard },
  { section: 'projects', label: 'إدارة المشاريع العقارية', icon: Building2 },
  { section: 'units', label: 'المخطط البصري للأدوار', icon: Layers },
  { section: 'inquiries', label: 'طلبات الاهتمام والعملاء', icon: Users, permission: 'viewInquiries' },
  { section: 'categories', label: 'التصنيفات والوسوم', icon: Tags },
  { section: 'users', label: 'المستخدمين والصلاحيات', icon: ShieldCheck, permission: 'manageUsers' },
];

function visibleNavItems(can: (permission: AdminPermission) => boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.permission || can(item.permission));
}

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
  onNavigateHome: () => void;
}

/**
 * First letter only: Arabic surnames usually start with "ال", so two-word
 * initials render as "سا" for "سلطان المقرن".
 */
function initialsOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '…';
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ open, onClose, onLogout, onNavigateHome }) => {
  const { can, currentUser, location, navigate, projects, inquiries } = useAdmin();
  const items = useMemo(() => visibleNavItems(can), [can]);

  const totalUnits = useMemo(
    () => projects.data.reduce((sum, p) => sum + (p.floors ?? []).reduce((s, f) => s + f.units.length, 0), 0),
    [projects.data]
  );
  const newInquiries = useMemo(() => inquiries.data.filter((i) => i.status === 'new').length, [inquiries.data]);

  const badgeFor = (section: AdminSection): React.ReactNode => {
    if (section === 'projects') return projects.data.length || null;
    if (section === 'units') return totalUnits || null;
    return null;
  };

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
        className={`fixed md:sticky top-0 z-50 md:z-auto h-screen w-72 shrink-0 bg-surface border-e border-muted-border/40 flex flex-col justify-between p-4 shadow-sm overflow-y-auto transition-transform duration-300 start-0 ${
          open ? 'translate-x-0' : 'max-md:ltr:-translate-x-full max-md:rtl:translate-x-full'
        }`}
        aria-label="قائمة لوحة التحكم"
      >
        <div>
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-br from-surface to-surface-hover border border-muted-border/50 shadow-xs mb-5">
            <div className="w-10 h-10 rounded-xl brand-fill text-canvas flex items-center justify-center font-black text-sm shadow-md ring-2 ring-accent/20 shrink-0">
              أجدا
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-black text-heading truncate">أجدا للتطوير العقاري</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-accent font-bold">بوابة الإدارة التنفيذية</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
              aria-label="إغلاق القائمة"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Signed-in admin */}
          <div className="p-3 rounded-2xl bg-canvas/70 border border-muted-border/30 mb-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-black text-xs shrink-0 border border-accent/25">
              {currentUser ? initialsOf(currentUser.name) : '…'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-heading truncate">{currentUser?.name ?? '…'}</div>
              <div className="text-[10px] text-gold font-medium truncate">{currentUser?.roleAr ?? '…'}</div>
            </div>
          </div>

          <nav className="space-y-1.5 font-bold">
            {items.map((item) => {
              const active = navSectionOf(location.section) === item.section;
              const badge = badgeFor(item.section);
              const Icon = item.icon;
              return (
                <button
                  key={item.section}
                  onClick={() => {
                    navigate({ section: item.section });
                    onClose();
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer text-xs ${
                    active
                      ? 'brand-fill text-canvas shadow-md'
                      : 'text-neutral-text/75 hover:bg-surface-hover hover:text-heading'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </span>
                  {item.section === 'inquiries' && newInquiries > 0 ? (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                      {newInquiries} جديد
                    </span>
                  ) : (
                    badge !== null && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                          active ? 'bg-canvas/20 text-canvas' : 'bg-canvas border border-muted-border/40 text-neutral-text/70'
                        }`}
                      >
                        {badge}
                      </span>
                    )
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 mt-6 border-t border-muted-border/30 space-y-2 text-xs">
          <button
            onClick={onNavigateHome}
            className="w-full p-2.5 rounded-xl border border-muted-border/40 hover:border-accent hover:bg-accent/5 flex items-center justify-center gap-2 text-neutral-text/80 hover:text-accent font-bold transition cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>عرض الموقع الحي</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center gap-2 font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج الآمن</span>
          </button>
        </div>
      </aside>
    </>
  );
};
