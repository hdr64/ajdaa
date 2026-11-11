import { createContext } from 'react';
import { DEFAULT_CMS_CONTENT } from '../types/cms';
import type { CmsContent } from '../types/cms';

export interface CmsContextType {
  content: CmsContent;
  /** True until the first fetch of this session settles; `false` for background revalidations. */
  loading: boolean;
  /** The last failure message, or `null` while healthy. Content is kept either way. */
  error: string | null;
  /** Forces an immediate refetch, e.g. after the admin saves in another tab. */
  reload: () => void;
  /** Live-draft state; inert (`active: false`) outside the admin's preview iframe. */
  preview: {
    active: boolean;
    hasDrafts: boolean;
    /** Bumped each time drafts are rejected, so a boundary can tell it may retry. */
    epoch: number;
    /** Drops all drafts, tells the admin tab, and shows saved content again. */
    rejectDrafts: () => void;
  };
}

/** Without a provider (or before the fetch lands) the built-in values apply. */
export const CmsContext = createContext<CmsContextType>({
  content: DEFAULT_CMS_CONTENT,
  loading: false,
  error: null,
  reload: () => {},
  preview: { active: false, hasDrafts: false, epoch: 0, rejectDrafts: () => {} },
});
