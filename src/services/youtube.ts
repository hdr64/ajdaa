/**
 * Single source of truth for turning whatever an admin pastes into the project
 * video field into the privacy-preserving embed URL the public site renders.
 *
 * The public pages (ProjectDetailPage / InteractiveProjectsMap) re-normalise
 * `videoUrl` with their own regex, so persisting the canonical form below keeps
 * every surface consistent regardless of which form was typed in the dashboard.
 */

const EMBED_ORIGIN = 'https://www.youtube-nocookie.com/embed';

/** A YouTube video id is always exactly 11 URL-safe base64 characters. */
const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

/** Hosts we are willing to read a video id from. Everything else is rejected. */
const YOUTUBE_HOST_PATTERN = /^(?:[\w-]+\.)*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;

const SHORTENER_HOST_PATTERN = /^(?:www\.)?youtu\.be$/i;

/** Path prefixes that are always followed by the video id. */
const PATH_ID_PREFIXES = new Set(['embed', 'shorts', 'live', 'v']);

function isValidVideoId(candidate: string | undefined | null): boolean {
  return typeof candidate === 'string' && VIDEO_ID_PATTERN.test(candidate);
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Reads the id out of a parsed YouTube URL, covering every path we accept. */
function readVideoIdFromUrl(url: URL): string | null {
  const segments = url.pathname.split('/').filter(Boolean).map(decodeSegment);
  const isShortener = SHORTENER_HOST_PATTERN.test(url.hostname);

  if (!isShortener) {
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index];
      if (segment && PATH_ID_PREFIXES.has(segment.toLowerCase())) {
        const id = segments[index + 1];
        return isValidVideoId(id) ? id : null;
      }
    }
  }

  const queryId = url.searchParams.get('v');
  if (queryId && isValidVideoId(queryId)) return queryId;

  if (isShortener) {
    const id = segments[0];
    return isValidVideoId(id) ? id : null;
  }

  return null;
}

/**
 * Accepts a bare 11-character id, a full `youtube.com/watch?v=...` link, a
 * `youtu.be/...` short link, a Shorts/embed/live link, or a protocol-less paste
 * of any of those. Returns `null` when the id is malformed.
 */
function extractVideoId(raw: string): string | null {
  if (isValidVideoId(raw)) return raw;

  // Admins routinely paste without the scheme, so try to read it as a host.
  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith('//');
  const candidate = isAbsolute
    ? raw.startsWith('//')
      ? `https:${raw}`
      : raw
    : `https://${raw.replace(/^\/+/, '')}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!YOUTUBE_HOST_PATTERN.test(url.hostname)) return null;

  return readVideoIdFromUrl(url);
}

/**
 * Normalises a video field value to the embed URL persisted on the project.
 *
 * @returns the canonical embed URL, `null` for an empty field, or `undefined`
 *          when the input is not a recognisable YouTube reference.
 */
export function toYoutubeEmbedUrl(input: string): string | null | undefined {
  const raw = input.trim();
  if (!raw) return null;

  const videoId = extractVideoId(raw);
  if (!videoId) return undefined;

  return `${EMBED_ORIGIN}/${videoId}?rel=0&modestbranding=1`;
}
