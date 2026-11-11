/**
 * Which file extensions the media library accepts per picker type.
 * Client copy of the lists in `server/src/services/mediaService.ts`
 * (MEDIA_IMAGE_EXTS, MEDIA_VIDEO_EXTS, MEDIA_MODEL_EXTS, MEDIA_ARCHIVE_EXTS, MEDIA_ALLOWED_EXTS); keep them in sync.
 */

export type LibraryPickType = 'image' | 'pdf' | 'model3d' | 'video' | 'html' | 'other' | 'all';

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'];
const MODEL_EXTS = ['.glb', '.gltf'];
const PDF_EXTS = ['.pdf'];
const HTML_EXTS = ['.html', '.htm'];
const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.sql', '.csv'];

const ALL_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS, ...MODEL_EXTS, ...PDF_EXTS, ...HTML_EXTS, ...ARCHIVE_EXTS];

const EXTS_BY_TYPE: Record<LibraryPickType, string[]> = {
  image: IMAGE_EXTS,
  video: VIDEO_EXTS,
  model3d: MODEL_EXTS,
  pdf: PDF_EXTS,
  html: HTML_EXTS,
  other: ALL_EXTS,
  all: ALL_EXTS,
};

/** The library refuses anything above this (server `to-library` answers 413). */
export const LIBRARY_MAX_FILE_BYTES = 2 * 1024 ** 3;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
}

/** True when a file with this name may be published into the library for the given picker type. */
export function libraryAcceptsName(name: string, type: LibraryPickType): boolean {
  return EXTS_BY_TYPE[type].includes(extensionOf(name));
}
