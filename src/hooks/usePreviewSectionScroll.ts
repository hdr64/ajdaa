import { useEffect } from 'react';
import {
  PREVIEW_SECTION_ATTR,
  isPreviewFrame,
  isTrustedParentMessage,
} from '../utils/cmsPreviewProtocol';

/** Preview iframe only: scrolls to the section the admin just opened. */
export function usePreviewSectionScroll(): void {
  useEffect(() => {
    if (!isPreviewFrame()) return;
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedParentMessage(event)) return;
      const data = event.data as { type?: unknown; section?: unknown } | null;
      if (data?.type !== 'AJDA_SCROLL_TO_SECTION' || typeof data.section !== 'string') return;
      const el = document.querySelector(
        `[${PREVIEW_SECTION_ATTR}="${CSS.escape(data.section)}"]`,
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
}
