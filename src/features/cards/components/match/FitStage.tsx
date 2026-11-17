'use client';

// The match is laid out for 1920×900 and scaled to the box it gets, up or down; a box of another
// shape gets the extra room (today's FitStage). Things drawn outside it (the drag ghost) divide by the scale.
import React, { useLayoutEffect, useRef, useState } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { FitScaleCtx } from '@/components/card-lab/ui';

export const BASE_W = 1920; export const BASE_H = 900;

export function FitStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: BASE_W, h: BASE_H });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const calc = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    calc(); const ro = new ResizeObserver(calc); ro.observe(el); return () => ro.disconnect();
  }, []);
  const k = Math.min(box.w / BASE_W, box.h / BASE_H) || 1;
  return (
    <TooltipPrimitive.Provider delayDuration={120} skipDelayDuration={60}>
      <div ref={ref} className="relative w-full h-full overflow-hidden">
        <div className="absolute left-0 top-0" style={{ width: box.w / k, height: box.h / k, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <FitScaleCtx.Provider value={k}>{children}</FitScaleCtx.Provider>
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
