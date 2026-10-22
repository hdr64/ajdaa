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

/**
 * A brochure link is either an uploaded file on our own origin (`/uploads/...`)
 * or an external https URL. Anything else must not be rendered as a link.
 */
export function isDownloadableMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/uploads/') || /^https:\/\//i.test(url);
}
