import React from 'react';
import { Bell, Contact, Mail, Megaphone, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { NoAccess } from '../../../components/admin/common/SectionState';
import { SiteSettingsPanel } from '../../../components/admin/settings/SiteSettingsPanel';
import { NotificationListenersPanel } from '../../../components/admin/settings/NotificationListenersPanel';
import { MailSettingsSection } from './MailSettingsSection';
import { AnnouncementPanel } from '../../../components/admin/settings/AnnouncementPanel';
import { SecurityPanel } from '../../../components/admin/settings/SecurityPanel';

type SettingsTab = 'site' | 'announcement' | 'notifications' | 'security' | 'mail';

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
  /** Contact details and SMTP are super-admin only; notifications have their own permission. */
  visible: (access: { isSuperAdmin: boolean; canNotify: boolean }) => boolean;
}

const TABS: readonly TabDef[] = [
  { id: 'site', label: 'معلومات التواصل', icon: Contact, visible: ({ isSuperAdmin }) => isSuperAdmin },
  { id: 'announcement', label: 'الإعلان والصيانة', icon: Megaphone, visible: ({ isSuperAdmin }) => isSuperAdmin },
  { id: 'notifications', label: 'الإشعارات', icon: Bell, visible: ({ canNotify }) => canNotify },
  { id: 'security', label: 'الأمان', icon: ShieldCheck, visible: ({ isSuperAdmin }) => isSuperAdmin },
  { id: 'mail', label: 'البريد (SMTP)', icon: Mail, visible: ({ isSuperAdmin }) => isSuperAdmin },
];

const isSettingsTab = (value: unknown): value is SettingsTab =>
  typeof value === 'string' && TABS.some((tab) => tab.id === value);

/** Website and dashboard settings, one tab per area. */
export const SettingsSection: React.FC = () => {
  const { isSuperAdmin, can } = useAdmin();
  const [stored, setStored] = usePersistentState<SettingsTab>('ajda.admin.settings.tab', 'site', isSettingsTab);

  const tabs = TABS.filter((tab) => tab.visible({ isSuperAdmin, canNotify: can('manageNotifications') }));
  if (tabs.length === 0) return <NoAccess />;
  // A remembered tab the admin can no longer open falls back to the first allowed one.
  const active = tabs.find((tab) => tab.id === stored) ?? tabs[0];

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="أقسام الإعدادات" className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-surface border border-muted-border/40 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = tab.id === active.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setStored(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                selected ? 'brand-fill text-canvas shadow-sm' : 'text-neutral-text/70 hover:text-heading hover:bg-canvas'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {active.id === 'site' && <SiteSettingsPanel />}
        {active.id === 'announcement' && <AnnouncementPanel />}
        {active.id === 'notifications' && <NotificationListenersPanel />}
        {active.id === 'security' && <SecurityPanel />}
        {active.id === 'mail' && <MailSettingsSection />}
      </div>
    </div>
  );
};
