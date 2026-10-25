import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { PublishStatus } from '../../../types/property';
import { PUBLISH_STATUS_LABELS_AR } from '../../../pages/admin/projectLabels';

export const ProjectImage: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-accent/10 text-accent/60">
        <Building2 className="w-5 h-5 shrink-0" />
        <span className="text-[9px] font-bold text-center leading-none px-1">{src ? 'تعذر التحميل' : 'بدون صورة'}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
  );
};

export const ProjectStatusBadge: React.FC<{ status: PublishStatus }> = ({ status }) => {
  const styles: Record<PublishStatus, string> = {
    published: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    draft: 'bg-amber-400/15 text-amber-600 border-amber-500/25',
    hidden: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
  };
  return (
    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${styles[status]}`}>
      {PUBLISH_STATUS_LABELS_AR[status]}
    </span>
  );
};
