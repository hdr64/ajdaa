import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Image as ImageIcon,
  FileText,
  Box,
  Upload,
  Search,
  Trash2,
  Copy,
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
  Globe,
  FolderPlus,
  FolderInput,
  Lock,
  CheckSquare,
} from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { useUploadManager } from '../../../context/UploadManagerContext';
import { formatAdminDate, formatAdminDateTime } from '../../../pages/admin/adminFormat';
import {
  fetchMediaList,
  deleteMediaItem,
  fetchStorageStats,
  fetchMediaFolders,
  createMediaFolder,
  updateMediaFolder,
  deleteMediaFolder,
  moveMediaFiles,
  mediaPublicUrl,
  type MediaFileDto,
  type MediaFolderDto,
  type DiskStorageStats,
} from '../../../services/mediaService';
import type { DriveFolderNode } from '../../../services/driveService';
import { getErrorMessage, resolveMediaUrl } from '../../../services/api';
import { copyText } from '../../../utils/clipboard';
import { StorageWarning } from './StorageWarning';
import { DriveFolderPicker, DriveNameDialog } from '../drive/DriveDialogs';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { FolderTile } from './library/FolderTile';
import { FileActionsMenu, type FileActionItem } from './library/FileActionsMenu';
import { MediaPreviewDialog } from './library/MediaPreviewDialog';
import { useEscapeKey } from '../common/useEscapeKey';
import { childFolders, folderPath, folderPathLabel, descendantFolderIds } from './library/libraryFolders';

type SortKey = 'newest' | 'oldest' | 'name' | 'size';
const PAGE_SIZES = [24, 48, 96];

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Latin numbers and units inside an Arabic sentence get reordered by the bidi
 * algorithm ("MB 968.1"). An isolated left-to-right run keeps "968.1 MB" intact.
 */
const Ltr: React.FC<{ children: React.ReactNode }> = ({ children }) => <bdi dir="ltr">{children}</bdi>;

/** Short type label for a file without a dedicated icon: the real extension, not a generic "FILE". */
function extensionLabel(file: MediaFileDto): string {
  const ext = file.originalName.includes('.') ? file.originalName.split('.').pop() : '';
  if (ext && ext.length <= 5) return ext.toUpperCase();
  return file.fileType === 'html' ? 'HTML' : 'FILE';
}

/** Disk meter colour by how full the disk is (the server's low-space flag is an absolute 10 GB floor). */
function storageTone(stats: DiskStorageStats): 'ok' | 'warn' | 'critical' {
  if (stats.percentUsed >= 90) return 'critical';
  if (stats.percentUsed >= 80 || stats.isLowSpace) return 'warn';
  return 'ok';
}

const TONE_BAR = { ok: 'bg-emerald-500', warn: 'bg-amber-500', critical: 'bg-red-500' } as const;
const TONE_TEXT = {
  ok: 'text-neutral-text/70',
  warn: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
} as const;

/** Select-all checkbox that shows the "some selected" state instead of looking empty. */
const SelectAllCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}> = ({ checked, indeterminate, disabled, onChange, label }) => (
  <input
    type="checkbox"
    ref={(el) => {
      if (el) el.indeterminate = indeterminate;
    }}
    checked={checked}
    disabled={disabled}
    onChange={onChange}
    aria-label={label}
    className="w-4 h-4 accent-[var(--color-accent,#c9a24b)] cursor-pointer"
  />
);

/**
 * A zip-extracted website row (`html` whose file sits inside a bundle folder):
 * display-only. Title = the site name (the originalName without the trailing
 * ` (<path>)`), second line = the entry page inside the bundle. A loose .html
 * file keeps its plain name.
 */
function websiteInfo(file: MediaFileDto): { title: string; entry: string } | null {
  if (file.fileType !== 'html' || !file.storageKey || !file.storageKey.includes('/')) return null;
  const match = file.originalName.match(/^(.*)\s+\(([^()]*)\)$/);
  return {
    title: (match?.[1] || file.originalName).trim(),
    entry: match?.[2] ?? '',
  };
}

export const LibraryView: React.FC = () => {
  const { t } = useAdminT();
  const { showToast, confirm } = useAdmin();
  const { uploadFiles, isUploading } = useUploadManager();

  const [items, setItems] = useState<MediaFileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [storageStats, setStorageStats] = useState<DiskStorageStats | null>(null);

  // Virtual folders (null = library root)
  const [folders, setFolders] = useState<MediaFolderDto[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'linked' | 'orphaned'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'pdf' | 'model3d' | 'html' | 'other'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [pageSize, setPageSize] = useState<number>(24);

  // Uploading state
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Popovers & Dialogs
  const [activeUsageFile, setActiveUsageFile] = useState<MediaFileDto | null>(null);
  useEscapeKey(useCallback(() => setActiveUsageFile(null), []));
  const [previewFile, setPreviewFile] = useState<MediaFileDto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [nameDialog, setNameDialog] = useState<{ kind: 'create' } | { kind: 'rename'; folder: MediaFolderDto } | null>(null);
  const [moveRequest, setMoveRequest] = useState<
    { kind: 'files'; ids: string[] } | { kind: 'folder'; folder: MediaFolderDto } | null
  >(null);

  // Selection (file ids only)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Explicit "Select" mode (toolbar button). While it is on, or anything is selected,
  // a click anywhere on a card or row toggles it instead of opening the preview.
  const [selectMode, setSelectMode] = useState(false);
  const selecting = selectMode || selectedIds.size > 0;
  const exitSelecting = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // Layout mode (table list vs grid). The table is the default; a stored choice wins.
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ajda_media_layout_mode');
      if (saved === 'list' || saved === 'grid') return saved;
    }
    return 'list';
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

  // Browse mode = the folder view; everything else searches flat across all folders.
  const browseMode = debouncedSearch.trim() === '' && typeFilter === 'all' && statusFilter === 'all';

  // Selection resets on folder change, filter change and page change.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [folderId, statusFilter, typeFilter, debouncedSearch, page, pageSize]);

  // Only the newest request may write its result: a slow older answer must not replace a newer one.
  const latestRequest = useRef(0);

  const loadMedia = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const res = await fetchMediaList({
        page,
        limit: pageSize,
        type: typeFilter,
        status: statusFilter,
        search: debouncedSearch,
        sort,
        folder: browseMode ? (folderId ?? 'root') : 'all',
      });
      if (requestId !== latestRequest.current) return;
      // The last item of the last page was removed: step back instead of showing an empty grid.
      if (res.items.length === 0 && page > 1 && page > res.totalPages) {
        setPage(res.totalPages);
        return;
      }
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      if (requestId === latestRequest.current) showToast(t('media.toast.loadFailed'), 'error');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [page, pageSize, typeFilter, statusFilter, debouncedSearch, sort, browseMode, folderId, showToast, t]);

  const loadFolders = useCallback(async () => {
    try {
      setFolders(await fetchMediaFolders());
    } catch {
      // Non-critical: the file list still works without the folder rail.
    }
  }, []);

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
  }, [loadMedia]);

  useEffect(() => {
    void loadFolders();
    void loadStorageStats();
  }, [loadFolders, loadStorageStats]);

  const crumbs = useMemo(() => folderPath(folders, folderId), [folders, folderId]);
  const visibleFolders = useMemo(
    () => (browseMode ? childFolders(folders, folderId) : []),
    [folders, folderId, browseMode]
  );

  // Size of the rows on screen (fallback while the disk stats are loading)
  const visibleBytes = useMemo(() => items.reduce((acc, item) => acc + item.size, 0), [items]);

  const openFolder = (id: string | null) => {
    setFolderId(id);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      // Uploads land in the folder that is open right now (root stays byte-identical).
      await uploadFiles(Array.from(files), folderId ? { target: { kind: 'library', folderId } } : undefined);
      showToast(t('media.toast.uploadQueued'), 'success');
      void loadMedia();
      void loadFolders();
      void loadStorageStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('media.toast.uploadFailed');
      showToast(msg, 'error');
    }
  };

  const openPreview = (file: MediaFileDto) => {
    setPreviewFile(file);
  };

  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    showToast(ok ? t('media.action.copied') : t('media.action.copyFailed'), ok ? 'info' : 'error');
  };

  // The main copy button gives the permanent link (/f/<slug>); the direct
  // /uploads URL is copied from the preview.
  const handleCopyUrl = (file: MediaFileDto) => void copyLink(mediaPublicUrl(file));

  const refreshAll = () => {
    void loadMedia();
    void loadFolders();
    void loadStorageStats();
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
      showToast(t('media.toast.deleted'), 'success');
      refreshAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('media.toast.deleteFailed');
      showToast(msg, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  /* ------------------------------ bulk delete ------------------------------ */

  const selectedFiles = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds]);
  const selectedSize = useMemo(() => selectedFiles.reduce((acc, file) => acc + file.size, 0), [selectedFiles]);
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () => setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)));

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0 || bulkDeleting) return;
    const ok = await confirm({
      title: t('files.library.bulkDelete.title'),
      message: t('files.library.bulkDelete.message', { count: ids.length, size: formatBytes(selectedSize) }),
      confirmLabel: t('media.action.delete'),
      danger: true,
    });
    if (!ok) return;
    setBulkDeleting(true);
    let deleted = 0;
    let skipped = 0;
    // Sequential on purpose: the server answers 409 for files a project still uses.
    for (const id of ids) {
      try {
        await deleteMediaItem(id);
        deleted += 1;
      } catch {
        skipped += 1;
      }
    }
    setBulkDeleting(false);
    setSelectedIds(new Set());
    showToast(t('files.library.toast.bulkDeleted', { deleted, skipped }), skipped > 0 ? 'error' : 'success');
    refreshAll();
  };

  /* ----------------------------- folder actions ----------------------------- */

  const handleFolderSubmit = async (name: string) => {
    if (!nameDialog) return;
    if (nameDialog.kind === 'create') {
      await createMediaFolder(name, folderId);
      showToast(t('drive.toast.folderCreated'), 'success');
    } else {
      await updateMediaFolder(nameDialog.folder.id, { name });
      showToast(t('drive.toast.renamed'), 'success');
    }
    setNameDialog(null);
    void loadFolders();
  };

  const handleDeleteFolder = async (folder: MediaFolderDto) => {
    const ok = await confirm({
      title: t('files.library.deleteFolder.title'),
      message: t('files.library.deleteFolder.message'),
      confirmLabel: t('media.action.delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await deleteMediaFolder(folder.id);
      showToast(
        t('files.library.toast.folderDeleted', { files: res.movedFiles, folders: res.movedFolders }),
        'success'
      );
      // If the open view sat inside the deleted folder, follow it up one level.
      if (folderId && descendantFolderIds(folders, folder.id).has(folderId)) {
        openFolder(folder.parentId ?? null);
      }
      refreshAll();
    } catch (err: unknown) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  /* ------------------------------- move dialog ------------------------------ */

  // Maps the library folders onto the picker's node shape (stable identities).
  const loadPickerFolders = useCallback(
    (): Promise<DriveFolderNode[]> =>
      fetchMediaFolders().then((list) => list.map(({ id, name, parentId }) => ({ id, name, parentId }))),
    []
  );

  const createPickerFolder = useCallback(
    (name: string, parentId: string | null): Promise<DriveFolderNode> =>
      createMediaFolder(name, parentId).then((dto) => ({ id: dto.id, name: dto.name, parentId: dto.parentId })),
    []
  );

  const confirmMove = async (targetId: string | null) => {
    if (!moveRequest) return;
    if (moveRequest.kind === 'files') {
      const res = await moveMediaFiles(moveRequest.ids, targetId);
      setMoveRequest(null);
      setSelectedIds(new Set());
      showToast(t('files.library.toast.moved', { count: res.moved }), 'success');
    } else {
      await updateMediaFolder(moveRequest.folder.id, { parentId: targetId });
      setMoveRequest(null);
      showToast(t('files.library.toast.moved', { count: 1 }), 'success');
    }
    refreshAll();
  };

  /* --------------------------------- render --------------------------------- */

  const actionBtn =
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed';
  const ghostBtn = `${actionBtn} bg-canvas border border-muted-border/40 text-heading hover:bg-muted-surface`;

  // Card menu: download, move, and delete set apart (locked with a reason while a file is in use).
  const fileMenuItems = (file: MediaFileDto): FileActionItem[] => {
    const inUse = file.usageCount > 0;
    return [
      {
        key: 'download',
        label: t('media.action.download'),
        icon: <Download className="w-4 h-4" />,
        href: resolveMediaUrl(file.url),
      },
      {
        key: 'move',
        label: t('files.library.moveToFolder'),
        icon: <FolderInput className="w-4 h-4" />,
        onClick: () => setMoveRequest({ kind: 'files', ids: [file.id] }),
      },
      {
        key: 'delete',
        label: t('media.action.delete'),
        icon: inUse ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />,
        onClick: () => void handleDelete(file),
        danger: !inUse,
        muted: inUse,
        title: inUse ? t('media.delete.disabledProject') : undefined,
        separated: true,
      },
    ];
  };

  // One page of orphaned rows is everything there is -> real totals; otherwise say "on this page".
  const unusedOnOnePage = total <= items.length;
  const unusedCount = unusedOnOnePage ? total : items.length;
  const unusedSize = visibleBytes;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const tone = storageStats ? storageTone(storageStats) : 'ok';

  // Drag files from the desktop onto the page to upload them into the open folder.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    if (hasFiles(e)) e.preventDefault();
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div
      className="relative flex-1 flex flex-col gap-3"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-[1px]">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface shadow-xl text-sm font-bold text-accent">
            <Upload className="w-4 h-4" />
            {t('files.library.dropHint')}
          </div>
        </div>
      )}
      <StorageWarning
        stats={storageStats}
        action={{ label: t('media.warning.viewOrphaned'), onClick: () => setStatusFilter('orphaned') }}
      />

      {/*
        One quiet info line instead of a bordered box of chips. The old "linked / unused"
        chips counted the current page only (18 + 6 = 24 next to "31 files"), so they are
        gone; the status filter below is the way to see the real unused list.
      */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[11px] font-bold text-neutral-text/70 hid">
        <span className="inline-flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span>{t('media.stat.totalFiles')}:</span>
          <Ltr>{storageStats?.mediaCount ?? total}</Ltr>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileIcon className="w-3.5 h-3.5 text-blue-500" />
          <span>{t('media.stat.totalSize')}:</span>
          <Ltr>{formatBytes(storageStats?.mediaTotalBytes ?? visibleBytes)}</Ltr>
        </span>

        {/* Whole-server disk (not just the library), coloured by how full it is */}
        {storageStats && (
          <span
            className={`ms-auto inline-flex items-center gap-2 ${TONE_TEXT[tone]}`}
            title={t('media.stat.diskLabel')}
          >
            <HardDrive className="w-4 h-4 shrink-0" />
            <span>{t('media.stat.diskLabel')}</span>
            <span
              className="w-28 h-2 rounded-full bg-muted-surface overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={storageStats.percentUsed}
            >
              <span
                className={`block h-full rounded-full transition-all duration-500 ${TONE_BAR[tone]}`}
                style={{ width: `${storageStats.percentUsed}%` }}
              />
            </span>
            <Ltr>
              {storageStats.usedGb} / {storageStats.totalGb} GB
            </Ltr>
            <span className="inline-flex items-center gap-1">
              <span>·</span>
              <Ltr>{storageStats.freeGb} GB</Ltr>
              <span>{t('media.stat.freeWord')}</span>
            </span>
          </span>
        )}
      </div>

      {/* Unused banner (orphaned filter): count + size, never deletes anything by itself */}
      {statusFilter === 'orphaned' && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] font-bold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {unusedOnOnePage
              ? t('files.library.unusedBanner', { count: unusedCount, size: formatBytes(unusedSize) })
              : t('files.library.unusedBannerPage', { count: unusedCount, size: formatBytes(unusedSize) })}
          </span>
          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={items.length === 0}
            className="ms-auto px-2.5 py-1 rounded-lg bg-surface border border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 cursor-pointer"
          >
            {t('files.library.selectAllPage')}
          </button>
        </div>
      )}

      {/* Action & Filter Bar */}
      <div className="p-3 rounded-2xl bg-surface border border-muted-border/30 space-y-2.5 ">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search + sort + page size */}
          <div className="flex flex-1 items-center gap-2 max-w-2xl">
            <div className="relative flex-1 min-w-0">
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
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as SortKey);
                setPage(1);
              }}
              aria-label={t('files.library.sort')}
              className="h-10 px-2 rounded-xl border border-muted-border/40 bg-canvas text-xs font-bold text-heading focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="newest">{t('files.library.sort.newest')}</option>
              <option value="oldest">{t('files.library.sort.oldest')}</option>
              <option value="name">{t('files.library.sort.name')}</option>
              <option value="size">{t('files.library.sort.size')}</option>
            </select>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label={t('files.library.perPage')}
              className="h-10 px-2 rounded-xl border border-muted-border/40 bg-canvas text-xs font-bold text-heading focus:outline-none focus:border-accent cursor-pointer"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {t('files.library.perPageOption', { count: size })}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons (New folder, Select-all (grid), Upload & Layout Toggle) */}
          <div className="flex items-center gap-2">
            {browseMode && (
              <button type="button" onClick={() => setNameDialog({ kind: 'create' })} className={ghostBtn}>
                <FolderPlus className="w-4 h-4" />
                {t('files.library.newFolder')}
              </button>
            )}
            {/* Select mode: the first toolbar button; "select all" appears only while it is on */}
            <button
              type="button"
              onClick={() => (selecting ? exitSelecting() : setSelectMode(true))}
              disabled={items.length === 0 && !selecting}
              aria-pressed={selecting}
              className={`${actionBtn} h-10 border ${
                selecting
                  ? 'bg-accent/10 border-accent/40 text-accent'
                  : 'bg-canvas border-muted-border/40 text-heading hover:bg-muted-surface'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              {selecting ? t('files.library.selectDone') : t('files.library.select')}
            </button>
            {selecting && layoutMode === 'grid' && (
              <label className="flex items-center gap-1.5 px-2 h-10 rounded-xl border border-muted-border/40 bg-canvas text-[11px] font-bold text-neutral-text/70 cursor-pointer">
                <SelectAllCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  disabled={items.length === 0}
                  onChange={toggleSelectAll}
                  label={t('files.library.selectAllPage')}
                />
                {t('files.library.selectAllPage')}
              </label>
            )}

            {/* Layout Toggle (Table vs Grid) */}
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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-muted-border/20">
          {/* Type filter */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-canvas rounded-xl border border-muted-border/30 text-[11px] font-bold">
            {(['all', 'image', 'video', 'pdf', 'model3d', 'html', 'other'] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setTypeFilter(type);
                  setPage(1);
                }}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                  typeFilter === type ? 'bg-surface text-accent shadow-sm' : 'text-neutral-text/60 hover:text-heading'
                }`}
              >
                {t(`media.type.${type}`)}
              </button>
            ))}
          </div>
          

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


        </div>
      </div>

      {/* Folder navigation: breadcrumb + tiles in browse mode, flat hint otherwise */}
      {browseMode ? (
        <>
          {/* At the root the tab already says "Library"; the breadcrumb only earns its row inside a folder */}
          {folderId && <FolderBreadcrumb rootLabel={t('files.library.root')} crumbs={crumbs} onOpen={openFolder} />}
          {visibleFolders.length > 0 && layoutMode === 'grid' && (
            <p className="px-1 text-[11px] font-black text-neutral-text/60">{t('files.library.foldersHeading')}</p>
          )}
          {visibleFolders.length > 0 &&
            (layoutMode === 'grid' ? (
              <div className="flex flex-wrap gap-2">
                {visibleFolders.map((folder) => (
                  <FolderTile
                    key={folder.id}
                    folder={folder}
                    variant="grid"
                    countLabel={t('files.library.folderCount', { count: folder.fileCount })}
                    renameLabel={t('drive.action.rename')}
                    moveLabel={t('drive.action.move')}
                    deleteLabel={t('media.action.delete')}
                    onOpen={(target) => openFolder(target.id)}
                    onRename={(target) => setNameDialog({ kind: 'rename', folder: target })}
                    onMove={(target) => setMoveRequest({ kind: 'folder', folder: target })}
                    onDelete={(target) => void handleDeleteFolder(target)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-surface border border-muted-border/30">
                {visibleFolders.map((folder) => (
                  <FolderTile
                    key={folder.id}
                    folder={folder}
                    variant="list"
                    countLabel={t('files.library.folderCount', { count: folder.fileCount })}
                    renameLabel={t('drive.action.rename')}
                    moveLabel={t('drive.action.move')}
                    deleteLabel={t('media.action.delete')}
                    onOpen={(target) => openFolder(target.id)}
                    onRename={(target) => setNameDialog({ kind: 'rename', folder: target })}
                    onMove={(target) => setMoveRequest({ kind: 'folder', folder: target })}
                    onDelete={(target) => void handleDeleteFolder(target)}
                  />
                ))}
              </div>
            ))}
        </>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-canvas border border-muted-border/20 text-[11px] text-neutral-text/60">
          <span>{t('files.library.searchingAll')}</span>
          <button type="button" onClick={clearFilters} className="font-bold text-accent hover:underline cursor-pointer">
            {t('files.library.clearFilters')}
          </button>
        </div>
      )}

      {visibleFolders.length > 0 && items.length > 0 && layoutMode === 'grid' && (
        <p className="px-1 text-[11px] font-black text-neutral-text/60">{t('files.library.filesHeading')}</p>
      )}

      {/* Media Display (Table or Grid) */}
      {loading ? (
        <div className="flex-1 min-h-64 flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 text-accent animate-spin" />
          <span className="text-xs text-neutral-text/60">{t('media.uploading')}</span>
        </div>
      ) : items.length === 0 && visibleFolders.length === 0 ? (
        <div className="flex-1 min-h-64 p-12 rounded-2xl bg-surface border-2 border-dashed border-muted-border/40 flex flex-col items-center justify-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-canvas border border-muted-border/30 flex items-center justify-center text-neutral-text/40">
            {folderId ? <FolderInput className="w-6 h-6" /> : <ImageIcon className="w-6 h-6" />}
          </div>
          <p className="text-sm font-bold text-heading">
            {folderId ? t('files.library.emptyFolder') : t('media.empty.title')}
          </p>
          <p className="text-xs text-neutral-text/50">{t('media.empty.desc')}</p>
          <p className="text-[11px] text-neutral-text/40">{t('files.library.dropHint')}</p>
        </div>
      ) : layoutMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
          {items.map((file) => {
            const isImage = file.fileType === 'image';
            const isPdf = file.fileType === 'pdf';
            const isVideo = file.fileType === 'video';
            const isModel = file.fileType === 'model3d';
            const site = websiteInfo(file);
            const fullUrl = resolveMediaUrl(file.url);
            const isLinked = file.usageCount > 0;
            const isSelected = selectedIds.has(file.id);
            const folderChip = browseMode ? '' : folderPathLabel(folders, file.folderId);

            return (
              <div
                key={file.id}
                onClick={selecting ? () => toggleSelect(file.id) : undefined}
                className={`group relative rounded-2xl bg-surface border shadow-sm flex flex-col transition ${
                  selecting ? 'cursor-pointer select-none' : ''
                } ${
                  isSelected
                    ? 'border-accent ring-2 ring-accent/40 bg-accent/5'
                    : 'border-muted-border/30 hover:border-accent/40'
                }`}
              >
                {/* Thumbnail / Preview Area (compact). In select mode the click falls through to the card. */}
                <div
                  onClick={selecting ? undefined : () => openPreview(file)}
                  className={`h-24 bg-canvas flex items-center justify-center overflow-hidden rounded-t-2xl relative ${
                    selecting ? '' : 'cursor-pointer'
                  }`}
                >
                  {isImage ? (
                    <img
                      src={fullUrl}
                      alt={file.originalName}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : isPdf ? (
                    <div className="flex flex-col items-center gap-1 text-accent/80">
                      <FileText className="w-7 h-7" />
                      <span className="text-[9px] font-black tracking-wider uppercase">PDF</span>
                    </div>
                  ) : isVideo ? (
                    <div className="flex flex-col items-center gap-1 text-purple-500/80">
                      <VideoIcon className="w-7 h-7" />
                      <span className="text-[9px] font-black tracking-wider uppercase">VIDEO</span>
                    </div>
                  ) : isModel ? (
                    <div className="flex flex-col items-center gap-1 text-blue-500/80">
                      <Box className="w-7 h-7" />
                      <span className="text-[9px] font-black tracking-wider uppercase">3D</span>
                    </div>
                  ) : site ? (
                    <div className="flex flex-col items-center gap-1 text-emerald-500/80">
                      <Globe className="w-7 h-7" />
                      <span className="text-[9px] font-black tracking-wider uppercase">{t('files.library.type.website')}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-neutral-text/70">
                      <FileIcon className="w-7 h-7" />
                      <span className="text-[9px] font-black tracking-wider uppercase">{extensionLabel(file)}</span>
                    </div>
                  )}

                  {/* Selection checkbox: always visible in select mode, on hover otherwise */}
                  <label
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-1.5 start-1.5 z-10 flex items-center transition ${
                      selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(file.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={file.originalName}
                      className="w-4 h-4 accent-[var(--color-accent,#c9a24b)] cursor-pointer shadow"
                    />
                  </label>

                  {/* Badge only for the exception (unused). Used files get a quiet icon + count. */}
                  <div className="absolute top-1.5 end-1.5">
                    {isLinked ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!selecting) setActiveUsageFile(file);
                        }}
                        className="px-1.5 py-0.5 rounded-full bg-black/45 text-white font-black text-[9px] backdrop-blur-sm flex items-center gap-1 hover:bg-black/65 transition cursor-pointer"
                        title={`${t('media.badge.linked', { count: file.usageCount })} · ${t('media.usage.viewProjects')}`}
                        aria-label={t('media.badge.linked', { count: file.usageCount })}
                      >
                        <Link2 className="w-3 h-3" />
                        <span>{file.usageCount}</span>
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
                    <p
                      className="text-[11px] font-bold text-heading line-clamp-2 leading-snug break-words"
                      title={site ? site.title : file.originalName}
                    >
                      {site ? site.title : file.originalName}
                    </p>
                    {site && site.entry && (
                      <p className="text-[9px] text-neutral-text/50 font-mono truncate mt-0.5" dir="ltr" title={site.entry}>
                        {site.entry}
                      </p>
                    )}
                    {folderChip && (
                      <span
                        className="mt-1 inline-flex max-w-full items-center gap-1 px-1.5 py-0.5 rounded-md bg-canvas border border-muted-border/30 text-[9px] font-bold text-neutral-text/60"
                        title={folderChip}
                      >
                        <FolderInput className="w-3 h-3 shrink-0" />
                        <span className="truncate">{folderChip}</span>
                      </span>
                    )}
                    {/* Which content uses a non-image file: tells apart files with the same name */}
                    {!isImage && isLinked && file.usages[0] && (
                      <p
                        className="text-[9px] text-neutral-text/60 truncate mt-0.5"
                        title={t('files.library.usedBy', { name: file.usages[0].entityTitle })}
                      >
                        {t('files.library.usedBy', { name: file.usages[0].entityTitle })}
                      </p>
                    )}
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-neutral-text/60 mt-0.5">
                      <Ltr>{formatBytes(file.size)}</Ltr>
                      <span aria-hidden>·</span>
                      <bdi>{formatAdminDate(file.createdAt)}</bdi>
                    </p>
                  </div>

                  {/* Quick copy stays visible; everything else lives in the menu. Clicks here never toggle selection. */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-between pt-1.5 border-t border-muted-border/20 text-neutral-text/70"
                  >
                    <button
                      type="button"
                      onClick={() => handleCopyUrl(file)}
                      title={t('media.action.copyUrl')}
                      aria-label={t('media.action.copyUrl')}
                      className="p-1.5 rounded-lg hover:text-accent hover:bg-accent/10 transition cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <FileActionsMenu ariaLabel={t('media.action.more')} items={fileMenuItems(file)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table layout (default) */
        <div className="rounded-2xl bg-surface border border-muted-border/30 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse text-xs">
              <thead>
                <tr className="border-b border-muted-border/30 bg-canvas/60 text-[11px] font-bold text-neutral-text/60">
                  <th className="py-3 ps-4 pe-2 text-start font-bold w-10">
                    <SelectAllCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={items.length === 0}
                      onChange={toggleSelectAll}
                      label={t('files.library.selectAllPage')}
                    />
                  </th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.file')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.type')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.size')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.uploadedAt')}</th>
                  <th className="py-3 px-4 text-start font-bold">{t('media.table.status')}</th>
                  {!browseMode && <th className="py-3 px-4 text-start font-bold">{t('files.library.table.folder')}</th>}
                  <th className="py-3 px-4 text-end font-bold">{t('media.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted-border/20">
                {items.map((file) => {
                  const isImage = file.fileType === 'image';
                  const isPdf = file.fileType === 'pdf';
                  const isVideo = file.fileType === 'video';
                  const isModel = file.fileType === 'model3d';
                  const site = websiteInfo(file);
                  const fullUrl = resolveMediaUrl(file.url);
                  const isLinked = file.usageCount > 0;
                  const isSelected = selectedIds.has(file.id);
                  const folderChip = browseMode ? '' : folderPathLabel(folders, file.folderId);

                  return (
                    <tr
                      key={file.id}
                      onClick={selecting ? () => toggleSelect(file.id) : undefined}
                      className={`transition group ${selecting ? 'cursor-pointer select-none' : ''} ${
                        isSelected ? 'bg-accent/5' : 'hover:bg-canvas/50'
                      }`}
                    >
                      {/* Selection */}
                      <td className="py-3 ps-4 pe-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(file.id)}
                          aria-label={file.originalName}
                          className="w-4 h-4 accent-[var(--color-accent,#c9a24b)] cursor-pointer"
                        />
                      </td>

                      {/* File preview & names (full name, wrapped, never cut at the start) */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={selecting ? undefined : () => openPreview(file)}
                            className={`w-11 h-11 rounded-xl bg-canvas border border-muted-border/40 overflow-hidden shrink-0 flex items-center justify-center transition ${
                              selecting ? '' : 'cursor-pointer hover:border-accent/60'
                            }`}
                          >
                            {isImage ? (
                              <img src={fullUrl} alt={file.originalName} className="w-full h-full object-cover" loading="lazy" />
                            ) : isPdf ? (
                              <FileText className="w-5 h-5 text-accent/80" />
                            ) : isVideo ? (
                              <VideoIcon className="w-5 h-5 text-purple-500/80" />
                            ) : isModel ? (
                              <Box className="w-5 h-5 text-blue-500/80" />
                            ) : site ? (
                              <Globe className="w-5 h-5 text-emerald-500/80" />
                            ) : (
                              <FileIcon className="w-5 h-5 text-neutral-text/70" />
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs sm:max-w-sm">
                            <p
                              className={`font-bold text-heading text-xs line-clamp-2 leading-snug break-words ${
                                selecting ? '' : 'hover:text-accent cursor-pointer'
                              }`}
                              onClick={selecting ? undefined : () => openPreview(file)}
                              title={site ? site.title : file.originalName}
                            >
                              {site ? site.title : file.originalName}
                            </p>
                            {site && site.entry ? (
                              <p
                                className="font-mono text-[10px] text-neutral-text/50 truncate mt-0.5"
                                dir="ltr"
                                title={site.entry}
                              >
                                {site.entry}
                              </p>
                            ) : (
                              <p className="font-mono text-[10px] text-neutral-text/50 truncate mt-0.5" title={file.filename}>
                                {file.filename}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isImage
                              ? 'bg-accent/10 text-accent'
                              : isPdf
                              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                              : isVideo
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                              : isModel
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : site
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-canvas text-neutral-text/70'
                          }`}
                        >
                          {site && <Globe className="w-3 h-3" />}
                          {isImage
                            ? file.mimeType.replace('image/', '')
                            : isPdf
                            ? 'PDF'
                            : isVideo
                            ? 'VIDEO'
                            : isModel
                            ? '3D GLB'
                            : site
                            ? t('files.library.type.website')
                            : file.fileType}
                        </span>
                      </td>

                      {/* Size */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-heading font-medium">
                        <Ltr>{formatBytes(file.size)}</Ltr>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-neutral-text/70 text-[11px]">
                        <div className="flex flex-col">
                          <span className="font-medium text-heading">{formatAdminDate(file.createdAt)}</span>
                          <span className="text-[10px] text-neutral-text/40">{formatAdminDateTime(file.createdAt).split(' ')[1] || ''}</span>
                        </div>
                      </td>

                      {/* Usage Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isLinked ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!selecting) setActiveUsageFile(file);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] transition cursor-pointer"
                            title={t('media.usage.viewDetails')}
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

                      {/* Folder (flat search/filter mode only) */}
                      {!browseMode && (
                        <td className="py-3 px-4 whitespace-nowrap">
                          {folderChip ? (
                            <span
                              className="inline-flex max-w-[180px] items-center gap-1 px-2 py-0.5 rounded-md bg-canvas border border-muted-border/30 text-[10px] font-bold text-neutral-text/60"
                              title={folderChip}
                            >
                              <FolderInput className="w-3 h-3 shrink-0" />
                              <span className="truncate">{folderChip}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-text/40">—</span>
                          )}
                        </td>
                      )}

                      {/* Actions */}
                      <td className="py-3 px-4 whitespace-nowrap text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleCopyUrl(file)}
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
                            onClick={() => setMoveRequest({ kind: 'files', ids: [file.id] })}
                            title={t('files.library.moveToFolder')}
                            className="p-1.5 rounded-lg hover:text-accent hover:bg-accent/10 text-neutral-text/60 transition cursor-pointer"
                          >
                            <FolderInput className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(file)}
                            disabled={deletingId === file.id}
                            title={isLinked ? t('media.delete.disabledContent') : t('media.action.delete')}
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
            {t('media.pagination.prev')}
          </button>
          <span className="text-xs text-neutral-text/60 font-bold px-2">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl border border-muted-border/40 bg-surface text-xs font-bold text-heading hover:border-accent disabled:opacity-40 cursor-pointer"
          >
            {t('media.pagination.next')}
          </button>
        </div>
      )}

      {/*
        Selection bar. It sits after the list on purpose: sticky-to-bottom keeps it in view while
        scrolling, and because it is in the flow below the grid it never pushes the rows down.
      */}
      {selecting && (
        <div className="sticky bottom-3 z-30 flex flex-wrap items-center gap-2 p-2.5 w-fit max-w-full mx-auto rounded-xl bg-surface border border-accent/30 shadow-xl">
          <span className="text-xs font-bold text-heading me-1">
            {t('files.library.selected', { count: selectedIds.size })}
            {selectedIds.size > 0 && (
              <>
                {' · '}
                <Ltr>{formatBytes(selectedSize)}</Ltr>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={() => setMoveRequest({ kind: 'files', ids: [...selectedIds] })}
            disabled={selectedIds.size === 0}
            className={ghostBtn}
          >
            <FolderInput className="w-4 h-4" />
            {t('files.library.moveSelected')}
          </button>
          <span className="w-px h-6 bg-muted-border/40 mx-1" aria-hidden />
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={bulkDeleting || selectedIds.size === 0}
            className={`${actionBtn} border border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white`}
          >
            {bulkDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {t('files.library.deleteSelected', { count: selectedIds.size })}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0 || bulkDeleting}
            className={ghostBtn}
          >
            {t('files.library.discardSelection')}
          </button>
          <button
            type="button"
            onClick={exitSelecting}
            className="ms-1 p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
            aria-label={t('files.library.selectDone')}
            title={t('files.library.selectDone')}
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connected Entities Modal (Protection / Usage Details) */}
      {activeUsageFile && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setActiveUsageFile(null);
          }}
        >
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
                      {t('media.usage.field')} <span className="font-mono text-accent">{u.field}</span>
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
                {t('media.common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File details: links, slug and live preview (resizable) */}
      {previewFile && (
        <MediaPreviewDialog
          file={previewFile}
          onCopy={(link) => void copyLink(link)}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* New / rename folder dialog */}
      {nameDialog && (
        <DriveNameDialog
          title={nameDialog.kind === 'create' ? t('drive.dialog.newFolder.title') : t('drive.dialog.rename.title')}
          initial={nameDialog.kind === 'rename' ? nameDialog.folder.name : ''}
          confirmLabel={nameDialog.kind === 'create' ? t('drive.action.create') : t('drive.action.save')}
          onClose={() => setNameDialog(null)}
          onSubmit={handleFolderSubmit}
        />
      )}

      {/* Move dialog: one picker for files and for folders */}
      {moveRequest && (
        <DriveFolderPicker
          title={t('drive.dialog.move.title', {
            count: moveRequest.kind === 'files' ? moveRequest.ids.length : 1,
          })}
          confirmLabel={t('drive.dialog.move.confirm')}
          startId={folderId}
          blockedIds={moveRequest.kind === 'folder' ? [moveRequest.folder.id] : []}
          rootLabel={t('files.library.root')}
          loadFolders={loadPickerFolders}
          createFolder={createPickerFolder}
          onClose={() => setMoveRequest(null)}
          onConfirm={confirmMove}
        />
      )}
    </div>
  );
};
