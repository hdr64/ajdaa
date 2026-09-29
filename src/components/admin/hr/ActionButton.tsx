/**
 * The icon action every HR row and card ends with. A locked action carries the
 * reason it is locked, and the reason sits on the wrapper because a disabled
 * button swallows its own tooltip in every browser.
 */
import React from 'react';

export const ICON_BUTTON =
  'p-1.5 rounded-lg border border-muted-border/40 text-neutral-text/60 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

export const ICON_BUTTON_ACCENT = `${ICON_BUTTON} hover:text-accent hover:bg-accent/10`;

export const ICON_BUTTON_DANGER = `${ICON_BUTTON} text-neutral-text/40 hover:text-red-500 hover:bg-red-500/10`;

interface ActionButtonProps {
  /** Spoken name, e.g. `تعديل دور مسؤول التأجير`. */
  label: string;
  /** The reason the action is unavailable, or `null` when it is available. */
  lockedReason: string | null;
  /** Verb shown while the action is available. */
  hint: string;
  onClick: () => void;
  icon: React.ReactNode;
  className?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  label,
  lockedReason,
  hint,
  onClick,
  icon,
  className = ICON_BUTTON,
}) => (
  <span title={lockedReason ?? hint} className="inline-flex">
    <button
      type="button"
      onClick={onClick}
      disabled={lockedReason !== null}
      aria-label={label}
      className={`${className} disabled:hover:bg-transparent`}
    >
      {icon}
    </button>
  </span>
);
