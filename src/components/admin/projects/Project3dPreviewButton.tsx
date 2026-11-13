import React, { useState } from 'react';
import { Box } from 'lucide-react';
import type { Property } from '../../../types/property';
import { Project3dModal } from '../../project/Project3dModal';
import { resolveMediaUrl } from '../../../services/api';
import {
  getModel3dKind,
  isModel3dUrl,
  opensModel3dFullscreen,
  opensModel3dInTab,
} from '../../../utils/urlValidation';
import { useAdminT } from '../../../i18n/admin';

interface Project3dPreviewButtonProps {
  project: Property;
  className: string;
}

/**
 * Icon button that previews a project's interactive experience exactly as a
 * visitor gets it (window, fullscreen window or new tab). Renders nothing when
 * the project has no valid 3D link. Independent of the public `projectCards.show3d`
 * switch: admins can always preview.
 */
export const Project3dPreviewButton: React.FC<Project3dPreviewButtonProps> = ({ project, className }) => {
  const { t, isAr } = useAdminT();
  const [open, setOpen] = useState(false);

  const url = project.model3dUrl;
  if (!url || !isModel3dUrl(url)) return null;

  const label = t('projects.preview3dAria', { title: project.title });
  const icon = <Box className="w-3.5 h-3.5" />;

  if (opensModel3dInTab(url, project.model3dDisplay)) {
    const href = getModel3dKind(url) === 'external' ? url : resolveMediaUrl(url);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={className}
        title={t('projects.preview3dTitle')}
        aria-label={label}
      >
        {icon}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
        title={t('projects.preview3dTitle')}
        aria-label={label}
      >
        {icon}
      </button>
      {open && (
        <Project3dModal
          url={url}
          title={project.title}
          isAr={isAr}
          fullscreen={opensModel3dFullscreen(url, project.model3dDisplay)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};
