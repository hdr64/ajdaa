import React from 'react';
import {
  PREVIEW_SECTION_ATTR,
  isPreviewFrame,
} from '../../utils/cmsPreviewProtocol';

/**
 * Marks a section so the CMS admin can scroll the live preview to it. Outside
 * the preview iframe it renders its children untouched (no extra DOM).
 */
export const PreviewAnchor: React.FC<{ section: string; children: React.ReactNode }> = ({
  section,
  children,
}) => {
  if (!isPreviewFrame()) return <>{children}</>;
  return (
    <div {...{ [PREVIEW_SECTION_ATTR]: section }} className="scroll-mt-24">
      {children}
    </div>
  );
};
