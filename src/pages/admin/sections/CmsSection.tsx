import React, { useState, useRef, useEffect } from 'react';
import {
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
  Archive,
  Briefcase,
  Save,
  Undo2,
  History,
  ChevronDown,
} from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { NoAccess } from '../../../components/admin/common/SectionState';
import { CmsNavPanel } from '../../../components/admin/cms/CmsNavPanel';
import { CmsFooterPanel } from '../../../components/admin/cms/CmsFooterPanel';
import { CmsHomePanel } from '../../../components/admin/cms/CmsHomePanel';
import { CmsWorksPanel } from '../../../components/admin/cms/CmsWorksPanel';
import { CmsClientsPanel } from '../../../components/admin/cms/CmsClientsPanel';
import { CmsContactPanel } from '../../../components/admin/cms/CmsContactPanel';
import { CmsPastWorksPanel } from '../../../components/admin/cms/CmsPastWorksPanel';
import { CmsCareersPanel } from '../../../components/admin/cms/CmsCareersPanel';
import {
  CmsDirtyContext,
  useCmsDirtyRegistryState,
} from '../../../components/admin/cms/cmsDirtyContext';
import { CmsPreviewModal } from '../../../components/admin/cms/CmsPreviewModal';
import { CmsLivePreviewPane } from '../../../components/admin/cms/CmsLivePreviewPane';
import { api, getErrorMessage } from '../../../services/api';

type CmsTab = 'nav' | 'footer' | 'home' | 'works' | 'clients' | 'contact' | 'pastWorks' | 'careers';

const EDITOR_PCT_KEY = 'ajda_cms_editor_pct';
const EDITOR_PCT_MIN = 28;
const EDITOR_PCT_MAX = 70;
const EDITOR_PCT_DEFAULT = 45;
const clampPct = (n: number) => Math.min(EDITOR_PCT_MAX, Math.max(EDITOR_PCT_MIN, n));

interface BackupParsedData {
  version?: number;
  exportedAt?: string;
  source?: string;
  sections?: Record<string, unknown>;
  clients?: unknown[];
}

export const CmsSection: React.FC = () => {
  const { can, isSuperAdmin, showToast, confirm } = useAdmin();
  const { t } = useAdminT();
  const { registry: dirtyRegistry, anyDirty, drafts, toolbar } = useCmsDirtyRegistryState();
  const [requestedTab, setActiveTab] = useState<CmsTab>('home');
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

  // Resizable split: width of the editor column as a % of the workspace (desktop only)
  const [editorPct, setEditorPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(EDITOR_PCT_KEY));
      if (Number.isFinite(saved) && saved >= EDITOR_PCT_MIN && saved <= EDITOR_PCT_MAX) return saved;
    } catch {
      // Ignore
    }
    return EDITOR_PCT_DEFAULT;
  });
  const [resizing, setResizing] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Width of the editor column -> data-cw tokens read by the cw-sm/cw-md/cw-lg variants (index.css)
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelWidthTokens, setPanelWidthTokens] = useState('sm md lg');
  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = (width: number) => {
      const tokens = [width >= 520 && 'sm', width >= 600 && 'md', width >= 800 && 'lg']
        .filter(Boolean)
        .join(' ');
      setPanelWidthTokens(tokens);
    };
    update(el.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const persistEditorPct = (pct: number) => {
    try {
      localStorage.setItem(EDITOR_PCT_KEY, String(Math.round(pct * 10) / 10));
    } catch {
      // Ignore
    }
  };

  const isWorkspaceRtl = () =>
    workspaceRef.current ? getComputedStyle(workspaceRef.current).direction === 'rtl' : false;

  const handleResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = workspaceRef.current?.getBoundingClientRect();
    if (!resizing || !box || box.width === 0) return;
    // The editor is the first flex child: it sits on the right in RTL.
    const offset = isWorkspaceRtl() ? box.right - e.clientX : e.clientX - box.left;
    setEditorPct(clampPct((offset / box.width) * 100));
  };

  const handleResizeKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const growKey = isWorkspaceRtl() ? 'ArrowLeft' : 'ArrowRight';
    const next = clampPct(editorPct + (e.key === growKey ? 2 : -2));
    setEditorPct(next);
    persistEditorPct(next);
  };

  const handleToolbarDiscard = async () => {
    if (!toolbar) return;
    const ok = await confirm({
      title: t('cms.dirty.discardConfirmTitle'),
      message: t('cms.dirty.discardConfirmMessage'),
      confirmLabel: t('cms.dirty.discard'),
      danger: true,
    });
    if (ok) toolbar.handlers.current.onDiscard();
  };

  const handleTabChange = async (tab: CmsTab) => {
    if (tab === activeTab) return;
    if (anyDirty) {
      const ok = await confirm({
        title: t('cms.dirty.leaveTitle'),
        message: t('cms.dirty.leaveMessage'),
        confirmLabel: t('cms.dirty.leaveConfirm'),
        danger: true,
      });
      if (!ok) return;
    }
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
      showToast(t('cms.section.exportSuccess'));
    } catch (caught) {
      showToast(getErrorMessage(caught, t('cms.section.exportError')));
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
          showToast(t('cms.section.invalidFile'));
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
        showToast(t('cms.section.readError'));
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
      showToast(t('cms.section.importSuccess'));
      setPendingBackup(null);
      // Remount current active panel to display fresh imported state
      setCmsRefreshKey((k) => k + 1);
    } catch (caught) {
      showToast(getErrorMessage(caught, t('cms.section.importError')));
    } finally {
      setImporting(false);
    }
  };

  const tabs = [
    {
      id: 'home' as CmsTab,
      labelKey: 'cms.section.tabHome',
      icon: Home,
      visible: canManageCms,
    },
    {
      id: 'works' as CmsTab,
      labelKey: 'cms.section.tabWorks',
      icon: Building,
      visible: canManageCms,
    },
    {
      id: 'pastWorks' as CmsTab,
      labelKey: 'cms.section.tabPastWorks',
      icon: Archive,
      visible: canManageCms,
    },
    {
      id: 'clients' as CmsTab,
      labelKey: 'cms.section.tabClients',
      icon: Users,
      visible: canManageClients || canManageCms,
    },
    {
      id: 'contact' as CmsTab,
      labelKey: 'cms.section.tabContact',
      icon: Mail,
      visible: canManageCms,
    },
    {
      id: 'careers' as CmsTab,
      labelKey: 'cms.section.tabCareers',
      icon: Briefcase,
      visible: canManageCms,
    },
    {
      id: 'nav' as CmsTab,
      labelKey: 'cms.section.tabNav',
      icon: Compass,
      visible: canManageCms,
    },
    {
      id: 'footer' as CmsTab,
      labelKey: 'cms.section.tabFooter',
      icon: Footprints,
      visible: canManageCms,
    },
  ].filter((t) => t.visible);

  // The requested tab may be one this user cannot see (e.g. only manageClients): fall back to the first allowed one.
  const activeTab: CmsTab | undefined = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab
    : tabs[0]?.id;

  const ActiveTabIcon = tabs.find((tab) => tab.id === activeTab)?.icon;

  const getActiveTabRoute = () => {
    switch (activeTab) {
      case 'works':
        return '/works';
      case 'pastWorks':
        return '/past-works';
      case 'clients':
        return '/clients';
      case 'contact':
        return '/contact';
      case 'careers':
        return '/careers';
      default:
        return '/';
    }
  };

  const currentPreviewRoute = previewPathOverride ?? getActiveTabRoute();

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)]">
      {/* Hidden Backup File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePicked}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Slim toolbar (the page title already lives in the admin top bar) */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Save / discard / history of the active panel (panels that publish them) */}
        <div className="flex flex-wrap items-center gap-2">
          {toolbar && (
            <>
              {toolbar.dirty && toolbar.canSave && (
              <button
                type="button"
                onClick={() => toolbar.handlers.current.onSave()}
                disabled={toolbar.saving}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl brand-fill text-canvas shadow-xs hover:opacity-95 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {toolbar.saving ? (
                  <div className="w-4 h-4 border-2 border-canvas border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {toolbar.saving ? t('cms.common.saving') : t('cms.common.saveChanges')}
              </button>
              )}
              {toolbar.dirty && (
              <button
                type="button"
                onClick={() => void handleToolbarDiscard()}
                disabled={toolbar.saving}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-muted-border/40 bg-canvas text-neutral-text hover:text-heading hover:border-primary/50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Undo2 className="w-4 h-4" />
                {t('cms.dirty.discard')}
              </button>
              )}
              <button
                type="button"
                onClick={() => toolbar.handlers.current.onHistory()}
                className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-muted-border/40 bg-canvas text-neutral-text hover:text-heading hover:border-primary/50 transition cursor-pointer"
              >
                <History className="w-4 h-4" />
                {t('cms.common.historyButton', { version: toolbar.version })}
              </button>
              {toolbar.dirty && (
                <span
                  role="status"
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                  {t('cms.dirty.label')}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Side-by-Side Split View Toggle */}
        <button
          type="button"
          onClick={() => handleToggleSplit(!splitPreview)}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition cursor-pointer ${
            splitPreview
              ? 'bg-primary/10 border border-primary/40 text-primary'
              : 'bg-canvas border border-muted-border/40 hover:border-primary/50 text-neutral-text hover:text-heading'
          }`}
          title={t('cms.section.toggleSplitTitle')}
        >
          <Columns2 className="w-4 h-4 text-primary" />
          <span>{splitPreview ? t('cms.section.splitOn') : t('cms.section.splitOff')}</span>
        </button>

        {/* Fullscreen Preview Modal Button */}
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer"
          title={t('cms.section.fullscreenTitle')}
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span className="hidden sm:inline">{t('cms.section.fullscreenLabel')}</span>
        </button>

        {isSuperAdmin && (
          <>
            {/* Export Backup Button */}
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exporting}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-50"
              title={t('cms.section.exportTitle')}
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span className="hidden md:inline">
                {exporting ? t('cms.section.exporting') : t('cms.section.exportLabel')}
              </span>
            </button>

            {/* Import Backup Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-canvas border border-muted-border/40 hover:border-primary/50 text-heading transition cursor-pointer disabled:opacity-50"
              title={t('cms.section.importTitle')}
            >
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span className="hidden md:inline">{t('cms.section.importLabel')}</span>
            </button>
          </>
        )}
        </div>
      </div>

      {/* Main Workspace: Side-by-Side Split View */}
      <div
        ref={workspaceRef}
        style={{ '--cms-editor-w': `${editorPct}%` } as React.CSSProperties}
        className={`flex flex-col lg:flex-row gap-6 lg:gap-0 items-start lg:items-stretch lg:flex-1 lg:min-h-0 ${
          resizing ? 'select-none' : ''
        }`}
      >
        {/* Left Column: Editor Tabs & Panel */}
        <div
          ref={panelRef}
          data-cw={panelWidthTokens}
          className={`w-full flex flex-col gap-6 lg:h-full lg:min-h-0 ${
            splitPreview ? 'lg:w-(--cms-editor-w) shrink-0' : 'w-full'
          } ${resizing ? '' : 'transition-all duration-300'}`}
        >
          {/* Tabs Navigation */}
          <div className="relative shrink-0">
            {ActiveTabIcon && (
              <ActiveTabIcon
                className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary"
                aria-hidden="true"
              />
            )}
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as CmsTab)}
              aria-label={t('cms.section.pageSelectLabel')}
              className="w-full cursor-pointer appearance-none rounded-2xl border border-muted-border/40 bg-surface py-2.5 ps-10 pe-10 text-xs font-bold text-heading transition hover:border-muted-border/70 focus:border-primary focus:outline-hidden"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {t(
                    tab.labelKey as
                      | 'cms.section.tabHome'
                      | 'cms.section.tabWorks'
                      | 'cms.section.tabPastWorks'
                      | 'cms.section.tabClients'
                      | 'cms.section.tabContact'
                      | 'cms.section.tabCareers'
                      | 'cms.section.tabNav'
                      | 'cms.section.tabFooter',
                  )}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text"
              aria-hidden="true"
            />
          </div>

          {/* Active Tab Panel */}
          <div
            key={`${activeTab}-${cmsRefreshKey}`}
            className="transition-all duration-150 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pe-1 w-full"
          >
            <CmsDirtyContext.Provider value={dirtyRegistry}>
              {activeTab === 'home' && <CmsHomePanel />}
              {activeTab === 'works' && <CmsWorksPanel />}
              {activeTab === 'pastWorks' && <CmsPastWorksPanel />}
              {activeTab === 'clients' && <CmsClientsPanel />}
              {activeTab === 'contact' && <CmsContactPanel />}
              {activeTab === 'careers' && <CmsCareersPanel />}
              {activeTab === 'nav' && <CmsNavPanel />}
              {activeTab === 'footer' && <CmsFooterPanel />}
            </CmsDirtyContext.Provider>
          </div>
        </div>

        {/* Drag handle between editor and preview (desktop only) */}
        {splitPreview && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t('cms.section.resizeLabel')}
            aria-valuemin={EDITOR_PCT_MIN}
            aria-valuemax={EDITOR_PCT_MAX}
            aria-valuenow={Math.round(editorPct)}
            tabIndex={0}
            title={t('cms.section.resizeHint')}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setResizing(true);
            }}
            onPointerMove={handleResizeMove}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
              setResizing(false);
              persistEditorPct(editorPct);
            }}
            onPointerCancel={() => setResizing(false)}
            onDoubleClick={() => {
              setEditorPct(EDITOR_PCT_DEFAULT);
              persistEditorPct(EDITOR_PCT_DEFAULT);
            }}
            onKeyDown={handleResizeKey}
            className="group hidden lg:flex w-6 shrink-0 cursor-col-resize touch-none items-center justify-center focus:outline-hidden"
          >
            <div
              className={`h-16 w-1 rounded-full transition-colors group-hover:bg-primary group-focus-visible:bg-primary ${
                resizing ? 'bg-primary' : 'bg-muted-border/60'
              }`}
            />
          </div>
        )}

        {/* Right Column: Live Preview Sticky Pane (Side-by-Side) */}
        {splitPreview && (
          <div
            className={`hidden lg:block lg:flex-1 lg:h-full lg:min-h-0 lg:min-w-0 w-full ${
              resizing ? 'pointer-events-none' : 'transition-all duration-300'
            }`}
          >
            <CmsLivePreviewPane
              currentPath={currentPreviewRoute}
              onPathChange={(p) => setPreviewPathOverride(p)}
              onExpandFullscreen={() => setPreviewOpen(true)}
              onClose={() => handleToggleSplit(false)}
              isSplitView={true}
              drafts={drafts}
            />
          </div>
        )}
      </div>

      {/* Fullscreen Live Preview Modal */}
      <CmsPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        initialRoute={currentPreviewRoute}
        drafts={drafts}
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
                    {t('cms.section.importDialogTitle')}
                  </h3>
                  <p className="text-xs text-neutral-text/70 mt-0.5">
                    {t('cms.section.importDialogSubtitle')}
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
                <span className="text-neutral-text font-medium">
                  {t('cms.section.fileNameLabel')}
                </span>
                <span className="font-mono font-bold text-heading truncate max-w-[240px]">
                  {pendingBackup.fileName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">
                  {t('cms.section.fileSizeLabel')}
                </span>
                <span className="font-mono text-heading">{pendingBackup.fileSizeKb} KB</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">
                  {t('cms.section.sectionsLabel')}
                </span>
                <span className="font-bold text-primary">
                  {pendingBackup.detectedSections.length} {t('cms.section.sectionsCount')} (
                  {pendingBackup.detectedSections.join(', ')})
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-text font-medium">
                  {t('cms.section.clientsLabel')}
                </span>
                <span className="font-bold text-emerald-500">
                  {pendingBackup.detectedClientsCount} {t('cms.section.clientsCount')}
                </span>
              </div>
            </div>

            {/* Warning Note */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                <strong>{t('cms.section.warningTitle')}</strong> {t('cms.section.warningBody')}
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
                {t('cms.section.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl brand-fill text-canvas hover:opacity-95 transition cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {importing ? t('cms.section.importing') : t('cms.section.confirmImport')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
