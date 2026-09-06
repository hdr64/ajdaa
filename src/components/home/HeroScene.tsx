import React from 'react';

export const HeroScene: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden select-none ${className || ''}`}
    >
      {/* Soft Ambient Mesh Orbs */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-accent/12 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-[450px] h-[450px] bg-gold/10 rounded-full blur-[140px]" />
      <div className="absolute top-10 right-10 w-[300px] h-[300px] bg-accent-light/8 rounded-full blur-[100px]" />
    </div>
  );
};
