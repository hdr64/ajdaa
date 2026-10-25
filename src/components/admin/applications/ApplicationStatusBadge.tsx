import React from 'react';
import { useAdminT } from '../../../i18n/admin/useAdminT';

const KNOWN = new Set(['new', 'reviewed', 'shortlisted', 'rejected', 'hired']);

export const ApplicationStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useAdminT();
  const label = KNOWN.has(status)
    ? t(`applications.status.${status}` as 'applications.status.new' | 'applications.status.reviewed' | 'applications.status.shortlisted' | 'applications.status.rejected' | 'applications.status.hired')
    : status;
  return (
    <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
      {label}
    </span>
  );
};

export default ApplicationStatusBadge;