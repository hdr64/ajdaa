import React from 'react';
import { Box } from 'lucide-react';
import type { Model3dKind } from '../../utils/urlValidation';

interface Project3dCtaProps {
  kind: Model3dKind | null;
  isAr: boolean;
  /** Long accessible label, e.g. "View 3D model". */
  label: string;
  /** When set the call to action is a link (external page opened in a tab); otherwise a button. */
  href?: string;
  onOpen: () => void;
}

const CLASS =
  'absolute bottom-3 right-3.5 z-[4] inline-flex items-center gap-2 overflow-hidden rounded-full py-1 ps-1 pe-3 text-[11px] sm:text-xs font-extrabold shadow-lg ring-2 ring-white/70 transition-transform duration-300 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer bg-[linear-gradient(135deg,#fde68a,#fbbf24)] text-[#1a1305]';

/** Prominent icon-and-text 3D button placed over the bottom corner of a project card image. */
export const Project3dCta: React.FC<Project3dCtaProps> = ({ kind, isAr, label, href, onOpen }) => {
  // Inviting wording: it should read as an offer to step inside, not as a file type.
  const text =
    kind === 'video'
      ? isAr ? 'شاهد المشروع بالفيديو' : 'Watch the project'
      : kind === 'html'
      ? isAr ? 'ادخل الجولة 3D التفاعلية' : 'Enter the 3D experience'
      : isAr ? 'تجوّل داخل المشروع 3D' : 'Walk through it in 3D';

  const content = (
    <>
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/15">
        <span className="absolute inset-0 rounded-full bg-black/25 motion-safe:animate-ping" aria-hidden="true" />
        <Box className="relative h-3.5 w-3.5" />
      </span>
      <span className="whitespace-nowrap">{text}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} onClick={(e) => e.stopPropagation()} aria-label={label} title={label} className={CLASS}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      aria-label={label}
      title={label}
      className={CLASS}
    >
      {content}
    </button>
  );
};
