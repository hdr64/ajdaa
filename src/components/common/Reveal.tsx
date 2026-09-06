import React from 'react';
import { useIntersection } from '../../hooks/useIntersection';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  className?: string;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  direction = 'up',
  className = '',
}) => {
  const { ref, isVisible } = useIntersection<HTMLDivElement>({ 
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px' 
  });

  const getInitialTransform = () => {
    switch (direction) {
      case 'up': return 'translate3d(0, 24px, 0)';
      case 'down': return 'translate3d(0, -24px, 0)';
      case 'left': return 'translate3d(-24px, 0, 0)';
      case 'right': return 'translate3d(24px, 0, 0)';
      case 'none': return 'translate3d(0, 0, 0) scale(0.98)';
    }
  };

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: '700ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delay}ms`,
        transitionProperty: 'transform, opacity',
        transform: isVisible ? 'translate3d(0, 0, 0) scale(1)' : getInitialTransform(),
        opacity: isVisible ? 1 : 0,
      }}
      className={`gpu-layer ${className}`}
    >
      {children}
    </div>
  );
};