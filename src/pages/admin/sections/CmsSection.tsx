import React, { useState, useRef } from 'react';
import {
  Globe,
  Compass,
  Footprints,
  Home,
  Building,
  Users,
  Mail,
  Download,
  Upload,
  Eye,
  Columns2,
  AlertTriangle,
  FileJson,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { NoAccess } from '../../../components/admin/common/SectionState';
import { CmsNavPanel } from '../../../components/admin/cms/CmsNavPanel';
import { CmsFooterPanel } from '../../../components/admin/cms/CmsFooterPanel';
import { CmsHomePanel } from '../../../components/admin/cms/CmsHomePanel';
import { CmsWorksPanel } from '../../../components/admin/cms/CmsWorksPanel';
import { CmsClientsPanel } from '../../../components/admin/cms/CmsClientsPanel';
import { CmsContactPanel } from '../../../components/admin/cms/CmsContactPanel';
import { CmsPreviewModal } from '../../../components/admin/cms/CmsPreviewModal';
import { CmsLivePreviewPane } from '../../../components/admin/cms/CmsLivePreviewPane';
import { api, getErrorMessage } from '../../../services/api';

type CmsTab = 'nav' | 'footer' | 'home' | 'works' | 'clients' | 'contact';

interface BackupParsedData {
  version?: number;
  exportedAt?: string;
  source?: string;
  sections?: Record<string, unknown>;
  clients?: unknown[];
}

export const CmsSection: React.FC = () => {
  const { can, isSuperAdmin, showToast } = useAdmin();
  const [activeTab, setActiveTab] = useState<CmsTab>('home');
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [cmsRefreshKey, setCmsRefreshKey] = useState(0);

  // Side-by-Side Split View State (defaults to true on desktop)
  const [splitPreview, setSplitPreview] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('ajda_cms_split_preview');
    return saved !== null ? saved === 'true' : true;
  });

  const [previewPathOverride, setPreviewPathOverride] = useState<string | null>(null);

  // Backup Import State
  const [pendingBackup, setPendingBackup] = useState<{
    fileName: string;
    fileSizeKb: number;
    data: BackupParsedData;
    detectedSections: string[];
    detectedClientsCount: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManageCms = can('manageCms');
  const canManageClients = can('manageClients');

  // Permission guard: must have at least manageCms or manageClients
  if (!canManageCms && !canManageClients) {
    return <NoAccess />;
  }

  const handleToggleSplit = (enabled: boolean) => {
    setSplitPreview(enabled);
    try {
      localStorage.setItem('ajda_cms_split_preview', String(enabled));
    } catch {
      // Ignore
    }
  };

  const handleTabChange = (tab: CmsTab) => {
    setActiveTab(tab);
    setPreviewPathOverride(null); // auto-sync preview route with the new tab
  };

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

  const handleFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text) as BackupParsedData;

        // Detect available sections & clients
        const sections = parsed.sections ? Object.keys(parsed.sections) : [];
        const clientsCount = Array.isArray(parsed.clients) ? parsed.clients.length : 0;

        if (sections.length === 0 && clientsCount === 0) {
          showToast('الملف المرفوع لا يحتوي على بيانات CMS صالحة للاستيراد');
          return;
        }

        setPendingBackup({
          fileName: file.name,
          fileSizeKb: Math.round(file.size / 1024),
          data: parsed,
          detectedSections: sections,
          detectedClientsCount: clientsCount,
        });
      } catch {
        showToast('تعذر قراءة الملف: تأكد من أنه ملف JSON صالح');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingBackup) return;
    setImporting(true);
    try {
      await api.post('/cms/import', pendingBackup.data);
      showToast('تم استيراد النسخة الاحتياطية وتحديث الموقع بنجاح');
      setPendingBackup(null);
      // Remount current active panel to display fresh imported state
      setCmsRefreshKey((k) => k + 1);
    } catch (caught) {
      showToast(getErrorMessage(caught, 'فشل استيراد النسخة الاحتياطية'));
    } finally {
      setImporting(false);
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

  const getActiveTabRoute = () => {
    switch (activeTab) {
      case 'works':
        return '/works';
      case 'clients':
        return '/clients';
      case 'contact':
        return '/contact';
      default:
        return '/';
    }
  };

  const currentPreviewRoute = previewPathOverride ?? getActiveTabRoute();

  return (
    <div className="space-y-6">
      {/* Hidden Backup File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePicked}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-surface border border-muted-border/30 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl brand-fill text-canvas flex items-center justify-center shadow-xs shrink-0">
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
              تحكم كامل في كافة نصوص الموقع، الأقسام، الشركاء، القائمة العلوية والتذييل مع معاينة حية فورية
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Side-by-Side Split View Toggle */}
          <button
            type="button"
            onClick={() => handleToggleSplit(!splitPreview)}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
              splitPreview
                ? 'brand-fill text-canvas shadow-xs'
                : 'bg-canvas border border-muted-border/40 hover:border-primary/50 text-neutral-text hover:text-heading'
            }`}
            title="تبديل وضع المعاينة المتزامنة جنباً إلى جنب"
          >
            <Columns2 className={`w-4 h-4 ${splitPreview ? 'text-emerald-300' : 'text-primary'}`} />
            <span>{splitPreview ? 'معاينة جنباً إلى جنب: مفعّلة' : 'معاينة جنباً إلى جنب'}</span>
          </button>

          {/* Fullscreen Preview Modal Button */}
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer"
            title="فتح المعاينة في نافذة كاملة الشاشة"
          >
            <Eye className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">معاينة مكبّرة</span>
          </button>

          {isSuperAdmin && (
            <>
              {/* Export Backup Button */}
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={exporting}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-50"
                title="تصدير نسخة احتياطية لكافة بيانات الـ CMS بصيغة JSON"
              >
                <Download className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">{exporting ? 'جاري التصدير...' : 'تصدير نسخة'}</span>
              </button>

              {/* Import Backup Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-50"
                title="استيراد نسخة احتياطية من ملف JSON"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-500" />
                <span className="hidden md:inline">استيراد نسخة</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Workspace: Side-by-Side Split View */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Editor Tabs & Panel */}
        <div
          className={`w-full transition-all duration-300 space-y-6 ${
            splitPreview ? 'lg:w-[48%] xl:w-[45%] 2xl:w-[42%] shrink-0' : 'w-full'
          }`}
        >
          {/* Tabs Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
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
          <div key={`${activeTab}-${cmsRefreshKey}`} className="transition-all duration-150">
            {activeTab === 'home' && <CmsHomePanel />}
            {activeTab === 'works' && <CmsWorksPanel />}
            {activeTab === 'clients' && <CmsClientsPanel />}
            {activeTab === 'contact' && <CmsContactPanel />}
            {activeTab === 'nav' && <CmsNavPanel />}
            {activeTab === 'footer' && <CmsFooterPanel />}
          </div>
        </div>

        {/* Right Column: Live Preview Sticky Pane (Side-by-Side) */}
        {splitPreview && (
          <div className="hidden lg:block lg:flex-1 w-full sticky top-20 transition-all duration-300">
            <CmsLivePreviewPane
              currentPath={currentPreviewRoute}
              onPathChange={(p) => setPreviewPathOverride(p)}
              onExpandFullscreen={() => setPreviewOpen(true)}
              onClose={() => handleToggleSplit(false)}
              isSplitView={true}
            />
          </div>
        )}
      </div>

      {/* Fullscreen Live Preview Modal */}
      <CmsPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        initialRoute={currentPreviewRoute}
      />

      {/* Backup Import Confirmation Modal */}
      {pendingBackup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-muted-border/40 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-muted-border/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <FileJson className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="import-dialog-title" className="text-sm font-black text-heading">
                    استيراد نسخة احتياطية للـ CMS
                  </h3>
                  <p className="text-xs text-neutral-text/70 mt-0.5">
                    مراجعة محتويات الملف قبل تطبيق التغييرات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                className="p-1.5 rounded-xl hover:bg-canvas text-neutral-text hover:text-heading transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* File info card */}
            <div className="p-4 rounded-2xl bg-canvas border border-muted-border/30 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">اسم الملف:</span>
                <span className="font-mono font-bold text-heading truncate max-w-[240px]">
                  {pendingBackup.fileName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">الحجم:</span>
                <span className="font-mono text-heading">{pendingBackup.fileSizeKb} KB</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">الأقسام المتوفرة:</span>
                <span className="font-bold text-primary">
                  {pendingBackup.detectedSections.length} أقسام (
                  {pendingBackup.detectedSections.join(', ')})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">قائمة الشركاء والعملاء:</span>
                <span className="font-bold text-emerald-500">
                  {pendingBackup.detectedClientsCount} شريك
                </span>
              </div>
            </div>

            {/* Warning Note */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>تنبيه:</strong> سيتم تحديث محتوى الموقع فوراً بالبيانات المستوردة، وسيتم حفظ نسخة تاريخية تلقائية لتمكين التراجع عنها في أي وقت من سجل الإصدارات.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingBackup(null)}
                disabled={importing}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-muted-border/70 text-neutral-text hover:text-heading transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl brand-fill text-canvas hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {importing ? 'جاري الاستيراد...' : 'تأكيد واستيراد الآن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
