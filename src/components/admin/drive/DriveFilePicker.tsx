import React, { useEffect, useState } from 'react';
import {
  Archive as ArchiveIcon,
  ChevronLeft,
  ChevronRight,
  File as FileIcon,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Music,
  Search,
} from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import { getErrorMessage } from '../../../services/api';
import { fetchDriveList, type DriveFile, type DriveKind, type DriveListing } from '../../../services/driveService';
import { LIBRARY_MAX_FILE_BYTES, libraryAcceptsName, type LibraryPickType } from '../../../utils/libraryTypes';
import { formatBytes } from './driveFormat';

const KIND_ICON: Record<DriveKind, React.ComponentType<{ className?: string }>> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  text: FileText,
  archive: ArchiveIcon,
  other: FileIcon,
};

interface DriveFilePickerProps {
  fileType: LibraryPickType;
  selectedId: string | null;
  onSelect: (file: DriveFile | null) => void;
}

/** Browses Drive one folder at a time and selects one file the library would accept. */
export const DriveFilePicker: React.FC<DriveFilePickerProps> = ({ fileType, selectedId, onSelect }) => {
  const { t, language } = useAdminT();
  const Forward = language === 'ar' ? ChevronLeft : ChevronRight;

  const [folderId, setFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [result, setResult] = useState<{ key: string; data: DriveListing } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const requestKey = `${folderId ?? ''}|${debouncedSearch}`;
  const loading = result?.key !== requestKey;
  const listing = result?.data ?? null;
  const searching = debouncedSearch.length > 0;

  useEffect(() => {
    let cancelled = false;
    fetchDriveList(searching ? { view: 'search', q: debouncedSearch } : { view: 'files', folderId })
      .then((data) => {
        if (cancelled) return;
        setError('');
        setResult({ key: requestKey, data });
      })
      .catch((err) => {
        if (cancelled) return;
        // A folder that vanished sends the picker back to the root.
        if (folderId) setFolderId(null);
        else setError(getErrorMessage(err, t('drive.toast.loadFailed')));
      });
    return () => {
      cancelled = true;
    };
    // `requestKey` already covers the folder and the search text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const openFolder = (id: string | null) => {
    setSearch('');
    setDebouncedSearch('');
    setFolderId(id);
    onSelect(null);
  };

  const crumbs = searching ? [] : (listing?.breadcrumbs ?? []);
  const folders = listing?.folders ?? [];
  const files = listing?.files ?? [];

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="w-4 h-4 text-neutral-text/40 absolute start-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('drive.searchPlaceholder')}
          className="w-full h-9 ps-9 pe-4 rounded-xl border border-muted-border/40 bg-canvas text-xs text-heading placeholder:text-neutral-text/40 focus:outline-none focus:border-accent"
        />
      </div>

      {!searching && (
        <nav className="flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => openFolder(null)}
            className={`font-bold cursor-pointer hover:underline ${folderId ? 'text-accent' : 'text-heading'}`}
          >
            {t('drive.folder.root')}
          </button>
          {crumbs.map((crumb, i, all) => (
            <React.Fragment key={crumb.id}>
              <Forward className="w-3.5 h-3.5 text-neutral-text/40 shrink-0" />
              <button
                type="button"
                onClick={() => openFolder(crumb.id)}
                className={`font-bold cursor-pointer hover:underline ${i === all.length - 1 ? 'text-heading' : 'text-accent'}`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}

      {error && <p className="text-[11px] font-bold text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>}

      <div className="rounded-xl border border-muted-border/30 overflow-hidden">
        {loading && !listing ? (
          <p className="p-8 text-center text-xs text-neutral-text/50">…</p>
        ) : folders.length === 0 && files.length === 0 ? (
          <p className="p-8 text-center text-xs text-neutral-text/50">
            {searching ? t('drive.empty.search') : t('drive.empty.folder')}
          </p>
        ) : (
          <ul className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {folders.map((folder) => (
              <li key={`d:${folder.id}`} className="border-b border-muted-border/10 last:border-b-0">
                <button
                  type="button"
                  onClick={() => openFolder(folder.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-start cursor-pointer hover:bg-muted-surface/50"
                >
                  <Folder className="w-5 h-5 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-heading" dir="auto">
                    {folder.name}
                  </span>
                  <Forward className="w-4 h-4 shrink-0 text-neutral-text/40" />
                </button>
              </li>
            ))}
            {files.map((file) => {
              const Icon = KIND_ICON[file.kind];
              const tooLarge = file.size > LIBRARY_MAX_FILE_BYTES;
              const selectable = !tooLarge && libraryAcceptsName(file.name, fileType);
              const isSelected = selectedId === file.id;
              return (
                <li key={`f:${file.id}`} className="border-b border-muted-border/10 last:border-b-0">
                  <button
                    type="button"
                    disabled={!selectable}
                    aria-pressed={isSelected}
                    title={tooLarge ? t('files.picker.tooLarge') : undefined}
                    onClick={() => onSelect(isSelected ? null : file)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-start ${
                      selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                    } ${isSelected ? 'bg-accent/10' : selectable ? 'hover:bg-muted-surface/50' : ''}`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-accent' : 'text-neutral-text/60'}`} />
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-heading" dir="auto">
                      {file.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-neutral-text/70" dir="ltr">
                      {formatBytes(file.size)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
