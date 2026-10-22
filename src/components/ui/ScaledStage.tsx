'use client';

// A full-section view laid out for a reference desktop size and scaled up to the space it gets,
// so a 1440p or ultrawide screen shows the same composition bigger instead of the same pixel
// sizes floating in empty space. It never scales down (smaller screens keep the normal layout)
// and does nothing below `minWidth` (phones and tablets scroll as usual).
//
// Inside the stage, `position: fixed` resolves against the stage, not the viewport: modals and
// drag previews must be portalled out (Radix tooltips/popovers already are). Code that turns
// pointer coordinates into layout pixels must divide by the scale — see `stageLocal`. Plain vh / vw
// still measure the real screen (so they get scaled twice); use var(--svh, 1vh) / var(--svw, 1vw).

import React, { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const StageScaleCtx = createContext(1);

/** The current stage scale (1 outside a stage) */
export function useStageScale() {
  return useContext(StageScaleCtx);
}

/** Pointer position relative to `el`, in its own (unscaled) layout pixels */
export function stageLocal(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  const kx = r.width ? el.offsetWidth / r.width : 1;
  const ky = r.height ? el.offsetHeight / r.height : 1;
  return { x: (clientX - r.left) * kx, y: (clientY - r.top) * ky };
}

export function ScaledStage({ children, baseW = 1920, baseH = 900, maxScale = 1.8, minWidth = 1024, className }: {
  children: React.ReactNode;
  /** The size the content is designed for; above it the stage scales up */
  baseW?: number;
  baseH?: number;
  maxScale?: number;
  minWidth?: number;
  /** Classes for the stage itself (the box the children lay out in) */
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const calc = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const on = size.w >= minWidth && size.h > 0;
  const scale = on ? Math.min(maxScale, Math.max(1, Math.min(size.h / baseH, size.w / baseW))) : 1;
  const staged = on && scale > 1;
  return (
    <div ref={outer} className="relative h-full w-full overflow-hidden">
      <StageScaleCtx.Provider value={staged ? scale : 1}>
        <div className={cn(staged ? 'absolute left-0 top-0' : 'h-full w-full', className)}
          style={staged ? {
            width: size.w / scale, height: size.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0',
            // Viewport units as the layout would see them on the reference screen: use
            // `var(--svh, 1vh)` / `var(--svw, 1vw)` inside a stage instead of vh / vw
            ['--svh' as string]: `calc(1vh / ${scale})`, ['--svw' as string]: `calc(1vw / ${scale})`,
          } : undefined}>
          {children}
        </div>
      </StageScaleCtx.Provider>
    </div>
  );
}
