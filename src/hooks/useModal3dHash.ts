import { useEffect, useRef } from 'react';
import { slugify } from '../seo/slug';

/**
 * URL fragment of a project's 3D viewer, e.g. `ajda-prime-3d-full` for a fullscreen
 * viewer and `ajda-prime-3d` for the framed window. Used as `/works#ajda-prime-3d-full`.
 */
export function model3dHash(titleEn: string | null | undefined, fullscreen: boolean): string | undefined {
  const slug = slugify(titleEn);
  if (!slug) return undefined;
  return `${slug}-3d${fullscreen ? '-full' : ''}`;
}

/** True when the address bar currently carries this fragment. */
export function isModel3dHashActive(hash: string | undefined): boolean {
  return !!hash && typeof window !== 'undefined' && window.location.hash === `#${hash}`;
}

/**
 * Opens a project's 3D viewer when the page is loaded with its fragment (a shared link)
 * or when the browser's Forward button returns to it. `open` is called at most once per
 * matching navigation; closing is owned by `Project3dModal`.
 */
export function useOpenModal3dFromHash(hash: string | undefined, enabled: boolean, open: () => void): void {
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  });

  useEffect(() => {
    if (!hash || !enabled) return;
    const check = () => {
      if (isModel3dHashActive(hash)) openRef.current();
    };
    check();
    window.addEventListener('popstate', check);
    return () => window.removeEventListener('popstate', check);
  }, [hash, enabled]);
}
