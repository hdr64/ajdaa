/**
 * CMS media paths are stored as public URLs so the admin's uploads, the seeded
 * defaults, and the bundled brand imagery all resolve the same way at runtime.
 */

/**
 * Returns a usable `src` for a CMS-supplied path.
 *
 * Empty means "not configured", in which case the caller's bundled fallback is
 * used; anything non-empty is trusted as a URL because the server validates
 * uploaded media and the admin panel only offers real paths.
 */
export function resolveCmsImage(path: string | undefined | null, fallback: string): string {
  const trimmed = (path ?? '').trim();
  if (!trimmed) return fallback;
  if (/^(https?:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  // Relative entries are normalised so `clients/x.png` and `/clients/x.png` agree.
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Turns a YouTube watch/short/link URL into its embeddable form, or returns
 * `null` for anything that is not a YouTube link (including already-embedded
 * URLs, which pass through untouched).
 */
export function resolveCmsVideo(url: string | undefined | null): string | null {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;
  if (trimmed.includes('youtube.com/embed/') || trimmed.includes('youtube-nocookie.com/embed/')) {
    return trimmed;
  }

  const id =
    trimmed.match(/[?&]v=([\w-]{6,})/)?.[1] ??
    trimmed.match(/youtu\.be\/([\w-]{6,})/)?.[1] ??
    trimmed.match(/\/embed\/([\w-]{6,})/)?.[1];
  if (!id) return null;

  return `https://www.youtube.com/embed/${id}`;
}