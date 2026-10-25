import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Compact variant for use inside tables and cards. */
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, compact }) => (
  <div
    className={`text-center rounded-2xl border border-dashed border-muted-border/50 ${
      compact ? 'py-10 px-4' : 'py-16 px-6 bg-surface'
    }`}
  >
    <Icon className="w-8 h-8 text-neutral-text/35 mx-auto mb-3" />
    <p className="text-sm font-black text-heading">{title}</p>
    {description && <p className="text-xs text-neutral-text/60 mt-1.5 max-w-md mx-auto leading-relaxed">{description}</p>}
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);
