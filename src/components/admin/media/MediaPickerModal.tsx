import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Box,
  Copy,
  Globe,
  Upload,
  Search,
  Check,
  RefreshCw,
  X as CloseIcon,
  HardDrive,
  LayoutGrid,
  List,
  Video as VideoIcon,
  File as FileIcon,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import {
  fetchMediaList,
  uploadMedia,
  mediaPublicUrl,
  type MediaFileDto,
} from '../../../services/mediaService';
import { uploadFileInChunks } from '../../../services/chunkedUploadService';
import { publishDriveFileToLibrary, type DriveFile } from '../../../services/driveService';
import { DriveFilePicker } from '../drive/DriveFilePicker';
import { getErrorMessage, resolveMediaUrl } from '../../../services/api';
import { formatAdminDate } from '../../../pages/admin/adminFormat';
import { copyText } from '../../../utils/clipboard';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Live preview of the chosen library item. HTML uses its public `/html/<slug>/` URL so a site's CSS, JS and images load. */
const SelectedPreview: React.FC<{ file: MediaFileDto }> = ({ file }) => {
  const frame = 'w-full h-56 rounded-xl border border-muted-border/40';
  if (file.fileType === 'html') {
    return (
      <iframe
        key={file.id}
        src={mediaPublicUrl(file)}
        title={file.originalName}
        sandbox="allow-scripts allow-popups allow-forms"
        className={`${frame} bg-white`}
      />
    );
  }
  if (file.fileType === 'pdf') {
    return <iframe key={file.id} src={resolveMediaUrl(file.url)} title={file.originalName} className={`${frame} bg-white`} />;
  }
  if (file.fileType === 'video') {
    return <video key={file.id} src={resolveMediaUrl(file.url)} controls className={`${frame} bg-black`} />;
  }
  if (file.fileType === 'image') {
    return (
      <div className={`${frame} bg-canvas flex items-center justify-center p-2`}>
        <img src={resolveMediaUrl(file.url)} alt={file.originalName} className="max-h-full max-w-full object-contain" />
      </div>
    );
  }
  return null;
};

export interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: { url: string; filename: string; originalName: string }) => void;
  fileType?: 'image' | 'pdf' | 'model3d' | 'video' | 'html' | 'other' | 'all';
  title?: string;
}

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  open,
  onClose,
  onSelect,
  fileType = 'all',
  title,
}) => {
  const { t } = useAdminT();

  const [tab, setTab] = useState<'library' | 'drive' | 'upload'>('library');
  const [items, setItems] = useState<MediaFileDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<MediaFileDto | null>(null);
  const [driveFile, setDriveFile] = useState<DriveFile | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Layout mode (Grid vs Detailed List)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ajda_mediapicker_layout_mode');
      if (saved === 'list' || saved === 'grid') return saved;
    }
    return 'grid';
  });

  const handleLayoutChange = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ajda_mediapicker_layout_mode', mode);
    }
  };

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [notice, setNotice] = useState('');

  const switchTab = (next: 'library' | 'drive' | 'upload') => {
    setTab(next);
    setDriveFile(null);
    setUploadError('');
  };
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copies the file's permanent public link without selecting the file.
  const handleCopy = async (file: MediaFileDto) => {
    const ok = await copyText(mediaPublicUrl(file));
    if (ok) {
      setCopiedId(file.id);
      window.setTimeout(() => setCopiedId((cur) => (cur === file.id ? null : cur)), 1500);
    } else {
      setNotice(t('media.action.copyFailed'));
    }
  };
  // Video, 3D model and HTML uploads may be a .zip that the server unpacks.
  const extractKind = fileType === 'video' || fileType === 'model3d' || fileType === 'html' ? fileType : undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMedia = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await fetchMediaList({
        page: 1,
        limit: 48,
        type: fileType,
        search,
      });
      setItems(res.items);
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [open, fileType, search]);

  // Reset only when the picker opens (not on a search change), so a zip upload keeps the chosen item.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      if (!wasOpen.current) {
        setSelectedFile(null);
        setDriveFile(null);
        setUploadError('');
        setNotice('');
      }
      void loadMedia();
    }
    wasOpen.current = open;
  }, [open, loadMedia]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      if (extractKind && /\.zip$/i.test(file.name)) {
        // Unpack on the server, then go back to the list so the admin picks one item.
        const result = await uploadFileInChunks(file, { extract: extractKind });
        const extracted = result.extracted ?? [];
        const only = extracted.length === 1 ? extracted[0] : null;
        setSearch('');
        setTab('library');
        if (only?.id) {
          // One item came out (a website zip): show it in the list already chosen, so one click confirms it.
          setSelectedFile({
            id: only.id,
            url: only.url,
            slug: only.slug,
            filename: only.filename,
            originalName: only.originalName || only.filename,
            mimeType: only.mimeType ?? '',
            fileType: (only.fileType as MediaFileDto['fileType']) ?? 'other',
            size: only.size ?? 0,
            usageCount: 0,
            usages: [],
            createdAt: new Date().toISOString(),
          });
          setNotice(t('media.picker.extractedOne', { name: only.originalName || only.filename }));
        } else if (result.folderName) {
          // The extraction created its own folder: name it so the admin can find it in the Library.
          setNotice(t('media.picker.extractedInFolder', { count: extracted.length, name: result.folderName }));
        } else {
          setNotice(t('media.picker.extracted').replace('{count}', String(extracted.length)));
        }
        await loadMedia();
        return;
      }
      const uploaded =
        file.size >= 5 * 1024 * 1024 || !file.type.startsWith('image/')
          ? await uploadFileInChunks(file)
          : await uploadMedia(file);
      onSelect({
        url: uploaded.url,
        filename: uploaded.filename,
        originalName: uploaded.originalName || file.name,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('media.toast.uploadFailed');
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmSelect = () => {
    if (!selectedFile) return;
    onSelect({
      url: selectedFile.url,
      filename: selectedFile.filename,
      originalName: selectedFile.originalName,
    });
    onClose();
  };

  // Publishes a copy of the chosen Drive file into the library, then returns that library item like a library pick.
  const handleConfirmDrive = async () => {
    if (!driveFile || publishing) return;
    setPublishing(true);
    setUploadError('');
    try {
      const published = await publishDriveFileToLibrary(driveFile.id);
      onSelect({
        url: published.url,
        filename: published.filename,
        originalName: published.originalName || driveFile.name,
      });
      onClose();
    } catch (err: unknown) {
      setUploadError(getErrorMessage(err, t('files.picker.publishFailed')));
    } finally {
      setPublishing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-surface border border-muted-border/40 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-surface border-b border-muted-border/20 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-heading">{title || t('media.picker.title')}</h3>
            <p className="text-[11px] text-neutral-text/50 mt-0.5">
              {fileType === 'image'
                ? t('media.picker.hintImage')
                : fileType === 'pdf'
                ? t('media.picker.hintPdf')
                : fileType === 'model3d'
                ? t('media.picker.hintModel3d')
                : fileType === 'video'
                ? t('media.picker.hintVideo')
                : fileType === 'html'
                ? t('media.picker.hintHtml')
                : t('media.picker.hintFile')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-text/60 hover:text-heading cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-muted-border/20 px-4 bg-canvas/50">
          <button
            onClick={() => switchTab('library')}
            className={`py-3 px-4 font-bold text-xs border-b-2 -mb-px transition cursor-pointer flex items-center gap-2 ${
              tab === 'library'
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral-text/60 hover:text-heading'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>{t('media.picker.tabLibrary')}</span>
          </button>
          <button
            onClick={() => switchTab('drive')}
            className={`py-3 px-4 font-bold text-xs border-b-2 -mb-px transition cursor-pointer flex items-center gap-2 ${
              tab === 'drive'
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral-text/60 hover:text-heading'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>{t('files.picker.tabDrive')}</span>
          </button>
          <button
            onClick={() => switchTab('upload')}
            className={`py-3 px-4 font-bold text-xs border-b-2 -mb-px transition cursor-pointer flex items-center gap-2 ${
              tab === 'upload'
                ? 'border-accent text-accent'
                : 'border-transparent text-neutral-text/60 hover:text-heading'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{t('media.picker.tabUpload')}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {tab === 'library' ? (
            <div className="space-y-4">
              {notice && (
                <p className="text-[11px] font-bold text-emerald-700 bg-emerald-500/10 px-3 py-2 rounded-lg">{notice}</p>
              )}
              {selectedFile && <SelectedPreview file={selectedFile} />}
              {/* Search input & Layout Switcher */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-neutral-text/40 absolute start-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('media.searchPlaceholder')}
                    className="w-full h-9 ps-9 pe-4 rounded-xl border border-muted-border/40 bg-canvas text-xs text-heading placeholder:text-neutral-text/40 focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="flex items-center p-1 bg-canvas rounded-xl border border-muted-border/40 text-neutral-text/60 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLayoutChange('grid')}
                    className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                      layoutMode === 'grid'
                        ? 'bg-surface text-accent shadow-xs'
                        : 'hover:text-heading hover:bg-surface/50'
                    }`}
                    title={t('media.layout.grid')}
                    aria-label={t('media.layout.grid')}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLayoutChange('list')}
                    className={`p-1.5 rounded-lg transition cursor-pointer flex items-center justify-center ${
                      layoutMode === 'list'
                        ? 'bg-surface text-accent shadow-xs'
                        : 'hover:text-heading hover:bg-surface/50'
                    }`}
                    title={t('media.layout.list')}
                    aria-label={t('media.layout.list')}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Media Content (Grid or Detailed List) */}
              {loading ? (
                <div className="h-48 flex items-center justify-center gap-2 text-xs text-neutral-text/60">
                  <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                  <span>{t('media.picker.loading')}</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-text/50">
                  {t('media.picker.empty')}
                </div>
              ) : layoutMode === 'grid' ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-80 overflow-y-auto p-1">
                  {items.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    const fullUrl = resolveMediaUrl(file.url);
                    const isImage = file.fileType === 'image';
                    const isPdf = file.fileType === 'pdf';
                    const isVideo = file.fileType === 'video';
                    const isModel = file.fileType === 'model3d';
                    const isHtml = file.fileType === 'html';

                    return (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        onDoubleClick={() => {
                          setSelectedFile(file);
                          onSelect({
                            url: file.url,
                            filename: file.filename,
                            originalName: file.originalName,
                          });
                          onClose();
                        }}
                        className={`group relative rounded-xl border-2 overflow-hidden flex flex-col cursor-pointer transition ${
                          isSelected
                            ? 'border-accent bg-accent/5 ring-2 ring-accent/20'
                            : 'border-muted-border/30 bg-canvas hover:border-accent/40'
                        }`}
                      >
                        <div className="h-20 bg-canvas flex items-center justify-center overflow-hidden relative">
                          {isImage ? (
                            <img
                              src={fullUrl}
                              alt={file.originalName}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : isPdf ? (
                            <FileText className="w-6 h-6 text-accent/80" />
                          ) : isVideo ? (
                            <VideoIcon className="w-6 h-6 text-purple-500/80" />
                          ) : isModel ? (
                            <Box className="w-6 h-6 text-blue-500/80" />
                          ) : isHtml ? (
                            <Globe className="w-6 h-6 text-emerald-500/80" />
                          ) : (
                            <FileIcon className="w-6 h-6 text-neutral-text/70" />
                          )}

                          {isSelected && (
                            <div className="absolute top-1 end-1 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCopy(file);
                            }}
                            onDoubleClick={(e) => e.stopPropagation()}
                            title={t('media.action.copyUrl')}
                            aria-label={t('media.action.copyUrl')}
                            className="absolute top-1 start-1 w-6 h-6 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition cursor-pointer"
                          >
                            {copiedId === file.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>

                        <div className="p-1.5 bg-surface min-w-0">
                          <p className="text-[10px] font-bold text-heading truncate" title={file.originalName}>
                            {file.originalName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Detailed List Layout */
                <div className="rounded-xl border border-muted-border/30 overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-start border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-muted-border/30 bg-canvas/80 text-[10px] font-bold text-neutral-text/60 sticky top-0 backdrop-blur-xs">
                        <th className="py-2.5 px-3 text-start w-8"></th>
                        <th className="py-2.5 px-3 text-start">{t('media.table.file')}</th>
                        <th className="py-2.5 px-3 text-start">{t('media.table.type')}</th>
                        <th className="py-2.5 px-3 text-start">{t('media.table.size')}</th>
                        <th className="py-2.5 px-3 text-start">{t('media.table.uploadedAt')}</th>
                        <th className="py-2.5 px-3 text-start w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-muted-border/20">
                      {items.map((file) => {
                        const isSelected = selectedFile?.id === file.id;
                        const fullUrl = resolveMediaUrl(file.url);
                        const isImage = file.fileType === 'image';
                        const isPdf = file.fileType === 'pdf';
                        const isVideo = file.fileType === 'video';
                        const isModel = file.fileType === 'model3d';
                    const isHtml = file.fileType === 'html';

                        return (
                          <tr
                            key={file.id}
                            onClick={() => setSelectedFile(file)}
                            onDoubleClick={() => {
                              setSelectedFile(file);
                              onSelect({
                                url: file.url,
                                filename: file.filename,
                                originalName: file.originalName,
                              });
                              onClose();
                            }}
                            className={`transition cursor-pointer ${
                              isSelected
                                ? 'bg-accent/10 hover:bg-accent/15'
                                : 'hover:bg-canvas/60'
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                                  isSelected
                                    ? 'border-accent bg-accent text-white'
                                    : 'border-muted-border/60 bg-surface'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-canvas border border-muted-border/40 overflow-hidden shrink-0 flex items-center justify-center">
                                  {isImage ? (
                                    <img
                                      src={fullUrl}
                                      alt={file.originalName}
                                      loading="lazy"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : isPdf ? (
                                    <FileText className="w-4 h-4 text-accent/80" />
                                  ) : isVideo ? (
                                    <VideoIcon className="w-4 h-4 text-purple-500/80" />
                                  ) : isModel ? (
                                    <Box className="w-4 h-4 text-blue-500/80" />
                                  ) : isHtml ? (
                                    <Globe className="w-4 h-4 text-emerald-500/80" />
                                  ) : (
                                    <FileIcon className="w-4 h-4 text-neutral-text/70" />
                                  )}
                                </div>
                                <div className="min-w-0 max-w-xs">
                                  <p className="font-bold text-heading text-[11px] truncate" title={file.originalName}>
                                    {file.originalName}
                                  </p>
                                  <p className="font-mono text-[9px] text-neutral-text/40 truncate" title={file.filename}>
                                    {file.filename}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  isImage
                                    ? 'bg-accent/10 text-accent'
                                    : isPdf
                                    ? 'bg-red-500/10 text-red-600'
                                    : isVideo
                                    ? 'bg-purple-500/10 text-purple-600'
                                    : isModel
                                    ? 'bg-blue-500/10 text-blue-600'
                                    : isHtml
                                    ? 'bg-emerald-500/10 text-emerald-600'
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
                                  : isHtml
                                  ? 'HTML'
                                  : file.fileType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-heading font-medium">
                              {formatBytes(file.size)}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap text-neutral-text/60 text-[10px]">
                              {formatAdminDate(file.createdAt)}
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleCopy(file);
                                }}
                                title={t('media.action.copyUrl')}
                                aria-label={t('media.action.copyUrl')}
                                className="p-1.5 rounded-lg text-neutral-text/60 hover:text-accent hover:bg-accent/10 cursor-pointer"
                              >
                                {copiedId === file.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : tab === 'drive' ? (
            <div className="space-y-3">
              {uploadError && (
                <p className="text-[11px] font-bold text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">{uploadError}</p>
              )}
              <DriveFilePicker
                fileType={fileType}
                selectedId={driveFile?.id ?? null}
                onSelect={(file) => {
                  setDriveFile(file);
                  setUploadError('');
                }}
              />
            </div>
          ) : (
            /* Upload Tab */
            <div className="py-8 flex flex-col items-center justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  fileType === 'image'
                    ? 'image/*'
                    : fileType === 'pdf'
                    ? 'application/pdf'
                    : fileType === 'video'
                    ? 'video/*,.zip'
                    : fileType === 'model3d'
                    ? '.glb,model/gltf-binary,.zip'
                    : fileType === 'html'
                    ? '.html,.htm,.zip'
                    : '*/*'
                }
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                  e.target.value = '';
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
                className="w-full max-w-md p-8 rounded-2xl border-2 border-dashed border-muted-border/60 hover:border-accent/80 bg-canvas/40 flex flex-col items-center justify-center gap-3 transition cursor-pointer"
              >
                {uploading ? (
                  <RefreshCw className="w-8 h-8 text-accent animate-spin" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 text-accent flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                )}

                <div className="text-center">
                  <p className="text-xs font-bold text-heading">
                    {uploading ? t('media.uploading') : t('media.picker.dropText')}
                  </p>
                  <p className="text-[10px] text-neutral-text/50 mt-1">
                    {extractKind ? t('media.picker.zipHint') : t('media.picker.maxSize')}
                  </p>
                </div>

                {uploadError && (
                  <p className="text-[11px] font-bold text-red-500 bg-red-500/10 px-3 py-1 rounded-lg">
                    {uploadError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface border-t border-muted-border/20 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-text/60 truncate min-w-0">
            {selectedFile && tab === 'library' && (
              <span className="font-bold text-heading truncate">
                {t('media.picker.selected', { name: selectedFile.originalName })}
              </span>
            )}
            {driveFile && tab === 'drive' && (
              <span className="font-bold text-heading truncate">
                {t('media.picker.selected', { name: driveFile.name })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-surface hover:bg-canvas border border-muted-border/40 text-xs font-bold text-heading cursor-pointer"
            >
              {t('media.action.cancel')}
            </button>
            {tab === 'library' && (
              <button
                onClick={handleConfirmSelect}
                disabled={!selectedFile}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer"
              >
                {t('media.action.useFile')}
              </button>
            )}
            {tab === 'drive' && (
              <button
                onClick={() => void handleConfirmDrive()}
                disabled={!driveFile || publishing}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold transition disabled:opacity-40 cursor-pointer inline-flex items-center gap-2"
              >
                {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {t('media.action.useFile')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
