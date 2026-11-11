import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, Download, Folder, FolderPlus, X as CloseIcon } from 'lucide-react';
import { useAdmin } from '../../../pages/admin/adminContextDef';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { getErrorMessage } from '../../../services/api';
import { copyText } from '../../../utils/clipboard';
import {
  canPreviewDriveFile,
  downloadDriveFile,
  driveBlobUrl,
  driveShareUrl,
  fetchDriveFolders,
  updateDriveFile,
  type DriveFile,
  type DriveFolderNode,
} from '../../../services/driveService';
import { formatAdminDateTime } from '../../../pages/admin/adminFormat';
import { formatBytes } from './driveFormat';

const overlay = 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
const panel = 'w-full rounded-2xl bg-surface border border-muted-border/40 shadow-2xl';
const primaryBtn =
  'px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:opacity-90 disabled:opacity-40 cursor-pointer';
const ghostBtn =
  'px-4 py-2 rounded-xl bg-canvas border border-muted-border/40 text-xs font-bold text-heading hover:bg-muted-surface cursor-pointer';

function DialogHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const { t } = useAdminT();
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h3 className="text-sm font-black text-heading truncate">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('drive.action.close')}
        className="p-1 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
      >
        <CloseIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ------------------------------- name prompt ------------------------------ */

export const DriveNameDialog: React.FC<{
  title: string;
  initial?: string;
  confirmLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}> = ({ title, initial = '', confirmLabel, onSubmit, onClose }) => {
  const { t } = useAdminT();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // Select the name without its extension so a rename keeps `.pdf`.
    const dot = initial.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(name.trim());
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className={overlay} onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={`${panel} max-w-sm`}>
        <DialogHeader title={title} onClose={onClose} />
        <div className="px-5 pb-4 space-y-2">
          <label className="block text-[10px] font-bold text-neutral-text/60">{t('drive.dialog.name.label')}</label>
          <input
            ref={inputRef}
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('drive.dialog.name.placeholder')}
            className="w-full h-10 px-3 rounded-xl border border-muted-border/40 bg-canvas text-xs text-heading focus:outline-none focus:border-accent"
          />
          {error && <p className="text-[11px] font-bold text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 pb-4">
          <button type="button" onClick={onClose} className={ghostBtn}>
            {t('drive.action.cancel')}
          </button>
          <button type="submit" disabled={!name.trim() || busy} className={primaryBtn}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
};

/* ------------------------------ folder picker ------------------------------ */

/** Navigate-and-confirm picker for move / copy. `blockedIds` are folders that cannot be the target (the moved ones and their children). */
/// The optional props keep Drive byte-for-byte unchanged; the Library tab passes its own
/// folder source, root label and create action (see task-libfolders-c).
export const DriveFolderPicker: React.FC<{
  title: string;
  confirmLabel: string;
  startId: string | null;
  blockedIds: string[];
  onConfirm: (targetId: string | null) => Promise<void>;
  onClose: () => void;
  /** Folder source; defaults to the Drive folders. */
  loadFolders?: () => Promise<DriveFolderNode[]>;
  /** Root button and "current target" text; defaults to Drive's root label. */
  rootLabel?: string;
  /** When given, the picker shows a small "New folder here" button. */
  createFolder?: (name: string, parentId: string | null) => Promise<DriveFolderNode>;
}> = ({ title, confirmLabel, startId, blockedIds, onConfirm, onClose, loadFolders, rootLabel, createFolder }) => {
  const { t, language } = useAdminT();
  const Forward = language === 'ar' ? ChevronLeft : ChevronRight;
  const load = loadFolders ?? fetchDriveFolders;
  const [nodes, setNodes] = useState<DriveFolderNode[] | null>(null);
  const [current, setCurrent] = useState<string | null>(startId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((list) => !cancelled && setNodes(list))
      .catch((err) => !cancelled && setError(getErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [load, reloadTick]);

  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  const byId = useMemo(() => new Map((nodes ?? []).map((n) => [n.id, n])), [nodes]);

  // Folders under a blocked folder are blocked too (a folder cannot move into itself).
  const blocked = useMemo(() => {
    const set = new Set(blockedIds);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of nodes ?? []) {
        if (n.parentId && set.has(n.parentId) && !set.has(n.id)) {
          set.add(n.id);
          grew = true;
        }
      }
    }
    return set;
  }, [blockedIds, nodes]);

  const trail = useMemo(() => {
    const out: DriveFolderNode[] = [];
    let id = current;
    while (id && byId.has(id) && out.length < 64) {
      const node = byId.get(id) as DriveFolderNode;
      out.unshift(node);
      id = node.parentId;
    }
    return out;
  }, [current, byId]);

  const children = (nodes ?? []).filter((n) => n.parentId === current && !blocked.has(n.id));
  const targetBlocked = current !== null && blocked.has(current);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(current);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className={overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`${panel} max-w-md flex flex-col max-h-[80vh]`}>
        <DialogHeader title={title} onClose={onClose} />
        <div className="px-5 pb-2 flex flex-wrap items-center gap-1 text-[11px] text-neutral-text/70">
          <button type="button" onClick={() => setCurrent(null)} className="font-bold text-accent hover:underline cursor-pointer">
            {rootLabel ?? t('drive.dialog.target.root')}
          </button>
          {trail.map((node) => (
            <React.Fragment key={node.id}>
              <Forward className="w-3 h-3 shrink-0" />
              <button type="button" onClick={() => setCurrent(node.id)} className="font-bold text-accent hover:underline cursor-pointer">
                {node.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="px-3 flex-1 overflow-y-auto min-h-40 border-y border-muted-border/20 py-2">
          {nodes === null && !error ? (
            <p className="p-4 text-center text-xs text-neutral-text/50">…</p>
          ) : children.length === 0 ? (
            <p className="p-4 text-center text-xs text-neutral-text/50">{t('drive.dialog.target.none')}</p>
          ) : (
            children.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setCurrent(node.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-start hover:bg-muted-surface cursor-pointer"
              >
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-heading">{node.name}</span>
                <Forward className="w-3.5 h-3.5 text-neutral-text/40 shrink-0" />
              </button>
            ))
          )}
        </div>
        {error && <p className="px-5 pt-2 text-[11px] font-bold text-red-500">{error}</p>}
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <span className="flex min-w-0 items-center gap-2 text-[11px] text-neutral-text/60">
            <span className="truncate">
              {t('drive.dialog.target.current', { name: current ? (byId.get(current)?.name ?? '') : (rootLabel ?? t('drive.dialog.target.root')) })}
            </span>
            {createFolder && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-0.5 font-bold text-accent hover:bg-accent/10 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                {t('drive.dialog.target.newFolder')}
              </button>
            )}
          </span>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className={ghostBtn}>
              {t('drive.action.cancel')}
            </button>
            <button type="button" onClick={() => void confirm()} disabled={busy || nodes === null || targetBlocked} className={primaryBtn}>
              {confirmLabel}
            </button>
          </div>
        </div>
        {creating && createFolder && (
          <DriveNameDialog
            title={t('drive.dialog.newFolder.title')}
            confirmLabel={t('drive.action.create')}
            onClose={() => setCreating(false)}
            onSubmit={async (name) => {
              const created = await createFolder(name, current);
              setCreating(false);
              reload();
              setCurrent(created.id);
            }}
          />
        )}
      </div>
    </div>
  );
};

/* ------------------------------ details dialog ----------------------------- */

export const DriveDetailsDialog: React.FC<{
  file: DriveFile;
  onClose: () => void;
  onChanged: (file: DriveFile) => void;
}> = ({ file, onClose, onChanged }) => {
  const { t } = useAdminT();
  const { showToast } = useAdmin();
  const [slugDraft, setSlugDraft] = useState(file.slug);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  const previewable = canPreviewDriveFile(file);
  useEffect(() => {
    if (!previewable) return;
    let revoked = false;
    let url: string | null = null;
    driveBlobUrl(file)
      .then((u) => {
        if (revoked) URL.revokeObjectURL(u);
        else {
          url = u;
          setPreviewUrl(u);
        }
      })
      .catch(() => !revoked && setPreviewFailed(true));
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
    // Reload only when another file is opened, not when its slug or share flag changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, previewable]);

  const link = driveShareUrl(file);

  const toggleShare = async () => {
    setBusy(true);
    try {
      const next = await updateDriveFile(file.id, { isPublic: !file.isPublic });
      onChanged(next);
      showToast(t(next.isPublic ? 'drive.toast.sharedOn' : 'drive.toast.sharedOff'), 'info');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveSlug = async () => {
    setBusy(true);
    try {
      const next = await updateDriveFile(file.id, { slug: slugDraft.trim().toLowerCase() });
      onChanged(next);
      setSlugDraft(next.slug);
      showToast(t('drive.toast.slugSaved'), 'info');
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    const ok = await copyText(link);
    showToast(ok ? t('drive.toast.linkCopied') : t('drive.toast.linkCopyFailed'), ok ? 'info' : 'error');
  };

  return (
    <div className={overlay} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={`${panel} max-w-lg max-h-[90vh] overflow-y-auto`}>
        <DialogHeader title={file.name} onClose={onClose} />

        {previewable && (
          <div className="mx-5 mb-3 rounded-xl bg-canvas border border-muted-border/30 overflow-hidden flex items-center justify-center min-h-32">
            {previewFailed ? (
              <p className="p-6 text-xs text-neutral-text/50">{t('drive.details.previewFailed')}</p>
            ) : previewUrl ? (
              file.kind === 'pdf' ? (
                <iframe src={previewUrl} title={file.name} className="w-full h-72" />
              ) : (
                <img src={previewUrl} alt={file.name} className="max-h-72 w-auto object-contain" />
              )
            ) : (
              <p className="p-6 text-xs text-neutral-text/50">…</p>
            )}
          </div>
        )}

        <dl className="mx-5 mb-3 grid grid-cols-3 gap-2 text-[11px]">
          <div className="p-2.5 rounded-xl bg-canvas border border-muted-border/30">
            <dt className="text-neutral-text/50 font-medium">{t('drive.details.type')}</dt>
            <dd className="font-bold text-heading truncate" dir="ltr">
              {file.mimeType}
            </dd>
          </div>
          <div className="p-2.5 rounded-xl bg-canvas border border-muted-border/30">
            <dt className="text-neutral-text/50 font-medium">{t('drive.details.size')}</dt>
            <dd className="font-bold text-heading">{formatBytes(file.size)}</dd>
          </div>
          <div className="p-2.5 rounded-xl bg-canvas border border-muted-border/30">
            <dt className="text-neutral-text/50 font-medium">{t('drive.details.created')}</dt>
            <dd className="font-bold text-heading">{formatAdminDateTime(file.createdAt)}</dd>
          </div>
        </dl>

        <div className="mx-5 mb-3 p-3 rounded-xl border border-muted-border/30 space-y-3 text-start">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-heading">{t('drive.details.share')}</p>
              <p className="text-[11px] text-neutral-text/60">{t(file.isPublic ? 'drive.details.shareOn' : 'drive.details.shareOff')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={file.isPublic}
              aria-label={t('drive.details.share')}
              onClick={() => void toggleShare()}
              disabled={busy || Boolean(file.trashedAt)}
              className={`relative w-10 h-6 rounded-full transition shrink-0 cursor-pointer disabled:opacity-40 ${
                file.isPublic ? 'bg-accent' : 'bg-muted-border/60'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                  file.isPublic ? 'start-[1.125rem]' : 'start-0.5'
                }`}
              />
            </button>
          </div>

          <div>
            <span className="block text-[10px] font-bold text-neutral-text/60 mb-1">{t('drive.details.link')}</span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                dir="ltr"
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-canvas border border-muted-border/50 text-[11px] text-heading"
              />
              <button
                type="button"
                onClick={() => void copyLink()}
                title={t('drive.action.copyLink')}
                aria-label={t('drive.action.copyLink')}
                className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="mt-1 text-[10px] text-neutral-text/50">{t('drive.details.linkNote')}</p>
          </div>

          <div>
            <span className="block text-[10px] font-bold text-neutral-text/60 mb-1">{t('drive.details.slug')}</span>
            <div className="flex items-center gap-2">
              <input
                dir="ltr"
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value)}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-canvas border border-muted-border/50 text-[11px] text-heading outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={() => void saveSlug()}
                disabled={busy || slugDraft.trim().toLowerCase() === file.slug}
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold disabled:opacity-40 cursor-pointer"
              >
                {t('drive.action.save')}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-neutral-text/50">{t('drive.details.slugHint')}</p>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={() => downloadDriveFile(file).catch(() => showToast(t('drive.toast.downloadFailed'), 'error'))}
            className={`${ghostBtn} inline-flex items-center gap-1.5`}
          >
            <Download className="w-3.5 h-3.5" />
            {t('drive.details.download')}
          </button>
          <button type="button" onClick={onClose} className={primaryBtn}>
            {t('drive.action.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
