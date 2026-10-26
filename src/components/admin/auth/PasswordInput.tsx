import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

import { useAdminT } from '../../../i18n/admin';

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  id?: string;
  isAr?: boolean;
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  required = false,
  id,
}) => {
  const [visible, setVisible] = useState(false);
  const { t } = useAdminT();

  const toggleVisibility = () => setVisible((v) => !v);

  const ariaLabel = visible ? t('auth.hidePassword') : t('auth.showPassword');

  return (
    <div className="relative flex items-center">
      <Lock className="absolute start-3.5 w-4 h-4 text-neutral-text/40 pointer-events-none" />
      <input
        type={visible ? 'text' : 'password'}
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        id={id}
        autoComplete={autoComplete}
        className="w-full ps-10 pe-10 py-3 rounded-xl bg-canvas border border-muted-border/50 text-xs text-heading outline-none focus:border-accent"
      />
      <button
        type="button"
        onClick={toggleVisibility}
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-pressed={visible}
        className="absolute end-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-neutral-text/50 hover:text-heading cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};