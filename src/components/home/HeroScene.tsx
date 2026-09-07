import React from 'react';

export const HeroScene: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none overflow-hidden select-none ${className || ''}`}
    >
      {/* Soft Subtle Ambient Mesh Orbs - Low opacity to preserve background clarity */}
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-accent/6 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-[450px] h-[450px] bg-gold/5 rounded-full blur-[140px]" />
      <div className="absolute top-10 right-10 w-[300px] h-[300px] bg-accent-light/4 rounded-full blur-[100px]" />
    </div>
  );
};
