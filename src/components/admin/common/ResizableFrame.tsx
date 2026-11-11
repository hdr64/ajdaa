import React, { useEffect, useRef, useState } from 'react';

interface Size {
  w: number;
  h: number;
}

interface ResizableFrameProps {
  /** Starting size; clamped to the viewport. */
  initial: Size;
  /** Smallest size the admin can drag the frame to. */
  min?: Size;
  className?: string;
  children: React.ReactNode;
}

const MARGIN = 8;

/** Eight resize handles: each edge and each corner. `dir` letters say which sides move. */
const HANDLES: { dir: string; className: string }[] = [
  { dir: 'n', className: 'top-0 inset-x-3.5 h-1.5 cursor-ns-resize' },
  { dir: 's', className: 'bottom-0 inset-x-3.5 h-1.5 cursor-ns-resize' },
  { dir: 'w', className: 'left-0 inset-y-3.5 w-1.5 cursor-ew-resize' },
  { dir: 'e', className: 'right-0 inset-y-3.5 w-1.5 cursor-ew-resize' },
  { dir: 'nw', className: 'top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize' },
  { dir: 'ne', className: 'top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize' },
  { dir: 'sw', className: 'bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize' },
  { dir: 'se', className: 'bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize' },
];

const clamp = (size: Size, min: Size): Size => ({
  w: Math.min(Math.max(size.w, min.w), Math.max(min.w, window.innerWidth - MARGIN * 2)),
  h: Math.min(Math.max(size.h, min.h), Math.max(min.h, window.innerHeight - MARGIN * 2)),
});

/**
 * A modal panel that stays centered in its overlay and can be resized from every
 * edge and corner. Because it is centered, dragging one side moves both sides by the
 * same amount. Put it inside a `fixed inset-0 flex items-center justify-center` overlay.
 */
export const ResizableFrame: React.FC<ResizableFrameProps> = ({
  initial,
  min = { w: 288, h: 224 },
  className = '',
  children,
}) => {
  const [size, setSize] = useState<Size>(() => clamp(initial, min));
  const drag = useRef<{ dir: string; px: number; py: number; start: Size } | null>(null);
  const minW = min.w;
  const minH = min.h;

  // Keep the frame inside the viewport when the browser window shrinks.
  useEffect(() => {
    const onResize = () => setSize((cur) => clamp(cur, { w: minW, h: minH }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minW, minH]);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>, dir: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { dir, px: e.clientX, py: e.clientY, start: size };
  };

  const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    const { w, h } = d.start;
    let nw = w;
    let nh = h;
    if (d.dir.includes('e')) nw = w + dx * 2;
    if (d.dir.includes('w')) nw = w - dx * 2;
    if (d.dir.includes('s')) nh = h + dy * 2;
    if (d.dir.includes('n')) nh = h - dy * 2;
    setSize(clamp({ w: nw, h: nh }, { w: minW, h: minH }));
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      className={`relative shrink-0 bg-surface rounded-2xl border border-muted-border/40 shadow-2xl flex flex-col overflow-hidden ${className}`}
      style={{ width: size.w, height: size.h }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
      {HANDLES.map(({ dir, className: handleClass }) => (
        <div
          key={dir}
          className={`absolute z-10 touch-none ${handleClass}`}
          onPointerDown={(e) => startDrag(e, dir)}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
      ))}
    </div>
  );
};
