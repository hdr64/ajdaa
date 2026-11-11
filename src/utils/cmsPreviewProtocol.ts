import type { CmsSectionsPayload } from '../types/cms';

/**
 * Wire protocol between the CMS admin tab (parent) and the public site running
 * inside its live-preview iframe. Both sides are the same origin; every message
 * is checked for origin and source before it is acted on.
 */

/** Sections the admin may preview as unsaved drafts. `clients` is deliberately absent. */
export const PREVIEW_DRAFT_KEYS = [
  'nav',
  'footer',
  'home',
  'works',
  'clientsPage',
  'contact',
  'pastWorks',
  'careers',
] as const;

export type PreviewDraftKey = (typeof PREVIEW_DRAFT_KEYS)[number];

export type PreviewDrafts = Partial<Pick<CmsSectionsPayload, PreviewDraftKey>>;

export type ParentToFrame =
  | { type: 'AJDA_CMS_DRAFT'; drafts: PreviewDrafts }
  | { type: 'AJDA_CMS_UPDATED' }
  | { type: 'AJDA_SET_LANG'; lang: 'ar' | 'en' };

export type FrameToParent = { type: 'AJDA_PREVIEW_READY' } | { type: 'AJDA_PREVIEW_ERROR' };

/**
 * Evaluated once, at module import: in-app navigation can drop the query
 * string, so this must not be re-read later.
 */
const IS_PREVIEW_FRAME: boolean =
  typeof window !== 'undefined' &&
  window.parent !== window &&
  new URLSearchParams(window.location.search).get('preview') === '1';

export function isPreviewFrame(): boolean {
  return IS_PREVIEW_FRAME;
}

/** True only for a message sent by the embedding admin tab to a preview frame. */
export function isTrustedParentMessage(e: MessageEvent): boolean {
  return isPreviewFrame() && e.origin === window.location.origin && e.source === window.parent;
}

/** Admin-side counterpart: true only for a message sent by the given preview frame. */
export function isTrustedFrameMessage(e: MessageEvent, frame: Window | null | undefined): boolean {
  return !!frame && e.origin === window.location.origin && e.source === frame;
}

export function postToParent(msg: FrameToParent): void {
  try {
    window.parent.postMessage(msg, window.location.origin);
  } catch {
    // The parent may be gone; the preview is best effort.
  }
}

export function postToFrame(frame: Window | null | undefined, msg: ParentToFrame): void {
  try {
    frame?.postMessage(msg, window.location.origin);
  } catch {
    // The frame may be mid-navigation; the next message will land.
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Keeps only allow-listed sections of the expected container type (`nav` is an
 * array, the rest are objects). Anything else is dropped silently.
 */
export function sanitizeDrafts(input: unknown): PreviewDrafts {
  if (!isPlainObject(input)) return {};
  const out: Record<string, unknown> = {};
  for (const key of PREVIEW_DRAFT_KEYS) {
    const value = input[key];
    if (key === 'nav' ? Array.isArray(value) : isPlainObject(value)) out[key] = value;
  }
  return out as PreviewDrafts;
}
