import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Box,
  Upload,
  Search,
  Trash2,
  Copy,
  ExternalLink,
  Download,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Link2,
  Layers,
  X as CloseIcon,
  LayoutGrid,
  List,
  Video as VideoIcon,
  File as FileIcon,
} from 'lucide-react';
import { useAdmin } from '../adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { useUploadManager } from '../../../context/UploadManagerContext';
import { formatAdminDate, formatAdminDateTime } from '../adminFormat';
import {
  fetchMediaList,
  deleteMediaItem,
  fetchStorageStats,
  type MediaFileDto,
  type DiskStorageStats,
} from '../../../services/mediaService';
import { resolveMediaUrl } from '../../../services/api';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const MediaSection: React.FC = () => {
  const { t } = useAdminT();
  const { showToast, confirm } = useAdmin();
  const { uploadFiles, isUploading } = useUploadManager();

  const [items, setItems] = useState<MediaFileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [storageStats, setStorageStats] = useState<DiskStorageStats | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'orphaned'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'pdf' | 'model3d' | 'other'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Uploading state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Popovers & Dialogs
  const [activeUsageFile, setActiveUsageFile] = useState<MediaFileDto | null>(null);
  const [previewFile, setPreviewFile] = useState<MediaFileDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Layout mode (Grid vs Detailed List)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ajda_media_layout_mode');
      if (saved === 'list' || saved === 'grid') return saved;
    }
    return 'grid';
  });

  const handleLayoutChange = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ajda_media_layout_mode', mode);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMediaList({
        page,
        limit: 24,
        type: typeFilter,
        status: statusFilter,
        search: debouncedSearch,
      });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      showToast('فشل تحميل ملفات الوسائط', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter, debouncedSearch, showToast]);

  const loadStorageStats = useCallback(async () => {
    try {
      const data = await fetchStorageStats();
      setStorageStats(data);
    } catch {
      // Non-critical background telemetry
    }
  }, []);

  useEffect(() => {
    void loadMedia();
    void loadStorageStats();
  }, [loadMedia, loadStorageStats]);

  // Aggregate stats across current items
  const stats = useMemo(() => {
    let linked = 0;
    let orphaned = 0;
    let totalSize = 0;
    for (const item of items) {
      if (item.usageCount > 0) linked++;
      else orphaned++;
      totalSize += item.size;
    }
    return { linked, orphaned, totalSize };
  }, [items]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      await uploadFiles(Array.from(files));
      showToast('تمت إضافة الملفات إلى مدير الرفع بنجاح', 'success');
      void loadMedia();
      void loadStorageStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل رفع الملف';
      showToast(msg, 'error');
    }
  };

  const handleCopyUrl = (url: string) => {
    const full = resolveMediaUrl(url);
    void navigator.clipboard.writeText(full);
    showToast(t('media.action.copied'), 'info');
  };

  const handleDelete = async (file: MediaFileDto) => {
    if (file.usageCount > 0) {
      setActiveUsageFile(file);
      return;
    }

    const ok = await confirm({
      title: t('media.delete.title'),
      message: t('media.delete.confirmOrphaned'),
      confirmLabel: t('media.action.delete'),
      danger: true,
    });

    if (!ok) return;

    setDeletingId(file.id);
    try {
      await deleteMediaItem(file.id);
      showToast('تم حذف الملف نهائياً', 'success');
      void loadMedia();
      void loadStorageStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل حذف الملف';
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Low Disk Space Alert Banner (< 10GB) */}
      {storageStats?.isLowSpace && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-800 dark:text-amber-200">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-heading flex items-center gap-2">
                <span>{t('media.warning.lowDiskSpace')}</span>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                  {storageStats.freeGb} GB متبقية
                </span>
              </h4>
              <p className="text-xs text-neutral-text/80 mt-1">
                {t('media.warning.lowDiskSpaceDesc', {
                  freeGb: String(storageStats.freeGb),
                  totalGb: String(storageStats.totalGb),
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('orphaned')}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer shadow-xs transition"
          >
            {t('media.warning.viewOrphaned')}
          </button>
        </div>
      )}

      {/* Top Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Files */}
        <div className="p-4 rounded-2xl bg-surface border border-muted-border/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-text/60 font-medium">{t('media.stat.totalFiles')}</p>
            <p className="text-base font-black text-heading">{storageStats?.mediaCount ?? total}</p>
          </div>
        </div>

        {/* Media Total Size */}
        <div className="p-4 rounded-2xl bg-surface border border-muted-border/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <FileIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-text/60 font-medium">{t('media.stat.totalSize')}</p>
            <p className="text-base font-black text-heading">
              {formatBytes(storageStats?.mediaTotalBytes ?? stats.totalSize)}
            </p>
          </div>
        </div>

        {/* Disk Available Storage */}
        <div
          className={`p-4 rounded-2xl bg-surface border transition-colors col-span-2 sm:col-span-1 flex flex-col justify-between gap-2 ${
            storageStats?.isLowSpace ? 'border-amber-500/50 bg-amber-500/5' : 'border-muted-border/30'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  storageStats?.isLowSpace
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}
              >
                <HardDrive className="w-4.5 h-4.5" />
              </div>
              <div>
                <p className="text-[10px] text-neutral-text/60 font-medium">{t('media.stat.freeSpace')}</p>
                <p
                  className={`text-sm sm:text-base font-black ${
                    storageStats?.isLowSpace ? 'text-amber-500' : 'text-heading'
                  }`}
                >
                  {storageStats ? `${storageStats.freeGb} GB` : '...'}
                </p>
              </div>
            </div>
            {storageStats && (
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                  storageStats.isLowSpace
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-muted-surface text-neutral-text/70'
                }`}
              >
                {storageStats.isLowSpace ? 'مساحة منخفضة' : `${100 - storageStats.percentUsed}% حر`}
              </span>
            )}
          </div>

          {storageStats && (
            <div className="space-y-1 mt-1">
              <div className="w-full h-1.5 rounded-full bg-muted-surface overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    storageStats.isLowSpace ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${storageStats.percentUsed}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-neutral-text/50 font-mono">
                <span>{t('media.stat.diskUsed')}: {storageStats.usedGb} GB</span>
                <span>{t('media.stat.diskTotal')}: {storageStats.totalGb} GB</span>
              </div>
            </div>
          )}
        </div>

        {/* Linked Media */}
        <div className="p-4 rounded-2xl bg-surface border border-muted-border/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-text/60 font-medium">{t('media.stat.linkedCount')}</p>
            <p className="text-base font-black text-heading">{stats.linked}</p>
          </div>
        </div>

        {/* Orphaned Media */}
        <div className="p-4 rounded-2xl bg-surface border border-muted-border/30 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-neutral-text/60 font-medium">{t('media.stat.orphanedCount')}</p>
            <p className="text-base font-black text-heading">{stats.orphaned}</p>
          </div>
        </div>
      </div>

      {/* Action & Filter Bar */}
      <div className="p-4 rounded-2xl bg-surface border border-muted-border/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-text/40 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t('media.searchPlaceholder')}
              className="w-full h-10 ps-9 pe-4 rounded-xl border border-muted-border/40 bg-canvas text-xs text-heading placeholder:text-neutral-text/40 focus:outline-none focus:border-accent"
            />
          </div>

          {/* Action buttons (Upload & Layout Toggle) */}
          <div className="flex items-center gap-2">
            {/* Layout Toggle (Grid vs Detailed List) */}
            <div className="flex items-center p-1 bg-canvas rounded-xl border border-muted-border/40 text-neutral-text/60">
              <button
                type="button"
                onClick={() => handleLayoutChange('grid')}
                className={`p-2 rounded-lg transition cursor-pointer flex items-center justify-center ${
                  layoutMode === 'grid'
                    ? 'bg-surface text-accent shadow-xs'
                    : 'hover:text-heading hover:bg-surface/50'
                }`}
                title={t('media.layout.grid')}
                aria-label={t('media.layout.grid')}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange('list')}
                className={`p-2 rounded-lg transition cursor-pointer flex items-center justify-center ${
                  layoutMode === 'list'
                    ? 'bg-surface text-accent shadow-xs'
                    : 'hover:text-heading hover:bg-surface/50'
                }`}
                title={t('media.layout.list')}
                aria-label={t('media.layout.list')}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              onChange={(e) => {
                void handleFileUpload(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-10 px-4 rounded-xl bg-accent hover:bg-accent/90 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{isUploading ? t('media.uploading') : t('media.upload')}</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-muted-border/20">
          {/* Status filter: All, Linked, Orphaned */}
          <div className="flex items-center gap-1.5 p-1 bg-canvas rounded-xl border border-muted-border/30 text-[11px] font-bold">
            <button
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === 'all' ? 'bg-surface text-accent shadow-sm' : 'text-neutral-text/60 hover:text-heading'
              }`}
            >
              {t('media.filter.all')}
            </button>
            <button
              onClick={() => {
                setStatusFilter('linked');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                statusFilter === 'linked' ? 'bg-surface text-emerald-600 shadow-sm' : 'text-neutral-text/60 hover:text-heading'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{t('media.filter.linked')}</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('orphaned');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                statusFilter === 'orphaned' ? 'bg-surface text-amber-600 shadow-sm' : 'text-neutral-text/60 hover:text-heading'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{t('media.filter.orphaned')}</span>
            </button>
          </div>

          {/* Type filter */}
          <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
            {(['all', 'image', 'video', 'pdf', 'model3d', 'other'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  typeFilter === type ? 'bg-accent/10 text-accent font-black' : 'text-neutral-text/50 hover:text-heading'
                }`}
              >
                {t(`media.type.${type}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Media Display (Grid or Detailed List) */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-accent animate-spin" />
          <span className="text-xs text-neutral-text/60">{t('media.uploading')}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 rounded-2xl bg-surface border border-muted-border/30 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-canvas border border-muted-border/30 flex items-center justify-center mx-auto text-neutral-text/40">
            <ImageIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-heading">{t('media.empty.title')}</p>
          <p className="text-xs text-neutral-text/50">{t('media.empty.desc')}</p>
        </div>
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {items.map((file) => {
            const isImage = file.fileType === 'image';
            const isPdf = file.fileType === 'pdf';
            const isVideo = file.fileType === 'video';
            const isModel = file.fileType === 'model3d';
            const fullUrl = resolveMediaUrl(file.url);
            const isLinked = file.usageCount > 0;

            return (
              <div
                key={file.id}
                className="group relative rounded-2xl bg-surface border border-muted-border/30 hover:border-accent/40 shadow-sm overflow-hidden flex flex-col transition"
              >
                {/* Thumbnail / Preview Area */}
                <div
                  onClick={() => setPreviewFile(file)}
                  className="h-32 bg-canvas flex items-center justify-center overflow-hidden cursor-pointer relative"
                >
                  {isImage ? (
                    <img
                      src={fullUrl}
                      alt={file.originalName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : isPdf ? (
                    <div className="flex flex-col items-center gap-1.5 text-accent/80">
                      <FileText className="w-8 h-8" />
                      <span className="text-[10px] font-black tracking-wider uppercase">PDF</span>
                    </div>
                  ) : isVideo ? (
                    <div className="flex flex-col items-center gap-1.5 text-purple-500/80">
                      <VideoIcon className="w-8 h-8" />
                      <span className="text-[10px] font-black tracking-wider uppercase">VIDEO</span>
                    </div>
                  ) : isModel ? (
                    <div className="flex flex-col items-center gap-1.5 text-blue-500/80">
                      <Box className="w-8 h-8" />
                      <span className="text-[10px] font-black tracking-wider uppercase">3D</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 text-neutral-text/70">
                      <FileIcon className="w-8 h-8" />
                      <span className="text-[10px] font-black tracking-wider uppercase">FILE</span>
                    </div>
                  )}

                  {/* Usage Badge (Overlay on Thumbnail) */}
                  <div className="absolute top-2 start-2">
                    {isLinked ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveUsageFile(file);
                        }}
                        className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-white font-black text-[9px] shadow-sm backdrop-blur-sm flex items-center gap-1 hover:bg-emerald-600 transition cursor-pointer"
                        title="انقر لعرض المشاريع المرتبطة"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span>{t('media.badge.linked', { count: file.usageCount })}</span>
                      </button>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/90 text-white font-black text-[9px] shadow-sm backdrop-blur-sm flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        <span>{t('media.badge.orphaned')}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Footer */}
                <div className="p-2.5 flex-1 flex flex-col justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-heading truncate" title={file.originalName}>
                      {file.originalName}
                    </p>
                    <p className="text-[10px] text-neutral-text/50 mt-0.5">{formatBytes(file.size)}</p>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-muted-border/20 text-neutral-text/60">
                    <button
                      onClick={() => handleCopyUrl(file.url)}
                      title={t('media.action.copyUrl')}
                      className="p-1 rounded-lg hover:text-accent hover:bg-accent/10 transition cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={fullUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={t('media.action.download')}
                      className="p-1 rounded-lg hover:text-accent hover:bg-accent/10 transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleDelete(file)}
                      disabled={deletingId === file.id}
                      title={isLinked ? 'لا يمكن الحذف - الملف مرتبط بمشروع' : t('media.action.delete')}
                      className={`p-1 rounded-lg transition cursor-pointer ${
                        isLinked
                          ? 'text-neutral-text/30 hover:text-amber-600 hover:bg-amber-500/10'
                          : 'hover:text-red-500 hover:bg-red-500/10'
                      }`}
                    >
                      {deletingId === file.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed List Layout */
        <div className="rounded-2xl bg-surface border border-muted-border/30 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="border-b border-muted-border/30 bg-canvas/60 text-[11px] font-bold text-neutral-text/60">
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.file')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.type')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.size')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.status')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.uploadedAt')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.uploadedBy')}</th>
                  <th className="py-3 px-4 text-end font-bold">{t('media.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-border/20">
                {items.map((file) => {
                  const isImage = file.fileType === 'image';
                  const isPdf = file.fileType === 'pdf';
                  const isVideo = file.fileType === 'video';
                  const isModel = file.fileType === 'model3d';
                  const fullUrl = resolveMediaUrl(file.url);
                  const isLinked = file.usageCount > 0;
                  const uploader = file.createdByName || t('media.uploadedBy.system');

                  return (
                    <tr key={file.id} className="hover:bg-canvas/50 transition group">
                      {/* File preview & names */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setPreviewFile(file)}
                            className="w-11 h-11 rounded-xl bg-canvas border border-muted-border/40 overflow-hidden shrink-0 flex items-center justify-center cursor-pointer hover:border-accent/60 transition group-hover:scale-105"
                          >
                            {isImage ? (
                              <img src={fullUrl} alt={file.originalName} className="w-full h-full object-cover" loading="lazy" />
                            ) : isPdf ? (
                              <FileText className="w-5 h-5 text-accent/80" />
                            ) : isVideo ? (
                              <VideoIcon className="w-5 h-5 text-purple-500/80" />
                            ) : isModel ? (
                              <Box className="w-5 h-5 text-blue-500/80" />
                            ) : (
                              <FileIcon className="w-5 h-5 text-neutral-text/70" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs sm:max-w-sm">
                            <p
                              className="font-bold text-heading text-xs truncate hover:text-accent cursor-pointer"
                              onClick={() => setPreviewFile(file)}
                              title={file.originalName}
                            >
                              {file.originalName}
                            </p>
                            <p className="font-mono text-[10px] text-neutral-text/50 truncate mt-0.5" title={file.filename}>
                              {file.filename}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isImage
                              ? 'bg-accent/10 text-accent'
                              : isPdf
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : isVideo
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : isModel
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-canvas text-neutral-text/70'
                          }`}
                        >
                          {isImage
                            ? file.mimeType.replace('image/', '')
                            : isPdf
                            ? 'PDF'
                            : isVideo
                            ? 'VIDEO'
                            : isModel
                            ? '3D GLB'
                            : file.fileType}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-heading font-medium">
                        {formatBytes(file.size)}
                      </td>

                      {/* Usage Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isLinked ? (
                          <button
                            type="button"
                            onClick={() => setActiveUsageFile(file)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] transition cursor-pointer"
                            title="انقر لعرض تفاصيل المشاريع المرتبطة"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{t('media.badge.linked', { count: file.usageCount })}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>{t('media.badge.orphaned')}</span>
                          </span>
                        )}
                      </td>

                      {/* Uploaded At */}
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-text/70 text-[11px]">
                        <div className="flex flex-col">
                          <span className="font-medium text-heading">{formatAdminDate(file.createdAt)}</span>
                          <span className="text-[10px] text-neutral-text/40">{formatAdminDateTime(file.createdAt).split(' ')[1] || ''}</span>
                        </div>
                      </td>

                      {/* Uploaded By */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs text-neutral-text/80 font-medium">
                          <div className="w-6 h-6 rounded-full bg-canvas border border-muted-border/40 flex items-center justify-center text-[10px] font-bold text-accent">
                            {uploader.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate max-w-[120px]">{uploader}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-end">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleCopyUrl(file.url)}
                            title={t('media.action.copyUrl')}
                            className="p-1.5 rounded-lg hover:text-accent hover:bg-accent/10 text-neutral-text/60 transition cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={fullUrl}
                            target="_blank"
                            rel="noreferrer"
                            title={t('media.action.download')}
                            className="p-1.5 rounded-lg hover:text-accent hover:bg-accent/10 text-neutral-text/60 transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>

                          <button
                            onClick={() => handleDelete(file)}
                            disabled={deletingId === file.id}
                            title={isLinked ? 'لا يمكن الحذف - الملف مرتبط بمحتوى نشط' : t('media.action.delete')}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isLinked
                                ? 'text-neutral-text/30 hover:text-amber-600 hover:bg-amber-500/10'
                                : 'hover:text-red-500 hover:bg-red-500/10 text-neutral-text/60'
                            }`}
                          >
                            {deletingId === file.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-xl border border-muted-border/40 bg-surface text-xs font-bold text-heading hover:border-accent disabled:opacity-40 cursor-pointer"
          >
            السابق
          </button>
          <span className="text-xs text-neutral-text/60 font-bold px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl border border-muted-border/40 bg-surface text-xs font-bold text-heading hover:border-accent disabled:opacity-40 cursor-pointer"
          >
            التالي
          </button>
        </div>
      )}

      {/* Connected Entities Modal (Protection / Usage Details) */}
      {activeUsageFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface border border-muted-border/40 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-black text-heading">{t('media.delete.blockedTitle')}</h3>
              </div>
              <button
                onClick={() => setActiveUsageFile(null)}
                className="p-1 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-text/70 leading-relaxed">{t('media.delete.blockedDesc')}</p>

            {/* List of Connected Entities */}
            <div className="max-h-60 overflow-y-auto space-y-2 p-3 rounded-xl bg-canvas border border-muted-border/30">
              {activeUsageFile.usages.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-surface border border-muted-border/20">
                  <div className="min-w-0">
                    <p className="font-bold text-heading truncate">{u.entityTitle}</p>
                    <p className="text-[10px] text-neutral-text/50">
                      الحقل: <span className="font-mono text-accent">{u.field}</span>
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent/10 text-accent shrink-0">
                    {u.entityType}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveUsageFile(null)}
                className="px-4 py-2 rounded-xl bg-surface hover:bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Image Preview Modal */}
      {previewFile && (
        <div
          onClick={() => setPreviewFile(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[85vh] rounded-2xl overflow-hidden bg-surface border border-white/20 shadow-2xl flex flex-col"
          >
            <div className="p-3 bg-surface border-b border-muted-border/20 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-heading truncate">{previewFile.originalName}</p>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-1 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex items-center justify-center bg-black/40 overflow-hidden">
              {previewFile.fileType === 'image' ? (
                <img
                  src={resolveMediaUrl(previewFile.url)}
                  alt={previewFile.originalName}
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              ) : previewFile.fileType === 'video' ? (
                <video
                  controls
                  src={resolveMediaUrl(previewFile.url)}
                  className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-lg"
                  autoPlay
                />
              ) : (
                <div className="p-12 text-center text-white space-y-3">
                  <FileText className="w-16 h-16 mx-auto text-accent" />
                  <p className="text-sm font-bold">{previewFile.originalName}</p>
                  <a
                    href={resolveMediaUrl(previewFile.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-white font-bold text-xs"
                  >
                    <span>فتح في تبويب جديد</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
