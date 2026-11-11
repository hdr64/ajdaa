import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive as ArchiveIcon,
  Copy,
  Download,
  File as FileIcon,
  FileText,
  Film,
  Folder,
  FolderInput,
  FolderPlus,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Link2,
  Loader2,
  MoreVertical,
  Music,
  PackageOpen,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  UploadCloud,
  X as CloseIcon,
} from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useUploadManager } from '../../../context/UploadManagerContext';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { formatAdminDateTime } from '../../../pages/admin/adminFormat';
import { getErrorMessage } from '../../../services/api';
import { copyText } from '../../../utils/clipboard';
import { usePersistentState } from '../../../hooks/usePersistentState';
import { fetchStorageStats, type DiskStorageStats } from '../../../services/mediaService';
import {
  DRIVE_MAX_FILE_BYTES,
  copyDriveFile,
  copyDriveFolder,
  createDriveFolder,
  downloadDriveFile,
  downloadDriveZip,
  driveShareUrl,
  emptyDriveTrash,
  extractDriveZip,
  fetchDriveList,
  fetchDriveUsage,
  isDriveZip,
  moveDriveItems,
  purgeDriveItems,
  restoreDriveItems,
  trashDriveItems,
  updateDriveFile,
  updateDriveFolder,
  type DriveFile,
  type DriveFolder,
  type DriveItemIds,
  type DriveKind,
  type DriveListing,
  type DriveUsage,
} from '../../../services/driveService';
import { DriveDetailsDialog, DriveFolderPicker, DriveNameDialog } from '../drive/DriveDialogs';
import { formatBytes } from '../drive/driveFormat';
import { FolderBreadcrumb } from './FolderBreadcrumb';
import { StorageWarning } from './StorageWarning';

type View = 'files' | 'trash';
type LayoutMode = 'grid' | 'list';
type TypeFilter = 'all' | 'image' | 'video' | 'pdf' | 'other';
const TYPE_FILTERS: TypeFilter[] = ['all', 'image', 'video', 'pdf', 'other'];
const isLayoutMode = (v: unknown): v is LayoutMode => v === 'grid' || v === 'list';
const matchesFilter = (file: DriveFile, filter: TypeFilter): boolean =>
  filter === 'all' ||
  (filter === 'other' ? file.kind !== 'image' && file.kind !== 'video' && file.kind !== 'pdf' : file.kind === filter);
type Row = { type: 'folder'; item: DriveFolder } | { type: 'file'; item: DriveFile };
type Dialog =
  | { kind: 'newFolder' }
  | { kind: 'rename'; row: Row }
  | { kind: 'move' | 'copy'; rows: Row[] }
  | { kind: 'details'; fileId: string };

interface UploadItem {
  file: File;
  /** Path below the current folder (folder uploads and drops); empty for plain files. */
  relPath?: string;
}

const EMPTY_SELECTION: Set<string> = new Set();
const rowKey = (row: Row) => `${row.type === 'folder' ? 'd' : 'f'}:${row.item.id}`;
const toIds = (rows: Row[]): DriveItemIds => ({
  folderIds: rows.filter((r) => r.type === 'folder').map((r) => r.item.id),
  fileIds: rows.filter((r) => r.type === 'file').map((r) => r.item.id),
});

const KIND_ICON: Record<DriveKind, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  text: FileText,
  archive: ArchiveIcon,
  other: FileIcon,
};

/** Reads a drop (files and whole folders) into a flat upload list. Entries must be taken synchronously. */
async function collectDropped(items: DataTransferItemList): Promise<UploadItem[]> {
  const entries = Array.from(items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => Boolean(e));
  const out: UploadItem[] = [];

  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push({ file, relPath: `${prefix}${entry.name}` });
      return;
    }
    if (!entry.isDirectory) return;
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (batch.length === 0) break;
      for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
    }
  };

  for (const entry of entries) await walk(entry, '');
  return out;
}

/** Width of the row action menu in px (matches the old min-w-48). */
const MENU_WIDTH = 192;

export const DriveView: React.FC = () => {
  const { t } = useAdminT();
  const { showToast, confirm, confirmDelete } = useAdmin();
  const { uploadFiles } = useUploadManager();

  const [view, setView] = useState<View>('files');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [result, setResult] = useState<{ key: string; data: DriveListing } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [usage, setUsage] = useState<DriveUsage | null>(null);
  const [selection, setSelection] = useState<{ scope: string; keys: Set<string> }>({ scope: '', keys: new Set() });
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  /** Viewport position of the open row menu (fixed, so the scrolling list cannot clip it). */
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [layoutMode, setLayoutMode] = usePersistentState<LayoutMode>('ajda_drive_layout_mode', 'list', isLayoutMode);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [storageStats, setStorageStats] = useState<DiskStorageStats | null>(null);
  /** Id of the zip being extracted on the server (one at a time). */
  const [extractingId, setExtractingId] = useState<string | null>(null);

  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const searching = debouncedSearch.length > 0 && view === 'files';
  const canUpload = view === 'files' && !searching;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // What is on screen is identified by this key; `loading` is simply "the shown result is for another key".
  const requestKey = `${view}|${folderId ?? ''}|${debouncedSearch}`;
  const loading = result?.key !== requestKey;
  const listing = result?.data ?? null;
  const selected = selection.scope === requestKey ? selection.keys : EMPTY_SELECTION;
  const setSelected = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) =>
      setSelection((prev) => {
        const base = prev.scope === requestKey ? prev.keys : EMPTY_SELECTION;
        return { scope: requestKey, keys: typeof next === 'function' ? next(base) : next };
      }),
    [requestKey]
  );

  useEffect(() => {
    let cancelled = false;
    fetchDriveList(
      view === 'trash'
        ? { view: 'trash' }
        : debouncedSearch
          ? { view: 'search', q: debouncedSearch }
          : { view: 'files', folderId }
    )
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data });
      })
      .catch((err) => {
        if (cancelled) return;
        // A folder that vanished (trashed elsewhere) sends the user back to the root.
        if (folderId) setFolderId(null);
        else showToast(getErrorMessage(err, t('drive.toast.loadFailed')), 'error');
      });
    return () => {
      cancelled = true;
    };
    // `requestKey` already covers view, folderId and the search text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, reloadTick]);

  const loadUsage = useCallback(() => {
    fetchDriveUsage()
      .then(setUsage)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    fetchStorageStats()
      .then(setStorageStats)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    document.addEventListener('click', close);
    // Capture: the list scrolls inside its own container, and scroll does not bubble.
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menuFor]);

  // Folders have no type, so they only show under "All".
  const rows: Row[] = useMemo(
    () => [
      ...(typeFilter === 'all' ? (listing?.folders ?? []) : []).map((item): Row => ({ type: 'folder', item })),
      ...(listing?.files ?? []).filter((f) => matchesFilter(f, typeFilter)).map((item): Row => ({ type: 'file', item })),
    ],
    [listing, typeFilter]
  );
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

  const refresh = useCallback(() => {
    setReloadTick((n) => n + 1);
    loadUsage();
  }, [loadUsage]);

  /** Runs one action: toast on success or failure, then reloads. Returns whether it worked. */
  const run = useCallback(
    async (action: () => Promise<unknown>, successKey?: Parameters<typeof t>[0]): Promise<boolean> => {
      try {
        await action();
        if (successKey) showToast(t(successKey), 'success');
        refresh();
        return true;
      } catch (err) {
        showToast(getErrorMessage(err, t('drive.toast.actionFailed')), 'error');
        refresh();
        return false;
      }
    },
    [refresh, showToast, t]
  );

  /** Streams folders and/or files as one zip straight to disk. */
  const downloadZip = useCallback(
    async (items: DriveItemIds) => {
      try {
        await downloadDriveZip(items);
      } catch (err) {
        showToast(getErrorMessage(err, t('drive.toast.zipFailed')), 'error');
      }
    },
    [showToast, t]
  );

  /** Unpacks a zip into a new folder next to it. Long-running: the row shows a spinner meanwhile. */
  const extractZip = useCallback(
    async (file: DriveFile) => {
      if (extractingId) return;
      setExtractingId(file.id);
      showToast(t('drive.toast.extracting', { name: file.name }), 'info');
      try {
        const res = await extractDriveZip(file.id);
        showToast(
          res.skipped > 0
            ? t('drive.toast.extractedSkipped', { files: res.files, folder: res.folder.name, skipped: res.skipped })
            : t('drive.toast.extracted', { files: res.files, folder: res.folder.name }),
          'success'
        );
      } catch (err) {
        showToast(getErrorMessage(err, t('drive.toast.extractFailed')), 'error');
      } finally {
        setExtractingId(null);
        refresh();
      }
    },
    [extractingId, refresh, showToast, t]
  );

  /* -------------------------------- uploads -------------------------------- */

  const folderName = listing?.folder?.name;
  const uploadItems = useCallback(
    async (items: UploadItem[]) => {
      if (items.length === 0) return;
      const allowed = items.filter(({ file }) => {
        if (file.size <= DRIVE_MAX_FILE_BYTES) return true;
        showToast(t('drive.upload.tooLarge', { name: file.name }), 'error');
        return false;
      });
      const skipped = items.length - allowed.length;
      if (allowed.length === 0) return;

      const done = (
        await uploadFiles(
          allowed.map((i) => i.file),
          { target: { kind: 'drive', folderId, folderName }, relPaths: allowed.map((i) => i.relPath) }
        )
      ).length;
      const failed = allowed.length - done + skipped;
      if (done > 0 || failed > 0) {
        showToast(
          failed > 0 ? t('drive.upload.partial', { done, failed }) : t('drive.upload.done', { count: done }),
          failed > 0 ? 'error' : 'success'
        );
      }
      refresh();
    },
    [folderId, folderName, refresh, showToast, t, uploadFiles]
  );

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>, isFolder: boolean) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    void uploadItems(
      files.map((file) => ({ file, relPath: isFolder ? file.webkitRelativePath || undefined : undefined }))
    );
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (!canUpload) return;
    void uploadItems(await collectDropped(e.dataTransfer.items));
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files');

  /* -------------------------------- actions -------------------------------- */

  const openFolder = (id: string | null) => {
    setSearch('');
    setDebouncedSearch('');
    setView('files');
    setFolderId(id);
  };

  const trashRows = async (list: Row[]) => {
    const ok = await confirm({
      title: t('drive.trash.confirm.title'),
      message: t('drive.trash.confirm.message', { count: list.length }),
      confirmLabel: t('drive.action.trash'),
      danger: true,
    });
    if (ok) await run(() => trashDriveItems(toIds(list)), 'drive.toast.trashed');
  };

  const purgeRows = async (list: Row[]) => {
    const ok = await confirmDelete({
      title: t('drive.purge.confirm.title'),
      message: t('drive.purge.confirm.message', { count: list.length }),
      confirmLabel: t('drive.action.deleteForever'),
    });
    if (ok) await run(() => purgeDriveItems(toIds(list)), 'drive.toast.deleted');
  };

  const emptyTrash = async () => {
    const ok = await confirmDelete({
      title: t('drive.empty.confirm.title'),
      message: t('drive.empty.confirm.message'),
      confirmLabel: t('drive.action.emptyTrash'),
    });
    if (ok) await run(() => emptyDriveTrash(), 'drive.toast.deleted');
  };

  const copyLink = async (file: DriveFile) => {
    const ok = await copyText(driveShareUrl(file));
    showToast(ok ? t('drive.toast.linkCopied') : t('drive.toast.linkCopyFailed'), ok ? 'info' : 'error');
  };

  const toggleSelect = (row: Row) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const key = rowKey(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));

  const detailsFile =
    dialog?.kind === 'details' ? (listing?.files.find((f) => f.id === dialog.fileId) ?? null) : null;

  const btn =
    'inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed';
  const ghost = `${btn} bg-canvas border border-muted-border/40 text-heading hover:bg-muted-surface`;
  const primary = `${btn} bg-accent text-white hover:opacity-90`;

  /* --------------------------------- render -------------------------------- */

  const menuItems = (row: Row): { key: string; label: string; icon: React.ComponentType<{ className?: string }>; danger?: boolean; run: () => void }[] => {
    if (view === 'trash') {
      return [
        { key: 'restore', label: t('drive.action.restore'), icon: RotateCcw, run: () => void run(() => restoreDriveItems(toIds([row])), 'drive.toast.restored') },
        { key: 'purge', label: t('drive.action.deleteForever'), icon: Trash2, danger: true, run: () => void purgeRows([row]) },
      ];
    }
    const common = [
      { key: 'rename', label: t('drive.action.rename'), icon: Pencil, run: () => setDialog({ kind: 'rename', row }) },
      { key: 'move', label: t('drive.action.move'), icon: FolderInput, run: () => setDialog({ kind: 'move', rows: [row] }) },
      { key: 'copy', label: t('drive.action.copy'), icon: Copy, run: () => setDialog({ kind: 'copy', rows: [row] }) },
    ];
    const trash = { key: 'trash', label: t('drive.action.trash'), icon: Trash2, danger: true, run: () => void trashRows([row]) };
    if (row.type === 'folder') {
      const folder = row.item;
      return [
        { key: 'open', label: t('drive.action.open'), icon: Folder, run: () => openFolder(folder.id) },
        { key: 'zip', label: t('drive.action.downloadZip'), icon: ArchiveIcon, run: () => void downloadZip({ folderIds: [folder.id], fileIds: [] }) },
        ...common,
        trash,
      ];
    }
    const file = row.item;
    return [
      { key: 'details', label: t('drive.action.details'), icon: Link2, run: () => setDialog({ kind: 'details', fileId: file.id }) },
      { key: 'link', label: t('drive.action.copyLink'), icon: Copy, run: () => void copyLink(file) },
      { key: 'download', label: t('drive.action.download'), icon: Download, run: () => void downloadDriveFile(file).catch(() => showToast(t('drive.toast.downloadFailed'), 'error')) },
      ...(isDriveZip(file)
        ? [{ key: 'extract', label: t('drive.action.extract'), icon: PackageOpen, run: () => void extractZip(file) }]
        : []),
      ...common,
      trash,
    ];
  };

  /** The three-dot menu of one row or card, shared by both layouts. */
  const renderMenu = (row: Row, key: string) => {
    const isOpen = menuFor === key;
    return (
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setMenuFor(null);
              return;
            }
            const rect = e.currentTarget.getBoundingClientRect();
            const menuHeight = menuItems(row).length * 36 + 12;
            const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
            const left = Math.max(8, rtl ? rect.left : rect.right - MENU_WIDTH);
            const fitsBelow = rect.bottom + menuHeight + 8 <= window.innerHeight;
            setMenuPos(
              fitsBelow || rect.top < menuHeight
                ? { top: rect.bottom + 4, left }
                : { bottom: window.innerHeight - rect.top + 4, left }
            );
            setMenuFor(key);
          }}
          aria-label={row.item.name}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          className="p-1.5 rounded-lg text-neutral-text/60 hover:text-heading hover:bg-muted-surface cursor-pointer"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {isOpen && menuPos && (
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            style={{ top: menuPos.top, bottom: menuPos.bottom, left: menuPos.left, width: MENU_WIDTH }}
            className="fixed z-50 py-1 rounded-xl bg-surface border border-muted-border/40 shadow-xl"
          >
            {menuItems(row).map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuFor(null);
                  item.run();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-start cursor-pointer hover:bg-muted-surface ${
                  item.danger ? 'text-red-500' : 'text-heading'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const title = view === 'trash' ? t('drive.view.trash') : searching ? t('drive.view.search') : null;

  return (
    <div
      className="flex-1 min-h-0 flex flex-col gap-4 relative"
      onDragEnter={(e) => {
        if (!canUpload || !hasFiles(e)) return;
        dragDepth.current++;
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!canUpload || !hasFiles(e)) return;
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDragOver={(e) => {
        if (canUpload && hasFiles(e)) e.preventDefault();
      }}
      onDrop={(e) => void onDrop(e)}
    >
      <StorageWarning stats={storageStats} />

      {/* Usage + view switch */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center p-1 bg-canvas rounded-xl border border-muted-border/40">
          {(['files', 'trash'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setSearch('');
                setView(v);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                view === v ? 'bg-accent text-white' : 'text-neutral-text/70 hover:text-heading'
              }`}
            >
              {t(v === 'files' ? 'drive.view.files' : 'drive.view.trash')}
            </button>
          ))}
        </div>
        {usage && (
          <div className="flex items-center gap-2 text-[11px] text-neutral-text/70">
            <HardDrive className="w-4 h-4 text-accent" />
            <span>
              {t('drive.usage.files')}: <b className="text-heading">{usage.fileCount}</b>
            </span>
            <span>
              {t('drive.usage.size')}: <b className="text-heading">{formatBytes(usage.totalBytes)}</b>
            </span>
            {usage.trashedBytes > 0 && <span>{t('drive.usage.trashed', { size: formatBytes(usage.trashedBytes) })}</span>}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-2xl bg-surface border border-muted-border/30 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-text/40 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (view === 'trash') setView('files');
              }}
              placeholder={t('drive.searchPlaceholder')}
              className="w-full h-10 ps-9 pe-4 rounded-xl border border-muted-border/40 bg-canvas text-xs text-heading placeholder:text-neutral-text/40 focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {view === 'trash' ? (
              <button type="button" onClick={() => void emptyTrash()} disabled={rows.length === 0} className={`${btn} bg-red-500 text-white hover:opacity-90`}>
                <Trash2 className="w-4 h-4" />
                {t('drive.action.emptyTrash')}
              </button>
            ) : (
              <>
                <button type="button" onClick={() => setDialog({ kind: 'newFolder' })} disabled={!canUpload} className={ghost}>
                  <FolderPlus className="w-4 h-4" />
                  {t('drive.action.newFolder')}
                </button>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={!canUpload} className={primary}>
                  <Upload className="w-4 h-4" />
                  {t('drive.action.upload')}
                </button>
                <label className={`${ghost} ${!canUpload ? 'opacity-40 pointer-events-none' : ''}`}>
                  <UploadCloud className="w-4 h-4" />
                  {t('drive.action.uploadFolder')}
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    ref={(el) => {
                      el?.setAttribute('webkitdirectory', '');
                    }}
                    onChange={(e) => onPickFiles(e, true)}
                  />
                </label>
              </>
            )}
            <div className="flex items-center p-1 bg-canvas rounded-xl border border-muted-border/40 text-neutral-text/60">
              {(['grid', 'list'] as const).map((mode) => {
                const ModeIcon = mode === 'grid' ? LayoutGrid : List;
                const label = t(mode === 'grid' ? 'media.layout.grid' : 'media.layout.list');
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLayoutMode(mode)}
                    className={`p-2 rounded-lg transition cursor-pointer flex items-center justify-center ${
                      layoutMode === mode ? 'bg-surface text-accent shadow-xs' : 'hover:text-heading hover:bg-surface/50'
                    }`}
                    title={label}
                    aria-label={label}
                    aria-pressed={layoutMode === mode}
                  >
                    <ModeIcon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={refresh} aria-label={t('drive.action.refresh')} title={t('drive.action.refresh')} className={`${ghost} px-3`}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => onPickFiles(e, false)} />

        {/* Type filter */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
          {TYPE_FILTERS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              aria-pressed={typeFilter === type}
              className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                typeFilter === type ? 'bg-accent/10 text-accent font-black' : 'text-neutral-text/50 hover:text-heading'
              }`}
            >
              {t(`files.filter.${type}`)}
            </button>
          ))}
        </div>

        {/* Breadcrumbs */}
        {view === 'files' && !searching && (
          <FolderBreadcrumb rootLabel={t('drive.folder.root')} crumbs={listing?.breadcrumbs ?? []} onOpen={openFolder} />
        )}
        {title && <p className="text-xs font-black text-heading">{title}</p>}

        {/* Bulk actions */}
        {selectedRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-accent/10 border border-accent/20">
            <span className="text-xs font-bold text-heading me-2">{t('drive.selected', { count: selectedRows.length })}</span>
            {view === 'trash' ? (
              <>
                <button type="button" onClick={() => void run(() => restoreDriveItems(toIds(selectedRows)), 'drive.toast.restored')} className={ghost}>
                  <RotateCcw className="w-4 h-4" />
                  {t('drive.action.restore')}
                </button>
                <button type="button" onClick={() => void purgeRows(selectedRows)} className={`${btn} bg-red-500 text-white hover:opacity-90`}>
                  <Trash2 className="w-4 h-4" />
                  {t('drive.action.deleteForever')}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setDialog({ kind: 'move', rows: selectedRows })} className={ghost}>
                  <FolderInput className="w-4 h-4" />
                  {t('drive.action.move')}
                </button>
                <button type="button" onClick={() => setDialog({ kind: 'copy', rows: selectedRows })} className={ghost}>
                  <Copy className="w-4 h-4" />
                  {t('drive.action.copy')}
                </button>
                {(selectedRows.some((r) => r.type === 'folder') || selectedRows.length >= 2) && (
                  <button type="button" onClick={() => void downloadZip(toIds(selectedRows))} className={ghost}>
                    <ArchiveIcon className="w-4 h-4" />
                    {t('drive.action.downloadZip')}
                  </button>
                )}
                <button type="button" onClick={() => void trashRows(selectedRows)} className={`${btn} bg-red-500 text-white hover:opacity-90`}>
                  <Trash2 className="w-4 h-4" />
                  {t('drive.action.trash')}
                </button>
              </>
            )}
            <button type="button" onClick={() => setSelected(new Set())} className="ms-auto p-1.5 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer" aria-label={t('drive.action.clearSelection')} title={t('drive.action.clearSelection')}>
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-surface border border-muted-border/30 overflow-hidden">
        <div
          className={`shrink-0 ${
            layoutMode === 'grid' ? 'flex' : 'hidden sm:grid grid-cols-[2.5rem_1fr_7rem_11rem_2.5rem]'
          } items-center gap-2 px-4 py-2.5 border-b border-muted-border/20 text-[10px] font-bold text-neutral-text/50`}
        >
          <input
            type="checkbox"
            checked={allSelected}
            disabled={rows.length === 0}
            onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map(rowKey)))}
            aria-label={t('drive.action.selectAll')}
            className="w-4 h-4 accent-[var(--color-accent,#c9a24b)] cursor-pointer"
          />
          {layoutMode === 'grid' ? (
            <span>{t('drive.action.selectAll')}</span>
          ) : (
            <>
              <span>{t('drive.col.name')}</span>
              <span>{t('drive.col.size')}</span>
              <span>{view === 'trash' ? t('drive.col.trashed') : t('drive.col.modified')}</span>
              <span />
            </>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
        {loading && !listing ? (
          <p className="p-10 text-center text-xs text-neutral-text/50">…</p>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-xs text-neutral-text/50">
            {view === 'trash' ? t('drive.empty.trash') : searching ? t('drive.empty.search') : t('drive.empty.folder')}
          </p>
        ) : layoutMode === 'grid' ? (
          <ul
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 p-4 ${
              loading ? 'opacity-60 transition-opacity' : 'transition-opacity'
            }`}
          >
            {rows.map((row) => {
              const key = rowKey(row);
              const isFolder = row.type === 'folder';
              const extracting = !isFolder && extractingId === row.item.id;
              const Icon = extracting ? Loader2 : isFolder ? Folder : KIND_ICON[row.item.kind];
              const file = isFolder ? null : (row.item as DriveFile);
              return (
                <li
                  key={key}
                  className={`relative rounded-xl border p-3 flex flex-col items-center gap-2 text-center ${
                    selected.has(key) ? 'border-accent bg-accent/5' : 'border-muted-border/30 bg-canvas hover:bg-muted-surface/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleSelect(row)}
                    aria-label={row.item.name}
                    className="absolute top-2 start-2 w-4 h-4 accent-[var(--color-accent,#c9a24b)] cursor-pointer"
                  />
                  <div className="absolute top-1 end-1">{renderMenu(row, key)}</div>
                  <button
                    type="button"
                    disabled={view === 'trash'}
                    onClick={() => (isFolder ? openFolder(row.item.id) : setDialog({ kind: 'details', fileId: row.item.id }))}
                    className="w-full flex flex-col items-center gap-2 pt-6 cursor-pointer disabled:cursor-default"
                  >
                    <Icon className={`w-10 h-10 shrink-0 ${extracting ? 'animate-spin text-accent' : isFolder ? 'text-amber-500' : 'text-neutral-text/60'}`} />
                    <span className="block w-full truncate text-xs font-bold text-heading" dir="auto" title={row.item.name}>
                      {row.item.name}
                    </span>
                    {file && (
                      <span className="text-[10px] text-neutral-text/60" dir="ltr">
                        {formatBytes(file.size)}
                      </span>
                    )}
                  </button>
                  {file?.isPublic && view === 'files' && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <Link2 className="w-3 h-3" />
                      {t('drive.badge.shared')}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {rows.map((row) => {
              const key = rowKey(row);
              const isFolder = row.type === 'folder';
              const extracting = !isFolder && extractingId === row.item.id;
              const Icon = extracting ? Loader2 : isFolder ? Folder : KIND_ICON[row.item.kind];
              return (
                <li
                  key={key}
                  className={`grid grid-cols-[2.5rem_1fr_2.5rem] sm:grid-cols-[2.5rem_1fr_7rem_11rem_2.5rem] items-center gap-2 px-4 py-2 border-b border-muted-border/10 last:border-b-0 ${
                    selected.has(key) ? 'bg-accent/5' : 'hover:bg-muted-surface/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggleSelect(row)}
                    aria-label={row.item.name}
                    className="w-4 h-4 accent-[var(--color-accent,#c9a24b)] cursor-pointer"
                  />
                  <button
                    type="button"
                    disabled={view === 'trash'}
                    onClick={() => (isFolder ? openFolder(row.item.id) : setDialog({ kind: 'details', fileId: row.item.id }))}
                    className="flex items-center gap-3 min-w-0 text-start cursor-pointer disabled:cursor-default"
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${extracting ? 'animate-spin text-accent' : isFolder ? 'text-amber-500' : 'text-neutral-text/60'}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-bold text-heading" dir="auto">
                        {row.item.name}
                      </span>
                      {!isFolder && (row.item as DriveFile).isPublic && view === 'files' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Link2 className="w-3 h-3" />
                          {t('drive.badge.shared')}
                        </span>
                      )}
                    </span>
                  </button>
                  <span className="hidden sm:block text-[11px] text-neutral-text/70" dir="ltr">
                    {isFolder ? '—' : formatBytes((row.item as DriveFile).size)}
                  </span>
                  <span className="hidden sm:block text-[11px] text-neutral-text/70">
                    {formatAdminDateTime(view === 'trash' ? row.item.trashedAt : row.item.updatedAt)}
                  </span>
                  {renderMenu(row, key)}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>

      {dragging && canUpload && (
        <div className="absolute inset-0 z-40 rounded-2xl border-2 border-dashed border-accent bg-accent/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-surface shadow-xl text-sm font-black text-heading">
            <UploadCloud className="w-5 h-5 text-accent" />
            {t('drive.drop.hint')}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {dialog?.kind === 'newFolder' && (
        <DriveNameDialog
          title={t('drive.dialog.newFolder.title')}
          confirmLabel={t('drive.action.create')}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            await createDriveFolder(name, folderId);
            setDialog(null);
            showToast(t('drive.toast.folderCreated'), 'success');
            refresh();
          }}
        />
      )}

      {dialog?.kind === 'rename' && (
        <DriveNameDialog
          title={t('drive.dialog.rename.title')}
          initial={dialog.row.item.name}
          confirmLabel={t('drive.action.save')}
          onClose={() => setDialog(null)}
          onSubmit={async (name) => {
            const { row } = dialog;
            if (row.type === 'folder') await updateDriveFolder(row.item.id, { name });
            else await updateDriveFile(row.item.id, { name });
            setDialog(null);
            showToast(t('drive.toast.renamed'), 'success');
            refresh();
          }}
        />
      )}

      {(dialog?.kind === 'move' || dialog?.kind === 'copy') && (
        <DriveFolderPicker
          title={t(dialog.kind === 'move' ? 'drive.dialog.move.title' : 'drive.dialog.copy.title', { count: dialog.rows.length })}
          confirmLabel={t(dialog.kind === 'move' ? 'drive.dialog.move.confirm' : 'drive.dialog.copy.confirm')}
          startId={folderId}
          blockedIds={dialog.rows.filter((r) => r.type === 'folder').map((r) => r.item.id)}
          onClose={() => setDialog(null)}
          onConfirm={async (targetId) => {
            const { rows: list, kind } = dialog;
            if (kind === 'move') {
              await moveDriveItems(toIds(list), targetId);
            } else {
              for (const row of list) {
                if (row.type === 'folder') await copyDriveFolder(row.item.id, targetId);
                else await copyDriveFile(row.item.id, targetId);
              }
            }
            setDialog(null);
            setSelected(new Set());
            showToast(t(kind === 'move' ? 'drive.toast.moved' : 'drive.toast.copied'), 'success');
            refresh();
          }}
        />
      )}

      {detailsFile && (
        <DriveDetailsDialog
          file={detailsFile}
          onClose={() => setDialog(null)}
          onChanged={(next) =>
            setResult((prev) =>
              prev ? { ...prev, data: { ...prev.data, files: prev.data.files.map((f) => (f.id === next.id ? next : f)) } } : prev
            )
          }
        />
      )}
    </div>
  );
};
