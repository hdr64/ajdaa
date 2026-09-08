import React from 'react';

/**
 * Architectural Luxury Background Decoration
 *
 * USER REVIEW TOGGLE:
 * Keep under review! If you don't like it, change SHOW_BACKGROUND_DECOR to false
 * to instantly disable all background geometric shapes and decorative gradients.
 */
export const SHOW_BACKGROUND_DECOR = true;

export const BackgroundDecor: React.FC = () => {
  if (!SHOW_BACKGROUND_DECOR) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
    >
      {/* 1. Subtle Architectural Radial Atmosphere */}
      <div className="absolute top-[-10%] right-[-5%] w-[800px] h-[800px] rounded-full bg-radial from-accent/7 via-accent/2 to-transparent blur-[140px] opacity-70" />
      <div className="absolute top-[40%] left-[-10%] w-[700px] h-[700px] rounded-full bg-radial from-gold/6 via-gold/1 to-transparent blur-[130px] opacity-60" />
      <div className="absolute bottom-[-10%] right-[20%] w-[900px] h-[600px] rounded-full bg-radial from-accent/5 via-accent/1 to-transparent blur-[150px] opacity-70" />

      {/* 2. Precision Architectural Contour Waves & Hairlines */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 dark:opacity-25 mix-blend-screen"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1440 3200"
      >
        <defs>
          <linearGradient id="bgLineGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="bgLineGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0" />
            <stop offset="50%" stopColor="var(--gold)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
          <pattern
            id="archGrid"
            width="120"
            height="120"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 120 0 L 0 0 0 120"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="0.5"
              strokeOpacity="0.08"
            />
          </pattern>
        </defs>

        {/* Subtle Architectural Grid Pattern */}
        <rect width="100%" height="100%" fill="url(#archGrid)" opacity="0.6" />

        {/* Precision flowing structural contour paths */}
        <path
          d="M-200 400 Q 400 650 900 350 T 1700 700"
          fill="none"
          stroke="url(#bgLineGrad1)"
          strokeWidth="1.2"
        />
        <path
          d="M-150 480 Q 450 730 950 430 T 1750 780"
          fill="none"
          stroke="url(#bgLineGrad1)"
          strokeWidth="0.8"
          strokeDasharray="4 6"
        />

        <path
          d="M 1600 1300 Q 1000 1600 500 1350 T -200 1700"
          fill="none"
          stroke="url(#bgLineGrad2)"
          strokeWidth="1.2"
        />
        <path
          d="M 1650 1380 Q 1050 1680 550 1430 T -150 1780"
          fill="none"
          stroke="url(#bgLineGrad2)"
          strokeWidth="0.8"
          strokeDasharray="4 6"
        />

        <path
          d="M-100 2400 Q 600 2700 1100 2400 T 1800 2800"
          fill="none"
          stroke="url(#bgLineGrad1)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
};
