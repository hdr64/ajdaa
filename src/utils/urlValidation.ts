/**
 * Client mirror of the server's project-URL rules
 * (`server/src/routes/projects.routes.ts`). Kept in one place so the edit form,
 * the create modal, and the public 3D viewer all agree on what is a safe link.
 */

const HTTPS_URL_PATTERN = /^https:\/\/[^\s"'<>\\]+$/;

export const MAX_PROJECT_URL_LENGTH = 500;

/** True for a non-empty https URL that fits the length cap and carries no risky characters. */
export function isHttpsUrl(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 && trimmed.length <= MAX_PROJECT_URL_LENGTH && HTTPS_URL_PATTERN.test(trimmed);
}

// Mirrors `MODEL3D_FILE_PATTERN` in server/src/routes/projects.routes.ts.
const MODEL3D_FILE_PATTERN = /^\/uploads\/[A-Za-z0-9._%/-]+\.(glb|mp4|webm|mov|m4v|ogv|html?)$/i;

/** What the project's 3D card shows: a library `.glb`, video, HTML page, or an external viewer link. */
export type Model3dKind = 'model' | 'video' | 'html' | 'external';

/**
 * True for a file picked from the media library (`/uploads/...`): a `.glb`, a
 * video or an HTML page, possibly inside an extracted zip folder.
 */
export function isModel3dFileUrl(value: string | null | undefined): boolean {
  const trimmed = (value ?? '').trim();
  return (
    trimmed.length <= MAX_PROJECT_URL_LENGTH &&
    !trimmed.includes('..') &&
    !trimmed.includes('//') &&
    MODEL3D_FILE_PATTERN.test(trimmed)
  );
}

/** The kind of 3D-card content, inferred from the value (no stored type column). */
export function getModel3dKind(value: string | null | undefined): Model3dKind | null {
  const trimmed = (value ?? '').trim();
  if (isModel3dFileUrl(trimmed)) {
    const ext = trimmed.slice(trimmed.lastIndexOf('.') + 1).toLowerCase();
    if (ext === 'glb') return 'model';
    return ext === 'html' || ext === 'htm' ? 'html' : 'video';
  }
  return isHttpsUrl(trimmed) ? 'external' : null;
}

/** Strips the API origin from an upload URL so it is stored as `/uploads/...`. */
export function toUploadPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/i, '');
}

/** A project 3D model is either an external https viewer link or a library `.glb`. */
export function isModel3dUrl(value: string | null | undefined): boolean {
  return isHttpsUrl(value) || isModel3dFileUrl(value);
}

/**
 * A brochure link is either an uploaded file on our own origin (`/uploads/...`)
 * or an external https URL. Anything else must not be rendered as a link.
 */
export function isDownloadableMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/uploads/') || /^https:\/\//i.test(url);
}
