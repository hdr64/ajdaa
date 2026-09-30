import React, { useState } from 'react';
import {
  Globe,
  Compass,
  Footprints,
  Home,
  Building,
  Users,
  Mail,
  Download,
} from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { NoAccess } from '../../../components/admin/common/SectionState';
import { CmsNavPanel } from '../../../components/admin/cms/CmsNavPanel';
import { CmsFooterPanel } from '../../../components/admin/cms/CmsFooterPanel';
import { CmsHomePanel } from '../../../components/admin/cms/CmsHomePanel';
import { CmsWorksPanel } from '../../../components/admin/cms/CmsWorksPanel';
import { CmsClientsPanel } from '../../../components/admin/cms/CmsClientsPanel';
import { CmsContactPanel } from '../../../components/admin/cms/CmsContactPanel';
import { api, getErrorMessage } from '../../../services/api';

type CmsTab = 'nav' | 'footer' | 'home' | 'works' | 'clients' | 'contact';

export const CmsSection: React.FC = () => {
  const { can, isSuperAdmin, showToast } = useAdmin();
  const [activeTab, setActiveTab] = useState<CmsTab>('home');
  const [exporting, setExporting] = useState(false);

  const canManageCms = can('manageCms');
  const canManageClients = can('manageClients');

  // Permission guard: must have at least manageCms or manageClients
  if (!canManageCms && !canManageClients) {
    return <NoAccess />;
  }

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const data = await api.get<Record<string, unknown>>('/cms/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ajda-cms-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('تم تصدير النسخة الاحتياطية للمحتوى بنجاح');
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل تصدير النسخة الاحتياطية'));
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'home' as CmsTab, label: 'الصفحة الرئيسية', icon: Home, visible: canManageCms },
    { id: 'works' as CmsTab, label: 'صفحة المشاريع', icon: Building, visible: canManageCms },
    {
      id: 'clients' as CmsTab,
      label: 'الشركاء والعملاء',
      icon: Users,
      visible: canManageClients || canManageCms,
    },
    { id: 'contact' as CmsTab, label: 'صفحة التواصل', icon: Mail, visible: canManageCms },
    { id: 'nav' as CmsTab, label: 'شريط التنقل (Navbar)', icon: Compass, visible: canManageCms },
    { id: 'footer' as CmsTab, label: 'الهوية والتذييل (Footer)', icon: Footprints, visible: canManageCms },
  ].filter((t) => t.visible);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-muted-border/30 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl brand-fill text-canvas flex items-center justify-center shadow-xs">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-heading">نظام إدارة المحتوى (Site CMS)</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary">
                ثنائي اللغة (AR / EN)
              </span>
            </div>
            <p className="text-xs text-neutral-text/70 mt-0.5">
              تحكم كامل في كافة نصوص الموقع، الأقسام، الشركاء، القائمة العلوية والتذييل مع سجل الإصدارات
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exporting}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-50"
              title="تصدير نسخة احتياطية لكافة بيانات الـ CMS بصيغة JSON"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              {exporting ? 'جاري التصدير...' : 'تصدير نسخة احتياطية'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold rounded-2xl whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'brand-fill text-canvas shadow-xs'
                  : 'bg-surface border border-muted-border/30 text-neutral-text hover:text-heading hover:border-muted-border/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div className="transition-all duration-150">
        {activeTab === 'home' && <CmsHomePanel />}
        {activeTab === 'works' && <CmsWorksPanel />}
        {activeTab === 'clients' && <CmsClientsPanel />}
        {activeTab === 'contact' && <CmsContactPanel />}
        {activeTab === 'nav' && <CmsNavPanel />}
        {activeTab === 'footer' && <CmsFooterPanel />}
      </div>
    </div>
  );
};
