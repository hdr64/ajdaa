import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Box,
  Upload,
  Search,
  Check,
  RefreshCw,
  X as CloseIcon,
  HardDrive,
} from 'lucide-react';
import { useAdminT } from '../../../i18n/admin/useAdminT';
import {
  fetchMediaList,
  uploadMedia,
  type MediaFileDto,
} from '../../../services/mediaService';
import { resolveMediaUrl } from '../../../services/api';

export interface MediaPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: { url: string; filename: string; originalName: string }) => void;
  fileType?: 'image' | 'pdf' | 'model3d' | 'all';
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

  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [items, setItems] = useState<MediaFileDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<MediaFileDto | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
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

  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setUploadError('');
      void loadMedia();
    }
  }, [open, loadMedia]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError('');
    try {
      const uploaded = await uploadMedia(file);
      onSelect({
        url: uploaded.url,
        filename: uploaded.filename,
        originalName: uploaded.originalName || file.name,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل رفع الملف';
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
                ? 'اختيار صورة من مكتبة الوسائط أو رفع صورة جديدة'
                : fileType === 'pdf'
                ? 'اختيار ملف PDF للمشروع أو رفع ملف جديد'
                : 'اختيار ملف من المكتبة أو رفع ملف جديد'}
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
            onClick={() => setTab('library')}
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
            onClick={() => setTab('upload')}
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
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-text/40 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('media.searchPlaceholder')}
                  className="w-full h-9 ps-9 pe-4 rounded-xl border border-muted-border/40 bg-canvas text-xs text-heading placeholder:text-neutral-text/40 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Grid */}
              {loading ? (
                <div className="h-48 flex items-center justify-center gap-2 text-xs text-neutral-text/60">
                  <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                  <span>جاري التحميل...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-text/50">
                  {t('media.picker.empty')}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-80 overflow-y-auto p-1">
                  {items.map((file) => {
                    const isSelected = selectedFile?.id === file.id;
                    const fullUrl = resolveMediaUrl(file.url);
                    const isImage = file.fileType === 'image';
                    const isPdf = file.fileType === 'pdf';

                    return (
                      <div
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
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
                          ) : (
                            <Box className="w-6 h-6 text-blue-500/80" />
                          )}

                          {isSelected && (
                            <div className="absolute top-1 end-1 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center shadow-md">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
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
              )}
            </div>
          ) : (
            /* Upload Tab */
            <div className="py-8 flex flex-col items-center justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept={fileType === 'image' ? 'image/*' : fileType === 'pdf' ? 'application/pdf' : 'image/*,application/pdf'}
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
                    الحد الأقصى للملف 50 ميجابايت (يتم ضغط الصور تلقائياً)
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
                المحدد: {selectedFile.originalName}
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
          </div>
        </div>
      </div>
    </div>
  );
};
