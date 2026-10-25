import React from 'react';

/**
 * Small tab hanging from the top edge on the test instance only. The flag is
 * baked in at build time (`VITE_APP_ENV=test`, set by the test deploy build),
 * so a production bundle contains no badge at all.
 */
export const EnvBadge: React.FC = () => {
  if (import.meta.env.VITE_APP_ENV !== 'test') return null;
  return (
    <div
      dir="ltr"
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-1/2 z-[9999] -translate-x-1/2 rounded-b-lg bg-amber-500 px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-black shadow-md"
    >
      Test environment
    </div>
  );
};
