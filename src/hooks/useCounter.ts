import { useEffect, useState } from 'react';

export function useCounter(target: number, duration: number = 1500, startAnimation: boolean = false): number {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!startAnimation) return;

    let startTime: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Smooth ease-out cubic curve: 1 - (1 - x)^3
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeProgress * target));

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    };

    frameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [target, duration, startAnimation]);

  return count;
}