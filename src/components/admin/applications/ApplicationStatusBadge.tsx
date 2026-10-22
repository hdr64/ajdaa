import React from 'react';

const LABELS: Record<string, string> = {
  new: 'جديد',
  reviewed: 'تمت المراجعة',
  shortlisted: 'في القائمة المختصرة',
  rejected: 'مرفوض',
  hired: 'تم التوظيف',
};

export const ApplicationStatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold text-[10px]">
    {LABELS[status] ?? status}
  </span>
);

export default ApplicationStatusBadge;